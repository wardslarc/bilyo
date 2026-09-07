import type {
  QuotationStatus,
  InvoiceStatus,
  ILineItem,
} from '../types/index.ts';
import { centavosToPesos } from './money.ts';

export interface LineItemRow {
  /** Client-side key for React reconciliation */
  id: string;
  description: string;
  /** Raw string from the input — converted to number only at compute time */
  quantity: string;
  /** Raw peso string from the input — converted to centavos only at compute time */
  unitPrice: string;
  /** If prefilled from a product, track it for UX but not for storage */
  productId?: string;
}

export type DocumentKind = 'quotation' | 'invoice';

export type DocumentStatus = QuotationStatus | InvoiceStatus;

export interface DocumentInfo {
  kind: DocumentKind;
  title: string;
  numberPrefix: string;
  secondaryDateLabel: string;
  secondaryDateKey: 'validUntil' | 'dueDate';
}

export const DOCUMENT_CONFIG: Record<DocumentKind, DocumentInfo> = {
  quotation: {
    kind: 'quotation',
    title: 'Quotation',
    numberPrefix: 'QUO',
    secondaryDateLabel: 'Valid Until',
    secondaryDateKey: 'validUntil',
  },
  invoice: {
    kind: 'invoice',
    title: 'Invoice',
    numberPrefix: 'INV',
    secondaryDateLabel: 'Due Date',
    secondaryDateKey: 'dueDate',
  },
};

/**
 * Format a Date object or ISO string to YYYY-MM-DD for input[type="date"]
 */
export function toDateInputValue(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Default issue date: today's date formatted as YYYY-MM-DD
 */
export function defaultIssueDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Default validity / due date: today + offset days formatted as YYYY-MM-DD
 */
export function defaultSecondaryDate(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

/**
 * Convert storage/model line items into editable UI LineItemRows
 */
export function lineItemsToRows(items: ILineItem[] = []): LineItemRow[] {
  return items.map((item, index) => ({
    id: `row-${index}-${Date.now()}`,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: centavosToPesos(item.unitPriceCentavos).toFixed(2),
  }));
}

/**
 * Convert UI LineItemRows into submission payload items
 */
export function rowsToPayloadItems(rows: LineItemRow[]) {
  return rows.map((row) => ({
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
  }));
}

/**
 * Check if a document is editable based on kind and status.
 * Quotations in DRAFT are editable; SENT/ACCEPTED/etc are view/locked.
 * Invoices: PAID and CANCELLED are terminal and permanently immutable (§5.4).
 */
export function isDocumentEditable(
  kind: DocumentKind,
  status?: DocumentStatus | null
): boolean {
  if (!status) return true; // new document
  if (kind === 'quotation') {
    return status === 'DRAFT';
  }
  // invoice: PAID and CANCELLED are terminal; DRAFT and SENT can be edited
  return status !== 'PAID' && status !== 'CANCELLED';
}

/**
 * Returns human-readable badge text and CSS color classes for status display
 */
export function getStatusBadgeConfig(status: DocumentStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft',
        className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      };
    case 'SENT':
      return {
        label: 'Sent',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'ACCEPTED':
      return {
        label: 'Accepted',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'PAID':
      return {
        label: 'Paid',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'OVERDUE':
      return {
        label: 'Overdue',
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    case 'DECLINED':
      return {
        label: 'Declined',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'EXPIRED':
      return {
        label: 'Expired',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-neutral-100 text-neutral-500 border-neutral-200',
      };
    default:
      return {
        label: status,
        className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      };
  }
}

/**
 * Standard PDF disclaimer text required by AGENTS.md §4
 */
export function getDocumentPdfDisclaimer(kind: DocumentKind): string {
  if (kind === 'quotation') {
    return 'This document is a quotation and is not an official sales invoice or receipt. It is not valid for tax purposes.';
  }
  return 'This document is an invoice and is not an official sales invoice or receipt under BIR regulations. It is not valid for claiming input tax.';
}
