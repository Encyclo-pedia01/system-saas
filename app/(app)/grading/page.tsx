import type { Metadata } from 'next';

import { ComputeGradesForm, GradingWeightsForm } from '@/components/grading/grading-forms';
import { GlassCard } from '@/components/ui/glass-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
export const metadata: Metadata = {
  title: 'Grading',
  description: 'Set grading weights and compute final grades for each term.',
};

export default async function GradingPage() {
  const viewer = await requireEffectiveRole(['owner']);
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;

  const [keysResult, termsResult, subjectsResult] = await Promise.all([
    supabase.from('grading_keys').select('weights').eq('institution_id', institutionId).maybeSingle(),
    supabase.from('terms').select('id, name').eq('institution_id', institutionId).order('starts_on', { ascending: false }),
    supabase.from('subjects').select('id, name').eq('institution_id', institutionId).order('name'),
  ]);

  const weights = (keysResult.data?.weights ?? null) as { assessment: number; exam: number } | null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Academics" title="Grading" description={<>Final grades combine continuous assessment and the final exam using the weights below. Teachers enter scores; only the owner can compute results.</>} />

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Grading weights</h2>
          <p className="mt-1 mb-6 text-sm text-[var(--muted)]">
            {weights ? 'Current weights are set for this school.' : 'No weights set yet. Save weights before computing any grades.'}
          </p>
          <GradingWeightsForm
            assessment={weights?.assessment ?? 40}
            exam={weights?.exam ?? 60}
            readOnly={viewer.readOnly}
          />
        </GlassCard>

        <GlassCard className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Compute final grades</h2>
          <p className="mt-1 mb-6 text-sm text-[var(--muted)]">
            Students need both an assessment score and an exam score. Anyone missing an exam score is skipped.
          </p>
          <ComputeGradesForm
            terms={termsResult.data ?? []}
            subjects={subjectsResult.data ?? []}
            disabled={viewer.readOnly || !weights}
          />
        </GlassCard>
      </div>
    </div>
  );
}
