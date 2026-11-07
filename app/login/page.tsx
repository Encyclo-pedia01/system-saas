import type { Metadata } from 'next';

import { AmbientScene } from '@/components/3d/scene-loader';
import { LoginForm } from '@/components/auth/login-form';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your school workspace.',
};

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <AmbientScene />

      <GlassCard className="relative w-full max-w-md p-8 sm:p-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-soft)]">School OS</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in to manage attendance, grades, and insights.</p>
        </div>

        <LoginForm />
      </GlassCard>
    </main>
  );
}
