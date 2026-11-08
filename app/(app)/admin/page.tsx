import type { Metadata } from 'next';
import Link from 'next/link';

import { SchoolRow, type SchoolView } from '@/components/admin/school-row';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireSuperAdmin } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Platform console',
  description: 'Manage schools, owner invitations, and access.',
};

export default async function AdminPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, slug, status, timezone, created_at, plan, subscription_ends_on, licence_reference, invitations(email, accepted_at)')
    .order('created_at', { ascending: false });

  const schools = (data ?? []) as unknown as SchoolView[];
  const active = schools.filter((school) => school.status === 'active').length;
  const suspended = schools.length - active;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Schools"
        description="Every institution on the platform, with its access status."
        action={<Link href="/admin/schools/new" className="btn btn-primary">Create school</Link>}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Summary">
        <div className="depth-card p-5"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Total</p><p className="mt-2 text-3xl font-bold">{schools.length}</p></div>
        <div className="depth-card p-5"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Active</p><p className="mt-2 text-3xl font-bold text-[var(--success)]">{active}</p></div>
        <div className="depth-card p-5"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Suspended</p><p className="mt-2 text-3xl font-bold text-[var(--danger)]">{suspended}</p></div>
      </section>

      {error ? (
        <p role="alert" className="form-error">Could not load schools. Refresh the page to try again.</p>
      ) : schools.length === 0 ? (
        <EmptyState title="No schools yet">Create the first one to invite its owner.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {schools.map((school) => (
            <SchoolRow key={school.id} school={school} />
          ))}
        </ul>
      )}
    </div>
  );
}
