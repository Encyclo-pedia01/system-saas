'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { SCHOOL_LOGO_BUCKET, SCHOOL_LOGO_MAX_BYTES, SCHOOL_LOGO_TYPES } from '@/lib/school-logo';
import { createClient } from '@/lib/supabase/server';

function revalidateLogoPages() {
  revalidatePath('/report-cards');
  revalidatePath('/report-cards/setup');
  revalidatePath('/report-cards/preview');
  revalidatePath('/report-cards/print');
}

export async function uploadSchoolLogoAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return failure('Choose a logo image first.');
  if (file.size > SCHOOL_LOGO_MAX_BYTES) return failure('The logo must be 1 MB or smaller.');
  const extension = SCHOOL_LOGO_TYPES[file.type];
  if (!extension) return failure('The logo must be a PNG, JPG or WebP image.');

  const institutionId = guard.context.institutionId;
  const supabase = await createClient();
  const { data: current } = await supabase.from('institutions').select('logo_path').eq('id', institutionId).maybeSingle();

  const path = `${institutionId}/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(SCHOOL_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '3600' });
  if (uploadError) return failure('Could not upload the logo. Try again.');

  const { error } = await supabase.rpc('set_school_logo', { p_institution_id: institutionId, p_path: path });
  if (error) {
    await supabase.storage.from(SCHOOL_LOGO_BUCKET).remove([path]);
    return databaseFailure(error, 'Could not save the logo.');
  }

  if (current?.logo_path && current.logo_path !== path) {
    await supabase.storage.from(SCHOOL_LOGO_BUCKET).remove([current.logo_path]);
  }

  revalidateLogoPages();
  return success('Logo saved.');
}

export async function removeSchoolLogoAction(): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const institutionId = guard.context.institutionId;
  const supabase = await createClient();
  const { data: current } = await supabase.from('institutions').select('logo_path').eq('id', institutionId).maybeSingle();

  const { error } = await supabase.rpc('set_school_logo', { p_institution_id: institutionId, p_path: null });
  if (error) return databaseFailure(error, 'Could not remove the logo.');

  if (current?.logo_path) {
    await supabase.storage.from(SCHOOL_LOGO_BUCKET).remove([current.logo_path]);
  }

  revalidateLogoPages();
  return success('Logo removed.');
}
