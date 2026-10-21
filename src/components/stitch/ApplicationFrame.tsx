'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isStitchWorkspace } from '@/lib/stitch-surface';
import { useOptionalWorkspaceNavigation } from '@/components/WorkspaceNavigation';

/**
 * Gives the streamed page payload its own fiber instead of leaving it as a direct DOM child.
 * React 19.2 (bundled with Next 15.5) can report a false hydration error #418 on an identical
 * tree when a lazy Flight node sits directly under a host element during time-sliced hydration
 * (react/react#37584, fixed in React 19.3.0, not backported). Remove once Next ships React >= 19.3.
 */
function ContentSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

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
      <div className={`min-w-0 flex-1 ${hasTabs ? 'workspace-content-clearance' : ''}`}><ContentSlot>{children}</ContentSlot></div>
      {mobileNavigation}
      {!workspace && footer}
    </div>
  );
}
