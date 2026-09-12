/**
 * Recipient-list parsing for operator alerts. Pure, no I/O, no DB — the whole
 * module is safe to import from a unit test.
 */

/**
 * Parses a comma-separated allowlist (the shape of ADMIN_EMAILS) into a clean
 * list of addresses: trimmed, lowercased, blanks dropped, duplicates removed.
 * Order follows the env var, so the first address listed is mailed first.
 */
export function parseAdminEmails(raw?: string | null): string[] {
  const seen = new Set<string>();

  for (const entry of (raw || '').split(',')) {
    const address = entry.trim().toLowerCase();
    if (address) seen.add(address);
  }

  return [...seen];
}
