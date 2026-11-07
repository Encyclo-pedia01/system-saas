import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AppShell, type NavItem } from '@/components/shell/app-shell';
import { requireViewer, type Viewer } from '@/lib/auth/viewer';
import { signOutAction } from '@/app/actions/auth';
import { stopImpersonationAction } from './admin/actions';

const icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z" /></svg>
  ),
  checkIn: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm3.7 5.3-4.3 4.3-2-2 1-1 1 1 3.3-3.3z" /></svg>
  ),
  grading: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 3h9l3 3v11H4zM7 9h6v1.5H7zm0 3h6V14H7z" /></svg>
  ),
  platform: (
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2 2 6l8 4 8-4zM2 10l8 4 8-4-8 4-8-4zm0 4 8 4 8-4" /></svg>
  ),
};

const roleLabels: Record<string, string> = {
  owner: 'School owner',
  staff: 'Teacher',
  authority: 'Check-in officer',
};

function navigationFor(viewer: Viewer): NavItem[] {
  if (viewer.isSuperAdmin && !viewer.impersonation) {
    return [{ href: '/admin', label: 'Platform', icon: icons.platform }];
  }

  switch (viewer.effectiveRole) {
    case 'owner':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: icons.dashboard },
        { href: '/grading', label: 'Grading', icon: icons.grading },
      ];
    case 'staff':
      return [{ href: '/dashboard', label: 'Dashboard', icon: icons.dashboard }];
    case 'authority':
      return [{ href: '/check-in', label: 'Check-in', icon: icons.checkIn }];
    default:
      return [];
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
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
    navItems.push({ href: '/admin/schools/new', label: 'New school', icon: icons.platform });
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
