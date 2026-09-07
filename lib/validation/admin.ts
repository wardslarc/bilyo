import { z } from 'zod';

/**
 * Validation schema for administrative user moderation actions (M7-T05).
 * Per DEVELOPMENT_PLAN.md §5.9 & §11:
 * Every administrative moderation action requires a typed reason of at least 10 characters.
 */
export const adminActionReasonSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters long'),
});

export type AdminActionReasonInput = z.infer<typeof adminActionReasonSchema>;

/**
 * Validation schema for setting a plan override (§5.10, M7-T06).
 * Requires target plan, mandatory justification (min 10 chars), and duration in days (default 90).
 */
export const setPlanOverrideSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  plan: z.enum(['FREE', 'FREELANCER', 'BUSINESS']),
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters long'),
  days: z
    .number()
    .int()
    .min(1, 'Duration must be at least 1 day')
    .max(365, 'Duration cannot exceed 365 days')
    .default(90),
});

export type SetPlanOverrideInput = z.infer<typeof setPlanOverrideSchema>;
