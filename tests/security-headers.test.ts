import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.ts';

describe('Security Headers (next.config.ts)', () => {
  test('defines security headers on all routes (/:path*)', async () => {
    assert.ok(typeof nextConfig.headers === 'function', 'nextConfig.headers should be a function');
    const headerConfigs = await nextConfig.headers();
    assert.ok(Array.isArray(headerConfigs), 'headers() should return an array');
    assert.equal(headerConfigs.length, 1);

    const config = headerConfigs[0];
    assert.equal(config.source, '/:path*');

    const headersMap = new Map(config.headers.map((h: { key: string; value: string }) => [h.key, h.value]));

    // 1. Frame protection against clickjacking
    assert.equal(headersMap.get('X-Frame-Options'), 'DENY');
    const csp = headersMap.get('Content-Security-Policy');
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP must include frame-ancestors none');

    // 2. Transport & MIME security
    assert.equal(headersMap.get('Strict-Transport-Security'), 'max-age=63072000; includeSubDomains; preload');
    assert.equal(headersMap.get('X-Content-Type-Options'), 'nosniff');

    // 3. Privacy & permissions
    assert.equal(headersMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.ok(headersMap.get('Permissions-Policy')?.includes('camera=()'));
    assert.equal(headersMap.get('X-DNS-Prefetch-Control'), 'on');
  });
});
