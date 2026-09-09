import mongoose, { Schema, Model } from 'mongoose';
import type { IEvent } from '@/types';

const EventSchema = new Schema<IEvent>(
  {
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'CREATED',
        'SENT',
        'VIEWED',
        'ACCEPTED',
        'DECLINED',
        'MARKED_PAID',
        'UNMARKED_PAID',
        'LINK_REVOKED',
      ],
      required: true,
    },
    actor: {
      type: String,
      enum: ['OWNER', 'CLIENT', 'ADMIN', 'SYSTEM'],
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes per DEVELOPMENT_PLAN.md §7:
// Append-only. Indexes: { quotationId: 1, createdAt: 1 }, { userId: 1, createdAt: -1 }
EventSchema.index({ quotationId: 1, createdAt: 1 });
EventSchema.index({ userId: 1, createdAt: -1 });

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;
