import type { Prisma } from '@prisma/client';
import { eligibleOrganizationUnits } from '@/modules/ops/operating-space-access.service';
import { EmployeeCreationError, type EmployeeCreationKind } from './employee-creation.schema';

type Tx = Prisma.TransactionClient;
const forbidden = (): never => { throw new EmployeeCreationError(403, 'Current property creation permission and an eligible workspace are required.'); };
/** Creation is independent of legacy daily-operation roles. Even admins using
 * this employee flow need an explicit current membership and creation flag.
 * Hold the actual authority rows, so normal SQL revocations serialize against
 * an in-flight command. Call inside a Serializable transaction, never alone. */
export async function getEmployeeCreationAccessTx(tx: Tx, identityId: string, spaceId: string,
  kind?: EmployeeCreationKind, projectId?: string | null, expectedOrganizationId?: string) {
  await tx.$queryRaw`SELECT id FROM identity WHERE id = ${identityId} FOR SHARE`;
  const actor = await tx.identity.findUnique({ where: { id: identityId }, select: { id: true, status: true } });
  if (!actor || actor.status !== 'active') return forbidden();
  await tx.$queryRaw`SELECT id FROM operating_space WHERE id = ${spaceId} FOR SHARE`;
  const space = await tx.operatingSpace.findUnique({ where: { id: spaceId }, select: { id: true, name: true, organizationId: true, status: true } });
  if (!space || space.status !== 'active' || (expectedOrganizationId && space.organizationId !== expectedOrganizationId)) return forbidden();
  await tx.$queryRaw`SELECT id FROM organization WHERE id = ${space.organizationId} FOR SHARE`;
  const organization = await tx.organization.findUnique({ where: { id: space.organizationId }, select: { status: true } });
  if (!organization || organization.status !== 'active') return forbidden();
  await tx.$queryRaw`SELECT id FROM operating_space_member WHERE operating_space_id = ${spaceId} AND identity_id = ${identityId} FOR SHARE`;
  const member = await tx.operatingSpaceMember.findUnique({ where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId } }, select: { id: true, active: true, capabilities: true } });
  if (!member?.active || (kind && !member.capabilities.includes(kind === 'unit' ? 'create_unit' : 'create_complex')) ||
    (!kind && !member.capabilities.some(flag => flag === 'create_unit' || flag === 'create_complex'))) return forbidden();
  await tx.$queryRaw`SELECT id FROM operating_space_unit WHERE operating_space_id = ${spaceId} ORDER BY id FOR SHARE`;
  const now = new Date();
  const attached = await tx.operatingSpaceUnit.findMany({ where: { operatingSpaceId: spaceId, active: true, startsOn: { lte: now },
    OR: [{ endsOn: null }, { endsOn: { gt: now } }] }, select: { unitId: true } });
  if (!attached.length) return forbidden();
  const ids = attached.map(row => row.unitId).sort();
  await tx.$queryRaw`SELECT id FROM unit WHERE id = ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
  const attachedUnits = await tx.unit.findMany({ where: { id: { in: ids } }, select: { id: true, projectId: true } });
  const projectIds = [...new Set(attachedUnits.map(row => row.projectId))].sort();
  await tx.$queryRaw`SELECT id FROM project WHERE id = ANY(${projectIds}::text[]) ORDER BY id FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM unit_engagement WHERE unit_id = ANY(${ids}::text[]) AND management_org_id = ${space.organizationId} ORDER BY id FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM project_organization_role WHERE project_id = ANY(${projectIds}::text[]) AND organization_id = ${space.organizationId} ORDER BY id FOR SHARE`;
  const availableProjects = await tx.project.findMany({ where: { id: { in: projectIds }, status: { not: 'archived' } }, select: { id: true, name: true } });
  const allowedProjects = new Set(availableProjects.map(row => row.id));
  const units = (await eligibleOrganizationUnits(tx, space.organizationId, now)).filter(row => ids.includes(row.id) && allowedProjects.has(row.projectId));
  const eligibleProjects = new Set(units.map(row => row.projectId));
  if (!units.length || (kind === 'unit' && (!projectId || !eligibleProjects.has(projectId)))) return forbidden();
  if (kind === 'complex' && projectId) return forbidden();
  return { space, membershipId: member.id, units, projects: availableProjects.filter(row => eligibleProjects.has(row.id)),
    canCreateUnit: member.capabilities.includes('create_unit'), canCreateComplex: member.capabilities.includes('create_complex') };
}
