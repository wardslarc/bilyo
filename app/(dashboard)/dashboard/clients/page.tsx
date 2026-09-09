import React from 'react';
import Link from 'next/link';
import { getCustomers } from '@/actions/customers';
import { ClientList } from '@/components/dashboard/ClientList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Clients · Bilyo',
  description: 'Manage your client directory, contact information, and billing details.',
};

export default async function ClientsPage() {
  const res = await getCustomers({ includeArchived: false });
  const initialCustomers = res.ok ? res.data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Clients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Maintain your client directory for quick quotation generation.
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="hidden sm:inline-flex px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity items-center gap-2"
        >
          <span>+ Add Client</span>
        </Link>
      </div>

      <ClientList initialCustomers={initialCustomers} />
    </div>
  );
}
