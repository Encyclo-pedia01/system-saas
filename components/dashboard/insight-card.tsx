'use client';

import { motion } from 'framer-motion';
import { useActionState } from 'react';

import { resolveInsightAction } from '@/app/(app)/dashboard/actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type InsightView = {
  id: string;
  kind: 'consecutive_absence' | 'missing_result';
  severity: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  created_at: string;
};

const severityStyles: Record<InsightView['severity'], { badge: string; accent: string; label: string }> = {
  high: { badge: 'tone-danger', accent: 'from-[var(--danger)]', label: 'High' },
  medium: { badge: 'tone-warning', accent: 'from-[var(--warning)]', label: 'Medium' },
  low: { badge: 'tone-success', accent: 'from-[var(--success)]', label: 'Low' },
};

export function InsightCard({ insight, canResolve }: { insight: InsightView; canResolve: boolean }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(resolveInsightAction, null);
  useActionToast(state);

  const style = severityStyles[insight.severity];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="depth-card relative overflow-hidden p-5"
    >
      <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${style.accent} to-transparent`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <span className={`badge ${style.badge}`}>{style.label} severity</span>
          <h3 className="mt-3 text-base font-semibold">{insight.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{insight.body}</p>
        </div>
      </div>

      {canResolve && (
        <form action={formAction} className="mt-4 pl-2">
          <input type="hidden" name="insightId" value={insight.id} />
          <SubmitButton variant="ghost" pendingLabel="Resolving…">Mark resolved</SubmitButton>
        </form>
      )}
    </motion.article>
  );
}
