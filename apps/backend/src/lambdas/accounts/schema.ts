import { z } from 'zod';

export const CreateAccountSchema = z.object({
  accountName: z.string().min(1, 'accountName is required'),
  accountNumber: z.string().min(1, 'accountNumber is required'),
  bankName: z.string().min(1, 'bankName is required'),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT'], {
    errorMap: () => ({ message: 'accountType must be CHECKING, SAVINGS, CREDIT, or INVESTMENT' }),
  }),
  currency: z.enum(['GBP', 'EUR'], {
    errorMap: () => ({ message: 'currency must be GBP or EUR' }),
  }),
  balance: z.number().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
