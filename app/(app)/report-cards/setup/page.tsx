import type { Metadata } from 'next';
import Link from 'next/link';

import { ClassTeacherForm, GradeScaleForm, HeadmasterTagForm } from '@/components/report-cards/report-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Report card setup',
  description: 'Grade scale, class teachers, and headmaster for report cards.',
};

export default async function ReportCardSetupPage() {
  const viewer = await requireEffectiveRole(['owner']);
  const institutionId = viewer.institution!.id;
  const canWrite = !viewer.readOnly;

  const supabase = await createClient();
  const [bandsResult, classesResult, teachersResult, staffResult] = await Promise.all([
    supabase.from('grade_bands').select('letter, min_score, label').eq('institution_id', institutionId).order('min_score', { ascending: false }),
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('class_teachers').select('class_id, user_id').eq('institution_id', institutionId),
    supabase.rpc('list_school_staff', { p_institution_id: institutionId }),
  ]);

  const bands = (bandsResult.data ?? []).map((band) => ({
    letter: band.letter,
    minScore: String(Number(band.min_score)),
    label: band.label,
  }));
  const classes = classesResult.data ?? [];
  const teachers = teachersResult.data ?? [];
  const staff = (staffResult.data ?? []) as Array<{
    membership_id: string;
    user_id: string;
    full_name: string;
    email: string;
    role: string;
    is_headmaster: boolean;
  }>;
  const staffLabel = (member: { full_name: string; email: string }) => member.full_name || member.email || 'Team member';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Records"
        title="Report card setup"
        description="Set the grade scale, assign class teachers, and tag the headmaster. Report cards cannot be printed until the grade scale is set."
        action={<Link href="/report-cards" className="btn btn-ghost">Back to report cards</Link>}
      />

      <GlassCard className="p-6 sm:p-8">
        <h2 className="mb-2 text-lg font-semibold">Grade scale</h2>
        <p className="mb-5 text-sm text-[var(--muted)]">Can be changed until the first report card is marked final.</p>
        {canWrite ? <GradeScaleForm initial={bands} /> : <p className="text-sm text-[var(--muted)]">Read only.</p>}
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <h2 className="mb-2 text-lg font-semibold">Class teachers</h2>
        <p className="mb-5 text-sm text-[var(--muted)]">The class teacher writes the class teacher remark for their class.</p>
        {classes.length === 0 ? (
          <EmptyState title="No classes yet">Add a class on the Students page first.</EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {classes.map((schoolClass) => {
              const current = teachers.find((t) => t.class_id === schoolClass.id)?.user_id ?? '';
              return (
                <li key={schoolClass.id} className="py-4">
                  <p className="mb-3 font-medium">{schoolClass.name}</p>
                  {canWrite ? (
                    <ClassTeacherForm
                      classId={schoolClass.id}
                      current={current}
                      staff={staff.map((member) => ({ userId: member.user_id, label: staffLabel(member) }))}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <h2 className="mb-2 text-lg font-semibold">Headmaster</h2>
        <p className="mb-5 text-sm text-[var(--muted)]">
          A team member tagged as headmaster can write the headmaster remark for every class. You can always write it yourself.
        </p>
        {staff.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No teachers have joined yet. Invite them from the Team page.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {staff.map((member) => (
              <li key={member.membership_id} className="py-4">
                {canWrite ? (
                  <HeadmasterTagForm membershipId={member.membership_id} label={`${staffLabel(member)}${member.role === 'school_admin' ? ' (Encyclopedia)' : ''}`} checked={member.is_headmaster} />
                ) : (
                  <p className="text-sm">{staffLabel(member)}{member.is_headmaster ? ' · headmaster' : ''}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
