import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { findOrCreateThread, addSystemMessage, createNotification } from '@/modules/comms';
import { createDirectInquiry } from './signals';
import { track } from './track';

/**
 * A signed-in person saying they are thinking about buying (doc 07 F-BUY,
 * journey audit "buyer": signal → nurture → browse → request due diligence).
 *
 * Two things happen, and both matter. The **signal** puts them in the funnel an
 * admin already watches, so the interest is not just a message somebody has to
 * notice. The **thread** gives them a person to talk to and a place the answer
 * comes back — because the answer to "can I buy this" is not something the
 * platform can compute (see Q41), it is something the team tells them.
 *
 * Deliberately **not** a purchase flow. The transaction runs with Ignatev
 * Capital off-platform (Q1); what this does is get a real human into the
 * conversation with the record attached.
 */

const MAX_MESSAGE = 2000;

export interface PurchaseInterestInput {
  identityId: string;
  /** The unit they are asking about, when they came from one. */
  unitId?: string | null;
  message: string;
}

export async function registerPurchaseInterest(
  db: PrismaClient,
  input: PurchaseInterestInput
): Promise<{ threadId: string; signalId: string }> {
  const message = input.message?.trim() ?? '';
  if (!message) throw new Error('A message is required');
  if (message.length > MAX_MESSAGE) throw new Error('That message is too long');

  let unit: { id: string; name: string; projectId: string } | null = null;
  if (input.unitId) {
    unit = await db.unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, name: true, projectId: true },
    });
    // A stale or hand-edited unit id should not lose the enquiry — the person
    // still wants to talk to somebody. It becomes a general enquiry instead.
    if (!unit) unit = null;
  }

  const admins = await db.identity.findMany({
    where: { isAdmin: true, status: 'active' },
    select: { id: true },
  });
  if (admins.length === 0) throw new Error('no_admin_available');

  const signal = await createDirectInquiry(
    db,
    input.identityId,
    undefined,
    unit ? `Asked about unit ${unit.name}` : 'Asked about buying'
  );

  // Each enquiry is its own thread. `findOrCreateThread` is idempotent on
  // contextType + contextId, so a unique id per enquiry is what keeps a second
  // question from being appended to a conversation that was already closed.
  const thread = await findOrCreateThread(db, {
    contextType: 'general',
    contextId: `buying-${crypto.randomUUID()}`,
    ...(unit ? { projectId: unit.projectId } : {}),
    participantIdentityIds: [input.identityId, ...admins.map((a) => a.id)],
    participantRoles: {
      [input.identityId]: 'buyer',
      ...Object.fromEntries(admins.map((a) => [a.id, 'admin'])),
    },
  });

  await addSystemMessage(
    db,
    thread.id,
    [
      'Enquiry about buying',
      ...(unit ? [`Unit: ${unit.name}`] : []),
      `Message: ${message}`,
    ].join('\n')
  );

  // Best-effort: a notification failure must never lose the enquiry itself.
  await Promise.all(
    admins.map((a) =>
      createNotification(db, {
        identityId: a.id,
        type: 'lead_received',
        titleKey: 'notify.lead_received.title',
        bodyKey: 'notify.lead_received.body',
        params: { audience: 'buyers' },
      }).catch(() => null)
    )
  );

  await track(db, 'lead_submitted', { audienceType: 'buyers' }).catch(() => null);

  return { threadId: thread.id, signalId: signal.id };
}
