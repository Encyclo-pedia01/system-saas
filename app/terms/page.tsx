import type { Metadata } from 'next';

import { LegalCloseButton } from '@/components/legal/legal-close-button';
import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that govern use of School OS.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <GlassCard className="relative p-8 sm:p-10">
        <LegalCloseButton />
        <h1 className="text-3xl font-bold">Terms of service</h1>
        <p className="mt-2 text-xs text-[var(--muted)]">Draft for review by legal counsel before launch.</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
          <p><strong className="text-[var(--text)]">Access.</strong> Accounts are invitation-only. You must keep your credentials confidential.</p>
          <p><strong className="text-[var(--text)]">Acceptable use.</strong> Use the platform only for school administration. Do not attempt to access data belonging to another school.</p>
          <p><strong className="text-[var(--text)]">Suspension.</strong> The platform administrator may suspend a school’s access, for example for non-payment or misuse.</p>
          <p><strong className="text-[var(--text)]">Records.</strong> Schools remain responsible for the accuracy of the records they enter, including grades and attendance.</p>
          <p><strong className="text-[var(--text)]">Liability.</strong> The service is provided as is, to the extent permitted by law.</p>
        </div>
      </GlassCard>
    </main>
  );
}
