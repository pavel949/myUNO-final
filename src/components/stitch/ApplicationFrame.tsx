'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isStitchWorkspace } from '@/lib/stitch-surface';
import { useOptionalWorkspaceNavigation } from '@/components/WorkspaceNavigation';

/** Domain layouts own their rails; public footer/tabs belong to guest journeys. */
export function ApplicationFrame({ navigation, workspaceSwitcher, mobileNavigation, footer, children }: {
  navigation: ReactNode;
  workspaceSwitcher?: ReactNode;
  mobileNavigation: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathWorkspace = isStitchWorkspace(usePathname() || '/');
  const resolved = useOptionalWorkspaceNavigation();
  const workspace = pathWorkspace || !!resolved && (resolved.mode !== 'personal' || resolved.controlPlane);
  const hasTabs = !resolved?.controlPlane;
  return (
    <div className={`flex min-h-screen flex-1 flex-col workspace-navigation-frame ${workspace ? 'stitch-console' : 'stitch-public'} ${hasTabs ? 'workspace-has-tabs' : ''}`}>
      {navigation}
      {workspaceSwitcher}
      <div className={`min-w-0 flex-1 ${hasTabs ? 'workspace-content-clearance' : ''}`}>{children}</div>
      {mobileNavigation}
      {!workspace && footer}
    </div>
  );
}
