/**
 * Site-wide constants that appear in user-facing copy and in the legal pages.
 * Kept in one place so the support address can never drift between the footer,
 * the Terms and the Privacy Policy.
 */

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bilyoapp.com';

/** Operator of the service, as named in the Terms (§1) and Privacy Policy (§15). */
export const OPERATOR_NAME = 'Carls Dale Escalo';
export const OPERATOR_ROLE = 'Software Developer';

/** Venue for disputes under the Terms (§15). */
export const LEGAL_VENUE = 'Cavite, Philippines';

/**
 * Effective date shown at the top of both legal documents.
 * Update this whenever a material change ships, and email registered users
 * 14 days before it takes effect (Terms §14).
 */
export const LEGAL_EFFECTIVE_DATE = 'September 11, 2026';
export const LEGAL_VERSION = '1.1';

/** Retention windows promised by the Privacy Policy (§9), enforced in code. */
export const CLOSED_ACCOUNT_PURGE_DAYS = 30;
export const EMAIL_RECORD_RETENTION_DAYS = 365;
