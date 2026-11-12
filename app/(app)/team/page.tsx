import type { Metadata } from 'next';

import { revokeInvitationAction } from '@/app/(app)/team/actions';
import { HeadmasterTagForm } from '@/components/report-cards/report-forms';
import { InviteMemberForm } from '@/components/team/invite-member-form';
import { RemoveMemberForm } from '@/components/team/remove-member-form';
import { EmptyState } from '@/components/ui/empty-state';
import { RefreshAt } from '@/components/ui/refresh-at';
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
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const members = membersResult.data ?? [];
  const now = new Date();
  const pending = (invitesResult.data ?? []).filter((invite) => new Date(invite.expires_at) > now);
  const nextExpiry = pending.reduce<string | null>((earliest, invite) => (!earliest || invite.expires_at < earliest ? invite.expires_at : earliest), null);

  // Only the owner can tag a headmaster. The list shows names and emails, as on the report card setup page.
  const isOwner = viewer.effectiveRole === 'owner';
  const staffResult = isOwner && !viewer.readOnly ? await supabase.rpc('list_school_staff', { p_institution_id: institutionId }) : null;
  const staff = ((staffResult?.data ?? []) as Array<{ membership_id: string; full_name: string; email: string; role: string; is_headmaster: boolean }>).filter(
    (member) => member.role === 'staff' || member.role === 'school_admin',
  );
  const staffLabel = (member: { full_name: string; email: string }) => member.full_name || member.email || 'Team member';

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard" eyebrow="Team" title="Team" description={<>Invite teachers and authority staff. Each invitation works once. Teacher links expire 30 minutes after they are sent. Authority links expire after 7 days.</>} />

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
          <RefreshAt at={nextExpiry} />
          {pending.length === 0 ? (
            <EmptyState title="No pending invitations">Invitations you send appear here until they are accepted.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {pending.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invite.email}</p>
                    <p className="text-xs text-[var(--muted)]">{roleLabels[invite.role] ?? invite.role} · expires {new Date(invite.expires_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' })}</p>
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

      {isOwner && !viewer.readOnly && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-2 text-lg font-semibold">Headmaster</h2>
          <p className="mb-5 text-sm text-[var(--muted)]">
            A team member tagged as headmaster can write the headmaster remark for every class. You can always write it yourself.
          </p>
          {staff.length === 0 ? (
            <EmptyState title="No teachers have joined yet">Accepted invitations appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {staff.map((member) => (
                <li key={member.membership_id} className="py-4">
                  <HeadmasterTagForm
                    membershipId={member.membership_id}
                    label={`${staffLabel(member)}${member.role === 'school_admin' ? ' (Encyclopedia)' : ''}`}
                    checked={member.is_headmaster}
                  />
                  {member.role === 'staff' && (
                    <div className="mt-3">
                      <RemoveMemberForm membershipId={member.membership_id} label={staffLabel(member)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}
    </div>
  );
}
