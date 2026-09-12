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
        'EMAIL_VERIFICATION',
        'ADMIN_SIGNUP',
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
      // Do not set default: null. In MongoDB, sparse indexes still index explicit null values,
      // which causes E11000 duplicate key error on subsequent null inserts.
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
    /**
     * When this row becomes eligible for automatic deletion (Privacy Policy §9:
     * email delivery records are kept 12 months).
     *
     * Deliberately NOT set for rows that must outlive that window. MongoDB's TTL
     * monitor ignores documents where the indexed field is missing or is not a
     * Date, so unsetting purgeAt makes a row permanent. The Resend webhook does
     * exactly that on a bounce or complaint, because lib/email/send.ts reads
     * those rows before every send to decide whether an address is suppressed —
     * expiring them would silently re-enable sending to a dead address.
     */
    purgeAt: {
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
EmailMessageSchema.index(
  { providerId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerId: { $type: 'string' } },
  }
);
EmailMessageSchema.index({ idempotencyKey: 1 }, { unique: true });
EmailMessageSchema.index({ toEmail: 1, status: 1 });

// TTL: delete a row once purgeAt has passed. Rows whose purgeAt is null (or
// absent) never expire — that is how bounce and complaint suppressions are kept
// indefinitely. See the purgeAt field comment above.
EmailMessageSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const EmailMessage: Model<IEmailMessage> =
  mongoose.models.EmailMessage ||
  mongoose.model<IEmailMessage>('EmailMessage', EmailMessageSchema);

export default EmailMessage;
