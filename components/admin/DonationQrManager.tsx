'use client';

import { useRef, useState, useTransition } from 'react';
import {
  saveDonationQr,
  clearDonationQr,
  setDonationAsk,
} from '@/actions/admin/donation';
import { formatDateTime } from '@/lib/dates';

interface DonationQrManagerProps {
  qrUrl: string | null;
  qrUploadedAt: string | null;
  enabledAt: string | null;
}

/**
 * Admin control for the donation QR (AGENTS.md §4.9).
 *
 * Upload and go-live are separate controls on purpose: the QR can be uploaded
 * and inspected here while the public pages still show nothing.
 *
 * Removal is a two-step inline confirm rather than window.confirm — a native
 * dialog blocks the page and cannot be dismissed programmatically.
 */
export function DonationQrManager({
  qrUrl,
  qrUploadedAt,
  enabledAt,
}: DonationQrManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLive = Boolean(enabledAt);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await saveDonationQr(formData);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        isLive
          ? 'QR replaced. The public pages now show the new image.'
          : 'QR saved. It is not public yet — switch the ask on below.'
      );
    });
  };

  const handleRemove = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await clearDonationQr();
      setConfirmingRemove(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice('QR removed and the ask switched off.');
    });
  };

  const handleToggle = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setDonationAsk({ enabled: !isLive });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.data.enabled
          ? 'The donation ask is live on /support and in the site footer.'
          : 'The donation ask is switched off. The QR image is kept.'
      );
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current image */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Current QR
          </h2>

          {qrUrl ? (
            <div className="mt-4 space-y-3">
              {/* Plain <img>: this project configures no next/image remote
                  patterns, and the CSP already allows the Blob host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="GCash donation QR code"
                className="h-56 w-56 rounded-lg border border-slate-200 bg-white object-contain p-2"
              />
              <p className="text-xs text-slate-500">
                Uploaded {qrUploadedAt ? formatDateTime(qrUploadedAt) : 'unknown'}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No QR uploaded. The public donation ask cannot be switched on
              until there is one.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800">
              {qrUrl ? 'Replace image' : 'Upload image'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUpload}
                disabled={isPending}
                className="hidden"
              />
            </label>

            {qrUrl && !confirmingRemove && (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                disabled={isPending}
                className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-60"
              >
                Remove
              </button>
            )}

            {confirmingRemove && (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Remove the QR?</span>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={isPending}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            PNG, JPEG or WebP, up to 2MB. Use a QR with no amount attached so
            senders choose their own.
          </p>
        </div>

        {/* Live switch */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Public ask
          </h2>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                isLive
                  ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                  : 'border border-slate-200 bg-slate-100 text-slate-600'
              }`}
            >
              {isLive ? 'Live' : 'Off'}
            </span>
            {enabledAt && (
              <span className="text-xs text-slate-500">
                since {formatDateTime(enabledAt)}
              </span>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            When this is live, the site footer shows a one-line link and{' '}
            <span className="font-mono text-xs">/support</span> renders the QR.
            When it is off, the footer link disappears and{' '}
            <span className="font-mono text-xs">/support</span> returns 404. The
            image is kept either way.
          </p>

          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending || (!qrUrl && !isLive)}
            className="mt-5 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? 'Saving…'
              : isLive
                ? 'Switch the ask off'
                : 'Switch the ask on'}
          </button>

          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-400">
            Take the ask down before paid access goes live — a donation ask and
            a price list running together is what makes the &ldquo;gift, not
            payment&rdquo; position arguable.
          </p>
        </div>
      </div>
    </div>
  );
}
