import type { Metadata } from 'next';
import Link from 'next/link';

import { StudentForm, type ClassOption } from '@/components/students/student-forms';
import { StudentUpload } from '@/components/students/student-upload';
import { SubjectForm, SchoolYearForm } from '@/components/students/setup-forms';
import { ClassSubjectsForm } from '@/components/students/class-subjects-form';
import { StudentProfileCard } from '@/components/students/student-profile-card';
import { SuggestedSubjects } from '@/components/students/suggested-subjects';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { suggestedSubjects } from '@/lib/subjects/suggested';
import { classLevels, type ClassLevel } from '@/lib/validation/classes';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
export const metadata: Metadata = {
  title: 'Students',
  description: 'Manage classes and student enrolment.',
};

export default async function StudentsPage() {
  const viewer = await requireEffectiveRole(['owner', 'school_admin', 'staff']);
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canStructure = viewer.effectiveRole === 'owner' && !viewer.readOnly;
  const canEnrol = (viewer.effectiveRole === 'owner' || viewer.effectiveRole === 'school_admin') && !viewer.readOnly;

  const [classesResult, groupsResult, studentsResult, subjectsResult, classSubjectsResult] = await Promise.all([
    supabase.from('classes').select('id, name, has_groups').eq('institution_id', institutionId).order('name'),
    supabase.from('class_groups').select('id, class_id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('students').select('id, class_id, group_id, full_name, admission_number').eq('institution_id', institutionId).order('full_name'),
    supabase.from('subjects').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('class_subjects').select('class_id, subject_id').eq('institution_id', institutionId),
  ]);
  const allSubjects = (subjectsResult.data ?? []) as Array<{ id: string; name: string }>;
  const classSubjectRows = (classSubjectsResult.data ?? []) as Array<{ class_id: string; subject_id: string }>;
  const existingSubjects = new Set(allSubjects.map((subject) => subject.name.trim().toLowerCase()));
  const suggestedGroups = (classLevels as readonly ClassLevel[])
    .map((level) => ({
      level,
      subjects: suggestedSubjects[level].filter((name) => !existingSubjects.has(name.toLowerCase())),
    }))
    .filter((group) => group.subjects.length > 0);

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
      <PageHeader backHref="/dashboard" eyebrow="Records" title="Students" description={<>{students.length} students across {classes.length} classes.</>} />

      {(canStructure || canEnrol) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {canStructure && <GlassCard className="p-6"><h2 className="mb-2 text-lg font-semibold">Classes</h2><p className="mb-4 text-sm text-[var(--muted)]">Add and edit classes, their groups, and class teachers on the Classes page.</p><Link href="/classes" className="btn btn-ghost">Go to Classes</Link></GlassCard>}
          {canEnrol && (
            <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Enrol a student</h2>
              {classes.length === 0 ? <p className="text-sm text-[var(--muted)]">Add a class first.</p> : <StudentForm classes={classes} />}
            </GlassCard>
          )}
        </div>
      )}

      {canEnrol && classes.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Upload students from a file</h2>
          <p className="mb-5 text-sm text-[var(--muted)]">Pick the class (and group, if it has one), then choose a file. You&apos;ll see a preview before anything is saved.</p>
          <StudentUpload classes={classes} />
        </GlassCard>
      )}

      {canStructure && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="p-6"><h2 className="mb-1 text-lg font-semibold">Suggested subjects</h2><p className="mb-4 text-sm text-[var(--muted)]">Tap a subject to add it. Nothing is added until you tap.</p><SuggestedSubjects groups={suggestedGroups} /></GlassCard>
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Add a subject</h2><SubjectForm /></GlassCard>
          <GlassCard className="p-6"><h2 className="mb-4 text-lg font-semibold">Set up a school year</h2><SchoolYearForm /></GlassCard>
        </div>
      )}

      {canStructure && classes.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Subjects by class</h2>
          <p className="mb-5 text-sm text-[var(--muted)]">Students enrolled in a class get its subjects automatically. Changes apply to students already in the class.</p>
          <div className="grid gap-6">
            {classes.map((schoolClass) => (
              <ClassSubjectsForm
                key={schoolClass.id}
                classId={schoolClass.id}
                className={schoolClass.name}
                subjects={allSubjects}
                selectedIds={classSubjectRows.filter((row) => row.class_id === schoolClass.id).map((row) => row.subject_id)}
              />
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {classes.length === 0 &&  <div className="lg:col-span-2"><EmptyState title="No classes yet">Add a class to start enrolling students.</EmptyState></div>}
        {classes.map((schoolClass) => {
          const members = students.filter((s) => s.class_id === schoolClass.id);
          return (
            <section key={schoolClass.id} className="depth-card p-5" aria-labelledby={`cls-${schoolClass.id}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 id={`cls-${schoolClass.id}`} className="text-base font-semibold">{schoolClass.name}</h2>
                <span className="badge bg-[var(--hover)] text-[var(--muted)]">{members.length}</span>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {members.length === 0 && <li className="text-sm text-[var(--muted)]">No students enrolled.</li>}
                {members.map((s) => (
                  <StudentProfileCard
                    key={s.id}
                    name={s.full_name}
                    classLabel={s.group_id && groupNameById.get(s.group_id) ? `${schoolClass.name} ${groupNameById.get(s.group_id)}` : schoolClass.name}
                    admissionNumber={s.admission_number}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
