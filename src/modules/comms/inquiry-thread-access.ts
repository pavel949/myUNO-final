import type { Prisma, PrismaClient, Thread } from '@prisma/client';
import { can } from '@/modules/core/permissions';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { currentEngagementWhere } from '@/modules/projects/engagement-scope';

type InquiryAccessDb = PrismaClient | Prisma.TransactionClient;

const GUEST_CARE_DEPARTMENTS = ['reservations', 'front_desk', 'guest_care'];

export interface InquiryScope {
  projectId?: string | null;
  unitId?: string | null;
}

/** The intake transaction and later reads use the same current audience policy.
 * Like booking threads, a stored participant never keeps revoked authority.
 * A unit mandate does not grant an MC access to a project-wide inquiry. */
export async function getInquiryThreadRecipients(db: InquiryAccessDb, input: InquiryScope) {
  let projectId = input.projectId ?? null;
  const unitId = input.unitId ?? null;
  const participantRoles: Record<string, string> = {};
  if (unitId) {
    const unit = await db.unit.findUnique({ where: { id: unitId }, select: { projectId: true } });
    if (!unit || (projectId && projectId !== unit.projectId)) {
      return { projectId, participantIdentityIds: [], participantRoles };
    }
    projectId = unit.projectId;
  }

  const scope: Prisma.RoleAssignmentWhereInput = {
    status: 'active',
    role: { in: ['staff_ops', 'onsite_host', 'mc_member'] },
    AND: [{ OR: [
      { role: { in: ['staff_ops', 'onsite_host'] } },
      { role: 'mc_member', organization: { status: 'active' } },
    ] }],
    OR: projectId ? [
      { scopeType: 'project', projectId, unitId: null },
      ...(unitId ? [{ scopeType: 'unit' as const, projectId, unitId }] : []),
    ] : [],
  };
  const candidates = await db.identity.findMany({
    where: {
      status: 'active',
      OR: [{ isAdmin: true }, ...(projectId ? [{ roleAssignments: { some: scope } }] : [])],
    },
    include: { roleAssignments: { where: scope } },
  });

  for (const identity of candidates) {
    if (identity.isAdmin) {
      participantRoles[identity.id] = 'admin';
      continue;
    }
    if (!projectId || !identity.roleAssignments.length || !(await can({
      identity, action: 'comms:message_in_own_threads', requiredAccess: 'allow',
      resource: { projectId, ...(unitId ? { unitId } : {}) },
    }, db))) continue;

    const staff = identity.roleAssignments.find(role =>
      role.role === 'staff_ops' || role.role === 'onsite_host'
    );
    if (staff) {
      const grant = await db.projectStaffPermission.findUnique({
        where: { projectId_identityId: { projectId, identityId: identity.id } },
        select: { departments: true },
      });
      // Preserve booking-thread/projectScope's legacy fallback: a configured
      // department policy limits the scoped role, including an empty policy.
      if (!grant || grant.departments.some(department => GUEST_CARE_DEPARTMENTS.includes(department))) {
        participantRoles[identity.id] = staff.role;
        continue;
      }
    }
    if (unitId && await hasManagedUnitMcAccess({
      identityId: identity.id, email: identity.email,
      firstName: identity.firstName, lastName: identity.lastName,
      isAdmin: false, roles: identity.roleAssignments,
    }, { projectId, unitId }, db)) {
      participantRoles[identity.id] = 'mc_member';
    }
  }

  return { projectId, participantIdentityIds: Object.keys(participantRoles), participantRoles };
}

/** The opportunity is the canonical inquiry scope, never the thread's display
 * project or a claimed contact address. Legacy/unlinked threads retain only
 * their existing active admin/inquirer audience at the caller. */
export async function getInquiryThreadAudience(
  db: InquiryAccessDb,
  thread: Pick<Thread, 'id' | 'contextType' | 'contextId'>,
) {
  if (thread.contextType !== 'general' || !thread.contextId?.startsWith('lead-')) return null;
  const suffix = `:${thread.id}`;
  if (!thread.contextId.endsWith(suffix)) return null;
  const opportunityId = thread.contextId.slice('lead-'.length, -suffix.length);
  if (!opportunityId || opportunityId.includes(':')) return null;
  const opportunity = await db.crmOpportunity.findUnique({
    where: { id: opportunityId }, select: { projectId: true, unitId: true },
  });
  return opportunity ? getInquiryThreadRecipients(db, opportunity) : null;
}

