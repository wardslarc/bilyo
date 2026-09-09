import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { QUOTATION_FOOTER } from '../lib/documents.ts';

describe('PDF and Print View (§2.3, §12 P4-T05)', () => {
  it('ensures the required quotation footer constant exists and matches specification', () => {
    assert.strictEqual(
      QUOTATION_FOOTER,
      'This is a quotation, not a tax document. It is not an invoice or official receipt.'
    );
  });

  it('ensures QuotationDocument passes QUOTATION_FOOTER as the disclaimer', () => {
    const quoteDocSource = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/pdf/quotation-document.tsx'),
      'utf-8'
    );

    assert.match(quoteDocSource, /disclaimer=\{QUOTATION_FOOTER\}/);
    assert.match(quoteDocSource, /documentTitle="QUOTATION"/);
    assert.match(quoteDocSource, /secondaryDateLabel="Valid Until"/);
  });

  it('ensures PDF layout adheres to A4 size and renders essential blocks', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/pdf/shared/document-layout.tsx'),
      'utf-8'
    );

    // A4 page size
    assert.match(layoutSource, /size="A4"/);
    // Header with title and number
    assert.match(layoutSource, /<DocumentHeader/);
    // Info section with Prepared For and Details
    assert.match(layoutSource, /<DocumentInfoSection/);
    // Items table
    assert.match(layoutSource, /<DocumentItemsTable/);
    // Totals block
    assert.match(layoutSource, /<DocumentTotalsBlock/);
    // Notes and terms
    assert.match(layoutSource, /<DocumentNotesAndTerms/);
    // Fixed footer with disclaimer
    assert.match(layoutSource, /<DocumentFooter/);
  });

  it('ensures totals block has NO VAT row (AGENTS.md §3, §4.3)', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/pdf/shared/document-layout.tsx'),
      'utf-8'
    );

    // Verify totals rows only compute Subtotal, Discount, Total
    assert.doesNotMatch(layoutSource, /\bVAT\b/i);
    assert.doesNotMatch(layoutSource, /\bTax\b/i);
    assert.doesNotMatch(layoutSource, /\bTIN\b/i);
  });

  it('ensures no word "invoice" appears anywhere in lib/pdf except within the negative disclaimer', () => {
    const files = [
      'lib/pdf/quotation-document.tsx',
      'lib/pdf/shared/document-layout.tsx',
      'lib/pdf/shared/styles.ts',
      'lib/pdf/shared/index.ts',
    ];

    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        // Strip comment lines
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          continue;
        }
        // If line contains disclaimer, that is the required negative statement
        if (line.includes('QUOTATION_FOOTER') || line.includes('disclaimer')) {
          continue;
        }
        assert.doesNotMatch(
          line,
          /\binvoice(s)?\b/i,
          `Found forbidden word "invoice" in ${rel}: ${line}`
        );
      }
    }
  });

  it('ensures /api/quotations/[id]/pdf is strictly userId-scoped', () => {
    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'app/api/quotations/[id]/pdf/route.ts'),
      'utf-8'
    );

    assert.match(
      routeSource,
      /Quotation\.findOne\(\{\s*_id:\s*id,\s*userId:\s*user\.id\s*\}\)/
    );
  });

  it('ensures /api/public/q/[code]/pdf is code-scoped and returns 404 if quotation not found or revoked', () => {
    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), 'app/api/public/q/[code]/pdf/route.ts'),
      'utf-8'
    );

    // Calls getPublicQuotationByCode
    assert.match(routeSource, /getPublicQuotationByCode\(code\)/);
    // Returns 404 when null
    assert.match(routeSource, /if\s*\(!doc\)\s*\{\s*return new Response\('Not Found',\s*\{\s*status:\s*404\s*\}\);/);

    // Verify getPublicQuotationByCode checks revocation
    const projectionSource = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/public-projection.ts'),
      'utf-8'
    );
    assert.match(
      projectionSource,
      /quotation\.publicCodeRevokedAt\s*\|\|\s*quotation\.publicTokenRevokedAt/
    );
  });
});
