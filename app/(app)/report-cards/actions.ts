'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import {
  classTeacherSchema,
  finalSchema,
  gradeScaleRowSchema,
  headmasterTagSchema,
  remarksSchema,
  unlockSchema,
} from '@/lib/validation/report-cards';

function revalidateReportCards() {
  revalidatePath('/report-cards');
  revalidatePath('/report-cards/setup');
}

export async function saveGradeScaleAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const letters = formData.getAll('letter').map(String);
  const minScores = formData.getAll('minScore').map(String);
  const labels = formData.getAll('label').map(String);

  const bands: Array<{ letter: string; minScore: number; label: string }> = [];
  for (let i = 0; i < letters.length; i += 1) {
    const row = { letter: letters[i].trim(), minScoreText: minScores[i]?.trim() ?? '', label: labels[i]?.trim() ?? '' };
    if (row.letter === '' && row.minScoreText === '' && row.label === '') continue;
    const minScore = Number(row.minScoreText);
    const parsed = gradeScaleRowSchema.safeParse({ letter: row.letter, minScore: row.minScoreText === '' ? Number.NaN : minScore, label: row.label });
    if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? 'Check the grade bands.');
    bands.push({ letter: parsed.data.letter, minScore: parsed.data.minScore, label: parsed.data.label });
  }
  if (bands.length === 0) return failure('Add at least one grade band.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_grade_scale', {
    p_institution_id: guard.context.institutionId,
    p_bands: bands,
  });

  if (error) return databaseFailure(error, 'Could not save the grade scale.');

  revalidateReportCards();
  return success(`Grade scale saved with ${bands.length} bands.`);
}

export async function setClassTeacherAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = classTeacherSchema.safeParse({
    classId: formData.get('classId'),
    userId: formData.get('userId') ?? '',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_class_teacher', {
    p_class_id: parsed.data.classId,
    p_user_id: parsed.data.userId === '' ? null : parsed.data.userId,
  });

  if (error) return databaseFailure(error, 'Could not assign the class teacher.');

  revalidateReportCards();
  return success(parsed.data.userId === '' ? 'Class teacher removed.' : 'Class teacher assigned.');
}

export async function setHeadmasterTagAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = headmasterTagSchema.safeParse({
    membershipId: formData.get('membershipId'),
    value: formData.get('value') === 'on',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_headmaster_tag', {
    p_membership_id: parsed.data.membershipId,
    p_value: parsed.data.value,
  });

  if (error) return databaseFailure(error, 'Could not change the headmaster tag.');

  revalidateReportCards();
  return success(parsed.data.value ? 'Headmaster tag added.' : 'Headmaster tag removed.');
}

export async function saveRemarksAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'school_admin', 'staff']);
  if (!guard.ok) return failure(guard.message);

  const parsed = remarksSchema.safeParse({
    termId: formData.get('termId'),
    studentId: formData.get('studentId'),
    classTeacherRemark: formData.get('classTeacherRemark') ?? undefined,
    headmasterRemark: formData.get('headmasterRemark') ?? undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const writes: Array<{ kind: 'class_teacher' | 'headmaster'; body: string }> = [];
  if (parsed.data.classTeacherRemark) writes.push({ kind: 'class_teacher', body: parsed.data.classTeacherRemark });
  if (parsed.data.headmasterRemark) writes.push({ kind: 'headmaster', body: parsed.data.headmasterRemark });
  if (writes.length === 0) return failure('Write a remark before saving.');

  const supabase = await createClient();
  for (const write of writes) {
    const { error } = await supabase.from('report_remarks').upsert(
      {
        institution_id: guard.context.institutionId,
        term_id: parsed.data.termId,
        student_id: parsed.data.studentId,
        kind: write.kind,
        body: write.body,
        written_by: guard.context.userId,
      },
      { onConflict: 'institution_id,term_id,student_id,kind' },
    );
    if (error) return databaseFailure(error, 'Could not save the remark. Check that you can write for this student.');
  }

  revalidateReportCards();
  return success('Remarks saved.');
}

export async function markFinalAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = finalSchema.safeParse({
    termId: formData.get('termId'),
    classId: formData.get('classId'),
    studentIds: formData.getAll('studentId').map(String),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: missing, error: missingError } = await supabase.rpc('report_missing_grades', {
    p_class_id: parsed.data.classId,
    p_term_id: parsed.data.termId,
  });
  if (missingError) return databaseFailure(missingError, 'Could not check the grades.');

  const selected = new Set(parsed.data.studentIds);
  const blocked = (missing ?? []).filter((row: { student_id: string }) => selected.has(row.student_id));
  if (blocked.length > 0) {
    const names = [...new Set(blocked.map((row: { student_name: string }) => row.student_name))].slice(0, 5).join(', ');
    return failure(`Some grades are missing for ${names}. Compute the grades before marking the cards final.`);
  }

  const { data: existing } = await supabase
    .from('report_finals')
    .select('student_id')
    .eq('term_id', parsed.data.termId)
    .in('student_id', parsed.data.studentIds);
  const alreadyFinal = new Set((existing ?? []).map((row) => row.student_id));
  const toMark = parsed.data.studentIds.filter((id) => !alreadyFinal.has(id));
  if (toMark.length === 0) return failure('These report cards are already final.');

  let marked = 0;
  for (const studentId of toMark) {
    const { data: snapshot, error: snapshotError } = await supabase.rpc('report_card_snapshot', {
      p_term_id: parsed.data.termId,
      p_student_id: studentId,
    });
    if (snapshotError) return databaseFailure(snapshotError, 'Could not build a report card.');

    const { error } = await supabase.from('report_finals').insert({
      institution_id: guard.context.institutionId,
      term_id: parsed.data.termId,
      student_id: studentId,
      snapshot,
      marked_by: guard.context.userId,
    });
    if (error) return databaseFailure(error, 'Could not mark a report card final.');
    marked += 1;
  }

  revalidateReportCards();
  return success(`${marked} report ${marked === 1 ? 'card' : 'cards'} marked final.`);
}

export async function unlockFinalAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = unlockSchema.safeParse({
    termId: formData.get('termId'),
    studentId: formData.get('studentId'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_finals')
    .delete()
    .eq('term_id', parsed.data.termId)
    .eq('student_id', parsed.data.studentId)
    .select('id');

  if (error) return databaseFailure(error, 'Could not unlock the report card.');
  if (!data || data.length === 0) return failure('That report card is not final.');

  revalidateReportCards();
  return success('Report card unlocked. Remarks can be changed again.');
}
