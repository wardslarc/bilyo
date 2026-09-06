import { notFound, redirect } from 'next/navigation';
import { getBusinessProfile } from '@/actions/business';
import { getQuotation } from '@/actions/quotations';
import { QuotationForm } from '@/components/documents/quotation-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: PageProps) {
  const { id } = await params;

  const [businessResult, quotationResult] = await Promise.all([
    getBusinessProfile(),
    getQuotation(id),
  ]);

  if (!businessResult.ok || !businessResult.data) {
    redirect('/dashboard/settings?onboarding=1');
  }

  if (!quotationResult.ok || !quotationResult.data) {
    notFound();
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <QuotationForm
        initialQuotation={quotationResult.data}
        business={businessResult.data}
      />
    </div>
  );
}
