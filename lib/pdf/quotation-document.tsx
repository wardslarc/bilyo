import React from 'react';
import {
  BaseDocumentLayout,
  type PdfLineItem,
  type PdfBusinessInfo,
  type PdfCustomerInfo,
} from './shared/document-layout.tsx';
import { getDocumentPdfDisclaimer } from '../documents.ts';

// Re-export shared types for backward compatibility
export type LineItem = PdfLineItem;
export type BusinessInfo = PdfBusinessInfo;
export type CustomerInfo = PdfCustomerInfo;

export interface QuotationDocumentProps {
  number: string;
  items: LineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  issueDate: string | Date;
  validUntil: string | Date;
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  customer: CustomerInfo;
}

export function QuotationDocument({
  number,
  items,
  subtotalCentavos,
  discountCentavos,
  totalCentavos,
  issueDate,
  validUntil,
  notes,
  terms,
  business,
  customer,
}: QuotationDocumentProps) {
  return (
    <BaseDocumentLayout
      kind="quotation"
      documentTitle="QUOTATION"
      number={number}
      business={business}
      customer={customer}
      items={items}
      subtotalCentavos={subtotalCentavos}
      discountCentavos={discountCentavos}
      totalCentavos={totalCentavos}
      issueDate={issueDate}
      secondaryDateLabel="Valid Until"
      secondaryDate={validUntil}
      notes={notes}
      terms={terms}
      disclaimer={getDocumentPdfDisclaimer()}
    />
  );
}
