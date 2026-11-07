'use client';

import { useActionState } from 'react';

import { startImpersonationAction, toggleSchoolStatusAction } from '@/app/(app)/admin/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type SchoolView = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  timezone: string;
  created_at: string;
  invitations: Array<{ email: string; accepted_at: string | null }>;
};

export function SchoolRow({ school }: { school: SchoolView }) {
  const [statusState, statusAction] = useActionState<ActionResult | null, FormData>(toggleSchoolStatusAction, null);
  const [viewState, viewAction] = useActionState<ActionResult | null, FormData>(startImpersonationAction, null);
  useActionToast(statusState);
  useActionToast(viewState);

  const suspended = school.status === 'suspended';
  const invitation = school.invitations[0];

  return (
    <li className="depth-card grid gap-5 p-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="truncate text-lg font-semibold">{school.name}</h3>
          <span className={`badge ${suspended ? 'tone-danger' : 'tone-success'}`}>
            {school.status}
          </span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          /{school.slug} · {school.timezone}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Owner invite: {invitation ? `${invitation.email} · ${invitation.accepted_at ? 'accepted' : 'pending'}` : 'none recorded'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <form action={statusAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="institutionId" value={school.id} />
          <input type="hidden" name="status" value={suspended ? 'active' : 'suspended'} />
          <SubmitButton variant={suspended ? 'primary' : 'danger'} pendingLabel="Updating…">
            {suspended ? 'Reactivate school' : 'Suspend school'}
          </SubmitButton>
        </form>

        <form action={viewAction} className="space-y-2">
          <input type="hidden" name="institutionId" value={school.id} />
          <label htmlFor={`reason-${school.id}`} className="field-label">View as owner (read-only, 30 minutes)</label>
          <div className="flex gap-2">
            <input id={`reason-${school.id}`} name="reason" type="text" placeholder="Reason, e.g. support ticket" className="field-input" aria-invalid={Boolean(viewState?.fieldErrors?.reason)} />
            <SubmitButton variant="ghost" pendingLabel="Opening…">View</SubmitButton>
          </div>
          <FieldError messages={viewState?.fieldErrors?.reason} />
          {viewState && !viewState.ok && !viewState.fieldErrors && <p role="alert" className="form-error">{viewState.message}</p>}
        </form>
      </div>
    </li>
  );
}
