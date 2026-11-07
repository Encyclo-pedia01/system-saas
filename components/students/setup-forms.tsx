'use client';

import { useActionState } from 'react';

import { createSubjectAction, createTermAction } from '@/app/(app)/students/actions';
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

export function TermForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(createTermAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="termName" className="field-label">Term name</label>
        <input id="termName" name="name" required placeholder="Term 1 2026" className="field-input" aria-invalid={Boolean(errors?.name)} />
        <FieldError messages={errors?.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="termStart" className="field-label">Starts on</label>
          <input id="termStart" name="startsOn" type="date" required className="field-input" aria-invalid={Boolean(errors?.startsOn)} />
          <FieldError messages={errors?.startsOn} />
        </div>
        <div>
          <label htmlFor="termEnd" className="field-label">Ends on</label>
          <input id="termEnd" name="endsOn" type="date" required className="field-input" aria-invalid={Boolean(errors?.endsOn)} />
          <FieldError messages={errors?.endsOn} />
        </div>
      </div>
      <SubmitButton variant="ghost" pendingLabel="Adding…">Add term</SubmitButton>
    </form>
  );
}
