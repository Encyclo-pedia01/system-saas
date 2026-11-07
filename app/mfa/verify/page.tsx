import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInCodeForm } from '@/components/auth/mfa-forms';
import { GlassCard } from '@/components/ui/glass-card';
import { requireViewer } from '@/lib/auth/viewer';

export const metadata: Metadata = {
  title: 'Enter your sign-in code',
  description: 'Confirm your owner sign-in with an authenticator code.',
};

export default async function MfaVerifyPage() {
  const viewer = await requireViewer();

  if (viewer.role !== 'owner' || viewer.isSuperAdmin) redirect('/dashboard');
  if (viewer.assuranceLevel === 'aal2') redirect('/dashboard');
  if (!viewer.mfaEnrolled) redirect('/mfa/setup');

  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Owner security</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Enter your sign-in code</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Open your authenticator app and type the 6-digit code for Campus Veritas.
        </p>
        <SignInCodeForm />
      </GlassCard>
    </main>
  );
}
