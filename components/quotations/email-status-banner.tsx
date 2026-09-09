import Link from 'next/link';

interface EmailStatusBannerProps {
  status?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
}

/**
 * Banner displayed on quotation detail page if email delivery bounced or failed (EMAIL_DELIVERY_PLAN.md §5.5).
 */
export function EmailStatusBanner({ status, clientEmail, clientId }: EmailStatusBannerProps) {
  if (status !== 'BOUNCED' && status !== 'FAILED') {
    return null;
  }

  const isBounced = status === 'BOUNCED';

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none select-none">⚠️</span>
        <div className="flex-1 text-sm space-y-1">
          <p className="font-semibold text-amber-900">
            {isBounced
              ? `We couldn't deliver this quotation to ${clientEmail || 'your client'}.`
              : `Email delivery to ${clientEmail || 'your client'} failed.`}
          </p>
          <p className="text-amber-800 leading-relaxed">
            {isBounced
              ? 'The address bounced or was rejected by the receiving mail server. Copy the quote link above to send it via Messenger or chat — the quotation itself is active and valid.'
              : 'The mail server reported a delivery failure. You can still copy and send the link directly to your client.'}
          </p>
          {clientId && (
            <div className="pt-1">
              <Link
                href={`/dashboard/clients/${clientId}/edit`}
                className="inline-flex items-center text-xs font-semibold text-amber-900 underline hover:text-amber-700"
              >
                Update client&apos;s email address &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
