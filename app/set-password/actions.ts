'use server';

import { redirect } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/result';
import { safeNextPath } from '@/lib/auth/safe-next';
import { failure, fromZodError } from '@/lib/actions/result';
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
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return failure('Could not save your password. Request a new invitation and try again.');
  }

  redirect(safeNextPath(formData.get('next')));
}
