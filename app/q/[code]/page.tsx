import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicQuotationByCode } from '@/lib/public-projection';
import { formatMoney } from '@/lib/money';
import { QuotePage } from '@/components/public/quote-page';

import { auth } from '@/lib/auth';
import { recordQuotationView } from '@/actions/quotations';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const doc = await getPublicQuotationByCode(code);

  if (!doc) {
    return {
      title: 'Quotation Not Found · Bilyo',
      robots: { index: false, follow: false },
    };
  }

  const title = `${doc.number} from ${doc.business.businessName}`;
  const description = `Quotation for ${doc.customer.name} · Total: ${formatMoney(doc.totalCentavos)}`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title,
      description,
      siteName: 'Bilyo',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function PublicQuotationPage({ params }: PageProps) {
  const { code } = await params;

  // Session check: guard so owner previewing their own link does not count (§6.4, P3-T03)
  const session = await auth();
  const viewerUserId = session?.user?.id || null;

  // First public render sets viewedAt, moves SENT → VIEWED, appends one VIEWED event
  await recordQuotationView(code, viewerUserId);

  const doc = await getPublicQuotationByCode(code);

  if (!doc) {
    notFound();
  }

  return <QuotePage document={doc} code={code} />;
}
