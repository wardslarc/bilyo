import React from 'react';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { renderToStream, type Document } from '@react-pdf/renderer';
import dbConnect from '@/lib/mongodb';
import { requireUser, assertNotSuspended } from '@/lib/auth-guards';
import { Quotation } from '@/models/quotation';
import { Business } from '@/models/business';
import { Customer } from '@/models/customer';
import {
  QuotationDocument,
  type QuotationDocumentProps,
} from '@/lib/pdf/quotation-document';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  let user;
  try {
    user = await requireUser();
    await assertNotSuspended(user.id);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return new Response('Not Found', { status: 404 });
  }

  await dbConnect();

  // Ownership-scoped query (§3.1): returns null for another user's document
  const quotation = await Quotation.findOne({ _id: id, userId: user.id });
  if (!quotation) {
    return new Response('Not Found', { status: 404 });
  }

  // Use snapshots if frozen at SENT (§3.9), otherwise fallback to current profiles
  const business =
    quotation.businessSnapshot ||
    (await Business.findOne({ userId: user.id })) || {
      businessName: 'Business',
    };

  const customer =
    quotation.customerSnapshot ||
    (await Customer.findOne({ _id: quotation.customerId, userId: user.id })) || {
      name: 'Client',
    };

  const pdfProps: QuotationDocumentProps = {
    number: quotation.number,
    items: (quotation.items || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCentavos: item.unitPriceCentavos,
      amountCentavos: item.amountCentavos,
    })),
    subtotalCentavos: quotation.subtotalCentavos,
    discountCentavos: quotation.discountCentavos,
    totalCentavos: quotation.totalCentavos,
    issueDate: quotation.issueDate,
    validUntil: quotation.validUntil,
    notes: quotation.notes,
    terms: quotation.terms,
    business: {
      businessName: business.businessName,
      address: business.address,
      email: business.email,
      phone: business.phone,
      logoUrl: business.logoUrl,
    },
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
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
      'Content-Disposition': `attachment; filename="${quotation.number}.pdf"`,
    },
  });
}
