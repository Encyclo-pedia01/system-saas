import type { Metadata } from 'next';

import { SetPasswordForm } from '@/components/auth/set-password-form';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Set your password',
  description: 'Finish setting up your school account.',
};

type Props = { searchParams: Promise<{ next?: string | string[]; forced?: string | string[] }> };

export default async function SetPasswordPage({ searchParams }: Props) {
  const { next, forced } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  const isForced = (Array.isArray(forced) ? forced[0] : forced) === '1';
  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">{isForced ? 'Password reset' : 'Account setup'}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Set your password</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {isForced
            ? 'An administrator gave you a temporary password. Choose your own password to continue. Use at least 10 characters.'
            : 'Choose a password to finish activating your account. Use at least 10 characters.'}
        </p>
        <SetPasswordForm next={nextValue} />
      </GlassCard>
    </main>
  );
}
