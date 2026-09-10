import { z } from 'zod';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'qwerty123',
  'admin123',
  'admin1234',
  'bilyo123',
  'iloveyou',
  'sunshine',
  'princess',
  'welcome1',
  'letmein1',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase().trim());
}

export const strongPasswordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .refine((val) => !isCommonPassword(val), {
    message: 'This password is too common and easily guessed. Please choose a stronger password.',
  });
