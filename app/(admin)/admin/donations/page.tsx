import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { getAdminDonationSetting } from '@/lib/admin/donation';
import { DonationQrManager } from '@/components/admin/DonationQrManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Donation QR · Bilyo Admin',
  description:
    'Manage the GCash QR image shown on the public support page, and switch the donation ask on or off.',
};

export default async function AdminDonationsPage() {
  await requireAdmin();
  const setting = await getAdminDonationSetting();

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          <span>Internal Dashboard</span>
          <span>•</span>
          <span>Platform Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Donation QR
          </h1>
          <span className="rounded border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
            Staff Only
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Platform setting, not user data. Every change here is written to the
          audit log.
        </p>
      </div>

      <DonationQrManager
        qrUrl={setting.qrUrl}
        qrUploadedAt={setting.qrUploadedAt?.toISOString() ?? null}
        enabledAt={setting.enabledAt?.toISOString() ?? null}
      />

      <div className="border-t border-slate-200 pt-6">
        <Link
          href="/admin"
          className="text-xs text-slate-500 transition-colors hover:text-indigo-600"
        >
          &larr; Back to Platform Overview
        </Link>
      </div>
    </div>
  );
}
