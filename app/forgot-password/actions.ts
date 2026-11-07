'use server';

import type { ActionResult } from '@/lib/actions/result';
import { failure, fromZodError, success } from '@/lib/actions/result';
import { siteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { forgotPasswordSchema } from '@/lib/validation/schemas';

const confirmation = 'If an account exists for that email, a reset link is on its way.';

export async function requestPasswordResetAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/set-password`,
  });

  if (error && error.status !== 429) {
    return failure('We could not send the reset link. Please try again shortly.');
  }

  // The same message is shown whether or not the account exists, so the form cannot be used to find accounts.
  return success(confirmation);
}
