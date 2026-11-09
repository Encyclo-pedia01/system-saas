import type { Metadata } from 'next';

import { CreateSchoolForm } from '@/components/admin/create-school-form';
import { GlassCard } from '@/components/ui/glass-card';
import { requireSuperAdmin } from '@/lib/auth/viewer';

import { PageHeader } from '@/components/ui/page-header';
export const metadata: Metadata = {
  title: 'Create school',
  description: 'Provision a new school and invite its owner by email.',
};

export default async function NewSchoolPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader backHref="/admin" eyebrow="Platform" title="Create a school" description={<>Creating the school gives you a one-time invitation link for the owner. Send it to the owner privately. Campus Veritas does not email it.</>} />
      <GlassCard className="p-6 sm:p-8">
        <CreateSchoolForm />
      </GlassCard>
    </div>
  );
}
