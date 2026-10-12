import { getInquiryThreadRecipients } from './inquiry-thread-access';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createNotification } from './comms.service';
import { track } from '@/modules/analytics';
import { capturePublicLead, grantConsent, type PublicLeadInput } from '@/modules/crm';

export const LEAD_AUDIENCES = ['owners', 'developers', 'buyers', 'renters', 'mc'] as const;
export type LeadAudience = (typeof LEAD_AUDIENCES)[number];

export interface SubmitLeadInput extends PublicLeadInput {
  consent: boolean;
  requestId?: string;
}

/** Canonical public inquiry writer. CRM and the opening conversation commit
 * together. Only a validated session identity receives online reply access;
 * a supplied contact address is unverified evidence, never an access grant. */
export async function submitLead(
  db: PrismaClient,
  input: SubmitLeadInput
): Promise<{ threadId: string; opportunityId: string }> {
  const { audience, name, contact, message, projectId, unitId, consent } = input;
  if (!LEAD_AUDIENCES.includes(audience)) throw new Error('invalid_audience');
  if (!consent) throw new Error('consent_required');
  if (!name?.trim() || !contact?.trim()) throw new Error('missing_fields');
  if (name.length > 500 || contact.length > 500 || (message && message.length > 4000)) {
    throw new Error('field_too_long');
  }

  if (input.requestId && !/^[a-zA-Z0-9_-]{16,128}$/.test(input.requestId)) throw new Error('invalid_request_id');
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const requestThreadId = input.requestId ? hash(JSON.stringify(['public-inquiry', input.authenticatedIdentityId ?? 'anonymous', input.requestId])) : undefined;
  const fingerprint = hash(JSON.stringify([audience, name.trim(), contact.trim(), message?.trim() ?? '', projectId ?? '', unitId ?? '', input.sourceChannelId ?? '', input.sourceMedium ?? '', input.sourceCampaign ?? '', input.referrerIdentityId ?? '']));
  const result = await db.$transaction(async (tx) => {
    if (requestThreadId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestThreadId}, 0))`;
      const existing = await tx.thread.findUnique({ where: { id: requestThreadId } });
      if (existing) {
        if (input.authenticatedIdentityId && !await tx.identity.findFirst({ where: { id: input.authenticatedIdentityId, status: 'active' } })) throw new Error('invalid_session_identity');
        const receipt = await tx.crmActivity.findFirst({ where: { channelReference: `thread:${existing.id}` }, select: { opportunityId: true, metadata: true } });
        const metadata = receipt?.metadata as { requestFingerprint?: string } | null;
        if (!receipt?.opportunityId || metadata?.requestFingerprint !== fingerprint) throw Object.assign(new Error('request_id_conflict'), { statusCode: 409, isPublic: true });
        return { threadId: existing.id, opportunityId: receipt.opportunityId, adminIds: [], replayed: true };
      }
    }
    const guest = input.authenticatedIdentityId
      ? await tx.identity.findFirst({ where: { id: input.authenticatedIdentityId, status: 'active' }, select: { id: true } })
      : null;
    if (input.authenticatedIdentityId && !guest) throw new Error('invalid_session_identity');

    const threadId = requestThreadId ?? crypto.randomUUID();
    const unit = unitId ? await tx.unit.findUnique({
      where: { id: unitId }, select: { name: true, project: { select: { name: true } } },
    }) : null;
    const project = !unit && projectId ? await tx.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null;
    const lines = [
      `Lead · ${audience}`, `Name: ${name.trim()}`, `Contact (unverified): ${contact.trim()}`,
      ...(unit || project ? [`Project: ${unit?.project.name ?? project?.name}`] : []),
      ...(unit ? [`Home: ${unit.name}`] : []),
      ...(message?.trim() ? [`Message: ${message.trim()}`] : []), 'Consent: yes',
    ];
    await tx.thread.create({ data: {
      id: threadId, contextType: 'general', contextId: `lead-${threadId}`,
      projectId, lastMessageAt: new Date(),
      messages: { create: { body: lines.join('\n'), messageKind: 'system' } },
    } });
    const crm = await capturePublicLead(tx, { ...input, threadId });
    // The box the person ticked ("store this to respond to my enquiry") is a
    // PDPA decision: it goes in the append-only consent journal, not only in the
    // thread text. A person whose latest decision is already "granted" gets no
    // duplicate row.
    const latestService = await tx.crmConsent.findFirst({
      where: { identityId: crm.identityId, purpose: 'service' },
      orderBy: { capturedAt: 'desc' },
      select: { status: true },
    });
    if (latestService?.status !== 'granted') {
      await grantConsent(tx, {
        identityId: crm.identityId,
        purpose: 'service',
        channel: 'website',
        evidence: { form: 'lead', audience, ...(input.sourceMedium ? { sourceMedium: input.sourceMedium } : {}) },
      });
    }
    const opportunity = await tx.crmOpportunity.findUniqueOrThrow({ where: { id: crm.opportunityId }, select: { projectId: true, unitId: true } });
    const recipients = await getInquiryThreadRecipients(tx, opportunity);
    if (!recipients.participantIdentityIds.length) throw new Error('no_admin_available');
    const participants = recipients.participantIdentityIds.map(identityId => ({ identityId, participantRole: recipients.participantRoles[identityId] }));
    if (guest) {
      const self = participants.find(participant => participant.identityId === guest.id);
      if (self) self.participantRole = 'inquirer';
      else participants.push({ identityId: guest.id, participantRole: 'inquirer' });
    }
    await tx.threadParticipant.createMany({ data: participants.map(participant => ({ ...participant, threadId })) });
    const receipt = await tx.crmActivity.findFirstOrThrow({ where: { channelReference: `thread:${threadId}` } });
    await tx.crmActivity.update({ where: { id: receipt.id }, data: { metadata: { ...(receipt.metadata as Record<string, string> ?? {}), requestFingerprint: fingerprint } } });
    // Existing context + activity channelReference give both directions of the
    // link without introducing a parallel inquiry/CRM model or schema migration.
    await tx.thread.update({ where: { id: threadId }, data: { contextId: `lead-${crm.opportunityId}:${threadId}`, projectId: opportunity.projectId } });
    return { threadId, opportunityId: crm.opportunityId, adminIds: recipients.participantIdentityIds.filter(id => id !== guest?.id), replayed: false };
  });

  // Delivery occurs only after both canonical records have committed.
  await Promise.all(result.adminIds.map(identityId => createNotification(db, {
    identityId, type: 'lead_received', titleKey: 'notify.lead_received.title',
    bodyKey: 'notify.lead_received.body', params: { audience, threadId: result.threadId },
  }).catch(() => null)));
  if (!result.replayed) await track(db, 'lead_submitted', { audienceType: audience }).catch(() => null);
  return { threadId: result.threadId, opportunityId: result.opportunityId };
}
