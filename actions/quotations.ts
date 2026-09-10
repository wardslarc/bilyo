'use server';

import dbConnect from '../lib/mongodb.ts';
import { Quotation } from '../models/quotation.ts';
import { Customer } from '../models/customer.ts';
import { Business } from '../models/business.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import {
  quotationSchema,
  type QuotationInput,
  markPaidInputSchema,
  type MarkPaidInput,
} from '../lib/validation/quotation.ts';
import { computeTotals, type ComputedTotals } from '../lib/totals.ts';
import { nextNumber } from '../lib/numbering.ts';
import { recordEvent } from '../lib/events.ts';
import type { ActionResult } from '../types/index.ts';

// --- Serialized types for client transport ---

export interface SerializedLineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

export interface SerializedQuotation {
  id: string;
  userId: string;
  customerId: string;
  number: string;
  currency: string;
  items: SerializedLineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  status: string;
  issueDate: string;
  validUntil: string;
  notes: string;
  terms: string;
  publicCode: string | null;
  publicToken?: string | null;
  customerSnapshot: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  businessSnapshot: {
    businessName: string;
    address?: string;
    email?: string;
    phone?: string;
    logoUrl?: string | null;
    currency?: string;
  } | null;
  paidAt?: string | null;
  paidAmountCentavos?: number | null;
  emailState?: {
    attempted: boolean;
    ok: boolean;
    reason?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Totals returned after save so the client can render the server-recomputed values */
export interface SerializedTotals {
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
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
function serializeQuotation(doc: any): SerializedQuotation {
  const items = (doc.items as Array<Record<string, unknown>> | undefined) ?? [];
  const customerSnapshot = doc.customerSnapshot as Record<string, unknown> | null | undefined;
  const businessSnapshot = doc.businessSnapshot as Record<string, unknown> | null | undefined;

  return {
    id: String(doc._id),
    userId: String(doc.userId),
    customerId: String(doc.customerId),
    number: String(doc.number ?? ''),
    currency: String(doc.currency || 'PHP'),
    items: items.map((item) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 0),
      unitPriceCentavos: Number(item.unitPriceCentavos ?? 0),
      amountCentavos: Number(item.amountCentavos ?? 0),
    })),
    subtotalCentavos: Number(doc.subtotalCentavos ?? 0),
    discountCentavos: Number(doc.discountCentavos ?? 0),
    totalCentavos: Number(doc.totalCentavos ?? 0),
    status: String(doc.status ?? 'DRAFT'),
    issueDate: doc.issueDate ? new Date(doc.issueDate as string | number | Date).toISOString() : new Date().toISOString(),
    validUntil: doc.validUntil ? new Date(doc.validUntil as string | number | Date).toISOString() : new Date().toISOString(),
    notes: String(doc.notes ?? ''),
    terms: String(doc.terms ?? ''),
    publicCode: doc.publicCode ? String(doc.publicCode) : (doc.publicToken ? String(doc.publicToken) : null),
    publicToken: doc.publicCode ? String(doc.publicCode) : (doc.publicToken ? String(doc.publicToken) : null),
    customerSnapshot: customerSnapshot
      ? {
          name: String(customerSnapshot.name ?? ''),
          email: String(customerSnapshot.email ?? ''),
          phone: String(customerSnapshot.phone ?? ''),
          address: String(customerSnapshot.address ?? ''),
        }
      : null,
    businessSnapshot: businessSnapshot
      ? {
          businessName: String(businessSnapshot.businessName ?? ''),
          address: String(businessSnapshot.address ?? ''),
          email: String(businessSnapshot.email ?? ''),
          phone: String(businessSnapshot.phone ?? ''),
          logoUrl: businessSnapshot.logoUrl ? String(businessSnapshot.logoUrl) : null,
          currency: businessSnapshot.currency ? String(businessSnapshot.currency) : String(doc.currency || 'PHP'),
        }
      : null,
    paidAt: doc.paidAt ? new Date(doc.paidAt as string | number | Date).toISOString() : null,
    paidAmountCentavos: doc.paidAmountCentavos != null ? Number(doc.paidAmountCentavos) : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt as string | number | Date).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt as string | number | Date).toISOString() : new Date().toISOString(),
  };
}

function extractFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field !== undefined && !fieldErrors[String(field)]) {
      // For nested items, format as "items.0.description"
      const key = issue.path.length > 1 ? issue.path.join('.') : String(field);
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

// --- Actions ---

/**
 * Create a new quotation (§5.3: number assigned on first save).
 * Server recomputes totals from line items (§3.3).
 */
export async function createQuotation(
  input: QuotationInput
): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = quotationSchema.safeParse(input);
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

    // Fetch business for VAT registration status (§5.2)
    const business = await Business.findOne({ userId: user.id }).lean();
    if (!business) {
      return { ok: false, error: 'Please set up your business profile first' };
    }

    // Server-side total recomputation (§3.3)
    const totals: ComputedTotals = computeTotals({
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCentavos: item.unitPrice,
      })),
      discountCentavos: data.discount,
    });

    // Atomic sequential number assignment (§5.3)
    const number = await nextNumber(user.id, 'QUOTATION');

    const selectedCurrency = data.currency || business.currency || 'PHP';

    const doc = await Quotation.create({
      userId: user.id,
      customerId: data.customerId,
      number,
      currency: selectedCurrency,
      items: totals.items,
      subtotalCentavos: totals.subtotalCentavos,
      discountCentavos: totals.discountCentavos,
      totalCentavos: totals.totalCentavos,
      status: 'DRAFT',
      issueDate: data.issueDate,
      validUntil: data.validUntil,
      notes: data.notes,
      terms: data.terms,
    });

    // Append CREATED event (§6.6, P2-T03)
    await recordEvent({
      quotationId: doc._id,
      userId: user.id,
      type: 'CREATED',
      actor: 'OWNER',
    });

    await safeRevalidate('/dashboard/quotations');

    return { ok: true, data: serializeQuotation(doc.toObject()) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('createQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to create quotation' };
  }
}

/**
 * Update an existing quotation.
 * Only DRAFT quotations can be edited (§5.4 — PAID/CANCELLED are terminal).
 * Number is NOT re-assigned on update (§5.3).
 */
export async function updateQuotation(
  id: string,
  input: QuotationInput
): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = quotationSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: 'Validation failed',
        fieldErrors: extractFieldErrors(parseResult.error.issues),
      };
    }

    const data = parseResult.data;

    await dbConnect();

    // Load the existing quotation, scoped by userId (§5.5)
    const existing = await Quotation.findOne({ _id: id, userId: user.id }).lean();
    if (!existing) {
      return { ok: false, error: 'Quotation not found' };
    }

    // Only DRAFT quotations can have their items/totals edited
    if (existing.status !== 'DRAFT') {
      return {
        ok: false,
        error: `Cannot edit a quotation that is ${existing.status.toLowerCase()}. Only draft quotations can be modified.`,
      };
    }

    // Verify customer belongs to this user
    const customer = await Customer.findOne({
      _id: data.customerId,
      userId: user.id,
    }).lean();
    if (!customer) {
      return { ok: false, error: 'Customer not found' };
    }

    // Fetch business
    const business = await Business.findOne({ userId: user.id }).lean();
    if (!business) {
      return { ok: false, error: 'Please set up your business profile first' };
    }

    // Server-side total recomputation (§3.3)
    const totals: ComputedTotals = computeTotals({
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCentavos: item.unitPrice,
      })),
      discountCentavos: data.discount,
    });

    const doc = await Quotation.findOneAndUpdate(
      { _id: id, userId: user.id, status: 'DRAFT' },
      {
        $set: {
          customerId: data.customerId,
          currency: data.currency || existing.currency || 'PHP',
          items: totals.items,
          subtotalCentavos: totals.subtotalCentavos,
          discountCentavos: totals.discountCentavos,
          totalCentavos: totals.totalCentavos,
          issueDate: data.issueDate,
          validUntil: data.validUntil,
          notes: data.notes,
          terms: data.terms,
        },
      },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Quotation not found' };
    }

    await safeRevalidate('/dashboard/quotations');
    await safeRevalidate(`/dashboard/quotations/${id}`);

    return { ok: true, data: serializeQuotation(doc) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('updateQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to update quotation' };
  }
}

/**
 * Fetch a single quotation by ID, scoped by userId.
 */
export async function getQuotation(id: string): Promise<ActionResult<SerializedQuotation | null>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const doc = await Quotation.findOne({ _id: id, userId: user.id }).lean();

    if (!doc) {
      return { ok: true, data: null };
    }

    return { ok: true, data: serializeQuotation(doc) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to load quotation' };
  }
}

/**
 * Fetch all quotations for the current user.
 * Supports filtering by status and search.
 */
