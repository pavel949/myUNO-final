import { requireAdminPage } from '@/app/libs/requireAdminPage';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { eligibleOrganizationUnits } from '@/modules/ops/operating-space-access.service';
import { OPERATING_GOVERNANCE_LABELS, OPERATING_GOVERNANCE_DRAFTS } from '@/modules/content/operating-governance.seed';
import WorkspaceAccessClient from './workspace-access-client';

export const dynamic = 'force-dynamic';
export default async function WorkspaceAccessPage() {
  await requireAdminPage();
  const organizations = await prisma.organization.findMany({ where: { status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const options = await Promise.all(organizations.map(async org => ({ ...org, units: await eligibleOrganizationUnits(prisma, org.id) })));
  const spaces = await prisma.operatingSpace.findMany({ where: { status: 'active' }, select: {
    id: true, name: true, organizationId: true, updatedAt: true,
    units: { select: { unitId: true, active: true, startsOn: true, endsOn: true, unit: { select: { id: true, name: true, project: { select: { name: true } } } } } },
    members: { select: { identityId: true, active: true, capabilities: true,
      identity: { select: { firstName: true, lastName: true, email: true, status: true } },
    } },
  }, orderBy: { name: 'asc' } });
  return <WorkspaceAccessClient organizations={options} spaces={spaces.map(s => ({
    ...s, updatedAt: s.updatedAt.toISOString(),
    unitIds: s.units.filter(u => u.active).map(u => u.unitId),
    currentUnits: s.units.filter(u => u.active).map(u => u.unit),
    units: undefined,
  }))} labels={await getLabels(OPERATING_GOVERNANCE_LABELS, undefined, OPERATING_GOVERNANCE_DRAFTS)} />;
}
