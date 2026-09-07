import { notFound, redirect } from 'next/navigation';
import { getBusinessProfile } from '@/actions/business';
import { getInvoiceById } from '@/actions/invoices';
import { InvoiceForm } from '@/components/documents/invoice-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: PageProps) {
  const { id } = await params;

  const [businessResult, invoiceResult] = await Promise.all([
    getBusinessProfile(),
    getInvoiceById(id),
  ]);

  if (!businessResult.ok || !businessResult.data) {
    redirect('/dashboard/settings?onboarding=1');
  }

  if (!invoiceResult.ok || !invoiceResult.data) {
    notFound();
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <InvoiceForm
        initialInvoice={invoiceResult.data}
        business={businessResult.data}
      />
    </div>
  );
}
