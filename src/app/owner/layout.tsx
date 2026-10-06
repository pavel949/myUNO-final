import type { ReactNode } from 'react';
import { getLabels } from '@/lib/i18n';
import { StitchWorkspaceShell } from '@/components/stitch/StitchShells';

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const labels = await getLabels({
    'owner.shell.eyebrow': 'myUNO',
    'owner.shell.title': 'Owner',
    'owner.shell.home': 'My Homes',
    'owner.shell.statements': 'Statements',
  });

  return (
    <StitchWorkspaceShell
      eyebrow={labels['owner.shell.eyebrow']}
      title={labels['owner.shell.title']}
      items={[
        { href: '/owner', label: labels['owner.shell.home'] },
        { href: '/owner/statements', label: labels['owner.shell.statements'] },
      ]}
    >
      {children}
    </StitchWorkspaceShell>
  );
}
