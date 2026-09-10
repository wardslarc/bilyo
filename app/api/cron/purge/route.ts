import { NextRequest, NextResponse } from 'next/server';
import type { Types } from 'mongoose';
import connectDB from '@/lib/mongodb';
import {
  User,
  Business,
  Customer,
  Quotation,
  Counter,
  Event,
  EmailMessage,
  PasswordResetToken,
  VerificationToken,
} from '@/models';
import { deleteBusinessLogo } from '@/lib/blob';
import { CLOSED_ACCOUNT_PURGE_DAYS } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Unverified accounts are deleted after this long (Terms §3, Privacy §9). */
const UNVERIFIED_ACCOUNT_TTL_DAYS = 7;

/** Safety valve: never delete more than this many accounts in one run. */
const MAX_ACCOUNTS_PER_RUN = 200;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Deletes everything belonging to one user, then the user.
 *
 * Order matters: the user row goes last, so a failure part-way through leaves
 * the account still flagged for deletion and the next run picks it up again.
 * Deleting the user first would strand the remaining rows with no way to find
 * them.
 */
async function purgeUser(userId: Types.ObjectId): Promise<void> {
  // Best-effort: remove the logo from blob storage before the row that names it.
  const business = await Business.findOne({ userId }).select('logoUrl').lean();
  if (business?.logoUrl) {
    try {
      await deleteBusinessLogo(business.logoUrl);
    } catch (err) {
      // A stranded blob must not block the database purge.
      console.error('[cron/purge] logo delete failed for user', String(userId), err);
    }
  }

  await Promise.all([
    Quotation.deleteMany({ userId }),
    Event.deleteMany({ userId }),
    Customer.deleteMany({ userId }),
    Business.deleteMany({ userId }),
    Counter.deleteMany({ userId }),
    EmailMessage.deleteMany({ userId }),
    PasswordResetToken.deleteMany({ userId }),
    VerificationToken.deleteMany({ userId }),
  ]);

  await User.deleteOne({ _id: userId });
}

/**
 * Daily retention job. Enforces the two deletion promises the Privacy Policy
 * makes in §9:
 *
 *   1. Accounts registered but never verified are deleted after 7 days.
 *   2. Accounts the user closed are permanently deleted after 30 days.
 *
 * Email delivery records are NOT handled here — those expire through the TTL
 * index on emailMessages.purgeAt, because deleting one is self-contained.
 * Accounts need this job because deleting one cascades across collections,
 * which a TTL index cannot do.
 *
 * Schedule in vercel.json:
 *   { "crons": [{ "path": "/api/cron/purge", "schedule": "0 18 * * *" }] }
 *   (18:00 UTC = 02:00 Manila)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('[cron/purge] CRON_SECRET is not set; refusing to run.');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    // 404, not 401 — do not confirm the endpoint exists to an unauthenticated caller.
    return new NextResponse(null, { status: 404 });
  }

  try {
    await connectDB();

    const unverifiedCutoff = daysAgo(UNVERIFIED_ACCOUNT_TTL_DAYS);
    const closedCutoff = daysAgo(CLOSED_ACCOUNT_PURGE_DAYS);

    const [unverified, closed] = await Promise.all([
      User.find({
        emailVerifiedAt: null,
        createdAt: { $lt: unverifiedCutoff },
      })
        .select('_id')
        .limit(MAX_ACCOUNTS_PER_RUN)
        .lean(),
      User.find({
        deletionRequestedAt: { $ne: null, $lt: closedCutoff },
      })
        .select('_id')
        .limit(MAX_ACCOUNTS_PER_RUN)
        .lean(),
    ]);

    // De-duplicate: a closed account may also be unverified.
    const targets = new Map<string, Types.ObjectId>();
    for (const u of [...unverified, ...closed]) {
      targets.set(String(u._id), u._id);
    }

    let purged = 0;
    const failed: string[] = [];

    for (const userId of targets.values()) {
      try {
        await purgeUser(userId);
        purged += 1;
      } catch (err) {
        failed.push(String(userId));
        console.error('[cron/purge] purge failed for user', String(userId), err);
      }
    }

    const summary = {
      ok: true,
      unverifiedFound: unverified.length,
      closedFound: closed.length,
      purged,
      failed: failed.length,
      ranAt: new Date().toISOString(),
    };

    console.log('[cron/purge]', JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[cron/purge] Uncaught exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
