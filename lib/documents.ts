import type {
  QuotationStatus,
  DerivedQuotationStatus,
  ILineItem,
} from '../types/index.ts';
import { centavosToPesos } from './money.ts';

/**
 * Required footer on every quotation view and PDF (AGENTS.md §3.3)
 */
export const QUOTATION_FOOTER =
  'This is a quotation, not a tax document. It is not an invoice or official receipt.';

export interface LineItemRow {
  /** Client-side key for React reconciliation */
  id: string;
  description: string;
  /** Raw string from the input — converted to number only at compute time */
  quantity: string;
  /** Raw peso string from the input — converted to centavos only at compute time */
  unitPrice: string;
}

export type DocumentStatus = DerivedQuotationStatus;

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
 * Default validity date: today + offset days formatted as YYYY-MM-DD
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
 * Check if a quotation is editable based on status.
 * Quotations in DRAFT are editable; SENT/ACCEPTED/etc are locked.
 */
export function isDocumentEditable(status?: DocumentStatus | null): boolean {
  if (!status) return true; // new document
  return status === 'DRAFT';
}

/**
 * Derive quotation status at read time (§6.4):
 * status ∈ {SENT, VIEWED} && validUntil < today -> EXPIRED
 * Never stored in the database.
 */
export function getDerivedQuotationStatus(
  status: QuotationStatus | string,
  validUntil?: Date | string | null
): DocumentStatus {
  if ((status === 'SENT' || status === 'VIEWED') && validUntil) {
    const validDate = typeof validUntil === 'string' ? new Date(validUntil) : validUntil;
    if (!Number.isNaN(validDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validDate < today) {
        return 'EXPIRED';
      }
    }
  }
  return status as DocumentStatus;
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
    case 'VIEWED':
      return {
        label: 'Viewed',
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'ACCEPTED':
      return {
        label: 'Accepted',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
    default:
      return {
        label: status,
        className: 'bg-neutral-100 text-neutral-700 border-neutral-200',
      };
  }
}

/**
 * Standard PDF disclaimer text required by AGENTS.md §3
 */
export function getDocumentPdfDisclaimer(): string {
  return QUOTATION_FOOTER;
}
