'use client';

import { useId, useRef, useState, type ReactNode } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';

// For serious actions. The owner opens a dialog, types the item's name, and only then can confirm.
// Escape or Cancel closes the dialog without doing anything.
export function TypedConfirm({
  action,
  hiddenFields,
  itemName,
  triggerLabel,
  title,
  consequence,
  confirmLabel,
  pendingLabel,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string>;
  itemName: string;
  triggerLabel: string;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const matches = typed.trim() === itemName.trim();

  function close() {
    dialogRef.current?.close();
    setTyped('');
  }

  return (
    <>
      <button type="button" className="btn btn-danger min-h-11" onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${inputId}-title`}
        onClose={() => setTyped('')}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[var(--overlay)]"
      >
        <form action={action} className="flex flex-col gap-4 p-6">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={`${inputId}-title`} className="text-lg font-bold">
            {title}
          </h2>
          <div className="text-sm leading-relaxed text-[var(--muted)]">{consequence}</div>
          <div>
            <label htmlFor={inputId} className="field-label">
              Type <strong className="text-[var(--text)]">{itemName}</strong> to confirm
            </label>
            <input
              id={inputId}
              className="field-input"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-ghost min-h-11" onClick={close}>
              Cancel
            </button>
            <SubmitButton variant="danger" pendingLabel={pendingLabel} disabled={!matches}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
