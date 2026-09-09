import mongoose, { Schema, Model } from 'mongoose';
import type { IEmailMessage } from '@/types';

const EmailMessageSchema = new Schema<IEmailMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null,
    },
    kind: {
      type: String,
      enum: [
        'QUOTATION_SENT',
        'QUOTATION_RESPONDED',
        'PASSWORD_RESET',
        'ACCESS_EXPIRING',
      ],
      required: true,
    },
    toEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
    },
    providerId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'SKIPPED',
        'QUEUED',
        'SENT',
        'DELIVERED',
        'DELAYED',
        'BOUNCED',
        'COMPLAINED',
        'FAILED',
        'SUPPRESSED',
      ],
      default: 'QUEUED',
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    bouncedAt: {
      type: Date,
      default: null,
    },
    complainedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per EMAIL_DELIVERY_PLAN.md §3.1:
EmailMessageSchema.index({ userId: 1, createdAt: -1 });
EmailMessageSchema.index({ quotationId: 1, createdAt: -1 });
EmailMessageSchema.index({ providerId: 1 }, { unique: true, sparse: true });
EmailMessageSchema.index({ idempotencyKey: 1 }, { unique: true });
EmailMessageSchema.index({ toEmail: 1, status: 1 });

export const EmailMessage: Model<IEmailMessage> =
  mongoose.models.EmailMessage ||
  mongoose.model<IEmailMessage>('EmailMessage', EmailMessageSchema);

export default EmailMessage;
