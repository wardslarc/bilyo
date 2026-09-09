import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { computeClientQuotationStats } from '../lib/clients.ts';

describe('Client Quote History and Statistics', () => {
  it('computes quotation statistics correctly with empty list', () => {
    const stats = computeClientQuotationStats([]);
    assert.strictEqual(stats.quotationCount, 0);
    assert.strictEqual(stats.acceptedCount, 0);
    assert.strictEqual(stats.totalQuotedCentavos, 0);
    assert.strictEqual(stats.totalAcceptedCentavos, 0);
  });

  it('computes total quoted and total accepted centavos accurately', () => {
    const mockQuotes = [
      { status: 'DRAFT', totalCentavos: 100000 },
      { status: 'SENT', totalCentavos: 250000 },
      { status: 'VIEWED', totalCentavos: 150000 },
      { status: 'ACCEPTED', totalCentavos: 500000 },
      { status: 'DECLINED', totalCentavos: 200000 },
      { status: 'ACCEPTED', totalCentavos: 300000 },
    ];

    const stats = computeClientQuotationStats(mockQuotes);
    assert.strictEqual(stats.quotationCount, 6);
    assert.strictEqual(stats.acceptedCount, 2);
    // Total quoted: 100k + 250k + 150k + 500k + 200k + 300k = 1,500,000 centavos (₱15,000.00)
    assert.strictEqual(stats.totalQuotedCentavos, 1500000);
    // Total accepted: 500k + 300k = 800,000 centavos (₱8,000.00)
    assert.strictEqual(stats.totalAcceptedCentavos, 800000);
  });

  it('ensures getClientWithHistory queries are strictly userId-scoped and customerId-scoped', () => {
    // Inspect source of actions/customers.ts to confirm double scoping per AGENTS.md §4.1
    const fileContent = fs.readFileSync(
      path.resolve(process.cwd(), 'actions/customers.ts'),
      'utf-8'
    );

    // Verify findOne on Customer is scoped by userId
    assert.match(
      fileContent,
      /Customer\.findOne\(\{\s*_id:\s*id,\s*userId:\s*user\.id\s*\}\)/
    );

    // Verify Quotation.find is scoped by both customerId AND userId
    assert.match(
      fileContent,
      /Quotation\.find\(\{\s*customerId:\s*id,\s*userId:\s*user\.id,?\s*\}\)/
    );
  });

  it('ensures /dashboard/customers redirects to /dashboard/clients', () => {
    const customersPage = fs.readFileSync(
      path.resolve(process.cwd(), 'app/(dashboard)/dashboard/customers/page.tsx'),
      'utf-8'
    );
    assert.match(customersPage, /redirect\(['"]\/dashboard\/clients['"]\)/);
  });

  it('ensures no user-visible string says "customer" in ClientList or ClientForm', () => {
    const files = [
      'components/dashboard/ClientList.tsx',
      'components/dashboard/ClientForm.tsx',
      'app/(dashboard)/dashboard/clients/page.tsx',
      'app/(dashboard)/dashboard/clients/new/page.tsx',
      'app/(dashboard)/dashboard/clients/[id]/page.tsx',
      'app/(dashboard)/dashboard/clients/[id]/edit/page.tsx',
    ];

    for (const relPath of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        // Skip comment lines and import lines
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) {
          continue;
        }

        // Check JSX visible text between tags on the same line
        const textMatches = line.match(/>([^<]+)</g);
        if (textMatches) {
          for (const match of textMatches) {
            // Strip code expressions like {client.id} or {isPending ? ...}
            const cleanText = match.replace(/\{[^}]*\}/g, '');
            assert.doesNotMatch(cleanText, /\bcustomer(s)?\b/i, `Found customer in visible text in ${relPath}: ${line}`);
          }
        }

        // Check placeholders
        const placeholderMatch = line.match(/placeholder="([^"]+)"/);
        if (placeholderMatch && placeholderMatch[1]) {
          assert.doesNotMatch(placeholderMatch[1], /\bcustomer(s)?\b/i, `Found customer in placeholder in ${relPath}: ${line}`);
        }
      }
    }
  });
});
