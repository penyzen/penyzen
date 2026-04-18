import { z } from 'zod';

export const CreateUpdateSchema = z.object({
  title: z.string().min(5).max(100),
  body: z.string().min(20, 'Update body must be at least 20 characters'),
});

export type CreateUpdateInput = z.infer<typeof CreateUpdateSchema>;
