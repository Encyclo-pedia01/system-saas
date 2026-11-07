import type { Metadata } from 'next';
import Link from 'next/link';

import { ScenePoster } from '@/components/3d/scene-poster';
import { statusIconProps, StatusCard } from '@/components/ui/status-card';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <ScenePoster />
      <StatusCard
        code="Error 404"
        title="We could not find that page"
        icon={
          <svg {...statusIconProps} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
          </svg>
        }
        actions={
          <>
            <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
          </>
        }
      >
        The link may be broken, or the page may have moved. Check the address, or head back to your dashboard.
      </StatusCard>
    </main>
  );
}
