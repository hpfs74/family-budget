import { z } from 'zod';

export const CreateBudgetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  categoryId: z.string().min(1, 'categoryId is required'),
  amount: z.number().positive('amount must be positive'),
  currency: z.enum(['GBP', 'EUR']),
  type: z.enum(['monthly', 'periodic', 'one-time']),
  direction: z.enum(['expense', 'income']).default('expense'),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'startMonth must be YYYY-MM'),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/, 'endMonth must be YYYY-MM'),
  year: z.number().int().min(2000).max(2100),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export const BudgetComparisonQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'year must be a 4-digit number').transform(Number),
  month: z.string().regex(/^\d{2}$/).optional().transform(v => v !== undefined ? Number(v) : undefined),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
