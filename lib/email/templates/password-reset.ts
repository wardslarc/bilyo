import { renderEmailLayout } from './layout.ts';

export interface PasswordResetTemplateData {
  userName?: string | null;
  resetUrl: string;
}

/**
 * E3: Password Reset Email Template (EMAIL_DELIVERY_PLAN.md §2, P6-T08)
 * Pure function: (input) => { subject, html, text }
 */
export function renderPasswordResetEmail(data: PasswordResetTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, resetUrl } = data;

  const subject = 'Reset your Bilyo password';
  const preheader = 'Instructions to reset your Bilyo account password.';

  const greeting = userName ? `Hello ${escapeHtml(userName)},` : 'Hello,';

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    ${greeting}
  </p>
  <p style="margin:0 0 20px 0;">
    We received a request to reset the password for your Bilyo account. Click the button below to choose a new password:
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;">
          Reset Password &rarr;
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;line-height:20px;">
    This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your account remains secure.
  </p>
  <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">
    If the button does not work, copy and paste this URL into your browser:<br>
    <a href="${escapeHtml(resetUrl)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(resetUrl)}</a>
  </p>
  `;

  const bodyText = `${userName ? `Hello ${userName},` : 'Hello,'}

We received a request to reset the password for your Bilyo account.

To choose a new password, visit the following link:
${resetUrl}

This link is valid for 1 hour. If you did not request this, you can safely ignore this message.`;

  const { html, text } = renderEmailLayout({
    title: subject,
    preheader,
    bodyHtml,
    bodyText,
  });

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
