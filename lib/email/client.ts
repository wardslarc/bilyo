import { Resend } from 'resend';

let resendInstance: Resend | null = null;

/**
 * Returns singleton Resend client, or null if RESEND_API_KEY is not configured.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/**
 * Pure check for dry-run mode:
 * Active if MAIL_DRY_RUN=true OR RESEND_API_KEY is absent.
 */
export function isDryRun(): boolean {
  if (process.env.MAIL_DRY_RUN === 'true') return true;
  if (!process.env.RESEND_API_KEY) return true;
  return false;
}

/**
 * Returns default sender address from env with fallback to verified default.
 */
export function getEmailFrom(): string {
  return process.env.EMAIL_FROM || 'Bilyo <notifications@bilyoapp.com>';
}