export async function getQuotations(options?: {
  status?: string;
  search?: string;
}): Promise<ActionResult<SerializedQuotation[]>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const filter: Record<string, unknown> = { userId: user.id };

    if (options?.status && options.status !== 'ALL') {
      filter.status = options.status;
    }

    if (options?.search?.trim()) {
      const escaped = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { number: { $regex: escaped, $options: 'i' } },
        { notes: { $regex: escaped, $options: 'i' } },
      ];
    }

    const docs = await Quotation.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return {
      ok: true,
      data: docs.map(serializeQuotation),
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getQuotations error:', (error as Error).message);
    return { ok: false, error: 'Failed to load quotations' };
  }
}

/**
 * Transition quotation to SENT status.
 * Snapshots business + customer details on first send (§5.4, §3.9).
 */
export async function sendQuotation(id: string): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    const userDoc = await assertNotSuspended(user.id);

    await dbConnect();

    const doc = await Quotation.findOne({ _id: id, userId: user.id });
    if (!doc) {
      return { ok: false, error: 'Quotation not found' };
    }

    if (doc.status !== 'DRAFT') {
      return { ok: false, error: `Cannot send a quotation that is ${doc.status.toLowerCase()}` };
    }

    // Generate 12-char URL-safe public code (§6.7)
    const { randomBytes } = await import('crypto');
    const publicCode = randomBytes(9).toString('base64url').slice(0, 12);

    // Snapshot business + customer on first SENT (§3.9)
    const customer = await Customer.findOne({
      _id: doc.customerId,
      userId: user.id,
    }).lean();

    const business = await Business.findOne({ userId: user.id }).lean();

    if (!customer || !business) {
      return { ok: false, error: 'Customer or business profile not found' };
    }

    doc.status = 'SENT';
    doc.sentAt = new Date();
    doc.publicCode = publicCode;
    doc.publicToken = publicCode;

    // Only snapshot if not already set (idempotent for re-sends, though status check prevents it)
    if (!doc.customerSnapshot) {
      doc.customerSnapshot = {
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
      };
    }
    if (!doc.businessSnapshot) {
      doc.businessSnapshot = {
        businessName: business.businessName,
        address: business.address || '',
        email: business.email || '',
        phone: business.phone || '',
        logoUrl: business.logoUrl || null,
        currency: doc.currency || business.currency || 'PHP',
      };
    }

    await doc.save();

    // Append SENT event (§6.6, P2-T03)
    await recordEvent({
      quotationId: doc._id,
      userId: user.id,
      type: 'SENT',
      actor: 'OWNER',
    });

    await safeRevalidate('/dashboard/quotations');
    await safeRevalidate(`/dashboard/quotations/${id}`);

    // Step 7: Attempt email delivery to client if snapshot email exists (EMAIL_DELIVERY_PLAN.md §4)
    let emailState: { attempted: boolean; ok: boolean; reason?: string } | null = null;
    try {
      const { deliverQuotationEmail } = await import('@/lib/email/delivery');
      emailState = await deliverQuotationEmail(doc, {
        suspendedAt: userDoc?.suspendedAt,
        publicLinksDisabledAt: userDoc?.publicLinksDisabledAt,
      });
    } catch (deliveryErr) {
      console.error('[actions/quotations] sendQuotation email error:', deliveryErr);
      emailState = { attempted: true, ok: false, reason: 'MAILER_ERROR' };
    }

    const serialized = serializeQuotation(doc.toObject());
    serialized.emailState = emailState;

    return { ok: true, data: serialized };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('sendQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to send quotation' };
  }
}

/**
 * Mark quotation as ACCEPTED.
 */
export async function acceptQuotation(id: string): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const doc = await Quotation.findOneAndUpdate(
      { _id: id, userId: user.id, status: { $in: ['SENT', 'VIEWED'] } },
      { $set: { status: 'ACCEPTED' } },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Quotation not found or not in a sendable state' };
    }

    await safeRevalidate('/dashboard/quotations');
    await safeRevalidate(`/dashboard/quotations/${id}`);

    return { ok: true, data: serializeQuotation(doc) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('acceptQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to accept quotation' };
  }
}

/**
 * Mark quotation as DECLINED.
 */
export async function declineQuotation(id: string): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const doc = await Quotation.findOneAndUpdate(
      { _id: id, userId: user.id, status: { $in: ['SENT', 'VIEWED'] } },
      { $set: { status: 'DECLINED' } },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Quotation not found or not in a sendable state' };
    }

    await safeRevalidate('/dashboard/quotations');
    await safeRevalidate(`/dashboard/quotations/${id}`);

    return { ok: true, data: serializeQuotation(doc) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('declineQuotation error:', (error as Error).message);
    return { ok: false, error: 'Failed to decline quotation' };
  }
}

