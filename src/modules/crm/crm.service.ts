import {
  CrmActivityStatus,
  CrmActivityType,
  CrmLifecycleStage,
  CrmOpportunityStage,
  CrmOpportunityType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  lifecycleAfterWin,
  opportunityTypeForAudience,
  parseLeadContact,
  validateProbability,
} from './domain';

export interface OpportunityInput {
  identityId: string;
  assignedToIdentityId?: string | null;
  projectId?: string | null;
  unitId?: string | null;
  type: CrmOpportunityType;
  title: string;
  source: string;
  valueThb?: number | null;
  probability?: number;
  requirements?: Prisma.InputJsonValue;
  expectedCloseAt?: Date | null;
  nextActionAt?: Date | null;
  externalPartner?: string | null;
}

export interface ActivityInput {
  identityId: string;
  opportunityId?: string | null;
  createdByIdentityId?: string | null;
  type: CrmActivityType;
  subject: string;
  body?: string | null;
  dueAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

export interface PublicLeadInput {
  audience: 'owners' | 'developers' | 'buyers' | 'mc';
  name: string;
  contact: string;
  message?: string;
  source?: string;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

const ACTIVE_STAGES: CrmOpportunityStage[] = [
  'new',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'nurture',
];

function cleanRequired(value: string, field: string, max: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${field}_required`);
  if (cleaned.length > max) throw new Error(`${field}_too_long`);
  return cleaned;
}

export async function ensureCrmProfile(
  db: DbClient,
  identityId: string,
  defaults: {
    lifecycleStage?: CrmLifecycleStage;
    source?: string;
    preferredChannel?: string;
  } = {}
) {
  return db.crmProfile.upsert({
    where: { identityId },
    create: {
      identityId,
      lifecycleStage: defaults.lifecycleStage ?? 'contact',
      firstSource: defaults.source,
      lastSource: defaults.source,
      preferredChannel: defaults.preferredChannel,
    },
    update: {
      ...(defaults.source ? { lastSource: defaults.source } : {}),
      ...(defaults.preferredChannel ? { preferredChannel: defaults.preferredChannel } : {}),
    },
  });
}

export async function createOpportunity(db: PrismaClient, input: OpportunityInput) {
  const title = cleanRequired(input.title, 'title', 240);
  const source = cleanRequired(input.source, 'source', 120);
  const probability = validateProbability(input.probability ?? 10);

  const identity = await db.identity.findUnique({
    where: { id: input.identityId },
    select: { id: true, status: true },
  });
  if (!identity || identity.status === 'merged') throw new Error('identity_not_found');

  return db.$transaction(async (tx) => {
    await ensureCrmProfile(tx, input.identityId, {
      lifecycleStage: input.type === 'rental' ? 'prospect' : 'buyer',
      source,
    });

    const opportunity = await tx.crmOpportunity.create({
      data: {
        identityId: input.identityId,
        assignedToIdentityId: input.assignedToIdentityId,
        projectId: input.projectId,
        unitId: input.unitId,
        type: input.type,
        title,
        source,
        valueThb: input.valueThb,
        probability,
        requirements: input.requirements ?? {},
        expectedCloseAt: input.expectedCloseAt,
        nextActionAt: input.nextActionAt,
        externalPartner: input.externalPartner,
      },
    });

    await tx.crmActivity.create({
      data: {
        identityId: input.identityId,
        opportunityId: opportunity.id,
        createdByIdentityId: input.assignedToIdentityId,
        type: 'system',
        status: 'completed',
        subject: 'Opportunity created',
        completedAt: new Date(),
        metadata: { source, type: input.type },
      },
    });

    return opportunity;
  });
}

export async function transitionOpportunity(
  db: PrismaClient,
  opportunityId: string,
  stage: CrmOpportunityStage,
  actorIdentityId: string,
  options: { lostReason?: string; nextActionAt?: Date | null } = {}
) {
  const opportunity = await db.crmOpportunity.findUnique({ where: { id: opportunityId } });
  if (!opportunity) throw new Error('opportunity_not_found');
  if (opportunity.stage === 'won' || opportunity.stage === 'lost') {
    throw new Error('opportunity_already_closed');
  }
  if (stage === 'lost' && !options.lostReason?.trim()) throw new Error('lost_reason_required');

  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.crmOpportunity.update({
      where: { id: opportunityId },
      data: {
        stage,
        nextActionAt: options.nextActionAt,
        wonAt: stage === 'won' ? now : null,
        lostAt: stage === 'lost' ? now : null,
        lostReason: stage === 'lost' ? options.lostReason!.trim() : null,
        probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : opportunity.probability,
      },
    });

    await tx.crmActivity.create({
      data: {
        identityId: opportunity.identityId,
        opportunityId,
        createdByIdentityId: actorIdentityId,
        type: 'system',
        status: 'completed',
        subject: `Stage changed: ${opportunity.stage} → ${stage}`,
        completedAt: now,
      },
    });

    if (stage === 'won') {
      const lifecycleStage = lifecycleAfterWin(opportunity.type);
      if (lifecycleStage) {
        await tx.crmProfile.upsert({
          where: { identityId: opportunity.identityId },
          create: { identityId: opportunity.identityId, lifecycleStage },
          update: { lifecycleStage },
        });
      }
    }

    return updated;
  });
}

export async function addActivity(db: PrismaClient, input: ActivityInput) {
  const subject = cleanRequired(input.subject, 'subject', 240);
  const activity = await db.crmActivity.create({
    data: {
      identityId: input.identityId,
      opportunityId: input.opportunityId,
      createdByIdentityId: input.createdByIdentityId,
      type: input.type,
      subject,
      body: input.body?.trim() || null,
      dueAt: input.dueAt,
      status: input.type === 'note' ? 'completed' : 'open',
      completedAt: input.type === 'note' ? new Date() : null,
      metadata: input.metadata ?? {},
    },
  });

  await db.crmProfile.upsert({
    where: { identityId: input.identityId },
    create: {
      identityId: input.identityId,
      lastInteractionAt: new Date(),
      nextActionAt: input.dueAt,
    },
    update: {
      lastInteractionAt: new Date(),
      ...(input.dueAt ? { nextActionAt: input.dueAt } : {}),
    },
  });
  return activity;
}

export async function completeActivity(
  db: PrismaClient,
  activityId: string,
  status: CrmActivityStatus = 'completed'
) {
  return db.crmActivity.update({
    where: { id: activityId },
    data: { status, completedAt: status === 'completed' ? new Date() : null },
  });
}

/** Convert a public inquiry into canonical Party + CRM records. */
export async function capturePublicLead(db: PrismaClient, input: PublicLeadInput) {
  const fullName = cleanRequired(input.name, 'name', 500);
  const contact = cleanRequired(input.contact, 'contact', 500);
  const [firstName, ...lastParts] = fullName.split(/\s+/);
  const lastName = lastParts.join(' ') || '—';
  const parsed = parseLeadContact(contact);
  const source = input.source?.trim() || `website_${input.audience}`;

  return db.$transaction(async (tx) => {
    const existing = parsed.email
      ? await tx.identity.findUnique({ where: { email: parsed.email } })
      : parsed.phone
        ? await tx.identity.findUnique({ where: { phone: parsed.phone } })
        : null;
    const identity =
      existing ??
      (await tx.identity.create({
        data: {
          firstName,
          lastName,
          email: parsed.email,
          phone: parsed.phone,
          status: 'invited',
          notesInternal: parsed.email || parsed.phone ? null : `Unstructured contact: ${contact}`,
        },
      }));

    await ensureCrmProfile(tx, identity.id, {
      lifecycleStage: 'prospect',
      source,
      preferredChannel: parsed.preferredChannel,
    });
    await tx.crmConsent.create({
      data: {
        identityId: identity.id,
        purpose: 'service',
        status: 'granted',
        channel: 'website',
        evidence: { form: input.audience, contact },
      },
    });
    await tx.crmAttributionTouch.create({
      data: {
        identityId: identity.id,
        touchType: 'lead_creation',
        source,
        medium: 'website',
        metadata: { audience: input.audience },
      },
    });

    const type = opportunityTypeForAudience(input.audience);
    const opportunity = await tx.crmOpportunity.create({
      data: {
        identityId: identity.id,
        type,
        title: `${input.audience}: ${fullName}`,
        source,
        requirements: input.message ? { message: input.message.trim() } : {},
      },
    });
    await tx.crmActivity.create({
      data: {
        identityId: identity.id,
        opportunityId: opportunity.id,
        type: 'system',
        status: 'completed',
        subject: 'Public inquiry received',
        body: input.message?.trim() || null,
        completedAt: new Date(),
      },
    });
    return { identityId: identity.id, opportunityId: opportunity.id };
  });
}

export async function getPipeline(db: PrismaClient) {
  const [counts, opportunities] = await Promise.all([
    db.crmOpportunity.groupBy({
      by: ['stage'],
      _count: { _all: true },
      _sum: { valueThb: true },
    }),
    db.crmOpportunity.findMany({
      where: { stage: { in: ACTIVE_STAGES } },
      include: {
        identity: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        project: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ nextActionAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
  ]);
  return { counts, opportunities };
}
