import connectDB from '../mongodb.ts';
import { User } from '../../models/user.ts';
import { formatDate, formatDateTime } from '../dates.ts';
import { sendEmail } from './send.ts';
import { parseAdminEmails } from './recipients.ts';
import { renderAdminSignupAlertEmail } from './templates/admin-signup-alert.ts';

export interface AdminAlertState {
  attempted: boolean;
  recipients: number;
  sent: number;
  reason?: string;
}

/**
 * The operator addresses that receive platform alerts.
 * Same allowlist the admin console is gated by (AGENTS.md §4.9) — one source of
 * truth, so revoking admin access also stops the alerts. Pure, no I/O.
 */
export function getAdminAlertRecipients(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

/**
 * E6: tells the operator a new user finished email verification
 * (EMAIL_DELIVERY_PLAN.md §2, DEVELOPMENT_PLAN.md §12 P6-T06).
 *
 * Fires from the verification paths, after the write. Never throws and never
 * reports failure upward as an error: a dead mailer must not break a signup.
 * Idempotent per {user, recipient} through the outbox ledger, so the code-entry
 * path and the magic-link path cannot both mail the same signup twice.
 */
export async function notifyAdminOfSignup(
  userId: string,
  options: { verifiedAt?: Date } = {}
): Promise<AdminAlertState> {
  try {
    const recipients = getAdminAlertRecipients();
    if (recipients.length === 0) {
      return { attempted: false, recipients: 0, sent: 0, reason: 'NO_ADMIN_EMAILS' };
    }

    await connectDB();
    const user = await User.findById(userId).select(
      'name email createdAt emailVerifiedAt accessUntil'
    );
    if (!user) {
      return { attempted: false, recipients: recipients.length, sent: 0, reason: 'USER_NOT_FOUND' };
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verifiedAt = options.verifiedAt || user.emailVerifiedAt || new Date();

    const { subject, html, text } = renderAdminSignupAlertEmail({
      userName: user.name || 'Unnamed user',
      userEmail: user.email,
      registeredAtFormatted: user.createdAt ? formatDateTime(user.createdAt) : 'Unknown',
      verifiedAtFormatted: formatDateTime(verifiedAt),
      trialEndsFormatted: user.accessUntil ? formatDate(user.accessUntil) : undefined,
      adminUrl: `${appUrl}/admin/users/${user._id.toString()}`,
    });

    let sent = 0;
    for (const toEmail of recipients) {
      const result = await sendEmail({
        userId: user._id.toString(),
        kind: 'ADMIN_SIGNUP',
        toEmail,
        subject,
        html,
        text,
        // Per {signup, recipient} — a second verification attempt reuses the row
        // instead of sending again (lib/email/send.ts §3).
        idempotencyKey: `admin-signup:${user._id.toString()}:${toEmail}`,
      });
      if (result.ok) sent++;
    }

    return { attempted: true, recipients: recipients.length, sent };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[lib/email/admin-alerts] notifyAdminOfSignup error:', message);
    return { attempted: true, recipients: 0, sent: 0, reason: message };
  }
}
