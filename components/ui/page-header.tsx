import { BackButton } from '@/components/ui/back-button';
import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backHref,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
      <div className="max-w-3xl">
        {backHref && <div className="mb-3"><BackButton fallback={backHref} /></div>}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <div className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</div>}
      </div>
      {action}
    </header>
  );
}
