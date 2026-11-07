import type { Metadata } from 'next';
import Link from 'next/link';

import { acceptInvitationAction } from '@/app/invite/[token]/actions';
import { GlassCard } from '@/components/ui/glass-card';
import { SubmitButton } from '@/components/ui/submit-button';
import { hashInvitationToken } from '@/lib/invitations/token';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { invitationTokenSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = {
  title: 'Join your school',
  description: 'Accept an invitation to join a Campus Veritas school.',
};

type Props = { params: Promise<{ token: string }> };

type Notice = { title: string; body: string; action?: { href: string; label: string } };

function Notice({ title, body, action }: Notice) {
  return (
    <>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      {action && (
        <Link href={action.href} className="btn-primary inline-flex w-full justify-center">{action.label}</Link>
      )}
    </>
  );
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const shell = (children: React.ReactNode) => (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Team invitation</p>
        {children}
      </GlassCard>
    </main>
  );

  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) {
    return shell(<Notice title="This link is not valid" body="Ask your school owner to send a new invitation." />);
  }

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from('invitations')
    .select('email, role, accepted_at, revoked_at, expires_at, institution:institutions(name, status)')
    .eq('token_hash', hashInvitationToken(parsed.data))
    .maybeSingle();

  if (!invitation || invitation.revoked_at) {
    return shell(<Notice title="This invitation is no longer active" body="It was cancelled or never existed. Ask your school owner for a new one." />);
  }

  const institution = invitation.institution as unknown as { name: string; status: string } | null;

  if (invitation.accepted_at) {
    return shell(<Notice title="Already accepted" body="This invitation has been used." action={{ href: '/login', label: 'Sign in' }} />);
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return shell(<Notice title="This invitation has expired" body="Ask your school owner to send a new one." />);
  }

  if (institution?.status !== 'active') {
    return shell(<Notice title="This school is not active" body="Contact the platform administrator." />);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const nextPath = `/invite/${parsed.data}`;

  if (!user) {
    return shell(
      <>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Join {institution?.name}</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Sign in as <span className="font-medium text-[var(--text)]">{invitation.email}</span> to accept this invitation as {invitation.role}.
        </p>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="btn-primary inline-flex w-full justify-center">
          Sign in to continue
        </Link>
      </>,
    );
  }

  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return shell(
      <Notice
        title="Wrong account"
        body={`This invitation is for ${invitation.email}. You are signed in as ${user.email ?? 'another account'}. Sign out and sign in with the invited email.`}
      />,
    );
  }

  return shell(
    <>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Join {institution?.name}</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--muted)]">
        You have been invited as <span className="font-medium text-[var(--text)]">{invitation.role}</span>.
      </p>
      <form action={acceptInvitationAction} className="space-y-4">
        <input type="hidden" name="token" value={parsed.data} />
        <SubmitButton pendingLabel="Joining…" className="w-full">Accept invitation</SubmitButton>
      </form>
    </>,
  );
}
