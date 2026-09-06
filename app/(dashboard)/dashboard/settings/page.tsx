import { getBusinessProfile } from '@/actions/business';
import { BusinessProfileForm } from '@/components/dashboard/BusinessProfileForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Business Profile & Settings · Bilyo',
  description: 'Manage your business details, address, TIN, and VAT settings for invoices and quotations.',
};

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedParams = await searchParams;
  const isOnboarding = resolvedParams.onboarding === '1';

  const result = await getBusinessProfile();
  const initialBusiness = result.ok ? result.data : null;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Business Profile
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Set up your company information, tax settings, and branding used on all outgoing invoices and quotations.
        </p>
      </div>

      <BusinessProfileForm
        initialBusiness={initialBusiness}
        isOnboarding={isOnboarding}
      />
    </div>
  );
}
