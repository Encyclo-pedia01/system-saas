'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="glass w-full max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-[var(--muted)]">The page could not load. Try again, or return to the dashboard.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
