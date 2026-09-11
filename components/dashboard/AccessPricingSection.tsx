'use client';

import React, { useState } from 'react';
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
      'Private mobile links & PDF downloads',
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

export function AccessPricingSection({ userEmail }: { userEmail: string }) {
  const [loadingPass, setLoadingPass] = useState<InterestPassType | null>(null);
  const [notifiedPasses, setNotifiedPasses] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNotify = async (passId: InterestPassType) => {
    setLoadingPass(passId);
    setErrorMessage(null);

    const res = await recordPricingInterest({
      email: userEmail,
      passType: passId,
    });

    setLoadingPass(null);

    if (res.ok) {
      setNotifiedPasses((prev) => ({ ...prev, [passId]: true }));
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight sm:text-2xl">
          Quotation Access Passes
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto leading-relaxed">
          Prepaid passes with zero auto-renewals. Passes launch soon — notify us below to lock in early access and your 50% beta discount.
        </p>
      </div>

      {errorMessage && (
        <div className="max-w-md mx-auto p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg text-center">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        {PASSES.map((pass) => {
          const isNotified = notifiedPasses[pass.id];
          const isLoading = loadingPass === pass.id;

          return (
            <div
              key={pass.id}
              className={`flex flex-col rounded-2xl p-6 transition-all relative ${
                pass.featured
                  ? 'bg-neutral-900 text-white shadow-xl ring-2 ring-neutral-900'
                  : 'bg-white border border-neutral-200 text-neutral-900 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-bold">{pass.name}</h3>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      pass.featured ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {pass.blurb}
                  </p>
                </div>
                {pass.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 ${
                      pass.featured
                        ? 'bg-amber-400 text-neutral-950'
                        : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                    }`}
                  >
                    {pass.badge}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold tracking-tight font-mono">
                  {pass.price}
                </span>
                <span
                  className={`text-xs ${
                    pass.featured ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  / {pass.period}
                </span>
              </div>

              <ul className="space-y-2.5 my-5 text-xs flex-1">
                {pass.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
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

              <div className="pt-4 mt-auto border-t border-neutral-100 dark:border-neutral-800">
                {isNotified ? (
                  <div className="text-center py-2.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-xl">
                    ✓ Notified! We&apos;ll email you at launch.
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleNotify(pass.id)}
                    className={`w-full py-2.5 px-3 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                      pass.featured
                        ? 'bg-amber-400 text-neutral-950 hover:bg-amber-300'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isLoading ? 'Registering interest…' : 'Notify me when pass opens →'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccessPricingSection;
