import { z } from 'zod';

export const remarkMaxLength = 300;

export const gradeScaleRowSchema = z.object({
  letter: z.string().trim().min(1, 'Add a letter.').max(3, 'Keep letters to 3 characters.'),
  minScore: z.number().min(0, 'Scores start at 0.').max(100, 'Scores end at 100.'),
  label: z.string().trim().min(1, 'Add a label, for example Excellent.').max(40),
});

export const classTeacherSchema = z.object({
  classId: z.uuid('Choose a class.'),
  userId: z.union([z.literal(''), z.uuid()]),
});

export const headmasterTagSchema = z.object({
  membershipId: z.uuid('Choose a team member.'),
  value: z.boolean(),
});

export const remarksSchema = z.object({
  termId: z.uuid('Choose a term.'),
  studentId: z.uuid('Choose a student.'),
  classTeacherRemark: z.string().trim().max(remarkMaxLength, `Keep each remark under ${remarkMaxLength} characters.`).optional(),
  headmasterRemark: z.string().trim().max(remarkMaxLength, `Keep each remark under ${remarkMaxLength} characters.`).optional(),
});

export const finalSchema = z.object({
  termId: z.uuid('Choose a term.'),
  classId: z.uuid('Choose a class.'),
  studentIds: z.array(z.uuid()).min(1, 'Choose at least one student.'),
});

export const unlockSchema = z.object({
  termId: z.uuid(),
  studentId: z.uuid(),
});
