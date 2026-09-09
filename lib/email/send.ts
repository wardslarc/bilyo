import { Types } from 'mongoose';
import connectDB from '@/lib/mongodb';
import { EmailMessage } from '@/models/email-message';
import type { EmailMessageKind, EmailMessageStatus } from '@/types';
import { getResendClient, isDryRun, getEmailFrom } from './client.ts';
import { canSendTo, type CanSendContext, type SuppressionReason } from './suppression.ts';

export interface SendEmailOptions {
  userId: string | Types.ObjectId;
  quotationId?: string | Types.ObjectId | null;
  kind: EmailMessageKind;
  toEmail: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  owner?: CanSendContext['owner'];
  quotation?: CanSendContext['quotation'];
}

export type SendEmailResult =
  | { ok: true; emailMessageId: string; providerId?: string; skipped?: boolean; reason?: string }
  | { ok: false; error: string; reason?: SuppressionReason };

/**
 * The single entry point for sending emails (EMAIL_DELIVERY_PLAN.md §3, §4).
 * Always records in the outbox ledger (emailMessages) and never throws.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    await connectDB();

    const normalizedEmail = options.toEmail.trim().toLowerCase();
    const dryRunActive = isDryRun();

    // 1. Check prior suppression in outbox ledger
    let isSuppressedBounce = false;
    let isSuppressedComplaint = false;

    if (normalizedEmail) {
      const priorSuppression = await EmailMessage.findOne({
        toEmail: normalizedEmail,
        status: { $in: ['BOUNCED', 'COMPLAINED'] },
      })
        .select('status')
        .lean();

      if (priorSuppression) {
        if (priorSuppression.status === 'COMPLAINED') isSuppressedComplaint = true;
        if (priorSuppression.status === 'BOUNCED') isSuppressedBounce = true;
      }
    }

    // 2. Evaluate pure validation gate
    const gateResult = canSendTo({
      toEmail: normalizedEmail,
      owner: options.owner,
      quotation: options.quotation,
      isSuppressedBounce,
      isSuppressedComplaint,
      isDryRun: dryRunActive,
    });

    // Handle gate rejections
    if (!gateResult.ok) {
      const isDry = gateResult.reason === 'DRY_RUN';
      const status: EmailMessageStatus = isDry
        ? 'SKIPPED'
        : gateResult.reason.startsWith('SUPPRESSED')
          ? 'SUPPRESSED'
          : 'SKIPPED';

      const doc = await EmailMessage.findOneAndUpdate(
        { idempotencyKey: options.idempotencyKey },
        {
          $setOnInsert: {
            userId: options.userId,
            quotationId: options.quotationId || null,
            kind: options.kind,
            toEmail: normalizedEmail || 'unknown@none',
            subject: options.subject,
            idempotencyKey: options.idempotencyKey,
            queuedAt: new Date(),
          },
          $set: {
            status,
            lastError: isDry ? 'DRY_RUN: Simulated email transport' : `Gate rejected: ${gateResult.reason}`,
            sentAt: isDry ? new Date() : null,
          },
        },
        { upsert: true, new: true }
      );

      if (isDry) {
        return {
          ok: true,
          emailMessageId: String(doc._id),
          skipped: true,
          reason: 'DRY_RUN',
        };
      }

      return {
        ok: false,
        error: `Email skipped: ${gateResult.reason}`,
        reason: gateResult.reason,
      };
    }

    // 3. Local Idempotency Check & Outbox record upsert
    const outbox = await EmailMessage.findOneAndUpdate(
      { idempotencyKey: options.idempotencyKey },
      {
        $setOnInsert: {
          userId: options.userId,
          quotationId: options.quotationId || null,
          kind: options.kind,
          toEmail: normalizedEmail,
          subject: options.subject,
          idempotencyKey: options.idempotencyKey,
          status: 'QUEUED',
          attempts: 0,
          queuedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // If already sent or delivered, return success immediately
    if (outbox.status === 'SENT' || outbox.status === 'DELIVERED') {
      return {
        ok: true,
        emailMessageId: String(outbox._id),
        providerId: outbox.providerId || undefined,
      };
    }

    // 4. Dispatch via Resend Client
    const resend = getResendClient();
    if (!resend) {
      // Fallback if client is missing despite dry-run check
      await EmailMessage.findByIdAndUpdate(outbox._id, {
        $set: { status: 'SKIPPED', lastError: 'Resend client unavailable' },
      });
      return { ok: true, emailMessageId: String(outbox._id), skipped: true, reason: 'NO_CLIENT' };
    }

    const fromAddress = getEmailFrom();
    const sendPayload: Parameters<typeof resend.emails.send>[0] = {
      from: fromAddress,
      to: [normalizedEmail],
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: {
        'Idempotency-Key': options.idempotencyKey,
      },
    };

    if (options.replyTo && options.replyTo.trim()) {
      sendPayload.replyTo = options.replyTo.trim();
    }

    const { data, error } = await resend.emails.send(sendPayload);

    if (error) {
      await EmailMessage.findByIdAndUpdate(outbox._id, {
        $inc: { attempts: 1 },
        $set: {
          status: 'FAILED',
          lastError: error.message || 'Unknown Resend error',
        },
      });
      return {
        ok: false,
        error: error.message || 'Resend error',
      };
    }

    const providerId = data?.id;
    await EmailMessage.findByIdAndUpdate(outbox._id, {
      $inc: { attempts: 1 },
      $set: {
        providerId: providerId || null,
        status: 'SENT',
        sentAt: new Date(),
        lastError: null,
      },
    });

    return {
      ok: true,
      emailMessageId: String(outbox._id),
      providerId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lib/email/send] Uncaught email send exception:', message);
    return { ok: false, error: message };
  }
}
