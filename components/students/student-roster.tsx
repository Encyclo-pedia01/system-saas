'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';

type Student = { id: string; full_name: string; admission_number: string; group_id: string | null };
type SchoolClass = { id: string; name: string; students: Student[] };

export function StudentRoster({ classes, groupNameById }: { classes: SchoolClass[]; groupNameById: Record<string, string> }) {
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return classes.filter((c) => classId === 'all' || c.id === classId).map((c) => ({
      ...c,
      students: c.students.filter((s) => !term || s.full_name.toLowerCase().includes(term) || s.admission_number.toLowerCase().includes(term)),
    })).filter((c) => c.students.length > 0 || (!term && (classId === 'all' || classId === c.id)));
  }, [classes, classId, query]);
  const count = filtered.reduce((total, item) => total + item.students.length, 0);
  return (
    <section className="space-y-4" aria-labelledby="roster-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-soft)]">Enrolment</p><h2 id="roster-title" className="text-xl font-semibold">Student roster</h2></div>
        <p className="text-sm text-[var(--muted)]" aria-live="polite">{count} {count === 1 ? 'student' : 'students'} shown</p>
      </div>
      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)]">
        <label><span className="field-label">Find a student</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or admission number" className="field-input min-h-11" /></label>
        <label><span className="field-label">Class</span><select value={classId} onChange={(event) => setClassId(event.target.value)} className="field-input min-h-11"><option value="all">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      {filtered.length === 0 ? <EmptyState title={query ? 'No matching students' : 'No students yet'}>{query ? 'Try a different name or admission number, or clear your search.' : 'Enrol students or import a roster to see them here.'}</EmptyState> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((schoolClass) => (
            <section key={schoolClass.id} className="depth-card overflow-hidden" aria-labelledby={`cls-${schoolClass.id}`}>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--hover)]/50 px-5 py-4">
                <h3 id={`cls-${schoolClass.id}`} className="font-semibold">{schoolClass.name}</h3>
                <span className="badge bg-[var(--panel)] text-[var(--muted)]">{schoolClass.students.length} shown</span>
              </div>
              {schoolClass.students.length === 0 ? <p className="px-5 py-5 text-sm text-[var(--muted)]">No students enrolled in this class yet.</p> : (
                <ul className="divide-y divide-[var(--border)]">
                  {schoolClass.students.map((student) => <li key={student.id} className="flex min-h-[4.25rem] items-center justify-between gap-3 px-5 py-3"><span className="min-w-0"><span className="block truncate font-medium">{student.full_name}</span>{student.group_id && groupNameById[student.group_id] && <span className="mt-0.5 block text-xs text-[var(--muted)]">Group {groupNameById[student.group_id]}</span>}</span><span className="shrink-0 rounded-md bg-[var(--hover)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)]"><span className="sr-only">Admission number </span>{student.admission_number}</span></li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
