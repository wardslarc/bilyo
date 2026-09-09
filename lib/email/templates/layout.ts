import { QUOTATION_FOOTER } from '../../documents.ts';

export interface EmailLayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Shared HTML & Text layout shell (EMAIL_DELIVERY_PLAN.md §3, §4.3)
 * Non-negotiable: Embeds QUOTATION_FOOTER in both HTML and plain-text output.
 */
export function renderEmailLayout(options: EmailLayoutOptions): {
  html: string;
  text: string;
} {
  const { title, preheader, bodyHtml, bodyText } = options;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${preheader ? `<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#0f172a;">Bilyo</span>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px;font-size:15px;line-height:24px;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Mandatory Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;text-align:center;">
              <p style="margin:0 0 8px 0;font-weight:500;">
                ${escapeHtml(QUOTATION_FOOTER)}
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                Sent via Bilyo · Philippine Service Quotation Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${bodyText}

----------------------------------------
${QUOTATION_FOOTER}
Sent via Bilyo · https://bilyoapp.com`;

  return { html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
