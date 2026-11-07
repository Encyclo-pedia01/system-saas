import type { Metadata } from 'next';

import { GlassCard } from '@/components/ui/glass-card';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How School OS collects, uses, and protects personal data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <GlassCard className="p-8 sm:p-10">
        <h1 className="text-3xl font-bold">Privacy notice</h1>
        <p className="mt-2 text-xs text-[var(--muted)]">Draft for review by legal counsel before launch.</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
          <p><strong className="text-[var(--text)]">What we collect.</strong> Account details for staff and owners, and school records such as class lists, attendance check-ins, assessment scores, and results.</p>
          <p><strong className="text-[var(--text)]">Why we use it.</strong> To run attendance, grading, and insight alerts for each school, and to keep the platform secure.</p>
          <p><strong className="text-[var(--text)]">Separation.</strong> Each school’s records are isolated at the database level. A school’s staff cannot see another school’s data.</p>
          <p><strong className="text-[var(--text)]">Audit.</strong> Changes to key records are logged with the acting user so that schools can review them.</p>
          <p><strong className="text-[var(--text)]">Cookies.</strong> We use essential cookies to keep you signed in. See the cookie notice banner for choices.</p>
          <p><strong className="text-[var(--text)]">Contact.</strong> Direct privacy requests to your school owner or the platform administrator.</p>
        </div>
      </GlassCard>
    </main>
  );
}
