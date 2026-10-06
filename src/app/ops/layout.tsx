import type { ReactNode } from 'react';
import { getLabels } from '@/lib/i18n';
import { StitchWorkspaceShell } from '@/components/stitch/StitchShells';

export default async function OpsLayout({ children }: { children: ReactNode }) {
  const labels = await getLabels({
    'staff.shell.eyebrow': 'myUNO PMS',
    'staff.shell.title': 'Operations',
    'staff.shell.today': 'Today',
    'staff.shell.calendar': 'Calendar',
    'staff.shell.front_desk': 'Front Desk',
    'staff.shell.requests': 'Requests',
    'staff.shell.housekeeping': 'Housekeeping',
    'staff.shell.maintenance': 'Maintenance',
    'staff.shell.tasks': 'Tasks',
    'staff.shell.spaces': 'Workspaces',
  });

  return (
    <StitchWorkspaceShell
      eyebrow={labels['staff.shell.eyebrow']}
      title={labels['staff.shell.title']}
      items={[
        { href: '/ops', label: labels['staff.shell.today'] },
        { href: '/ops/calendar/board', label: labels['staff.shell.calendar'] },
        { href: '/ops/stays', label: labels['staff.shell.front_desk'] },
        { href: '/ops/requests', label: labels['staff.shell.requests'] },
        { href: '/ops/housekeeping', label: labels['staff.shell.housekeeping'] },
        { href: '/ops/maintenance', label: labels['staff.shell.maintenance'] },
        { href: '/ops/tasks', label: labels['staff.shell.tasks'] },
        { href: '/ops/spaces', label: labels['staff.shell.spaces'] },
      ]}
    >
      {children}
    </StitchWorkspaceShell>
  );
}
