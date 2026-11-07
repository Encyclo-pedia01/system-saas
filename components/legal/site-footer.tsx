import Link from 'next/link';

import { ThemeToggle } from '@/components/ui/theme-toggle';

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] px-6 pb-44 pt-4 text-xs text-[var(--muted)] sm:pb-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>© Encyclopedia IT consult</span>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex gap-4" aria-label="Legal">
            <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
