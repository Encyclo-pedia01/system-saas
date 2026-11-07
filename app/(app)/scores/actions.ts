'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import {
  assessmentSchema,
  examScoreContextSchema,
  scoreEntriesSchema,
} from '@/lib/validation/schemas';

// Score entries arrive as score_<studentId> fields. Blank fields are skipped.
function readScoreEntries(formData: FormData) {
  const entries: Array<{ studentId: string; score: string }> = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('score_') && typeof value === 'string' && value.trim() !== '') {
      entries.push({ studentId: key.slice('score_'.length), score: value.trim() });
    }
  }

  return entries;
}

export async function createAssessmentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = assessmentSchema.safeParse({
    classId: formData.get('classId'),
    subjectId: formData.get('subjectId'),
    termId: formData.get('termId'),
    title: formData.get('title'),
    maxScore: formData.get('maxScore'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from('assessments').insert({
    institution_id: guard.context.institutionId,
    class_id: parsed.data.classId,
    subject_id: parsed.data.subjectId,
    term_id: parsed.data.termId,
    title: parsed.data.title,
    max_score: parsed.data.maxScore,
    created_by: guard.context.userId,
  });

  if (error) return databaseFailure(error, 'Could not create the assessment.');

  revalidatePath('/scores');
  return success(`Assessment “${parsed.data.title}” created.`);
}

export async function saveAssessmentScoresAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'staff']);
  if (!guard.ok) return failure(guard.message);

  const assessmentId = formData.get('assessmentId');
  const entries = scoreEntriesSchema.safeParse(readScoreEntries(formData));
  if (typeof assessmentId !== 'string' || !entries.success) {
    return failure('Check the scores and try again.');
  }
  if (entries.data.length === 0) {
    return failure('Enter at least one score before saving.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('assessment_scores').upsert(
    entries.data.map((entry) => ({
      institution_id: guard.context.institutionId,
      assessment_id: assessmentId,
      student_id: entry.studentId,
      score: entry.score,
      recorded_by: guard.context.userId,
    })),
    { onConflict: 'assessment_id,student_id' },
  );

  if (error) return databaseFailure(error, 'Could not save the scores. Check that no score exceeds the maximum.');

  revalidatePath('/scores');
  return success(`Saved ${entries.data.length} score${entries.data.length === 1 ? '' : 's'}.`);
}

export async function saveExamScoresAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'staff']);
  if (!guard.ok) return failure(guard.message);

  const context = examScoreContextSchema.safeParse({
    classId: formData.get('classId'),
    subjectId: formData.get('subjectId'),
    termId: formData.get('termId'),
    maxScore: formData.get('maxScore'),
  });
  if (!context.success) return fromZodError(context.error);

  const entries = scoreEntriesSchema.safeParse(readScoreEntries(formData));
  if (!entries.success) return failure('Check the scores and try again.');
  if (entries.data.length === 0) return failure('Enter at least one score before saving.');

  const supabase = await createClient();
  const { error } = await supabase.from('exam_scores').upsert(
    entries.data.map((entry) => ({
      institution_id: guard.context.institutionId,
      class_id: context.data.classId,
      subject_id: context.data.subjectId,
      term_id: context.data.termId,
      student_id: entry.studentId,
      score: entry.score,
      max_score: context.data.maxScore,
      recorded_by: guard.context.userId,
    })),
    { onConflict: 'term_id,subject_id,student_id' },
  );

  if (error) return databaseFailure(error, 'Could not save the exam scores. Check that no score exceeds the maximum.');

  revalidatePath('/scores');
  return success(`Saved ${entries.data.length} exam score${entries.data.length === 1 ? '' : 's'}.`);
}
