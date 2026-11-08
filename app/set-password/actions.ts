'use server';

import { redirect } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/result';
import { safeNextPath } from '@/lib/auth/safe-next';
import { failure, fromZodError } from '@/lib/actions/result';
import { MUST_CHANGE_PASSWORD_KEY, TEMP_PASSWORD_EXPIRES_KEY } from '@/lib/auth/temporary-password';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { setPasswordSchema } from '@/lib/validation/schemas';

export async function setPasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return failure('Could not save your password. Request a new invitation and try again.');
  }

  // Clear the temporary-password flag, which only the server can change.
  if (user && user.app_metadata?.[MUST_CHANGE_PASSWORD_KEY] === true) {
    const admin = createAdminClient();
    const appMetadata: Record<string, unknown> = { ...user.app_metadata };
    delete appMetadata[TEMP_PASSWORD_EXPIRES_KEY];
    appMetadata[MUST_CHANGE_PASSWORD_KEY] = false;
    await admin.auth.admin.updateUserById(user.id, { app_metadata: appMetadata });
  }

  redirect(safeNextPath(formData.get('next')));
}
