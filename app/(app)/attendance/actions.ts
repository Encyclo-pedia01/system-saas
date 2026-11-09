'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, success } from '@/lib/actions/result';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

const uuidPattern = /^[0-9a-f-]{36}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// Saves one class's register for one day. Every student in the class gets a row, so a
// save always records a full register, not only the ticks that changed.
export async function saveAttendanceAction(
  _previous: ActionResult<{ present: number; total: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ present: number; total: number }>> {
  const viewer = await requireEffectiveRole(['owner', 'staff']);
  if (viewer.readOnly) {
    return failure('You can view attendance but not change it.');
  }

  const classId = String(formData.get('classId') ?? '');
  const date = String(formData.get('date') ?? '');
  if (!uuidPattern.test(classId) || !datePattern.test(date)) {
    return failure('Choose a class and a date first.');
  }

  const studentIds = formData.getAll('studentId').map(String);
  if (studentIds.length === 0 || studentIds.some((id) => !uuidPattern.test(id))) {
    return failure('This class has no students to mark.');
  }
  const presentIds = new Set(formData.getAll('present').map(String));

  const institutionId = viewer.institution!.id;
  const supabase = await createClient();

  const rows = studentIds.map((studentId) => ({
    institution_id: institutionId,
    class_id: classId,
    student_id: studentId,
    attendance_date: date,
    present: presentIds.has(studentId),
  }));

  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'class_id,student_id,attendance_date' });
  if (error) {
    return databaseFailure(error, 'Could not save attendance. Try again.');
  }

  revalidatePath('/attendance');
  const present = rows.filter((row) => row.present).length;
  return success(`Saved. ${present} of ${rows.length} present.`, { present, total: rows.length });
}
