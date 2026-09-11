'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { recordTrialWallSurvey } from '@/actions/notify-interest';
import type { TrialWallAnswer } from '@/types';

export interface TrialWallProps {
  quotationsSent: number;
  quotationsAccepted: number;
  acceptedValueCentavos: number;
  onDismiss?: () => void;
}

export function TrialWall({
  quotationsSent,
  quotationsAccepted,
  acceptedValueCentavos,
  onDismiss,
}: TrialWallProps) {
  const [answer, setAnswer] = useState<TrialWallAnswer | ''>('');
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer) {
      setError('Please select one of the options below');
      return;
    }

    setSubmitting(true);
    setError(null);

    let priceCentavos: number | null = null;
    if (answer === 'WOULD_PAY_LOWER' && suggestedPrice) {
      const num = Number.parseFloat(suggestedPrice.replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num) && num > 0) {
        priceCentavos = Math.round(num * 100);
      }
    }

    const res = await recordTrialWallSurvey({
      answer,
      suggestedPriceCentavos: priceCentavos,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-xl w-full p-6 sm:p-8 my-8 relative">
        {/* Header */}
        <div className="text-center pb-5 border-b border-neutral-100">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-bold text-xl flex items-center justify-center mx-auto mb-3">
            ⏳
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Your 14 days are up.
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed max-w-md mx-auto">
            You sent <strong className="text-neutral-900">{quotationsSent} {quotationsSent === 1 ? 'quotation' : 'quotations'}</strong> and{' '}
            <strong className="text-neutral-900">{quotationsAccepted} {quotationsAccepted === 1 ? 'was' : 'were'} accepted</strong> —{' '}
            <strong className="text-emerald-700">{formatMoney(acceptedValueCentavos, 'PHP')}</strong> in confirmed work.
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Bilyo Access keeps you sending. Pick a pass below.
          </p>
        </div>

        {/* The 3 Passes */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="border border-neutral-200 rounded-xl p-3.5 text-center flex flex-col justify-between hover:border-neutral-400 transition-colors">
            <div>
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                30 Days
              </span>
              <span className="text-xl font-extrabold text-neutral-900 mt-1 block font-mono">
                ₱200
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">₱6.67/day</span>
            </div>
            <Link
              href="/dashboard/access"
              className="mt-3 py-1 px-2 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-md transition-colors"
            >
              Choose →
            </Link>
          </div>

          <div className="border-2 border-neutral-900 bg-neutral-900 text-white rounded-xl p-3.5 text-center flex flex-col justify-between relative shadow-md">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-neutral-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Popular
            </span>
            <div>
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                90 Days
              </span>
              <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                ₱500
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">₱5.56/day</span>
            </div>
            <Link
              href="/dashboard/access"
              className="mt-3 py-1 px-2 text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-md transition-colors"
            >
              Choose →
            </Link>
          </div>

          <div className="border border-neutral-200 rounded-xl p-3.5 text-center flex flex-col justify-between hover:border-neutral-400 transition-colors">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                1 Year (Save 30%)
              </span>
              <span className="text-xl font-extrabold text-neutral-900 mt-1 block font-mono">
                ₱1,700
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">₱4.66/day</span>
            </div>
            <Link
              href="/dashboard/access"
              className="mt-3 py-1 px-2 text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-md transition-colors"
            >
              Choose →
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <span className="relative bg-white px-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            or tell us honestly
          </span>
        </div>

        {/* Willingness-to-pay survey (§3.4, Gate 3 instrument) */}
        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-emerald-800">
              ✓ Thank you for your honest feedback!
            </p>
            <p className="text-[11px] text-emerald-700 mt-1">
              Your past quotations, client records, and exports stay open forever.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitSurvey} className="space-y-3.5 bg-neutral-50 rounded-xl p-4 sm:p-5 border border-neutral-200">
            <div className="text-left">
              <span className="text-xs font-bold text-neutral-900 block">
                Not ready to pay?
              </span>
              <span className="text-[11px] text-neutral-500 block mt-0.5">
                Tell us honestly, it helps us improve more than silence:
              </span>
            </div>

            {error && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2.5 text-xs text-neutral-800">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="trial_survey_answer"
                  value="WOULD_PAY_LOWER"
                  checked={answer === 'WOULD_PAY_LOWER'}
                  onChange={() => setAnswer('WOULD_PAY_LOWER')}
                  className="mt-0.5 accent-neutral-900"
                />
                <div className="flex-1">
                  <span>I&apos;d pay, but not at this price</span>
                  {answer === 'WOULD_PAY_LOWER' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-neutral-500">What would you pay? ₱</span>
                      <input
                        type="text"
                        placeholder="e.g. 100"
                        value={suggestedPrice}
                        onChange={(e) => setSuggestedPrice(e.target.value)}
                        className="w-24 px-2 py-1 border border-neutral-300 rounded bg-white text-xs focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="trial_survey_answer"
                  value="NOT_NOW"
                  checked={answer === 'NOT_NOW'}
                  onChange={() => setAnswer('NOT_NOW')}
                  className="mt-0.5 accent-neutral-900"
                />
                <span>I&apos;d pay, just not right now</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="trial_survey_answer"
                  value="WOULD_NOT_PAY"
                  checked={answer === 'WOULD_NOT_PAY'}
                  onChange={() => setAnswer('WOULD_NOT_PAY')}
                  className="mt-0.5 accent-neutral-900"
                />
                <div className="flex-1">
                  <span>I wouldn&apos;t pay for this</span>
                  {answer === 'WOULD_NOT_PAY' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="What's missing? (e.g. templates, reminders, etc.)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded bg-white text-xs focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !answer}
                className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}

        {/* Dismiss / View-Only Access Notice */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <span>
            Reading quotes, client lists, and data exports remain open forever.
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-neutral-700 hover:text-neutral-900 font-semibold underline transition-colors cursor-pointer shrink-0"
            >
              Continue to view-only dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrialWall;
