import type { EmailMessageStatus } from '@/types';

/**
 * Status precedence ladder ranks (EMAIL_DELIVERY_PLAN.md §5.4):
 * QUEUED < SENT < DELIVERED < DELAYED < FAILED < SUPPRESSED < BOUNCED < COMPLAINED
 *
 * Guarantees out-of-order webhook delivery (e.g. late DELIVERED after BOUNCED)
 * never overwrites a more severe terminal state.
 */
export const STATUS_PRECEDENCE: Record<EmailMessageStatus, number> = {
  SKIPPED: 0,
  QUEUED: 10,
  SENT: 20,
  DELIVERED: 30,
  DELAYED: 40,
  FAILED: 45,
  SUPPRESSED: 50,
  BOUNCED: 60,
  COMPLAINED: 70,
};

/**
 * Pure function to determine if an email's status can advance.
 * Only returns true if the incoming status ranks higher than the current status.
 */
export function canAdvanceStatus(
  currentStatus: EmailMessageStatus,
  incomingStatus: EmailMessageStatus
): boolean {
  const currentRank = STATUS_PRECEDENCE[currentStatus] ?? 0;
  const incomingRank = STATUS_PRECEDENCE[incomingStatus] ?? 0;
  return incomingRank > currentRank;
}
