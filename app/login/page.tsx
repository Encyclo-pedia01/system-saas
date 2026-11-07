import type { Metadata } from 'next';
import Link from 'next/link';

import { AmbientScene } from '@/components/3d/scene-loader';
import { LoginForm } from '@/components/auth/login-form';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your school workspace.',
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <AmbientScene />

      <GlassCard className="relative w-full max-w-md p-8 sm:p-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-soft)]">Campus Veritas</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in to manage attendance, grades, and insights.</p>
        </div>

        <LoginForm next={nextValue} />

        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="text-[var(--accent-soft)] underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </GlassCard>
    </main>
  );
}
