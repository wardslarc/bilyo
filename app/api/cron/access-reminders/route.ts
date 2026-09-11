import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User, EmailMessage } from '@/models';
import { accessState } from '@/lib/access';
import { formatDate } from '@/lib/dates';
import { renderAccessExpiringEmail } from '@/lib/email/templates/access-expiring';
import { sendEmail } from '@/lib/email/send';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Access Expiry Reminders Cron (§6.10, ACCESS_ROLLOUT_PLAN.md A7)
 * Runs daily at 01:00 UTC (09:00 Manila).
 * Sends reminder when daysLeft === 7 or daysLeft === 1.
 * Idempotent by `{ userId, accessUntil, daysLeft }`.
 * Skips suspended users.
 * Inert while accessUntil is null.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('[cron/access-reminders] CRON_SECRET is not set; refusing to run.');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    await connectDB();

    const now = new Date();
    // Query users with an active accessUntil who are not suspended or flagged for deletion
    const users = await User.find({
      accessUntil: { $ne: null, $gt: now },
      suspendedAt: null,
      deletionRequestedAt: null,
      emailBouncedAt: null,
    }).select('_id name email accessUntil firstPaidAt').lean();

    let processed = 0;
    let sent = 0;
    let skipped = 0;

    const baseUrl = process.env.APP_URL || 'https://bilyoapp.com';
    const topUpUrl = `${baseUrl}/pricing`;

    for (const user of users) {
      if (!user.accessUntil) continue;
      processed++;

      const state = accessState(user, now);
      // Only remind for 7 days left or 1 day left
      if (state.daysLeft !== 7 && state.daysLeft !== 1) {
        skipped++;
        continue;
      }

      const accessUntilMs = new Date(user.accessUntil).getTime();
      const idempotencyKey = `access-expiring-${user._id}-${accessUntilMs}-${state.daysLeft}d`;

      // Check if already sent
      const existing = await EmailMessage.findOne({
        userId: user._id,
        kind: 'ACCESS_EXPIRING',
        idempotencyKey,
      }).select('_id').lean();

      if (existing) {
        skipped++;
        continue;
      }

      const { subject, html, text } = renderAccessExpiringEmail({
        daysLeft: state.daysLeft,
        accessUntilFormatted: formatDate(user.accessUntil),
        topUpUrl,
        userName: user.name,
      });

      const result = await sendEmail({
        userId: user._id,
        kind: 'ACCESS_EXPIRING',
        toEmail: user.email,
        subject,
        html,
        text,
        idempotencyKey,
      });

      if (result.ok) {
        sent++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      sent,
      skipped,
      runAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[cron/access-reminders] execution failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
