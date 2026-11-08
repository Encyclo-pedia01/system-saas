import type { Metadata } from 'next';
import Link from 'next/link';

import { AssessmentForm, AssessmentScoreForm, ExamScoreForm } from '@/components/scores/score-forms';
import { ScoreUpload } from '@/components/scores/score-upload';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
export const metadata: Metadata = {
  title: 'Scores',
  description: 'Enter continuous assessment and exam scores.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ScoresPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'school_admin', 'staff']);
  const params = await searchParams;
  const supabase = await createClient();
  const institutionId = viewer.institution!.id;
  const canCreate = viewer.effectiveRole === 'owner' && !viewer.readOnly;
  const canEnter = !viewer.readOnly;

  const [classes, subjects, terms, assessments] = await Promise.all([
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('subjects').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('terms').select('id, name').eq('institution_id', institutionId).order('starts_on', { ascending: false }),
    supabase.from('assessments').select('id, title, max_score, class_id, classes(name)').eq('institution_id', institutionId).order('created_at', { ascending: false }),
  ]);

  const selectedAssessmentId = first(params.assessment);
  const selected = (assessments.data ?? []).find((a) => a.id === selectedAssessmentId);

  let assessmentStudents: { id: string; full_name: string }[] = [];
  let assessmentExisting: Record<string, number> = {};
  if (selected) {
    const [studentsRes, scoresRes] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('class_id', selected.class_id).order('full_name'),
      supabase.from('assessment_scores').select('student_id, score').eq('assessment_id', selected.id),
    ]);
    assessmentStudents = studentsRes.data ?? [];
    assessmentExisting = Object.fromEntries((scoresRes.data ?? []).map((row) => [row.student_id, Number(row.score)]));
  }

  const examClass = first(params.exam_class);
  const examSubject = first(params.exam_subject);
  const examTerm = first(params.exam_term);
  const examMax = Number(first(params.exam_max) ?? 100) || 100;
  let examStudents: { id: string; full_name: string }[] = [];
  let examExisting: Record<string, number> = {};
  if (examClass && examSubject && examTerm) {
    const [studentsRes, scoresRes] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('class_id', examClass).order('full_name'),
      supabase.from('exam_scores').select('student_id, score').eq('term_id', examTerm).eq('subject_id', examSubject),
    ]);
    examStudents = studentsRes.data ?? [];
    examExisting = Object.fromEntries((scoresRes.data ?? []).map((row) => [row.student_id, Number(row.score)]));
  }

  const classOptions = classes.data ?? [];
  const subjectOptions = subjects.data ?? [];
  const termOptions = terms.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Academics" title="Scores" description={<>Teachers enter scores here. Final grades are computed by the owner on the Grading page, and nobody can edit them by hand.</>} />

      {canEnter && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold">Upload scores from a file</h2>
          <p className="mb-5 text-sm text-[var(--muted)]">Upload marks for a whole class at once. You’ll see a preview before anything is saved.</p>
          <ScoreUpload
            assessments={(assessments.data ?? []).map((a) => ({
              id: a.id,
              title: a.title,
              maxScore: Number(a.max_score),
              className: (a.classes as unknown as { name: string } | null)?.name ?? '',
            }))}
            classes={classOptions}
            subjects={subjectOptions}
            terms={termOptions}
          />
        </GlassCard>
      )}

      {canCreate && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold">New assessment</h2>
          <AssessmentForm classes={classOptions} subjects={subjectOptions} terms={termOptions} />
        </GlassCard>
      )}

      <section aria-labelledby="assessments-heading" className="space-y-4">
        <h2 id="assessments-heading" className="text-lg font-semibold">Continuous assessments</h2>
        {(assessments.data ?? []).length === 0 ? (
          <EmptyState title="No assessments yet">Create an assessment above, then enter its scores.</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(assessments.data ?? []).map((a) => {
              const className = (a.classes as unknown as { name: string } | null)?.name ?? '';
              const active = a.id === selectedAssessmentId;
              return (
                <Link
                  key={a.id}
                  href={`/scores?assessment=${a.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={`btn min-h-9 px-4 text-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {a.title} · {className}
                </Link>
              );
            })}
          </div>
        )}

        {selected && canEnter && (
          <GlassCard className="p-6">
            <h3 className="mb-4 text-base font-semibold">{selected.title}</h3>
            <AssessmentScoreForm
              assessmentId={selected.id}
              students={assessmentStudents}
              existing={assessmentExisting}
              max={Number(selected.max_score)}
            />
          </GlassCard>
        )}
      </section>

      <section aria-labelledby="exam-heading" className="space-y-4">
        <h2 id="exam-heading" className="text-lg font-semibold">Final exam</h2>
        <GlassCard className="p-6">
          <form method="get" className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="exam_class" className="field-label">Class</label>
              <select id="exam_class" name="exam_class" defaultValue={examClass ?? ''} className="field-select"><option value="">Choose</option>{classOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </div>
            <div>
              <label htmlFor="exam_subject" className="field-label">Subject</label>
              <select id="exam_subject" name="exam_subject" defaultValue={examSubject ?? ''} className="field-select"><option value="">Choose</option>{subjectOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </div>
            <div>
              <label htmlFor="exam_term" className="field-label">Term</label>
              <select id="exam_term" name="exam_term" defaultValue={examTerm ?? ''} className="field-select"><option value="">Choose</option>{termOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </div>
            <div>
              <label htmlFor="exam_max" className="field-label">Exam maximum</label>
              <input id="exam_max" name="exam_max" type="number" min={1} defaultValue={examMax} className="field-input" />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className="btn btn-ghost">Load students</button>
            </div>
          </form>
        </GlassCard>

        {examClass && examSubject && examTerm && canEnter && (
          <GlassCard className="p-6">
            <ExamScoreForm
              classId={examClass}
              subjectId={examSubject}
              termId={examTerm}
              max={examMax}
              students={examStudents}
              existing={examExisting}
            />
          </GlassCard>
        )}
      </section>
    </div>
  );
}
