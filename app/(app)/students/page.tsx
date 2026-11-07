import type { Metadata } from 'next';

import { ClassForm, StudentForm } from '@/components/students/student-forms';
import { SubjectForm, TermForm } from '@/components/students/setup-forms';
import { GlassCard } from '@/components/ui/glass-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Students',
  description: 'Manage classes and student enrolment.',
};

export default async function StudentsPage() {
  const viewer = await requireEffectiveRole(['owner', 'staff']);
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canManage = viewer.effectiveRole === 'owner' && !viewer.readOnly;

  const [classesResult, studentsResult] = await Promise.all([
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('students').select('id, class_id, full_name, admission_number').eq('institution_id', institutionId).order('full_name'),
  ]);

  const classes = classesResult.data ?? [];
  const students = studentsResult.data ?? [];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Records</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Students</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{students.length} students across {classes.length} classes.</p>
      </header>

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
        {classes.length === 0 && <GlassCard className="p-8 text-sm text-[var(--muted)] lg:col-span-2">No classes yet.</GlassCard>}
        {classes.map((schoolClass) => {
          const members = students.filter((s) => s.class_id === schoolClass.id);
          return (
            <section key={schoolClass.id} className="depth-card p-5" aria-labelledby={`cls-${schoolClass.id}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 id={`cls-${schoolClass.id}`} className="text-base font-semibold">{schoolClass.name}</h2>
                <span className="badge bg-white/5 text-[var(--muted)]">{members.length}</span>
              </div>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {members.length === 0 && <li className="py-2 text-[var(--muted)]">No students enrolled.</li>}
                {members.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="font-medium">{s.full_name}</span>
                    <span className="text-xs text-[var(--muted)]">{s.admission_number}</span>
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
