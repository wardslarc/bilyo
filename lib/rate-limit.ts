import dbConnect from './mongodb.ts';
import { RateLimit } from '../models/rate-limit.ts';

export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import('next/headers');
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    if (forwardedFor) {
      const first = forwardedFor.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = headerList.get('x-real-ip');
    if (realIp?.trim()) return realIp.trim();
  } catch {
    // Outside request context (e.g. background job or test runner)
  }
  return '127.0.0.1';
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  errorMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetSeconds: number;
  error?: string;
}

/**
 * Distributed rate limiter backed by MongoDB TTL collection.
 * Uses atomic findOneAndUpdate with time bucket to guarantee consistency across serverless instances.
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const windowMs = options.windowSeconds * 1000;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const bucketKey = `${options.key}:${bucket}`;
  const expiresAt = new Date(now + windowMs * 2);

  await dbConnect();

  const record = await RateLimit.findOneAndUpdate(
    { key: bucketKey },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const count = record ? record.count : 1;
  const allowed = count <= options.limit;
  const remaining = Math.max(0, options.limit - count);
  const resetSeconds = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
  const error = allowed
    ? undefined
    : options.errorMessage ||
      `Too many requests. Please try again in ${resetSeconds} second(s).`;

  return {
    allowed,
    count,
    remaining,
    resetSeconds,
    error,
  };
}

/**
 * Enforces multiple rate limits in sequence (e.g. per-IP and per-email).
 * Returns the first limit failure or { allowed: true }.
 */
export async function enforceRateLimits(
  limits: RateLimitOptions[]
): Promise<{ allowed: boolean; error?: string }> {
  for (const limit of limits) {
    const result = await checkRateLimit(limit);
    if (!result.allowed) {
      return {
        allowed: false,
        error: result.error,
      };
    }
  }
  return { allowed: true };
}
