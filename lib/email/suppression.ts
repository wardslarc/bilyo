export type SuppressionReason =
  | 'NO_ADDRESS'
  | 'OWNER_SUSPENDED'
  | 'LINKS_DISABLED'
  | 'CODE_REVOKED'
  | 'SUPPRESSED_BOUNCE'
  | 'SUPPRESSED_COMPLAINT'
  | 'DRY_RUN';

export type CanSendResult =
  | { ok: true }
  | { ok: false; reason: SuppressionReason };

export interface CanSendContext {
  toEmail?: string | null;
  owner?: {
    suspendedAt?: Date | string | null;
    publicLinksDisabledAt?: Date | string | null;
  } | null;
  quotation?: {
    publicCodeRevokedAt?: Date | string | null;
  } | null;
  isSuppressedBounce?: boolean;
  isSuppressedComplaint?: boolean;
  isDryRun?: boolean;
}

/**
 * Basic email format validator (RFC 5322 subset sufficient for boundary checks)
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Pure validation gate before sending any email (EMAIL_DELIVERY_PLAN.md §4.1).
 * No I/O, no DB calls, fully unit-testable.
 */
export function canSendTo(ctx: CanSendContext): CanSendResult {
  // 1. Address check
  if (!isValidEmail(ctx.toEmail)) {
    return { ok: false, reason: 'NO_ADDRESS' };
  }

  // 2. Owner suspended check
  if (ctx.owner?.suspendedAt) {
    return { ok: false, reason: 'OWNER_SUSPENDED' };
  }

  // 3. Owner public links disabled check
  if (ctx.owner?.publicLinksDisabledAt) {
    return { ok: false, reason: 'LINKS_DISABLED' };
  }

  // 4. Quotation public code revoked check
  if (ctx.quotation?.publicCodeRevokedAt) {
    return { ok: false, reason: 'CODE_REVOKED' };
  }

  // 5. Past complaint check (highest operational priority)
  if (ctx.isSuppressedComplaint) {
    return { ok: false, reason: 'SUPPRESSED_COMPLAINT' };
  }

  // 6. Past bounce check
  if (ctx.isSuppressedBounce) {
    return { ok: false, reason: 'SUPPRESSED_BOUNCE' };
  }

  // 7. Dry run check
  if (ctx.isDryRun) {
    return { ok: false, reason: 'DRY_RUN' };
  }

  return { ok: true };
}
