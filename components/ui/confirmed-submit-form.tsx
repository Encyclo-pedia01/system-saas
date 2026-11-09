'use client';

import { useRef, type FormEvent, type ReactNode } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';

type ConfirmedSubmitFormProps = {
  action: (formData: FormData) => void;
  children: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  pendingLabel: string;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
};

export function ConfirmedSubmitForm({
  action,
  children,
  title,
  description,
  actionLabel,
  pendingLabel,
  variant = 'danger',
  className = '',
}: ConfirmedSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmedRef = useRef(false);

  function interceptSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    event.preventDefault();
    dialogRef.current?.showModal();
  }

  function confirm() {
    confirmedRef.current = true;
    dialogRef.current?.close();
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} onSubmit={interceptSubmit} className={className} noValidate>
      {children}
      <dialog ref={dialogRef} aria-labelledby="confirm-action-title" className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[var(--overlay)]">
        <div className="space-y-4 p-6">
          <h2 id="confirm-action-title" className="text-lg font-bold">{title}</h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{description}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button type="button" className={`btn ${variant === 'danger' ? 'btn-danger' : variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`} onClick={confirm}>{actionLabel}</button>
          </div>
        </div>
      </dialog>
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>{actionLabel}</SubmitButton>
    </form>
  );
}
