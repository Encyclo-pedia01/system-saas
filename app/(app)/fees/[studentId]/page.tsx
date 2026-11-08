import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ReversePaymentForm, WaiveChargeForm } from '@/components/fees/fee-forms';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { formatGhs, paymentMethodLabels } from '@/lib/fees/format';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';
import { studentIdSchema } from '@/lib/validation/fees';

export const metadata: Metadata = {
  title: 'Student fees',
  description: 'Charges, payments, and balance for one student.',
};

type Params = Promise<{ studentId: string }>;

export default async function StudentFeesPage({ params }: { params: Params }) {
  const viewer = await requireEffectiveRole(['owner', 'school_admin']);
  const { studentId } = await params;
  const parsedId = studentIdSchema.safeParse(studentId);
  if (!parsedId.success) notFound();

  const institutionId = viewer.institution!.id;
  const isOwner = viewer.effectiveRole === 'owner';
  const canWrite = isOwner && !viewer.readOnly;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id')
    .eq('id', parsedId.data)
    .eq('institution_id', institutionId)
    .maybeSingle();
  if (!student) notFound();

  const [classResult, termsResult, chargesResult, paymentsResult] = await Promise.all([
    supabase.from('classes').select('name').eq('id', student.class_id).maybeSingle(),
    supabase.from('terms').select('id, name').eq('institution_id', institutionId),
    supabase
      .from('fee_charges')
      .select('id, fee_item_id, term_id, amount_pesewas, waived_at, waive_reason')
      .eq('student_id', student.id)
      .eq('institution_id', institutionId),
    supabase
      .from('fee_payments')
      .select('id, term_id, amount_pesewas, paid_on, method, reference, note, reverses_id')
      .eq('student_id', student.id)
      .eq('institution_id', institutionId)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  const charges = chargesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const termName = new Map((termsResult.data ?? []).map((t) => [t.id, t.name]));
  const feeItemIds = [...new Set(charges.map((c) => c.fee_item_id))];
  const { data: feeItems } = feeItemIds.length
    ? await supabase.from('fee_items').select('id, name').in('id', feeItemIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const feeName = new Map((feeItems ?? []).map((f) => [f.id, f.name]));
  const reversed = new Set(payments.map((p) => p.reverses_id).filter((id): id is string => Boolean(id)));

  const totalCharged = charges.filter((c) => !c.waived_at).reduce((sum, c) => sum + c.amount_pesewas, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_pesewas, 0);
  const balance = totalCharged - totalPaid;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={classResult.data?.name ?? 'Student'}
        title={student.full_name}
        description={<>Admission {student.admission_number}. Balance {balance > 0 ? `owed: ${formatGhs(balance)}` : balance < 0 ? `credit: ${formatGhs(-balance)}` : 'clear'}.</>}
        action={<Link href="/fees" className="btn btn-ghost">Back to fees</Link>}
      />

      <GlassCard className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Charges</h2>
        {charges.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No fees have been charged to this student.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {charges.map((charge) => (
              <li key={charge.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{feeName.get(charge.fee_item_id) ?? 'Fee'} · {termName.get(charge.term_id) ?? 'Term'}</p>
                  <p className="text-[var(--muted)]">
                    {charge.waived_at ? `Waived: ${charge.waive_reason}` : formatGhs(charge.amount_pesewas)}
                    {charge.waived_at ? ` (was ${formatGhs(charge.amount_pesewas)})` : ''}
                  </p>
                </div>
                {canWrite && !charge.waived_at && <WaiveChargeForm chargeId={charge.id} />}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {payments.map((payment) => {
              const isReversal = payment.reverses_id !== null;
              const canReverse = canWrite && !isReversal && !reversed.has(payment.id);
              return (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {isReversal ? 'Reversal' : 'Payment'} · {formatGhs(payment.amount_pesewas)} · {termName.get(payment.term_id) ?? 'Term'}
                    </p>
                    <p className="text-[var(--muted)]">
                      {payment.paid_on} · {paymentMethodLabels[payment.method] ?? payment.method}
                      {payment.reference ? ` · ref ${payment.reference}` : ''}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  {canReverse && <ReversePaymentForm paymentId={payment.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
