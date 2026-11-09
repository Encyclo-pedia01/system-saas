'use client';

import { useRef } from 'react';

import { setSetupGuideHiddenAction } from '@/app/(app)/dashboard/actions';

// A tick box that hides the setup guide on this device. Ticking it saves straight away.
export function SetupGuideToggle({ hidden }: { hidden: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setSetupGuideHiddenAction} className="mt-4 flex items-center gap-3 border-t border-[var(--border)] pt-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          name="hidden"
          value="1"
          defaultChecked={hidden}
          onChange={() => formRef.current?.requestSubmit()}
          className="size-5 accent-[var(--accent)]"
        />
        Hide the setup guide on this device
      </label>
    </form>
  );
}
