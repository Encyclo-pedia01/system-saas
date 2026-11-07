'use client';

import { useActionState } from 'react';

import { createClassAction, createStudentAction } from '@/app/(app)/students/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function ClassForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createClassAction, null);
  useActionToast(state);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="className" className="field-label">Class name</label>
        <input id="className" name="name" required placeholder="Grade 5 Blue" className="field-input" aria-invalid={Boolean(state?.fieldErrors?.name)} />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <SubmitButton variant="ghost" pendingLabel="Adding…">Add class</SubmitButton>
    </form>
  );
}

export function StudentForm({ classes }: { classes: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createStudentAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="classId" className="field-label">Class</label>
        <select id="classId" name="classId" required defaultValue="" className="field-select" aria-invalid={Boolean(errors?.classId)}>
          <option value="" disabled>Choose a class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <FieldError messages={errors?.classId} />
      </div>
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
