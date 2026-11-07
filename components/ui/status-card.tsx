import type { ReactNode } from 'react';

import { GlassCard } from '@/components/ui/glass-card';

type Tone = 'accent' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-[rgba(47,107,255,0.16)] text-[var(--accent-soft)] ring-[rgba(156,192,255,0.35)]',
  warning: 'bg-[rgba(255,198,107,0.14)] text-[var(--warning)] ring-[rgba(255,198,107,0.35)]',
  danger: 'bg-[rgba(255,122,122,0.14)] text-[var(--danger)] ring-[rgba(255,122,122,0.35)]',
};

export function StatusCard({
  code,
  title,
  icon,
  tone = 'accent',
  children,
  actions,
}: {
  code?: string;
  title: string;
  icon: ReactNode;
  tone?: Tone;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <GlassCard className="relative w-full max-w-md p-8 text-center sm:p-10">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone]}`} aria-hidden="true">
        {icon}
      </div>
      {code && (
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">{code}</p>
      )}
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>
    </GlassCard>
  );
}

export const statusIconProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
