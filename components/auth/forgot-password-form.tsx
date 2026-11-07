'use client';

import { useActionState } from 'react';

import { requestPasswordResetAction } from '@/app/forgot-password/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(requestPasswordResetAction, null);
  useActionToast(state);

  if (state?.ok) {
    return (
      <p role="status" className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 text-sm leading-relaxed text-[var(--text)]">
        {state.message}
      </p>
    );
  }

  const generalError = state && !state.ok && !state.fieldErrors ? state.message : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="field-label">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field-input"
          aria-invalid={Boolean(state?.fieldErrors?.email)}
        />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>

      {generalError && (
        <p role="alert" className="form-error">
          {generalError}
        </p>
      )}

      <SubmitButton pendingLabel="Sending…" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
