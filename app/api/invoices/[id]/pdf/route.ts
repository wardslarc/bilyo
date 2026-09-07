import React from 'react';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { renderToStream, type Document } from '@react-pdf/renderer';
import dbConnect from '@/lib/mongodb';
import { requireUser, assertNotSuspended } from '@/lib/auth-guards';
import { Invoice } from '@/models/invoice';
import { Business } from '@/models/business';
import { Customer } from '@/models/customer';
import {
  InvoiceDocument,
  type InvoiceDocumentProps,
} from '@/lib/pdf/invoice-document';

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
  const invoice = await Invoice.findOne({ _id: id, userId: user.id });
  if (!invoice) {
    return new Response('Not Found', { status: 404 });
  }

  // Use snapshots if frozen at SENT (§3.9), otherwise fallback to current profiles
  const business =
    invoice.businessSnapshot ||
    (await Business.findOne({ userId: user.id })) || {
      businessName: 'Business',
      vatRegistered: false,
    };

  const customer =
    invoice.customerSnapshot ||
    (await Customer.findOne({ _id: invoice.customerId, userId: user.id })) || {
      name: 'Customer',
    };

  const pdfProps: InvoiceDocumentProps = {
    number: invoice.number,
    items: (invoice.items || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCentavos: item.unitPriceCentavos,
      amountCentavos: item.amountCentavos,
    })),
    subtotalCentavos: invoice.subtotalCentavos,
    discountCentavos: invoice.discountCentavos,
    vatRatePercent: invoice.vatRatePercent,
    vatCentavos: invoice.vatCentavos,
    totalCentavos: invoice.totalCentavos,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes,
    terms: invoice.terms,
    business: {
      businessName: business.businessName,
      address: business.address,
      email: business.email,
      phone: business.phone,
      tin: business.tin,
      vatRegistered: business.vatRegistered,
      logoUrl: business.logoUrl,
    },
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      tin: customer.tin,
    },
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
      'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
}
