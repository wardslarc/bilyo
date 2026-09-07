import { z } from 'zod';

// Philippine Tax Identification Number (TIN) pattern:
// Standard: 000-000-000 or 000-000-000-000 (9 to 12 digits, optional 3-5 digit branch code).
// Accepts empty/blank strings as well.
const tinPattern = /^(\d{3}-\d{3}-\d{3}(-\d{3,5})?|\d{9,15})$/;

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
  tin: z
    .string()
    .trim()
    .refine((val) => val === '' || tinPattern.test(val), {
      message: 'TIN must be in 000-000-000-000 format or 9–12 digits',
    })
    .optional()
    .default(''),
  vatRegistered: z.boolean(),
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
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
export type BusinessProfileData = z.output<typeof businessProfileSchema>;
