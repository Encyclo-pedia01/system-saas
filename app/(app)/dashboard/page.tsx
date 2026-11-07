import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InsightCard, type InsightView } from '@/components/dashboard/insight-card';
import { GlassCard } from '@/components/ui/glass-card';
import { requireSchoolViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

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
    redirect('/check-in');
  }

  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canResolve = viewer.effectiveRole === 'owner' && !viewer.readOnly;

  const { data: localDate } = await supabase.rpc('institution_local_date', { p_institution_id: institutionId });
  const today = String(localDate ?? '');

  const [insightsResult, studentCount, resultCount, checkInsToday] = await Promise.all([
    supabase
      .from('insights')
      .select('id, kind, severity, title, body, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('results').select('id', { count: 'exact', head: true }),
    viewer.effectiveRole === 'owner'
      ? supabase.from('check_ins').select('status').eq('school_date', today)
      : Promise.resolve({ data: [] as Array<{ status: string }> }),
  ]);

  const insights = (insightsResult.data ?? []) as InsightView[];
  const checkIns = checkInsToday.data ?? [];
  const late = checkIns.filter((row) => row.status === 'late').length;
  const absent = checkIns.filter((row) => row.status === 'absent').length;
  const onTime = checkIns.filter((row) => row.status === 'on-time').length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Overview</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {viewer.institution?.name} · {today}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <StatCard label="Students" value={studentCount.count ?? 0} hint="Enrolled across all classes" />
        <StatCard label="Results" value={resultCount.count ?? 0} hint="Final grades on record" />
        <StatCard label="On time today" value={onTime} hint={viewer.effectiveRole === 'owner' ? `${late} late · ${absent} absent` : 'Owner view only'} />
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
