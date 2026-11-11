'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icons';
import { SubmitButton } from '@/components/ui/submit-button';
import { SiteFooter } from '@/components/legal/site-footer';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the drawer, Tab cycles inside it, and focus returns to the Menu button on close.
  useEffect(() => {
    if (!drawerOpen) return;

    const focusableItems = () =>
      drawerRef.current ? Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];

    const menuButton = menuButtonRef.current;
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
      menuButton?.focus();
    };
  }, [drawerOpen]);

  // Only the most specific matching item is active, so /admin/users does not also light up /admin.
  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials =
    (userName || 'User')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || 'U';

  // Phone bottom bar: the screens each role uses most (marked primary in the layout). Everything else sits under More.
  const primaryItems = navItems.filter((item) => item.primary);
  // Platform admins have no main screens, so they keep the Menu button.
  const useBottomBar = primaryItems.length >= 2;

  const navigation = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {navItems.map((item) => {
        const active = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={() => setDrawerOpen(false)}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_6px_16px_-8px_rgba(30,91,184,0.6)]'
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
      <form action={signOutAction} className="mt-3">
        <SubmitButton variant="ghost" pendingLabel="Signing out…" className="w-full">
          Sign out
        </SubmitButton>
      </form>
    </div>
  );

  return (
    <div className="app-shell flex min-h-0 flex-1">
      <aside className="depth-card sticky top-4 m-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col gap-6 overflow-y-auto p-5 md:flex">
        <div>
          <p className="eyebrow">Campus Veritas</p>
          <p className="mt-1 truncate text-lg font-bold">{schoolName ?? 'Platform'}</p>
        </div>
        {navigation}
        {identityCard}
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--header-bg)] px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-[var(--on-accent)]">
            {(schoolName ?? 'P').charAt(0).toUpperCase()}
          </span>
          <p className="truncate text-base font-bold tracking-tight">{schoolName ?? 'Platform'}</p>
        </div>
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-label="Open account and navigation"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tone-accent-bg)] text-xs font-bold text-[var(--accent)]"
        >
          {initials}
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
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              ref={drawerRef}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 rounded-none border-r border-[var(--border)] bg-[var(--surface)] p-5 md:hidden"
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
              {navigation}
              {identityCard}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {useBottomBar && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--border)] bg-[var(--header-bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
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
                <span className="grid h-7 w-12 place-items-center rounded-full">
                  <Icon name={item.icon} filled={active} className="size-6" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            ref={menuButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-label="More screens"
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
          className={`flex min-w-0 flex-1 flex-col px-4 pt-20 md:px-8 md:pt-8 ${useBottomBar ? "pb-28 md:pb-16" : "pb-16"}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.main>
        <SiteFooter />
      </div>
    </div>
  );
}
