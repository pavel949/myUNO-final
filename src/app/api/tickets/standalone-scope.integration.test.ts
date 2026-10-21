import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createOrganization, createProvider, createService, createProject } from '@/test/util';
import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { raiseTicket } from '@/modules/comms/ticket.service';
import { canAccessThread } from '@/modules/comms/statement-thread-access';

const auth = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';
import { loadTicketForUser } from '@/app/libs/ticketScope';
import { loadOrderForUser } from '@/app/libs/serviceOrderGuards';

async function currentUser(identityId: string): Promise<CurrentUser> {
  const person = await db.identity.findUniqueOrThrow({ where: { id: identityId }, include: {
    roleAssignments: { where: { status: 'active' } },
  } });
  return { identityId, email: person.email, firstName: person.firstName, lastName: person.lastName,
    isAdmin: person.isAdmin, roles: person.roleAssignments };
}

describe('standalone service ticket authorization', () => {
  let ordererId: string, outsiderId: string, operatorId: string, providerMemberId: string;
  let orderId: string, organizationId: string, ticketId: string, threadId: string;
  beforeEach(async () => {
    await resetDb();
    const [orderer, outsider, operator, member, organization, provider] = await Promise.all([
      createIdentity(), createIdentity(), createIdentity(), createIdentity(), createOrganization(), createProvider({ status: 'active' }),
    ]);
    ordererId = orderer.id; outsiderId = outsider.id; operatorId = operator.id;
    providerMemberId = member.id; organizationId = organization.id;
    const service = await createService({ providerId: provider.id, status: 'active' });
    const order = await db.serviceOrder.create({ data: {
      service_id: service.id, provider_id: provider.id, project_id: null,
      orderer_identity_id: orderer.id, orderer_role: 'resident',
      scheduled_start: new Date('2027-02-01T03:00:00Z'), scheduled_end: new Date('2027-02-01T04:00:00Z'),
      price_breakdown: {}, total_thb: 1000, take_rate_pct_snapshot: 10,
      service_context: { kind: 'standalone', responsibleOrganizationId: organization.id, address: 'Guest service address' },
    } });
    orderId = order.id;
    await db.roleAssignment.createMany({ data: [
      { identityId: operator.id, role: 'staff_ops', scopeType: 'platform', organizationId: organization.id },
      { identityId: member.id, role: 'provider_member', scopeType: 'platform', providerId: provider.id },
    ] });
    const ticket = await raiseTicket(db, { projectId: null, serviceOrderId: order.id,
      responsibleOrganizationId: organization.id, raisedByIdentityId: orderer.id, raisedByRole: 'resident',
      categoryKey: 'other', title: 'Service support' });
    ticketId = ticket.id; threadId = ticket.threadId;
  });

  it('permits the customer and responsible operator, but gives provider only read scope', async () => {
    expect((await loadTicketForUser(ticketId, await currentUser(ordererId))).canManage).toBe(false);
    expect((await loadTicketForUser(ticketId, await currentUser(operatorId))).canManage).toBe(true);
    expect((await loadOrderForUser(orderId, await currentUser(operatorId))).isStaff).toBe(true);
    expect((await loadTicketForUser(ticketId, await currentUser(providerMemberId))).canManage).toBe(false);
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.projectId).toBeNull(); expect(ticket.unitId).toBeNull(); expect(ticket.assigneeIdentityId).toBeNull();
  });

  it('denies foreign organization and property staff, even with persisted assignment', async () => {
    const other = await createOrganization(); const project = await createProject();
    await db.roleAssignment.createMany({ data: [
      { identityId: outsiderId, role: 'staff_ops', scopeType: 'platform', organizationId: other.id },
      { identityId: outsiderId, role: 'staff_ops', scopeType: 'project', projectId: project.id, organizationId },
    ] });
    await db.ticket.update({ where: { id: ticketId }, data: { assigneeIdentityId: outsiderId } });
    await expect(loadTicketForUser(ticketId, await currentUser(outsiderId))).rejects.toMatchObject({ statusCode: 404 });
    await expect(loadOrderForUser(orderId, await currentUser(outsiderId))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('revokes conversation access immediately when the organization role is revoked', async () => {
    expect(await canAccessThread(db, threadId, operatorId)).toBe(true);
    expect(await db.threadParticipant.findUnique({ where: { threadId_identityId: { threadId, identityId: operatorId } } })).not.toBeNull();
    await db.roleAssignment.updateMany({ where: { identityId: operatorId }, data: { status: 'revoked' } });
    expect(await canAccessThread(db, threadId, operatorId)).toBe(false);
    await expect(loadOrderForUser(orderId, await currentUser(operatorId))).rejects.toMatchObject({ statusCode: 404 });
    expect(await canAccessThread(db, threadId, ordererId)).toBe(true);
  });

  it('derives order scope on POST and refuses foreign order identifiers', async () => {
    const request = () => new NextRequest('http://localhost/api/tickets', { method: 'POST',
      body: JSON.stringify({ serviceOrderId: orderId, responsibleOrganizationId: 'forged-org', categoryKey: 'other', title: 'Need help' }),
    });
    auth.user = await currentUser(outsiderId);
    expect((await POST(request())).status).toBe(404);
    auth.user = await currentUser(ordererId);
    const result = await POST(request()); expect(result.status).toBe(201);
    const body = await result.json();
    expect(await db.ticket.findUnique({ where: { id: body.ticket.id } })).toMatchObject({
      projectId: null, serviceOrderId: orderId, responsibleOrganizationId: organizationId, raisedByIdentityId: ordererId,
    });
  });

  it('refuses null-project tickets without an owned order and matching accepted organization', async () => {
    await expect(raiseTicket(db, { projectId: null, raisedByIdentityId: ordererId, raisedByRole: 'resident',
      categoryKey: 'other', title: 'No order' })).rejects.toThrow('requires an order');
    await expect(raiseTicket(db, { projectId: null, serviceOrderId: orderId, responsibleOrganizationId: 'wrong-org',
      raisedByIdentityId: ordererId, raisedByRole: 'resident', categoryKey: 'other', title: 'Wrong org' })).rejects.toThrow('accepted order scope');
  });

  it('denies a revoked provider role while preserving customer access', async () => {
    await db.roleAssignment.updateMany({ where: { identityId: providerMemberId }, data: { status: 'revoked' } });
    await expect(loadTicketForUser(ticketId, await currentUser(providerMemberId))).rejects.toMatchObject({ statusCode: 404 });
    expect((await loadTicketForUser(ticketId, await currentUser(ordererId))).isReporter).toBe(true);
  });

  it('does not let a disabled organization retain standalone management authority', async () => {
    await db.organization.update({ where: { id: organizationId }, data: { status: 'suspended' } });
    await expect(loadTicketForUser(ticketId, await currentUser(operatorId))).rejects.toMatchObject({ statusCode: 404 });
    await expect(loadOrderForUser(orderId, await currentUser(operatorId))).rejects.toMatchObject({ statusCode: 404 });
  });
});
