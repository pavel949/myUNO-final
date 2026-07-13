import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface AuditLogInput {
  actorIdentityId?: string; // system actions may be null
  action: string; // e.g., 'projects:create', 'units:update'
  entityType: string; // e.g., 'Project', 'Unit'
  entityId: string;
  data?: Prisma.JsonValue; // before/after values, contextual data
}

/**
 * Log an audit event for a privileged action.
 * Used by: role grants, content/config edits, project/unit edits, statement publication, manual ledger actions.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  const { actorIdentityId, action, entityType, entityId, data } = input;

  try {
    await prisma.auditLog.create({
      data: {
        actorIdentityId: actorIdentityId || null,
        action,
        entityType,
        entityId,
        data: data as any,
        at: new Date(),
      },
    });
  } catch (error) {
    // Never fail the primary action because of audit logging failure
    console.error('Audit logging error:', error);
  }
}

/**
 * Get audit log entries filtered by entity type and ID.
 */
export async function getAuditLogForEntity(entityType: string, entityId: string) {
  return await prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { actor: true },
    orderBy: { at: 'desc' },
  });
}

/**
 * Get recent audit log entries for the admin dashboard.
 */
export async function getRecentAuditLog(limit: number = 20) {
  return await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { at: 'desc' },
    take: limit,
  });
}

/**
 * Get audit log entries filtered by actor.
 */
export async function getAuditLogByActor(actorIdentityId: string) {
  return await prisma.auditLog.findMany({
    where: { actorIdentityId },
    include: { actor: true },
    orderBy: { at: 'desc' },
  });
}
