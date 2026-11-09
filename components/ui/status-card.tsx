import type { ReactNode } from 'react';

import { GlassCard } from '@/components/ui/glass-card';

type Tone = 'accent' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  accent: 'tone-accent ring-[var(--focus-ring)]',
  warning: 'tone-warning ring-[rgba(242,178,48,0.35)]',
  danger: 'tone-danger ring-[rgba(220,80,80,0.35)]',
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
        <p className="eyebrow mt-6">{code}</p>
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
