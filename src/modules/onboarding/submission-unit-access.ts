import type { Prisma } from '@prisma/client';
import { currentEngagementWhere } from '@/modules/projects/engagement-scope';

/** Intake can discover public units, or the applicant's exact private scope.
 * A role in one unit never grants access to every draft in its development.
 */
export function submissionUnitWhere(
  user: { identityId: string; isAdmin: boolean },
  projectId: string,
  now = new Date(),
): Prisma.UnitWhereInput {
  const base: Prisma.UnitWhereInput = { projectId, status: { not: 'offboarded' } };
  if (user.isAdmin) return base;
  return {
    ...base,
    OR: [
      { status: 'live', project: { status: 'live' } },
      {
        ownerIdentityId: user.identityId,
        roleAssignments: { some: {
          identityId: user.identityId, role: 'owner', status: 'active', scopeType: 'unit', projectId,
        } },
      },
      { engagements: { some: {
        engagementType: 'via_management_company',
        ...currentEngagementWhere(now),
        managementOrg: {
          status: 'active',
          roleAssignments: { some: {
            identityId: user.identityId, role: 'mc_member', status: 'active', scopeType: 'project', projectId,
          } },
        },
      } } },
    ],
  };
}
