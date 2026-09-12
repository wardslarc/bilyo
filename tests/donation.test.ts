import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { DonationSetting } from '../models/donation-setting.ts';
import { getDonationState, DONATION_SETTING_KEY } from '../lib/donation.ts';
import { donationToggleSchema } from '../lib/validation/donation.ts';

/**
 * The donation setting is a singleton, so these tests save whatever is really
 * in the database before touching it and put it back afterwards. A test that
 * silently clears a live QR would be worse than no test.
 */
describe('lib/donation.ts - getDonationState', () => {
  let original: {
    qrUrl: string | null;
    qrUploadedAt: Date | null;
    enabledAt: Date | null;
  } | null = null;
  let existedBefore = false;

  const write = async (fields: {
    qrUrl: string | null;
    qrUploadedAt: Date | null;
    enabledAt: Date | null;
  }) => {
    await DonationSetting.findOneAndUpdate(
      { key: DONATION_SETTING_KEY },
      { $set: fields },
      { upsert: true, setDefaultsOnInsert: true }
    );
  };

  before(async () => {
    await dbConnect();
    const doc = await DonationSetting.findOne({
      key: DONATION_SETTING_KEY,
    }).lean();
    if (doc) {
      existedBefore = true;
      original = {
        qrUrl: doc.qrUrl ?? null,
        qrUploadedAt: doc.qrUploadedAt ?? null,
        enabledAt: doc.enabledAt ?? null,
      };
    }
  });

  after(async () => {
    if (existedBefore && original) {
      await write(original);
    } else {
      await DonationSetting.deleteOne({ key: DONATION_SETTING_KEY });
    }
    await mongoose.disconnect();
  });

  test('no QR uploaded reads as disabled', async () => {
    await write({ qrUrl: null, qrUploadedAt: null, enabledAt: null });

    const state = await getDonationState();
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.qrUrl, null);
  });

  test('a QR that has not been switched on reads as disabled', async () => {
    await write({
      qrUrl: 'https://example.public.blob.vercel-storage.com/donation/staged.png',
      qrUploadedAt: new Date(),
      enabledAt: null,
    });

    const state = await getDonationState();
    assert.strictEqual(state.enabled, false);
  });

  test('a staged QR url is withheld while the ask is off', async () => {
    await write({
      qrUrl: 'https://example.public.blob.vercel-storage.com/donation/staged.png',
      qrUploadedAt: new Date(),
      enabledAt: null,
    });

    const state = await getDonationState();
    // The URL must not reach a public surface before the ask goes live.
    assert.strictEqual(state.qrUrl, null);
  });

  test('enabled with a QR reads as live and returns the url', async () => {
    const qrUrl =
      'https://example.public.blob.vercel-storage.com/donation/live.png';
    await write({ qrUrl, qrUploadedAt: new Date(), enabledAt: new Date() });

    const state = await getDonationState();
    assert.strictEqual(state.enabled, true);
    assert.strictEqual(state.qrUrl, qrUrl);
  });

  test('enabledAt set with no QR still reads as disabled', async () => {
    // Should be unreachable through the actions, which refuse to enable
    // without an image — but the read must not trust that.
    await write({ qrUrl: null, qrUploadedAt: null, enabledAt: new Date() });

    const state = await getDonationState();
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.qrUrl, null);
  });
});

describe('lib/validation/donation.ts - donationToggleSchema', () => {
  test('accepts a boolean enabled flag', () => {
    assert.strictEqual(donationToggleSchema.parse({ enabled: true }).enabled, true);
    assert.strictEqual(
      donationToggleSchema.parse({ enabled: false }).enabled,
      false
    );
  });

  test('rejects a missing or non-boolean flag', () => {
    assert.strictEqual(donationToggleSchema.safeParse({}).success, false);
    assert.strictEqual(
      donationToggleSchema.safeParse({ enabled: 'yes' }).success,
      false
    );
  });
});
