'use client';

import { useActionState } from 'react';

import { signInAction } from '@/app/login/actions';
import { useActionToast } from '@/components/ui/use-action-toast';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import type { ActionResult } from '@/lib/actions/result';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);
  useActionToast(state);

  const generalError = state && !state.ok && !state.fieldErrors ? state.message : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
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

      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
          aria-invalid={Boolean(state?.fieldErrors?.password)}
        />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>

      {generalError && (
        <p role="alert" className="form-error">
          {generalError}
        </p>
      )}

      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
