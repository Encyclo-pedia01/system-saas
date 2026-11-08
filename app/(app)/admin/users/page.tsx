import type { Metadata } from 'next';

import { TemporaryPasswordForm } from '@/components/admin/temporary-password-form';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireSuperAdmin } from '@/lib/auth/viewer';
import { MUST_CHANGE_PASSWORD_KEY, TEMP_PASSWORD_EXPIRES_KEY } from '@/lib/auth/temporary-password';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Users',
  description: 'Find an account and give it a temporary password.',
};

type SearchParams = Promise<{ q?: string | string[] }>;

const maxResults = 50;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdmin();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().toLowerCase() ?? '';

  const admin = createAdminClient();
  let matches: Array<{ id: string; email: string; fullName: string; mustChange: boolean; expiresAt: string | null; schools: string[] }> = [];
  let loadError = false;

  if (query) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      loadError = true;
    } else {
      const found = (data.users ?? [])
        .filter((user) => (user.email ?? '').toLowerCase().includes(query))
        .slice(0, maxResults);

      const ids = found.map((user) => user.id);
      const { data: memberships } = ids.length
        ? await admin.from('memberships').select('user_id, role, institutions(name)').in('user_id', ids)
        : { data: [] as Array<{ user_id: string; role: string; institutions: { name: string } | null }> };

      matches = found.map((user) => {
        const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
        const schools = (memberships ?? [])
          .filter((row) => row.user_id === user.id)
          .map((row) => {
            const institution = Array.isArray(row.institutions) ? row.institutions[0] : row.institutions;
            return `${institution?.name ?? 'School'} (${row.role})`;
          });
        return {
          id: user.id,
          email: user.email ?? '',
          fullName: String((user.user_metadata as Record<string, unknown> | undefined)?.full_name ?? ''),
          mustChange: appMetadata[MUST_CHANGE_PASSWORD_KEY] === true,
          expiresAt: typeof appMetadata[TEMP_PASSWORD_EXPIRES_KEY] === 'string' ? (appMetadata[TEMP_PASSWORD_EXPIRES_KEY] as string) : null,
          schools,
        };
      });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Find an account by email. Set a temporary password when someone is locked out. They must choose their own password at sign-in."
      />

      <GlassCard className="p-6">
        <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="userSearch" className="sr-only">Search by email</label>
          <input id="userSearch" name="q" type="search" defaultValue={query} placeholder="Search by email" className="field-input flex-1" />
          <button type="submit" className="btn btn-primary min-h-11 px-6">Search</button>
        </form>
      </GlassCard>

      {loadError ? (
        <p role="alert" className="form-error">Could not load accounts. Refresh the page to try again.</p>
      ) : !query ? (
        <EmptyState title="Search for an account">Type part of the email address to find it.</EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState title="No accounts found">Check the spelling of the email address.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {matches.map((user) => (
            <li key={user.id}>
              <GlassCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.email}</p>
                  {user.fullName && <p className="text-sm text-[var(--muted)]">{user.fullName}</p>}
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {user.schools.length > 0 ? user.schools.join(' · ') : 'No school'}
                  </p>
                  {user.mustChange && (
                    <p className="mt-2 text-xs font-semibold text-[var(--warning)]">
                      Temporary password pending{user.expiresAt ? ` · expires ${new Date(user.expiresAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                    </p>
                  )}
                </div>
                <div className="sm:w-80">
                  <TemporaryPasswordForm userId={user.id} />
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
