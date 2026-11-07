'use client';

import { useActionState, useState } from 'react';

import { importStudentsAction } from '@/app/(app)/students/actions';
import type { ClassOption } from '@/components/students/student-forms';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';
import { maxRosterRows, parseRosterFile, type RosterRow } from '@/lib/students/roster';

export function StudentUpload({ classes }: { classes: ClassOption[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(importStudentsAction, null);
  const [classId, setClassId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  useActionToast(state);

  const selected = classes.find((c) => c.id === classId);
  const ready = rows?.filter((row) => row.issue === null) ?? [];
  const flagged = rows?.filter((row) => row.issue !== null) ?? [];
  const groupMissing = Boolean(selected?.hasGroups && !groupId);

  async function handleFile(file: File | undefined) {
    setRows(null);
    setFileError(null);
    if (!file) return;

    setParsing(true);
    const result = await parseRosterFile(file);
    setParsing(false);

    if (result.ok) {
      setRows(result.rows);
    } else {
      setFileError(result.message);
    }
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="uploadClass" className="field-label">Class</label>
          <select
            id="uploadClass"
            name="classId"
            required
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setGroupId('');
            }}
            className="field-select"
          >
            <option value="" disabled>Choose a class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selected?.hasGroups && (
          <div>
            <label htmlFor="uploadGroup" className="field-label">Group</label>
            <select
              id="uploadGroup"
              name="groupId"
              required
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="field-select"
            >
              <option value="" disabled>Choose a group</option>
              {selected.groups.map((g) => <option key={g.id} value={g.id}>{selected.name} {g.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="rosterFile" className="field-label">Student file (.csv or .xlsx)</label>
        <input
          id="rosterFile"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="field-input file:mr-4 file:rounded-md file:border-0 file:bg-[var(--hover)] file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          The first row must be headers: <span className="font-medium">Name</span> and <span className="font-medium">Admission number</span>. Up to {maxRosterRows} students per file.
        </p>
        {parsing && <p className="mt-2 text-sm text-[var(--muted)]" role="status">Reading the file…</p>}
        {fileError && <p role="alert" className="form-error mt-2">{fileError}</p>}
      </div>

      {rows && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-semibold">{ready.length} ready</span>
            {flagged.length > 0 && <span className="text-[var(--muted)]"> · {flagged.length} need fixing (these rows will be skipped)</span>}
          </p>
          <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--panel-solid)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2">Line</th>
                  <th scope="col" className="px-3 py-2">Name</th>
                  <th scope="col" className="px-3 py-2">Admission number</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((row) => (
                  <tr key={row.line} className={row.issue ? 'bg-[var(--tone-danger-bg)]' : undefined}>
                    <td className="px-3 py-2 text-[var(--muted)]">{row.line}</td>
                    <td className="px-3 py-2">{row.fullName || '—'}</td>
                    <td className="px-3 py-2">{row.admissionNumber || '—'}</td>
                    <td className="px-3 py-2">{row.issue ?? <span className="text-[var(--tone-success-text)]">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input type="hidden" name="students" value={JSON.stringify(ready.map(({ fullName, admissionNumber }) => ({ fullName, admissionNumber })))} />
          <SubmitButton disabled={ready.length === 0 || !classId || groupMissing} pendingLabel="Importing…">
            Import {ready.length} {ready.length === 1 ? 'student' : 'students'}
          </SubmitButton>
          {groupMissing && <p className="text-xs text-[var(--muted)]">Choose a group before importing.</p>}
        </div>
      )}

      {state && !state.ok && <p role="alert" className="form-error">{state.message}</p>}
    </form>
  );
}
