'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { StitchWorkspaceShell, type StitchWorkspaceNavItem } from './StitchShells';

/** Navigation filters retain the selected mandate; server authorization stays authoritative. */
export function McWorkspaceShell({ title, eyebrow, items, children }: {
  title: string;
  eyebrow?: string;
  items: StitchWorkspaceNavItem[];
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const contextualItems = items.map(item => {
    const [target, fragment] = item.href.split('#');
    const [path, query = ''] = target.split('?');
    if (path !== '/mc' && !path.startsWith('/mc/')) return item;
    const params = new URLSearchParams(query);
    for (const key of ['projectId', 'organizationId']) {
      const value = searchParams.get(key);
      if (value && !params.has(key)) params.set(key, value);
    }
    return { ...item, href: path + (params.size ? '?' + params.toString() : '') + (fragment ? '#' + fragment : '') };
  });
  return <StitchWorkspaceShell title={title} eyebrow={eyebrow} items={contextualItems}>{children}</StitchWorkspaceShell>;
}
