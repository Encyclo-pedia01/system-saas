import type { Metadata } from 'next';
import Link from 'next/link';

import { MarkFinalForm, RemarksForm, UnlockFinalForm } from '@/components/report-cards/report-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Report cards',
  description: 'Write remarks and print terminal report cards.',
};

type SearchParams = Promise<{ termId?: string | string[]; classId?: string | string[] }>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function ReportCardsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'school_admin', 'staff']);
  const institutionId = viewer.institution!.id;
  const isOwner = viewer.effectiveRole === 'owner';
  const isStaff = viewer.effectiveRole === 'staff';
  const canWrite = !viewer.readOnly;

  const supabase = await createClient();
  const [termsResult, classesResult, membershipResult, myClassesResult, scaleResult] = await Promise.all([
    supabase.from('terms').select('id, name, starts_on').eq('institution_id', institutionId).order('starts_on'),
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('memberships').select('is_headmaster').eq('institution_id', institutionId).eq('user_id', viewer.userId).maybeSingle(),
    supabase.from('class_teachers').select('class_id, user_id').eq('institution_id', institutionId).eq('user_id', viewer.userId),
    isOwner || viewer.effectiveRole === 'school_admin'
      ? supabase.from('grade_bands').select('id').eq('institution_id', institutionId)
      : Promise.resolve({ data: [] as Array<{ id: string }> }),
  ]);

  const terms = termsResult.data ?? [];
  const isHeadmaster = isOwner || Boolean(membershipResult.data?.is_headmaster);
  const myClassIds = new Set((myClassesResult.data ?? []).map((row) => row.class_id));
  const allClasses = classesResult.data ?? [];
  const classes = isStaff && !isHeadmaster ? allClasses.filter((c) => myClassIds.has(c.id)) : allClasses;
  const hasScale = (scaleResult.data ?? []).length > 0;

  const termId = firstValue((await searchParams).termId) || terms[terms.length - 1]?.id || '';
  const requestedClass = firstValue((await searchParams).classId);
  const classId = classes.some((c) => c.id === requestedClass) ? requestedClass : classes[0]?.id ?? '';
  const term = terms.find((t) => t.id === termId);
  const schoolClass = classes.find((c) => c.id === classId);

  if (terms.length === 0 || classes.length === 0 || !term || !schoolClass) {
    return (
      <div className="space-y-8">
        <PageHeader backHref="/dashboard" eyebrow="Records" title="Report cards" description="Terminal report cards for each class." />
        <EmptyState title={terms.length === 0 ? 'No terms yet' : 'No classes to show'}>
          {terms.length === 0
            ? 'Add a term on the Students page first.'
            : isStaff
              ? 'You are not the class teacher of any class yet. Ask the school owner to assign you.'
              : 'Add a class on the Students page first.'}
        </EmptyState>
      </div>
    );
  }

  const [studentsResult, missingResult, classTeacherResult] = await Promise.all([
    supabase.from('students').select('id, full_name, admission_number').eq('institution_id', institutionId).eq('class_id', classId).order('full_name'),
    supabase.rpc('report_missing_grades', { p_class_id: classId, p_term_id: termId }),
    supabase.from('class_teachers').select('user_id').eq('institution_id', institutionId).eq('class_id', classId).maybeSingle(),
  ]);
  const students = studentsResult.data ?? [];
  const studentIds = students.map((s) => s.id);
  const missing = (missingResult.data ?? []) as Array<{ student_id: string; student_name: string; subject_name: string }>;

  const [finalsResult, remarksResult] = await Promise.all([
    studentIds.length
      ? supabase.from('report_finals').select('student_id').eq('institution_id', institutionId).eq('term_id', termId).in('student_id', studentIds)
      : Promise.resolve({ data: [] as Array<{ student_id: string }> }),
    studentIds.length
      ? supabase.from('report_remarks').select('student_id, kind, body').eq('institution_id', institutionId).eq('term_id', termId).in('student_id', studentIds)
      : Promise.resolve({ data: [] as Array<{ student_id: string; kind: string; body: string }> }),
  ]);
  const finalIds = new Set((finalsResult.data ?? []).map((row) => row.student_id));
  const remarkFor = (studentId: string, kind: string) =>
    (remarksResult.data ?? []).find((r) => r.student_id === studentId && r.kind === kind)?.body ?? '';

  const isClassTeacherOfThis = classTeacherResult.data?.user_id === viewer.userId;
  const canClassTeacher = canWrite && isClassTeacherOfThis;
  const canHeadmaster = canWrite && isHeadmaster;
  const draftIds = studentIds.filter((id) => !finalIds.has(id));
  const missingNames = [...new Set(missing.map((m) => m.student_name))];

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard"
        eyebrow="Records"
        title="Report cards"
        description={`${schoolClass.name} · ${term.name}`}
        action={isOwner ? <Link href="/report-cards/setup" className="btn btn-ghost">Setup</Link> : undefined}
      />

      <GlassCard className="p-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="rcTerm" className="field-label">Term</label>
            <select id="rcTerm" name="termId" defaultValue={termId} className="field-input">
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rcClass" className="field-label">Class</label>
            <select id="rcClass" name="classId" defaultValue={classId} className="field-input">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-ghost">Show</button>
          </div>
        </form>
      </GlassCard>

      {isOwner && !hasScale && (
        <GlassCard className="border-[var(--highlight)] p-5">
          <p className="text-sm">The grade scale is not set yet. <Link href="/report-cards/setup" className="underline">Set it up</Link> before printing report cards.</p>
        </GlassCard>
      )}

      {missing.length > 0 && (
        <GlassCard className="border-[var(--highlight)] p-5">
          <p className="font-medium">Grades are missing for {missingNames.length} {missingNames.length === 1 ? 'student' : 'students'}.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {missingNames.slice(0, 5).join(', ')}{missingNames.length > 5 ? ' and others' : ''}. Compute the grades in Grading before marking cards final.
          </p>
        </GlassCard>
      )}

      {students.length === 0 ? (
        <EmptyState title="No students in this class">Enrol students on the Students page.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Link href={`/report-cards/print?termId=${termId}&classId=${classId}`} className="btn btn-primary" target="_blank" rel="noopener">
              Print class cards
            </Link>
            {isOwner && draftIds.length > 0 && !viewer.readOnly && missing.length === 0 && (
              <MarkFinalForm termId={termId} classId={classId} studentIds={draftIds} label={`Mark all ${draftIds.length} drafts final`} />
            )}
          </div>

          <ul className="space-y-4">
            {students.map((student) => {
              const final = finalIds.has(student.id);
              const blocked = missing.some((m) => m.student_id === student.id);
              return (
                <li key={student.id}>
                  <GlassCard className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{student.full_name}</p>
                        <p className="text-sm text-[var(--muted)]">{student.admission_number}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {final ? (
                          <span className="badge bg-[var(--hover)] text-[var(--muted)]">Final</span>
                        ) : (
                          <span className="badge bg-[var(--hover)] text-[var(--muted)]">Draft</span>
                        )}
                        <Link href={`/report-cards/print?termId=${termId}&studentId=${student.id}`} className="btn btn-ghost" target="_blank" rel="noopener">
                          Print
                        </Link>
                        {isOwner && !final && !viewer.readOnly && !blocked && (
                          <MarkFinalForm termId={termId} classId={classId} studentIds={[student.id]} label="Mark final" />
                        )}
                        {isOwner && final && !viewer.readOnly && <UnlockFinalForm termId={termId} studentId={student.id} />}
                      </div>
                    </div>

                    {final ? (
                      <div className="space-y-1 text-sm">
                        <p><span className="text-[var(--muted)]">Class teacher remark: </span>{remarkFor(student.id, 'class_teacher') || 'None'}</p>
                        <p><span className="text-[var(--muted)]">Headmaster remark: </span>{remarkFor(student.id, 'headmaster') || 'None'}</p>
                      </div>
                    ) : (canClassTeacher || canHeadmaster) ? (
                      <RemarksForm
                        termId={termId}
                        studentId={student.id}
                        studentName={student.full_name}
                        classTeacherRemark={remarkFor(student.id, 'class_teacher')}
                        headmasterRemark={remarkFor(student.id, 'headmaster')}
                        canClassTeacher={canClassTeacher}
                        canHeadmaster={canHeadmaster}
                      />
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p><span className="text-[var(--muted)]">Class teacher remark: </span>{remarkFor(student.id, 'class_teacher') || 'Not written yet.'}</p>
                        <p><span className="text-[var(--muted)]">Headmaster remark: </span>{remarkFor(student.id, 'headmaster') || 'Not written yet.'}</p>
                      </div>
                    )}
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
