import Link from 'next/link';
import { requireUser, assertNotSuspended } from '@/lib/auth-guards';
import { accessState } from '@/lib/access';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { getUserUsageSnapshot } from '@/actions/notify-interest';
import { AccessPricingSection } from '@/components/dashboard/AccessPricingSection';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quotation Access & Plans · Bilyo',
  description: 'Manage your Bilyo quotation access passes and review usage.',
};

export default async function DashboardAccessPage() {
  const user = await requireUser();
  const userDoc = await assertNotSuspended(user.id);

  const access = accessState(userDoc);
  const betaEndsAt = process.env.BETA_ENDS_AT || null;
  const usageSnapshot = await getUserUsageSnapshot(user.id);

  const formattedAccessUntil = access.accessUntil ? formatDate(access.accessUntil) : null;
  const formattedBetaEnds = betaEndsAt ? formatDate(betaEndsAt) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb / Top Return */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Quotation Access &amp; Plans
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Prepaid access for Philippine service businesses. Quotes are never metered.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Current Status Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg">
              {access.status === 'ACTIVE'
                ? '✓'
                : access.status === 'TRIAL'
                ? '⏳'
                : access.status === 'BETA'
                ? '✨'
                : '⚠'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Current Status
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                    access.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : access.status === 'TRIAL'
                      ? 'bg-amber-100 text-amber-800'
                      : access.status === 'BETA'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {access.status === 'BETA'
                    ? 'Beta Access'
                    : access.status === 'TRIAL'
                    ? '14-Day Trial'
                    : access.status === 'ACTIVE'
                    ? 'Active Pass'
                    : 'Access Expired'}
                </span>
              </div>
              <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                {access.status === 'BETA' && (
                  <>
                    Unlimited quotations during beta
                    {formattedBetaEnds ? ` until ${formattedBetaEnds}` : ''}.
                  </>
                )}
                {access.status === 'TRIAL' && (
                  <>
                    {access.daysLeft} {access.daysLeft === 1 ? 'day' : 'days'} remaining in your trial.
                  </>
                )}
                {access.status === 'ACTIVE' && (
                  <>Active access until {formattedAccessUntil}.</>
                )}
                {access.status === 'EXPIRED_TRIAL' && (
                  <>Your 14-day trial has ended. Creating and sending quotations is paused.</>
                )}
                {access.status === 'EXPIRED_PAID' && (
                  <>Your access expired on {formattedAccessUntil}.</>
                )}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-neutral-500">
            <span className="block font-medium text-neutral-700">Account: {user.email}</span>
            <span className="block text-[11px] text-neutral-400 mt-0.5">
              Beta users receive 50% off their first pass
            </span>
          </div>
        </div>

        {/* Live Usage Snapshot */}
        <div className="grid grid-cols-3 gap-4 pt-5 text-center">
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-xs text-neutral-500 block">Quotations Sent</span>
            <span className="text-xl font-bold text-neutral-900 font-mono mt-0.5 block">
              {usageSnapshot.quotationsSent}
            </span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-xs text-neutral-500 block">Accepted by Clients</span>
            <span className="text-xl font-bold text-neutral-900 font-mono mt-0.5 block">
              {usageSnapshot.quotationsAccepted}
            </span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-xs text-neutral-500 block">Confirmed Work</span>
            <span className="text-xl font-bold text-emerald-700 font-mono mt-0.5 block">
              {formatMoney(usageSnapshot.acceptedValueCentavos, 'PHP')}
            </span>
          </div>
        </div>
      </div>

      {/* Quotation Access Passes Section */}
      <AccessPricingSection userEmail={user.email} />

      {/* Guarantee & Transparency */}
      <div className="border-t border-neutral-200 pt-6 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>
          Need support? Reach us at{' '}
          <a
            href="mailto:support@bilyoapp.com"
            className="text-neutral-900 font-semibold underline underline-offset-2"
          >
            support@bilyoapp.com
          </a>
        </p>
        <p className="text-[11px] text-neutral-400">
          Reading past quotations, client lists, and data exports remain accessible forever.
        </p>
      </div>
    </div>
  );
}
