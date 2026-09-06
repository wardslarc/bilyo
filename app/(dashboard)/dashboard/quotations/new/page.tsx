import { redirect } from 'next/navigation';
import { getBusinessProfile } from '@/actions/business';
import { QuotationForm } from '@/components/documents/quotation-form';

export const dynamic = 'force-dynamic';

export default async function NewQuotationPage() {
  const businessResult = await getBusinessProfile();

  // Redirect to settings if no business profile exists (onboarding gate)
  if (!businessResult.ok || !businessResult.data) {
    redirect('/dashboard/settings?onboarding=1');
  }

  return (
    <div className="py-6 px-4 sm:px-6">
      <QuotationForm business={businessResult.data} />
    </div>
  );
}
