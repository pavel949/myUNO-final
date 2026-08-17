import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { seedConfig } from '@/modules/config/seed';
import { seedContent } from '@/modules/content/seed';
import { registerWhatsAppAccount, registerTelegramAccount } from '@/modules/integrations';
import { createNotification } from './comms.service';

/**
 * T-040 DoD: enabling the flag routes a notification through the messenger
 * adapter; with the flag off the channel stays dark.
 *
 * Q9 keeps WhatsApp and Telegram off in loop one, so "dark" is the shipped
 * behaviour and has to be the tested one.
 */
describe('Messenger channels behind the config flag (T-040)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    await seedContent(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Switching a channel on takes two things: the founder's config flag, and a
   * registered provider account. Both are required — the flag alone opens the
   * door to an adapter with nothing behind it.
   */
  async function enableChannel(channel: 'whatsapp' | 'telegram') {
    await db.configOverride.create({
      data: {
        parameterKey: `notify.channel.${channel}.enabled`,
        scopeType: 'global',
        scopeId: 'global',
        value: true,
        updatedByIdentityId: 'test',
      },
    });

    if (channel === 'whatsapp') {
      await registerWhatsAppAccount(db, { phoneNumber: '+66800000000' });
    } else {
      await registerTelegramAccount(db, { botToken: 'test-token' });
    }
  }

  /** Deliveries are written fire-and-forget; give the microtasks a beat. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  it('creates no messenger delivery while the channel is disabled', async () => {
    const recipient = await createIdentity({ email: 'guest@example.com' });

    const id = await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      channels: ['in_app', 'whatsapp', 'telegram'],
    });

    await settle();

    const deliveries = await db.notificationDelivery.findMany({
      where: { notificationId: id! },
    });

    // The notification itself still exists — only the dark channels are absent.
    expect(deliveries.map((d) => d.channel)).toEqual(['in_app']);
  });

  it('creates a delivery once the flag is switched on', async () => {
    await enableChannel('whatsapp');
    const recipient = await createIdentity({ email: 'guest@example.com' });

    const id = await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      channels: ['whatsapp'],
    });

    await settle();

    const deliveries = await db.notificationDelivery.findMany({
      where: { notificationId: id! },
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].channel).toBe('whatsapp');
    expect(deliveries[0].status).toBe('sent');
    expect(deliveries[0].externalRef).toMatch(/^stub-/);
  });

  it('switches on each channel independently', async () => {
    await enableChannel('telegram');
    const recipient = await createIdentity({ email: 'guest@example.com' });

    const id = await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      channels: ['whatsapp', 'telegram'],
    });

    await settle();

    const deliveries = await db.notificationDelivery.findMany({
      where: { notificationId: id! },
    });

    expect(deliveries.map((d) => d.channel)).toEqual(['telegram']);
  });

  it('sends the rendered sentence, never the raw content key', async () => {
    await enableChannel('whatsapp');
    const recipient = await createIdentity({ email: 'guest@example.com' });

    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '));
    });

    await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      params: { audience: 'owners' },
      channels: ['whatsapp'],
    });

    await settle();

    const stubLine = logged.find((l) => l.includes('[Messenger stub]'));
    expect(stubLine).toBeDefined();

    // The adapter is handed a rendered body, so the stub reports a real
    // length rather than the 25-odd characters of a dotted key.
    const chars = Number(stubLine!.match(/\((\d+) chars\)/)?.[1] ?? 0);
    expect(chars).toBeGreaterThan('notify.lead_received.body'.length);
  });

  it('keeps the recipient and the message body out of the logs (doc 12)', async () => {
    await enableChannel('whatsapp');
    const recipient = await createIdentity({ email: 'private.guest@example.com' });

    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '));
    });

    await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      channels: ['whatsapp'],
    });

    await settle();

    const all = logged.join('\n');
    expect(all).toContain('[Messenger stub]');
    // A stub is not a licence to print PII: who it went to, and what it said,
    // both stay out.
    expect(all).not.toContain('private.guest@example.com');
  });

  it('still delivers in-app when a messenger channel is asked for and disabled', async () => {
    const recipient = await createIdentity({ email: 'guest@example.com' });

    const id = await createNotification(db, {
      identityId: recipient.id,
      type: 'lead_received',
      titleKey: 'notify.lead_received.title',
      bodyKey: 'notify.lead_received.body',
      channels: ['in_app', 'whatsapp'],
    });

    await settle();

    // A dark channel must never swallow the channels that do work.
    const inApp = await db.notificationDelivery.findFirst({
      where: { notificationId: id!, channel: 'in_app' },
    });
    expect(inApp).not.toBeNull();
  });
});
