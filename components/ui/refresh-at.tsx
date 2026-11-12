'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Reloads the server data for this page once the given time passes, so an expired
// invitation leaves the list without a manual refresh. Does nothing when no time is given.
export function RefreshAt({ at }: { at: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!at) return;
    const delay = new Date(at).getTime() - Date.now();
    const timer = window.setTimeout(() => router.refresh(), Math.max(delay, 0) + 1000);
    return () => window.clearTimeout(timer);
  }, [at, router]);

  return null;
}
