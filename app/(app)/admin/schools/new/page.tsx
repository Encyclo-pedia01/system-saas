import type { Metadata } from 'next';

import { CreateSchoolForm } from '@/components/admin/create-school-form';
import { GlassCard } from '@/components/ui/glass-card';
import { requireSuperAdmin } from '@/lib/auth/viewer';

export const metadata: Metadata = {
  title: 'Create school',
  description: 'Provision a new school and invite its owner by email.',
};

export default async function NewSchoolPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Platform</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Create a school</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">The owner receives an email invitation to set their password.</p>
      </header>
      <GlassCard className="p-6 sm:p-8">
        <CreateSchoolForm />
      </GlassCard>
    </div>
  );
}
