import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomer } from '@/actions/customers';
import { CustomerForm } from '@/components/dashboard/CustomerForm';

export const metadata = {
  title: 'Edit Customer · Bilyo',
  description: 'Update customer contact or tax information.',
};

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const res = await getCustomer(id);

  if (!res.ok || !res.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/customers" className="hover:underline">
          Customers
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">{res.data.name}</span>
        <span>/</span>
        <span>Edit</span>
      </div>

      <CustomerForm initialCustomer={res.data} />
    </div>
  );
}
