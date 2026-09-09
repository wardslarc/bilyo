import { renderEmailLayout } from './layout.ts';

export interface QuotationRespondedTemplateData {
  quotationNumber: string;
  clientName: string;
  respondedByName: string;
  decision: 'ACCEPTED' | 'DECLINED';
  totalFormatted: string;
  detailUrl: string;
}

/**
 * E2: Quotation Responded Notification Template for Owner (EMAIL_DELIVERY_PLAN.md §2, §9)
 * Pure function: (input) => { subject, html, text }
 */
export function renderQuotationRespondedEmail(data: QuotationRespondedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    quotationNumber,
    clientName,
    respondedByName,
    decision,
    totalFormatted,
    detailUrl,
  } = data;

  const isAccepted = decision === 'ACCEPTED';
  const subject = isAccepted
    ? `Quotation ${quotationNumber} accepted by ${clientName} — ${totalFormatted}`
    : `Quotation ${quotationNumber} was declined by ${clientName}`;

  const preheader = isAccepted
    ? `Good news! ${respondedByName || clientName} accepted quotation ${quotationNumber}.`
    : `Client response received for quotation ${quotationNumber}.`;

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    ${isAccepted ? 'Quotation Accepted' : 'Quotation Declined'}
  </p>
  <p style="margin:0 0 24px 0;">
    Your client <strong>${escapeHtml(clientName)}</strong> (signed by <em>${escapeHtml(respondedByName || clientName)}</em>) has <strong>${isAccepted ? 'ACCEPTED' : 'DECLINED'}</strong> quotation <strong>${escapeHtml(quotationNumber)}</strong>.
  </p>

  <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size:13px;color:#64748b;padding-bottom:6px;">Quotation Reference</td>
        <td align="right" style="font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">${escapeHtml(quotationNumber)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;padding-bottom:6px;">Decision</td>
        <td align="right" style="font-size:14px;font-weight:700;color:${isAccepted ? '#059669' : '#e11d48'};padding-bottom:6px;">${isAccepted ? 'ACCEPTED' : 'DECLINED'}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;">Total Value</td>
        <td align="right" style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(totalFormatted)}</td>
      </tr>
    </table>
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(detailUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;">
          View Quotation in Dashboard &rarr;
        </a>
      </td>
    </tr>
  </table>
  `;

  const bodyText = `Quotation ${quotationNumber} was ${isAccepted ? 'ACCEPTED' : 'DECLINED'} by ${clientName} (signed by ${respondedByName || clientName}).

Quotation Reference: ${quotationNumber}
Decision: ${isAccepted ? 'ACCEPTED' : 'DECLINED'}
Total Value: ${totalFormatted}

View in dashboard:
${detailUrl}`;

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
