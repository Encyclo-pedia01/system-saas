'use client';

import { useEffect, useRef } from 'react';

// Signs the user out after 30 minutes with no mouse, keyboard, touch or scroll activity.
export const IDLE_LOGOUT_MS = 30 * 60 * 1000;
const CHECK_EVERY_MS = 15 * 1000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

export function IdleLogout({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastActivity = useRef<number | null>(null);
  const signingOut = useRef(false);

  useEffect(() => {
    lastActivity.current = Date.now();

    const markActive = () => {
      lastActivity.current = Date.now();
    };

    const checkIdle = () => {
      if (signingOut.current || lastActivity.current === null) return;
      if (Date.now() - lastActivity.current >= IDLE_LOGOUT_MS) {
        signingOut.current = true;
        formRef.current?.requestSubmit();
      }
    };

    // Background tabs throttle timers, so also check as soon as the tab is shown again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkIdle, CHECK_EVERY_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <form ref={formRef} action={signOutAction} hidden aria-hidden="true">
      <button type="submit" tabIndex={-1}>Sign out</button>
    </form>
  );
}
