import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { submitLead } from './lead.service';

describe('Lead capture (doc 08 §3, N-29)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('stores a lead as an admin thread with the details in a system message', async () => {
    const admin = await createIdentity({ isAdmin: true });

    const { threadId } = await submitLead(db, {
      audience: 'owners',
      name: 'Ivan Petrov',
      contact: '+66 99 123 4567',
      message: 'Two-bedroom at The Title',
      consent: true,
    });

    const thread = await db.thread.findUnique({
      where: { id: threadId },
      include: { participants: true, messages: true },
    });
    expect(thread).not.toBeNull();
    expect(thread!.contextType).toBe('general');
    expect(thread!.participants.map((p) => p.identityId)).toContain(admin.id);
    expect(thread!.messages).toHaveLength(1);
    expect(thread!.messages[0].messageKind).toBe('system');
    expect(thread!.messages[0].body).toContain('Ivan Petrov');
    expect(thread!.messages[0].body).toContain('+66 99 123 4567');
    expect(thread!.messages[0].body).toContain('Two-bedroom at The Title');
  });

  it('notifies every admin with an N-29 lead_received alert', async () => {
    const admin1 = await createIdentity({ isAdmin: true });
    const admin2 = await createIdentity({ isAdmin: true });
    await createIdentity(); // non-admin — must not be notified

    await submitLead(db, {
      audience: 'buyers',
      name: 'Lead',
      contact: 'lead@example.com',
      consent: true,
    });

    const notifications = await db.notification.findMany({
      where: { type: 'lead_received' },
    });
    expect(notifications.map((n) => n.identityId).sort()).toEqual(
      [admin1.id, admin2.id].sort()
    );
  });

  it('creates a separate thread per submission (no idempotent collapse)', async () => {
    await createIdentity({ isAdmin: true });

    const a = await submitLead(db, {
      audience: 'mc',
      name: 'One',
      contact: 'one@example.com',
      consent: true,
    });
    const b = await submitLead(db, {
      audience: 'mc',
      name: 'Two',
      contact: 'two@example.com',
      consent: true,
    });

    expect(a.threadId).not.toBe(b.threadId);
  });

  it('rejects a lead without consent', async () => {
    await createIdentity({ isAdmin: true });

    await expect(
      submitLead(db, {
        audience: 'owners',
        name: 'No Consent',
        contact: 'x@example.com',
        consent: false,
      })
    ).rejects.toThrow('consent_required');
  });

  it('rejects missing name/contact and unknown audiences', async () => {
    await createIdentity({ isAdmin: true });

    await expect(
      submitLead(db, {
        audience: 'owners',
        name: '  ',
        contact: 'x@example.com',
        consent: true,
      })
    ).rejects.toThrow('missing_fields');

    await expect(
      submitLead(db, {
        audience: 'guests' as unknown as 'owners',
        name: 'X',
        contact: 'x@example.com',
        consent: true,
      })
    ).rejects.toThrow('invalid_audience');
  });
});
