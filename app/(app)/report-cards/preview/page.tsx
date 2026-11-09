import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReportCardSection, reportCardCss, type ReportCardData } from '@/components/report-cards/report-card';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Preview report cards',
  description: 'Read-only preview of each student’s report card.',
};

type SearchParams = Promise<{ termId?: string | string[]; classId?: string | string[] }>;

const uuidPattern = /^[0-9a-f-]{36}$/i;

function firstValue(value: string | string[] | undefined): string {
  const v = (Array.isArray(value) ? value[0] : value) ?? '';
  return uuidPattern.test(v) ? v : '';
}

// Read-only preview of the report cards for one class. The owner sees every class. Staff see
// only classes they teach, unless they are the headmaster. Anything else is "not found".
export default async function ReportCardPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'staff']);
  const institutionId = viewer.institution!.id;
  const isOwner = viewer.effectiveRole === 'owner';
  const supabase = await createClient();

  const [termsResult, classesResult, membershipResult, myClassesResult] = await Promise.all([
    supabase.from('terms').select('id, name, starts_on').eq('institution_id', institutionId).order('starts_on'),
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('memberships').select('is_headmaster').eq('institution_id', institutionId).eq('user_id', viewer.userId).maybeSingle(),
    supabase.from('class_teachers').select('class_id').eq('institution_id', institutionId).eq('user_id', viewer.userId),
  ]);

  const terms = termsResult.data ?? [];
  const isHeadmaster = isOwner || Boolean(membershipResult.data?.is_headmaster);
  const myClassIds = new Set((myClassesResult.data ?? []).map((row) => row.class_id));
  const classes = (classesResult.data ?? []).filter((c) => isHeadmaster || myClassIds.has(c.id));

  const params = await searchParams;
  const requestedClass = firstValue(params.classId);
  const requestedTerm = firstValue(params.termId);
  if (requestedClass && !classes.some((c) => c.id === requestedClass)) notFound();

  const term = terms.find((t) => t.id === requestedTerm) ?? terms[terms.length - 1];
  const schoolClass = classes.find((c) => c.id === requestedClass) ?? classes[0];

  if (!term || !schoolClass) {
    return (
      <div className="space-y-8">
        <PageHeader backHref="/report-cards" eyebrow="Records" title="Preview report cards" description="Read-only. Shows each student’s card as it will print." />
        <EmptyState title={!term ? 'No terms yet' : 'No classes to preview'}>
          {!term ? 'Ask the school owner to add a term first.' : 'You are not assigned to a class yet.'}
        </EmptyState>
      </div>
    );
  }

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, admission_number')
    .eq('institution_id', institutionId)
    .eq('class_id', schoolClass.id)
    .order('full_name');
  const list = students ?? [];
  const ids = list.map((s) => s.id);

  const [finalsResult, missingResult] = await Promise.all([
    ids.length
      ? supabase.from('report_finals').select('student_id, snapshot').eq('institution_id', institutionId).eq('term_id', term.id).in('student_id', ids)
      : Promise.resolve({ data: [] as Array<{ student_id: string; snapshot: unknown }> }),
    supabase.rpc('report_missing_grades', { p_class_id: schoolClass.id, p_term_id: term.id }),
  ]);
  const finals = new Map((finalsResult.data ?? []).map((row) => [row.student_id, row.snapshot as ReportCardData]));
  const missing = new Set(((missingResult.data ?? []) as Array<{ student_id: string }>).map((row) => row.student_id));

  const cards: Array<{ key: string; card: ReportCardData | null; name: string; blocked: boolean; draft: boolean }> = [];
  for (const student of list) {
    const final = finals.get(student.id);
    if (final) {
      cards.push({ key: student.id, card: final, name: student.full_name, blocked: false, draft: false });
      continue;
    }
    if (missing.has(student.id)) {
      cards.push({ key: student.id, card: null, name: student.full_name, blocked: true, draft: true });
      continue;
    }
    const { data, error } = await supabase.rpc('report_card_snapshot', { p_term_id: term.id, p_student_id: student.id });
    if (error || !data) {
      cards.push({ key: student.id, card: null, name: student.full_name, blocked: true, draft: true });
      continue;
    }
    cards.push({ key: student.id, card: data as ReportCardData, name: student.full_name, blocked: false, draft: true });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/report-cards"
        eyebrow="Records"
        title="Preview report cards"
        description="Read-only. Each card shows what will print. Draft cards can still change until the owner marks them final."
      />

      <GlassCard className="p-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Class</span>
            <select name="classId" defaultValue={schoolClass.id} className="field-input w-full">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Term</span>
            <select name="termId" defaultValue={term.id} className="field-input w-full">
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary min-h-11 px-6">Show cards</button>
        </form>
      </GlassCard>

      {cards.length === 0 ? (
        <EmptyState title="No students in this class">Students added to the class will appear here.</EmptyState>
      ) : (
        <div className="space-y-6">
          <style>{reportCardCss}</style>
          {cards.map(({ key, card, name, blocked, draft }) => (
            <ReportCardSection key={key} card={card} name={name} blocked={blocked} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}
