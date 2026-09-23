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
): Promise<{ threadId: string; signalId: string; opportunityId: string }> {
  const message = input.message?.trim() ?? '';
  if (!message) throw new Error('A message is required');
  if (message.length > MAX_MESSAGE) throw new Error('That message is too long');

  let unit: { id: string; name: string; projectId: string } | null = null;
  let saleOffering: { id: string; pricingTerms: unknown; ownershipTenure: unknown } | null = null;
  if (input.unitId) {
    unit = await db.unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, name: true, projectId: true },
    });
    // A stale or hand-edited unit id should not lose the enquiry — the person
    // still wants to talk to somebody. It becomes a general enquiry instead.
    if (!unit) unit = null;
    if (unit) {
      saleOffering = await db.commercialOffering.findFirst({
        where: { unitId: unit.id, offeringType: 'sale', status: 'active' },
        select: { id: true, pricingTerms: true, ownershipTenure: true },
      });
      if (!saleOffering) throw new Error('This home is not currently offered for sale');
    }
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

  // A direct purchase enquiry is also a canonical CRM opportunity. Sale
  // commercial terms are snapshotted into requirements; rental RatePlans and
  // Booking prices are deliberately not consulted here.
  const opportunity = await db.crmOpportunity.create({
    data: {
      identityId: input.identityId,
      projectId: unit?.projectId ?? null,
      unitId: unit?.id ?? null,
      type: 'purchase',
      stage: 'new',
      title: unit ? `Purchase enquiry: ${unit.name}` : 'Purchase enquiry',
      source: 'buying_interest',
      requirements: {
        message,
        ...(saleOffering
          ? {
              saleOfferingId: saleOffering.id,
              salePricingTermsSnapshot: saleOffering.pricingTerms,
              ownershipTenureSnapshot: saleOffering.ownershipTenure,
            }
          : {}),
      },
    },
  });
  await db.crmActivity.create({
    data: {
      identityId: input.identityId,
      opportunityId: opportunity.id,
      type: 'system',
      status: 'completed',
      subject: 'Purchase enquiry received',
      body: message,
      completedAt: new Date(),
      metadata: { buyerSignalId: signal.id, saleOfferingId: saleOffering?.id ?? null },
    },
  });

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

  return { threadId: thread.id, signalId: signal.id, opportunityId: opportunity.id };
}
