import mongoose, { Schema, Model } from 'mongoose';
import type { IVerificationToken } from '@/types';

const VerificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ['EMAIL_VERIFY'],
      default: 'EMAIL_VERIFY',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    codeHash: {
      type: String,
      required: true,
    },
    codeExpiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      required: true,
    },
    codeInvalidAt: {
      type: Date,
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    grantedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

VerificationTokenSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

export const VerificationToken: Model<IVerificationToken> =
  mongoose.models.VerificationToken ||
  mongoose.model<IVerificationToken>('VerificationToken', VerificationTokenSchema);

export default VerificationToken;
