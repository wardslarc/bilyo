import { z } from 'zod';

const tinPattern = /^(\d{3}-\d{3}-\d{3}(-\d{3,5})?|\d{9,15})$/;

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(100, 'Customer name must be 100 characters or fewer'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    })
    .optional()
    .default(''),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number must be 30 characters or fewer')
    .optional()
    .default(''),
  address: z
    .string()
    .trim()
    .max(250, 'Address must be 250 characters or fewer')
    .optional()
    .default(''),
  tin: z
    .string()
    .trim()
    .refine((val) => val === '' || tinPattern.test(val), {
      message: 'TIN must be in 000-000-000-000 format or 9–12 digits',
    })
    .optional()
    .default(''),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be 500 characters or fewer')
    .optional()
    .default(''),
  archived: z.boolean().optional().default(false),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerData = z.output<typeof customerSchema>;
