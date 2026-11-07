import type { Metadata } from 'next';

import { ScenePoster } from '@/components/3d/scene-poster';
import { SubmitButton } from '@/components/ui/submit-button';
import { GlassCard } from '@/components/ui/glass-card';
import { signOutAction } from '@/app/actions/auth';

export const metadata: Metadata = {
  title: 'School suspended',
  description: 'This school is currently suspended.',
};

export default function SuspendedPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <GlassCard className="relative w-full max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">This school is suspended</h1>
        <p className="mt-4 text-[var(--muted)]">
          Access is paused while the account is under review. Contact the platform administrator for help.
        </p>
        <form action={signOutAction} className="mt-8">
          <SubmitButton variant="ghost" pendingLabel="Signing out…">Sign out</SubmitButton>
        </form>
      </GlassCard>
    </main>
  );
}
