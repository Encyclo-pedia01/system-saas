'use client';

import { useActionState, useState } from 'react';

import { importScoresAction } from '@/app/(app)/scores/import-actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';
import { maxScoreRows, parseScoreFile, type ScoreRow } from '@/lib/scores/score-file';

export type AssessmentOption = { id: string; title: string; maxScore: number; className: string };
export type NamedOption = { id: string; name: string };

export function ScoreUpload({
  assessments,
  classes,
  subjects,
  terms,
}: {
  assessments: AssessmentOption[];
  classes: NamedOption[];
  subjects: NamedOption[];
  terms: NamedOption[];
}) {
  const [state, action] = useActionState<ActionResult<{ saved: number; replaced: number }> | null, FormData>(importScoresAction, null);
  useActionToast(state);

  const [mode, setMode] = useState<'assessment' | 'exam'>('assessment');
  const [assessmentId, setAssessmentId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId, setTermId] = useState('');
  const [examMax, setExamMax] = useState('100');
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const maxScore = mode === 'assessment'
    ? Number(assessments.find((a) => a.id === assessmentId)?.maxScore ?? 0)
    : Number(examMax) || 0;
  const ready = rows?.filter((row) => row.score !== null && row.issue === null) ?? [];
  const flagged = rows?.filter((row) => row.issue !== null) ?? [];
  const contextReady = mode === 'assessment' ? assessmentId !== '' : Boolean(classId && subjectId && termId && maxScore > 0);

  async function handleFile(file: File | undefined) {
    setRows(null);
    setFileError(null);
    if (!file || !contextReady) {
      if (file && !contextReady) setFileError('Choose the assessment, or the class, subject, term, and maximum, before uploading.');
      return;
    }

    setParsing(true);
    const result = await parseScoreFile(file, maxScore);
    setParsing(false);

    if (result.ok) setRows(result.rows);
    else setFileError(result.message);
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-3">
        <legend className="field-label">Scores are for</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="assessment" checked={mode === 'assessment'} onChange={() => { setMode('assessment'); setRows(null); }} className="accent-[var(--accent)]" />
            An assessment
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="exam" checked={mode === 'exam'} onChange={() => { setMode('exam'); setRows(null); }} className="accent-[var(--accent)]" />
            Exam scores
          </label>
        </div>
      </fieldset>

      {mode === 'assessment' ? (
        <div>
          <label htmlFor="uploadAssessment" className="field-label">Assessment</label>
          <select id="uploadAssessment" name="assessmentId" required value={assessmentId} onChange={(e) => { setAssessmentId(e.target.value); setRows(null); }} className="field-select">
            <option value="" disabled>Choose an assessment</option>
            {assessments.map((a) => <option key={a.id} value={a.id}>{a.className}: {a.title} (out of {a.maxScore})</option>)}
          </select>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="uploadExamClass" className="field-label">Class</label>
            <select id="uploadExamClass" name="classId" required value={classId} onChange={(e) => { setClassId(e.target.value); setRows(null); }} className="field-select">
              <option value="" disabled>Choose a class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="uploadExamSubject" className="field-label">Subject</label>
            <select id="uploadExamSubject" name="subjectId" required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setRows(null); }} className="field-select">
              <option value="" disabled>Choose a subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="uploadExamTerm" className="field-label">Term</label>
            <select id="uploadExamTerm" name="termId" required value={termId} onChange={(e) => { setTermId(e.target.value); setRows(null); }} className="field-select">
              <option value="" disabled>Choose a term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="uploadExamMax" className="field-label">Maximum score</label>
            <input id="uploadExamMax" name="maxScore" type="number" min={1} max={1000} value={examMax} onChange={(e) => { setExamMax(e.target.value); setRows(null); }} required className="field-input" />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="scoreFile" className="field-label">Score file (.csv or .xlsx)</label>
        <input
          id="scoreFile"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="field-input file:mr-4 file:rounded-md file:border-0 file:bg-[var(--hover)] file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          The first row must be headers: <span className="font-medium">Admission number</span> and <span className="font-medium">Score</span>. Leave a score blank to skip that student. Up to {maxScoreRows} rows.{' '}
          <a href="/templates/scores-template.csv" download className="font-medium text-[var(--accent-soft)] underline">Download template</a>
        </p>
        {parsing && <p role="status" className="mt-2 text-sm text-[var(--muted)]">Reading the file…</p>}
        {fileError && <p role="alert" className="form-error mt-2">{fileError}</p>}
      </div>

      {rows && (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-semibold">{ready.length} ready</span>
            {flagged.length > 0 && <span className="text-[var(--muted)]"> · {flagged.length} need fixing. Fix them and upload again to save anything.</span>}
          </p>
          <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--panel-solid)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2">Line</th>
                  <th scope="col" className="px-3 py-2">Admission number</th>
                  <th scope="col" className="px-3 py-2">Score</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((row) => (
                  <tr key={row.line} className={row.issue ? 'bg-[var(--tone-danger-bg)]' : undefined}>
                    <td className="px-3 py-2 text-[var(--muted)]">{row.line}</td>
                    <td className="px-3 py-2">{row.admissionNumber || '—'}</td>
                    <td className="px-3 py-2">{row.score ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.issue ?? (row.score === null ? <span className="text-[var(--muted)]">No score, skipped</span> : <span className="text-[var(--tone-success-text)]">Ready</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input type="hidden" name="rows" value={JSON.stringify(ready.map(({ admissionNumber, score }) => ({ admissionNumber, score })))} />
          <SubmitButton disabled={ready.length === 0 || flagged.length > 0 || !contextReady} pendingLabel="Saving…">
            Save {ready.length} {ready.length === 1 ? 'score' : 'scores'}
          </SubmitButton>
          {flagged.length > 0 && <p className="text-xs text-[var(--muted)]">Fix the highlighted rows first. Nothing is saved while any row has a problem.</p>}
        </div>
      )}

      {state && !state.ok && <p role="alert" className="form-error">{state.message}</p>}
    </form>
  );
}
