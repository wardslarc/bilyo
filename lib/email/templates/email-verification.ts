import { renderEmailLayout } from './layout.ts';

export interface EmailVerificationTemplateData {
  userName?: string | null;
  code: string;
  verifyUrl: string;
}

/**
 * Signup Email Verification Template (SIGNUP_VERIFICATION_PLAN.md §4.3, §8 Task 4).
 * Delivers both a 6-digit code and a magic link in one email.
 * Pure function: (input) => { subject, html, text }
 */
export function renderEmailVerificationEmail(data: EmailVerificationTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, code, verifyUrl } = data;

  // Code in subject makes it readable from phone lock screen notification (§4.3)
  const subject = `${code} is your Bilyo verification code`;
  const preheader = `Your 6-digit Bilyo verification code is ${code}.`;

  const greeting = userName ? `Hello ${escapeHtml(userName)},` : 'Hello,';

  const bodyHtml = `
  <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0f172a;">
    ${greeting}
  </p>
  <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:22px;">
    Welcome to Bilyo! Please use this 6-digit verification code to confirm your email address and activate your account:
  </p>

  <!-- 6-digit code prominently styled -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
    <tr>
      <td align="center">
        <div style="display:inline-block;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:16px 32px;text-align:center;">
          <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;display:inline-block;margin-left:8px;">
            ${escapeHtml(code)}
          </span>
        </div>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;text-align:center;line-height:20px;">
    This verification code will expire in <strong>15 minutes</strong>.
  </p>

  <div style="border-top:1px solid #e2e8f0;margin:24px 0;padding-top:24px;">
    <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:22px;">
      Alternatively, if you are on another device, click the button below to verify your email address:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;text-align:center;">
            Verify Email Address &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:18px;">
      This link will expire in <strong>24 hours</strong>. If you did not sign up for Bilyo, you can safely ignore this email.
    </p>
    <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all;">
      If the button does not work, copy and paste this link into your browser:<br>
      <a href="${escapeHtml(verifyUrl)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(verifyUrl)}</a>
    </p>
  </div>
  `;

  const bodyText = `${userName ? `Hello ${userName},` : 'Hello,'}

Welcome to Bilyo! Your 6-digit verification code is:

${code}

This code will expire in 15 minutes.

Alternatively, you can verify your email by visiting this link (valid for 24 hours):
${verifyUrl}

If you did not sign up for Bilyo, you can safely ignore this message.`;

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
