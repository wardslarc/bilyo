import { centavosToPesos } from './money.ts';

/**
 * Escapes a single CSV field following RFC 4180.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of objects to a CSV string.
 */
export function toCsv(headers: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map((h) => escapeCsvField(h.label)).join(',');
  const lines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h.key])).join(',')
  );
  return [headerLine, ...lines].join('\r\n');
}

export interface SanitizedUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  emailVerifiedAt?: string | Date | null;
  mfaEnabled: boolean;
  mfaEnabledAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
}

/**
 * Strips all sensitive, radioactive, or authentication-specific secrets from user data.
 * AGENTS.md §3.8, §4: Never export password hashes, TOTP secrets, or recovery codes.
 */
export function sanitizeUserExport(user: {
  _id?: unknown;
  id?: unknown;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  emailVerifiedAt?: Date | string | null;
  mfaEnabledAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
}): SanitizedUserData {
  return {
    id: String(user._id || user.id || ''),
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'USER',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    emailVerifiedAt: user.emailVerifiedAt || null,
    mfaEnabled: Boolean(user.mfaEnabledAt),
    mfaEnabledAt: user.mfaEnabledAt || null,
    lastLoginAt: user.lastLoginAt || null,
  };
}

export interface ExportDataPayload {
  exportDate: string;
  user: SanitizedUserData;
  business: Record<string, unknown> | null;
  customers: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
}

export function formatQuotationsCsv(quotations: Record<string, unknown>[]): string {
  const headers = [
    { key: 'quotationNumber', label: 'Quotation Number' },
    { key: 'customerName', label: 'Customer' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'validUntil', label: 'Valid Until' },
    { key: 'status', label: 'Status' },
    { key: 'subtotalPesos', label: 'Subtotal (PHP)' },
    { key: 'discountPesos', label: 'Discount (PHP)' },
    { key: 'vatPesos', label: 'VAT (PHP)' },
    { key: 'totalPesos', label: 'Total (PHP)' },
    { key: 'notes', label: 'Notes' },
  ];

  const rows = quotations.map((q) => {
    const cust = q.customerSnapshot as Record<string, unknown> | undefined;
    return {
      quotationNumber: q.quotationNumber,
      customerName: cust?.name || '',
      issueDate: q.issueDate ? new Date(q.issueDate as string).toISOString().split('T')[0] : '',
      validUntil: q.validUntil ? new Date(q.validUntil as string).toISOString().split('T')[0] : '',
      status: q.status,
      subtotalPesos: centavosToPesos((q.subtotalCentavos as number) || 0).toFixed(2),
      discountPesos: centavosToPesos((q.discountCentavos as number) || 0).toFixed(2),
      vatPesos: centavosToPesos((q.vatCentavos as number) || 0).toFixed(2),
      totalPesos: centavosToPesos((q.totalCentavos as number) || 0).toFixed(2),
      notes: q.notes || '',
    };
  });

  return toCsv(headers, rows);
}

export function formatCustomersCsv(customers: Record<string, unknown>[]): string {
  const headers = [
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'taxId', label: 'Tax ID' },
    { key: 'address', label: 'Address' },
    { key: 'archived', label: 'Archived' },
  ];

  const rows = customers.map((c) => ({
    name: c.name || '',
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    taxId: c.taxId || '',
    address: c.address || '',
    archived: c.archivedAt ? 'Yes' : 'No',
  }));

  return toCsv(headers, rows);
}
