import React from 'react';
import Link from 'next/link';
import { CustomerForm } from '@/components/dashboard/CustomerForm';

export const metadata = {
  title: 'Add Customer · Bilyo',
  description: 'Add a new customer to your Bilyo directory.',
};

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/customers" className="hover:underline">
          Customers
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">New Customer</span>
      </div>

      <CustomerForm />
    </div>
  );
}
