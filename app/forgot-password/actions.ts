'use server';

import type { ActionResult } from '@/lib/actions/result';
import { failure, fromZodError, success } from '@/lib/actions/result';
import { siteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { forgotPasswordSchema } from '@/lib/validation/schemas';

async function accountExists(email: string): Promise<boolean | null> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) return null;

  const body = (await response.json()) as { users?: { email?: string | null }[] };
  return (body.users ?? []).some((user) => user.email?.toLowerCase() === email);
}

export async function requestPasswordResetAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const email = parsed.data.email;
  const exists = await accountExists(email);

  if (exists === null) {
    return failure('We could not check that account right now. Please try again shortly.');
  }

  if (!exists) {
    return failure('No account exists for that email address. Check the spelling or ask your school administrator.');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/set-password`,
  });

  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return failure(
        'Too many reset emails have been requested recently, so this one was not sent. Please wait about an hour and try again.',
      );
    }
    return failure('The reset email could not be sent. Please try again shortly.');
  }

  return success(`A reset link has been sent to ${email}. Check your inbox and spam folder.`);
}
