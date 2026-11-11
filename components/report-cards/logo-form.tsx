'use client';

import { useActionState } from 'react';

import { removeSchoolLogoAction, uploadSchoolLogoAction } from '@/app/(app)/report-cards/logo-actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export function LogoForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(uploadSchoolLogoAction, null);
  useActionToast(state);

  return (
    <div className="space-y-4">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Current school logo" className="h-16 w-auto max-w-48 object-contain" />
      ) : (
        <p className="text-sm text-[var(--muted)]">No logo yet. Report cards print without one.</p>
      )}
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="field-label" htmlFor="school-logo">Logo file</label>
          <input id="school-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="field-input" required />
          <p className="mt-1 text-xs text-[var(--muted)]">PNG, JPG or WebP, 1 MB or smaller.</p>
        </div>
        <SubmitButton variant="ghost" pendingLabel="Uploading…">{currentUrl ? 'Replace logo' : 'Upload logo'}</SubmitButton>
      </form>
      {currentUrl ? <RemoveLogoButton /> : null}
    </div>
  );
}

function RemoveLogoButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(async () => removeSchoolLogoAction(), null);
  useActionToast(state);

  return (
    <form action={action}>
      <SubmitButton variant="ghost" pendingLabel="Removing…">Remove logo</SubmitButton>
    </form>
  );
}
