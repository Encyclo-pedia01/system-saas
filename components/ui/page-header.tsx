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
    <header className="page-header flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hairline)] pb-6">
      <div className="page-header-copy max-w-3xl">
        {backHref && <div className="mb-3"><BackButton fallback={backHref} /></div>}
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title mt-2 text-[1.85rem] font-extrabold tracking-tight leading-tight sm:text-4xl">{title}</h1>
        {description && <div className="page-description mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</div>}
      </div>
      {action}
    </header>
  );
}
