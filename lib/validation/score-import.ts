import { z } from 'zod';

export const importScoresSchema = z.object({
  students: z
    .array(
      z.object({
        admissionNumber: z.string().trim().min(1).max(40),
        score: z.number().min(0, 'Scores cannot be negative.'),
      }),
    )
    .min(1, 'There are no ready scores to import.')
    .max(500, 'Import at most 500 scores at a time.'),
});
