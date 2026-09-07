import { z } from 'zod';
import { pesosToCentavos } from '../money.ts';
import { lineItemInputSchema } from './quotation.ts';

export { lineItemInputSchema };

/**
 * Invoice creation / update schema.
 * The server recomputes totals from items — client-supplied totals are ignored (§3.3).
 */
export const invoiceSchema = z.object({
  customerId: z
    .string()
    .min(1, 'Please select a customer'),
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
  dueDate: z
    .string()
    .min(1, 'Due date is required')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid due date' })
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
});

export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceData = z.output<typeof invoiceSchema>;
