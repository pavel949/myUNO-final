import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, db, resetDb } from '@/test/util';
import { createNotification } from './comms.service';
import { dispatchNotificationDelivery, flushPendingNotificationDeliveries, QUEUED_DELIVERY } from './notification-delivery';
import * as email from './email.seam';

beforeEach(async () => {
  await resetDb();
  vi.spyOn(email, 'buildNotificationEmail').mockResolvedValue({ subject: 'Synthetic notification', body: 'Synthetic isolated notification body' });
});
afterEach(() => { vi.restoreAllMocks(); });
async function queued() {
  const identity = await createIdentity({ email: 'outbox@isolated.example.test' });
  const id = await db.$transaction(tx => createNotification(tx as unknown as PrismaClient, { identityId: identity.id, type: 'lead_received', titleKey: 'fixture.title', bodyKey: 'fixture.body', channels: ['email'] }));
  return db.notificationDelivery.findFirstOrThrow({ where: { notificationId: id! } });
}

describe('durable post-commit notification delivery', () => {
  it('never dispatches through a TransactionClient and recovers the committed row through the frequent sweep', async () => {
    const send = vi.spyOn(email, 'sendEmail').mockResolvedValue('isolated-provider-ack');
    const delivery = await queued();
    expect(send).not.toHaveBeenCalled();
    expect(delivery).toMatchObject({ status: 'pending', failureReason: QUEUED_DELIVERY });
    expect(await flushPendingNotificationDeliveries(db)).toMatchObject({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({ idempotencyKey: `notification/${delivery.id}`, retryTransient: true });
    expect(await db.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'sent', externalRef: 'isolated-provider-ack' });
  });

  it('does not send a notification whose business transaction rolled back', async () => {
    const send = vi.spyOn(email, 'sendEmail').mockResolvedValue('must-not-be-sent');
    const identity = await createIdentity();
    await expect(db.$transaction(async tx => {
      await createNotification(tx as unknown as PrismaClient, { identityId: identity.id, type: 'lead_received', titleKey: 'fixture.title', bodyKey: 'fixture.body', channels: ['email'] });
      expect(send).not.toHaveBeenCalled();
      throw new Error('Synthetic business rollback');
    })).rejects.toThrow('Synthetic business rollback');
    expect(await db.notification.count()).toBe(0);
    expect(await flushPendingNotificationDeliveries(db)).toMatchObject({ sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('serializes competing workers and dispatches only one provider request', async () => {
    const delivery = await queued();
    const send = vi.spyOn(email, 'sendEmail').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return 'isolated-provider-ack';
    });
    await Promise.all([dispatchNotificationDelivery(db, delivery.id), dispatchNotificationDelivery(db, delivery.id)]);
    expect(send).toHaveBeenCalledOnce();
    expect(await dispatchNotificationDelivery(db, delivery.id)).toBe('skipped');
  });

  it('retains durable pending state for an ambiguous provider response and retries the same delivery key', async () => {
    const delivery = await queued();
    const send = vi.spyOn(email, 'sendEmail').mockRejectedValueOnce(new email.EmailDeliveryRetryableError()).mockResolvedValueOnce('isolated-recovered-ack');
    expect(await dispatchNotificationDelivery(db, delivery.id)).toBe('deferred');
    expect(await db.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'pending', sentAt: null });
    expect(await dispatchNotificationDelivery(db, delivery.id)).toBe('sent');
    expect(send.mock.calls[0][0].idempotencyKey).toBe(send.mock.calls[1][0].idempotencyKey);
    expect(await db.analyticsEvent.count({ where: { eventKey: 'notify_delivered' } })).toBe(1);
  });

  it('does not automatically replay legacy pending rows or send beyond the safe provider retry window', async () => {
    const delivery = await queued();
    const legacy = await db.notificationDelivery.create({ data: { notificationId: delivery.notificationId, channel: 'email', status: 'pending' } });
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { createdAt: new Date(Date.now() - 24 * 3_600_000) } });
    const send = vi.spyOn(email, 'sendEmail').mockResolvedValue('must-not-send');
    expect(await flushPendingNotificationDeliveries(db)).toMatchObject({ failed: 1, sent: 0 });
    expect(await db.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('manual provider reconciliation') });
    expect(await db.notificationDelivery.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ status: 'pending' });
    expect(send).not.toHaveBeenCalled();
  });

  it('rechecks recipient mute after the notification was queued', async () => {
    const delivery = await queued();
    const notification = await db.notification.findUniqueOrThrow({ where: { id: delivery.notificationId } });
    await db.notificationPreference.create({ data: { identityId: notification.identityId, type: notification.type, channel: 'email', muted: true } });
    const send = vi.spyOn(email, 'sendEmail').mockResolvedValue('must-not-send');
    expect(await dispatchNotificationDelivery(db, delivery.id)).toBe('failed');
    expect(send).not.toHaveBeenCalled();
  });
});
