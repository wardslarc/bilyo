import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { User, Business, VerificationToken } from '@/models';

export const dynamic = 'force-dynamic';

/**
 * Daily Reaper Cron Job (SIGNUP_VERIFICATION_PLAN.md §4.10).
 * Purges unverified accounts older than 7 days, along with their tokens and empty business profiles.
 * Authenticated via Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  return handleReap(req);
}

export async function POST(req: NextRequest) {
  return handleReap(req);
}

async function handleReap(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    // 404, not 401 — do not confirm the endpoint exists to an unauthenticated caller.
    return new NextResponse(null, { status: 404 });
  }

  try {
    await dbConnect();

    // 7 days ago cutoff per §4.10
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await User.find({
      emailVerifiedAt: null,
      createdAt: { $lt: sevenDaysAgo },
    })
      .select('_id')
      .lean();

    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { reapedCount: 0, message: 'No expired unverified accounts found' },
        { status: 200 }
      );
    }

    const userIds = candidates.map((c) => c._id);

    // 1. Delete associated verification tokens
    await VerificationToken.deleteMany({ userId: { $in: userIds } });

    // 2. Delete empty business profiles if created during registration
    await Business.deleteMany({ userId: { $in: userIds } });

    // 3. Delete unverified user documents
    const deleteResult = await User.deleteMany({ _id: { $in: userIds } });

    return NextResponse.json(
      {
        reapedCount: deleteResult.deletedCount,
        message: `Successfully reaped ${deleteResult.deletedCount} unverified account(s)`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[cron/reap-unverified] Error executing reaper:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
