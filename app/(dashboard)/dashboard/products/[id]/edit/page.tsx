import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct } from '@/actions/products';
import { ProductForm } from '@/components/dashboard/ProductForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Edit Item · Bilyo',
  description: 'Update product, rate, or service information.',
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const res = await getProduct(id);

  if (!res.ok || !res.data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/dashboard/products" className="hover:underline">
          Products & Services
        </Link>
        <span>/</span>
        <span className="text-neutral-900 font-medium">{res.data.name}</span>
        <span>/</span>
        <span>Edit</span>
      </div>

      <ProductForm initialProduct={res.data} />
    </div>
  );
}
