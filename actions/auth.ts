'use server';

import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { registerSchema } from '../lib/validation/auth.ts';
import type { ActionResult } from '@/types';

/**
 * Server Action for User Registration (§8.1, M1-T02).
 * Validates with Zod, checks email uniqueness, hashes with bcrypt cost 10,
 * assigns role 'USER', plan 'FREE', planSource 'DEFAULT'.
 * Never logs raw passwords. Duplicate email returns field error, never 500.
 */
export async function registerUser(
  input: unknown
): Promise<ActionResult<{ userId: string }>> {
  const parseResult = registerSchema.safeParse(input);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) {
        fieldErrors[String(key)] = issue.message;
      }
    }
    return {
      ok: false,
      error: 'Please fix the errors in the form',
      fieldErrors,
    };
  }

  const { name, email, password } = parseResult.data;

  try {
    await dbConnect();

    // Check email uniqueness (lowercased)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        ok: false,
        error: 'An account with this email already exists',
        fieldErrors: {
          email: 'An account with this email already exists',
        },
      };
    }

    // Bcrypt cost 10 (§11 M1-T02)
    const passwordHash = await bcrypt.hash(password, 10);

    if (!passwordHash.startsWith('$2')) {
      throw new Error('Failed to generate valid bcrypt hash');
    }

    // Create user with default role & plan
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: 'USER',
      plan: 'FREE',
      planSource: 'DEFAULT',
    });

    return {
      ok: true,
      data: {
        userId: newUser._id.toString(),
      },
    };
  } catch (error) {
    // Log server error without sensitive credentials
    console.error('Registration error for email:', email, (error as Error).message);
    return {
      ok: false,
      error: 'An unexpected error occurred while creating your account. Please try again.',
    };
  }
}
