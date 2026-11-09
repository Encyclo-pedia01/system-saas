import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Campus Veritas.',
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  return (
    <main className="flex flex-1 items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold text-[var(--muted)]">Campus Veritas</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Sign in</h1>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <LoginForm next={nextValue} />
        </div>

        <p className="mt-4 text-sm">
          <Link href="/forgot-password" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </main>
  );
}
