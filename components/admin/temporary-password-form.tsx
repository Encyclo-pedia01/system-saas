'use client';

import { useActionState, useState } from 'react';

import { setTemporaryPasswordAction, type TemporaryPasswordResult } from '@/app/(app)/admin/users/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import type { ActionResult } from '@/lib/actions/result';

export function TemporaryPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState<ActionResult<TemporaryPasswordResult> | null, FormData>(setTemporaryPasswordAction, null);
  const [copied, setCopied] = useState(false);
  const result = state?.ok ? state.data : undefined;

  async function copyPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton variant="ghost" pendingLabel="Setting…" className="min-h-11 px-4 text-sm">
          Set temporary password
        </SubmitButton>
      </form>

      {state && !state.ok && <p role="alert" className="form-error text-sm">{state.message}</p>}

      {result && (
        <div className="notice space-y-2 rounded-xl p-4 text-sm" role="status">
          <p className="font-semibold">{state?.ok ? state.message : null}</p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--hover)] px-3 py-2 font-mono text-base" aria-label="Temporary password">
              {result.password}
            </code>
            <button type="button" onClick={copyPassword} className="btn btn-ghost shrink-0 px-4 text-sm">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Valid until {new Date(result.expiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} if not used. The user must choose a new password at sign-in.
          </p>
        </div>
      )}
    </div>
  );
}
