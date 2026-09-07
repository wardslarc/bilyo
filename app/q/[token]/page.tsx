import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicQuotationByToken } from '@/lib/public-projection';
import { PublicDocumentView } from '@/components/documents/public-document-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quotation',
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicQuotationPage({ params }: PageProps) {
  const { token } = await params;

  const doc = await getPublicQuotationByToken(token);

  if (!doc) {
    notFound();
  }

  return (
    <PublicDocumentView
      document={doc}
      pdfDownloadUrl={`/api/public/q/${token}/pdf`}
    />
  );
}
