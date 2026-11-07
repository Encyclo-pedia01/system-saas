import type { Metadata } from 'next';
import Link from 'next/link';

import { ScenePoster } from '@/components/3d/scene-poster';
import { statusIconProps, StatusCard } from '@/components/ui/status-card';

export const metadata: Metadata = {
  title: 'No school linked',
  description: 'Your account is not yet linked to a school.',
};

export default function NoAccessPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <StatusCard
        title="No school linked yet"
        tone="warning"
        icon={
          <svg {...statusIconProps} aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        }
        actions={<Link href="/login" className="btn btn-ghost">Back to sign in</Link>}
      >
        Your account is not connected to a school yet. Ask your school owner or the platform administrator to send you an invitation.
      </StatusCard>
    </main>
  );
}
