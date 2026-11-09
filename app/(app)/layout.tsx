import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AppShell, type NavItem } from '@/components/shell/app-shell';
import { mfaRedirectFor, requireViewer, type Viewer } from '@/lib/auth/viewer';
import { signOutAction } from '@/app/actions/auth';
import { stopImpersonationAction } from './admin/actions';


const roleLabels: Record<string, string> = {
  owner: 'School owner',
  school_admin: 'Encyclopedia',
  staff: 'Teacher',
  authority: 'Check-in officer',
};

function navigationFor(viewer: Viewer): NavItem[] {
  if (viewer.isSuperAdmin && !viewer.impersonation) {
    return [
      { href: '/admin', label: 'Schools', icon: 'shield' },
      { href: '/admin/users', label: 'Users', icon: 'shield' },
    ];
  }

  switch (viewer.effectiveRole) {
    case 'owner':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: 'home', primary: true },
        { href: '/students', label: 'Students', icon: 'users' },
        { href: '/classes', label: 'Classes', icon: 'classes', primary: true },
        { href: '/scores', label: 'Scores', icon: 'scores', primary: true },
        { href: '/attendance', label: 'Attendance', icon: 'attendance' },
        { href: '/fees', label: 'Fees', icon: 'fees' },
        { href: '/grading', label: 'Grading', icon: 'sliders' },
        { href: '/report-cards', label: 'Report cards', icon: 'report', primary: true },
        { href: '/team', label: 'Team', icon: 'team' },
        { href: '/backup', label: 'Backup', icon: 'backup' },
      ];
    case 'school_admin':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: 'home', primary: true },
        { href: '/students', label: 'Students', icon: 'users' },
        { href: '/classes', label: 'Classes', icon: 'classes', primary: true },
        { href: '/scores', label: 'Scores', icon: 'scores', primary: true },
        { href: '/fees', label: 'Fees', icon: 'fees' },
        { href: '/report-cards', label: 'Report cards', icon: 'report', primary: true },
        { href: '/team', label: 'Team', icon: 'team' },
      ];
    case 'staff':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: 'home', primary: true },
        { href: '/classes', label: 'Classes', icon: 'classes', primary: true },
        { href: '/scores', label: 'Scores', icon: 'scores', primary: true },
        { href: '/report-cards', label: 'Report cards', icon: 'report', primary: true },
        { href: '/attendance', label: 'Attendance', icon: 'attendance' },
        { href: '/students', label: 'Students', icon: 'users' },
      ];
    case 'authority':
      return [];
    default:
      return [];
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();

  const mfaRedirect = mfaRedirectFor(viewer);
  if (mfaRedirect) {
    redirect(mfaRedirect);
  }
  const isPlatformView = viewer.isSuperAdmin && !viewer.impersonation;

  if (!isPlatformView) {
    if (!viewer.institution) {
      redirect('/no-access');
    }

    if (viewer.institution.status === 'suspended' && !viewer.impersonation) {
      redirect('/suspended');
    }
  }

  const navItems = navigationFor(viewer);

  if (isPlatformView) {
    navItems.push({ href: '/admin/schools/new', label: 'New school', icon: 'plus' });
  }

  return (
    <AppShell
      navItems={navItems}
      userName={viewer.fullName || viewer.email}
      roleLabel={isPlatformView ? 'Platform administrator' : roleLabels[viewer.role ?? ''] ?? 'Member'}
      schoolName={viewer.institution?.name ?? null}
      impersonation={
        viewer.impersonation && viewer.institution
          ? {
              schoolName: viewer.institution.name,
              expiresAt: viewer.impersonation.expiresAt,
              stopAction: stopImpersonationAction,
            }
          : null
      }
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
