'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { assertWritable, getViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { insightActionSchema } from '@/lib/validation/schemas';

export async function resolveInsightAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await getViewer();

  if (!viewer || (viewer.effectiveRole !== 'owner' && viewer.effectiveRole !== 'school_admin')) {
    return failure('Only the school owner can resolve insights.');
  }

  const writeMessage = assertWritable(viewer);

  if (writeMessage) {
    return failure(writeMessage);
  }

  const parsed = insightActionSchema.safeParse({ insightId: formData.get('insightId') });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('insights')
    .update({ status: 'resolved' })
    .eq('id', parsed.data.insightId)
    .select('id')
    .maybeSingle();

  if (error) {
    return databaseFailure(error, 'Could not resolve this insight.');
  }

  if (!data) {
    return failure('That insight could not be found.');
  }

  revalidatePath('/dashboard');
  return success('Insight marked as resolved.');
}
