import 'server-only';

import { assertWritable, getViewer, mfaRedirectFor, type AppRole } from '@/lib/auth/viewer';

export type WriteContext = { userId: string; institutionId: string };
export type WriteGuardResult = { ok: true; context: WriteContext } | { ok: false; message: string };

// Resolves who is writing and where, and rejects roles outside the allowed set.
// Impersonation is always rejected here because it is read-only.
export async function resolveWriteContext(allowed: AppRole[]): Promise<WriteGuardResult> {
  const viewer = await getViewer();

  if (!viewer || !viewer.effectiveRole || !viewer.institution) {
    return { ok: false, message: 'You do not have permission to do that.' };
  }

  if (!allowed.includes(viewer.effectiveRole)) {
    return { ok: false, message: 'Your role cannot make this change.' };
  }

  const readOnlyMessage = assertWritable(viewer);

  if (readOnlyMessage) {
    return { ok: false, message: readOnlyMessage };
  }

  if (mfaRedirectFor(viewer)) {
    return { ok: false, message: 'Confirm your sign-in code before making changes.' };
  }

  return {
    ok: true,
    context: { userId: viewer.userId, institutionId: viewer.institution.id },
  };
}
