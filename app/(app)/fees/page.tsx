import type { Metadata } from 'next';
import Link from 'next/link';

import { FeeFilters } from '@/components/fees/fee-filters';
import { PaymentForm, type FeeOption } from '@/components/fees/fee-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { formatGhs, todayInAccra } from '@/lib/fees/format';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Fees',
  description: 'Fee balances and payments for students.',
};

type SearchParams = Promise<{ classId?: string | string[]; q?: string | string[] }>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

type Row = {
  id: string;
  name: string;
  admission: string;
  className: string;
  classId: string;
  charged: number;
  paid: number;
  balance: number;
  terms: Array<{ name: string; balance: number }>;
};

export default async function FeesPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireEffectiveRole(['owner', 'school_admin']);
  const { classId: rawClass, q: rawQuery } = await searchParams;
  const classId = firstValue(rawClass);
  const query = firstValue(rawQuery).trim().toLowerCase();
  const institutionId = viewer.institution!.id;
  const isOwner = viewer.effectiveRole === 'owner';
  const canRecord = !viewer.readOnly;

  const supabase = await createClient();
  const [studentsResult, classesResult, termsResult, balancesResult] = await Promise.all([
    supabase.from('students').select('id, full_name, admission_number, class_id').eq('institution_id', institutionId).order('full_name'),
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('terms').select('id, name, starts_on').eq('institution_id', institutionId).order('starts_on'),
    supabase.from('fee_balances').select('student_id, term_id, charged_pesewas, paid_pesewas, balance_pesewas').eq('institution_id', institutionId),
  ]);

  const students = studentsResult.data ?? [];
  const classes = classesResult.data ?? [];
  const terms = termsResult.data ?? [];
  const balances = balancesResult.data ?? [];
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));

  const totals = new Map<string, { charged: number; paid: number; balance: number; terms: Row['terms'] }>();
  for (const entry of balances) {
    const current = totals.get(entry.student_id) ?? { charged: 0, paid: 0, balance: 0, terms: [] };
    current.charged += entry.charged_pesewas;
    current.paid += entry.paid_pesewas;
    current.balance += entry.balance_pesewas;
    if (entry.charged_pesewas > 0 || entry.paid_pesewas !== 0) {
      current.terms.push({ name: termNameById.get(entry.term_id) ?? 'Term', balance: entry.balance_pesewas });
    }
    totals.set(entry.student_id, current);
  }

  const rows: Row[] = students
    .map((student) => {
      const t = totals.get(student.id) ?? { charged: 0, paid: 0, balance: 0, terms: [] };
      return {
        id: student.id,
        name: student.full_name,
        admission: student.admission_number,
        className: classNameById.get(student.class_id) ?? '',
        classId: student.class_id,
        ...t,
      };
    })
    .filter((row) => (classId === '' || row.classId === classId))
    .filter((row) => query === '' || row.name.toLowerCase().includes(query) || row.admission.toLowerCase().includes(query))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));

  const arrearsTotal = rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0);
  const inArrears = rows.filter((row) => row.balance > 0).length;

  const studentOptions: FeeOption[] = students.map((s) => ({ id: s.id, label: `${s.full_name} · ${s.admission_number}` }));
  const termOptions: FeeOption[] = terms.map((t) => ({ id: t.id, label: t.name }));

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard"
        eyebrow="Finance"
        title="Fees"
        description="See what each student owes. Filter by class or name."
        action={isOwner ? <Link href="/fees/setup" className="btn btn-ghost">Manage fee items</Link> : undefined}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5"><p className="text-sm text-[var(--muted)]">Total arrears in this view</p><p className="mt-2 text-2xl font-semibold">{formatGhs(arrearsTotal)}</p></GlassCard>
        <GlassCard className="p-5"><p className="text-sm text-[var(--muted)]">Students in arrears</p><p className="mt-2 text-2xl font-semibold">{inArrears}</p></GlassCard>
        <GlassCard className="p-5"><p className="text-sm text-[var(--muted)]">Students shown</p><p className="mt-2 text-2xl font-semibold">{rows.length}</p></GlassCard>
      </section>

      <GlassCard className="p-6">
        <FeeFilters classes={classes} classId={classId} query={firstValue(rawQuery)} />
      </GlassCard>

      {students.length === 0 ? (
        <EmptyState title="No students yet">Enrol students on the Students page, then their fees will appear here.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="No students match">Try another class or a different name.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Student fee balances</caption>
            <thead className="bg-[var(--hover)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Student</th>
                <th scope="col" className="px-4 py-3 font-semibold">Class</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Charged</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={`/fees/${row.id}`} className="font-medium underline-offset-4 hover:underline">{row.name}</Link>
                    <p className="text-xs text-[var(--muted)]">{row.admission}</p>
                    {row.terms.length > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {row.terms.map((term) => `${term.name}: ${formatGhs(term.balance)}`).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.className}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatGhs(row.charged)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatGhs(row.paid)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.balance > 0 ? (
                      <span className="badge bg-[var(--highlight)] text-[var(--highlight-text)]">Owes {formatGhs(row.balance)}</span>
                    ) : row.balance < 0 ? (
                      <span className="badge bg-[var(--hover)] text-[var(--muted)]">Credit {formatGhs(-row.balance)}</span>
                    ) : (
                      <span className="text-[var(--muted)]">Clear</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canRecord && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold">Record a payment</h2>
          {terms.length === 0 || students.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Add a term and at least one student before recording a payment.</p>
          ) : (
            <PaymentForm students={studentOptions} terms={termOptions} today={todayInAccra()} />
          )}
        </GlassCard>
      )}
    </div>
  );
}
