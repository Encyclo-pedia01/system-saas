'use client';

import { useActionState, useState } from 'react';

import {
  markFinalAction,
  saveGradeScaleAction,
  saveRemarksAction,
  setClassTeacherAction,
  setHeadmasterTagAction,
  unlockFinalAction,
} from '@/app/(app)/report-cards/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';
import { remarkMaxLength } from '@/lib/validation/report-cards';

type BandRow = { letter: string; minScore: string; label: string };

export function GradeScaleForm({ initial }: { initial: BandRow[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveGradeScaleAction, null);
  const [rows, setRows] = useState<BandRow[]>(
    initial.length > 0 ? initial : [{ letter: 'A', minScore: '80', label: 'Excellent' }, { letter: 'F', minScore: '0', label: 'Fail' }],
  );
  useActionToast(state);

  function update(index: number, field: keyof BandRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <p className="text-sm text-[var(--muted)]">
        Each band starts at the minimum score shown. The lowest band must start at 0. A score falls in the highest band it reaches.
      </p>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="grid gap-3 sm:grid-cols-[6rem_8rem_1fr_auto]">
            <div>
              <label className="field-label" htmlFor={`letter-${index}`}>Letter</label>
              <input id={`letter-${index}`} name="letter" value={row.letter} maxLength={3} onChange={(e) => update(index, 'letter', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor={`min-${index}`}>From score</label>
              <input id={`min-${index}`} name="minScore" inputMode="decimal" value={row.minScore} onChange={(e) => update(index, 'minScore', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor={`label-${index}`}>Label</label>
              <input id={`label-${index}`} name="label" value={row.label} maxLength={40} onChange={(e) => update(index, 'label', e.target.value)} className="field-input" />
            </div>
            <div className="flex items-end">
              <button type="button" className="btn btn-ghost" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <FieldError messages={state?.fieldErrors?.letter} />
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-ghost" onClick={() => setRows((current) => [...current, { letter: '', minScore: '', label: '' }])}>
          Add a band
        </button>
        <SubmitButton pendingLabel="Saving…">Save grade scale</SubmitButton>
      </div>
    </form>
  );
}

export function ClassTeacherForm({
  classId,
  current,
  staff,
}: {
  classId: string;
  current: string;
  staff: Array<{ userId: string; label: string }>;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setClassTeacherAction, null);
  useActionToast(state);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />
      <div className="min-w-56 flex-1">
        <label className="field-label" htmlFor={`teacher-${classId}`}>Class teacher</label>
        <select id={`teacher-${classId}`} name="userId" defaultValue={current} className="field-input">
          <option value="">No class teacher</option>
          {staff.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}
        </select>
      </div>
      <SubmitButton variant="ghost" pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}

export function HeadmasterTagForm({ membershipId, label, checked }: { membershipId: string; label: string; checked: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(setHeadmasterTagAction, null);
  useActionToast(state);

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="value" defaultChecked={checked} className="h-5 w-5 accent-[var(--accent)]" />
        {label}
      </label>
      <SubmitButton variant="ghost" pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}

export function RemarksForm({
  termId,
  studentId,
  studentName,
  classTeacherRemark,
  headmasterRemark,
  canClassTeacher,
  canHeadmaster,
}: {
  termId: string;
  studentId: string;
  studentName: string;
  classTeacherRemark: string;
  headmasterRemark: string;
  canClassTeacher: boolean;
  canHeadmaster: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveRemarksAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="studentId" value={studentId} />
      {canClassTeacher ? (
        <div>
          <label className="field-label" htmlFor={`ct-${studentId}`}>Class teacher remark for {studentName}</label>
          <textarea id={`ct-${studentId}`} name="classTeacherRemark" rows={2} maxLength={remarkMaxLength} defaultValue={classTeacherRemark} className="field-input" />
          <FieldError messages={errors?.classTeacherRemark} />
        </div>
      ) : (
        <p className="text-sm"><span className="text-[var(--muted)]">Class teacher remark: </span>{classTeacherRemark || 'Not written yet.'}</p>
      )}
      {canHeadmaster ? (
        <div>
          <label className="field-label" htmlFor={`hm-${studentId}`}>Headmaster remark for {studentName}</label>
          <textarea id={`hm-${studentId}`} name="headmasterRemark" rows={2} maxLength={remarkMaxLength} defaultValue={headmasterRemark} className="field-input" />
          <FieldError messages={errors?.headmasterRemark} />
        </div>
      ) : (
        <p className="text-sm"><span className="text-[var(--muted)]">Headmaster remark: </span>{headmasterRemark || 'Not written yet.'}</p>
      )}
      {(canClassTeacher || canHeadmaster) && (
        <SubmitButton variant="ghost" pendingLabel="Saving…">Save remarks</SubmitButton>
      )}
    </form>
  );
}

export function MarkFinalForm({ termId, classId, studentIds, label }: { termId: string; classId: string; studentIds: string[]; label: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(markFinalAction, null);
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="classId" value={classId} />
      {studentIds.map((id) => <input key={id} type="hidden" name="studentId" value={id} />)}
      <SubmitButton pendingLabel="Marking…">{label}</SubmitButton>
    </form>
  );
}

export function UnlockFinalForm({ termId, studentId }: { termId: string; studentId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(unlockFinalAction, null);
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="studentId" value={studentId} />
      <SubmitButton variant="ghost" pendingLabel="Unlocking…">Unlock</SubmitButton>
    </form>
  );
}
