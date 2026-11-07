import type { Metadata } from 'next';
import Link from 'next/link';

import { ScenePoster } from '@/components/3d/scene-poster';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <GlassCard className="relative w-full max-w-md p-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Error 404</p>
        <h1 className="mt-3 text-4xl font-bold">Lost in the grid</h1>
        <p className="mt-4 text-[var(--muted)]">
          This page does not exist, or it may have moved. Head back to your dashboard.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-8">
          Return to dashboard
        </Link>
      </GlassCard>
    </main>
  );
}
