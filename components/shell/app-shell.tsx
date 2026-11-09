'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icons';
import { SubmitButton } from '@/components/ui/submit-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export type NavItem = { href: string; label: string; icon: IconName; primary?: boolean };


type ImpersonationBanner = {
  schoolName: string;
  expiresAt: string;
  stopAction: () => Promise<void>;
};

type AppShellProps = {
  navItems: NavItem[];
  userName: string;
  roleLabel: string;
  schoolName: string | null;
  impersonation: ImpersonationBanner | null;
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({
  navItems,
  userName,
  roleLabel,
  schoolName,
  impersonation,
  signOutAction,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const signOutDialogRef = useRef<HTMLDialogElement>(null);

  // Escape closes the drawer, Tab cycles inside it, and focus returns to the Menu button on close.
  useEffect(() => {
    if (!drawerOpen) return;

    const focusableItems = () =>
      drawerRef.current ? Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];

    const returnFocus = returnFocusRef.current;
    focusableItems()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableItems();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocus?.focus();
    };
  }, [drawerOpen]);

  // Only the most specific matching item is active, so /admin/users does not also light up /admin.
  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Phone bottom bar: the screens each role uses most (marked primary in the layout). Everything else sits under More.
  const primaryItems = navItems.filter((item) => item.primary);
  const secondaryItems = navItems.filter((item) => !item.primary);
  // Platform admins have no main screens, so they keep the Menu button.
  const useBottomBar = primaryItems.length >= 2;

  const renderNavigation = (items: NavItem[], label = 'Main') => (
    <nav className="flex flex-col gap-1" aria-label={label}>
      {items.map((item) => {
        const active = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={() => setDrawerOpen(false)}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm'
                : 'text-[var(--muted)] hover:translate-x-0.5 hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Icon name={item.icon} filled={active} className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const identityCard = (
    <div className="depth-card mt-auto p-4">
      <p className="truncate text-sm font-semibold">{userName || 'Signed in'}</p>
      <p className="truncate text-xs text-[var(--muted)]">
        {roleLabel}
        {schoolName ? ` · ${schoolName}` : ''}
      </p>
      <div className="mt-3">
        <ThemeToggle />
      </div>
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => signOutDialogRef.current?.showModal()}>
        Sign out
      </button>
    </div>
  );

  return (
    <>
    <div className="flex min-h-0 flex-1">
      <aside className="depth-card sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] w-56 shrink-0 flex-col gap-5 p-4 md:flex xl:top-4 xl:m-4 xl:h-[calc(100vh-2rem)] xl:w-64 xl:gap-6 xl:p-5">
        <div>
          <p className="eyebrow">Campus Veritas</p>
          <p className="mt-1 truncate text-lg font-bold">{schoolName ?? 'Platform'}</p>
        </div>
        {renderNavigation(navItems)}
        {identityCard}
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem_+_env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border)] bg-[var(--header-bg)] px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-[var(--on-accent)]">
            {(schoolName ?? 'P').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.65rem] font-medium text-[var(--muted)]">{schoolName ?? 'Platform'}</p>
            <p className="truncate text-sm font-bold tracking-tight">{navItems.find((item) => item.href === activeHref)?.label ?? 'Menu'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => { returnFocusRef.current = event.currentTarget; setDrawerOpen(true); }}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          aria-controls="mobile-navigation-drawer"
          aria-label="Open navigation menu"
          className="btn btn-ghost min-h-10 gap-2 px-3 text-xs"
        >
          <Icon name="more" className="size-4" />
          Menu
        </button>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-[var(--overlay)] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              ref={drawerRef}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto overscroll-contain rounded-none border-r border-[var(--border)] bg-[var(--surface)] px-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <p className="truncate text-lg font-bold">{schoolName ?? 'Platform'}</p>
                <button type="button" className="btn btn-ghost min-h-11 px-3" onClick={() => setDrawerOpen(false)}>
                  Close
                </button>
              </div>
              {useBottomBar ? (
                <>
                  <p className="eyebrow">More</p>
                  {secondaryItems.length > 0 ? renderNavigation(secondaryItems, 'More screens') : <p className="text-sm text-[var(--muted)]">No additional screens for this account.</p>}
                </>
              ) : navItems.length > 0 ? renderNavigation(navItems) : <p className="text-sm text-[var(--muted)]">No navigation screens are available for this account. Account actions are below.</p>}
              {identityCard}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {useBottomBar && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--border)] bg-[var(--header-bg)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}
        >
          {primaryItems.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] font-semibold ${
                  active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                }`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? 'bg-[var(--tone-accent-bg)]' : ''}`}>
                  <Icon name={item.icon} filled={active} className="size-6" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={(event) => { returnFocusRef.current = event.currentTarget; setDrawerOpen(true); }}
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-navigation-drawer"
            aria-label="Open More menu"
            className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] font-semibold text-[var(--muted)]"
          >
            <span className="grid h-7 w-12 place-items-center rounded-full">
              <Icon name="more" className="size-6" />
            </span>
            <span className="truncate">More</span>
          </button>
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonation && (
          <div className="notice mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm md:mt-4">
            <p>
              <strong className="text-[var(--warning)]">Viewing as {impersonation.schoolName} (read-only).</strong>{' '}
              <span className="text-[var(--muted)]">
                Session ends at {new Date(impersonation.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
              </span>
            </p>
            <form action={impersonation.stopAction}>
              <SubmitButton variant="ghost" pendingLabel="Ending…">Stop viewing</SubmitButton>
            </form>
          </div>
        )}

        <motion.main
          className={`flex min-w-0 flex-1 flex-col px-4 pt-[calc(5rem_+_env(safe-area-inset-top))] md:px-6 md:pt-8 xl:px-8 ${useBottomBar ? "pb-[calc(7rem_+_env(safe-area-inset-bottom))] md:pb-16" : "pb-16"}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.main>
      </div>
    </div>
    <dialog ref={signOutDialogRef} aria-labelledby="sign-out-title" className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[var(--overlay)]">
      <div className="space-y-4 p-6">
        <h2 id="sign-out-title" className="text-lg font-bold">Sign out of this session?</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">You will be signed out on this device. Any unsaved work may be lost.</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={() => signOutDialogRef.current?.close()}>Stay signed in</button>
          <form action={signOutAction}>
            <SubmitButton variant="danger" pendingLabel="Signing out…">Sign out of session</SubmitButton>
          </form>
        </div>
      </div>
    </dialog>
    </>
  );
}
