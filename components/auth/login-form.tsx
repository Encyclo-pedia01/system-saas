'use client';

import { useActionState, useState } from 'react';

import { signInAction } from '@/app/login/actions';
import { useActionToast } from '@/components/ui/use-action-toast';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import type { ActionResult } from '@/lib/actions/result';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required className="field-input pr-24" aria-invalid={Boolean(state?.fieldErrors?.password)} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} className="absolute inset-y-1 right-1 min-h-10 rounded-lg px-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {showPassword ? 'Hide' : 'Show'} password
          </button>
        </div>
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
