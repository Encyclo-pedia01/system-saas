'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createInvitationToken, hashInvitationToken } from '@/lib/invitations/token';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { inviteMemberSchema } from '@/lib/validation/schemas';

const invitationDays = 7;

// Redirect after the invitation email link: sign in, set a password, then accept.
function inviteRedirect(token: string): string {
  const afterPassword = `/set-password?next=${encodeURIComponent(`/invite/${token}`)}`;
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(afterPassword)}`;
}

export async function inviteMemberAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, role } = parsed.data;
  const institutionId = guard.context.institutionId;
  const token = createInvitationToken();
  const supabase = await createClient();

  const { error } = await supabase.from('invitations').insert({
    institution_id: institutionId,
    email,
    role,
    invited_by: guard.context.userId,
    token_hash: hashInvitationToken(token),
    expires_at: new Date(Date.now() + invitationDays * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    if (error.code === '23505') {
      return failure('That email already has a pending invitation. Cancel it first to send a new one.');
    }
    return databaseFailure(error, 'Could not create the invitation.');
  }

  // Email is best-effort: if it fails, the owner shares the link instead.
  const admin = createAdminClient();
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirect(token),
  });

  const link = `${siteUrl()}/invite/${token}`;
  revalidatePath('/team');

  if (emailError) {
    return success(
      'Invitation created. The email could not be sent, so share the link below with them.',
      { link, emailed: false },
    );
  }

  return success(`Invitation emailed to ${email}. You can also share the link below.`, { link, emailed: true });
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return;

  const invitationId = String(formData.get('invitationId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return;

  const supabase = await createClient();
  await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('institution_id', guard.context.institutionId)
    .is('accepted_at', null)
    .is('revoked_at', null);

  revalidatePath('/team');
}
