'use client';

import { useActionState } from 'react';

import { createSchoolYearAction, createSubjectAction } from '@/app/(app)/students/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function SubjectForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createSubjectAction, null);
  useActionToast(state);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="subjectName" className="field-label">Subject name</label>
        <input id="subjectName" name="name" required placeholder="Mathematics" className="field-input" aria-invalid={Boolean(state?.fieldErrors?.name)} />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <SubmitButton variant="ghost" pendingLabel="Adding…">Add subject</SubmitButton>
    </form>
  );
}

export function SchoolYearForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createSchoolYearAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="space-y-4" noValidate>
      <p className="text-sm text-[var(--muted)]">Creates 1st, 2nd and 3rd Term for the year. Term 1 runs September to December, Term 2 January to April, and Term 3 April to July.</p>
      <div>
        <label htmlFor="startYear" className="field-label">School year starts in</label>
        <input id="startYear" name="startYear" type="number" min={2000} max={2100} required placeholder="2026" className="field-input" aria-invalid={Boolean(errors?.startYear)} />
        <FieldError messages={errors?.startYear} />
      </div>
      <SubmitButton variant="ghost" pendingLabel="Creating…">Create school year</SubmitButton>
    </form>
  );
}
