import type { Metadata } from 'next';

import { signOutAction } from '@/app/actions/auth';
import { ScenePoster } from '@/components/3d/scene-poster';
import { SubmitButton } from '@/components/ui/submit-button';
import { statusIconProps, StatusCard } from '@/components/ui/status-card';

export const metadata: Metadata = {
  title: 'School suspended',
  description: 'This school is currently suspended.',
};

export default function SuspendedPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <StatusCard
        title="This school is suspended"
        tone="danger"
        icon={
          <svg {...statusIconProps} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M10 9v6M14 9v6" />
          </svg>
        }
        actions={
          <form action={signOutAction}>
            <SubmitButton variant="ghost" pendingLabel="Signing out…">Sign out</SubmitButton>
          </form>
        }
      >
        Access is paused while the account is under review. Contact the platform administrator for help.
      </StatusCard>
    </main>
  );
}
