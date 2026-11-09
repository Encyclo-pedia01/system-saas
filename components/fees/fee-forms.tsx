'use client';

import { useActionState } from 'react';

import {
  createFeeItemAction,
  recordPaymentAction,
  removeFeeItemAction,
  reversePaymentAction,
  waiveChargeAction,
} from '@/app/(app)/fees/actions';
import { FieldError } from '@/components/ui/field-error';
import { ConfirmedSubmitForm } from '@/components/ui/confirmed-submit-form';
import { TypedConfirm } from '@/components/ui/typed-confirm';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';

export type FeeOption = { id: string; label: string };

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

export function FeeItemForm({
  terms,
  classes,
  today,
}: {
  terms: FeeOption[];
  classes: FeeOption[];
  today: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createFeeItemAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <ConfirmedSubmitForm action={action} className="grid gap-4 sm:grid-cols-2" title="Charge students now?" description="Saving this fee immediately creates a charge for every student in the selected class, or every class if you choose All classes, for the selected term. Check the scope and amount before continuing; removing the fee later may not be possible after a payment is recorded for that term." actionLabel="Add fee and charge students" pendingLabel="Adding…" variant="primary">
      <div>
        <label htmlFor="feeTerm" className="field-label">Term</label>
        <select id="feeTerm" name="termId" required className="field-input" aria-invalid={Boolean(errors?.termId)}>
          {terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
        </select>
        <FieldError messages={errors?.termId} />
      </div>
      <div>
        <label htmlFor="feeClass" className="field-label">Applies to</label>
        <select id="feeClass" name="classId" className="field-input" defaultValue="">
          <option value="">All classes</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="feeName" className="field-label">Fee name</label>
        <input id="feeName" name="name" required placeholder="Tuition" className="field-input" aria-invalid={Boolean(errors?.name)} />
        <FieldError messages={errors?.name} />
      </div>
      <div>
        <label htmlFor="feeAmount" className="field-label">Amount (GHS)</label>
        <input id="feeAmount" name="amount" inputMode="decimal" required placeholder="150.00" className="field-input" aria-invalid={Boolean(errors?.amount)} />
        <FieldError messages={errors?.amount} />
      </div>
      <div>
        <label htmlFor="feeDue" className="field-label">Due date (optional)</label>
        <input id="feeDue" name="dueOn" type="date" defaultValue={today} className="field-input" aria-invalid={Boolean(errors?.dueOn)} />
        <FieldError messages={errors?.dueOn} />
      </div>
    </ConfirmedSubmitForm>
  );
}

export function RemoveFeeItemForm({ feeItemId, feeName }: { feeItemId: string; feeName: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(removeFeeItemAction, null);
  useActionToast(state);

  return (
    <TypedConfirm
      action={action}
      hiddenFields={{ feeItemId }}
      itemName={feeName}
      triggerLabel="Remove"
      title={`Remove ${feeName}?`}
      consequence={<p>Students will no longer be charged this fee. Payments already recorded stay on their accounts.</p>}
      confirmLabel="Remove fee"
      pendingLabel="Removing…"
    />
  );
}

export function PaymentForm({
  students,
  terms,
  today,
}: {
  students: FeeOption[];
  terms: FeeOption[];
  today: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(recordPaymentAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <ConfirmedSubmitForm action={action} className="grid gap-4 sm:grid-cols-2" title="Record this payment?" description="This will post the entered amount as a payment against the selected student and term. Verify the student, amount, date, and payment method before confirming. Corrections require an owner to record a reversal." actionLabel="Record payment" pendingLabel="Recording…" variant="primary">
      <div className="sm:col-span-2">
        <label htmlFor="paymentStudent" className="field-label">Student</label>
        <select id="paymentStudent" name="studentId" required className="field-input" aria-invalid={Boolean(errors?.studentId)}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
        </select>
        <FieldError messages={errors?.studentId} />
      </div>
      <div>
        <label htmlFor="paymentTerm" className="field-label">Term</label>
        <select id="paymentTerm" name="termId" required className="field-input" aria-invalid={Boolean(errors?.termId)}>
          {terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
        </select>
        <FieldError messages={errors?.termId} />
      </div>
      <div>
        <label htmlFor="paymentAmount" className="field-label">Amount (GHS)</label>
        <input id="paymentAmount" name="amount" inputMode="decimal" required placeholder="150.00" className="field-input" aria-invalid={Boolean(errors?.amount)} />
        <FieldError messages={errors?.amount} />
      </div>
      <div>
        <label htmlFor="paymentDate" className="field-label">Date paid</label>
        <input id="paymentDate" name="paidOn" type="date" required defaultValue={today} className="field-input" aria-invalid={Boolean(errors?.paidOn)} />
        <FieldError messages={errors?.paidOn} />
      </div>
      <div>
        <label htmlFor="paymentMethod" className="field-label">How it was paid</label>
        <select id="paymentMethod" name="method" required className="field-input" defaultValue="cash" aria-invalid={Boolean(errors?.method)}>
          {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </select>
        <FieldError messages={errors?.method} />
      </div>
      <div>
        <label htmlFor="paymentReference" className="field-label">Reference (optional)</label>
        <input id="paymentReference" name="reference" className="field-input" aria-invalid={Boolean(errors?.reference)} />
        <FieldError messages={errors?.reference} />
      </div>
      <div>
        <label htmlFor="paymentNote" className="field-label">Note (optional)</label>
        <input id="paymentNote" name="note" className="field-input" aria-invalid={Boolean(errors?.note)} />
        <FieldError messages={errors?.note} />
      </div>
    </ConfirmedSubmitForm>
  );
}

export function ReversePaymentForm({ paymentId }: { paymentId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(reversePaymentAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <ConfirmedSubmitForm action={action} className="flex flex-wrap items-start gap-2" title="Reverse this payment?" description="This will mark the payment as reversed and update the student's fee balance. Enter a reason before continuing." actionLabel="Reverse payment" pendingLabel="Reversing…" variant="ghost">
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <label htmlFor={`reverse-${paymentId}`} className="sr-only">Reason for reversal</label>
        <input id={`reverse-${paymentId}`} name="reason" required placeholder="Reason" className="field-input w-48" aria-invalid={Boolean(errors?.reason)} />
        <FieldError messages={errors?.reason} />
      </div>
    </ConfirmedSubmitForm>
  );
}

export function WaiveChargeForm({ chargeId }: { chargeId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(waiveChargeAction, null);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <ConfirmedSubmitForm action={action} className="flex flex-wrap items-start gap-2" title="Waive this charge?" description="This will remove the selected charge from the student's outstanding balance. Enter a reason before continuing." actionLabel="Waive charge" pendingLabel="Waiving…" variant="ghost">
      <input type="hidden" name="chargeId" value={chargeId} />
      <div>
        <label htmlFor={`waive-${chargeId}`} className="sr-only">Reason for waiver</label>
        <input id={`waive-${chargeId}`} name="reason" required placeholder="Reason" className="field-input w-48" aria-invalid={Boolean(errors?.reason)} />
        <FieldError messages={errors?.reason} />
      </div>
    </ConfirmedSubmitForm>
  );
}
