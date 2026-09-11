import mongoose, { Schema, Model } from 'mongoose';
import type { IInterest } from '@/types';

const UsageSnapshotSchema = new Schema(
  {
    quotationsSent: { type: Number, default: 0 },
    quotationsAccepted: { type: Number, default: 0 },
    acceptedValueCentavos: { type: Number, default: 0 },
  },
  { _id: false }
);

const InterestSchema = new Schema<IInterest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ['PRICING_NOTIFY', 'TRIAL_WALL'],
      required: true,
    },
    passType: {
      type: String,
      enum: ['D30', 'D90', 'Y1'],
      default: null,
    },
    answer: {
      type: String,
      enum: ['WOULD_PAY_LOWER', 'NOT_NOW', 'WOULD_NOT_PAY'],
      default: null,
    },
    suggestedPriceCentavos: {
      type: Number,
      default: null,
    },
    comment: {
      type: String,
      trim: true,
      default: null,
    },
    usageSnapshot: {
      type: UsageSnapshotSchema,
      default: () => ({
        quotationsSent: 0,
        quotationsAccepted: 0,
        acceptedValueCentavos: 0,
      }),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per ACCESS_BILLING_PLAN.md §3.4
InterestSchema.index({ userId: 1, source: 1 }, { unique: true, sparse: true });
InterestSchema.index({ email: 1, source: 1 });
InterestSchema.index({ source: 1, createdAt: -1 });

export const Interest: Model<IInterest> =
  mongoose.models.Interest || mongoose.model<IInterest>('Interest', InterestSchema);

export default Interest;
