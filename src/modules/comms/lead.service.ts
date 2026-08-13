import { PrismaClient } from '@prisma/client';
import { findOrCreateThread, addSystemMessage } from './thread.service';
import { createNotification } from './comms.service';

/**
 * Public lead capture (doc 08 §3, T-035): the audience-page forms for
 * owners / developers / buyers / management companies. A lead becomes a
 * `general` thread whose participants are the admins, with the visitor's
 * details in the opening system message, plus an N-29 `lead.received`
 * alert to every admin. The public route then enriches the accepted inquiry
 * into the native CRM; the raw thread remains the operational evidence.
 */

export const LEAD_AUDIENCES = ['owners', 'developers', 'buyers', 'mc'] as const;
export type LeadAudience = (typeof LEAD_AUDIENCES)[number];

export interface SubmitLeadInput {
  audience: LeadAudience;
  name: string;
  contact: string;
  message?: string;
  consent: boolean;
}

const MAX_FIELD = 500;
const MAX_MESSAGE = 4000;

export async function submitLead(
  db: PrismaClient,
  input: SubmitLeadInput
): Promise<{ threadId: string }> {
  const { audience, name, contact, message, consent } = input;

  if (!LEAD_AUDIENCES.includes(audience)) {
    throw new Error('invalid_audience');
  }
  if (!consent) {
    throw new Error('consent_required');
  }
  if (!name?.trim() || !contact?.trim()) {
    throw new Error('missing_fields');
  }
  if (
    name.length > MAX_FIELD ||
    contact.length > MAX_FIELD ||
    (message && message.length > MAX_MESSAGE)
  ) {
    throw new Error('field_too_long');
  }

  const admins = await db.identity.findMany({
    where: { isAdmin: true, status: 'active' },
    select: { id: true },
  });
  if (admins.length === 0) {
    throw new Error('no_admin_available');
  }

  // Each lead is its own thread — no contextId, so findOrCreateThread's
  // idempotency (which matches on contextType+contextId) must be bypassed
  // with a unique contextId per submission.
  const contextId = `lead-${crypto.randomUUID()}`;
  const thread = await findOrCreateThread(db, {
    contextType: 'general',
    contextId,
    participantIdentityIds: admins.map((a) => a.id),
    participantRoles: Object.fromEntries(admins.map((a) => [a.id, 'admin'])),
  });

  const lines = [
    `Lead · ${audience}`,
    `Name: ${name.trim()}`,
    `Contact: ${contact.trim()}`,
    ...(message?.trim() ? [`Message: ${message.trim()}`] : []),
    'Consent: yes',
  ];
  await addSystemMessage(db, thread.id, lines.join('\n'));

  // Best-effort N-29 alerts — a notification failure never loses the lead.
  await Promise.all(
    admins.map((a) =>
      createNotification(db, {
        identityId: a.id,
        type: 'lead_received',
        titleKey: 'notify.lead_received.title',
        bodyKey: 'notify.lead_received.body',
        params: { audience },
      }).catch(() => null)
    )
  );

  return { threadId: thread.id };
}
