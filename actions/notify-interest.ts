'use server';

import dbConnect from '@/lib/mongodb';
import { Interest } from '@/models/interest';
import { Quotation } from '@/models/quotation';
import { requireUser } from '@/lib/auth-guards';
import { auth } from '@/lib/auth';
import {
  pricingInterestSchema,
  trialWallSurveySchema,
  type PricingInterestInput,
  type TrialWallSurveyInput,
} from '@/lib/validation/interest';
import type { ActionResult, IUsageSnapshot } from '@/types';

/**
 * Computes live quotation usage metrics for a user (§3.4).
 * Strictly scoped by userId.
 */
export async function getUserUsageSnapshot(userId: string): Promise<IUsageSnapshot> {
  await dbConnect();
  const quotations = await Quotation.find({ userId })
    .select('status totalCentavos sentAt')
    .lean();

  let quotationsSent = 0;
  let quotationsAccepted = 0;
  let acceptedValueCentavos = 0;

  for (const q of quotations) {
    if (
      q.status === 'SENT' ||
      q.status === 'VIEWED' ||
      q.status === 'ACCEPTED' ||
      q.status === 'DECLINED' ||
      q.sentAt
    ) {
      quotationsSent++;
    }
    if (q.status === 'ACCEPTED') {
      quotationsAccepted++;
      acceptedValueCentavos += Number(q.totalCentavos || 0);
    }
  }

  return {
    quotationsSent,
    quotationsAccepted,
    acceptedValueCentavos,
  };
}

/**
 * Public/User action to register interest on pricing plans (§3.4, A5).
 * Works for both unauthenticated visitors and logged-in accounts.
 * Idempotent.
 */
export async function recordPricingInterest(
  input: Partial<PricingInterestInput>
): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    await dbConnect();
    const session = await auth();
    const sessionUser = session?.user;

    // Use session email if authenticated, otherwise use submitted email
    const emailToUse = sessionUser?.email || input.email;
    const parseResult = pricingInterestSchema.safeParse({
      ...input,
      email: emailToUse,
    });

    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid email address',
      };
    }

    const { email, passType } = parseResult.data;

    let usageSnapshot: IUsageSnapshot = {
      quotationsSent: 0,
      quotationsAccepted: 0,
      acceptedValueCentavos: 0,
    };

    if (sessionUser?.id) {
      usageSnapshot = await getUserUsageSnapshot(sessionUser.id);
    }

    if (sessionUser?.id) {
      await Interest.findOneAndUpdate(
        { userId: sessionUser.id, source: 'PRICING_NOTIFY' },
        {
          $set: {
            email,
            passType: passType || null,
            usageSnapshot,
          },
          $setOnInsert: {
            userId: sessionUser.id,
            source: 'PRICING_NOTIFY',
          },
        },
        { upsert: true, new: true }
      );
    } else {
      await Interest.findOneAndUpdate(
        { email, source: 'PRICING_NOTIFY' },
        {
          $set: {
            passType: passType || null,
            usageSnapshot,
          },
          $setOnInsert: {
            email,
            source: 'PRICING_NOTIFY',
          },
        },
        { upsert: true, new: true }
      );
    }

    return { ok: true, data: { recorded: true } };
  } catch (error) {
    console.error('recordPricingInterest error:', (error as Error).message);
    return { ok: false, error: 'Failed to record interest. Please try again.' };
  }
}

/**
 * Authenticated action to record the Trial Wall willingness-to-pay survey (A6).
 * Reuses the interests collection with source='TRIAL_WALL' and snapshots real usage.
 */
export async function recordTrialWallSurvey(
  input: TrialWallSurveyInput
): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    const user = await requireUser();
    const parseResult = trialWallSurveySchema.safeParse(input);

    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Please complete the survey questions',
      };
    }

    const { answer, suggestedPriceCentavos, comment } = parseResult.data;
    await dbConnect();

    // Snapshot usage at the moment of answering (§3.4)
    const usageSnapshot = await getUserUsageSnapshot(user.id);

    await Interest.findOneAndUpdate(
      { userId: user.id, source: 'TRIAL_WALL' },
      {
        $set: {
          email: user.email,
          answer,
          suggestedPriceCentavos: suggestedPriceCentavos ?? null,
          comment: comment || null,
          usageSnapshot,
        },
        $setOnInsert: {
          userId: user.id,
          source: 'TRIAL_WALL',
        },
      },
      { upsert: true, new: true }
    );

    return { ok: true, data: { recorded: true } };
  } catch (error) {
    console.error('recordTrialWallSurvey error:', (error as Error).message);
    return { ok: false, error: 'Failed to submit response. Please try again.' };
  }
}
