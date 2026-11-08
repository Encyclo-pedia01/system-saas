'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { failure, success } from '@/lib/actions/result';
import {
  generateTemporaryPassword,
  MUST_CHANGE_PASSWORD_KEY,
  TEMP_PASSWORD_EXPIRES_KEY,
  TEMP_PASSWORD_HOURS,
} from '@/lib/auth/temporary-password';
import { getViewer } from '@/lib/auth/viewer';
import { createAdminClient } from '@/lib/supabase/admin';

export type TemporaryPasswordResult = { email: string; password: string; expiresAt: string };

// Gives an account a one-time temporary password. The password is returned once to the platform
// administrator and is not stored. The account must choose its own password at next sign-in.
export async function setTemporaryPasswordAction(
  _previous: ActionResult<TemporaryPasswordResult> | null,
  formData: FormData,
): Promise<ActionResult<TemporaryPasswordResult>> {
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) {
    return failure('You do not have permission to do that.');
  }

  const userId = String(formData.get('userId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return failure('That account could not be found.');
  }

  const admin = createAdminClient();
  const { data: found, error: findError } = await admin.auth.admin.getUserById(userId);
  if (findError || !found.user) {
    return failure('That account could not be found.');
  }

  const target = found.user;
  const password = generateTemporaryPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_HOURS * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: {
      ...target.app_metadata,
      [MUST_CHANGE_PASSWORD_KEY]: true,
      [TEMP_PASSWORD_EXPIRES_KEY]: expiresAt,
    },
  });

  if (updateError) {
    return failure('Could not set the temporary password. Try again.');
  }

  const { error: auditError } = await admin.from('audit_log').insert({
    institution_id: null,
    table_name: 'auth.users',
    record_id: userId,
    operation: 'UPDATE',
    actor_id: viewer.userId,
    after_data: { event: 'admin_temporary_password_set', expires_at: expiresAt },
  });

  revalidatePath('/admin/users');

  const message = auditError
    ? 'Temporary password set, but the audit entry could not be written. Tell the platform engineer.'
    : 'Temporary password set. Copy it now; it will not be shown again.';

  return success(message, { email: target.email ?? '', password, expiresAt });
}
