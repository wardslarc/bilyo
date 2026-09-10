import { z } from 'zod';

export const businessProfileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(100, 'Business name must be 100 characters or fewer'),
  address: z
    .string()
    .trim()
    .max(250, 'Address must be 250 characters or fewer')
    .optional()
    .default(''),
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
  logoUrl: z
    .string()
    .trim()
    .refine(
      (val) => val === '' || val.startsWith('/') || z.string().url().safeParse(val).success,
      {
        message: 'Please enter a valid URL for the logo',
      }
    )
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val ?? null)),
  currency: z
    .enum(['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'CAD'])
    .optional()
    .default('PHP'),
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
export type BusinessProfileData = z.output<typeof businessProfileSchema>;
