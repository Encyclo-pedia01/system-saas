import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/report-cards/print-button';
import { ReportCardSection, reportCardCss, type ReportCardData } from '@/components/report-cards/report-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Report cards',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ termId?: string | string[]; classId?: string | string[]; studentId?: string | string[] }>;

const uuidPattern = /^[0-9a-f-]{36}$/i;

function firstValue(value: string | string[] | undefined): string {
  const v = (Array.isArray(value) ? value[0] : value) ?? '';
  return uuidPattern.test(v) ? v : '';
}

export default async function PrintReportCardsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'school_admin']);
  const params = await searchParams;
  const termId = firstValue(params.termId);
  const classId = firstValue(params.classId);
  const studentId = firstValue(params.studentId);
  if (!termId || (!classId && !studentId)) notFound();

  const institutionId = viewer.institution!.id;
  const supabase = await createClient();

  const studentsQuery = supabase.from('students').select('id, full_name, admission_number, class_id').eq('institution_id', institutionId);
  const { data: students } = await (studentId ? studentsQuery.eq('id', studentId) : studentsQuery.eq('class_id', classId).order('full_name'));
  if (!students || students.length === 0) notFound();

  const ids = students.map((s) => s.id);
  const classForMissing = classId || students[0].class_id;
  const [finalsResult, missingResult] = await Promise.all([
    supabase.from('report_finals').select('student_id, snapshot').eq('institution_id', institutionId).eq('term_id', termId).in('student_id', ids),
    supabase.rpc('report_missing_grades', { p_class_id: classForMissing, p_term_id: termId }),
  ]);
  const finals = new Map((finalsResult.data ?? []).map((row) => [row.student_id, row.snapshot as ReportCardData]));
  const missing = new Set(((missingResult.data ?? []) as Array<{ student_id: string }>).map((row) => row.student_id));

  const cards: Array<{ key: string; card: ReportCardData | null; name: string; blocked: boolean }> = [];
  for (const student of students) {
    const final = finals.get(student.id);
    if (final) {
      cards.push({ key: student.id, card: final, name: student.full_name, blocked: false });
      continue;
    }
    if (missing.has(student.id)) {
      cards.push({ key: student.id, card: null, name: student.full_name, blocked: true });
      continue;
    }
    const { data, error } = await supabase.rpc('report_card_snapshot', { p_term_id: termId, p_student_id: student.id });
    if (error || !data) {
      cards.push({ key: student.id, card: null, name: student.full_name, blocked: true });
      continue;
    }
    cards.push({ key: student.id, card: data as ReportCardData, name: student.full_name, blocked: false });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <style>{reportCardCss}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}. Use Print or save as PDF. Final cards print from their saved copy.
        </p>
        <PrintButton />
      </div>

      <div className="print-area">
        {cards.map(({ key, card, name, blocked }) => (
          <ReportCardSection key={key} card={card} name={name} blocked={blocked} />
        ))}
      </div>
    </main>
  );
}
