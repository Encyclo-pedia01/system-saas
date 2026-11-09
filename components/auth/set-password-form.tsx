'use client';

import { useActionState, useState } from 'react';

import { setPasswordAction } from '@/app/set-password/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function SetPasswordForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setPasswordAction, null);
  const [showPasswords, setShowPasswords] = useState(false);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowPasswords((value) => !value)} aria-pressed={showPasswords} className="min-h-11 px-2 text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          {showPasswords ? 'Hide passwords' : 'Show passwords'}
        </button>
      </div>
      <div>
        <label htmlFor="password" className="field-label">New password</label>
        <input id="password" name="password" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required className="field-input" aria-invalid={Boolean(state?.fieldErrors?.password)} />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="field-label">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required className="field-input" aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)} />
        <FieldError messages={state?.fieldErrors?.confirmPassword} />
      </div>
      {state && !state.ok && !state.fieldErrors && (
        <p role="alert" className="form-error">{state.message}</p>
      )}
      <SubmitButton pendingLabel="Saving…" className="w-full">Save password</SubmitButton>
    </form>
  );
}
