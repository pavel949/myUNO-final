'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isStitchWorkspace } from '@/lib/stitch-surface';

/** Domain layouts own their rails; public footer/tabs belong to guest journeys. */
export function ApplicationFrame({ navigation, mobileNavigation, footer, children }: {
  navigation: ReactNode;
  mobileNavigation: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const workspace = isStitchWorkspace(usePathname() || '/');
  return (
    <div className={`flex min-h-screen flex-1 flex-col ${workspace ? 'stitch-console' : 'stitch-public'}`}>
      {navigation}
      <div className={`min-w-0 flex-1 ${workspace ? '' : 'pb-56 md:pb-0'}`}>{children}</div>
      {!workspace && <>{mobileNavigation}{footer}</>}
    </div>
  );
}
