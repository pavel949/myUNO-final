import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Execute the actual route/service/RBAC code against a deterministic in-memory
// Prisma seam. This is not a PostgreSQL integration or deployed runtime test.
const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, actor: 'guest', sequence: 0 }));
const db = vi.hoisted(() => ({} as any));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => {
    const identity = state.rows.identity.find(row => row.id === state.actor);
    return identity ? { ...identity, identityId: identity.id, roles: state.rows.roleAssignment.filter(row => row.identityId === identity.id && row.status === 'active') } : null;
  },
}));
vi.mock('@/modules/analytics', () => ({ track: vi.fn(async () => null), createDirectInquiry: vi.fn(async () => null) }));
vi.mock('@/modules/content', () => ({ t: vi.fn(async () => 'I would like to discuss selling my property.') }));

import { GET as inbox, POST as open } from './route';
import { GET as read, POST as send } from './[threadId]/route';
import { GET as stream } from './[threadId]/stream/route';
import { canAccessThread } from '@/modules/comms/statement-thread-access';
import { getUnreadCounts, markThreadRead, sendMessage } from '@/modules/comms/thread.service';
import { publishMessage, hasSubscribers } from '@/modules/comms/thread.bus';

function related(table: string, row: any, key: string): [string, any] | null {
  if (table === 'identity' && key === 'threadParticipants') return ['threadParticipant', state.rows.threadParticipant.filter(participant => participant.identityId === row.id)];
  if (table === 'identity' && key === 'roleAssignments') return ['roleAssignment', state.rows.roleAssignment.filter(role => role.identityId === row.id)];
  if (table === 'threadParticipant' && key === 'identity') return ['identity', state.rows.identity.find(identity => identity.id === row.identityId)];
  if (table === 'thread' && key === 'participants') return ['threadParticipant', state.rows.threadParticipant.filter(participant => participant.threadId === row.id)];
  if (table === 'thread' && key === 'messages') return ['message', state.rows.message.filter(message => message.threadId === row.id)];
  if ((table === 'booking' || table === 'unitEngagement') && key === 'unit') return ['unit', state.rows.unit.find(unit => unit.id === row.unitId)];
  if (table === 'message' && key === 'sender') return ['identity', state.rows.identity.find(identity => identity.id === row.senderIdentityId)];
  return null;
}
function matches(table: string, row: any, where: any = {}): boolean {
  if (!row) return false;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (condition === undefined) return true;
    if (key === 'OR') return condition.some((part: any) => matches(table, row, part));
    if (key === 'AND') return (Array.isArray(condition) ? condition : [condition]).every((part: any) => matches(table, row, part));
    if (key.includes('_') && !(key in row)) return matches(table, row, condition);
    const relation = related(table, row, key);
    if (relation) {
      const [target, values] = relation;
      if (Array.isArray(values)) {
        return (!condition.some || values.some(value => matches(target, value, condition.some))) &&
          (!condition.every || values.every(value => matches(target, value, condition.every)));
      }
      return matches(target, values, condition);
    }
    const value = row[key];
    if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
      return (!('in' in condition) || condition.in.includes(value)) &&
        (!('lte' in condition) || value <= condition.lte) &&
        (!('gt' in condition) || value > condition.gt);
    }
    return value === condition;
  });
}
function project(table: string, row: any, args: any = {}): any {
  if (!row) return null;
  const result: any = args.select ? {} : { ...row };
  for (const [key, selection] of Object.entries(args.select ?? args.include ?? {})) {
    if (!selection) continue;
    const relation = related(table, row, key);
    if (!relation) { result[key] = row[key]; continue; }
    const [target, value] = relation;
    const options: any = selection === true ? {} : selection;
    result[key] = Array.isArray(value) ? query(target, value, options) : project(target, value, options);
  }
  return result;
}
function query(table: string, rows: any[], args: any = {}): any[] {
  let result = rows.filter(row => matches(table, row, args.where));
  if (args.orderBy) {
    const [key, direction] = Object.entries(args.orderBy)[0];
    result = [...result].sort((a, b) => ((a[key] ?? 0) > (b[key] ?? 0) ? 1 : -1) * (direction === 'desc' ? -1 : 1));
  }
  if (args.skip) result = result.slice(args.skip);
  if (args.take) result = result.slice(0, args.take);
  return result.map(row => project(table, row, args));
}
function request(body?: unknown) {
  return new NextRequest('http://localhost/api/threads', body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function identity(id: string, isAdmin = false) {
  state.rows.identity.push({ id, firstName: id, lastName: 'Test', email: `${id}@example.test`, status: 'active', isAdmin });
}
function role(identityId: string, roleName = 'staff_ops', projectId = 'project-a', unitId: string | null = null, organizationId: string | null = null) {
  state.rows.roleAssignment.push({ id: `role-${identityId}`, identityId, role: roleName, projectId, unitId, organizationId, providerId: null, scopeType: unitId ? 'unit' : 'project', status: 'active' });
}
function addParticipant(threadId: string, identityId: string, participantRole = 'staff_ops') {
  state.rows.threadParticipant.push({ id: `participant-${++state.sequence}`, threadId, identityId, participantRole, lastReadAt: null });
}
async function openBooking() {
  state.actor = 'guest';
  const response = await open(request({ contextType: 'booking', contextId: 'booking-a', body: 'Private guest message' }));
  expect(response.status).toBe(201);
  return (await response.json()).threadId as string;
}

beforeEach(() => {
  state.rows = Object.fromEntries(['identity', 'roleAssignment', 'booking', 'unit', 'unitEngagement', 'projectStaffPermission', 'thread', 'threadParticipant', 'message', 'ticket'].map(table => [table, []]));
  state.actor = 'guest';
  state.sequence = 0;
  for (const table of Object.keys(state.rows)) {
    db[table] = {
      findMany: vi.fn(async (args: any = {}) => query(table, state.rows[table], args)),
      findUnique: vi.fn(async (args: any) => query(table, state.rows[table], args)[0] ?? null),
      findUniqueOrThrow: vi.fn(async (args: any) => { const row = query(table, state.rows[table], args)[0]; if (!row) throw new Error('not found'); return row; }),
      findFirst: vi.fn(async (args: any) => query(table, state.rows[table], args)[0] ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `${table}-${++state.sequence}`, createdAt: new Date(), contextId: null, lastMessageAt: null, lastReadAt: null, ...data };
        state.rows[table].push(row); return { ...row };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.rows[table].find(candidate => matches(table, candidate, where));
        if (!row) throw new Error('not found'); Object.assign(row, data); return { ...row };
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.rows[table].find(candidate => matches(table, candidate, where));
        return row ? db[table].update({ where, data: update }) : db[table].create({ data: create });
      }),
    };
  }
  db.$executeRaw = vi.fn(async () => 1);
  db.$transaction = vi.fn(async (callback: any) => callback(db));
  for (const id of ['guest', 'other-guest', 'owner', 'new-owner', 'staff-a', 'staff-b', 'unit-a-staff', 'sibling-staff', 'host', 'mc', 'other-mc', 'finance', 'revoked', 'blocked', 'admin']) identity(id, id === 'admin');
  state.rows.identity.find(row => row.id === 'blocked').status = 'blocked';
  role('staff-a'); role('staff-b', 'staff_ops', 'project-b');
  role('unit-a-staff', 'staff_ops', 'project-a', 'unit-a');
  role('sibling-staff', 'staff_ops', 'project-a', 'unit-b');
  role('host', 'onsite_host'); role('mc', 'mc_member', 'project-a', null, 'mc-org');
  role('other-mc', 'mc_member', 'project-a', null, 'other-org');
  role('finance'); role('revoked'); role('blocked');
  state.rows.roleAssignment.find(row => row.identityId === 'revoked').status = 'revoked';
  state.rows.projectStaffPermission.push({ projectId: 'project-a', identityId: 'finance', departments: ['finance'] });
  state.rows.unit.push({ id: 'unit-a', projectId: 'project-a', ownerIdentityId: 'owner' });
  state.rows.booking.push({ id: 'booking-a', projectId: 'project-a', unitId: 'unit-a', guestIdentityId: 'guest' });
  state.rows.unitEngagement.push({ id: 'engagement', unitId: 'unit-a', ownerIdentityId: 'owner', managementOrgId: 'mc-org', engagementType: 'via_management_company', status: 'active', startsOn: null, endsOn: null });
});

