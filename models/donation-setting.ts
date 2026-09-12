import mongoose, { Schema, Model } from 'mongoose';
import type { IDonationSetting } from '@/types';

/**
 * Platform donation settings — a single document keyed 'DONATION'
 * (AGENTS.md §4.9, DEVELOPMENT_PLAN.md §5.8).
 *
 * This is PLATFORM content, not user content. It is the one admin-writable
 * record in the app that no user owns, which is why admin's read-only stance
 * over user content is untouched by it.
 *
 * Upload and go-live are deliberately separate: `qrUrl` holds the image,
 * `enabledAt` decides whether the public surfaces render it. Switching the ask
 * off never deletes the image, so turning it back on needs no re-upload.
 */
const DonationSettingSchema = new Schema<IDonationSetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'DONATION',
      enum: ['DONATION'],
    },
    qrUrl: {
      type: String,
      default: null,
    },
    qrUploadedAt: {
      type: Date,
      default: null,
    },
    enabledAt: {
      type: Date,
      default: null,
    },
    updatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const DonationSetting: Model<IDonationSetting> =
  mongoose.models.DonationSetting ||
  mongoose.model<IDonationSetting>('DonationSetting', DonationSettingSchema);

export default DonationSetting;
