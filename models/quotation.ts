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
    tin: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const BusinessSnapshotSchema = new Schema<IBusinessSnapshot>(
  {
    businessName: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    tin: { type: String, default: '', trim: true },
    vatRegistered: { type: Boolean, required: true },
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
    vatRatePercent: {
      type: Number,
      default: 12,
      required: true,
    },
    vatCentavos: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'vatCentavos must be an integer',
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
      enum: ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
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
    convertedInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    publicToken: {
      type: String,
      default: null,
    },
    publicTokenRevokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6
QuotationSchema.index({ userId: 1, createdAt: -1 });
QuotationSchema.index({ userId: 1, number: 1 }, { unique: true });
QuotationSchema.index({ publicToken: 1 }, { unique: true, sparse: true });
QuotationSchema.index({ number: 1 });

export const Quotation: Model<IQuotation> =
  mongoose.models.Quotation || mongoose.model<IQuotation>('Quotation', QuotationSchema);

export default Quotation;
