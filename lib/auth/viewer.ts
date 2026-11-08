import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { readTemporaryPasswordState } from '@/lib/auth/temporary-password';
import { createClient } from '@/lib/supabase/server';

// school_admin is shown as Encyclopedia in the interface (DECISIONS.md, item 15).
export type AppRole = 'owner' | 'school_admin' | 'staff' | 'authority';
export type InstitutionStatus = 'active' | 'suspended';

export type InstitutionSummary = {
  id: string;
  name: string;
  slug: string;
  status: InstitutionStatus;
  timezone: string;
};

export type Viewer = {
  userId: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  role: AppRole | null;
  institution: InstitutionSummary | null;
  impersonation: { sessionId: string; expiresAt: string } | null;
  // Owner-level pages render for impersonated sessions, but writes are blocked.
  effectiveRole: AppRole | null;
  readOnly: boolean;
  // aal2 means the user signed in with a second factor (authenticator code) this session.
  assuranceLevel: 'aal1' | 'aal2';
  // True when the account already has a verified authenticator app.
  mfaEnrolled: boolean;
  // True after an administrator set a temporary password. The user must choose their own before using the app.
  mustChangePassword: boolean;
};

type MembershipRow = { role: AppRole; institution: InstitutionSummary | null };
type ImpersonationRow = { id: string; expires_at: string; institution: InstitutionSummary | null };

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.is_super_admin ?? false;
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaEnrolled = assurance?.nextLevel === 'aal2';
  const temporaryPassword = readTemporaryPasswordState(user.app_metadata);
  const base = {
    mfaEnrolled,
    mustChangePassword: temporaryPassword.mustChange,
    userId: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? '',
    isSuperAdmin,
    assuranceLevel: assurance?.currentLevel === 'aal2' ? ('aal2' as const) : ('aal1' as const),
  };

  if (isSuperAdmin) {
    const { data: session } = await supabase
      .from('impersonation_sessions')
      .select('id, expires_at, institution:institutions(id, name, slug, status, timezone)')
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const impersonating = session as unknown as ImpersonationRow | null;

    if (impersonating?.institution) {
      return {
        ...base,
        role: null,
        institution: impersonating.institution,
        impersonation: { sessionId: impersonating.id, expiresAt: impersonating.expires_at },
        effectiveRole: 'owner',
        readOnly: true,
      };
    }

    return {
      ...base,
      role: null,
      institution: null,
      impersonation: null,
      effectiveRole: null,
      readOnly: false,
    };
  }

  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, institution:institutions(id, name, slug, status, timezone)')
    .eq('user_id', user.id);

  const rows = (memberships ?? []) as unknown as MembershipRow[];
  const active = rows.find((row) => row.institution?.status === 'active') ?? rows[0] ?? null;

  return {
    ...base,
    role: active?.role ?? null,
    institution: active?.institution ?? null,
    impersonation: null,
    effectiveRole: active?.role ?? null,
    readOnly: false,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();

  if (!viewer) {
    redirect('/login');
  }

  if (viewer.mustChangePassword) {
    redirect('/set-password?forced=1');
  }

  return viewer;
}

// Blocks school pages for accounts that have no school, or whose school is suspended.
export async function requireSchoolViewer(): Promise<Viewer> {
  const viewer = await requireViewer();

  const mfaRedirect = mfaRedirectFor(viewer);
  if (mfaRedirect) {
    redirect(mfaRedirect);
  }

  if (viewer.isSuperAdmin && !viewer.impersonation) {
    redirect('/admin');
  }

  if (!viewer.institution) {
    redirect('/no-access');
  }

  if (viewer.institution.status === 'suspended' && !viewer.impersonation) {
    redirect('/suspended');
  }

  return viewer;
}

// Owners must confirm an authenticator code before they can use school pages or make changes.
// Returns where to send them, or null when they are fine to continue.
export function mfaRedirectFor(viewer: Viewer): string | null {
  if (viewer.isSuperAdmin || viewer.impersonation || viewer.role !== 'owner') {
    return null;
  }

  return viewer.assuranceLevel === 'aal2' ? null : viewer.mfaEnrolled ? '/mfa/verify' : '/mfa/setup';
}

export async function requireEffectiveRole(allowed: AppRole[]): Promise<Viewer> {
  const viewer = await requireSchoolViewer();

  if (!viewer.effectiveRole || !allowed.includes(viewer.effectiveRole)) {
    redirect('/dashboard');
  }

  return viewer;
}

// Platform pages return 404 to everyone else, so the route is not disclosed.
export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();

  if (!viewer.isSuperAdmin) {
    notFound();
  }

  return viewer;
}

// Every write action calls this before doing anything else.
export function assertWritable(viewer: Viewer): string | null {
  if (viewer.readOnly) {
    return 'Impersonation sessions are read-only.';
  }

  return null;
}
