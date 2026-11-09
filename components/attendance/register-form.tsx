'use client';

import { useActionState, useState } from 'react';

import { saveAttendanceAction } from '@/app/(app)/attendance/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import type { ActionResult } from '@/lib/actions/result';

type Student = { id: string; name: string; admission: string };

export function RegisterForm({
  classId,
  date,
  students,
  initialPresent,
  canWrite,
}: {
  classId: string;
  date: string;
  students: Student[];
  initialPresent: string[];
  canWrite: boolean;
}) {
  const [present, setPresent] = useState<Set<string>>(() => new Set(initialPresent));
  const [state, action] = useActionState<ActionResult<{ present: number; total: number }> | null, FormData>(
    saveAttendanceAction,
    null,
  );

  function toggle(id: string, checked: boolean) {
    setPresent((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      {students.map((s) => (
        <input key={s.id} type="hidden" name="studentId" value={s.id} />
      ))}
      {[...present].map((id) => (
        <input key={`p-${id}`} type="hidden" name="present" value={id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium" aria-live="polite">
          <span className="text-lg font-semibold text-[var(--accent)]">{present.size}</span> of {students.length} present
        </p>
        {canWrite && <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost min-h-11 px-4 text-sm" onClick={() => setPresent(new Set(students.map((s) => s.id)))}>Mark all present</button><button type="button" className="btn btn-ghost min-h-11 px-4 text-sm" onClick={() => setPresent(new Set())} disabled={present.size === 0}>Clear all</button></div>}
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
        {students.map((s) => (
          <li key={s.id}>
            <label className={`flex min-h-[4.5rem] cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors ${present.has(s.id) ? 'bg-[var(--tone-success-bg)]/40' : 'hover:bg-[var(--hover)]'}`}>
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${present.has(s.id) ? 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]' : 'bg-[var(--hover)] text-[var(--muted)]'}`}>{present.has(s.id) ? 'P' : '—'}</span>
                <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]"><span className="md:hidden">Admission no. </span>{s.admission}</span></span>
              </span>
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-[var(--accent)]"
                checked={present.has(s.id)}
                disabled={!canWrite}
                onChange={(event) => toggle(s.id, event.currentTarget.checked)}
                aria-label={`Mark ${s.name} present`}
              />
            </label>
          </li>
        ))}
      </ul>

      {state && !state.ok && <p role="alert" className="form-error text-sm">{state.message}</p>}
      {state?.ok && <p role="status" className="text-sm font-semibold text-[var(--accent)]">{state.message}</p>}

      {canWrite && (
        <SubmitButton pendingLabel="Saving…" className="min-h-11 px-6">
          Save register
        </SubmitButton>
      )}
    </form>
  );
}