/**
 * Track when a quotation is viewed via its public link (§6.4, P3-T03).
 * First public render sets viewedAt, moves SENT → VIEWED, appends one VIEWED event.
 * Guards:
 * - Owner previewing their own link does not count.
 * - Second view appends nothing.
 * - Already responded (ACCEPTED/DECLINED) does not regress to VIEWED.
 */
export async function recordQuotationView(
  code: string,
  viewerUserId?: string | null
): Promise<boolean> {
  try {
    if (!code) return false;

    await dbConnect();

    // Check existing quotation
    const existing = await Quotation.findOne({
      $or: [{ publicCode: code }, { publicToken: code }],
    })
      .select('_id userId status viewedAt publicCodeRevokedAt publicTokenRevokedAt')
      .lean();

    if (!existing) return false;

    // Do not track if link revoked
    if (existing.publicCodeRevokedAt || existing.publicTokenRevokedAt) {
      return false;
    }

    // Guard: owner previewing their own link does not count (§6.4, P3-T03)
    if (viewerUserId && existing.userId.toString() === viewerUserId) {
      return false;
    }

    // If already viewed or already answered (ACCEPTED/DECLINED), do not update
    if (existing.viewedAt || existing.status !== 'SENT') {
      return false;
    }

    const now = new Date();

    // Atomic state transition SENT -> VIEWED
    const updated = await Quotation.findOneAndUpdate(
      {
        _id: existing._id,
        status: 'SENT',
        viewedAt: null,
      },
      {
        $set: {
          status: 'VIEWED',
          viewedAt: now,
        },
      },
      { returnDocument: 'after', lean: true }
    );

    if (!updated) {
      return false;
    }

    // Append append-only VIEWED event (§6.6, P3-T03)
    await recordEvent({
      quotationId: updated._id,
      userId: updated.userId,
      type: 'VIEWED',
      actor: 'CLIENT',
    });

    await safeRevalidate(`/dashboard/quotations/${existing._id}`);
    await safeRevalidate('/dashboard/quotations');

    return true;
  } catch (error) {
    console.error('recordQuotationView error:', error);
    return false;
  }
}

/**
 * Mark an ACCEPTED quotation as paid or clear payment status (§6.8, P4-T04).
 * Strictly scoped by session userId.
 * Toggling on sets paidAt + paidAmountCentavos (defaulting to totalCentavos) and records MARKED_PAID.
 * Toggling off clears both fields and records UNMARKED_PAID.
 * No invoice, receipt, or numbering is generated.
 */
export async function markQuotationPaid(
  id: string,
  input: MarkPaidInput
): Promise<ActionResult<SerializedQuotation>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = markPaidInputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: 'Validation failed',
        fieldErrors: extractFieldErrors(parseResult.error.issues),
      };
    }

    const { paid, amount } = parseResult.data;

    await dbConnect();

    // Strictly scoped by userId from session (AGENTS.md §4.1)
    const quote = await Quotation.findOne({ _id: id, userId: user.id });
    if (!quote) {
      return { ok: false, error: 'Quotation not found' };
    }

    // Only accepted quotations can be marked as paid (§6.8)
    if (quote.status !== 'ACCEPTED') {
      return {
        ok: false,
        error: 'Only accepted quotations can be marked as paid',
      };
    }

    if (paid) {
      const paidAmountCentavos = amount !== undefined ? amount : quote.totalCentavos;
      quote.paidAt = new Date();
      quote.paidAmountCentavos = paidAmountCentavos;
      await quote.save();

      // Record append-only event (§6.6, §6.8)
      await recordEvent({
        quotationId: quote._id,
        userId: user.id,
        type: 'MARKED_PAID',
        actor: 'OWNER',
        metadata: { paidAmountCentavos },
      });
    } else {
      quote.paidAt = null;
      quote.paidAmountCentavos = null;
      await quote.save();

      // Record append-only event (§6.6, §6.8)
      await recordEvent({
        quotationId: quote._id,
        userId: user.id,
        type: 'UNMARKED_PAID',
        actor: 'OWNER',
      });
    }

    await safeRevalidate(`/dashboard/quotations/${id}`);
    await safeRevalidate('/dashboard/quotations');
    await safeRevalidate('/dashboard');
    if (quote.customerId) {
      await safeRevalidate(`/dashboard/clients/${quote.customerId}`);
    }

    return { ok: true, data: serializeQuotation(quote.toObject()) };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('markQuotationPaid error:', (error as Error).message);
    return { ok: false, error: 'Failed to update payment status' };
  }
}

