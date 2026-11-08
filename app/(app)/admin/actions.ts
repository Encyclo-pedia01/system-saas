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
  subscriptionSchema,
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
): Promise<ActionResult<{ institutionId: string; inviteLink: string }>> {
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

  if (institutionError?.code === '23505') {
    return failure('That URL slug is already used by another school. Choose a different slug.');
  }

  if (institutionError || !institution) {
    return databaseFailure(institutionError ?? { message: 'missing row' }, 'Could not create the school.');
  }

  const admin = createAdminClient();
  const rollbackInstitution = () => admin.from('institutions').delete().eq('id', institution.id);

  // No email is sent from here. The link is returned for the super admin to copy and send,
  // the same way staff invitations work.
  const { data: generated, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: input.ownerEmail,
    options: { data: { full_name: input.ownerName } },
  });

  if (inviteError || !generated.user || !generated.properties?.hashed_token) {
    await rollbackInstitution();
    const alreadyExists = inviteError?.message.toLowerCase().includes('already');
    return failure(
      alreadyExists
        ? 'That email already has an account. Use a different owner email.'
        : 'Could not create the owner invitation. Try again.',
    );
  }

  const ownerUserId = generated.user.id;
  const { error: membershipError } = await supabase.from('memberships').insert({
    user_id: ownerUserId,
    institution_id: institution.id,
    role: 'owner',
  });

  if (membershipError) {
    await rollbackInstitution();
    await admin.auth.admin.deleteUser(ownerUserId);
    return databaseFailure(membershipError, 'Could not link the owner to the school.');
  }

  const inviteLink = `${siteUrl()}/auth/callback?token_hash=${encodeURIComponent(generated.properties.hashed_token)}&type=invite&next=${encodeURIComponent('/set-password')}`;

  await supabase.from('invitations').insert({
    institution_id: institution.id,
    email: input.ownerEmail,
    role: 'owner',
    invited_by: actorId,
  });

  revalidatePath('/admin');
  return success(
    `School created. Copy the owner's invitation link and send it to ${input.ownerEmail}.`,
    { institutionId: institution.id, inviteLink },
  );
}

// Changes a school's plan, paid-until date, and licence reference. Owners cannot change these
// (institutions can only be updated by the platform administrator). Changes are audited automatically.
export async function updateSubscriptionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireSuperAdminId())) {
    return failure('You do not have permission to do that.');
  }

  const parsed = subscriptionSchema.safeParse({
    institutionId: formData.get('institutionId'),
    plan: formData.get('plan'),
    subscriptionEndsOn: formData.get('subscriptionEndsOn') ?? '',
    licenceReference: formData.get('licenceReference') ?? '',
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('institutions')
    .update({
      plan: parsed.data.plan,
      subscription_ends_on: parsed.data.subscriptionEndsOn,
      licence_reference: parsed.data.licenceReference,
    })
    .eq('id', parsed.data.institutionId)
    .select('name')
    .maybeSingle();

  if (error) return databaseFailure(error, 'Could not update the subscription.');
  if (!data) return failure('That school could not be found.');

  revalidatePath('/admin');
  return success(`Subscription updated for ${data.name}.`);
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
