'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import { classSchema, studentSchema } from '@/lib/validation/schemas';

export async function createClassAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = classSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('classes')
    .insert({ institution_id: guard.context.institutionId, name: parsed.data.name });

  if (error) return databaseFailure(error, 'Could not create the class.');

  revalidatePath('/students');
  return success(`Class “${parsed.data.name}” created.`);
}

export async function createStudentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = studentSchema.safeParse({
    classId: formData.get('classId'),
    fullName: formData.get('fullName'),
    admissionNumber: formData.get('admissionNumber'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from('students').insert({
    institution_id: guard.context.institutionId,
    class_id: parsed.data.classId,
    full_name: parsed.data.fullName,
    admission_number: parsed.data.admissionNumber,
  });

  if (error) return databaseFailure(error, 'Could not add the student.');

  revalidatePath('/students');
  return success(`${parsed.data.fullName} added.`);
}
