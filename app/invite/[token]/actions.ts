'use server';

import { redirect } from 'next/navigation';

import { hashInvitationToken } from '@/lib/invitations/token';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { invitationTokenSchema } from '@/lib/validation/schemas';

export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const parsed = invitationTokenSchema.safeParse(formData.get('token'));
  if (!parsed.success) redirect('/login');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) redirect(`/login?next=${encodeURIComponent(`/invite/${parsed.data}`)}`);

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, email, role, kind, class_id, institution_id, accepted_at, revoked_at, expires_at, institution:institutions(status)')
    .eq('token_hash', hashInvitationToken(parsed.data))
    .maybeSingle();

  const institution = invitation?.institution as unknown as { status: string } | null;

  if (
    !invitation ||
    invitation.revoked_at ||
    invitation.accepted_at ||
    new Date(invitation.expires_at) <= new Date() ||
    institution?.status !== 'active' ||
    invitation.email.toLowerCase() !== user.email.toLowerCase()
  ) {
    redirect(`/invite/${parsed.data}`);
  }

  const { error: membershipError } = await admin.from('memberships').upsert(
    {
      user_id: user.id,
      institution_id: invitation.institution_id,
      role: invitation.role,
    },
    { onConflict: 'user_id,institution_id', ignoreDuplicates: true },
  );

  if (membershipError) redirect(`/invite/${parsed.data}`);

  // A class-teacher link also makes this person the teacher of that class.
  if (invitation.kind === 'class_teacher' && invitation.class_id) {
    const { error: classTeacherError } = await admin.from('class_teachers').upsert(
      {
        institution_id: invitation.institution_id,
        class_id: invitation.class_id,
        user_id: user.id,
      },
      { onConflict: 'institution_id,class_id' },
    );
    if (classTeacherError) redirect(`/invite/${parsed.data}`);
  }

  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .is('accepted_at', null);

  redirect('/dashboard');
}
