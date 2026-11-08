import { z } from 'zod';

import { parseGhsToPesewas } from '@/lib/fees/format';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.');
const amount = z
  .string()
  .trim()
  .refine((value) => parseGhsToPesewas(value) !== null, 'Enter an amount in cedis, for example 150 or 150.50.');

export const feeItemSchema = z.object({
  termId: z.uuid('Choose a term.'),
  classId: z.uuid('Choose a class.').nullable(),
  name: z.string().trim().min(2, 'Enter a name for the fee.').max(120),
  amount,
  dueOn: z.union([z.literal(''), isoDate]),
});

export const paymentSchema = z.object({
  studentId: z.uuid('Choose a student.'),
  termId: z.uuid('Choose a term.'),
  amount,
  paidOn: isoDate,
  method: z.enum(['cash', 'mobile_money', 'bank', 'other'], { message: 'Choose how the payment was made.' }),
  reference: z.string().trim().max(80, 'Keep the reference under 80 characters.'),
  note: z.string().trim().max(200, 'Keep the note under 200 characters.'),
});

export const reversalSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3, 'Give a reason for the reversal.').max(200),
});

export const waiverSchema = z.object({
  chargeId: z.uuid(),
  reason: z.string().trim().min(3, 'Give a reason for the waiver.').max(200),
});

export const feeRemovalSchema = z.object({
  feeItemId: z.uuid(),
});

export const studentIdSchema = z.uuid();
