import type { Metadata } from 'next';

import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { requireEffectiveRole } from '@/lib/auth/viewer';

export const metadata: Metadata = {
  title: 'Backup',
  description: 'Download a copy of your school’s records.',
};

export default async function BackupPage() {
  const viewer = await requireEffectiveRole(['owner']);
  const canDownload = !viewer.readOnly;

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard"
        eyebrow="Records"
        title="Backup"
        description={<>Download a complete copy of your school’s records as a file you keep safe.</>}
      />

      <GlassCard className="space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="text-lg font-semibold">Download a backup</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Get a copy of your school’s records as an Excel workbook.</p>
        </div>

        {canDownload ? (
          <a href="/backup-export" className="btn-primary inline-flex justify-center" download>
            Download Copy
          </a>
        ) : (
          <p className="text-sm text-[var(--muted)]">Backups cannot be downloaded in read-only view.</p>
        )}
      </GlassCard>
    </div>
  );
}
