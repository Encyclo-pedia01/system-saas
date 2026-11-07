'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

import type { ActionResult } from '@/lib/actions/result';

// Shows a toast for every settled action result. Field errors stay inline.
export function useActionToast(state: ActionResult<unknown> | null | undefined) {
  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.ok && state.message) {
      toast.success(state.message);
    }

    if (!state.ok && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);
}
