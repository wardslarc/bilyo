import { z } from 'zod';

export const pricingInterestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  passType: z.enum(['D30', 'D90', 'Y1']).optional(),
});

export type PricingInterestInput = z.infer<typeof pricingInterestSchema>;

export const trialWallSurveySchema = z.object({
  answer: z.enum(['WOULD_PAY_LOWER', 'NOT_NOW', 'WOULD_NOT_PAY'], {
    message: 'Please select an answer',
  }),
  suggestedPriceCentavos: z.number().int().nonnegative().optional().nullable(),
  comment: z.string().trim().max(1000, 'Comment must be 1000 characters or fewer').optional().nullable(),
});

export type TrialWallSurveyInput = z.infer<typeof trialWallSurveySchema>;
