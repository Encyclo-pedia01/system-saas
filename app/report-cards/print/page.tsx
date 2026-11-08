import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/report-cards/print-button';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Report cards',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ termId?: string | string[]; classId?: string | string[]; studentId?: string | string[] }>;

type Card = {
  school: string;
  term: string;
  className: string;
  studentName: string;
  admissionNumber: string;
  subjects: Array<{ subject: string; grade: number; letter: string; label: string; subjectPosition: number; subjectOutOf: number }>;
  average: number | null;
  position: number | null;
  classSize: number;
  classTeacherRemark: string | null;
  headmasterRemark: string | null;
  nextTerm: { name: string; startsOn: string } | null;
};

const uuidPattern = /^[0-9a-f-]{36}$/i;

function firstValue(value: string | string[] | undefined): string {
  const v = (Array.isArray(value) ? value[0] : value) ?? '';
  return uuidPattern.test(v) ? v : '';
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const css = `
.print-area { font-family: system-ui, sans-serif; color: #0a0f26; }
.rc-page { background: #fff; color: #0a0f26; max-width: 780px; margin: 0 auto 28px; padding: 28px; border: 1px solid #d6dbe6; border-radius: 8px; }
.rc-page h1 { font-size: 20px; margin: 0; }
.rc-page h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .08em; color: #3a4560; }
.rc-page table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rc-page th, .rc-page td { border-bottom: 1px solid #e3e7ef; padding: 6px 8px; text-align: left; }
.rc-page th { background: #f2f5fb; }
.rc-page .num { text-align: right; font-variant-numeric: tabular-nums; }
.rc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 12px; }
.rc-sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 36px; font-size: 12px; }
.rc-sign div { border-top: 1px solid #0a0f26; padding-top: 4px; }
.rc-notice { color: #3a4560; font-size: 14px; }
@media print {
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .rc-page { border: 0; border-radius: 0; margin: 0; padding: 0; max-width: none; break-after: page; page-break-after: always; }
  .rc-page:last-child { break-after: auto; page-break-after: auto; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 14mm; }
}
`;

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
  const finals = new Map((finalsResult.data ?? []).map((row) => [row.student_id, row.snapshot as Card]));
  const missing = new Set(((missingResult.data ?? []) as Array<{ student_id: string }>).map((row) => row.student_id));

  const cards: Array<{ key: string; card: Card | null; name: string; blocked: boolean }> = [];
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
    cards.push({ key: student.id, card: data as Card, name: student.full_name, blocked: false });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <style>{css}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}. Use Print or save as PDF. Final cards print from their saved copy.
        </p>
        <PrintButton />
      </div>

      <div className="print-area">
        {cards.map(({ key, card, name, blocked }) =>
          blocked || !card ? (
            <section key={key} className="rc-page">
              <h1>Report card for {name}</h1>
              <p className="rc-notice">This card cannot be printed yet because some grades are missing. Compute the grades in Grading first.</p>
            </section>
          ) : (
            <section key={key} className="rc-page" aria-label={`Report card for ${card.studentName}`}>
              <p style={{ margin: 0, fontSize: 12, color: '#3a4560' }}>{card.school}</p>
              <h1>Terminal report · {card.term}</h1>
              <div className="rc-meta">
                <div><strong>Student:</strong> {card.studentName}</div>
                <div><strong>Class:</strong> {card.className}</div>
                <div><strong>Admission no.:</strong> {card.admissionNumber}</div>
                <div><strong>Position in class:</strong> {card.position ? `${ordinal(card.position)} of ${card.classSize}` : '—'}</div>
              </div>

              <h2>Subjects</h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col" className="num">Score</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Remark</th>
                    <th scope="col">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((row) => (
                    <tr key={row.subject}>
                      <td>{row.subject}</td>
                      <td className="num">{row.grade}</td>
                      <td>{row.letter}</td>
                      <td>{row.label}</td>
                      <td>{ordinal(row.subjectPosition)} of {row.subjectOutOf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="rc-meta" style={{ marginTop: 14 }}>
                <div><strong>Average:</strong> {card.average ?? '—'}</div>
                <div><strong>Next term begins:</strong> {card.nextTerm ? formatDate(card.nextTerm.startsOn) : '—'}</div>
              </div>

              <h2>Class teacher&apos;s remark</h2>
              <p style={{ fontSize: 13, minHeight: 36 }}>{card.classTeacherRemark || ' '}</p>
              <h2>Headmaster&apos;s remark</h2>
              <p style={{ fontSize: 13, minHeight: 36 }}>{card.headmasterRemark || ' '}</p>

              <div className="rc-sign">
                <div>Class teacher</div>
                <div>Headmaster</div>
                <div>Parent or guardian</div>
              </div>
            </section>
          ),
        )}
      </div>
    </main>
  );
}
