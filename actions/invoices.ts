'use server';

import dbConnect from '../lib/mongodb.ts';
import { Invoice } from '../models/invoice.ts';
import { Customer } from '../models/customer.ts';
import { Business } from '../models/business.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import { invoiceSchema, type InvoiceInput } from '../lib/validation/invoice.ts';
import { computeTotals } from '../lib/totals.ts';
import { nextNumber } from '../lib/numbering.ts';
import type { ActionResult } from '../types/index.ts';
import crypto from 'node:crypto';

// --- Serialized types for client transport ---

export interface SerializedLineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

export interface SerializedInvoice {
  id: string;
  userId: string;
  customerId: string;
  number: string;
  items: SerializedLineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  notes: string;
  terms: string;
  publicToken: string | null;
  customerSnapshot: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tin?: string;
  } | null;
  businessSnapshot: {
    businessName: string;
    address?: string;
    email?: string;
    phone?: string;
    tin?: string;
    vatRegistered: boolean;
    logoUrl?: string | null;
  } | null;
  sourceQuotationId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Helpers ---

async function safeRevalidate(path: string) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // Ignore outside Next runtime
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeInvoice(doc: any): SerializedInvoice {
  const items = (doc.items as Array<Record<string, unknown>> | undefined) ?? [];
  const customerSnapshot = doc.customerSnapshot as Record<string, unknown> | null | undefined;
  const businessSnapshot = doc.businessSnapshot as Record<string, unknown> | null | undefined;

  // Derive OVERDUE at read time (§5.4): status === 'SENT' && dueDate < today
  let displayStatus = String(doc.status ?? 'DRAFT');
  if (displayStatus === 'SENT' && doc.dueDate) {
    const due = new Date(doc.dueDate);
    const now = new Date();
    // Compare date boundary
    if (due.getTime() < now.getTime()) {
      displayStatus = 'OVERDUE';
    }
  }

  return {
    id: String(doc._id),
    userId: String(doc.userId),
    customerId: String(doc.customerId),
    number: String(doc.number ?? ''),
    items: items.map((item) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPriceCentavos: Number(item.unitPriceCentavos ?? 0),
      amountCentavos: Number(item.amountCentavos ?? 0),
    })),
    subtotalCentavos: Number(doc.subtotalCentavos ?? 0),
    discountCentavos: Number(doc.discountCentavos ?? 0),
    vatRatePercent: Number(doc.vatRatePercent ?? 12),
    vatCentavos: Number(doc.vatCentavos ?? 0),
    totalCentavos: Number(doc.totalCentavos ?? 0),
    status: displayStatus,
    issueDate: doc.issueDate
      ? new Date(doc.issueDate as string | number | Date).toISOString()
      : new Date().toISOString(),
    dueDate: doc.dueDate
      ? new Date(doc.dueDate as string | number | Date).toISOString()
      : new Date().toISOString(),
    paidAt: doc.paidAt
      ? new Date(doc.paidAt as string | number | Date).toISOString()
      : null,
    notes: String(doc.notes ?? ''),
    terms: String(doc.terms ?? ''),
    publicToken: doc.publicToken ? String(doc.publicToken) : null,
    customerSnapshot: customerSnapshot
      ? {
          name: String(customerSnapshot.name ?? ''),
          email: String(customerSnapshot.email ?? ''),
          phone: String(customerSnapshot.phone ?? ''),
          address: String(customerSnapshot.address ?? ''),
          tin: String(customerSnapshot.tin ?? ''),
        }
      : null,
    businessSnapshot: businessSnapshot
      ? {
          businessName: String(businessSnapshot.businessName ?? ''),
          address: String(businessSnapshot.address ?? ''),
          email: String(businessSnapshot.email ?? ''),
          phone: String(businessSnapshot.phone ?? ''),
          tin: String(businessSnapshot.tin ?? ''),
          vatRegistered: Boolean(businessSnapshot.vatRegistered),
          logoUrl: businessSnapshot.logoUrl ? String(businessSnapshot.logoUrl) : null,
        }
      : null,
    sourceQuotationId: doc.sourceQuotationId ? String(doc.sourceQuotationId) : null,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | number | Date).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as string | number | Date).toISOString()
      : new Date().toISOString(),
  };
}

function extractFieldErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field !== undefined) {
      const key = issue.path.length > 1 ? issue.path.join('.') : String(field);
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function generatePublicToken(): string {
  return crypto.randomBytes(9).toString('base64url'); // 12-char URL safe
}

// --- Actions ---

/**
 * Create a new invoice (§5.3: atomic sequential number assigned on first save).
 * Server recomputes totals from line items (§3.3).
 */
export async function createInvoice(
  input: InvoiceInput
): Promise<ActionResult<SerializedInvoice>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = invoiceSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: 'Validation failed',
        fieldErrors: extractFieldErrors(parseResult.error.issues),
      };
    }

    const data = parseResult.data;

    await dbConnect();

    // Verify customer belongs to this user (§5.5)
    const customer = await Customer.findOne({
      _id: data.customerId,
      userId: user.id,
    }).lean();

    if (!customer) {
      return { ok: false, error: 'Customer not found' };
    }

    // Get user's business profile for VAT settings
    const business = await Business.findOne({ userId: user.id }).lean();
    const vatRegistered = business?.vatRegistered ?? false;

    // Server-side recomputation of line items and totals (§3.3)
    const computed = computeTotals({
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCentavos: item.unitPrice,
      })),
      discountCentavos: data.discount,
      vatRegistered,
      vatRatePercent: 12,
    });

    // Atomic document number assignment (§5.3)
    const number = await nextNumber(user.id, 'INVOICE');

    const invoice = await Invoice.create({
      userId: user.id,
      customerId: data.customerId,
      number,
      items: computed.items,
      subtotalCentavos: computed.subtotalCentavos,
      discountCentavos: computed.discountCentavos,
      vatRatePercent: computed.vatRatePercent,
      vatCentavos: computed.vatCentavos,
      totalCentavos: computed.totalCentavos,
      status: 'DRAFT',
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      notes: data.notes,
      terms: data.terms,
    });

    await safeRevalidate('/dashboard/invoices');

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to create invoice:', err);
    return { ok: false, error: 'Failed to create invoice. Please try again.' };
  }
}

/**
 * Update an existing invoice.
 * Server recomputes totals (§3.3).
 * PAID and CANCELLED invoices cannot be updated (§5.4).
 */
export async function updateInvoice(
  id: string,
  input: InvoiceInput
): Promise<ActionResult<SerializedInvoice>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = invoiceSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: 'Validation failed',
        fieldErrors: extractFieldErrors(parseResult.error.issues),
      };
    }

    const data = parseResult.data;

    await dbConnect();

    // Verify invoice belongs to this user (§5.5)
    const invoice = await Invoice.findOne({ _id: id, userId: user.id });
    if (!invoice) {
      return { ok: false, error: 'Invoice not found' };
    }

    // Terminal statuses cannot be edited (§5.4)
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      return {
        ok: false,
        error: `This invoice is ${invoice.status.toLowerCase()} and cannot be edited.`,
      };
    }

    // Verify customer belongs to this user (§5.5)
    const customer = await Customer.findOne({
      _id: data.customerId,
      userId: user.id,
    }).lean();

    if (!customer) {
      return { ok: false, error: 'Customer not found' };
    }

    const business = await Business.findOne({ userId: user.id }).lean();
    const vatRegistered = business?.vatRegistered ?? false;

    // Server-side recomputation of line items and totals (§3.3)
    const computed = computeTotals({
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCentavos: item.unitPrice,
      })),
      discountCentavos: data.discount,
      vatRegistered,
      vatRatePercent: 12,
    });

    invoice.customerId = data.customerId as unknown as typeof invoice.customerId;
    invoice.items = computed.items as unknown as typeof invoice.items;
    invoice.subtotalCentavos = computed.subtotalCentavos;
    invoice.discountCentavos = computed.discountCentavos;
    invoice.vatRatePercent = computed.vatRatePercent;
    invoice.vatCentavos = computed.vatCentavos;
    invoice.totalCentavos = computed.totalCentavos;
    invoice.issueDate = data.issueDate;
    invoice.dueDate = data.dueDate;
    invoice.notes = data.notes;
    invoice.terms = data.terms;

    await invoice.save();

    await safeRevalidate('/dashboard/invoices');
    await safeRevalidate(`/dashboard/invoices/${id}`);

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to update invoice:', err);
    return { ok: false, error: 'Failed to update invoice. Please try again.' };
  }
}

/**
 * Transition invoice to SENT (§5.4).
 * Freezes customerSnapshot and businessSnapshot on first send (§3.9, §5.4).
 * Assigns a publicToken if one does not exist.
 */
export async function sendInvoice(
  id: string
): Promise<ActionResult<SerializedInvoice>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const invoice = await Invoice.findOne({ _id: id, userId: user.id });
    if (!invoice) {
      return { ok: false, error: 'Invoice not found' };
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      return {
        ok: false,
        error: `Cannot send an invoice with status ${invoice.status.toLowerCase()}.`,
      };
    }

    // Freeze snapshots on first SENT transition (§3.9)
    if (!invoice.customerSnapshot) {
      const customer = await Customer.findOne({
        _id: invoice.customerId,
        userId: user.id,
      }).lean();

      if (customer) {
        invoice.customerSnapshot = {
          name: customer.name,
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          address: customer.address ?? '',
          tin: customer.tin ?? '',
        };
      }
    }

    if (!invoice.businessSnapshot) {
      const business = await Business.findOne({ userId: user.id }).lean();
      if (business) {
        invoice.businessSnapshot = {
          businessName: business.businessName,
          address: business.address ?? '',
          email: business.email ?? '',
          phone: business.phone ?? '',
          tin: business.tin ?? '',
          vatRegistered: business.vatRegistered,
          logoUrl: business.logoUrl ?? null,
        };
      }
    }

    // Assign publicToken for customer sharing (§5.6)
    if (!invoice.publicToken) {
      invoice.publicToken = generatePublicToken();
    }

    invoice.status = 'SENT';
    await invoice.save();

    await safeRevalidate('/dashboard/invoices');
    await safeRevalidate(`/dashboard/invoices/${id}`);

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to send invoice:', err);
    return { ok: false, error: 'Failed to send invoice. Please try again.' };
  }
}

