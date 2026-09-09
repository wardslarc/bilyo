import React from 'react';
import { Readable } from 'node:stream';
import { renderToStream, type Document } from '@react-pdf/renderer';
import { getPublicQuotationByCode } from '@/lib/public-projection';
import {
  QuotationDocument,
  type QuotationDocumentProps,
} from '@/lib/pdf/quotation-document';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
): Promise<Response> {
  const { code } = await params;

  const doc = await getPublicQuotationByCode(code);
  if (!doc) {
    return new Response('Not Found', { status: 404 });
  }

  const pdfProps: QuotationDocumentProps = {
    number: doc.number,
    items: doc.items,
    subtotalCentavos: doc.subtotalCentavos,
    discountCentavos: doc.discountCentavos,
    totalCentavos: doc.totalCentavos,
    issueDate: doc.issueDate,
    validUntil: doc.secondaryDate,
    notes: doc.notes,
    terms: doc.terms,
    business: doc.business,
    customer: doc.customer,
  };

  const element = React.createElement(QuotationDocument, pdfProps);
  const nodeStream = await renderToStream(
    element as unknown as React.ReactElement<React.ComponentProps<typeof Document>>
  );
  const webStream = Readable.toWeb(nodeStream as unknown as Readable);

  return new Response(webStream as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.number}.pdf"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
}
