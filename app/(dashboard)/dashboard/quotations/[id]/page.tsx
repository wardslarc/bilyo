import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth-guards';
import { getBusinessProfile } from '@/actions/business';
import { getQuotation } from '@/actions/quotations';
import { getSerializedQuotationEvents } from '@/lib/events';
import { QuotationForm } from '@/components/documents/quotation-form';
import { QuotationTimeline } from '@/components/quotations/timeline';
import { MarkPaidToggle } from '@/components/quotations/mark-paid-toggle';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const [businessResult, quotationResult, events] = await Promise.all([
    getBusinessProfile(),
    getQuotation(id),
    getSerializedQuotationEvents(id, user.id),
  ]);

  if (!businessResult.ok || !businessResult.data) {
    redirect('/dashboard/settings?onboarding=1');
  }

  if (!quotationResult.ok || !quotationResult.data) {
    notFound();
  }

  return (
    <div className="py-6 px-4 sm:px-6 max-w-5xl mx-auto space-y-6">
      {/* Activity Timeline with Copy Link Button (§12, P3-T05) */}
      <QuotationTimeline
        events={events}
        publicCode={quotationResult.data.publicCode}
      />

      {/* Mark as Paid Toggle (§12, P4-T04) — active on ACCEPTED */}
      <MarkPaidToggle quotation={quotationResult.data} />

      <QuotationForm
        initialQuotation={quotationResult.data}
        business={businessResult.data}
      />
    </div>
  );
}

