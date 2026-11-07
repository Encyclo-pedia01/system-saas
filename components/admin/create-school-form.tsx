'use client';

import { useActionState, useState } from 'react';

import { createSchoolAction } from '@/app/(app)/admin/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

type CreateSchoolResult = { institutionId: string; inviteLink: string };

export function CreateSchoolForm() {
  const [state, formAction] = useActionState<ActionResult<CreateSchoolResult> | null, FormData>(createSchoolAction, null);
  const [copied, setCopied] = useState(false);
  useActionToast(state);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const inviteLink = state?.ok ? state.data?.inviteLink : undefined;

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
    <form action={formAction} className="space-y-6" noValidate>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm font-semibold text-[var(--accent-soft)]">School details</legend>
        <div className="sm:col-span-2">
          <label htmlFor="name" className="field-label">School name</label>
          <input id="name" name="name" required className="field-input" aria-invalid={Boolean(errors?.name)} />
          <FieldError messages={errors?.name} />
        </div>
        <div>
          <label htmlFor="slug" className="field-label">URL slug</label>
          <input id="slug" name="slug" required placeholder="alpha-academy" className="field-input" aria-invalid={Boolean(errors?.slug)} aria-describedby="slugHint" />
          <p id="slugHint" className="mt-1 text-xs text-[var(--muted)]">A short unique name for the school. Lowercase letters, numbers, and single hyphens, such as alpha-academy.</p>
          <FieldError messages={errors?.slug} />
        </div>
        <div>
          <label htmlFor="timezone" className="field-label">Timezone</label>
          <select id="timezone" name="timezone" defaultValue="Africa/Accra" className="field-select">
            <option value="Africa/Accra">Ghana (Africa/Accra)</option>
          </select>
          <FieldError messages={errors?.timezone} />
        </div>
        <div>
          <label htmlFor="schoolStartTime" className="field-label">School start time</label>
          <input id="schoolStartTime" name="schoolStartTime" type="time" defaultValue="08:00" required className="field-input" aria-invalid={Boolean(errors?.schoolStartTime)} />
          <FieldError messages={errors?.schoolStartTime} />
        </div>
        <div>
          <label htmlFor="gracePeriodMinutes" className="field-label">Grace period (minutes)</label>
          <input id="gracePeriodMinutes" name="gracePeriodMinutes" type="number" min={0} max={120} defaultValue={0} required className="field-input" aria-invalid={Boolean(errors?.gracePeriodMinutes)} />
          <FieldError messages={errors?.gracePeriodMinutes} />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm font-semibold text-[var(--accent-soft)]">School owner</legend>
        <div>
          <label htmlFor="ownerName" className="field-label">Full name</label>
          <input id="ownerName" name="ownerName" required className="field-input" aria-invalid={Boolean(errors?.ownerName)} />
          <FieldError messages={errors?.ownerName} />
        </div>
        <div>
          <label htmlFor="ownerEmail" className="field-label">Email</label>
          <input id="ownerEmail" name="ownerEmail" type="email" required className="field-input" aria-invalid={Boolean(errors?.ownerEmail)} />
          <FieldError messages={errors?.ownerEmail} />
        </div>
      </fieldset>

      {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}

      <SubmitButton pendingLabel="Creating school…">Create school and get owner invitation</SubmitButton>
    </form>

    {inviteLink && (
      <div className="notice mt-6 space-y-3 rounded-2xl p-4 text-sm" role="status">
        <p className="font-semibold">Send this link to the owner</p>
        <p className="text-[var(--muted)]">
          It opens the set-password page once. Share it privately. It is not emailed by Campus Veritas.
        </p>
        <div className="flex gap-2">
          <input readOnly value={inviteLink} aria-label="Owner invitation link" className="field-input min-w-0 flex-1 text-xs" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={copyLink} className="btn btn-ghost shrink-0 px-4 text-sm">{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    )}
    </>
  );
}
