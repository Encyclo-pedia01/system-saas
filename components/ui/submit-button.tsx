'use client';

import { useFormStatus } from 'react-dom';

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  variant = 'primary',
  className = '',
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`btn btn-${variant} ${className}`}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
