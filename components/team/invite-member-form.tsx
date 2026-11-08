'use client';

import { useActionState, useState } from 'react';

import { inviteMemberAction } from '@/app/(app)/team/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

type InviteResult = { link: string; emailed: boolean };

export function InviteMemberForm() {
  const [state, action] = useActionState<ActionResult<InviteResult> | null, FormData>(inviteMemberAction, null);
  const [copied, setCopied] = useState(false);
  useActionToast(state);
  const errors = state?.fieldErrors;
  const link = state?.ok ? state.data?.link : undefined;

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        <div>
          <label htmlFor="inviteEmail" className="field-label">Work email</label>
          <input id="inviteEmail" name="email" type="email" required className="field-input" aria-invalid={Boolean(errors?.email)} />
          <FieldError messages={errors?.email} />
        </div>
        <div>
          <label htmlFor="inviteRole" className="field-label">Role</label>
          <select id="inviteRole" name="role" required defaultValue="" className="field-select" aria-invalid={Boolean(errors?.role)}>
            <option value="" disabled>Choose a role</option>
            <option value="staff">Teacher (enters scores)</option>
          </select>
          <FieldError messages={errors?.role} />
        </div>
        {state && !state.ok && !state.fieldErrors && <p role="alert" className="form-error">{state.message}</p>}
        <SubmitButton variant="ghost" pendingLabel="Sending…">Send invitation</SubmitButton>
      </form>

      {link && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted)]">
            {state?.ok && state.data?.emailed ? 'Share this link too, in case the email is delayed. ' : 'Share this link with them. '}
            It works once and expires in 7 days.
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Invitation link" className="field-input text-xs" onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={copyLink} className="btn-ghost shrink-0 px-4 text-sm">{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
