import dbConnect from './mongodb.ts';
import { DonationSetting } from '../models/donation-setting.ts';

export const DONATION_SETTING_KEY = 'DONATION' as const;

export interface DonationState {
  /** True only when a QR has been uploaded AND the ask has been switched on. */
  enabled: boolean;
  /** Null whenever `enabled` is false, so a disabled QR is never rendered. */
  qrUrl: string | null;
}

/**
 * Public read of the donation state (AGENTS.md §4.9).
 *
 * Collapses every half-configured shape — no document, no QR, QR uploaded but
 * the ask switched off — into one boolean, so callers never have to reason
 * about the difference. `qrUrl` is withheld unless the ask is live, so a QR
 * staged but not yet enabled cannot leak through a public page.
 *
 * Safe to call from an unauthenticated surface: the document holds no user
 * data, and nothing here is scoped to a session.
 */
export async function getDonationState(): Promise<DonationState> {
  try {
    await dbConnect();
    const doc = await DonationSetting.findOne({
      key: DONATION_SETTING_KEY,
    }).lean();

    const qrUrl = doc?.qrUrl || null;
    const enabled = Boolean(qrUrl && doc?.enabledAt);

    return { enabled, qrUrl: enabled ? qrUrl : null };
  } catch (error) {
    // The donation ask is decoration, never load-bearing: a database hiccup
    // must not take the footer — and therefore every marketing page — down.
    console.error('[lib/donation] Failed to read donation state:', (error as Error).message);
    return { enabled: false, qrUrl: null };
  }
}
