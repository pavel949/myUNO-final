import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  getMCOrganizationIdsForProject,
  hasManagedUnitMcAccess,
} from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Legacy MC unit route retained only for old bookmarks and external links.
 * Canonical management now lives in Property Workspace.
 */
export default async function MCUnitCompatibilityPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/mc/units/${params.unitId}`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: { id: true, projectId: true },
  });
  if (!unit) notFound();

  if (!(await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id }))) {
    notFound();
  }

  const organizationIds = getMCOrganizationIdsForProject(user, unit.projectId);
  const engagement = await prisma.unitEngagement.findFirst({
    where: {
      unitId: unit.id,
      engagementType: 'via_management_company',
      status: 'active',
      ...(!user.isAdmin ? { managementOrgId: { in: organizationIds } } : {}),
    },
    select: { managementOrgId: true },
    orderBy: { createdAt: 'desc' },
  });

  const query = new URLSearchParams({
    projectId: unit.projectId,
    origin: 'legacy',
    tab: 'calendar',
  });
  if (engagement?.managementOrgId) {
    query.set('organizationId', engagement.managementOrgId);
  }

  redirect(`/mc/properties/${encodeURIComponent(unit.id)}?${query.toString()}`);
}
