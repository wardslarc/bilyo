'use client';

import React, { useEffect } from 'react';

/**
 * Root-level safety net.
 *
 * Errors thrown in the root layout — or any error that escapes every nested
 * error boundary — are handled here. Without this file Next.js falls back to its
 * built-in handler, which in production renders a bare, effectively blank page:
 * the "white screen" with no way to tell what failed.
 *
 * global-error replaces the whole document, so it must render <html> and <body>
 * and cannot rely on the app's fonts or Tailwind theme tokens.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught error:', error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#fbfaf7',
          color: '#17202e',
          fontFamily:
            '"Helvetica Neue", Helvetica, Arial, system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e7e2d9',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#5c6779', margin: '0 0 20px' }}>
            Bilyo could not finish loading this page. Your data is safe — nothing was
            saved or lost.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#ffffff',
                background: '#c08a2e',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#17202e',
                background: '#f4f1ea',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              Go to dashboard
            </a>
          </div>

          {error.digest && (
            <p style={{ fontSize: '11px', color: '#8a93a3', margin: '20px 0 0' }}>
              Reference code: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
