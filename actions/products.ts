'use server';

import dbConnect from '../lib/mongodb.ts';
import { Product } from '../models/product.ts';
import { requireUser, assertNotSuspended, AuthGuardError } from '../lib/auth-guards.ts';
import { productSchema, type ProductInput } from '../lib/validation/product.ts';
import type { ActionResult } from '../types/index.ts';

export interface SerializedProduct {
  id: string;
  userId: string;
  name: string;
  description: string;
  unitPriceCentavos: number;
  unit: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
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
 * Fetch products for the current authenticated user (AGENTS.md §3.1).
 * Hidden archived by default unless includeArchived is set to true.
 */
export async function getProducts(options?: {
  search?: string;
  includeArchived?: boolean;
}): Promise<ActionResult<SerializedProduct[]>> {
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
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const docs = await Product.find(filter).sort({ name: 1 }).lean();

    const data: SerializedProduct[] = docs.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      name: doc.name,
      description: doc.description || '',
      unitPriceCentavos: doc.unitPriceCentavos,
      unit: doc.unit || '',
      archived: Boolean(doc.archived),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return { ok: true, data };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getProducts error:', (error as Error).message);
    return { ok: false, error: 'Failed to load products' };
  }
}

/**
 * Fetch a single product by ID, strictly scoped by session userId.
 */
export async function getProduct(id: string): Promise<ActionResult<SerializedProduct | null>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const doc = await Product.findOne({ _id: id, userId: user.id }).lean();

    if (!doc) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        description: doc.description || '',
        unitPriceCentavos: doc.unitPriceCentavos,
        unit: doc.unit || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('getProduct error:', (error as Error).message);
    return { ok: false, error: 'Failed to load product' };
  }
}

/**
 * Create a new product or service item for the authenticated user.
 * Price is typed in pesos and stored in integer centavos (AGENTS.md §3.2, M2-T04).
 */
export async function createProduct(
  input: ProductInput
): Promise<ActionResult<SerializedProduct>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = productSchema.safeParse(input);
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
    const doc = await Product.create({
      userId: user.id,
      name: data.name,
      description: data.description || '',
      unitPriceCentavos: data.unitPrice, // Already converted to integer centavos by schema
      unit: data.unit || '',
      archived: Boolean(data.archived),
    });

    await safeRevalidate('/dashboard/products');

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        description: doc.description || '',
        unitPriceCentavos: doc.unitPriceCentavos,
        unit: doc.unit || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('createProduct error:', (error as Error).message);
    return { ok: false, error: 'Failed to create product' };
  }
}

/**
 * Update an existing product, strictly scoped by session userId.
 */
export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult<SerializedProduct>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    const parseResult = productSchema.safeParse(input);
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
    const doc = await Product.findOneAndUpdate(
      { _id: id, userId: user.id },
      {
        $set: {
          name: data.name,
          description: data.description || '',
          unitPriceCentavos: data.unitPrice,
          unit: data.unit || '',
          ...(data.archived !== undefined ? { archived: data.archived } : {}),
        },
      },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Product not found' };
    }

    await safeRevalidate('/dashboard/products');
    await safeRevalidate(`/dashboard/products/${id}`);

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        description: doc.description || '',
        unitPriceCentavos: doc.unitPriceCentavos,
        unit: doc.unit || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('updateProduct error:', (error as Error).message);
    return { ok: false, error: 'Failed to update product' };
  }
}

/**
 * Archive or unarchive a product. Never hard-deletes (AGENTS.md §4).
 */
export async function archiveProduct(
  id: string,
  archived: boolean = true
): Promise<ActionResult<SerializedProduct>> {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);

    await dbConnect();
    const doc = await Product.findOneAndUpdate(
      { _id: id, userId: user.id },
      { $set: { archived } },
      { returnDocument: 'after', lean: true }
    );

    if (!doc) {
      return { ok: false, error: 'Product not found' };
    }

    await safeRevalidate('/dashboard/products');

    return {
      ok: true,
      data: {
        id: doc._id.toString(),
        userId: doc.userId.toString(),
        name: doc.name,
        description: doc.description || '',
        unitPriceCentavos: doc.unitPriceCentavos,
        unit: doc.unit || '',
        archived: Boolean(doc.archived),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: error.message };
    }
    console.error('archiveProduct error:', (error as Error).message);
    return { ok: false, error: 'Failed to archive product' };
  }
}
