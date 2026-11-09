import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { InsightCard, type InsightView } from '@/components/dashboard/insight-card';
import { TeacherHome } from '@/components/dashboard/teacher-home';
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="depth-card p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const viewer = await requireSchoolViewer();

  if (viewer.effectiveRole === 'staff') {
    const supabase = await createClient();
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Your classes" title="Home" description={<>{viewer.institution?.name}</>} />
        <TeacherHome supabase={supabase} institutionId={viewer.institution!.id} userId={viewer.userId} />
      </div>
    );
  }

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

  const setupItems = viewer.effectiveRole === 'owner' ? await getSetupItems(supabase, institutionId) : null;

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

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  const insights = ((insightsResult.data ?? []) as InsightView[]).sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const guideHidden = (await cookies()).get('setup_guide')?.value === 'hidden';

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" description={<>{viewer.institution?.name} · {today}</>} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {subscription && <SubscriptionNotice state={subscription.state} endsOn={subscription.endsOn} today={today} />}
        {setupItems && <SetupChecklist items={setupItems} hidden={guideHidden} />}

        <section className="grid grid-cols-3 gap-3" aria-label="Summary">
          <StatCard label="Students" value={studentCount.count ?? 0} />
          <StatCard label="Results" value={resultCount.count ?? 0} />
          <StatCard label="Open alerts" value={insights.length} />
        </section>

        <section aria-labelledby="feed-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div><h2 id="feed-heading" className="text-lg font-semibold">Priority feed</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Highest-severity alerts first · updates generated automatically</p></div>
            <span className="badge bg-[var(--highlight)] text-[var(--highlight-text)]">{insights.length} open</span>
          </div>

          {insights.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="font-semibold">You are all caught up</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Alerts for consecutive absences and missing results will appear here.</p>
            </GlassCard>
          ) : (
            insights.map((insight) => <InsightCard key={insight.id} insight={insight} canResolve={canResolve} />)
          )}
        </section>
      </div>
    </div>
  );
}
