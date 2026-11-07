'use client';

import { useActionState, type ChangeEvent } from 'react';

import { confirmAuthenticatorAction, verifySignInCodeAction } from '@/app/mfa/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

// Accepts typed or pasted codes ("123 456" included). Submits itself once six digits are in.
function CodeInput() {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
    event.currentTarget.value = digits;
    if (digits.length === 6) event.currentTarget.form?.requestSubmit();
  }

  return (
    <div>
      <label htmlFor="code" className="field-label">6-digit code</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        onChange={handleChange}
        className="field-input text-center text-lg tracking-[0.3em]"
      />
    </div>
  );
}

export function SetupAuthenticatorForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(confirmAuthenticatorAction, null);
  useActionToast(state);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="factorId" value={factorId} />
      <CodeInput />
      <FieldError messages={state?.fieldErrors?.code} />
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
      <SubmitButton pendingLabel="Checking…" className="w-full">Turn on sign-in codes</SubmitButton>
    </form>
  );
}

export function SignInCodeForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(verifySignInCodeAction, null);
  useActionToast(state);

  return (
    <form action={action} className="space-y-5" noValidate>
      <CodeInput />
      <FieldError messages={state?.fieldErrors?.code} />
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
      <SubmitButton pendingLabel="Checking…" className="w-full">Continue</SubmitButton>
    </form>
  );
}
