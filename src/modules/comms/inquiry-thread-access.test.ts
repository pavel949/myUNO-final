import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient, RoleAssignment } from '@prisma/client';

// The intake policy must use its supplied transaction, not a second connection.
vi.mock('@/lib/prisma', () => ({ prisma: {
  roleAssignment: { findMany: vi.fn(() => { throw new Error('Unexpected global authorization read'); }) },
} }));

import { getInquiryThreadAudience, getInquiryThreadRecipients, synchronizeInquiryParticipant } from './inquiry-thread-access';
import { canAccessThread, getAuthorizedThreadParticipants } from './statement-thread-access';

type Actor = {
  id: string; isAdmin: boolean; status: string;
  firstName: string; lastName: string; email: string;
};
type Role = Pick<RoleAssignment, 'identityId' | 'role' | 'scopeType' | 'projectId' | 'unitId' | 'organizationId' | 'status'>;
type Engagement = {
  unitId: string; projectId: string; managementOrgId: string;
  engagementType: string; status: string; startsOn: Date | null; endsOn: Date | null;
};
let actors: Actor[];
let roles: Role[];
let departments: Record<string, string[]>;
let organizations: Record<string, string>;
let engagements: Engagement[];
let units: Record<string, { projectId: string }>;
let opportunities: Record<string, { projectId: string | null; unitId: string | null }>;
let participants: Array<{ identityId: string; participantRole: string }>;
let contextId: string;
let db: PrismaClient;

function actor(id: string, input: Partial<Actor> = {}) {
  const identity = { id, isAdmin: false, status: 'active', firstName: id, lastName: 'Fixture', email: `${id}@example.test`, ...input };
  actors.push(identity);
  return identity;
}

function role(identityId: string, input: Partial<Role> = {}) {
  const assignment: Role = {
    identityId, role: 'staff_ops', scopeType: 'project', projectId: 'project-a',
    unitId: null, organizationId: null, status: 'active', ...input,
  };
  roles.push(assignment);
  return assignment;
}

function scopeMatches(assignment: Role, scope: any): boolean {
  return assignment.status === scope.status && scope.role.in.includes(assignment.role) &&
    scope.OR.some((branch: Record<string, string | null>) =>
      Object.entries(branch).every(([field, value]) => assignment[field as keyof Role] === value)) &&
    scope.AND[0].OR.some((branch: any) =>
      typeof branch.role === 'string'
        ? assignment.role === branch.role && organizations[assignment.organizationId ?? ''] === branch.organization.status
        : branch.role.in.includes(assignment.role));
}

beforeEach(() => {
  actors = []; roles = []; departments = {}; engagements = [];
  organizations = { 'org-a': 'active', 'org-b': 'active' };
  units = { 'unit-a': { projectId: 'project-a' }, 'unit-b': { projectId: 'project-a' }, 'unit-foreign': { projectId: 'project-b' } };
  opportunities = { 'opportunity-a': { projectId: 'project-a', unitId: 'unit-a' } };
  contextId = 'lead-opportunity-a:thread-a';
  participants = [];
  db = {
    identity: {
      findFirst: vi.fn(async ({ where }: any) => {
        const identity = actors.find(candidate => candidate.id === where.id && candidate.status === where.status);
        return identity ? { ...identity, roleAssignments: roles.filter(assignment =>
          assignment.identityId === identity.id && assignment.status === 'active' && assignment.projectId &&
          ['project', 'unit'].includes(assignment.scopeType) &&
          (['staff_ops', 'onsite_host'].includes(assignment.role) ||
            assignment.role === 'mc_member' && organizations[assignment.organizationId ?? ''] === 'active')) } : null;
      }),
      findMany: vi.fn(async ({ where, include }: any) => actors
      .filter(identity => identity.status === where.status && where.OR.some((branch: any) =>
        branch.isAdmin === true ? identity.isAdmin : roles.some(assignment =>
          assignment.identityId === identity.id && scopeMatches(assignment, branch.roleAssignments.some))))
      .map(identity => ({ ...identity, roleAssignments: roles.filter(assignment =>
        assignment.identityId === identity.id && scopeMatches(assignment, include.roleAssignments.where)) }))) },
    roleAssignment: { findMany: vi.fn(async ({ where }: any) => roles.filter(assignment =>
      assignment.identityId === where.identityId && assignment.status === where.status)) },
    projectStaffPermission: { findUnique: vi.fn(async ({ where }: any) => {
      const grant = departments[where.projectId_identityId.identityId];
      return grant === undefined ? null : { departments: grant };
    }) },
    unit: { findUnique: vi.fn(async ({ where }: any) => units[where.id] ?? null) },
    unitEngagement: { findFirst: vi.fn(async ({ where }: any) => engagements.find(engagement =>
      engagement.unitId === where.unitId && engagement.projectId === where.unit.projectId &&
      engagement.engagementType === where.engagementType && engagement.status === where.status &&
      where.managementOrgId.in.includes(engagement.managementOrgId) &&
      (!engagement.startsOn || engagement.startsOn <= where.AND[0].OR[1].startsOn.lte) &&
      (!engagement.endsOn || engagement.endsOn > where.AND[1].OR[1].endsOn.gt)) ?? null) },
    crmOpportunity: {
      findMany: vi.fn(async () => Object.keys(opportunities).map(id => ({ id }))),
      findUnique: vi.fn(async ({ where }: any) => opportunities[where.id] ?? null),
    },
    thread: {
      findMany: vi.fn(async () => [{ id: 'thread-a', contextType: 'general', contextId }]),
      findUnique: vi.fn(async () => ({ id: 'thread-a', contextType: 'general', contextId })),
    },
    threadParticipant: {
      upsert: vi.fn(async ({ create }: any) => {
        let participant = participants.find(candidate => candidate.identityId === create.identityId);
        if (!participant) {
          participant = { identityId: create.identityId, participantRole: create.participantRole };
          participants.push(participant);
        }
        return participant;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const participant = participants.find(candidate => candidate.identityId === where.identityId && candidate.participantRole !== 'inquirer');
        if (participant) participant.participantRole = data.participantRole;
        return { count: participant ? 1 : 0 };
      }),
      findMany: vi.fn(async () => participants.map(participant => ({
      ...participant, threadId: 'thread-a', identity: actors.find(identity => identity.id === participant.identityId)!,
    }))) },
  } as unknown as PrismaClient;
});

