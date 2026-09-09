'use server';

import dbConnect from '../lib/mongodb.ts';
import { Customer } from '../models/customer.ts';
import { Quotation } from '../models/quotation.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import { customerSchema, type CustomerInput } from '../lib/validation/customer.ts';
import type { ActionResult } from '../types/index.ts';

export interface SerializedCustomer {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientQuotationSummary {
  id: string;
  number: string;
  status: string;
  totalCentavos: number;
  subtotalCentavos: number;
  discountCentavos: number;
  issueDate: string;
  validUntil: string;
  createdAt: string;
}

import { computeClientQuotationStats, type ClientQuotationStats } from '../lib/clients.ts';
export type { ClientQuotationStats };

export interface ClientWithHistory {
  client: SerializedCustomer;
  quotations: ClientQuotationSummary[];
  stats: ClientQuotationStats;
}

async function safeRevalidate(path: string) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // Ignore outside Next runtime (e.g. tests)
  }
}

/**
 * Fetch customers for the current authenticated user (AGENTS.md §3.1).
 * Hidden archived by default unless includeArchived is set to true.
 */
export async function getCustomers(options?: {
  search?: string;
  includeArchived?: boolean;
}): Promise<ActionResult<SerializedCustomer[]>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const filter: Record<string, unknown> = {
      userId: user.id,
    };

    if (!options?.includeArchived) {
      filter.archived = false;
    }

    if (options?.search && options.search.trim()) {
      const escaped = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const docs = await Customer.find(filter).sort({ name: 1 }).lean();

    const data: SerializedCustomer[] = docs.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      name: doc.name,
      email: doc.email || '',
      phone: doc.phone || '',
      address: doc.address || '',
      notes: doc.notes || '',
      archived: Boolean(doc.archived),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return { ok: true, data };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getCustomers error:', (error as Error).message);
    return { ok: false, error: 'Failed to load customers' };
  }
}

/**
 * Fetch a single customer by ID, strictly scoped by session userId.
 */
export async function getCustomer(id: string): Promise<ActionResult<SerializedCustomer | null>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const doc = await Customer.findOne({ _id: id, userId: user.id }).lean();

    if (!doc) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        email: doc.email || '',
        phone: doc.phone || '',
        address: doc.address || '',
        notes: doc.notes || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getCustomer error:', (error as Error).message);
    return { ok: false, error: 'Failed to load customer' };
  }
}

/**
 * Create a new customer for the authenticated user.
 */
export async function createCustomer(
  input: CustomerInput
): Promise<ActionResult<SerializedCustomer>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = customerSchema.safeParse(input);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0];
        if (field && typeof field === 'string' && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return { ok: false, error: 'Validation failed', fieldErrors };
    }

    const data = parseResult.data;

    await dbConnect();
    const doc = await Customer.create({
      userId: user.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      archived: Boolean(data.archived),
    });

    await safeRevalidate('/dashboard/clients');
    await safeRevalidate('/dashboard/customers');

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        email: doc.email || '',
        phone: doc.phone || '',
        address: doc.address || '',
        notes: doc.notes || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('createCustomer error:', (error as Error).message);
    return { ok: false, error: 'Failed to create customer' };
  }
}

/**
 * Update an existing customer, strictly scoped by session userId.
 */
export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<ActionResult<SerializedCustomer>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = customerSchema.safeParse(input);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0];
        if (field && typeof field === 'string' && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return { ok: false, error: 'Validation failed', fieldErrors };
    }

    const data = parseResult.data;

    await dbConnect();
    const doc = await Customer.findOneAndUpdate(
      { _id: id, userId: user.id },
      {
        $set: {
          name: data.name,
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          notes: data.notes || '',
          ...(data.archived !== undefined ? { archived: data.archived } : {}),
        },
      },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Customer not found' };
    }

    await safeRevalidate('/dashboard/clients');
    await safeRevalidate(`/dashboard/clients/${id}`);
    await safeRevalidate('/dashboard/customers');
    await safeRevalidate(`/dashboard/customers/${id}`);

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        email: doc.email || '',
        phone: doc.phone || '',
        address: doc.address || '',
        notes: doc.notes || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('updateCustomer error:', (error as Error).message);
    return { ok: false, error: 'Failed to update customer' };
  }
}

/**
 * Archive or unarchive a customer. Never hard-deletes (AGENTS.md §4).
 */
export async function archiveCustomer(
  id: string,
  archived: boolean = true
): Promise<ActionResult<SerializedCustomer>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();

    const doc = await Customer.findOneAndUpdate(
      { _id: id, userId: user.id },
      { $set: { archived } },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Customer not found' };
    }

    await safeRevalidate('/dashboard/clients');
    await safeRevalidate(`/dashboard/clients/${id}`);
    await safeRevalidate('/dashboard/customers');

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        email: doc.email || '',
        phone: doc.phone || '',
        address: doc.address || '',
        notes: doc.notes || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('archiveCustomer error:', (error as Error).message);
    return { ok: false, error: 'Failed to archive customer' };
  }
}

/**
 * Fetch a single client and their quotation history, strictly scoped by session userId (AGENTS.md §4.1).
 */
export async function getClientWithHistory(
  id: string
): Promise<ActionResult<ClientWithHistory | null>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const clientDoc = await Customer.findOne({ _id: id, userId: user.id }).lean();

    if (!clientDoc) {
      return { ok: true, data: null };
    }

    // Double-scoped by customerId AND userId per AGENTS.md §4.1
    const quoteDocs = await Quotation.find({
      customerId: id,
      userId: user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const client: SerializedCustomer = {
      id: clientDoc._id.toString(),
      userId: clientDoc.userId.toString(),
      name: clientDoc.name,
      email: clientDoc.email || '',
      phone: clientDoc.phone || '',
      address: clientDoc.address || '',
      notes: clientDoc.notes || '',
      archived: Boolean(clientDoc.archived),
      createdAt: clientDoc.createdAt ? new Date(clientDoc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: clientDoc.updatedAt ? new Date(clientDoc.updatedAt).toISOString() : new Date().toISOString(),
    };

    const quotations: ClientQuotationSummary[] = quoteDocs.map((doc) => ({
      id: doc._id.toString(),
      number: doc.number,
      status: doc.status,
      totalCentavos: doc.totalCentavos,
      subtotalCentavos: doc.subtotalCentavos,
      discountCentavos: doc.discountCentavos || 0,
      issueDate: doc.issueDate ? new Date(doc.issueDate).toISOString() : new Date().toISOString(),
      validUntil: doc.validUntil ? new Date(doc.validUntil).toISOString() : new Date().toISOString(),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    }));

    const stats = computeClientQuotationStats(quotations);

    return {
      ok: true,
      data: {
        client,
        quotations,
        stats,
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getClientWithHistory error:', (error as Error).message);
    return { ok: false, error: 'Failed to load client details' };
  }
}

