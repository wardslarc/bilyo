import { requireAdmin } from './guard.ts';
import dbConnect from '../mongodb.ts';
import { DonationSetting } from '../../models/donation-setting.ts';
import { DONATION_SETTING_KEY } from '../donation.ts';

export interface AdminDonationSetting {
  /** Present even when the ask is switched off, so admin can preview it. */
  qrUrl: string | null;
  qrUploadedAt: Date | null;
  enabledAt: Date | null;
}

/**
 * Admin-side read of the donation setting (AGENTS.md §4.9).
 *
 * Unlike `getDonationState`, this returns the QR URL even while the ask is
 * switched off — that is the whole point of the admin view, which is where a
 * staged QR gets checked before going live. Guarded by `requireAdmin()`, which
 * throws ADMIN_NOT_FOUND so a non-admin sees a 404.
 *
 * This is a read of platform content, not a cross-user read: the document is
 * a single row that belongs to nobody.
 */
export async function getAdminDonationSetting(): Promise<AdminDonationSetting> {
  await requireAdmin();
  await dbConnect();

  const doc = await DonationSetting.findOne({
    key: DONATION_SETTING_KEY,
  }).lean();

  return {
    qrUrl: doc?.qrUrl || null,
    qrUploadedAt: doc?.qrUploadedAt || null,
    enabledAt: doc?.enabledAt || null,
  };
}
