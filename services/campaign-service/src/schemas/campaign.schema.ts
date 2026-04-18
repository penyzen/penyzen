import { z } from 'zod';
import { CAMPAIGN_CATEGORIES, MIN_GOAL_AMOUNT_CENTS, MAX_GOAL_AMOUNT_CENTS } from '@penyzen/shared';

export const CreateCampaignSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(100),
  description: z.string().min(20, 'Description must be at least 20 characters').max(500),
  story: z.string().min(100, 'Story must be at least 100 characters'),
  category: z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]]),
  goalAmountCents: z
    .number()
    .int('Goal must be a whole number of cents')
    .min(MIN_GOAL_AMOUNT_CENTS, `Minimum goal is $${MIN_GOAL_AMOUNT_CENTS / 100}`)
    .max(MAX_GOAL_AMOUNT_CENTS, `Maximum goal is $${MAX_GOAL_AMOUNT_CENTS / 100}`),
  location: z.string().max(100).optional(),
  endsAt: z.string().datetime().optional(),
  organizationId: z.string().uuid().optional(),
  videoUrl: z.string().url().optional(),
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  coverImageUrl: z.string().url().optional().nullable(),
});

export const ListCampaignsQuerySchema = z.object({
  category: z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]]).optional(),
  status: z.enum(['PUBLISHED', 'DRAFT', 'PAUSED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().max(100).optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;
