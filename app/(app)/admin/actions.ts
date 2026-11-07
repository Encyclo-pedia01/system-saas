'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { getViewer } from '@/lib/auth/viewer';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  createSchoolSchema,
  impersonationSchema,
  toggleStatusSchema,
} from '@/lib/validation/schemas';

const impersonationMinutes = 30;

async function requireSuperAdminId(): Promise<string | null> {
  const viewer = await getViewer();
  return viewer?.isSuperAdmin ? viewer.userId : null;
}

export async function createSchoolAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ institutionId: string }>> {
  const actorId = await requireSuperAdminId();

  if (!actorId) {
    return failure('You do not have permission to do that.');
  }

  const parsed = createSchoolSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    timezone: formData.get('timezone'),
    schoolStartTime: formData.get('schoolStartTime'),
    gracePeriodMinutes: formData.get('gracePeriodMinutes'),
    ownerName: formData.get('ownerName'),
    ownerEmail: formData.get('ownerEmail'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .insert({
      name: input.name,
      slug: input.slug,
      timezone: input.timezone,
      school_start_time: input.schoolStartTime,
      grace_period_minutes: input.gracePeriodMinutes,
    })
    .select('id')
    .single();

  if (institutionError || !institution) {
    return databaseFailure(institutionError ?? { message: 'missing row' }, 'Could not create the school.');
  }

  const admin = createAdminClient();
  const rollbackInstitution = () => admin.from('institutions').delete().eq('id', institution.id);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.ownerEmail, {
    data: { full_name: input.ownerName },
    redirectTo: `${siteUrl()}/auth/callback?next=/set-password`,
  });

  if (inviteError || !invited.user) {
    await rollbackInstitution();
    const alreadyExists = inviteError?.message.toLowerCase().includes('already');
    return failure(
      alreadyExists
        ? 'That email already has an account. Use a different owner email.'
        : 'Could not send the owner invitation.',
    );
  }

  const { error: membershipError } = await supabase.from('memberships').insert({
    user_id: invited.user.id,
    institution_id: institution.id,
    role: 'owner',
  });

  if (membershipError) {
    await rollbackInstitution();
    await admin.auth.admin.deleteUser(invited.user.id);
    return databaseFailure(membershipError, 'Could not link the owner to the school.');
  }

  await supabase.from('invitations').insert({
    institution_id: institution.id,
    email: input.ownerEmail,
    role: 'owner',
    invited_by: actorId,
  });

  revalidatePath('/admin');
  return success(`Invitation sent to ${input.ownerEmail}.`, { institutionId: institution.id });
}

export async function toggleSchoolStatusAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireSuperAdminId())) {
    return failure('You do not have permission to do that.');
  }

  const parsed = toggleStatusSchema.safeParse({
    institutionId: formData.get('institutionId'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('institutions')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.institutionId)
    .select('id, name, status')
    .single();

  if (error || !data) {
    return databaseFailure(error ?? { message: 'no row' }, 'Could not update the school status.');
  }

  revalidatePath('/admin');
  const label = parsed.data.status === 'suspended' ? 'suspended' : 'reactivated';
  return success(`${data.name} has been ${label}.`);
}

export async function startImpersonationAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actorId = await requireSuperAdminId();

  if (!actorId) {
    return failure('You do not have permission to do that.');
  }

  const parsed = impersonationSchema.safeParse({
    institutionId: formData.get('institutionId'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();

  const { data: owner, error: ownerError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('institution_id', parsed.data.institutionId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (ownerError || !owner) {
    return failure('This school has no owner to view as.');
  }

  await supabase
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('actor_id', actorId)
    .is('ended_at', null);

  const expiresAt = new Date(Date.now() + impersonationMinutes * 60_000).toISOString();

  const { error } = await supabase.from('impersonation_sessions').insert({
    actor_id: actorId,
    target_user_id: owner.user_id,
    institution_id: parsed.data.institutionId,
    reason: parsed.data.reason,
    expires_at: expiresAt,
  });

  if (error) {
    return databaseFailure(error, 'Could not start the view-as session.');
  }

  redirect('/dashboard');
}

export async function stopImpersonationAction(): Promise<void> {
  const actorId = await requireSuperAdminId();

  if (actorId) {
    const supabase = await createClient();
    await supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('actor_id', actorId)
      .is('ended_at', null);
  }

  redirect('/admin');
}
