import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required' }),
    newPassword: z
      .string()
      .min(8, { message: 'New password must be at least 8 characters' }),
    confirmNewPassword: z
      .string()
      .min(1, { message: 'Please confirm your new password' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' }),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const closeAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((val) => val === 'CLOSE', {
      message: 'You must type CLOSE to confirm account closure',
    }),
  password: z
    .string()
    .min(1, { message: 'Password is required to confirm account closure' }),
});

export type CloseAccountInput = z.infer<typeof closeAccountSchema>;
