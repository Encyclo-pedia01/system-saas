'use client';

import { useRef } from 'react';

// A plain GET form, so filters survive reloads and can be shared. Name search waits
// 300 ms after the last keystroke before submitting.
export function FeeFilters({
  classes,
  classId,
  query,
}: {
  classes: Array<{ id: string; name: string }>;
  classId: string;
  query: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function submitSoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => formRef.current?.requestSubmit(), 300);
  }

  return (
    <form ref={formRef} method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]" role="search">
      <div>
        <label htmlFor="feeQuery" className="field-label">Find a student</label>
        <input
          id="feeQuery"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Name or admission number"
          className="field-input"
          onInput={submitSoon}
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="feeClassFilter" className="field-label">Class</label>
        <select
          id="feeClassFilter"
          name="classId"
          defaultValue={classId}
          className="field-input"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="">All classes</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
      </div>
      <noscript>
        <button type="submit" className="btn btn-ghost self-end">Apply</button>
      </noscript>
    </form>
  );
}
