'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { assertWritable, getViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { computeGradesSchema, gradingWeightsSchema } from '@/lib/validation/schemas';

async function ownerWriteGuard(): Promise<{ userId: string; message: string | null }> {
  const viewer = await getViewer();

  if (!viewer || viewer.effectiveRole !== 'owner') {
    return { userId: '', message: 'Only the school owner can manage grading.' };
  }

  return { userId: viewer.userId, message: assertWritable(viewer) };
}

export async function saveGradingWeightsAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await ownerWriteGuard();

  if (guard.message) {
    return failure(guard.message);
  }

  const parsed = gradingWeightsSchema.safeParse({
    assessment: formData.get('assessment'),
    exam: formData.get('exam'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('memberships')
    .select('institution_id')
    .eq('user_id', guard.userId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return failure('Only the school owner can manage grading.');
  }

  const { error } = await supabase.from('grading_keys').upsert(
    {
      institution_id: membership.institution_id,
      weights: { assessment: parsed.data.assessment, exam: parsed.data.exam },
      updated_by: guard.userId,
    },
    { onConflict: 'institution_id' },
  );

  if (error) {
    return databaseFailure(error, 'Could not save the grading weights.');
  }

  revalidatePath('/grading');
  return success('Grading weights saved.');
}

export async function computeFinalGradesAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ computed: number; skipped: number }>> {
  const guard = await ownerWriteGuard();

  if (guard.message) {
    return failure(guard.message);
  }

  const parsed = computeGradesSchema.safeParse({
    termId: formData.get('termId'),
    subjectId: formData.get('subjectId'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('compute_final_grade', {
    p_term_id: parsed.data.termId,
    p_subject_id: parsed.data.subjectId,
  });

  if (error) {
    return databaseFailure(error, 'Could not compute final grades.');
  }

  const row = (data as Array<{ computed_count: number; skipped_count: number }>)[0];
  const computed = row?.computed_count ?? 0;
  const skipped = row?.skipped_count ?? 0;

  revalidatePath('/grading');
  revalidatePath('/dashboard');
  return success(
    `Computed ${computed} final grade${computed === 1 ? '' : 's'}. ${skipped} student${skipped === 1 ? '' : 's'} skipped (no exam score).`,
    { computed, skipped },
  );
}
