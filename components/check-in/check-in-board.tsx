'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useActionState, useMemo } from 'react';

import { checkInStudentAction, markAbsentAction } from '@/app/(app)/check-in/actions';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type StudentRow = {
  student_id: string;
  full_name: string;
  class_name: string;
  today_status: 'on-time' | 'late' | 'absent' | null;
  today_time_in: string | null;
};

const statusBadge: Record<string, { label: string; className: string }> = {
  'on-time': { label: 'On time', className: 'tone-success' },
  late: { label: 'Late', className: 'tone-warning' },
  absent: { label: 'Absent', className: 'tone-danger' },
};

function StudentRowActions({ student }: { student: StudentRow }) {
  const [checkState, checkAction, checkPending] = useActionState<ActionResult | null, FormData>(checkInStudentAction, null);
  const [absentState, absentAction, absentPending] = useActionState<ActionResult | null, FormData>(markAbsentAction, null);
  useActionToast(checkState);
  useActionToast(absentState);

  const alreadyRecorded = student.today_status !== null;
  const busy = checkPending || absentPending;

  return (
    <div className="flex flex-wrap gap-2">
      <form action={checkAction}>
        <input type="hidden" name="studentId" value={student.student_id} />
        <button type="submit" className="btn btn-primary min-h-9 px-4 text-sm" disabled={alreadyRecorded || busy}>
          {checkPending ? 'Recording…' : 'Check in'}
        </button>
      </form>
      <form action={absentAction}>
        <input type="hidden" name="studentId" value={student.student_id} />
        <button type="submit" className="btn btn-ghost min-h-9 px-4 text-sm" disabled={alreadyRecorded || busy}>
          {absentPending ? 'Saving…' : 'Absent'}
        </button>
      </form>
    </div>
  );
}

export function CheckInBoard({ students }: { students: StudentRow[] }) {
  const groups = useMemo(() => {
    const byClass = new Map<string, StudentRow[]>();
    for (const student of students) {
      byClass.set(student.class_name, [...(byClass.get(student.class_name) ?? []), student]);
    }
    return [...byClass.entries()];
  }, [students]);

  if (students.length === 0) {
    return (
      <div className="glass p-8 text-center text-sm text-[var(--muted)]">
        No students are enrolled yet. The school owner adds students before check-in can begin.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AnimatePresence initial={false}>
        {groups.map(([className, rows]) => (
          <motion.section
            key={className}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="depth-card p-5"
            aria-labelledby={`class-${className}`}
          >
            <h2 id={`class-${className}`} className="mb-4 text-base font-semibold">{className}</h2>
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((student) => {
                const badge = student.today_status ? statusBadge[student.today_status] : null;
                return (
                  <li key={student.student_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.full_name}</p>
                      {badge && (
                        <span className={`badge mt-1 ${badge.className}`}>
                          {badge.label}
                          {student.today_time_in
                            ? ` · ${new Date(student.today_time_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </span>
                      )}
                    </div>
                    <StudentRowActions student={student} />
                  </li>
                );
              })}
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}
