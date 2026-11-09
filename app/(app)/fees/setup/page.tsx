import type { Metadata } from 'next';
import Link from 'next/link';

import { FeeItemForm, RemoveFeeItemForm } from '@/components/fees/fee-forms';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { formatGhs, todayInAccra } from '@/lib/fees/format';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Fee items',
  description: 'Set up the fees charged to students each term.',
};

export default async function FeeSetupPage() {
  const viewer = await requireEffectiveRole(['owner']);
  const institutionId = viewer.institution!.id;
  const canWrite = !viewer.readOnly;

  const supabase = await createClient();
  const [termsResult, classesResult, feeItemsResult, chargesResult, paymentsResult] = await Promise.all([
    supabase.from('terms').select('id, name').eq('institution_id', institutionId).order('starts_on'),
    supabase.from('classes').select('id, name').eq('institution_id', institutionId).order('name'),
    supabase.from('fee_items').select('id, name, amount_pesewas, due_on, class_id, term_id').eq('institution_id', institutionId).order('created_at', { ascending: false }),
    supabase.from('fee_charges').select('fee_item_id').eq('institution_id', institutionId),
    supabase.from('fee_payments').select('term_id').eq('institution_id', institutionId),
  ]);

  const terms = termsResult.data ?? [];
  const classes = classesResult.data ?? [];
  const feeItems = feeItemsResult.data ?? [];
  const termName = new Map(terms.map((t) => [t.id, t.name]));
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const chargeCount = new Map<string, number>();
  for (const charge of chargesResult.data ?? []) {
    chargeCount.set(charge.fee_item_id, (chargeCount.get(charge.fee_item_id) ?? 0) + 1);
  }
  const termsWithPayments = new Set((paymentsResult.data ?? []).map((p) => p.term_id));

  return (
    <div className="space-y-8">
      <PageHeader backHref="/fees"
        eyebrow="Finance"
        title="Fee items"
        description="A fee is charged to every student in the class (or all classes) when it is added. Fees can be removed until a payment is recorded for their term."
        action={<Link href="/fees" className="btn btn-ghost">Back to fees</Link>}
      />

      {canWrite && (
        <GlassCard className="p-6 sm:p-8">
          <h2 className="mb-5 text-lg font-semibold">Add a fee</h2>
          {terms.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Add a term on the Students page first.</p>
          ) : (
            <FeeItemForm
              terms={terms.map((t) => ({ id: t.id, label: t.name }))}
              classes={classes.map((c) => ({ id: c.id, label: c.name }))}
              today={todayInAccra()}
            />
          )}
        </GlassCard>
      )}

      {feeItems.length === 0 ? (
        <EmptyState title="No fees yet">Add a fee above. Students will be charged as soon as it is saved.</EmptyState>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
          {feeItems.map((fee) => {
            const locked = termsWithPayments.has(fee.term_id);
            return (
              <li key={fee.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium">{fee.name} · {formatGhs(fee.amount_pesewas)}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {termName.get(fee.term_id) ?? 'Term'} · {fee.class_id ? className.get(fee.class_id) : 'All classes'} · {chargeCount.get(fee.id) ?? 0} students charged
                    {fee.due_on ? ` · due ${fee.due_on}` : ''}
                  </p>
                </div>
                {canWrite && (locked ? (
                  <p className="text-sm text-[var(--muted)]">Locked: payments recorded for this term</p>
                ) : (
                  <RemoveFeeItemForm feeItemId={fee.id} />
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
