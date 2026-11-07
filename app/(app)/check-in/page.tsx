import type { Metadata } from 'next';

import { CheckInBoard, type StudentRow } from '@/components/check-in/check-in-board';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Check-in',
  description: 'Record student arrivals and absences for today.',
};

export default async function CheckInPage() {
  const viewer = await requireEffectiveRole(['authority']);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('list_students_for_check_in', {
    p_institution_id: viewer.institution!.id,
  });

  const students = (data ?? []) as StudentRow[];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Attendance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Check-in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Arrival times are recorded by the server. Anyone arriving after the school start time, plus any grace period, is marked late.
        </p>
      </header>

      {error ? (
        <p role="alert" className="form-error">Could not load the student list. Refresh and try again.</p>
      ) : (
        <CheckInBoard students={students} />
      )}
    </div>
  );
}
