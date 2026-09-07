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
