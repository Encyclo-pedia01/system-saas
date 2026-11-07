'use client';

import { useActionState } from 'react';

import { computeFinalGradesAction, saveGradingWeightsAction } from '@/app/(app)/grading/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

type Option = { id: string; name: string };

export function GradingWeightsForm({
  assessment,
  exam,
  readOnly,
}: {
  assessment: number;
  exam: number;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveGradingWeightsAction, null);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assessment" className="field-label">Continuous assessment (%)</label>
          <input id="assessment" name="assessment" type="number" min={0} max={100} step="1" defaultValue={assessment} disabled={readOnly} className="field-input" aria-invalid={Boolean(state?.fieldErrors?.assessment)} />
          <FieldError messages={state?.fieldErrors?.assessment} />
        </div>
        <div>
          <label htmlFor="exam" className="field-label">Final exam (%)</label>
          <input id="exam" name="exam" type="number" min={0} max={100} step="1" defaultValue={exam} disabled={readOnly} className="field-input" aria-invalid={Boolean(state?.fieldErrors?.exam)} />
          <FieldError messages={state?.fieldErrors?.exam} />
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">The two weights must add up to 100.</p>
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
      {!readOnly && <SubmitButton pendingLabel="Saving…">Save weights</SubmitButton>}
    </form>
  );
}

export function ComputeGradesForm({
  terms,
  subjects,
  disabled,
}: {
  terms: Option[];
  subjects: Option[];
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult<{ computed: number; skipped: number }> | null, FormData>(
    computeFinalGradesAction,
    null,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="termId" className="field-label">Term</label>
          <select id="termId" name="termId" className="field-select" disabled={disabled} defaultValue="" required>
            <option value="" disabled>Choose a term</option>
            {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
          <FieldError messages={state?.fieldErrors?.termId} />
        </div>
        <div>
          <label htmlFor="subjectId" className="field-label">Subject</label>
          <select id="subjectId" name="subjectId" className="field-select" disabled={disabled} defaultValue="" required>
            <option value="" disabled>Choose a subject</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
          <FieldError messages={state?.fieldErrors?.subjectId} />
        </div>
      </div>
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
      {!disabled && <SubmitButton pendingLabel="Computing…">Compute final grades</SubmitButton>}
    </form>
  );
}
