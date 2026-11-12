'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { isSuggestedSubject } from '@/lib/subjects/suggested';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import {
  importStudentsSchema,
  studentSchema,
  subjectSchema,
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

export async function createSchoolYearAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const startYear = Number(formData.get('startYear'));
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    return failure('Enter the year the school year starts, for example 2026.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_school_year', {
    p_institution_id: guard.context.institutionId,
    p_start_year: startYear,
  });

  if (error) return databaseFailure(error, 'Could not set up this school year. It may already exist.');

  revalidatePath('/students');
  revalidatePath('/scores');
  revalidatePath('/grading');
  return success(`${startYear}/${String((startYear + 1) % 100).padStart(2, '0')} school year created with three terms.`);
}

export async function setClassSubjectsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const classId = String(formData.get('classId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return failure('Choose a class first.');

  const wanted = new Set(
    formData.getAll('subjectId').map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
  );

  const supabase = await createClient();
  const institutionId = guard.context.institutionId;
  const { data: current, error: readError } = await supabase
    .from('class_subjects')
    .select('subject_id')
    .eq('institution_id', institutionId)
    .eq('class_id', classId);
  if (readError) return databaseFailure(readError, 'Could not read the class subjects.');

  const existing = new Set((current ?? []).map((row) => row.subject_id as string));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('class_subjects')
      .delete()
      .eq('institution_id', institutionId)
      .eq('class_id', classId)
      .in('subject_id', toRemove);
    if (error) return databaseFailure(error, 'Could not remove a subject from this class.');
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('class_subjects')
      .insert(toAdd.map((subjectId) => ({ institution_id: institutionId, class_id: classId, subject_id: subjectId })));
    if (error) return databaseFailure(error, 'Could not add the subjects to this class.');
  }

  revalidatePath('/students');
  revalidatePath('/scores');
  return success('Subjects saved for this class.');
}

export async function createSuggestedSubjectAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const name = String(formData.get('name') ?? '');
  if (!isSuggestedSubject(name)) return failure('Choose a subject from the suggested list.');

  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from('subjects')
    .select('id')
    .eq('institution_id', guard.context.institutionId)
    .ilike('name', name)
    .limit(1);
  if (lookupError) return databaseFailure(lookupError, 'Could not check existing subjects.');
  if (existing && existing.length > 0) return failure(`“${name}” is already on your list.`);

  const { error } = await supabase
    .from('subjects')
    .insert({ institution_id: guard.context.institutionId, name });
  if (error) return databaseFailure(error, 'Could not add the subject.');

  revalidatePath('/students');
  revalidatePath('/scores');
  return success(`Subject “${name}” added.`);
}
