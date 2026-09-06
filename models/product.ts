import mongoose, { Schema, Model } from 'mongoose';
import type { IProduct } from '@/types';

const ProductSchema = new Schema<IProduct>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    unitPriceCentavos: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPriceCentavos must be an integer',
      },
    },
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    archived: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6
ProductSchema.index({ userId: 1, name: 1 });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
