'use server';

import { revalidatePath } from 'next/cache';
import dbConnect from '../../lib/mongodb.ts';
import { DonationSetting } from '../../models/donation-setting.ts';
import { requireAdmin } from '../../lib/admin/guard.ts';
import { recordAudit } from '../../lib/admin/audit.ts';
import { DONATION_SETTING_KEY } from '../../lib/donation.ts';
import { donationToggleSchema } from '../../lib/validation/donation.ts';
import {
  validateImageBuffer,
  uploadDonationQr as putDonationQr,
  deleteDonationQr,
  MAX_LOGO_SIZE_BYTES,
} from '../../lib/blob.ts';
import type { ActionResult } from '@/types';

/**
 * Every public surface that renders the donation ask sits under the marketing
 * layout's footer, so a change has to bust the whole tree, not one route.
 */
function revalidateDonationSurfaces(): void {
  revalidatePath('/admin/donations');
  revalidatePath('/support');
  revalidatePath('/', 'layout');
}

/**
 * Replace the donation QR image (AGENTS.md §4.9).
 *
 * Platform content, so nothing a user owns is touched. Same validation as the
 * business logo: 2MB cap, genuine PNG/JPEG/WebP magic bytes, renamed
 * executables rejected. The previous image is deleted only after the new one
 * has been stored, so a failed upload never leaves the page with no QR.
 *
 * Uploading does NOT switch the ask on — that is `setDonationAsk`, deliberately
 * separate so a QR can be checked before anyone sees it.
 */
export async function saveDonationQr(
  formData: FormData
): Promise<ActionResult<{ qrUrl: string }>> {
  try {
    const admin = await requireAdmin();

    const fileEntry = formData.get('file');
    if (!fileEntry || !(fileEntry instanceof File) || fileEntry.size === 0) {
      return { ok: false, error: 'No image file was provided.' };
    }

    if (fileEntry.size > MAX_LOGO_SIZE_BYTES) {
      return {
        ok: false,
        error: `Image exceeds the 2MB limit (received ${(fileEntry.size / (1024 * 1024)).toFixed(2)}MB).`,
      };
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());

    const validation = validateImageBuffer(buffer, fileEntry.type, fileEntry.size);
    if (!validation.ok || !validation.mimeType || !validation.extension) {
      return {
        ok: false,
        error:
          validation.error ||
          'Invalid image file. Only genuine PNG, JPEG, and WebP images are allowed.',
      };
    }

    await dbConnect();

    const existing = await DonationSetting.findOne({
      key: DONATION_SETTING_KEY,
    }).lean();
    const oldQrUrl = existing?.qrUrl || null;

    const qrUrl = await putDonationQr(
      buffer,
      validation.mimeType,
      validation.extension
    );
    const qrUploadedAt = new Date();

    await DonationSetting.findOneAndUpdate(
      { key: DONATION_SETTING_KEY },
      { $set: { qrUrl, qrUploadedAt, updatedByUserId: admin.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (oldQrUrl && oldQrUrl !== qrUrl) {
      await deleteDonationQr(oldQrUrl);
    }

    await recordAudit({
      action: 'DONATION_QR_SET',
      targetType: 'DonationSetting',
      targetId: DONATION_SETTING_KEY,
      before: { qrUrl: oldQrUrl },
      after: { qrUrl, qrUploadedAt },
    });

    revalidateDonationSurfaces();

    return { ok: true, data: { qrUrl } };
  } catch (error) {
    if ((error as { code?: string }).code === 'ADMIN_NOT_FOUND') throw error;
    console.error('[actions/admin/donation] saveDonationQr:', (error as Error).message);
    return { ok: false, error: 'Failed to save the donation QR image.' };
  }
}

/**
 * Remove the donation QR and switch the ask off in the same write
 * (AGENTS.md §4.9).
 *
 * Clearing the image without clearing `enabledAt` would leave the setting
 * claiming to be live with nothing to show, so the two move together here.
 */
export async function clearDonationQr(): Promise<ActionResult<null>> {
  try {
    const admin = await requireAdmin();
    await dbConnect();

    const existing = await DonationSetting.findOne({
      key: DONATION_SETTING_KEY,
    }).lean();

    if (!existing?.qrUrl) {
      return { ok: false, error: 'There is no donation QR to remove.' };
    }

    const oldQrUrl = existing.qrUrl;

    await DonationSetting.findOneAndUpdate(
      { key: DONATION_SETTING_KEY },
      {
        $set: {
          qrUrl: null,
          qrUploadedAt: null,
          enabledAt: null,
          updatedByUserId: admin.id,
        },
      }
    );

    await deleteDonationQr(oldQrUrl);

    await recordAudit({
      action: 'DONATION_QR_CLEAR',
      targetType: 'DonationSetting',
      targetId: DONATION_SETTING_KEY,
      before: { qrUrl: oldQrUrl, enabledAt: existing.enabledAt || null },
      after: { qrUrl: null, enabledAt: null },
    });

    revalidateDonationSurfaces();

    return { ok: true, data: null };
  } catch (error) {
    if ((error as { code?: string }).code === 'ADMIN_NOT_FOUND') throw error;
    console.error('[actions/admin/donation] clearDonationQr:', (error as Error).message);
    return { ok: false, error: 'Failed to remove the donation QR image.' };
  }
}

/**
 * Switch the public donation ask on or off (AGENTS.md §4.9).
 * Enabling requires an uploaded QR — there is nothing to show otherwise.
 */
export async function setDonationAsk(
  input: unknown
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const admin = await requireAdmin();

    const parseResult = donationToggleSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        ok: false,
        error: parseResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { enabled } = parseResult.data;
    await dbConnect();

    const existing = await DonationSetting.findOne({
      key: DONATION_SETTING_KEY,
    }).lean();

    if (enabled && !existing?.qrUrl) {
      return {
        ok: false,
        error: 'Upload a GCash QR image before switching the donation ask on.',
      };
    }

    const before = { enabledAt: existing?.enabledAt || null };
    const enabledAt = enabled ? new Date() : null;

    await DonationSetting.findOneAndUpdate(
      { key: DONATION_SETTING_KEY },
      { $set: { enabledAt, updatedByUserId: admin.id } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await recordAudit({
      action: 'DONATION_TOGGLE',
      targetType: 'DonationSetting',
      targetId: DONATION_SETTING_KEY,
      before,
      after: { enabledAt },
    });

    revalidateDonationSurfaces();

    return { ok: true, data: { enabled } };
  } catch (error) {
    if ((error as { code?: string }).code === 'ADMIN_NOT_FOUND') throw error;
    console.error('[actions/admin/donation] setDonationAsk:', (error as Error).message);
    return { ok: false, error: 'Failed to update the donation setting.' };
  }
}
