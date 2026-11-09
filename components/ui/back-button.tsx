'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Goes back one step. If there is no history (for example, the page was opened from a link),
// it goes to `fallback` instead.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
    <Link
      href={fallback}
      className="btn btn-ghost min-h-11 px-3 text-sm"
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <span aria-hidden="true">←</span> Back
    </Link>
  );
}
