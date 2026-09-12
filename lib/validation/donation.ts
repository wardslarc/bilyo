import { z } from 'zod';

/**
 * Donation ask on/off (AGENTS.md §4.9).
 *
 * The QR upload itself is not validated here: like the business logo, it
 * arrives as FormData and is checked against real magic bytes by
 * `validateImageBuffer` in lib/blob.ts, which a zod schema cannot do. This
 * schema covers the only structured input the donation surface takes.
 */
export const donationToggleSchema = z.object({
  enabled: z.boolean(),
});

export type DonationToggleInput = z.infer<typeof donationToggleSchema>;
