'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import {
  importStudentsSchema,
  studentSchema,
  subjectSchema,
  termSchema,
} from '@/lib/validation/schemas';

export async function importStudentsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'school_admin']);
  if (!guard.ok) return failure(guard.message);

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('students') ?? '[]'));
  } catch {
    return failure('The upload could not be read. Save the file as .csv or .xlsx and try again.');
  }

  const rawGroup = String(formData.get('groupId') ?? '');
  const parsed = importStudentsSchema.safeParse({
    classId: formData.get('classId'),
    groupId: rawGroup === '' ? null : rawGroup,
    students: payload,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const institutionId = guard.context.institutionId;

  const { data: schoolClass, error: classError } = await supabase
    .from('classes')
    .select('id, has_groups')
    .eq('id', parsed.data.classId)
    .eq('institution_id', institutionId)
    .maybeSingle();

  if (classError) return databaseFailure(classError, 'Could not read the class.');
  if (!schoolClass) return failure('Choose a class from the list. If it is missing, create the class first.');

  if (schoolClass.has_groups && !parsed.data.groupId) {
    return failure('This class has groups, so choose the group these students belong to.');
  }

  if (!schoolClass.has_groups && parsed.data.groupId) {
    return failure('This class has no groups, so leave the group empty.');
  }

  const admissionNumbers = parsed.data.students.map((s) => s.admissionNumber);
  const { data: existing, error: existingError } = await supabase
    .from('students')
    .select('admission_number')
    .eq('institution_id', institutionId)
    .in('admission_number', admissionNumbers);

  if (existingError) return databaseFailure(existingError, 'Could not check existing students.');

  const taken = new Set((existing ?? []).map((row) => row.admission_number.toLowerCase()));
  const fresh = parsed.data.students.filter((s) => !taken.has(s.admissionNumber.toLowerCase()));

  if (fresh.length === 0) {
    return failure('All of these students are already enrolled, so nothing was imported.');
  }

  const { error } = await supabase.from('students').insert(
    fresh.map((s) => ({
      institution_id: institutionId,
      class_id: parsed.data.classId,
      group_id: parsed.data.groupId,
      full_name: s.fullName,
      admission_number: s.admissionNumber,
    })),
  );

  if (error) return databaseFailure(error, 'Could not import the students. Nothing was saved. Try again in a moment.');

  const skipped = parsed.data.students.length - fresh.length;
  revalidatePath('/students');
  return success(
    skipped > 0
      ? `Imported ${fresh.length} students. Skipped ${skipped} already enrolled.`
      : `Imported ${fresh.length} students.`,
  );
}

export async function createStudentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'school_admin']);
  if (!guard.ok) return failure(guard.message);

  const rawGroup = String(formData.get('groupId') ?? '');
  const parsed = studentSchema.safeParse({
    classId: formData.get('classId'),
    groupId: rawGroup === '' ? null : rawGroup,
    fullName: formData.get('fullName'),
    admissionNumber: formData.get('admissionNumber'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from('students').insert({
    institution_id: guard.context.institutionId,
    class_id: parsed.data.classId,
    group_id: parsed.data.groupId,
    full_name: parsed.data.fullName,
    admission_number: parsed.data.admissionNumber,
  });

  if (error) return databaseFailure(error, 'Could not add the student. The admission number may already be in use.');

  revalidatePath('/students');
  return success(`${parsed.data.fullName} added.`);
}

export async function createSubjectAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = subjectSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('subjects')
    .insert({ institution_id: guard.context.institutionId, name: parsed.data.name });

  if (error) return databaseFailure(error, 'Could not create the subject. It may already exist.');

  revalidatePath('/students');
  revalidatePath('/scores');
  return success(`Subject “${parsed.data.name}” created.`);
}

export async function createTermAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = termSchema.safeParse({
    name: formData.get('name'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from('terms').insert({
    institution_id: guard.context.institutionId,
    name: parsed.data.name,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
  });

  if (error) return databaseFailure(error, 'Could not create the term. Check the dates and try again.');

  revalidatePath('/students');
  revalidatePath('/scores');
  revalidatePath('/grading');
  return success(`Term “${parsed.data.name}” created.`);
}
