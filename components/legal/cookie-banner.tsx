'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

const CONSENT_COOKIE = 'cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readConsent(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const noopSubscribe = () => () => {};

export function CookieBanner() {
  const [dismissed, setDismissed] = useState(false);
  const needsChoice = useSyncExternalStore(noopSubscribe, () => readConsent() === null, () => false);
  const visible = needsChoice && !dismissed;

  function saveChoice(choice: 'accepted' | 'essential') {
    document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="Cookie consent"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="glass fixed bottom-16 left-4 right-4 z-50 mx-auto max-w-md p-5 sm:bottom-14 sm:left-6 sm:right-auto sm:mx-0"
        >
          <p className="text-sm text-[var(--muted)]">
            We use essential cookies to keep you signed in. Read our{' '}
            <Link href="/privacy" className="text-[var(--accent-soft)] underline">privacy notice</Link>.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary flex-1" onClick={() => saveChoice('accepted')}>
              Accept
            </button>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => saveChoice('essential')}>
              Essential only
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
