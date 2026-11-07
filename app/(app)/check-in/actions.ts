'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { assertWritable, getViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { studentActionSchema } from '@/lib/validation/schemas';

async function authorityWriteGuard(): Promise<string | null> {
  const viewer = await getViewer();

  if (!viewer || viewer.effectiveRole !== 'authority') {
    return 'Only authority staff can record attendance.';
  }

  return assertWritable(viewer);
}

export async function checkInStudentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const guardMessage = await authorityWriteGuard();

  if (guardMessage) {
    return failure(guardMessage);
  }

  const parsed = studentActionSchema.safeParse({ studentId: formData.get('studentId') });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_check_in', { p_student_id: parsed.data.studentId });

  if (error) {
    return databaseFailure(error, 'Could not record the check-in.');
  }

  revalidatePath('/check-in');
  const status = (data as { status: string }).status;
  return success(status === 'late' ? 'Checked in as late.' : 'Checked in on time.', { status });
}

export async function markAbsentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guardMessage = await authorityWriteGuard();

  if (guardMessage) {
    return failure(guardMessage);
  }

  const parsed = studentActionSchema.safeParse({ studentId: formData.get('studentId') });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_absence', { p_student_id: parsed.data.studentId });

  if (error) {
    return databaseFailure(error, 'Could not record the absence.');
  }

  revalidatePath('/check-in');
  return success('Marked as absent for today.');
}
