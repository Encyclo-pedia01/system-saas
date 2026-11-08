import type { Metadata } from 'next';

import { revokeInvitationAction } from '@/app/(app)/team/actions';
import { InviteMemberForm } from '@/components/team/invite-member-form';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Team',
  description: 'Invite teachers to your school.',
};

const roleLabels: Record<string, string> = {
  owner: 'School owner',
  school_admin: 'Encyclopedia',
  staff: 'Teacher',
};

export default async function TeamPage() {
  const viewer = await requireEffectiveRole(['owner', 'school_admin']);
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canInvite = !viewer.readOnly;
  const canRevoke = viewer.effectiveRole === 'owner' && !viewer.readOnly;

  const [membersResult, invitesResult] = await Promise.all([
    supabase.from('memberships').select('id, role, created_at').eq('institution_id', institutionId).order('created_at'),
    supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
      .eq('institution_id', institutionId)
      .eq('role', 'staff')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const members = membersResult.data ?? [];
  const pending = (invitesResult.data ?? []).filter((invite) => new Date(invite.expires_at) > new Date());

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Team" title="Team" description={<>Invite teachers. Each invitation works once and expires after 7 days.</>} />

      {canInvite && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold">Invite a team member</h2>
          <InviteMemberForm />
        </GlassCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Members</h2>
          {members.length === 0 ? (
            <EmptyState title="No members yet">Accepted invitations appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <span className="font-medium">{roleLabels[member.role] ?? member.role}</span>
                  <span className="text-xs text-[var(--muted)]">Joined {new Date(member.created_at).toLocaleDateString('en-GB')}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Pending invitations</h2>
          {pending.length === 0 ? (
            <EmptyState title="No pending invitations">Invitations you send appear here until they are accepted.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {pending.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invite.email}</p>
                    <p className="text-xs text-[var(--muted)]">{roleLabels[invite.role] ?? invite.role} · expires {new Date(invite.expires_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  {canRevoke && (
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={invite.id} />
                      <SubmitButton variant="ghost" pendingLabel="Cancelling…">Cancel</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
