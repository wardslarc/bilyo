import dbConnect from './mongodb.ts';
import { Business } from '../models/business.ts';

export interface OnboardingGateResult {
  shouldRedirect: boolean;
  targetUrl?: string;
}

/**
 * Evaluates whether an authenticated user must be redirected to onboarding (M2-T02).
 * Rule: A signed-in user with no Business profile is redirected to /dashboard/settings?onboarding=1.
 * Prevents loops: If the user is already accessing /dashboard/settings, no redirect occurs.
 */
export async function checkOnboardingGate(
  userId: string,
  pathname: string
): Promise<OnboardingGateResult> {
  // If already visiting settings (including ?onboarding=1), do not redirect
  if (pathname.startsWith('/dashboard/settings')) {
    return { shouldRedirect: false };
  }

  await dbConnect();
  const hasBusiness = await Business.exists({ userId });

  if (!hasBusiness) {
    return {
      shouldRedirect: true,
      targetUrl: '/dashboard/settings?onboarding=1',
    };
  }

  return { shouldRedirect: false };
}
