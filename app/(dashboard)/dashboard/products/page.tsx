import React from 'react';
import Link from 'next/link';
import { getProducts } from '@/actions/products';
import { ProductList } from '@/components/dashboard/ProductList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Products & Services · Bilyo',
  description: 'Manage standard line items, deliverables, and rates.',
};

export default async function ProductsPage() {
  const res = await getProducts({ includeArchived: false });
  const initialProducts = res.ok ? res.data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Products & Services
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Saved items and standard hourly/project rates for rapid quotation drafting.
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="hidden sm:inline-flex px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white font-medium text-sm rounded-lg transition-opacity items-center gap-2"
        >
          <span>+ Add Item</span>
        </Link>
      </div>

      <ProductList initialProducts={initialProducts} />
    </div>
  );
}