describe('inquiry recipients use canonical live scope', () => {
  it('resolves all three guest-care departments, unit staff and legacy staff without a policy', async () => {
    actor('admin', { isAdmin: true });
    for (const department of ['reservations', 'front_desk', 'guest_care']) {
      actor(department); role(department); departments[department] = [department];
    }
    actor('unit-host'); role('unit-host', { role: 'onsite_host', scopeType: 'unit', unitId: 'unit-a' });
    actor('legacy'); role('legacy');
    actor('finance'); role('finance'); departments.finance = ['finance'];
    actor('empty'); role('empty'); departments.empty = [];
    actor('blocked', { isAdmin: true, status: 'blocked' });
    const audience = await getInquiryThreadRecipients(db, { projectId: 'project-a', unitId: 'unit-a' });
    expect(audience.participantRoles).toEqual({ admin: 'admin', reservations: 'staff_ops', front_desk: 'staff_ops', guest_care: 'staff_ops', 'unit-host': 'onsite_host', legacy: 'staff_ops' });
  });

  it('denies foreign projects, foreign units, revoked roles and platform staff', async () => {
    actor('admin', { isAdmin: true });
    for (const id of ['foreign-project', 'foreign-unit', 'revoked', 'platform']) actor(id);
    role('foreign-project', { projectId: 'project-b' });
    role('foreign-unit', { scopeType: 'unit', unitId: 'unit-b' });
    role('revoked', { status: 'revoked' });
    role('platform', { scopeType: 'platform', projectId: null });
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-a', unitId: 'unit-a' })).participantIdentityIds).toEqual(['admin']);
  });

  it('derives the project from the canonical unit and fails closed for a conflicting/missing unit', async () => {
    actor('staff'); role('staff');
    expect((await getInquiryThreadRecipients(db, { unitId: 'unit-a' })).participantIdentityIds).toEqual(['staff']);
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-b', unitId: 'unit-a' })).participantIdentityIds).toEqual([]);
    expect((await getInquiryThreadRecipients(db, { unitId: 'missing' })).participantIdentityIds).toEqual([]);
  });

  it('does not expand unit-only staff or MC mandates to project-wide or unscoped inquiries', async () => {
    actor('admin', { isAdmin: true }); actor('staff'); role('staff');
    actor('unit-staff'); role('unit-staff', { scopeType: 'unit', unitId: 'unit-a' });
    actor('mc'); role('mc', { role: 'mc_member', organizationId: 'org-a' });
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-a' })).participantIdentityIds).toEqual(['admin', 'staff']);
    expect((await getInquiryThreadRecipients(db, {})).participantIdentityIds).toEqual(['admin']);
    expect(db.unitEngagement.findFirst).not.toHaveBeenCalled();
  });

  it('uses the supplied transaction for canonical can() checks', async () => {
    actor('staff'); role('staff');
    const tx = db as unknown as Prisma.TransactionClient;
    expect((await getInquiryThreadRecipients(tx, { projectId: 'project-a', unitId: 'unit-a' })).participantIdentityIds).toEqual(['staff']);
    expect(db.roleAssignment.findMany).toHaveBeenCalledWith({ where: { identityId: 'staff', status: 'active' } });
  });

  it('allows only the matching active MC organization and exact current unit mandate', async () => {
    actor('mc'); role('mc', { role: 'mc_member', organizationId: 'org-a' });
    actor('other-mc'); role('other-mc', { role: 'mc_member', organizationId: 'org-b' });
    engagements.push({ unitId: 'unit-a', projectId: 'project-a', managementOrgId: 'org-a', engagementType: 'via_management_company', status: 'active', startsOn: null, endsOn: null });
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-a', unitId: 'unit-a' })).participantRoles).toEqual({ mc: 'mc_member' });
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-a', unitId: 'unit-b' })).participantIdentityIds).toEqual([]);
    organizations['org-a'] = 'suspended';
    expect((await getInquiryThreadRecipients(db, { projectId: 'project-a', unitId: 'unit-a' })).participantIdentityIds).toEqual([]);
  });

  it.each(['future', 'expired', 'ended', 'owner_direct'])('denies a %s MC mandate', async state => {
    actor('mc'); role('mc', { role: 'mc_member', organizationId: 'org-a' });
    engagements.push({ unitId: 'unit-a', projectId: 'project-a', managementOrgId: 'org-a',
      engagementType: state === 'owner_direct' ? state : 'via_management_company',
      status: state === 'ended' ? state : 'active',
      startsOn: state === 'future' ? new Date(Date.now() + 86_400_000) : null,
      endsOn: state === 'expired' ? new Date(Date.now() - 86_400_000) : null,
    });
    expect((await getInquiryThreadRecipients(db, { unitId: 'unit-a' })).participantIdentityIds).toEqual([]);
  });
});

