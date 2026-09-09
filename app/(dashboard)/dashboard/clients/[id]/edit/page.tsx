import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomer } from '@/actions/customers';
import { ClientForm } from '@/components/dashboard/ClientForm';

export const metadata = {
  title: 'Edit Client · Bilyo',
  description: 'Update client contact information.',
};

interface EditClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params;
  const res = await getCustomer(id);

  if (!res.ok || !res.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/clients" className="hover:underline">
          Clients
        </Link>
        <span>/</span>
        <Link href={`/dashboard/clients/${res.data.id}`} className="hover:underline">
          {res.data.name}
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">Edit</span>
      </div>

      <ClientForm initialCustomer={res.data} />
    </div>
  );
}
