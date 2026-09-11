'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { recordPricingInterest } from '@/actions/notify-interest';
import type { InterestPassType } from '@/types';

type Pass = {
  id: InterestPassType;
  name: string;
  blurb: string;
  price: string;
  period: string;
  badge?: string;
  features: string[];
  featured?: boolean;
};

const PASSES: Pass[] = [
  {
    id: 'D30',
    name: '30-Day Access',
    blurb: 'For occasional quotes and project-based work.',
    price: '₱200',
    period: '30 days',
    features: [
      'Unlimited quotations',
      'Client one-tap accept or decline',
      'Private mobile links and PDF downloads',
      'Real-time view & decision tracking',
    ],
  },
  {
    id: 'D90',
    name: '90-Day Access',
    blurb: 'For active freelancers and steady consulting.',
    price: '₱500',
    period: '90 days',
    badge: 'POPULAR',
    features: [
      'Everything in 30-Day Access',
      'Save regular clients and service rates',
      'Full quotation history and pipeline',
      'Stackable renewals without lost days',
    ],
    featured: true,
  },
  {
    id: 'Y1',
    name: '1-Year Access',
    blurb: 'For established service businesses. Best value.',
    price: '₱1,700',
    period: '365 days',
    badge: 'SAVE 30%',
    features: [
      'Everything in 90-Day Access',
      'Lowest cost per day (₱4.66/day)',
      '12 months for the price of 8.5',
      'Export client and quotation data anytime',
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-4 shrink-0 text-amber-600"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PricingSection({ userEmail }: { userEmail?: string | null }) {
  const [emailInput, setEmailInput] = useState('');
  const [loadingPass, setLoadingPass] = useState<InterestPassType | null>(null);
  const [notifiedPasses, setNotifiedPasses] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmailModalForPass, setShowEmailModalForPass] = useState<InterestPassType | null>(null);

  const handleNotifyClick = async (passId: InterestPassType) => {
    setErrorMessage(null);

    // If user is authenticated, register directly with session
    if (userEmail) {
      setLoadingPass(passId);
      const res = await recordPricingInterest({ passType: passId });
      setLoadingPass(null);
      if (res.ok) {
        setNotifiedPasses((prev) => ({ ...prev, [passId]: true }));
      } else {
        setErrorMessage(res.error);
      }
      return;
    }

    // Otherwise show email prompt
    setShowEmailModalForPass(passId);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEmailModalForPass || !emailInput) return;

    setLoadingPass(showEmailModalForPass);
    setErrorMessage(null);

    const res = await recordPricingInterest({
      email: emailInput,
      passType: showEmailModalForPass,
    });

    setLoadingPass(null);

    if (res.ok) {
      setNotifiedPasses((prev) => ({ ...prev, [showEmailModalForPass]: true }));
      setShowEmailModalForPass(null);
      setEmailInput('');
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
      {/* Beta Announcement Banner per §6.10 */}
      <div className="mb-10 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 text-center sm:p-6 shadow-sm">
        <p className="text-sm font-semibold text-amber-950 sm:text-base">
          ✨ Bilyo is free during beta. Paid access starts soon. Beta users get 50% off their first pass.
        </p>
      </div>

      <div className="flex flex-col gap-3 text-center sm:gap-4 pb-10">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Quotation Access Plan
        </h2>
        <p className="text-neutral-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Prepaid access, no auto-renewals, no credit cards. Quotes are never metered.
        </p>
      </div>

      {errorMessage && (
        <div className="max-w-md mx-auto mb-6 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg text-center">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8 items-stretch">
        {PASSES.map((pass) => {
          const isNotified = notifiedPasses[pass.id];
          const isLoading = loadingPass === pass.id;

          return (
            <div
              key={pass.id}
              className={`flex flex-col rounded-2xl p-6 sm:p-8 transition-all relative ${
                pass.featured
                  ? 'bg-neutral-900 text-white shadow-xl ring-2 ring-neutral-900'
                  : 'bg-white border border-neutral-200 text-neutral-900 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold sm:text-xl">{pass.name}</h3>
                  <p
                    className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                      pass.featured ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {pass.blurb}
                  </p>
                </div>
                {pass.badge && (
                  <span
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider shrink-0 ${
                      pass.featured
                        ? 'bg-amber-400 text-neutral-950'
                        : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                    }`}
                  >
                    {pass.badge}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 my-4">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {pass.price}
                </span>
                <span
                  className={`text-sm ${
                    pass.featured ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  / {pass.period}
                </span>
              </div>

              <ul className="space-y-3 my-6 text-xs sm:text-sm flex-1">
                {pass.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span
                      className={`leading-relaxed ${
                        pass.featured ? 'text-neutral-300' : 'text-neutral-600'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 mt-auto border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2.5">
                <Link
                  href="/register"
                  className={`w-full h-11 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    pass.featured
                      ? 'bg-amber-400 text-neutral-950 hover:bg-amber-300'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  Start free in beta
                </Link>

                {isNotified ? (
                  <div className="text-center py-2 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg">
                    ✓ We will notify you when passes launch!
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleNotifyClick(pass.id)}
                    className={`w-full py-2 text-xs font-medium text-center rounded-lg transition-colors cursor-pointer ${
                      pass.featured
                        ? 'text-neutral-400 hover:text-white hover:bg-white/5'
                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    {isLoading ? 'Registering…' : 'Notify me when passes launch →'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unauthenticated Email Dialog Modal */}
      {showEmailModalForPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900">
              Get notified when passes open
            </h3>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Enter your email to receive an early notification when Quotation Access passes become available.
            </p>

            <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="notify-email" className="block text-xs font-semibold text-neutral-700 mb-1">
                  Email address
                </label>
                <input
                  id="notify-email"
                  type="email"
                  required
                  placeholder="name@business.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModalForPass(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingPass !== null}
                  className="px-5 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {loadingPass !== null ? 'Saving…' : 'Notify Me'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default PricingSection;
