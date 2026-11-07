import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a link to reset your school account password.',
};

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Account recovery</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Reset your password</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Enter the email you use for your school account. We will send a link to choose a new password.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-[var(--accent-soft)] underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </GlassCard>
    </main>
  );
}
