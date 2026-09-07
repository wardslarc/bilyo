import React from 'react';
import {
  BaseDocumentLayout,
  type PdfLineItem,
  type PdfBusinessInfo,
  type PdfCustomerInfo,
} from './shared/document-layout.tsx';
import { getDocumentPdfDisclaimer } from '../documents.ts';

export type LineItem = PdfLineItem;
export type BusinessInfo = PdfBusinessInfo;
export type CustomerInfo = PdfCustomerInfo;

export interface InvoiceDocumentProps {
  number: string;
  items: LineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
  issueDate: string | Date;
  dueDate: string | Date;
  paidAt?: string | Date | null;
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  customer: CustomerInfo;
}

export function InvoiceDocument({
  number,
  items,
  subtotalCentavos,
  discountCentavos,
  vatRatePercent,
  vatCentavos,
  totalCentavos,
  issueDate,
  dueDate,
  paidAt,
  notes,
  terms,
  business,
  customer,
}: InvoiceDocumentProps) {
  return (
    <BaseDocumentLayout
      kind="invoice"
      documentTitle="INVOICE"
      number={number}
      business={business}
      customer={customer}
      items={items}
      subtotalCentavos={subtotalCentavos}
      discountCentavos={discountCentavos}
      vatRatePercent={vatRatePercent}
      vatCentavos={vatCentavos}
      totalCentavos={totalCentavos}
      issueDate={issueDate}
      secondaryDateLabel="Due Date"
      secondaryDate={dueDate}
      paidAt={paidAt}
      notes={notes}
      terms={terms}
      disclaimer={getDocumentPdfDisclaimer('invoice')}
    />
  );
}
