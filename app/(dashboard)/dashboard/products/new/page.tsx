import React from 'react';
import Link from 'next/link';
import { ProductForm } from '@/components/dashboard/ProductForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Add Item · Bilyo',
  description: 'Add a new product or service item to your Bilyo account.',
};

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/products" className="hover:underline">
          Products & Services
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">New Item</span>
      </div>

      <ProductForm />
    </div>
  );
}
