import { z } from 'zod';
import { pesosToCentavos } from '../money.ts';

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product or service name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .optional()
    .default(''),
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
      {
        message: 'Please enter a valid non-negative price (e.g. 1,234.56)',
      }
    )
    .transform((val) => pesosToCentavos(val)),
  unit: z
    .string()
    .trim()
    .max(30, 'Unit must be 30 characters or fewer')
    .optional()
    .default(''),
  archived: z.boolean().optional().default(false),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
