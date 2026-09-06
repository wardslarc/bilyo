import mongoose, { Schema, Model } from 'mongoose';
import type { ICounter } from '@/types';

const CounterSchema = new Schema<ICounter>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    kind: {
      type: String,
      enum: ['INVOICE', 'QUOTATION'],
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6
CounterSchema.index({ userId: 1, kind: 1 }, { unique: true });

export const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;
