'use client';

import { useActionState, useState } from 'react';

import { addClassGroupsAction, createClassAction, createStudentAction } from '@/app/(app)/students/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type ClassOption = {
  id: string;
  name: string;
  hasGroups: boolean;
  groups: Array<{ id: string; name: string }>;
};

export function ClassForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createClassAction, null);
  const [hasGroups, setHasGroups] = useState(false);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="className" className="field-label">Class name</label>
        <input id="className" name="name" required placeholder="Basic 5" className="field-input" aria-invalid={Boolean(errors?.name)} />
        <FieldError messages={errors?.name} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="hasGroups"
          checked={hasGroups}
          onChange={(event) => setHasGroups(event.target.checked)}
          className="h-5 w-5 accent-[var(--accent)]"
        />
        This class has groups (for example 5A and 5B)
      </label>
      {hasGroups && (
        <div>
          <label htmlFor="groupNames" className="field-label">Group names</label>
          <input id="groupNames" name="groupNames" placeholder="A, B" className="field-input" aria-invalid={Boolean(errors?.groupNames)} />
          <p className="mt-1 text-xs text-[var(--muted)]">Separate group names with commas.</p>
          <FieldError messages={errors?.groupNames} />
        </div>
      )}
      <SubmitButton variant="ghost" pendingLabel="Adding…">Add class</SubmitButton>
    </form>
  );
}

export function ClassGroupsForm({ classId }: { classId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(addClassGroupsAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="mt-4 space-y-2" noValidate>
      <input type="hidden" name="classId" value={classId} />
      <label htmlFor={`groups-${classId}`} className="field-label">Add groups</label>
      <div className="flex gap-2">
        <input id={`groups-${classId}`} name="groupNames" placeholder="C, D" className="field-input" aria-invalid={Boolean(errors?.groupNames)} />
        <SubmitButton variant="ghost" pendingLabel="Adding…">Add</SubmitButton>
      </div>
      <FieldError messages={errors?.groupNames} />
    </form>
  );
}

export function StudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createStudentAction, null);
  const [classId, setClassId] = useState('');
  useActionToast(state);
  const errors = state?.fieldErrors;
  const selected = classes.find((c) => c.id === classId);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="classId" className="field-label">Class</label>
        <select
          id="classId"
          name="classId"
          required
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="field-select"
          aria-invalid={Boolean(errors?.classId)}
        >
          <option value="" disabled>Choose a class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <FieldError messages={errors?.classId} />
      </div>
      {selected?.hasGroups && (
        <div>
          <label htmlFor="groupId" className="field-label">Group</label>
          <select id="groupId" name="groupId" required defaultValue="" className="field-select" aria-invalid={Boolean(errors?.groupId)}>
            <option value="" disabled>Choose a group</option>
            {selected.groups.map((g) => <option key={g.id} value={g.id}>{selected.name} {g.name}</option>)}
          </select>
          <FieldError messages={errors?.groupId} />
        </div>
      )}
      <div>
        <label htmlFor="fullName" className="field-label">Full name</label>
        <input id="fullName" name="fullName" required className="field-input" aria-invalid={Boolean(errors?.fullName)} />
        <FieldError messages={errors?.fullName} />
      </div>
      <div>
        <label htmlFor="admissionNumber" className="field-label">Admission number</label>
        <input id="admissionNumber" name="admissionNumber" required className="field-input" aria-invalid={Boolean(errors?.admissionNumber)} />
        <FieldError messages={errors?.admissionNumber} />
      </div>
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
      <SubmitButton pendingLabel="Adding…">Add student</SubmitButton>
    </form>
  );
}