describe('booking conversation scope, real route/service/RBAC execution', () => {
  it('enrolls only responsible project/unit staff, host, engaged MC, guest and active admin', async () => {
    const threadId = await openBooking();
    expect(state.rows.threadParticipant.filter(row => row.threadId === threadId).map(row => row.identityId).sort())
      .toEqual(['admin', 'guest', 'host', 'mc', 'staff-a', 'unit-a-staff'].sort());
    expect(db.$executeRaw).toHaveBeenCalled();
  });

  it('does not let another guest open the booking conversation', async () => {
    state.actor = 'other-guest';
    const response = await open(request({ contextType: 'booking', contextId: 'booking-a', body: 'Intrusion' }));
    expect(response.status).toBe(404);
    expect(state.rows.thread).toHaveLength(0);
  });

  it('denies old Project B membership on inbox, unread, read, send, mark-read and SSE', async () => {
    const threadId = await openBooking();
    addParticipant(threadId, 'staff-b');
    state.actor = 'staff-b';
    expect((await (await inbox()).json()).threads).toEqual([]);
    expect(await getUnreadCounts(db, 'staff-b')).toEqual({});
    expect((await read(request(), { params: { threadId } })).status).toBe(404);
    expect((await send(request({ body: 'Intrusion' }), { params: { threadId } })).status).toBe(404);
    expect((await stream(request(), { params: { threadId } })).status).toBe(404);
    expect(await sendMessage(db, { threadId, senderIdentityId: 'staff-b', body: 'Direct service intrusion' })).toBeNull();
    await expect(markThreadRead(db, threadId, 'staff-b')).rejects.toThrow('participant');
    expect(state.rows.message).toHaveLength(1);
  });

  it.each(['staff-a', 'unit-a-staff', 'host', 'mc', 'admin', 'guest'])('preserves %s list/read/send access', async actor => {
    const threadId = await openBooking();
    state.actor = actor;
    expect((await (await inbox()).json()).threads.map((row: any) => row.id)).toEqual([threadId]);
    expect((await read(request(), { params: { threadId } })).status).toBe(200);
    expect((await send(request({ body: 'Authorized response' }), { params: { threadId } })).status).toBe(201);
  });

  it('removes stale staff from participant displays and denies access after role revocation', async () => {
    const threadId = await openBooking();
    state.rows.roleAssignment.find(row => row.identityId === 'staff-a').status = 'revoked';
    state.actor = 'staff-a';
    expect((await read(request(), { params: { threadId } })).status).toBe(404);
    expect((await (await inbox()).json()).threads).toEqual([]);
    state.actor = 'guest';
    const detail = await (await read(request(), { params: { threadId } })).json();
    expect(detail.thread.participants.map((row: any) => row.identityId)).not.toContain('staff-a');
  });

  it.each(['mandate', 'department', 'identity', 'admin'])('revalidates %s changes without rewriting historical participants', async change => {
    const threadId = await openBooking();
    let actor = 'mc';
    if (change === 'mandate') state.rows.unitEngagement[0].endsOn = new Date(Date.now() - 1);
    if (change === 'department') { actor = 'staff-a'; state.rows.projectStaffPermission.push({ projectId: 'project-a', identityId: actor, departments: ['housekeeping'] }); }
    if (change === 'identity') { actor = 'staff-a'; state.rows.identity.find(row => row.id === actor).status = 'blocked'; }
    if (change === 'admin') { actor = 'admin'; state.rows.identity.find(row => row.id === actor).isAdmin = false; }
    expect(state.rows.threadParticipant.some(row => row.identityId === actor)).toBe(true);
    expect(await canAccessThread(db, threadId, actor)).toBe(false);
  });

  it('delivers authorized SSE events, then closes without disclosing a post-revocation message', async () => {
    const threadId = await openBooking();
    state.actor = 'staff-a';
    const response = await stream(request(), { params: { threadId } });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    await reader.read(); // heartbeat
    publishMessage(threadId, { body: 'Before revocation' });
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('Before revocation');
    state.rows.roleAssignment.find(row => row.identityId === 'staff-a').status = 'revoked';
    publishMessage(threadId, { body: 'Private after revocation' });
    expect(await reader.read()).toEqual({ value: undefined, done: true });
    expect(hasSubscribers(threadId)).toBe(false);
  });

  it('fails an open SSE stream closed when authorization lookup fails', async () => {
    const threadId = await openBooking();
    const response = await stream(request(), { params: { threadId } });
    const reader = response.body!.getReader(); await reader.read();
    db.thread.findUnique.mockRejectedValueOnce(new Error('database unavailable'));
    publishMessage(threadId, { body: 'Must not leak' });
    expect((await reader.read()).done).toBe(true);
    expect(hasSubscribers(threadId)).toBe(false);
  });

  it('adds a newly responsible team member on reopen without resetting read receipts', async () => {
    const threadId = await openBooking();
    const lastReadAt = new Date();
    state.rows.threadParticipant.find(row => row.identityId === 'guest').lastReadAt = lastReadAt;
    identity('new-host'); role('new-host', 'onsite_host');
    expect(await openBooking()).toBe(threadId);
    expect(state.rows.threadParticipant.filter(row => row.identityId === 'new-host')).toHaveLength(1);
    expect(state.rows.threadParticipant.find(row => row.identityId === 'guest').lastReadAt).toEqual(lastReadAt);
  });

  it('includes the owner only while an owner-direct hosting mandate is current', async () => {
    state.rows.unitEngagement[0].engagementType = 'owner_direct';
    const threadId = await openBooking();
    expect(await canAccessThread(db, threadId, 'owner')).toBe(true);
    state.rows.unitEngagement[0].status = 'ended';
    expect(await canAccessThread(db, threadId, 'owner')).toBe(false);
  });

  it('fails closed for a deleted booking even with a persisted participant', async () => {
    const threadId = await openBooking();
    state.rows.booking = [];
    expect(await canAccessThread(db, threadId, 'guest')).toBe(false);
  });
});