/**
 * Get a list of invoices for the current user.
 * Scoped by userId (§3.1, §5.5).
 */
export async function getInvoices(filters?: {
  status?: string;
  search?: string;
}): Promise<ActionResult<SerializedInvoice[]>> {
  try {
    const user = await requireUser();
    await dbConnect();

    // Query scoped by authenticated user (§3.1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { userId: user.id };

    if (filters?.status && filters.status !== 'ALL') {
      if (filters.status === 'OVERDUE') {
        // OVERDUE is derived: status === 'SENT' and dueDate < today
        query.status = 'SENT';
        query.dueDate = { $lt: new Date() };
      } else {
        query.status = filters.status;
      }
    }

    if (filters?.search && filters.search.trim()) {
      query.number = { $regex: filters.search.trim(), $options: 'i' };
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return {
      ok: true,
      data: invoices.map(serializeInvoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to get invoices:', err);
    return { ok: false, error: 'Failed to load invoices.' };
  }
}

/**
 * Get a single invoice by ID.
 * Scoped by userId (§3.1, §5.5).
 */
export async function getInvoiceById(
  id: string
): Promise<ActionResult<SerializedInvoice | null>> {
  try {
    const user = await requireUser();
    await dbConnect();

    const invoice = await Invoice.findOne({ _id: id, userId: user.id }).lean();
    if (!invoice) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to get invoice:', err);
    return { ok: false, error: 'Failed to load invoice.' };
  }
}

/**
 * Mark an invoice as PAID (§5.4).
 * Sets paidAt to current time, locks line items and totals permanently.
 * Terminal status.
 */
export async function markInvoicePaid(
  id: string
): Promise<ActionResult<SerializedInvoice>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const invoice = await Invoice.findOne({ _id: id, userId: user.id });
    if (!invoice) {
      return { ok: false, error: 'Invoice not found' };
    }

    if (invoice.status === 'PAID') {
      return { ok: false, error: 'Invoice is already marked as paid.' };
    }

    if (invoice.status === 'CANCELLED') {
      return { ok: false, error: 'Cannot mark a cancelled invoice as paid.' };
    }

    // Freeze snapshots if not already snapshotted (§3.9)
    if (!invoice.customerSnapshot) {
      const customer = await Customer.findOne({
        _id: invoice.customerId,
        userId: user.id,
      }).lean();

      if (customer) {
        invoice.customerSnapshot = {
          name: customer.name,
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          address: customer.address ?? '',
          tin: customer.tin ?? '',
        };
      }
    }

    if (!invoice.businessSnapshot) {
      const business = await Business.findOne({ userId: user.id }).lean();
      if (business) {
        invoice.businessSnapshot = {
          businessName: business.businessName,
          address: business.address ?? '',
          email: business.email ?? '',
          phone: business.phone ?? '',
          tin: business.tin ?? '',
          vatRegistered: business.vatRegistered,
          logoUrl: business.logoUrl ?? null,
        };
      }
    }

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    await invoice.save();

    await safeRevalidate('/dashboard/invoices');
    await safeRevalidate(`/dashboard/invoices/${id}`);

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to mark invoice as paid:', err);
    return { ok: false, error: 'Failed to mark invoice as paid. Please try again.' };
  }
}

/**
 * Cancel an invoice (§5.4).
 * Allowed only from DRAFT, SENT, or OVERDUE.
 * Terminal status.
 */
export async function cancelInvoice(
  id: string
): Promise<ActionResult<SerializedInvoice>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const invoice = await Invoice.findOne({ _id: id, userId: user.id });
    if (!invoice) {
      return { ok: false, error: 'Invoice not found' };
    }

    if (invoice.status === 'PAID') {
      return { ok: false, error: 'Cannot cancel an invoice that has already been paid.' };
    }

    if (invoice.status === 'CANCELLED') {
      return { ok: false, error: 'Invoice is already cancelled.' };
    }

    invoice.status = 'CANCELLED';
    await invoice.save();

    await safeRevalidate('/dashboard/invoices');
    await safeRevalidate(`/dashboard/invoices/${id}`);

    return {
      ok: true,
      data: serializeInvoice(invoice),
    };
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return { ok: false, error: err.message };
    }
    console.error('Failed to cancel invoice:', err);
    return { ok: false, error: 'Failed to cancel invoice. Please try again.' };
  }
}
