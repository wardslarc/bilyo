import mongoose, { Schema, Model } from 'mongoose';
import type { IQuotation, ILineItem, ICustomerSnapshot, IBusinessSnapshot } from '@/types';

const LineItemSchema = new Schema<ILineItem>(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPriceCentavos: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPriceCentavos must be an integer',
      },
    },
    amountCentavos: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'amountCentavos must be an integer',
      },
    },
  },
  { _id: false }
);

const CustomerSnapshotSchema = new Schema<ICustomerSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const BusinessSnapshotSchema = new Schema<IBusinessSnapshot>(
  {
    businessName: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: null },
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    number: {
      type: String,
      required: true,
      trim: true,
    },
    customerSnapshot: {
      type: CustomerSnapshotSchema,
      default: null,
    },
    businessSnapshot: {
      type: BusinessSnapshotSchema,
      default: null,
    },
    items: {
      type: [LineItemSchema],
      default: [],
      required: true,
    },
    subtotalCentavos: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'subtotalCentavos must be an integer',
      },
    },
    discountCentavos: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'discountCentavos must be an integer',
      },
    },
    totalCentavos: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'totalCentavos must be an integer',
      },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED'],
      default: 'DRAFT',
      required: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    publicCode: {
      type: String,
      default: null,
    },
    publicCodeRevokedAt: {
      type: Date,
      default: null,
    },
    publicToken: {
      type: String,
      default: null,
    },
    publicTokenRevokedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    viewedAt: {
      type: Date,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    respondedByName: {
      type: String,
      default: null,
      trim: true,
    },
    responseIp: {
      type: String,
      default: null,
      trim: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidAmountCentavos: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) => v === null || Number.isInteger(v),
        message: 'paidAmountCentavos must be an integer or null',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6 & §7
QuotationSchema.index({ userId: 1, createdAt: -1 });
QuotationSchema.index({ userId: 1, number: 1 }, { unique: true });
QuotationSchema.index({ userId: 1, status: 1, validUntil: 1 });
QuotationSchema.index({ publicCode: 1 }, { unique: true, sparse: true });
QuotationSchema.index({ publicToken: 1 }, { unique: true, sparse: true });
QuotationSchema.index({ number: 1 });

export const Quotation: Model<IQuotation> =
  mongoose.models.Quotation || mongoose.model<IQuotation>('Quotation', QuotationSchema);

export default Quotation;
