import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity } from '@/test/util';
import { clearTranslationCache } from '@/modules/content';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function post(body: unknown) {
  return new NextRequest('http://localhost/api/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Sell-interest used to be detected with `body.includes('sell-interest')`, and
 * the client sent the literal string `[sell-interest]` as the message. Two
 * things were wrong with that: any owner whose message happened to contain the
 * phrase silently filed a buyer signal, and the placeholder sat in the owner's
 * own thread as the message they appeared to have written.
 */
describe('POST /api/threads — sell interest is a declared intent (T-059)', () => {
  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();
  });

  async function signedInOwner() {
    const owner = await createIdentity();
    mockGetCurrentUser.mockResolvedValue({
      identityId: owner.id,
      email: owner.email,
      firstName: 'Owner',
      lastName: 'One',
      isAdmin: false,
      roles: [],
    });
    return owner;
  }

  it('records a buyer signal when the intent is declared', async () => {
    const owner = await signedInOwner();

    const response = await POST(post({ contextType: 'general', intent: 'sell_interest' }));
    expect(response.status).toBe(201);

    const signal = await db.buyerSignal.findFirst({ where: { identityId: owner.id } });
    expect(signal).not.toBeNull();
    expect(signal?.signalKey).toBe('direct_inquiry');
  });

  it('writes a real sentence from the content layer, not a placeholder', async () => {
    const owner = await signedInOwner();

    // Seed the key this route renders, so the assertion is against real copy
    // rather than against `t()`'s fall-back-to-key-name behaviour.
    const key = await db.contentKey.create({
      data: {
        key: 'owner.sell_interest.message',
        namespace: 'owner',
        description: 'Opening message for an owner sell-interest thread',
      },
    });
    await db.translation.create({
      data: {
        contentKey: { connect: { id: key.id } },
        updatedBy: { connect: { id: owner.id } },
        locale: 'ru',
        value: 'Я хотел бы обсудить продажу моей недвижимости.',
        status: 'needs_review',
      },
    });
    clearTranslationCache();

    const response = await POST(post({ contextType: 'general', intent: 'sell_interest' }));
    const { threadId } = await response.json();

    const message = await db.message.findFirst({ where: { threadId } });
    expect(message?.body).toBe('Я хотел бы обсудить продажу моей недвижимости.');
    expect(message?.body).not.toContain('sell-interest');
  });

  it('does NOT file a signal for an ordinary message that happens to contain the phrase', async () => {
    // The whole point. Before this change, writing about sell-interest was
    // indistinguishable from declaring it.
    const owner = await signedInOwner();

    const response = await POST(
      post({
        contextType: 'general',
        body: 'A guest asked about the sell-interest card on my dashboard — what is it?',
      })
    );
    expect(response.status).toBe(201);

    const signal = await db.buyerSignal.findFirst({ where: { identityId: owner.id } });
    expect(signal).toBeNull();
  });

  it('refuses an unknown intent rather than ignoring it', async () => {
    await signedInOwner();
    const response = await POST(post({ contextType: 'general', intent: 'buy_the_building' }));
    expect(response.status).toBe(400);
  });
});
