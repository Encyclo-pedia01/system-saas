'use server';

import { redirect } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/result';
import { failure, fromZodError } from '@/lib/actions/result';
import { safeNextPath } from '@/lib/auth/safe-next';
import { getViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validation/schemas';

export async function signInAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return failure('Email or password is incorrect.');
  }

  const viewer = await getViewer();

  if (!viewer) {
    return failure('Sign-in did not complete. Please try again.');
  }

  if (!viewer.isSuperAdmin) {
    if (!viewer.institution) {
      await supabase.auth.signOut();
      return failure('Your account is not linked to a school yet.');
    }

    if (viewer.institution.status === 'suspended') {
      await supabase.auth.signOut();
      return failure('This school is suspended. Contact the platform administrator.');
    }
  }

  const next = safeNextPath(formData.get('next'), '');
  redirect(next || (viewer.isSuperAdmin ? '/admin' : '/dashboard'));
}