/** Keep a session-authenticated submitter's personal participation when their
 * operational role changes. No CRM contact is ever enrolled by this helper. */
async function ensureInquiryParticipant(
  db: InquiryAccessDb, threadId: string, identityId: string, participantRole: string,
) {
  const participant = await db.threadParticipant.upsert({
    where: { threadId_identityId: { threadId, identityId } },
    create: { threadId, identityId, participantRole },
    update: {},
  });
  if (participant.participantRole !== 'inquirer' && participant.participantRole !== participantRole) {
    await db.threadParticipant.updateMany({
      where: { threadId, identityId, participantRole: { not: 'inquirer' } },
      data: { participantRole },
    });
  }
}

export async function materializeInquiryThreadAudience(
  db: InquiryAccessDb,
  thread: Pick<Thread, 'id' | 'contextType' | 'contextId'>,
) {
  const audience = await getInquiryThreadAudience(db, thread);
  if (audience) {
    for (const identityId of audience.participantIdentityIds) {
      await ensureInquiryParticipant(db, thread.id, identityId, audience.participantRoles[identityId]);
    }
  }
  return audience;
}

/** Discover historical inquiries after a legitimate operator handover. Candidate
 * reads are constrained by live role/mandate scope and paged without a cutoff;
 * the canonical audience is rechecked before enrolling only this identity. */
export async function synchronizeInquiryParticipant(db: InquiryAccessDb, identityId: string): Promise<void> {
  const identity = await db.identity.findFirst({
    where: { id: identityId, status: 'active' },
    include: { roleAssignments: { where: {
      status: 'active', projectId: { not: null },
      scopeType: { in: ['project', 'unit'] },
      OR: [
        { role: { in: ['staff_ops', 'onsite_host'] } },
        { role: 'mc_member', organization: { status: 'active' } },
      ],
    } } },
  });
  if (!identity) return;

  const syncThreads = async (where: Prisma.ThreadWhereInput) => {
    let cursor: string | undefined;
    for (;;) {
      const threads = await db.thread.findMany({
        where: { contextType: 'general', contextId: { startsWith: 'lead-' }, ...where, participants: { none: { identityId } }, ...(cursor ? { id: { gt: cursor } } : {}) },
        select: { id: true, contextType: true, contextId: true },
        orderBy: { id: 'asc' }, take: 100,
      });
      for (const thread of threads) {
        const audience = await getInquiryThreadAudience(db, thread);
        const participantRole = audience?.participantRoles[identityId];
        if (participantRole) await ensureInquiryParticipant(db, thread.id, identityId, participantRole);
      }
      if (threads.length < 100) return;
      cursor = threads[threads.length - 1].id;
    }
  };
  if (identity.isAdmin) {
    await syncThreads({});
    return;
  }

  const scopes: Prisma.CrmOpportunityWhereInput[] = [];
  for (const assignment of identity.roleAssignments) {
    if (!assignment.projectId || (assignment.scopeType === 'project' && assignment.unitId)) continue;
    if (assignment.scopeType === 'unit' && !assignment.unitId) continue;
    const scope: Prisma.CrmOpportunityWhereInput = {
      projectId: assignment.projectId,
      ...(assignment.scopeType === 'unit' ? { unitId: assignment.unitId } : {}),
    };
    if (assignment.role === 'mc_member') {
      if (!assignment.organizationId) continue;
      scope.unit = { engagements: { some: {
        engagementType: 'via_management_company', managementOrgId: assignment.organizationId,
        ...currentEngagementWhere(),
      } } };
    }
    scopes.push(scope);
  }
  if (!scopes.length) return;
  let cursor: string | undefined;
  for (;;) {
    const opportunities = await db.crmOpportunity.findMany({
      where: { OR: scopes }, select: { id: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (opportunities.length) {
      await syncThreads({ OR: opportunities.map(opportunity => ({
        contextId: { startsWith: `lead-${opportunity.id}:` },
      })) });
    }
    if (opportunities.length < 100) return;
    cursor = opportunities[opportunities.length - 1].id;
  }
}
