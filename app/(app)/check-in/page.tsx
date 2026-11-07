import type { Metadata } from 'next';

import { CheckInBoard, type StudentRow } from '@/components/check-in/check-in-board';
import { requireEffectiveRole } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

import { PageHeader } from '@/components/ui/page-header';
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
      <PageHeader eyebrow="Attendance" title="Check-in" description={<>Arrival times are recorded by the server. Anyone arriving after the school start time, plus any grace period, is marked late.</>} />

      {error ? (
        <p role="alert" className="form-error">Could not load the student list. Refresh and try again.</p>
      ) : (
        <CheckInBoard students={students} />
      )}
    </div>
  );
}
