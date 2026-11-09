import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';
import { levelLabels, isClassLevel } from '@/lib/validation/classes';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ClassCard = {
  id: string;
  name: string;
  levelLabel: string | null;
  students: { id: string; name: string }[];
  assessments: { id: string; title: string; subject: string; scored: number; total: number }[];
  commentsDone: number;
};

// Teachers see only the classes they are assigned to. Every query is also filtered by class id.
export async function TeacherHome({
  supabase,
  institutionId,
  userId,
}: {
  supabase: Supabase;
  institutionId: string;
  userId: string;
}) {
  const { data: assignments } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('institution_id', institutionId)
    .eq('user_id', userId);
  const classIds = (assignments ?? []).map((row) => row.class_id as string);

  if (classIds.length === 0) {
    return (
      <EmptyState title="No classes yet">
        Your school owner will assign you to a class. Once you are assigned, your students and scores will appear here.
      </EmptyState>
    );
  }

  const { data: termRows } = await supabase
    .from('terms')
    .select('id, name')
    .eq('institution_id', institutionId)
    .order('starts_on', { ascending: false })
    .limit(1);
  const currentTerm = termRows?.[0] ?? null;

  const [classesResult, studentsResult, assessmentsResult] = await Promise.all([
    supabase.from('classes').select('id, name, level').eq('institution_id', institutionId).in('id', classIds).order('name'),
    supabase.from('students').select('id, full_name, class_id').eq('institution_id', institutionId).in('class_id', classIds).order('full_name'),
    supabase
      .from('assessments')
      .select('id, title, class_id, subject_id')
      .eq('institution_id', institutionId)
      .in('class_id', classIds)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const classes = classesResult.data ?? [];
  const students = studentsResult.data ?? [];
  const assessments = assessmentsResult.data ?? [];
  const assessmentIds = assessments.map((a) => a.id as string);
  const subjectIds = [...new Set(assessments.map((a) => a.subject_id as string))];
  const studentIds = students.map((s) => s.id as string);

  const [subjectsResult, scoresResult, remarksResult] = await Promise.all([
    subjectIds.length
      ? supabase.from('subjects').select('id, name').eq('institution_id', institutionId).in('id', subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    assessmentIds.length
      ? supabase.from('assessment_scores').select('assessment_id, student_id').eq('institution_id', institutionId).in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [] as { assessment_id: string; student_id: string }[] }),
    currentTerm && studentIds.length
      ? supabase
          .from('report_remarks')
          .select('student_id')
          .eq('institution_id', institutionId)
          .eq('term_id', currentTerm.id)
          .eq('kind', 'class_teacher')
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
  ]);

  const subjectName = new Map((subjectsResult.data ?? []).map((s) => [s.id as string, s.name as string]));
  const scoredByAssessment = new Map<string, Set<string>>();
  for (const row of scoresResult.data ?? []) {
    const set = scoredByAssessment.get(row.assessment_id as string) ?? new Set<string>();
    set.add(row.student_id as string);
    scoredByAssessment.set(row.assessment_id as string, set);
  }
  const remarkedStudents = new Set((remarksResult.data ?? []).map((r) => r.student_id as string));

  const cards: ClassCard[] = classes.map((classRow) => {
    const id = classRow.id as string;
    const classStudents = students.filter((s) => s.class_id === id);
    const classStudentIds = new Set(classStudents.map((s) => s.id as string));
    const classAssessments = assessments
      .filter((a) => a.class_id === id)
      .slice(0, 5)
      .map((a) => ({
        id: a.id as string,
        title: a.title as string,
        subject: subjectName.get(a.subject_id as string) ?? 'Subject',
        scored: scoredByAssessment.get(a.id as string)?.size ?? 0,
        total: classStudentIds.size,
      }));
    return {
      id,
      name: classRow.name as string,
      levelLabel: isClassLevel(classRow.level) ? levelLabels[classRow.level] : null,
      students: classStudents.map((s) => ({ id: s.id as string, name: s.full_name as string })),
      assessments: classAssessments,
      commentsDone: classStudents.filter((s) => remarkedStudents.has(s.id as string)).length,
    };
  });

  const totalStudents = students.length;
  const commentsDone = cards.reduce((sum, c) => sum + c.commentsDone, 0);
  const needScores = cards.reduce(
    (sum, c) => sum + c.assessments.filter((a) => a.scored < a.total).length,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-3 gap-3" aria-label="Your summary">
        <Summary label="Classes" value={classes.length} />
        <Summary label="Students" value={totalStudents} />
        <Summary label="Scores to add" value={needScores} />
      </section>

      {currentTerm && (
        <p className="text-sm text-[var(--muted)]">
          Report comments for {currentTerm.name}: {commentsDone} of {totalStudents} written.
        </p>
      )}

      <section aria-labelledby="my-classes" className="flex flex-col gap-4">
        <h2 id="my-classes" className="text-lg font-semibold">My classes</h2>
        {cards.map((card) => (
          <article key={card.id} className="depth-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold">{card.name}</h3>
              <span className="text-xs text-[var(--muted)]">
                {card.levelLabel ? `${card.levelLabel} · ` : ''}
                {card.students.length} students
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Recent assessments</p>
              {card.assessments.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No assessments yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {card.assessments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{a.title}</span>
                        <span className="text-[var(--muted)]"> · {a.subject}</span>
                      </span>
                      <span className={a.scored < a.total ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]'}>
                        {a.scored} of {a.total} scored
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">
                Students ({card.students.length})
              </summary>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {card.students.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            </details>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/scores" className="btn btn-ghost min-h-11">Enter scores</Link>
              <Link href="/report-cards" className="btn btn-ghost min-h-11">Report comments</Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="depth-card p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
