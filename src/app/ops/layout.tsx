import type { ReactNode } from 'react';
import { getLabels } from '@/lib/i18n';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getStaffProjectIds } from '@/app/libs/projectScope';
import { StitchWorkspaceShell } from '@/components/stitch/StitchShells';

export default async function OpsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
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
    'staff.shell.daily_close': 'Daily Reconciliation',
    'staff.shell.spaces': 'Workspaces',
  });

  const [calendarProjects, frontDeskProjects, requestProjects, housekeepingProjects, maintenanceProjects, taskProjects, closeProjects] =
    user
      ? await Promise.all([
          getDepartmentProjectIds(user, ['reservations','front_desk','housekeeping','maintenance','guest_care','pricing']),
          getDepartmentProjectIds(user, ['reservations','front_desk']),
          getDepartmentProjectIds(user, ['reservations']),
          getDepartmentProjectIds(user, ['housekeeping']),
          getDepartmentProjectIds(user, ['maintenance']),
          getDepartmentProjectIds(user, ['housekeeping','maintenance','front_desk','guest_care']),
          getDepartmentProjectIds(user, ['finance','front_desk']),
        ])
      : [[],[],[],[],[],[],[]];

  const hasStaffScope = Boolean(user && (user.isAdmin || getStaffProjectIds(user).length));
  const items = [
    ...(hasStaffScope ? [{ href: '/ops', label: labels['staff.shell.today'] }] : []),
    ...(calendarProjects.length ? [{ href: '/ops/calendar/board', label: labels['staff.shell.calendar'] }] : []),
    ...(frontDeskProjects.length ? [{ href: '/ops/stays', label: labels['staff.shell.front_desk'] }] : []),
    ...(requestProjects.length ? [{ href: '/ops/requests', label: labels['staff.shell.requests'] }] : []),
    ...(housekeepingProjects.length ? [{ href: '/ops/housekeeping', label: labels['staff.shell.housekeeping'] }] : []),
    ...(maintenanceProjects.length ? [{ href: '/ops/maintenance', label: labels['staff.shell.maintenance'] }] : []),
    ...(taskProjects.length ? [{ href: '/ops/tasks', label: labels['staff.shell.tasks'] }] : []),
    ...(closeProjects.length ? [{ href: '/ops/night-audit', label: labels['staff.shell.daily_close'] }] : []),
    ...(hasStaffScope ? [{ href: '/ops/spaces', label: labels['staff.shell.spaces'] }] : []),
  ];

  return (
    <StitchWorkspaceShell
      eyebrow={labels['staff.shell.eyebrow']}
      title={labels['staff.shell.title']}
      items={items}
    >
      {children}
    </StitchWorkspaceShell>
  );
}
