'use client';

import { useActionState } from 'react';

import { removeTeamMemberAction } from '@/app/(app)/team/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function RemoveMemberForm({ membershipId, label }: { membershipId: string; label: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(removeTeamMemberAction, null);
  useActionToast(state);

  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-between gap-3"
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${label} from the school? Their account is kept, but they lose access.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <SubmitButton variant="danger" pendingLabel="Removing…">Remove access</SubmitButton>
    </form>
  );
}
