'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';

export type NavItem = { href: string; label: string; icon: ReactNode };

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

  const navigation = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={() => setDrawerOpen(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              active
                ? 'bg-[var(--accent)] text-white shadow-[0_10px_24px_-12px_rgba(47,107,255,0.9)]'
                : 'text-[var(--muted)] hover:translate-x-0.5 hover:bg-white/5 hover:text-[var(--text)]'
            }`}
          >
            <span className="grid size-5 place-items-center" aria-hidden="true">{item.icon}</span>
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
      <form action={signOutAction} className="mt-3">
        <SubmitButton variant="ghost" pendingLabel="Signing out…" className="w-full">
          Sign out
        </SubmitButton>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="depth-card sticky top-4 m-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col gap-6 p-5 md:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-soft)]">Campus Veritas</p>
          <p className="mt-1 truncate text-lg font-bold">{schoolName ?? 'Platform'}</p>
        </div>
        {navigation}
        {identityCard}
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[rgba(7,11,31,0.8)] px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn btn-ghost min-h-10 px-3"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
        >
          Menu
        </button>
        <p className="truncate pl-3 text-sm font-semibold">{schoolName ?? 'Platform'}</p>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
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
              className="glass fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 rounded-none p-5 md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <p className="truncate text-lg font-bold">{schoolName ?? 'Platform'}</p>
                <button type="button" className="btn btn-ghost min-h-9 px-3" onClick={() => setDrawerOpen(false)}>
                  Close
                </button>
              </div>
              {navigation}
              {identityCard}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonation && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(255,198,107,0.45)] bg-[rgba(255,198,107,0.12)] px-4 py-3 text-sm md:mt-4">
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
          className="flex min-w-0 flex-1 flex-col px-4 pb-16 pt-20 md:px-8 md:pt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
