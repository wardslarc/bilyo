import { renderEmailLayout } from './layout.ts';

export interface QuotationSentTemplateData {
  quotationNumber: string;
  businessName: string;
  clientName: string;
  totalFormatted: string;
  validUntilFormatted?: string;
  publicUrl: string;
}

/**
 * E1: Quotation Sent Template (EMAIL_DELIVERY_PLAN.md §4.3)
 * Pure function: (input) => { subject, html, text }
 */
export function renderQuotationSentEmail(data: QuotationSentTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    quotationNumber,
    businessName,
    clientName,
    totalFormatted,
    validUntilFormatted,
    publicUrl,
  } = data;

  const subject = `Quotation ${quotationNumber} from ${businessName} — ${totalFormatted}`;
  const preheader = `View quotation ${quotationNumber} from ${businessName}: ${totalFormatted}`;

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    Dear ${escapeHtml(clientName)},
  </p>
  <p style="margin:0 0 24px 0;">
    <strong>${escapeHtml(businessName)}</strong> has prepared a quotation for your review.
  </p>

  <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size:13px;color:#64748b;padding-bottom:6px;">Quotation Reference</td>
        <td align="right" style="font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">${escapeHtml(quotationNumber)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;padding-bottom:6px;">Total Amount</td>
        <td align="right" style="font-size:18px;font-weight:700;color:#0f172a;padding-bottom:6px;">${escapeHtml(totalFormatted)}</td>
      </tr>
      ${
        validUntilFormatted
          ? `<tr>
        <td style="font-size:13px;color:#64748b;">Valid Until</td>
        <td align="right" style="font-size:13px;font-weight:500;color:#0f172a;">${escapeHtml(validUntilFormatted)}</td>
      </tr>`
          : ''
      }
    </table>
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(publicUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;">
          View &amp; Respond to Quotation &rarr;
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">
    You can review the full details and accept or decline with a single tap.
  </p>
  `;

  const bodyText = `Dear ${clientName},

${businessName} has prepared quotation ${quotationNumber} for your review.

Quotation Reference: ${quotationNumber}
Total Amount: ${totalFormatted}${validUntilFormatted ? `\nValid Until: ${validUntilFormatted}` : ''}

You can view, accept, or decline this quotation online:
${publicUrl}

Tap the link above to review the full details.`;

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
