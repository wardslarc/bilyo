import { z } from 'zod';
import { pesosToCentavos } from '../money.ts';

/**
 * Line-item schema for quotation validation.
 * Unit price is typed in pesos, transformed to centavos at the boundary.
 */
export const lineItemInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Description must be 500 characters or fewer'),
  quantity: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const n = typeof val === 'string' ? Number(val) : val;
      return n;
    })
    .refine((val) => Number.isFinite(val) && val > 0, {
      message: 'Quantity must be a positive number',
    }),
  unitPrice: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        try {
          const centavos = pesosToCentavos(val);
          return Number.isInteger(centavos) && centavos >= 0;
        } catch {
          return false;
        }
      },
      { message: 'Please enter a valid non-negative price (e.g. 1,234.56)' }
    )
    .transform((val) => pesosToCentavos(val)),
});

/**
 * Quotation creation / update schema.
 * The server recomputes totals from items — client-supplied totals are ignored (§3.3).
 */
export const quotationSchema = z.object({
  customerId: z
    .string()
    .min(1, 'Please select a client'),
  items: z
    .array(lineItemInputSchema)
    .min(1, 'At least one line item is required'),
  /** Discount typed in pesos, transformed to centavos */
  discount: z
    .union([z.string(), z.number()])
    .optional()
    .default('0')
    .transform((val) => {
      try {
        return pesosToCentavos(val);
      } catch {
        return 0;
      }
    }),
  issueDate: z
    .string()
    .min(1, 'Issue date is required')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid issue date' })
    .transform((val) => new Date(val)),
  validUntil: z
    .string()
    .min(1, 'Valid until date is required')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid valid-until date' })
    .transform((val) => new Date(val)),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes must be 2000 characters or fewer')
    .optional()
    .default(''),
  terms: z
    .string()
    .trim()
    .max(2000, 'Terms must be 2000 characters or fewer')
    .optional()
    .default(''),
  currency: z
    .enum(['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'CAD'])
    .optional(),
});

export type QuotationInput = z.input<typeof quotationSchema>;
export type QuotationData = z.output<typeof quotationSchema>;

/**
 * Validation schema for marking a quotation as paid / unpaid (§6.8, P4-T04).
 * Optional amount is typed in pesos and converted to integer centavos.
 * Defaults to the quotation's totalCentavos if omitted.
 */
export const markPaidInputSchema = z.object({
  paid: z.boolean(),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined || val === null || val === '') return true;
        try {
          const centavos = pesosToCentavos(val);
          return Number.isInteger(centavos) && centavos > 0;
        } catch {
          return false;
        }
      },
      { message: 'Payment amount must be a valid positive amount' }
    )
    .transform((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      return pesosToCentavos(val);
    }),
});

export type MarkPaidInput = z.input<typeof markPaidInputSchema>;
export type MarkPaidData = z.output<typeof markPaidInputSchema>;

