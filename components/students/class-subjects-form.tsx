'use client';

import { useActionState } from 'react';

import { setClassSubjectsAction } from '@/app/(app)/students/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type SubjectOption = { id: string; name: string };

export function ClassSubjectsForm({
  classId,
  className,
  subjects,
  selectedIds,
}: {
  classId: string;
  className: string;
  subjects: SubjectOption[];
  selectedIds: string[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setClassSubjectsAction, null);
  useActionToast(state);
  const selected = new Set(selectedIds);

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="classId" value={classId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{className}</legend>
        {subjects.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Add subjects first.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {subjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="subjectId" value={subject.id} defaultChecked={selected.has(subject.id)} />
                {subject.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {subjects.length > 0 && <SubmitButton variant="ghost" pendingLabel="Saving…">Save subjects for {className}</SubmitButton>}
    </form>
  );
}
