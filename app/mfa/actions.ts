'use server';

import { redirect } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/result';
import { failure } from '@/lib/actions/result';
import { createClient } from '@/lib/supabase/server';

const codePattern = /^\d{6}$/;

async function verifiedTotpFactorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp?.find((factor) => factor.status === 'verified');
  return verified?.id ?? null;
}

// Confirms the first authenticator code, which turns the new factor on.
export async function confirmAuthenticatorAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const factorId = String(formData.get('factorId') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\s+/g, '');

  if (!/^[0-9a-f-]{36}$/i.test(factorId)) return failure('Start the set-up again.');
  if (!codePattern.test(code)) return failure('Enter the 6-digit code from your app.');

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) return failure('That code is not correct or has expired. Wait for a new code and try again.');

  redirect('/dashboard');
}

// Confirms a code at sign-in for an owner who already has an authenticator app.
export async function verifySignInCodeAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const code = String(formData.get('code') ?? '').replace(/\s+/g, '');
  if (!codePattern.test(code)) return failure('Enter the 6-digit code from your app.');

  const factorId = await verifiedTotpFactorId();
  if (!factorId) redirect('/mfa/setup');

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) return failure('That code is not correct. Check your app and try again.');

  redirect('/dashboard');
}
