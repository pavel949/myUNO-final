import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotification } from '@/modules/comms';
import { seedConfig } from '@/modules/config/seed';
import { seedContent } from '@/modules/content/seed';
import { handleMessengerWebhook, MessengerChannel, registerTelegramAccount, registerWhatsAppAccount } from '@/modules/integrations';
import { createIdentity, db, resetDb, setGlobalConfig } from '@/test/util';
import * as emailSeam from './email.seam';

describe('notification delivery reports actual adapter outcomes', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    await seedContent(db);
    vi.stubEnv('RESEND_API_KEY', '');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  async function notify(channels: Array<'in_app' | 'email' | 'whatsapp' | 'telegram'>, withoutEmail = false) {
    const recipient = await createIdentity({ email: 'synthetic-notification@example.test' });
    if (withoutEmail) await db.identity.update({ where: { id: recipient.id }, data: { email: null } });
    const id = await createNotification(db, {
      identityId: recipient.id, type: 'lead_received',
      titleKey: 'notify.lead_received.title', bodyKey: 'notify.lead_received.body', channels,
    });
    expect(id).toBeTruthy();
    await vi.waitFor(async () => {
      expect(await db.notificationDelivery.count({ where: { notificationId: id!, status: 'pending' } })).toBe(0);
    }, { timeout: 5_000 });
    await vi.waitFor(async () => {
      expect(await db.analyticsEvent.count({ where: { identityId: recipient.id, eventKey: { in: ['notify_delivered', 'notify_failed'] } } })).toBe(channels.length);
    }, { timeout: 5_000 });
    return { id: id!, recipient, deliveries: await db.notificationDelivery.findMany({ where: { notificationId: id! } }) };
  }

  it.each(['whatsapp', 'telegram'] as const)('does not report a configured %s placeholder as sent', async channel => {
    await setGlobalConfig(`notify.channel.${channel}.enabled`, true);
    const account = channel === 'whatsapp'
      ? await registerWhatsAppAccount(db, {}) : await registerTelegramAccount(db, {});
    const result = await notify([channel]);
    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0]).toMatchObject({ status: 'failed', externalRef: null, sentAt: null });
    expect(result.deliveries[0].failureReason).toContain('MESSENGER_ADAPTER_UNAVAILABLE');
    expect(await db.analyticsEvent.count({ where: { identityId: result.recipient.id, eventKey: 'notify_delivered' } })).toBe(0);
    expect(await db.integrationAccount.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ status: 'error' });
  });

  it('does not count console-only email as external delivery', async () => {
    const result = await notify(['email']);
    expect(result.deliveries[0]).toMatchObject({ status: 'failed', externalRef: null, sentAt: null });
    expect(await db.analyticsEvent.count({ where: { identityId: result.recipient.id, eventKey: 'notify_delivered' } })).toBe(0);
  });

  it('records a provider-confirmed email response using an explicit test seam', async () => {
    const send = vi.spyOn(emailSeam, 'sendEmail').mockResolvedValue('test-provider-response');
    const result = await notify(['email']);
    expect(send).toHaveBeenCalledOnce();
    expect(result.deliveries[0]).toMatchObject({ status: 'sent', externalRef: 'test-provider-response', failureReason: null });
    expect(result.deliveries[0].sentAt).toBeInstanceOf(Date);
    expect(await db.analyticsEvent.count({ where: { identityId: result.recipient.id, eventKey: 'notify_delivered' } })).toBe(1);
  });

  it('keeps in-app delivery available when the requested messenger fails', async () => {
    await setGlobalConfig('notify.channel.whatsapp.enabled', true);
    await registerWhatsAppAccount(db, {});
    const result = await notify(['in_app', 'whatsapp']);
    expect(result.deliveries.find(delivery => delivery.channel === 'in_app')).toMatchObject({ status: 'sent', failureReason: null });
    expect(result.deliveries.find(delivery => delivery.channel === 'whatsapp')).toMatchObject({ status: 'failed', externalRef: null });
    const events = await db.analyticsEvent.findMany({ where: { identityId: result.recipient.id, eventKey: 'notify_delivered' } });
    expect(events).toHaveLength(1);
    expect(events[0].dimensions).toMatchObject({ channel: 'in_app' });
  });

  it('does not leave an email without a recipient pending forever', async () => {
    const result = await notify(['email'], true);
    expect(result.deliveries[0]).toMatchObject({ status: 'failed', externalRef: null, sentAt: null });
    expect(result.deliveries[0].failureReason).toContain('recipient');
  });

  it.each([MessengerChannel.WHATSAPP, MessengerChannel.TELEGRAM])('does not accept or log an unverified %s webhook', async channel => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const accepted = await handleMessengerWebhook(db, channel, { text: 'private synthetic body', phone: '+66000000000' });
    expect(accepted).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private synthetic body');
    expect(JSON.stringify(log.mock.calls)).not.toContain('+66000000000');
  });
});
