import { z } from 'zod';

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 08:00.');

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  password: z.string().min(1, 'Enter your password.'),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Use at most 72 characters.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const createSchoolSchema = z.object({
  name: z.string().trim().min(2, 'Enter the school name.').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Use at least 3 characters.')
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.'),
  timezone: z.string().refine(isValidTimeZone, 'Choose a valid timezone.'),
  schoolStartTime: timeOfDay,
  gracePeriodMinutes: z.coerce
    .number({ message: 'Enter a number of minutes.' })
    .int()
    .min(0)
    .max(120),
  ownerName: z.string().trim().min(2, 'Enter the owner’s name.').max(120),
  ownerEmail: z.email('Enter a valid owner email.').trim().toLowerCase(),
});

export const toggleStatusSchema = z.object({
  institutionId: z.uuid(),
  status: z.enum(['active', 'suspended']),
});

export const impersonationSchema = z.object({
  institutionId: z.uuid(),
  reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters).').max(200),
});

export const gradingWeightsSchema = z
  .object({
    assessment: z.coerce.number({ message: 'Enter a number.' }).min(0).max(100),
    exam: z.coerce.number({ message: 'Enter a number.' }).min(0).max(100),
  })
  .refine((value) => value.assessment + value.exam === 100, {
    path: ['exam'],
    message: 'Assessment and exam weights must add up to 100.',
  });

export const computeGradesSchema = z.object({
  termId: z.uuid('Choose a term.'),
  subjectId: z.uuid('Choose a subject.'),
});

export const studentActionSchema = z.object({
  studentId: z.uuid(),
});

export const insightActionSchema = z.object({
  insightId: z.uuid(),
});

export const classSchema = z.object({
  name: z.string().trim().min(1, 'Enter a class name.').max(60),
});

export const studentSchema = z.object({
  classId: z.uuid('Choose a class.'),
  fullName: z.string().trim().min(2, 'Enter the student’s full name.').max(120),
  admissionNumber: z.string().trim().min(1, 'Enter an admission number.').max(40),
});

export const assessmentSchema = z.object({
  classId: z.uuid('Choose a class.'),
  subjectId: z.uuid('Choose a subject.'),
  termId: z.uuid('Choose a term.'),
  title: z.string().trim().min(1, 'Enter a title.').max(120),
  maxScore: z.coerce.number({ message: 'Enter a number.' }).positive('Must be greater than 0.').max(1000),
});

export const examScoreContextSchema = z.object({
  classId: z.uuid('Choose a class.'),
  subjectId: z.uuid('Choose a subject.'),
  termId: z.uuid('Choose a term.'),
  maxScore: z.coerce.number({ message: 'Enter a number.' }).positive('Must be greater than 0.').max(1000),
});

export const scoreEntriesSchema = z.array(
  z.object({
    studentId: z.uuid(),
    score: z.coerce.number({ message: 'Scores must be numbers.' }).min(0, 'Scores cannot be negative.'),
  }),
);
