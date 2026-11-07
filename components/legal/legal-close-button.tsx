'use client';

import { useRouter } from 'next/navigation';

export function LegalCloseButton() {
  const router = useRouter();

  function close() {
    const sameSiteReferrer = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (sameSiteReferrer && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close and return"
      className="btn btn-ghost absolute right-4 top-4 min-h-9 px-3 text-sm"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
      Close
    </button>
  );
}
