import dns, { promises as dnsPromises } from 'node:dns';

export type MxVerdict = 'HAS_MX' | 'NO_MX' | 'UNKNOWN';

interface CacheEntry {
  verdict: MxVerdict;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESOLVER_TIMEOUT_MS = 2000; // 2 seconds

// Module-level in-memory cache (SIGNUP_VERIFICATION_PLAN.md §4.2 rule 2)
const mxCache = new Map<string, CacheEntry>();

/**
 * Configure reliable DNS servers if c-ares defaults only to loopback (common in Windows dev environments).
 */
function ensureDnsConfigured(): void {
  try {
    const servers = dns.getServers();
    if (!servers || servers.length === 0 || servers.every((s) => s === '127.0.0.1' || s === '::1')) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    }
  } catch {
    // Non-fatal if setting DNS servers fails
  }
}

/**
 * Executes a promise with a maximum timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('DNS resolution timed out');
      (err as { code?: string }).code = 'ETIMEDOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

function isNxDomain(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'ENOTFOUND' || code === 'NXDOMAIN';
}

function extractDomain(emailOrDomain: string): string {
  const trimmed = emailOrDomain.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed.split('@').pop() || '' : trimmed;
}

/**
 * Clears the in-memory MX cache. Primarily for testing.
 */
export function clearMxCache(): void {
  mxCache.clear();
}

/**
 * Checks whether a domain or email address accepts mail via MX or A records (Gate 3).
 *
 * Rules:
 * 1. Fail open on UNKNOWN (timeouts, transient resolver failure) so valid signups are never blocked.
 * 2. Caches verdicts in memory for 24 hours.
 * 3. Never SMTP-probes.
 */
export async function domainAcceptsMail(emailOrDomain: string): Promise<MxVerdict> {
  const domain = extractDomain(emailOrDomain);

  if (!domain || !domain.includes('.')) {
    return 'NO_MX';
  }

  // Check cache
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.verdict;
  }

  ensureDnsConfigured();

  try {
    // 1. Check MX records
    try {
      const mxRecords = await withTimeout(dnsPromises.resolveMx(domain), RESOLVER_TIMEOUT_MS);
      if (Array.isArray(mxRecords) && mxRecords.length > 0) {
        mxCache.set(domain, { verdict: 'HAS_MX', expiresAt: Date.now() + CACHE_TTL_MS });
        return 'HAS_MX';
      }
    } catch (mxErr) {
      if (isNxDomain(mxErr)) {
        // Domain does not exist at all in DNS
        mxCache.set(domain, { verdict: 'NO_MX', expiresAt: Date.now() + CACHE_TTL_MS });
        return 'NO_MX';
      }

      const code = (mxErr as { code?: string })?.code;
      // If code is ENODATA (domain exists but has no MX record), continue to A record check (RFC 5321 §5.1)
      if (code !== 'ENODATA') {
        // Unknown resolver failure or timeout
        return 'UNKNOWN';
      }
    }

    // 2. RFC 5321 §5.1: an A record is an implicit MX fallback
    try {
      const aRecords = await withTimeout(dnsPromises.resolve4(domain), RESOLVER_TIMEOUT_MS);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        mxCache.set(domain, { verdict: 'HAS_MX', expiresAt: Date.now() + CACHE_TTL_MS });
        return 'HAS_MX';
      }
    } catch (aErr) {
      if (isNxDomain(aErr) || (aErr as { code?: string })?.code === 'ENODATA') {
        mxCache.set(domain, { verdict: 'NO_MX', expiresAt: Date.now() + CACHE_TTL_MS });
        return 'NO_MX';
      }
      return 'UNKNOWN';
    }

    mxCache.set(domain, { verdict: 'NO_MX', expiresAt: Date.now() + CACHE_TTL_MS });
    return 'NO_MX';
  } catch {
    // Fallback fail-open
    return 'UNKNOWN';
  }
}
