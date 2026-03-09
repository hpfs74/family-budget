import { z } from 'zod';

export const CreateTransactionSchema = z.object({
  account: z.string().min(1, 'account is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  description: z.string().min(1, 'description is required'),
  currency: z.enum(['GBP', 'EUR']),
  amount: z.number().finite(),
  fee: z.number().default(0),
  category: z.string().optional(),
  type: z.enum(['income', 'expense', 'transfer']).default('expense'),
  toAccount: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const CreateTransferSchema = z.object({
  fromAccount: z.string().min(1, 'fromAccount is required'),
  toAccount: z.string().min(1, 'toAccount is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  description: z.string().min(1, 'description is required'),
  currency: z.enum(['GBP', 'EUR']),
  amount: z.number().positive('amount must be positive'),
  fee: z.number().default(0),
}).refine(data => data.fromAccount !== data.toAccount, {
  message: 'fromAccount and toAccount must be different',
  path: ['toAccount'],
});

export const BulkUpdateSchema = z.object({
  account: z.string().min(1, 'account is required'),
  transactionIds: z.array(z.string().min(1)).min(1, 'at least one transactionId required'),
  updates: UpdateTransactionSchema,
});

export const ConvertToTransferSchema = z.object({
  account: z.string().min(1, 'account is required'),
  toAccount: z.string().min(1, 'toAccount is required'),
  categoryId: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type BulkUpdateInput = z.infer<typeof BulkUpdateSchema>;
export type ConvertToTransferInput = z.infer<typeof ConvertToTransferSchema>;
