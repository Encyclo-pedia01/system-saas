import type { Metadata } from 'next';

import { InsightCard, type InsightView } from '@/components/dashboard/insight-card';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { SubscriptionNotice } from '@/components/dashboard/subscription-notice';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireSchoolViewer } from '@/lib/auth/viewer';
import { getSetupItems } from '@/lib/dashboard/setup-status';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
export async function generateMetadata(): Promise<Metadata> {
  const viewer = await requireSchoolViewer();

  return {
    title: viewer.institution ? `${viewer.institution.name} dashboard` : 'Dashboard',
    description: 'Attendance, grading status, and automatic insight alerts for your school.',
  };
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="depth-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const viewer = await requireSchoolViewer();

  if (viewer.effectiveRole === 'authority') {
    return (
      <EmptyState title="Check-in is paused">
        Check-in is not available right now. Your school owner will let you know when it returns.
      </EmptyState>
    );
  }

  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canResolve = (viewer.effectiveRole === 'owner' || viewer.effectiveRole === 'school_admin') && !viewer.readOnly;

  const { data: localDate } = await supabase.rpc('institution_local_date', { p_institution_id: institutionId });
  const today = String(localDate ?? '');

  const [insightsResult, studentCount, resultCount] = await Promise.all([
    supabase
      .from('insights')
      .select('id, kind, severity, title, body, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('results').select('id', { count: 'exact', head: true }),
  ]);

  const setupItems = viewer.effectiveRole === 'owner' ? await getSetupItems(supabase, institutionId, viewer.mfaEnrolled) : null;

  const subscription =
    viewer.effectiveRole === 'owner'
      ? await Promise.all([
          supabase.from('institutions').select('subscription_ends_on').eq('id', institutionId).maybeSingle(),
          supabase.rpc('institution_access_state', { p_institution_id: institutionId }),
        ]).then(([institution, access]) => ({
          endsOn: institution.data?.subscription_ends_on ?? null,
          state: (access.data as string | null) ?? null,
        }))
      : null;

  const insights = (insightsResult.data ?? []) as InsightView[];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" description={<>{viewer.institution?.name} · {today}</>} />

      {subscription && <SubscriptionNotice state={subscription.state} endsOn={subscription.endsOn} today={today} />}
      {setupItems && <SetupChecklist items={setupItems} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <StatCard label="Students" value={studentCount.count ?? 0} hint="Enrolled across all classes" />
        <StatCard label="Results" value={resultCount.count ?? 0} hint="Final grades on record" />
        <StatCard label="Open insights" value={insights.length} hint="Alerts that need attention" />
      </section>

      <section aria-labelledby="insights-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="insights-heading" className="text-lg font-semibold">Insights</h2>
          <span className="text-xs text-[var(--muted)]">Generated automatically</span>
        </div>

        {insights.length === 0 ? (
          <GlassCard className="p-8 text-center text-sm text-[var(--muted)]">
            No open insights. Alerts for consecutive absences and missing results will appear here.
          </GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} canResolve={canResolve} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
