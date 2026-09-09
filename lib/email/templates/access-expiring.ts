import { renderEmailLayout } from './layout.ts';

export interface AccessExpiringTemplateData {
  daysLeft: number;
  accessUntilFormatted: string;
  topUpUrl: string;
  userName?: string | null;
}

/**
 * E4: Access Expiry Reminder Template (EMAIL_DELIVERY_PLAN.md §2, P6-T09)
 * Pure function: (input) => { subject, html, text }
 */
export function renderAccessExpiringEmail(data: AccessExpiringTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const { daysLeft, accessUntilFormatted, topUpUrl, userName } = data;

  const dayWord = daysLeft === 1 ? 'day' : 'days';
  const subject = `Your Bilyo access expires in ${daysLeft} ${dayWord}`;
  const preheader = `Your Bilyo access expires on ${accessUntilFormatted}. Top up to keep sending quotations.`;

  const greeting = userName ? `Hello ${escapeHtml(userName)},` : 'Hello,';

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    ${greeting}
  </p>
  <p style="margin:0 0 20px 0;">
    Your Bilyo quotation access will expire in <strong>${daysLeft} ${dayWord}</strong> on <strong>${escapeHtml(accessUntilFormatted)}</strong>.
  </p>

  <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
    <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0f172a;">What happens when access expires?</p>
    <ul style="margin:0;padding-left:20px;font-size:13px;color:#475569;line-height:22px;">
      <li>You will <strong>never</strong> lose your quotations, clients, or account history.</li>
      <li>Existing sent links and PDF downloads remain accessible forever.</li>
      <li>Creating and sending <em>new</em> quotations will be paused until you top up.</li>
    </ul>
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(topUpUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;">
          Renew Access in Dashboard &rarr;
        </a>
      </td>
    </tr>
  </table>
  `;

  const bodyText = `${userName ? `Hello ${userName},` : 'Hello,'}

Your Bilyo quotation access will expire in ${daysLeft} ${dayWord} on ${accessUntilFormatted}.

What happens when access expires:
- Your past quotations, client records, and PDFs remain accessible forever.
- Creating and sending new quotations will require an access top-up.

Renew your access in the dashboard:
${topUpUrl}`;

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
