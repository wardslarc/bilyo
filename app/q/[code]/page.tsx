import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicQuotationByCode } from '@/lib/public-projection';
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
  params: Promise<{ code: string }>;
}

export default async function PublicQuotationPage({ params }: PageProps) {
  const { code } = await params;

  const doc = await getPublicQuotationByCode(code);

  if (!doc) {
    notFound();
  }

  return (
    <PublicDocumentView
      document={doc}
      pdfDownloadUrl={`/api/public/q/${code}/pdf`}
    />
  );
}
