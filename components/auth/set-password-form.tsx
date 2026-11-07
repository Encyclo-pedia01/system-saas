'use client';

import { useActionState } from 'react';

import { setPasswordAction } from '@/app/set-password/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function SetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setPasswordAction, null);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="password" className="field-label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="field-input" aria-invalid={Boolean(state?.fieldErrors?.password)} />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="field-label">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="field-input" aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)} />
        <FieldError messages={state?.fieldErrors?.confirmPassword} />
      </div>
      {state && !state.ok && !state.fieldErrors && (
        <p role="alert" className="form-error">{state.message}</p>
      )}
      <SubmitButton pendingLabel="Saving…" className="w-full">Save password</SubmitButton>
    </form>
  );
}
