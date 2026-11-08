'use client';

import { useActionState } from 'react';

import { startImpersonationAction, toggleSchoolStatusAction, updateSubscriptionAction } from '@/app/(app)/admin/actions';
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
  plan: 'trial' | 'paid';
  subscription_ends_on: string | null;
  licence_reference: string | null;
};

function accessLabel(school: SchoolView): string {
  if (!school.subscription_ends_on) return 'No end date';
  const end = new Date(`${school.subscription_ends_on}T00:00:00Z`).getTime();
  const days = Math.round((end - Date.now()) / 86400000);
  if (days >= 0) return `${school.plan === 'trial' ? 'Trial' : 'Paid'} · ends in ${days} day${days === 1 ? '' : 's'}`;
  if (days >= -7) return `Grace period · ${-days} day${days === -1 ? '' : 's'} left`;
  return 'Expired';
}

export function SchoolRow({ school }: { school: SchoolView }) {
  const [statusState, statusAction] = useActionState<ActionResult | null, FormData>(toggleSchoolStatusAction, null);
  const [viewState, viewAction] = useActionState<ActionResult | null, FormData>(startImpersonationAction, null);
  const [subscriptionState, subscriptionAction] = useActionState<ActionResult | null, FormData>(updateSubscriptionAction, null);
  useActionToast(statusState);
  useActionToast(viewState);
  useActionToast(subscriptionState);

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
        <p className="text-xs text-[var(--muted)]">
          Subscription: {accessLabel(school)}{school.licence_reference ? ` · ref ${school.licence_reference}` : ''}
        </p>

        <details className="pt-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent-soft)]">Edit subscription</summary>
          <form action={subscriptionAction} className="mt-3 grid gap-3 sm:grid-cols-2" noValidate>
            <input type="hidden" name="institutionId" value={school.id} />
            <div>
              <label htmlFor={`plan-${school.id}`} className="field-label">Plan</label>
              <select id={`plan-${school.id}`} name="plan" defaultValue={school.plan} className="field-select">
                <option value="trial">Trial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label htmlFor={`ends-${school.id}`} className="field-label">Access until</label>
              <input id={`ends-${school.id}`} name="subscriptionEndsOn" type="date" defaultValue={school.subscription_ends_on ?? ''} className="field-input" aria-describedby={`ends-help-${school.id}`} />
              <p id={`ends-help-${school.id}`} className="mt-1 text-xs text-[var(--muted)]">Leave empty for no end date. Seven days of grace follow.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`licence-${school.id}`} className="field-label">Licence or payment reference</label>
              <input id={`licence-${school.id}`} name="licenceReference" type="text" maxLength={80} defaultValue={school.licence_reference ?? ''} placeholder="e.g. invoice 2026-014" className="field-input" />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <SubmitButton variant="ghost" pendingLabel="Saving…">Save subscription</SubmitButton>
              {subscriptionState && !subscriptionState.ok && <p role="alert" className="form-error">{subscriptionState.message}</p>}
            </div>
          </form>
        </details>
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
