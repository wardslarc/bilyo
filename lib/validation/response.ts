import { z } from 'zod';

export const publicResponseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{12}$/, 'Invalid quotation code format'),
  action: z.enum(['ACCEPT', 'DECLINE'], {
    message: 'Action must be ACCEPT or DECLINE',
  }),
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your full name')
    .max(100, 'Name must be 100 characters or fewer'),
});

export type PublicResponseInput = z.input<typeof publicResponseSchema>;
export type PublicResponseData = z.output<typeof publicResponseSchema>;
