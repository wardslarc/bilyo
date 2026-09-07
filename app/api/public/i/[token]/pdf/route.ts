import React from 'react';
import { Readable } from 'node:stream';
import { renderToStream, type Document } from '@react-pdf/renderer';
import { getPublicInvoiceByToken } from '@/lib/public-projection';
import {
  InvoiceDocument,
  type InvoiceDocumentProps,
} from '@/lib/pdf/invoice-document';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
): Promise<Response> {
  const { token } = await params;

  const doc = await getPublicInvoiceByToken(token);
  if (!doc) {
    return new Response('Not Found', { status: 404 });
  }

  const pdfProps: InvoiceDocumentProps = {
    number: doc.number,
    items: doc.items,
    subtotalCentavos: doc.subtotalCentavos,
    discountCentavos: doc.discountCentavos,
    vatRatePercent: doc.vatRatePercent,
    vatCentavos: doc.vatCentavos,
    totalCentavos: doc.totalCentavos,
    issueDate: doc.issueDate,
    dueDate: doc.secondaryDate,
    paidAt: doc.paidAt,
    notes: doc.notes,
    terms: doc.terms,
    business: doc.business,
    customer: doc.customer,
  };

  const element = React.createElement(InvoiceDocument, pdfProps);
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
