'use client';

import { useActionState } from 'react';

import { createAssessmentAction, saveAssessmentScoresAction, saveExamScoresAction } from '@/app/(app)/scores/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

type Option = { id: string; name: string };
type Student = { id: string; full_name: string };

export function AssessmentForm({ classes, subjects, terms }: { classes: Option[]; subjects: Option[]; terms: Option[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createAssessmentAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor="a-class" className="field-label">Class</label>
        <select id="a-class" name="classId" required defaultValue="" className="field-select"><option value="" disabled>Choose</option>{classes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <FieldError messages={errors?.classId} />
      </div>
      <div>
        <label htmlFor="a-subject" className="field-label">Subject</label>
        <select id="a-subject" name="subjectId" required defaultValue="" className="field-select"><option value="" disabled>Choose</option>{subjects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <FieldError messages={errors?.subjectId} />
      </div>
      <div>
        <label htmlFor="a-term" className="field-label">Term</label>
        <select id="a-term" name="termId" required defaultValue="" className="field-select"><option value="" disabled>Choose</option>{terms.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <FieldError messages={errors?.termId} />
      </div>
      <div>
        <label htmlFor="a-title" className="field-label">Title</label>
        <input id="a-title" name="title" required placeholder="Class test 2" className="field-input" aria-invalid={Boolean(errors?.title)} />
        <FieldError messages={errors?.title} />
      </div>
      <div>
        <label htmlFor="a-max" className="field-label">Maximum score</label>
        <input id="a-max" name="maxScore" type="number" min={1} step="0.5" defaultValue={20} required className="field-input" aria-invalid={Boolean(errors?.maxScore)} />
        <FieldError messages={errors?.maxScore} />
      </div>
      <div className="flex items-end">
        <SubmitButton variant="ghost" pendingLabel="Creating…">Create assessment</SubmitButton>
      </div>
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error sm:col-span-2">{state.message}</p>}
    </form>
  );
}

// Shared table for entering scores. Blank rows are not saved.
function ScoreTable({
  students,
  existing,
  max,
  hidden,
  action,
  submitLabel,
  pendingLabel,
}: {
  students: Student[];
  existing: Record<string, number>;
  max: number;
  hidden: Record<string, string>;
  action: (formData: FormData) => void;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <form action={action} className="space-y-4" noValidate>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Score (out of {max})</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-2.5 font-medium">{student.full_name}</td>
                <td className="px-4 py-2">
                  <input
                    name={`score_${student.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={max}
                    step="0.5"
                    defaultValue={existing[student.id] ?? ''}
                    aria-label={`Score for ${student.full_name}`}
                    className="field-input max-w-32"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}


export function AssessmentScoreForm(props: { assessmentId: string; students: Student[]; existing: Record<string, number>; max: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveAssessmentScoresAction, null);
  useActionToast(state);

  return (
    <div className="space-y-4">
      <ScoreTable
        students={props.students}
        existing={props.existing}
        max={props.max}
        hidden={{ assessmentId: props.assessmentId }}
        action={action}
        submitLabel="Save scores"
        pendingLabel="Saving…"
      />
      {state && !state.ok && <p role="alert" className="form-error">{state.message}</p>}
    </div>
  );
}

export function ExamScoreForm(props: { classId: string; subjectId: string; termId: string; max: number; students: Student[]; existing: Record<string, number> }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveExamScoresAction, null);
  useActionToast(state);

  return (
    <div className="space-y-4">
      <ScoreTable
        students={props.students}
        existing={props.existing}
        max={props.max}
        hidden={{ classId: props.classId, subjectId: props.subjectId, termId: props.termId, maxScore: String(props.max) }}
        action={action}
        submitLabel="Save exam scores"
        pendingLabel="Saving…"
      />
      {state && !state.ok && <p role="alert" className="form-error">{state.message}</p>}
    </div>
  );
}
