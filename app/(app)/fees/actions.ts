'use server';

import { revalidatePath } from 'next/cache';

import { parseGhsToPesewas, todayInAccra } from '@/lib/fees/format';
import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createClient } from '@/lib/supabase/server';
import {
  feeItemSchema,
  feeRemovalSchema,
  paymentSchema,
  reversalSchema,
  waiverSchema,
} from '@/lib/validation/fees';

function revalidateFees(studentId?: string) {
  revalidatePath('/fees');
  revalidatePath('/fees/setup');
  if (studentId) {
    revalidatePath(`/fees/${studentId}`);
  }
}

export async function createFeeItemAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const rawClass = String(formData.get('classId') ?? '');
  const parsed = feeItemSchema.safeParse({
    termId: formData.get('termId'),
    classId: rawClass === '' ? null : rawClass,
    name: formData.get('name'),
    amount: formData.get('amount'),
    dueOn: formData.get('dueOn') ?? '',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const pesewas = parseGhsToPesewas(parsed.data.amount);
  if (pesewas === null) return failure('Enter an amount in cedis, for example 150 or 150.50.');

  const supabase = await createClient();
  const { error } = await supabase.from('fee_items').insert({
    institution_id: guard.context.institutionId,
    term_id: parsed.data.termId,
    class_id: parsed.data.classId,
    name: parsed.data.name,
    amount_pesewas: pesewas,
    due_on: parsed.data.dueOn === '' ? null : parsed.data.dueOn,
    created_by: guard.context.userId,
  });

  if (error) return databaseFailure(error, 'Could not add the fee. Check the term and class.');

  revalidateFees();
  return success(`${parsed.data.name} added. Students in the class have been charged.`);
}

export async function removeFeeItemAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = feeRemovalSchema.safeParse({ feeItemId: formData.get('feeItemId') });
  if (!parsed.success) return failure('That fee could not be found.');

  const supabase = await createClient();
  const { data, error } = await supabase.from('fee_items').delete().eq('id', parsed.data.feeItemId).select('id');

  if (error) return databaseFailure(error, 'Could not remove the fee.');
  if (!data || data.length === 0) return failure('That fee could not be found.');

  revalidateFees();
  return success('Fee removed.');
}

export async function recordPaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner', 'school_admin']);
  if (!guard.ok) return failure(guard.message);

  const parsed = paymentSchema.safeParse({
    studentId: formData.get('studentId'),
    termId: formData.get('termId'),
    amount: formData.get('amount'),
    paidOn: formData.get('paidOn'),
    method: formData.get('method'),
    reference: formData.get('reference') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const pesewas = parseGhsToPesewas(parsed.data.amount);
  if (pesewas === null) return failure('Enter an amount in cedis, for example 150 or 150.50.');

  const supabase = await createClient();
  const { error } = await supabase.from('fee_payments').insert({
    institution_id: guard.context.institutionId,
    student_id: parsed.data.studentId,
    term_id: parsed.data.termId,
    amount_pesewas: pesewas,
    paid_on: parsed.data.paidOn,
    method: parsed.data.method,
    reference: parsed.data.reference === '' ? null : parsed.data.reference,
    note: parsed.data.note === '' ? null : parsed.data.note,
    recorded_by: guard.context.userId,
  });

  if (error) return databaseFailure(error, 'Could not record the payment. Check the student and term.');

  revalidateFees(parsed.data.studentId);
  return success(`Payment of GHS ${(pesewas / 100).toFixed(2)} recorded.`);
}

export async function reversePaymentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = reversalSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: original, error: readError } = await supabase
    .from('fee_payments')
    .select('id, student_id, term_id, amount_pesewas, method, reverses_id')
    .eq('id', parsed.data.paymentId)
    .maybeSingle();

  if (readError) return databaseFailure(readError, 'Could not find that payment.');
  if (!original) return failure('That payment could not be found.');
  if (original.reverses_id !== null) return failure('A reversal cannot be reversed.');

  const { data: existing } = await supabase
    .from('fee_payments')
    .select('id')
    .eq('reverses_id', original.id)
    .maybeSingle();
  if (existing) return failure('This payment has already been reversed.');

  const { error } = await supabase.from('fee_payments').insert({
    institution_id: guard.context.institutionId,
    student_id: original.student_id,
    term_id: original.term_id,
    amount_pesewas: -original.amount_pesewas,
    paid_on: todayInAccra(),
    method: original.method,
    note: `Reversal: ${parsed.data.reason}`,
    reverses_id: original.id,
    recorded_by: guard.context.userId,
  });

  if (error) return databaseFailure(error, 'Could not reverse the payment.');

  revalidateFees(original.student_id);
  return success('Payment reversed. The balance has been updated.');
}

export async function waiveChargeAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = waiverSchema.safeParse({
    chargeId: formData.get('chargeId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fee_charges')
    .update({ waived_at: new Date().toISOString(), waive_reason: parsed.data.reason })
    .eq('id', parsed.data.chargeId)
    .is('waived_at', null)
    .select('student_id');

  if (error) return databaseFailure(error, 'Could not waive the charge.');
  if (!data || data.length === 0) return failure('That charge is already waived or could not be found.');

  revalidateFees(data[0].student_id);
  return success('Charge waived.');
}
