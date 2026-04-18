import { z } from 'zod';
import { MIN_DONATION_CENTS, MAX_DONATION_CENTS } from '@penyzen/shared';

export const CreateDonationSchema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z
    .number()
    .int('Amount must be a whole number of cents')
    .min(MIN_DONATION_CENTS, `Minimum donation is $${MIN_DONATION_CENTS / 100}`)
    .max(MAX_DONATION_CENTS, `Maximum donation is $${MAX_DONATION_CENTS / 100}`),
  isAnonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
});

export type CreateDonationInput = z.infer<typeof CreateDonationSchema>;
