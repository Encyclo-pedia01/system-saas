import type { Metadata } from 'next';

import { AddClassForm, EditClassForm, TeacherRow, type ClassRecord, type StaffOption } from '@/components/classes/class-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { classLevels, levelLabels, type ClassLevel } from '@/lib/validation/classes';

export const metadata: Metadata = {
  title: 'Classes',
  description: 'Add and edit classes by level, and assign class teachers.',
};

type ClassRow = { id: string; name: string; level: ClassLevel | null; has_groups: boolean };

export default async function ClassesPage() {
  const viewer = await requireEffectiveRole(['owner', 'school_admin', 'staff']);
  const institutionId = viewer.institution!.id;
  const isOwner = viewer.role === 'owner' && !viewer.readOnly;
  const supabase = await createClient();

  const [classesResult, groupsResult, studentsResult, teachersResult] = await Promise.all([
    supabase.from('classes').select('id, name, level, has_groups').eq('institution_id', institutionId).order('name'),
    supabase.from('class_groups').select('id, class_id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('students').select('class_id').eq('institution_id', institutionId),
    supabase.from('class_teachers').select('class_id, user_id').eq('institution_id', institutionId),
  ]);

  const invitesResult = isOwner
    ? await supabase
        .from('invitations')
        .select('class_id, email, expires_at')
        .eq('institution_id', institutionId)
        .eq('kind', 'class_teacher')
        .is('accepted_at', null)
        .is('revoked_at', null)
    : { data: [] };

  const staffResult = isOwner ? await supabase.rpc('list_school_staff', { p_institution_id: institutionId }) : { data: [] };

  const classes = (classesResult.data ?? []) as ClassRow[];
  const groups = groupsResult.data ?? [];
  const students = studentsResult.data ?? [];
  const teachers = teachersResult.data ?? [];
  const invites = (invitesResult.data ?? []) as Array<{ class_id: string; email: string; expires_at: string }>;
  const staffRows = (staffResult.data ?? []) as Array<{ user_id: string; full_name: string; email: string; role: string }>;

  const staff: StaffOption[] = staffRows
    .filter((member) => member.role === 'staff')
    .map((member) => ({ userId: member.user_id, label: member.full_name || member.email || 'Teacher' }));

  const labelFor = (userId: string) => {
    const member = staffRows.find((row) => row.user_id === userId);
    return member ? member.full_name || member.email : 'Teacher';
  };

  const records: ClassRecord[] = classes.map((schoolClass) => {
    const teacher = teachers.find((row) => row.class_id === schoolClass.id);
    const invite = invites.find((row) => row.class_id === schoolClass.id);
    return {
      id: schoolClass.id,
      name: schoolClass.name,
      level: schoolClass.level,
      hasGroups: schoolClass.has_groups,
      groups: groups.filter((group) => group.class_id === schoolClass.id).map((group) => ({ id: group.id, name: group.name })),
      studentCount: students.filter((student) => student.class_id === schoolClass.id).length,
      teacherUserId: teacher?.user_id ?? null,
      teacherLabel: teacher ? labelFor(teacher.user_id) : null,
      pendingEmail: invite?.email ?? null,
      pendingExpiresAt: invite?.expires_at ?? null,
    };
  });

  const unset = records.filter((record) => record.level === null);
  const sections: Array<{ key: string; title: string; items: ClassRecord[] }> = [
    ...classLevels.map((level) => ({ key: level, title: levelLabels[level], items: records.filter((record) => record.level === level) })),
    ...(unset.length > 0 ? [{ key: 'unset', title: 'Level not set', items: unset }] : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard"
        eyebrow="Records"
        title="Classes"
        description={
          isOwner
            ? 'Choose a class from its level, say whether it is divided into groups, and assign its teacher.'
            : `${records.length} classes across the school.`
        }
      />

      {isOwner && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold">Add a class</h2>
          <AddClassForm staff={staff} />
        </GlassCard>
      )}

      {isOwner && unset.length > 0 && (
        <GlassCard className="p-6">
          <p className="text-sm">
            <strong>{unset.length} {unset.length === 1 ? 'class has' : 'classes have'} no level.</strong> Choose each one&apos;s level under Level not set below. Its assessments and scores are blocked until then.
          </p>
        </GlassCard>
      )}

      {records.length === 0 && (
        <EmptyState title="No classes yet">{isOwner ? 'Add your first class above.' : 'The owner has not added any classes yet.'}</EmptyState>
      )}

      {sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section key={section.key} aria-labelledby={`level-${section.key}`} className="space-y-3">
            <h2 id={`level-${section.key}`} className="text-base font-semibold">
              {section.title} <span className="text-sm font-normal text-[var(--muted)]">({section.items.length})</span>
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {section.items.map((record) => (
                <GlassCard key={record.id} className="p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{record.name}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span className="badge bg-[var(--hover)]">{record.hasGroups ? `${record.groups.length} groups` : 'One class'}</span>
                      <span className="badge bg-[var(--hover)]">{record.studentCount} students</span>
                    </div>
                  </div>
                  {record.teacherLabel ? (
                    <p className="text-sm text-[var(--muted)]">Teacher: {record.teacherLabel}</p>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No class teacher yet.</p>
                  )}
                  {isOwner ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium">Edit class</summary>
                      <div className="mt-4">
                        <EditClassForm classItem={record} />
                      </div>
                    </details>
                  ) : null}
                </GlassCard>
              ))}
            </div>
          </section>
        ))}

      {isOwner && records.length > 0 && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold">Class teachers</h2>
          <p className="mb-5 text-sm text-[var(--muted)]">
            Each invite link is for one teacher and expires 30 minutes after it is made. Regenerate a link to replace it.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table text-left">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th scope="col" className="py-2 pr-4">Class</th>
                  <th scope="col" className="py-2 pr-4">Level</th>
                  <th scope="col" className="py-2 pr-4">Teacher</th>
                  <th scope="col" className="py-2">Invite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {records.map((record) => (
                  <TeacherRow key={record.id} classItem={record} staff={staff} />
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
