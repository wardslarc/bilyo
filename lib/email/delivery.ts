import { formatMoney } from '../money.ts';
import { formatDate } from '../dates.ts';
import { sendEmail } from './send.ts';
import { renderQuotationSentEmail } from './templates/quotation-sent.ts';
import type { IQuotation } from '@/types';

export interface EmailDeliveryState {
  attempted: boolean;
  ok: boolean;
  reason?: string;
}

/**
 * Delivers quotation sent email (E1) to client (EMAIL_DELIVERY_PLAN.md §4).
 * Always returns EmailDeliveryState, never throws unhandled errors.
 */
export async function deliverQuotationEmail(
  quotation: IQuotation | (Record<string, unknown> & { _id: unknown; userId: unknown; number: string; publicCode: string; totalCentavos: number; validUntil?: Date | string | null; publicCodeRevokedAt?: Date | string | null; customerSnapshot?: { email?: string; name?: string }; businessSnapshot?: { businessName?: string; email?: string } }),
  user?: { suspendedAt?: Date | null; publicLinksDisabledAt?: Date | null }
): Promise<EmailDeliveryState> {
  try {
    const toEmail = quotation.customerSnapshot?.email?.trim();
    if (!toEmail) {
      return { attempted: false, ok: false, reason: 'NO_ADDRESS' };
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const publicUrl = `${appUrl}/q/${quotation.publicCode}`;
    const businessName = quotation.businessSnapshot?.businessName || 'Business';
    const clientName = quotation.customerSnapshot?.name || 'Client';
    const totalFormatted = formatMoney(quotation.totalCentavos || 0);
    const validUntilFormatted = quotation.validUntil ? formatDate(quotation.validUntil) : undefined;

    const { subject, html, text } = renderQuotationSentEmail({
      quotationNumber: quotation.number,
      businessName,
      clientName,
      totalFormatted,
      validUntilFormatted,
      publicUrl,
    });

    const sendResult = await sendEmail({
      userId: String(quotation.userId),
      quotationId: String(quotation._id),
      kind: 'QUOTATION_SENT',
      toEmail,
      replyTo: quotation.businessSnapshot?.email?.trim() || undefined,
      subject,
      html,
      text,
      idempotencyKey: `quotation-sent:${String(quotation._id)}`,
      owner: user,
      quotation: {
        publicCodeRevokedAt: quotation.publicCodeRevokedAt ? new Date(quotation.publicCodeRevokedAt) : null,
      },
    });

    return {
      attempted: true,
      ok: sendResult.ok,
      reason: sendResult.ok
        ? undefined
        : ('reason' in sendResult ? sendResult.reason : sendResult.error),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[lib/email/delivery] deliverQuotationEmail error:', message);
    return { attempted: true, ok: false, reason: message };
  }
}
