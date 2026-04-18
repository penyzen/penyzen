import { z } from 'zod';

export const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(150),
  description: z.string().max(1000).optional(),
  websiteUrl: z.string().url().optional(),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, 'EIN must be in format XX-XXXXXXX')
    .optional(),
});

export const UpdateOrgSchema = CreateOrgSchema.partial();

export const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER']),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
