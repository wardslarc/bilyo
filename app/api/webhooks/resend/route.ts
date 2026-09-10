import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { EmailMessage, WebhookReceipt, User } from '@/models';
import type { EmailMessageStatus } from '@/types';
import { verifySvixSignature } from '@/lib/email/signature';
import { canAdvanceStatus } from '@/lib/email/status';

export const dynamic = 'force-dynamic';

const EVENT_STATUS_MAP: Record<string, EmailMessageStatus> = {
  'email.sent': 'SENT',
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.delivery_delayed': 'DELAYED',
  'email.failed': 'FAILED',
  'email.suppressed': 'SUPPRESSED',
};

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const svixHeaders = {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    };

    // 1. Signature & Replay Window Verification (EMAIL_DELIVERY_PLAN.md §5.4)
    const verification = verifySvixSignature(
      rawBody,
      svixHeaders,
      process.env.RESEND_WEBHOOK_SECRET
    );

    if (!verification.valid) {
      console.warn('[webhook/resend] Invalid signature:', verification.error);
      return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 400 });
    }

    await connectDB();

    const svixId = svixHeaders.id!;

    // 2. Deduplication via svix-id (24h TTL)
    try {
      await WebhookReceipt.create({ svixId, receivedAt: new Date() });
    } catch (receiptError: unknown) {
      const code = (receiptError as { code?: number })?.code;
      if (code === 11000) {
        // Idempotent duplicate: already processed
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      console.error('[webhook/resend] WebhookReceipt insert error:', receiptError);
    }

    // 3. Parse and match payload
    let payload: {
      type?: string;
      created_at?: string;
      data?: {
        email_id?: string;
        id?: string;
        [key: string]: unknown;
      };
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = payload.type || '';
    const incomingStatus = EVENT_STATUS_MAP[eventType];

    // Silently acknowledge unmonitored events (e.g. open/click or contact events) with 200
    if (!incomingStatus) {
      return NextResponse.json({ received: true, ignored: true, type: eventType }, { status: 200 });
    }

    const providerId = payload.data?.email_id || payload.data?.id;
    if (!providerId) {
      return NextResponse.json({ received: true, missing_provider_id: true }, { status: 200 });
    }

    // 4. Correlate by providerId ONLY (EMAIL_DELIVERY_PLAN.md §5.4 item 6)
    const existing = await EmailMessage.findOne({ providerId });
    if (!existing) {
      return NextResponse.json({ received: true, unrecognized_provider_id: true }, { status: 200 });
    }

    // 5. Apply Status Precedence Ladder
    if (canAdvanceStatus(existing.status, incomingStatus)) {
      const eventDate = payload.created_at ? new Date(payload.created_at) : new Date();
      const updateSet: Record<string, unknown> = {
        status: incomingStatus,
      };

      if (incomingStatus === 'DELIVERED') {
        updateSet.deliveredAt = eventDate;
      } else if (incomingStatus === 'BOUNCED') {
        updateSet.bouncedAt = eventDate;

        // Hard-bounce feedback loop on email verification (SIGNUP_VERIFICATION_PLAN.md §4.9)
        const bounceType = String(
          (payload.data as { bounce_type?: string; type?: string })?.bounce_type ||
          (payload.data as { bounce_type?: string; type?: string })?.type ||
          ''
        ).toLowerCase();

        // Resend flags permanent/hard bounces; soft bounces (transient/full) must not kill account
        const isHardBounce =
          bounceType.includes('permanent') ||
          bounceType.includes('hard') ||
          (!bounceType.includes('transient') && !bounceType.includes('soft'));

        if (existing.kind === 'EMAIL_VERIFICATION' && isHardBounce) {
          await User.updateOne(
            { _id: existing.userId },
            { $set: { emailBouncedAt: eventDate } }
          );
        }
      } else if (incomingStatus === 'COMPLAINED') {
        updateSet.complainedAt = eventDate;
      }

      // Suppression rows must outlive the 12-month retention window (Privacy
      // Policy §9). lib/email/send.ts reads BOUNCED/COMPLAINED rows before every
      // send to decide whether an address is suppressed, so letting these expire
      // would silently re-enable sending to an address that already rejected us.
      // purgeAt: null is inert to the TTL index — see models/email-message.ts.
      if (incomingStatus === 'BOUNCED' || incomingStatus === 'COMPLAINED') {
        updateSet.purgeAt = null;
      }

      await EmailMessage.findByIdAndUpdate(existing._id, {
        $set: updateSet,
      });
    }

    return NextResponse.json({ received: true, status: incomingStatus }, { status: 200 });
  } catch (error) {
    console.error('[webhook/resend] Uncaught exception:', error);
    // Return 500 only for unexpected system failures
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
