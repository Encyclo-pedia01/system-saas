import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] px-6 py-4 text-xs text-[var(--muted)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>© Encyclopedia IT consult</span>
        <nav className="flex gap-4" aria-label="Legal">
          <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
