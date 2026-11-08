'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import { examScoreContextSchema } from '@/lib/validation/schemas';
import { importScoresSchema } from '@/lib/validation/score-import';

type WriteContext = { institutionId: string; classId: string; maxScore: number; recordedBy: string };
type ScoreTarget =
  | { table: 'assessment_scores'; assessmentId: string }
  | { table: 'exam_scores'; subjectId: string; termId: string };

async function writeRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: ScoreTarget,
  rows: Array<{ studentId: string; score: number }>,
  context: WriteContext,
) {
  if (target.table === 'assessment_scores') {
    return supabase.from('assessment_scores').upsert(
      rows.map((r) => ({
        institution_id: context.institutionId,
        assessment_id: target.assessmentId,
        student_id: r.studentId,
        score: r.score,
        recorded_by: context.recordedBy,
      })),
      { onConflict: 'assessment_id,student_id' },
    );
  }

  return supabase.from('exam_scores').upsert(
    rows.map((r) => ({
      institution_id: context.institutionId,
      class_id: context.classId,
      subject_id: target.subjectId,
      term_id: target.termId,
      student_id: r.studentId,
      score: r.score,
      max_score: context.maxScore,
      recorded_by: context.recordedBy,
    })),
    { onConflict: 'term_id,subject_id,student_id' },
  );
}

// Imports a checked score file into one assessment, or into exam scores for a subject and term.
// Every row is matched to a student in the chosen class by admission number. If any row does not
// match, nothing is saved, so the file is either fully applied or not at all.
export async function importScoresAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ saved: number; replaced: number }>> {
  const guard = await resolveWriteContext(['owner', 'school_admin', 'staff']);
  if (!guard.ok) return failure(guard.message);

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('rows') ?? '[]'));
  } catch {
    return failure('The upload could not be read. Upload the file again.');
  }

  const parsedRows = importScoresSchema.safeParse({ students: payload });
  if (!parsedRows.success) return fromZodError(parsedRows.error);

  const mode = formData.get('mode');
  const supabase = await createClient();
  const institutionId = guard.context.institutionId;

  let classId: string;
  let maxScore: number;
  let target: ScoreTarget;

  if (mode === 'assessment') {
    const assessmentId = String(formData.get('assessmentId') ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) return failure('Choose an assessment from the list. Create one first if none is listed.');

    const { data: assessment, error } = await supabase
      .from('assessments')
      .select('id, class_id, max_score')
      .eq('id', assessmentId)
      .eq('institution_id', institutionId)
      .maybeSingle();

    if (error) return databaseFailure(error, 'Could not read the assessment.');
    if (!assessment) return failure('That assessment could not be found. Refresh the page and try again.');

    classId = assessment.class_id;
    maxScore = Number(assessment.max_score);
    target = { table: 'assessment_scores', assessmentId };
  } else if (mode === 'exam') {
    const context = examScoreContextSchema.safeParse({
      classId: formData.get('classId'),
      subjectId: formData.get('subjectId'),
      termId: formData.get('termId'),
      maxScore: formData.get('maxScore'),
    });
    if (!context.success) return fromZodError(context.error);

    classId = context.data.classId;
    maxScore = context.data.maxScore;
    target = { table: 'exam_scores', subjectId: context.data.subjectId, termId: context.data.termId };
  } else {
    return failure('Choose assessment or exam scores.');
  }

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, admission_number')
    .eq('institution_id', institutionId)
    .eq('class_id', classId);

  if (studentsError) return databaseFailure(studentsError, 'Could not read the students in this class.');

  const byAdmission = new Map((students ?? []).map((s) => [s.admission_number.toLowerCase(), s.id]));
  const unmatched: string[] = [];
  const rows: Array<{ studentId: string; score: number }> = [];

  for (const row of parsedRows.data.students) {
    const studentId = byAdmission.get(row.admissionNumber.toLowerCase());
    if (!studentId) {
      unmatched.push(row.admissionNumber);
      continue;
    }
    if (row.score > maxScore) {
      return failure(`Score ${row.score} for ${row.admissionNumber} is above the maximum of ${maxScore}. Nothing was saved.`);
    }
    rows.push({ studentId, score: row.score });
  }

  if (unmatched.length > 0) {
    const shown = unmatched.slice(0, 5).join(', ');
    const more = unmatched.length > 5 ? ` and ${unmatched.length - 5} more` : '';
    return failure(`These admission numbers are not in the selected class: ${shown}${more}. Nothing was saved.`);
  }

  const studentIds = rows.map((r) => r.studentId);
  let existingQuery = supabase.from(target.table).select('student_id').in('student_id', studentIds);
  existingQuery = target.table === 'assessment_scores'
    ? existingQuery.eq('assessment_id', target.assessmentId)
    : existingQuery.eq('term_id', target.termId).eq('subject_id', target.subjectId);
  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) return databaseFailure(existingError, 'Could not check existing scores.');

  const replaced = (existing ?? []).length;

  const { error } = await writeRows(supabase, target, rows, {
    institutionId,
    classId,
    maxScore,
    recordedBy: guard.context.userId,
  });
  if (error) return databaseFailure(error, 'Could not save the scores. Nothing was saved.');

  revalidatePath('/scores');
  revalidatePath('/grading');

  const message =
    `Saved ${rows.length} score${rows.length === 1 ? '' : 's'}` +
    (replaced > 0 ? `, replacing ${replaced} earlier one${replaced === 1 ? '' : 's'}.` : '.') +
    ' Compute grades again on the Grading page to update results.';

  return success(message, { saved: rows.length, replaced });
}
