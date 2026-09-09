import React from 'react';
import Link from 'next/link';
import { ClientForm } from '@/components/dashboard/ClientForm';

export const metadata = {
  title: 'Add Client · Bilyo',
  description: 'Add a new client to your Bilyo directory.',
};

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/clients" className="hover:underline">
          Clients
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">New Client</span>
      </div>

      <ClientForm />
    </div>
  );
}
