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
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            The file contains your students, classes, groups, subjects, terms, assessments, scores, results, insights, fee records (fee items, charges, and payments), and report card records (grade bands, class teachers, remarks, and final cards), as an Excel workbook (.xlsx) with one sheet per table. It does not include staff passwords or sign-in details.
          </p>
        </div>

        {canDownload ? (
          <a href="/backup-export" className="btn-primary inline-flex justify-center" download>
            Download Copy
          </a>
        ) : (
          <p className="text-sm text-[var(--muted)]">Backups cannot be downloaded in read-only view.</p>
        )}

        <div className="rounded-lg border border-[var(--border)] p-4 text-sm leading-relaxed text-[var(--muted)]">
          <p className="font-medium text-[var(--text)]">Keep your copies safe</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Download a backup at the end of each term, and before any big change.</li>
            <li>The file contains student names and records. Store it somewhere private, and do not share it.</li>
            <li>Campus Veritas does not keep automatic copies on the free hosting plan, so your downloads are your safety net.</li>
          </ul>
        </div>
      </GlassCard>
    </div>
  );
}
