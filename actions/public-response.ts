'use server';

import dbConnect from '@/lib/mongodb';
import { Quotation } from '@/models/quotation';
import { User } from '@/models/user';
import { recordEvent } from '@/lib/events';
import { formatDate } from '@/lib/dates';
import {
  publicResponseSchema,
  type PublicResponseInput,
} from '@/lib/validation/response';
import type { ActionResult } from '@/types';

// Rate limiting in-memory per public code (§6.7, P3-T02)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(code: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(code);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(code, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

export interface PublicResponseResult {
  status: 'ACCEPTED' | 'DECLINED';
  respondedAt: string;
  respondedByName: string;
}

/**
 * Respond to a quotation publicly via publicCode (accept or decline).
 * AGENTS.md §4.6:
 * The public response path is the only unauthenticated write.
 * It takes a code, never an id; re-reads the quotation server-side;
 * rejects unless SENT or VIEWED, unexpired, and unanswered;
 * writes once and appends one event. A second response is refused, not overwritten.
 */
export async function respondToQuotation(
  input: PublicResponseInput
): Promise<ActionResult<PublicResponseResult>> {
  try {
    // 1. Validate payload boundary
    const parsed = publicResponseSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] ? String(issue.path[0]) : '_form';
        fieldErrors[key] = issue.message;
      }
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
        fieldErrors,
      };
    }

    const data = parsed.data;

    // 2. Rate limiting by code
    if (!checkRateLimit(data.code)) {
      return {
        ok: false,
        error: 'Too many attempts. Please wait a minute and try again.',
      };
    }

    await dbConnect();

    // 3. Re-read quotation server-side by code only
    const existing = await Quotation.findOne({
      $or: [{ publicCode: data.code }, { publicToken: data.code }],
    }).lean();

    if (!existing) {
      return { ok: false, error: 'Quotation not found' };
    }

    // 4. Check revocation
    if (existing.publicCodeRevokedAt || existing.publicTokenRevokedAt) {
      return { ok: false, error: 'This quotation link has been revoked.' };
    }

    // 5. Check owner account standing (abuse / suspension)
    const owner = await User.findById(existing.userId, {
      publicLinksDisabledAt: 1,
      suspendedAt: 1,
    }).lean();

    if (!owner || owner.publicLinksDisabledAt || owner.suspendedAt) {
      return { ok: false, error: 'This quotation link is currently inactive.' };
    }

    // 6. Check already answered — a second response is refused, not overwritten (§6.7, P3-T02 accept)
    if (
      existing.respondedAt ||
      existing.status === 'ACCEPTED' ||
      existing.status === 'DECLINED'
    ) {
      const dateStr = existing.respondedAt ? formatDate(existing.respondedAt) : 'earlier';
      const responder = existing.respondedByName ? ` by ${existing.respondedByName}` : '';
      return {
        ok: false,
        error: `This quotation was already ${existing.status.toLowerCase()} on ${dateStr}${responder}.`,
      };
    }

    // 7. Check expiration against today (Manila calendar day)
    const validUntil = new Date(existing.validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (validUntil < today) {
      return {
        ok: false,
        error: 'This quotation has expired and can no longer be accepted.',
      };
    }

    // 8. Check status: must be SENT or VIEWED
    if (existing.status !== 'SENT' && existing.status !== 'VIEWED') {
      return {
        ok: false,
        error: `Cannot respond to a quotation in ${existing.status.toLowerCase()} status.`,
      };
    }

    // 9. Coarse response IP extraction
    let responseIp = 'unknown';
    try {
      const { headers } = await import('next/headers');
      const headerList = await headers();
      const forwardedFor = headerList.get('x-forwarded-for');
      const realIp = headerList.get('x-real-ip');
      responseIp = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || 'unknown';
    } catch {
      // Non-Next context or local test
    }

    const now = new Date();
    const targetStatus = data.action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

    // 10. Atomic write: guarantees single response even with concurrent requests
    const updated = await Quotation.findOneAndUpdate(
      {
        _id: existing._id,
        status: { $in: ['SENT', 'VIEWED'] },
        respondedAt: null,
      },
      {
        $set: {
          status: targetStatus,
          respondedAt: now,
          respondedByName: data.name,
          responseIp,
        },
      },
      { returnDocument: 'after', lean: true }
    );

    if (!updated) {
      return {
        ok: false,
        error: 'This quotation was already answered from another session.',
      };
    }

    // 11. Append append-only event with actor: 'CLIENT' (§6.6, P3-T02)
    await recordEvent({
      quotationId: updated._id,
      userId: updated.userId,
      type: targetStatus,
      actor: 'CLIENT',
      metadata: {
        respondedByName: data.name,
        action: data.action,
        responseIp,
      },
    });

    // 12. Revalidate paths
    try {
      const { revalidatePath } = await import('next/cache');
      revalidatePath(`/q/${data.code}`);
      revalidatePath(`/dashboard/quotations/${existing._id}`);
      revalidatePath('/dashboard/quotations');
    } catch {
      // Non-Next context
    }

    // 13. Send E2 notification to owner (EMAIL_DELIVERY_PLAN.md §2, P6-T07)
    // Non-blocking: a dead mailer must never roll back an acceptance
    try {
      const ownerUser = await User.findById(updated.userId).select('email').lean();
      if (ownerUser?.email) {
        const { sendEmail } = await import('@/lib/email/send');
        const { renderQuotationRespondedEmail } = await import('@/lib/email/templates/quotation-responded');
        const { formatMoney } = await import('@/lib/money');

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const detailUrl = `${appUrl}/dashboard/quotations/${updated._id}`;
        const totalFormatted = formatMoney(updated.totalCentavos || 0);
        const clientName = updated.customerSnapshot?.name || 'Client';

        const { subject, html, text } = renderQuotationRespondedEmail({
          quotationNumber: updated.number,
          clientName,
          respondedByName: data.name,
          decision: targetStatus,
          totalFormatted,
          detailUrl,
        });

        await sendEmail({
          userId: updated.userId,
          quotationId: updated._id,
          kind: 'QUOTATION_RESPONDED',
          toEmail: ownerUser.email,
          subject,
          html,
          text,
          idempotencyKey: `quotation-responded:${String(updated._id)}:${targetStatus.toLowerCase()}`,
        });
      }
    } catch (notifyErr) {
      console.error('[respondToQuotation] Failed to notify owner by email:', notifyErr);
    }

    return {
      ok: true,
      data: {
        status: targetStatus,
        respondedAt: now.toISOString(),
        respondedByName: data.name,
      },
    };
  } catch (error) {
    console.error('respondToQuotation error:', error);
    return {
      ok: false,
      error: 'An unexpected error occurred while processing your response. Please try again.',
    };
  }
}
