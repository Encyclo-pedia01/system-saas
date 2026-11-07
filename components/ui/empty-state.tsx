import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {children && <p className="max-w-sm text-sm text-[var(--muted)]">{children}</p>}
    </div>
  );
}
