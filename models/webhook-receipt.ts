import mongoose, { Schema, Model } from 'mongoose';
import type { IWebhookReceipt } from '@/types';

const WebhookReceiptSchema = new Schema<IWebhookReceipt>(
  {
    svixId: {
      type: String,
      required: true,
      unique: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// 24-hour TTL index to automatically prune processed Svix receipts (EMAIL_DELIVERY_PLAN.md §5.4)
WebhookReceiptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const WebhookReceipt: Model<IWebhookReceipt> =
  mongoose.models.WebhookReceipt ||
  mongoose.model<IWebhookReceipt>('WebhookReceipt', WebhookReceiptSchema);

export default WebhookReceipt;
