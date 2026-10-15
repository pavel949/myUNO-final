import type { PrismaClient, Prisma } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export function orderResponsibleOrganization(context: unknown): string | null {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  const value = (context as Record<string, unknown>).responsibleOrganizationId;
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function hasResponsibleOrganizationSupportAccess(db: Db, organizationId: string | null, identityId: string) {
  if (!organizationId) return false;
  const [organization, assignment] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { status: true } }),
    db.roleAssignment.findFirst({ where: {
      identityId, status: 'active', role: 'staff_ops', scopeType: 'platform', organizationId,
      projectId: null, unitId: null, providerId: null,
    }, select: { id: true } }),
  ]);
  return organization?.status === 'active' && Boolean(assignment);
}

/** No project-role fallback: standalone support follows the accepted order scope. */
export async function standaloneTicketAuthority(
  db: Db,
  ticket: { serviceOrderId: string | null; responsibleOrganizationId: string | null },
  identityId: string,
) {
  if (!ticket.serviceOrderId || !ticket.responsibleOrganizationId) return { canView: false, canManage: false };
  const order = await db.serviceOrder.findUnique({
    where: { id: ticket.serviceOrderId },
    select: { project_id: true, orderer_identity_id: true, provider_id: true, service_context: true },
  });
  if (!order || order.project_id !== null ||
    orderResponsibleOrganization(order.service_context) !== ticket.responsibleOrganizationId) {
    return { canView: false, canManage: false };
  }
  const [roles, canManage] = await Promise.all([
    db.roleAssignment.findMany({
      where: { identityId, status: 'active' },
      select: { role: true, projectId: true, unitId: true, organizationId: true, providerId: true },
    }),
    hasResponsibleOrganizationSupportAccess(db, ticket.responsibleOrganizationId, identityId),
  ]);
  const isProvider = roles.some(role => role.role === 'provider_member' && role.providerId === order.provider_id);
  return { canView: order.orderer_identity_id === identityId || canManage || isProvider, canManage };
}
