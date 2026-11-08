import { z } from 'zod';

export const classLevels = ['pre_school', 'primary', 'jhs'] as const;
export type ClassLevel = (typeof classLevels)[number];

export const levelLabels: Record<ClassLevel, string> = {
  pre_school: 'Pre-school',
  primary: 'Primary (Basic)',
  jhs: 'Junior High School',
};

// Class names the school uses for each level. The owner can also type another name.
export const presetClassNames: Record<ClassLevel, string[]> = {
  pre_school: ['Creche', 'Nursery 1', 'Nursery 2', 'Kindergarten 1 (KG1)', 'Kindergarten 2 (KG2)'],
  primary: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'],
  jhs: ['Basic 7', 'Basic 8', 'Basic 9'],
};

export function isClassLevel(value: unknown): value is ClassLevel {
  return typeof value === 'string' && (classLevels as readonly string[]).includes(value);
}

const groupNamesField = z
  .array(z.string().min(1).max(40, 'Keep group names under 40 characters.'))
  .max(20, 'Use at most 20 groups.');

export const addClassSchema = z
  .object({
    level: z.enum(classLevels, { message: 'Choose the class level.' }),
    name: z.string().trim().min(1, 'Choose or enter a class name.').max(60),
    hasGroups: z.boolean(),
    groupNames: groupNamesField,
    teacherMode: z.enum(['none', 'existing', 'invite']),
    teacherUserId: z.string(),
    teacherEmail: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.hasGroups && value.groupNames.length === 0) {
      context.addIssue({ code: 'custom', path: ['groupNames'], message: 'Add at least one group, such as A or B.' });
    }
    if (value.teacherMode === 'existing' && !z.uuid().safeParse(value.teacherUserId).success) {
      context.addIssue({ code: 'custom', path: ['teacherUserId'], message: 'Choose a teacher.' });
    }
    if (value.teacherMode === 'invite' && !z.email().safeParse(value.teacherEmail).success) {
      context.addIssue({ code: 'custom', path: ['teacherEmail'], message: 'Enter the teacher’s email address.' });
    }
  });

export const editClassSchema = z.object({
  classId: z.uuid('Choose a class.'),
  level: z.enum(classLevels, { message: 'Choose the class level.' }),
  name: z.string().trim().min(1, 'Enter a class name.').max(60),
  hasGroups: z.boolean(),
  newGroupNames: groupNamesField,
});

export const classTeacherSchema = z.object({
  classId: z.uuid('Choose a class.'),
  email: z.email('Enter a valid email address.'),
});

export const assignTeacherSchema = z.object({
  classId: z.uuid('Choose a class.'),
  userId: z.string(),
});

export function parseGroupList(raw: string): string[] {
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter((name, index, all) => name.length > 0 && all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
}
