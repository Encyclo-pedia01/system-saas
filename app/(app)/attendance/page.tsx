import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/components/attendance/register-form';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { todayInAccra } from '@/lib/fees/format';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Attendance',
  description: 'Mark which students are present each day.',
};

type SearchParams = Promise<{ classId?: string | string[]; date?: string | string[] }>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'staff']);
  const institutionId = viewer.institution!.id;
  const isOwner = viewer.effectiveRole === 'owner';
  const canWrite = !viewer.readOnly;

  const params = await searchParams;
  const supabase = await createClient();

  const [classesResult, myClassesResult] = await Promise.all([
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('class_teachers').select('class_id').eq('institution_id', institutionId).eq('user_id', viewer.userId),
  ]);

  const myClassIds = new Set((myClassesResult.data ?? []).map((row) => row.class_id));
  const classes = (classesResult.data ?? []).filter((c) => isOwner || myClassIds.has(c.id));

  const requestedDate = firstValue(params.date);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayInAccra();
  const requestedClass = firstValue(params.classId);
  const schoolClass = classes.find((c) => c.id === requestedClass) ?? classes[0];

  if (!schoolClass) {
    return (
      <div className="space-y-8">
        <PageHeader backHref="/dashboard" eyebrow="Records" title="Attendance" description="Mark which students are present each day." />
        <EmptyState title="No classes to mark">
          {isOwner ? 'Add a class on the Classes page first.' : 'You are not assigned to a class yet. Ask the school owner to assign you.'}
        </EmptyState>
      </div>
    );
  }

  const [studentsResult, rowsResult] = await Promise.all([
    supabase.from('students').select('id, full_name, admission_number').eq('institution_id', institutionId).eq('class_id', schoolClass.id).order('full_name'),
    supabase.from('attendance').select('student_id, present').eq('institution_id', institutionId).eq('class_id', schoolClass.id).eq('attendance_date', date),
  ]);

  const students = (studentsResult.data ?? []).map((s) => ({ id: s.id, name: s.full_name, admission: s.admission_number }));
  const initialPresent = (rowsResult.data ?? []).filter((row) => row.present).map((row) => row.student_id);
  const marked = (rowsResult.data ?? []).length;

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard" eyebrow="Records" title="Attendance" description="Tick each student who is present, then save the register for the day." />

      <GlassCard className="p-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Class</span>
            <select name="classId" defaultValue={schoolClass.id} className="field-input w-full">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Date</span>
            <input type="date" name="date" defaultValue={date} className="field-input w-full" />
          </label>
          <button type="submit" className="btn btn-primary min-h-11 px-6">Show register</button>
        </form>
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{schoolClass.name} · {date}</h2>
          <p className="text-xs text-[var(--muted)]">{marked > 0 ? 'Register saved for this day' : 'Not marked yet'}</p>
        </div>
        {students.length === 0 ? (
          <EmptyState title="No students in this class">Add students on the Students page, then mark attendance here.</EmptyState>
        ) : (
          <RegisterForm
            key={`${schoolClass.id}-${date}`}
            classId={schoolClass.id}
            date={date}
            students={students}
            initialPresent={initialPresent}
            canWrite={canWrite}
          />
        )}
        <p className="mt-6 text-xs text-[var(--muted)]">
          Teachers see their own classes. The school owner sees every class.{' '}
          <Link href="/classes" className="underline underline-offset-4">Go to Classes</Link>
        </p>
      </GlassCard>
    </div>
  );
}
