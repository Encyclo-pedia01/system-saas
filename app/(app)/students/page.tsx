import type { Metadata } from 'next';

import { ClassForm, ClassGroupsForm, StudentForm, type ClassOption } from '@/components/students/student-forms';
import { SubjectForm, TermForm } from '@/components/students/setup-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
export const metadata: Metadata = {
  title: 'Students',
  description: 'Manage classes and student enrolment.',
};

export default async function StudentsPage() {
  const viewer = await requireEffectiveRole(['owner', 'staff']);
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canManage = viewer.effectiveRole === 'owner' && !viewer.readOnly;

  const [classesResult, groupsResult, studentsResult] = await Promise.all([
    supabase.from('classes').select('id, name, has_groups').eq('institution_id', institutionId).order('name'),
    supabase.from('class_groups').select('id, class_id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('students').select('id, class_id, group_id, full_name, admission_number').eq('institution_id', institutionId).order('full_name'),
  ]);

  const groups = groupsResult.data ?? [];
  const classes: ClassOption[] = (classesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    hasGroups: c.has_groups,
    groups: groups.filter((g) => g.class_id === c.id),
  }));
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const students = studentsResult.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Records" title="Students" description={<>{students.length} students across {classes.length} classes.</>} />

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Add a class</h2><ClassForm /></GlassCard>
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Enrol a student</h2>
            {classes.length === 0 ? <p className="text-sm text-[var(--muted)]">Add a class first.</p> : <StudentForm classes={classes} />}
          </GlassCard>
        </div>
      )}

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Add a subject</h2><SubjectForm /></GlassCard>
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Add a term</h2><TermForm /></GlassCard>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {classes.length === 0 && <div className="lg:col-span-2"><EmptyState title="No classes yet">Add a class to start enrolling students.</EmptyState></div>}
        {classes.map((schoolClass) => {
          const members = students.filter((s) => s.class_id === schoolClass.id);
          return (
            <section key={schoolClass.id} className="depth-card p-5" aria-labelledby={`cls-${schoolClass.id}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 id={`cls-${schoolClass.id}`} className="text-base font-semibold">{schoolClass.name}</h2>
                <span className="badge bg-[var(--hover)] text-[var(--muted)]">{members.length}</span>
              </div>
              {canManage && <ClassGroupsForm classId={schoolClass.id} />}
              <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
                {members.length === 0 && <li className="py-3 text-sm text-[var(--muted)]">No students enrolled.</li>}
                {members.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="font-medium">{s.full_name}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {s.group_id && groupNameById.get(s.group_id) ? `${schoolClass.name} ${groupNameById.get(s.group_id)} · ` : ''}{s.admission_number}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
