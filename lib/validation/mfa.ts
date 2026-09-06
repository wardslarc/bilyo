import { z } from 'zod';

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: 'MFA code must be exactly 6 digits' }),
});

export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8, { message: 'Recovery code is required' })
    .max(32, { message: 'Invalid recovery code length' }),
});

export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;
