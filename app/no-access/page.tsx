import type { Metadata } from 'next';
import Link from 'next/link';

import { ScenePoster } from '@/components/3d/scene-poster';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'No school linked',
  description: 'Your account is not yet linked to a school.',
};

export default function NoAccessPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <GlassCard className="relative w-full max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">No school linked yet</h1>
        <p className="mt-4 text-[var(--muted)]">
          Your account is not connected to a school. Ask your school owner or the platform administrator to send you an invitation.
        </p>
        <Link href="/login" className="btn btn-ghost mt-8">Back to sign in</Link>
      </GlassCard>
    </main>
  );
}
