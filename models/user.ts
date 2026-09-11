import mongoose, { Schema, Model } from 'mongoose';
import type { IUser } from '@/types';

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationSentAt: {
      type: Date,
      default: null,
    },
    emailVerificationSends: {
      type: Number,
      default: 0,
    },
    emailBouncedAt: {
      type: Date,
      default: null,
    },


    // MFA (§5.11)
    mfaEnabledAt: {
      type: Date,
      default: null,
    },
    mfaSecretEncrypted: {
      type: String,
      default: null,
    },
    mfaPendingSecretEncrypted: {
      type: String,
      default: null,
    },
    mfaPendingExpiresAt: {
      type: Date,
      default: null,
    },
    mfaLastUsedStep: {
      type: Number,
      default: null,
    },
    mfaRecoveryCodeHashes: {
      type: [String],
      default: [],
    },
    mfaFailedAttempts: {
      type: Number,
      default: 0,
    },
    mfaLockedUntil: {
      type: Date,
      default: null,
    },

    // Admin (§5.8, §5.9)
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
      required: true,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedReason: {
      type: String,
      default: null,
    },
    suspendedByUserId: {
      type: String,
      default: null,
    },
    publicLinksDisabledAt: {
      type: Date,
      default: null,
    },
    deletionRequestedAt: {
      type: Date,
      default: null,
    },

    // Support signals
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    lastSeenEventsAt: {
      type: Date,
      default: null,
    },

    // Session Invalidation
    sessionsValidFrom: {
      type: Date,
      default: null,
    },

    // Access & Trial (§6.10, ACCESS_BILLING_PLAN.md §3.3)
    accessUntil: {
      type: Date,
      default: null,
    },
    firstPaidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6
UserSchema.index({ mfaPendingExpiresAt: 1 }, { sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ suspendedAt: 1 }, { sparse: true });
UserSchema.index({ emailVerifiedAt: 1, createdAt: 1 });
UserSchema.index({ accessUntil: 1 }, { sparse: true });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
