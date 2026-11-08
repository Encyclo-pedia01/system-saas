import 'server-only';

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SetupItem = {
  key: 'classes' | 'subjects' | 'terms' | 'students' | 'team' | 'grading' | 'authenticator';
  label: string;
  description: string;
  href: string;
  done: boolean;
};

// Owner setup steps, in the order a new school normally completes them.
// Each step is judged from the data that already exists, so nothing needs to be ticked by hand.
export async function getSetupItems(
  supabase: SupabaseServerClient,
  institutionId: string,
  mfaEnrolled: boolean,
): Promise<SetupItem[]> {
  const countOf = async (table: 'classes' | 'subjects' | 'terms' | 'students') => {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('institution_id', institutionId);
    return count ?? 0;
  };

  const [classes, subjects, terms, students, teamMembers, gradingKeys] = await Promise.all([
    countOf('classes'),
    countOf('subjects'),
    countOf('terms'),
    countOf('students'),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .eq('role', 'staff'),
    supabase.from('grading_keys').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
  ]);

  return [
    { key: 'classes', label: 'Add classes', description: 'Create each class, with groups if it has them.', href: '/students', done: classes > 0 },
    { key: 'subjects', label: 'Add subjects', description: 'List the subjects taught in the school.', href: '/students', done: subjects > 0 },
    { key: 'terms', label: 'Add terms', description: 'Set the start and end dates of each term.', href: '/students', done: terms > 0 },
    { key: 'students', label: 'Enrol students', description: 'Add students one by one or upload a file.', href: '/students', done: students > 0 },
    { key: 'team', label: 'Invite teachers', description: 'Teachers enter scores and results.', href: '/team', done: (teamMembers.count ?? 0) > 0 },
    { key: 'grading', label: 'Set grading weights', description: 'Grades cannot be computed until the weights are set.', href: '/grading', done: (gradingKeys.count ?? 0) > 0 },
    { key: 'authenticator', label: 'Turn on sign-in codes', description: 'Owners sign in with a code from an authenticator app.', href: '/mfa/setup', done: mfaEnrolled },
  ];
}
