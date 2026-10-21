import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createRoleAssignment } from '@/test/util';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/modules/comms/comms.service', async importOriginal => ({
  ...await importOriginal<typeof import('@/modules/comms/comms.service')>(),
  createNotification: vi.fn().mockResolvedValue('isolated-notification'),
}));

import { POST as submitInquiry } from './route';
import { GET as inbox } from '@/app/api/threads/route';
import { GET as readThread, POST as reply } from '@/app/api/threads/[threadId]/route';
import { GET as readStream } from '@/app/api/threads/[threadId]/stream/route';
import { GET as readOpportunity } from '@/app/api/crm/opportunities/[id]/route';
import { createNotification } from '@/modules/comms/comms.service';
import { markThreadRead, getUnreadCounts } from '@/modules/comms/thread.service';
import { withdrawConsent, getConsentStatus } from '@/modules/crm/consent.service';

let requestNumber = 0;
function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `inquiry-fixture-${++requestNumber}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function signIn(identityId: string | null) {
  if (!identityId) { getCurrentUserMock.mockResolvedValue(null); return; }
  const identity = await db.identity.findUniqueOrThrow({ where: { id: identityId }, include: { roleAssignments: true } });
  getCurrentUserMock.mockResolvedValue({
    identityId, email: identity.email, firstName: identity.firstName, lastName: identity.lastName,
    isAdmin: identity.isAdmin, roles: identity.roleAssignments,
  });
}
async function fixture() {
  const admin = await createIdentity({ isAdmin: true, email: 'inquiry-admin@example.test' });
  const guest = await createIdentity({ email: 'inquiry-guest@example.test' });
  const otherGuest = await createIdentity({ email: 'unrelated-guest@example.test' });
  const project = await createProject({ name: 'Inquiry Residence', status: 'live' });
  const otherProject = await createProject({ name: 'Foreign Residence', status: 'live' });
  const manager = await createIdentity({ email: 'foreign-manager@example.test' });
  await createRoleAssignment({ identityId: manager.id, role: 'staff_ops', scopeType: 'project', projectId: otherProject.id });
  const unit = await createUnit({ projectId: project.id, name: 'Inquiry Villa', status: 'live' });
  const payload = { audience: 'renters', name: 'Guest Example', contact: guest.email, message: 'Is a late arrival possible?', consent: true, projectId: project.id, unitId: unit.id };
  return { admin, guest, otherGuest, project, otherProject, manager, unit, payload };
}

describe('public villa inquiry → canonical CRM/thread → admin reply → guest read', () => {
  beforeEach(async () => {
    await resetDb();
    getCurrentUserMock.mockReset();
    vi.mocked(createNotification).mockClear();
    await signIn(null);
  });

  it('completes every real handler and preserves the canonical identity, unit and conversation link', async () => {
    const f = await fixture();
    await signIn(f.guest.id);
    const response = await submitInquiry(request('/api/leads', f.payload));
    expect(response.status).toBe(200);
    const { threadId } = await response.json();
    expect(threadId).toEqual(expect.any(String));
    const opportunity = await db.crmOpportunity.findFirstOrThrow({ where: { identityId: f.guest.id } });
    expect(opportunity).toMatchObject({ unitId: f.unit.id, projectId: f.project.id, type: 'rental', stage: 'new' });
    expect(await db.crmOpportunity.count()).toBe(1);
    expect(await db.thread.count()).toBe(1);
    const activity = await db.crmActivity.findFirstOrThrow({ where: { opportunityId: opportunity.id } });
    expect(activity.channelReference).toBe(`thread:${threadId}`);
    const persistedThread = await db.thread.findUniqueOrThrow({ where: { id: threadId }, include: { participants: true } });
    expect(persistedThread.contextId).toBe(`lead-${opportunity.id}:${threadId}`);
    expect(persistedThread.projectId).toBe(f.project.id);
    expect(persistedThread.participants.map(p => p.identityId).sort()).toEqual([f.guest.id, f.admin.id].sort());
    expect(await db.crmConsent.count({ where: { identityId: f.guest.id, purpose: 'service', status: 'granted' } })).toBe(1);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1);

    await signIn(f.admin.id);
    const operatorInbox = await inbox();
    expect((await operatorInbox.json()).threads.map((t: { id: string }) => t.id)).toContain(threadId);
    const crmResponse = await readOpportunity(request(`/api/crm/opportunities/${opportunity.id}`), { params: { id: opportunity.id } });
    expect(crmResponse.status).toBe(200);
    expect((await crmResponse.json()).activities[0].channelReference).toBe(`thread:${threadId}`);
    const operatorRead = await readThread(request(`/api/threads/${threadId}`), { params: { threadId } });
    expect(operatorRead.status).toBe(200);
    const opening = (await operatorRead.json()).thread.messages[0].body;
    expect(opening).toContain('Inquiry Villa');
    expect(opening).toContain(f.payload.message);
    expect(opening).not.toContain(f.unit.id);
    const replyResponse = await reply(request(`/api/threads/${threadId}`, { body: 'Yes. Please send your arrival time here.' }), { params: { threadId } });
    expect(replyResponse.status).toBe(201);

    await signIn(f.guest.id);
    const guestInbox = await inbox();
    expect((await guestInbox.json()).threads.map((t: { id: string }) => t.id)).toContain(threadId);
    const guestRead = await readThread(request(`/api/threads/${threadId}`), { params: { threadId } });
    expect(guestRead.status).toBe(200);
    const guestThread = (await guestRead.json()).thread;
    expect(guestThread.participants).toHaveLength(2);
    expect(guestThread.messages.at(-1).sender).toEqual({ id: f.admin.id, firstName: f.admin.firstName, lastName: f.admin.lastName });
    for (const participant of guestThread.participants) {
      expect(Object.keys(participant.identity).sort()).toEqual(['firstName', 'id', 'lastName']);
    }
    const messages = guestThread.messages;
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ sender: { id: f.admin.id }, body: 'Yes. Please send your arrival time here.' });
    expect((await db.threadParticipant.findUniqueOrThrow({ where: { threadId_identityId: { threadId, identityId: f.guest.id } } })).lastReadAt).not.toBeNull();
    expect((await reply(request(`/api/threads/${threadId}`, { body: 'We arrive at 21:00.' }), { params: { threadId } })).status).toBe(201);
    expect(await db.message.count({ where: { threadId } })).toBe(3);
  });

  it('denies a third guest and a foreign manager across inbox, CRM, read, write and stream handlers', async () => {
    const f = await fixture();
    await signIn(f.guest.id);
    const { threadId } = await (await submitInquiry(request('/api/leads', f.payload))).json();
    const opportunity = await db.crmOpportunity.findFirstOrThrow();
    for (const outsider of [f.otherGuest, f.manager]) {
      await signIn(outsider.id);
      expect((await (await inbox()).json()).threads).toEqual([]);
      expect((await readThread(request(`/api/threads/${threadId}`), { params: { threadId } })).status).toBe(404);
      expect((await reply(request(`/api/threads/${threadId}`, { body: 'Unauthorized reply' }), { params: { threadId } })).status).toBe(404);
      expect((await readStream(request(`/api/threads/${threadId}/stream`), { params: { threadId } })).status).toBe(404);
      expect((await readOpportunity(request(`/api/crm/opportunities/${opportunity.id}`), { params: { id: opportunity.id } })).status).toBe(403);
    }
    expect(await db.message.count({ where: { threadId } })).toBe(1);
  });

  it('uses session identity even when the submitted email belongs to another account', async () => {
    const f = await fixture();
    await signIn(f.guest.id);
    const response = await submitInquiry(request('/api/leads', { ...f.payload, contact: f.otherGuest.email, authenticatedIdentityId: f.otherGuest.id }));
    const { threadId } = await response.json();
    expect(response.status).toBe(200);
    expect((await db.crmOpportunity.findFirstOrThrow()).identityId).toBe(f.guest.id);
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.guest.id } })).email).toBe(f.guest.email);
    expect(await db.threadParticipant.count({ where: { threadId, identityId: f.otherGuest.id } })).toBe(0);
    await signIn(f.otherGuest.id);
    expect((await readThread(request(`/api/threads/${threadId}`), { params: { threadId } })).status).toBe(404);
  });

  it('keeps anonymous capture canonical but never grants access by claimed email or request-body identity', async () => {
    const f = await fixture();
    await withdrawConsent(db, { identityId: f.guest.id, purpose: 'service', channel: 'account' });
    const response = await submitInquiry(request('/api/leads', { ...f.payload, authenticatedIdentityId: f.guest.id }));
    expect(await response.json()).toEqual({ ok: true });
    const thread = await db.thread.findFirstOrThrow();
    expect(await db.crmOpportunity.count()).toBe(1);
    const opportunity = await db.crmOpportunity.findFirstOrThrow();
    expect(opportunity.identityId).not.toBe(f.guest.id);
    expect(opportunity.requirements).toMatchObject({
      identityMatchState: 'unverified_contact', inquiryContact: { value: f.guest.email, verified: false },
    });
    expect(await db.crmProfile.count({ where: { identityId: f.guest.id } })).toBe(0);
    expect(await db.crmActivity.count({ where: { identityId: f.guest.id } })).toBe(0);
    expect(await db.crmAttributionTouch.count({ where: { identityId: f.guest.id } })).toBe(0);
    expect(await getConsentStatus(db, f.guest.id, 'service')).toBe('withdrawn');
    expect(await db.crmConsent.count({ where: { identityId: f.guest.id } })).toBe(1);
    expect(await db.threadParticipant.count({ where: { threadId: thread.id, identityId: f.guest.id } })).toBe(0);
    expect((await readThread(request(`/api/threads/${thread.id}`), { params: { threadId: thread.id } })).status).toBe(401);
    await signIn(f.guest.id);
    expect((await readThread(request(`/api/threads/${thread.id}`), { params: { threadId: thread.id } })).status).toBe(404);
  });

  it('rolls back thread, participants, message, new identity and CRM when real CRM persistence fails', async () => {
    await createIdentity({ isAdmin: true });
    const identitiesBefore = await db.identity.count();
    const response = await submitInquiry(request('/api/leads', {
      audience: 'renters', name: 'Rollback Fixture', contact: 'rollback@example.test', consent: true,
      // A real FK failure inside ensureCrmProfile, after the thread write.
      referrerIdentityId: crypto.randomUUID(),
    }));
    expect(response.status).toBe(500);
    for (const count of [await db.thread.count(), await db.threadParticipant.count(), await db.message.count(), await db.crmProfile.count(), await db.crmOpportunity.count(), await db.crmActivity.count()]) expect(count).toBe(0);
    expect(await db.identity.count()).toBe(identitiesBefore);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
  });

  it('rejects a private villa or mismatched project before either canonical record exists', async () => {
    const f = await fixture();
    const privateUnit = await createUnit({ projectId: f.project.id, name: 'Private draft' });
    await signIn(f.guest.id);
    for (const body of [{ ...f.payload, unitId: privateUnit.id }, { ...f.payload, projectId: f.otherProject.id }]) {
      expect((await submitInquiry(request('/api/leads', body))).status).toBe(400);
    }
    expect(await db.thread.count()).toBe(0);
    expect(await db.crmOpportunity.count()).toBe(0);
  });

  it('removes a demoted or blocked admin from inquiry reads, replies, unread counts and streams', async () => {
    const f = await fixture();
    const blockedAdmin = await createIdentity({ isAdmin: true, status: 'blocked' });
    await signIn(f.guest.id);
    const { threadId } = await (await submitInquiry(request('/api/leads', f.payload))).json();
    expect(await db.threadParticipant.count({ where: { threadId, identityId: blockedAdmin.id } })).toBe(0);
    await signIn(f.admin.id);
    await db.identity.update({ where: { id: f.admin.id }, data: { isAdmin: false } });
    expect((await (await inbox()).json()).threads).toEqual([]);
    expect((await readThread(request(`/api/threads/${threadId}`), { params: { threadId } })).status).toBe(404);
    expect((await reply(request(`/api/threads/${threadId}`, { body: 'Stale admin' }), { params: { threadId } })).status).toBe(404);
    expect((await readStream(request(`/api/threads/${threadId}/stream`), { params: { threadId } })).status).toBe(404);
    expect(await db.message.count({ where: { threadId } })).toBe(1);
  });
});

describe('inquiry retry and scoped operator acceptance', () => {
  beforeEach(async () => {
    await resetDb();
    getCurrentUserMock.mockReset();
    vi.mocked(createNotification).mockClear();
    await signIn(null);
  });

  it('deduplicates concurrent retries and rejects changed payloads under the same request ID', async () => {
    const f = await fixture();
    await signIn(f.guest.id);
    const payload = { ...f.payload, requestId: 'inquiry-retry-fixture-001' };
    const responses = await Promise.all([submitInquiry(request('/api/leads', payload)), submitInquiry(request('/api/leads', payload))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map(r => r.json()));
    expect(bodies[0].threadId).toBe(bodies[1].threadId);
    expect(await db.thread.count()).toBe(1);
    expect(await db.crmOpportunity.count()).toBe(1);
    expect(await db.message.count()).toBe(1);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1);
    const changed = await submitInquiry(request('/api/leads', { ...payload, message: 'A different request' }));
    expect(changed.status).toBe(409);
    expect(await db.thread.count()).toBe(1);
  });

  it('lets only the scoped guest-care manager reply, shows guest unread state and prevents duplicate replies', async () => {
    const f = await fixture();
    const manager = await createIdentity({ email: 'local-manager@example.test' });
    await createRoleAssignment({ identityId: manager.id, role: 'staff_ops', scopeType: 'project', projectId: f.project.id });
    await db.projectStaffPermission.create({ data: { projectId: f.project.id, identityId: manager.id, departments: ['guest_care'] } });
    await signIn(f.guest.id);
    const submitted = await submitInquiry(request('/api/leads', { ...f.payload, requestId: 'scoped-guest-inquiry-001' }));
    expect(submitted.status).toBe(200);
    const { threadId } = await submitted.json();
    await readThread(request(`/api/threads/${threadId}`), { params: { threadId } });
    await signIn(manager.id);
    expect((await (await inbox()).json()).threads.map((t: { id: string }) => t.id)).toContain(threadId);
    const payload = { body: 'Your late arrival is possible. Please share the time here.', requestId: 'manager-reply-fixture-001' };
    const replies = await Promise.all([reply(request(`/api/threads/${threadId}`, payload), { params: { threadId } }), reply(request(`/api/threads/${threadId}`, payload), { params: { threadId } })]);
    expect(replies.map(r => r.status)).toEqual([201, 201]);
    expect(await db.message.count({ where: { threadId } })).toBe(2);
    const conflict = await reply(request(`/api/threads/${threadId}`, { ...payload, body: 'Changed reply' }), { params: { threadId } });
    expect(conflict.status).toBe(409);
    await signIn(f.guest.id);
    expect((await (await inbox()).json()).threads.find((t: { id: string }) => t.id === threadId).unreadCount).toBe(1);
    const received = await readThread(request(`/api/threads/${threadId}`), { params: { threadId } });
    expect((await received.json()).thread.messages.at(-1).body).toBe(payload.body);
    expect((await (await inbox()).json()).threads.find((t: { id: string }) => t.id === threadId).unreadCount).toBe(0);
    await db.projectStaffPermission.update({ where: { projectId_identityId: { projectId: f.project.id, identityId: manager.id } }, data: { departments: ['housekeeping'] } });
    await signIn(manager.id);
    expect((await (await inbox()).json()).threads).toEqual([]);
    expect((await reply(request(`/api/threads/${threadId}`, { body: 'No longer authorized' }), { params: { threadId } })).status).toBe(404);
    expect(await db.message.count({ where: { threadId } })).toBe(2);
    const replacement = await createIdentity({ email: 'replacement-manager@example.test' });
    await createRoleAssignment({ identityId: replacement.id, role: 'staff_ops', scopeType: 'project', projectId: f.project.id });
    await signIn(replacement.id);
    expect((await (await inbox()).json()).threads.map((t: { id: string }) => t.id)).toContain(threadId);
    expect((await reply(request(`/api/threads/${threadId}`, { body: 'I will continue helping you here.' }), { params: { threadId } })).status).toBe(201);
    expect(await db.threadParticipant.count({ where: { threadId, identityId: f.manager.id } })).toBe(0);
  });
});


describe('reply read acknowledgement watermark', () => {
  beforeEach(async () => { await resetDb(); getCurrentUserMock.mockReset(); await signIn(null); });
  it('keeps replies newer than the returned snapshot unread and cannot rewind an acknowledgement', async () => {
    const f = await fixture();
    await signIn(f.guest.id);
    const { threadId } = await (await submitInquiry(request('/api/leads', f.payload))).json();
    const initial = await db.message.findFirstOrThrow({ where: { threadId } });
    const later = new Date(initial.createdAt.getTime() + 1000);
    await db.message.create({ data: { threadId, senderIdentityId: f.admin.id, body: 'Arrived after the read snapshot', createdAt: later } });
    await markThreadRead(db, threadId, f.guest.id, initial.createdAt);
    expect((await getUnreadCounts(db, f.guest.id))[threadId]).toBe(1);
    await markThreadRead(db, threadId, f.guest.id, later);
    await markThreadRead(db, threadId, f.guest.id, initial.createdAt);
    expect((await getUnreadCounts(db, f.guest.id))[threadId] ?? 0).toBe(0);
  });
});

describe('public management acquisition', () => {
  beforeEach(async () => {
    await resetDb();
    getCurrentUserMock.mockReset();
    vi.mocked(createNotification).mockClear();
    await signIn(null);
  });

  it('persists an anonymous owner brief once and exposes it to staff without granting visitor thread access', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const payload = { audience: 'owners', name: 'Owner fixture', contact: 'owner@example.test', message: 'Management inquiry: villa in Phuket', consent: true, sourceMedium: 'owner_management', requestId: 'management-fixture-20261021' };
    const invalid = await submitInquiry(request('/api/leads', { ...payload, consent: false }));
    expect(invalid.status).toBe(400);
    expect(await db.thread.count()).toBe(0);
    const first = await submitInquiry(request('/api/leads', payload));
    expect(await first.json()).toEqual({ ok: true });
    const retry = await submitInquiry(request('/api/leads', payload));
    expect(await retry.json()).toEqual({ ok: true });
    expect(await db.thread.count()).toBe(1);
    expect(await db.crmOpportunity.count()).toBe(1);
    const opportunity = await db.crmOpportunity.findFirstOrThrow();
    expect(opportunity.type).toBe('management');
    const thread = await db.thread.findFirstOrThrow();
    await signIn(admin.id);
    const staffInbox = await inbox();
    expect((await staffInbox.json()).threads.map((item: { id: string }) => item.id)).toContain(thread.id);
    const staffRead = await readThread(request(`/api/threads/${thread.id}`), { params: { threadId: thread.id } });
    expect(staffRead.status).toBe(200);
    expect((await staffRead.json()).thread.messages[0].body).toContain(payload.message);
    expect(vi.mocked(createNotification)).toHaveBeenCalledTimes(1);
  });
});
