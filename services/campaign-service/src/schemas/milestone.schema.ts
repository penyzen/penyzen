import { z } from 'zod';

export const CreateMilestoneSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(500).optional(),
  targetAmountCents: z.number().int().min(100, 'Milestone must be at least $1'),
});

export const UpdateMilestoneSchema = CreateMilestoneSchema.partial();

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
