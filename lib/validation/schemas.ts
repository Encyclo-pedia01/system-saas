import { z } from 'zod';

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 08:00.');

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
  timezone: z.literal('Africa/Accra', { message: 'Campus Veritas schools use Ghana time (Africa/Accra).' }),
  schoolStartTime: timeOfDay,
  gracePeriodMinutes: z.coerce
    .number({ message: 'Enter a number of minutes.' })
    .int()
    .min(0)
    .max(120),
  ownerName: z.string().trim().min(2, 'Enter the owner’s name.').max(120),
  ownerEmail: z.email('Enter a valid owner email.').trim().toLowerCase(),
});

export const inviteMemberSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  role: z.enum(['staff'], { message: 'Choose a role.' }),
});

export const invitationTokenSchema = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'This invitation link is not valid.');

export const subscriptionSchema = z.object({
  institutionId: z.uuid(),
  plan: z.enum(['trial', 'paid'], { message: 'Choose a plan.' }),
  subscriptionEndsOn: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use a valid date.')
    .transform((value) => (value === '' ? null : value)),
  licenceReference: z
    .string()
    .trim()
    .max(80, 'Use at most 80 characters.')
    .transform((value) => (value === '' ? null : value)),
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

// Group names arrive as one comma-separated field, for example "A, B".
export const studentSchema = z.object({
  classId: z.uuid('Choose a class.'),
  groupId: z.uuid('Choose a group.').nullable(),
  fullName: z.string().trim().min(2, 'Enter the student’s full name.').max(120),
});

export const importStudentsSchema = z.object({
  classId: z.uuid('Choose a class.'),
  groupId: z.uuid().nullable(),
  students: z
    .array(
      z.object({
        fullName: z.string().trim().min(2).max(120),
      }),
    )
    .min(1, 'There are no ready rows to import.')
    .max(500, 'Import at most 500 students at a time.'),
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

export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Enter a subject name.').max(80),
});

export const termSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a term name.').max(60),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date.'),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an end date.'),
  })
  .refine((value) => value.endsOn >= value.startsOn, {
    message: 'The end date must be on or after the start date.',
    path: ['endsOn'],
  });

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
});
