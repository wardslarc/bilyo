import { renderEmailLayout } from './layout.ts';

export interface AdminSignupAlertTemplateData {
  userName: string;
  userEmail: string;
  registeredAtFormatted: string;
  verifiedAtFormatted: string;
  trialEndsFormatted?: string;
  adminUrl: string;
}

/**
 * E6: New signup alert for the operator (EMAIL_DELIVERY_PLAN.md §2).
 * Internal only — the recipient is an address in ADMIN_EMAILS, never a user.
 * Pure function: (input) => { subject, html, text }
 */
export function renderAdminSignupAlertEmail(data: AdminSignupAlertTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    userName,
    userEmail,
    registeredAtFormatted,
    verifiedAtFormatted,
    trialEndsFormatted,
    adminUrl,
  } = data;

  const subject = `New Bilyo signup — ${userName}`;
  const preheader = `${userName} (${userEmail}) verified their email and is now active.`;

  const row = (label: string, value: string) => `
      <tr>
        <td style="font-size:13px;color:#64748b;padding-bottom:6px;">${escapeHtml(label)}</td>
        <td align="right" style="font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">${escapeHtml(value)}</td>
      </tr>`;

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    New verified signup
  </p>
  <p style="margin:0 0 24px 0;">
    <strong>${escapeHtml(userName)}</strong> completed email verification and now has an active
    Bilyo account. No action is needed — this is a heads-up so you don't have to watch the admin
    console.
  </p>

  <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Name', userName)}
      ${row('Email', userEmail)}
      ${row('Registered', registeredAtFormatted)}
      ${row('Verified', verifiedAtFormatted)}
      ${trialEndsFormatted ? row('Access until', trialEndsFormatted) : ''}
    </table>
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;">
          Open in admin &rarr;
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0;font-size:12px;color:#94a3b8;">
    You are receiving this because your address is in ADMIN_EMAILS.
  </p>
  `;

  const bodyText = `New verified signup on Bilyo.

Name: ${userName}
Email: ${userEmail}
Registered: ${registeredAtFormatted}
Verified: ${verifiedAtFormatted}${trialEndsFormatted ? `\nAccess until: ${trialEndsFormatted}` : ''}

Open in admin:
${adminUrl}

You are receiving this because your address is in ADMIN_EMAILS.`;

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
