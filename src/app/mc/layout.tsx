import type { ReactNode } from 'react';
import { getLabels } from '@/lib/i18n';
import { McWorkspaceShell } from '@/components/stitch/McWorkspaceShell';

export default async function McLayout({ children }: { children: ReactNode }) {
  const labels = await getLabels({
    'mc.shell.eyebrow': 'myUNO PMS',
    'mc.shell.title': 'Property Management',
    'mc.shell.today': 'Today',
    'mc.shell.calendar': 'Calendar',
    'mc.shell.requests': 'Booking Requests',
    'mc.shell.mobilization': 'Mobilization',
    'mc.shell.tm30': 'TM30',
    'mc.shell.costs': 'Costs',
    'mc.workspace.tasks': 'Tasks',
  });

  return (
    <McWorkspaceShell
      eyebrow={labels['mc.shell.eyebrow']}
      title={labels['mc.shell.title']}
      items={[
        { href: '/mc', label: labels['mc.shell.today'] },
        { href: '/mc/calendar', label: labels['mc.shell.calendar'] },
        { href: '/mc/requests', label: labels['mc.shell.requests'] },
        { href: '/ops/tasks?mc=1', label: labels['mc.workspace.tasks'] },
        { href: '/mc/mobilization', label: labels['mc.shell.mobilization'] },
        { href: '/mc/tm30', label: labels['mc.shell.tm30'] },
        { href: '/mc/costs', label: labels['mc.shell.costs'] },
      ]}
    >
      {children}
    </McWorkspaceShell>
  );
}