describe('persisted inquiry participants are not permanent grants', () => {
  beforeEach(() => {
    actor('guest'); actor('admin', { isAdmin: true }); actor('staff'); role('staff');
    actor('foreign'); role('foreign', { projectId: 'project-b' });
    participants = [
      { identityId: 'guest', participantRole: 'inquirer' }, { identityId: 'admin', participantRole: 'admin' },
      { identityId: 'staff', participantRole: 'staff_ops' }, { identityId: 'foreign', participantRole: 'staff_ops' },
    ];
  });

  it('filters stored foreign managers and rechecks demotion, role revocation and identity deactivation', async () => {
    expect(await canAccessThread(db, 'thread-a', 'staff')).toBe(true);
    expect(await canAccessThread(db, 'thread-a', 'foreign')).toBe(false);
    roles.find(assignment => assignment.identityId === 'staff')!.status = 'revoked';
    actors.find(identity => identity.id === 'admin')!.isAdmin = false;
    expect(await canAccessThread(db, 'thread-a', 'staff')).toBe(false);
    expect(await canAccessThread(db, 'thread-a', 'admin')).toBe(false);
    expect(await canAccessThread(db, 'thread-a', 'guest')).toBe(true);
    actors.find(identity => identity.id === 'guest')!.status = 'blocked';
    expect(await canAccessThread(db, 'thread-a', 'guest')).toBe(false);
  });

  it('rechecks explicit department removal on a saved staff participant', async () => {
    expect(await canAccessThread(db, 'thread-a', 'staff')).toBe(true);
    departments.staff = [];
    expect(await canAccessThread(db, 'thread-a', 'staff')).toBe(false);
  });

  it('follows the opportunity scope and never the old participant role or thread display project', async () => {
    opportunities['opportunity-a'] = { projectId: 'project-b', unitId: 'unit-foreign' };
    expect(await canAccessThread(db, 'thread-a', 'staff')).toBe(false);
    expect(await canAccessThread(db, 'thread-a', 'foreign')).toBe(true);
    expect(db.crmOpportunity.findUnique).toHaveBeenCalledWith({ where: { id: 'opportunity-a' }, select: { projectId: true, unitId: true } });
  });

  it.each(['lead-thread-a', 'lead-opportunity-a:foreign-thread', 'lead-:thread-a', 'lead-missing:thread-a'])('does not grant scoped managers access from an invalid/unlinked context: %s', async context => {
    contextId = context;
    expect(await getInquiryThreadAudience(db, { id: 'thread-a', contextType: 'general', contextId })).toBeNull();
    const allowed = await getAuthorizedThreadParticipants(db, { id: 'thread-a', contextType: 'general', contextId });
    expect(allowed.map(participant => participant.identityId)).toEqual(['guest', 'admin']);
  });

  it('materializes a newly authorized replacement on direct access but never a claimed contact', async () => {
    actor('new-staff'); role('new-staff'); actor('claimed-contact');
    expect(await canAccessThread(db, 'thread-a', 'new-staff')).toBe(true);
    expect(participants).toContainEqual({ identityId: 'new-staff', participantRole: 'staff_ops' });
    expect(await canAccessThread(db, 'thread-a', 'claimed-contact')).toBe(false);
  });

  it('keeps session inquirer participation when that person also holds a scoped operator role', async () => {
    role('guest');
    await synchronizeInquiryParticipant(db, 'guest');
    expect(participants.find(participant => participant.identityId === 'guest')?.participantRole).toBe('inquirer');
    roles.find(assignment => assignment.identityId === 'guest')!.status = 'revoked';
    expect(await canAccessThread(db, 'thread-a', 'guest')).toBe(true);
  });

  it('discovers historical inquiries for only the newly authorized identity in its canonical scope', async () => {
    actor('replacement'); role('replacement');
    await synchronizeInquiryParticipant(db, 'replacement');
    expect(db.crmOpportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ projectId: 'project-a' }] } }));
    expect(db.thread.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      contextType: 'general', contextId: { startsWith: 'lead-' }, participants: { none: { identityId: 'replacement' } }, OR: [{ contextId: { startsWith: 'lead-opportunity-a:' } }],
    } }));
    expect(db.threadParticipant.upsert).toHaveBeenCalledTimes(1);
    expect(db.threadParticipant.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: {
      threadId: 'thread-a', identityId: 'replacement', participantRole: 'staff_ops',
    } }));
  });

  it('does not discover or enroll an inquirer without operational roles', async () => {
    await synchronizeInquiryParticipant(db, 'guest');
    expect(db.crmOpportunity.findMany).not.toHaveBeenCalled();
    expect(db.thread.findMany).not.toHaveBeenCalled();
    expect(db.threadParticipant.upsert).not.toHaveBeenCalled();
  });

  it('never enrolls an unrelated manager even if a stale candidate query returns the thread', async () => {
    await synchronizeInquiryParticipant(db, 'foreign');
    expect(db.crmOpportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ projectId: 'project-b' }] } }));
    expect(db.threadParticipant.upsert).not.toHaveBeenCalled();
    actors.find(identity => identity.id === 'foreign')!.status = 'blocked';
    vi.mocked(db.crmOpportunity.findMany).mockClear();
    await synchronizeInquiryParticipant(db, 'foreign');
    expect(db.crmOpportunity.findMany).not.toHaveBeenCalled();
  });

  it('continues beyond the first discovery page rather than hiding older inquiries', async () => {
    const historicalThreads = Array.from({ length: 101 }, (_, index) => ({
      id: `thread-${index}`, contextType: 'general' as const, contextId: `lead-opportunity-a:thread-${index}`,
    }));
    vi.mocked(db.thread.findMany).mockResolvedValueOnce(historicalThreads.slice(0, 100) as any)
      .mockResolvedValueOnce(historicalThreads.slice(100) as any);
    await synchronizeInquiryParticipant(db, 'admin');
    expect(db.thread.findMany).toHaveBeenCalledTimes(2);
    expect(db.thread.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { gt: 'thread-99' } }) }));
    expect(db.threadParticipant.upsert).toHaveBeenCalledTimes(101);
  });

  it('pages scoped opportunities as well as linked threads without truncating a staff inbox', async () => {
    const historicalOpportunities = Array.from({ length: 101 }, (_, index) => ({ id: `opportunity-${index}` }));
    opportunities = Object.fromEntries(historicalOpportunities.map(opportunity => [opportunity.id, { projectId: 'project-a', unitId: 'unit-a' }]));
    vi.mocked(db.crmOpportunity.findMany).mockResolvedValueOnce(historicalOpportunities.slice(0, 100) as any)
      .mockResolvedValueOnce(historicalOpportunities.slice(100) as any);
    vi.mocked(db.thread.findMany).mockImplementation(async (args: any) => {
      if (args.where.id?.gt) return [];
      return args.where.OR.map((condition: any, index: number) => {
        const id = `thread-${index}`;
        return { id, contextType: 'general', contextId: `${condition.contextId.startsWith}${id}` };
      });
    });
    await synchronizeInquiryParticipant(db, 'staff');
    expect(db.crmOpportunity.findMany).toHaveBeenCalledTimes(2);
    expect(db.crmOpportunity.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { id: 'opportunity-99' }, skip: 1 }));
    expect(db.threadParticipant.upsert).toHaveBeenCalledTimes(101);
  });
});
