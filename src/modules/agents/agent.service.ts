import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getPublicCommercialHomeById, listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';
import { AgentError, amount, contactInput, expires, serialize, text } from './domain';

type Db = Prisma.TransactionClient;
export interface AgentContext { workspaceId: string; identityId: string; manager: boolean }
export async function getAgentContext(db: Db, actorId: string, workspaceId: string): Promise<AgentContext> {
  const workspace = await db.crmWorkspace.findFirst({
    where: { id: workspaceId, active: true, organization: {
      status: 'active', orgType: 'brokerage',
      memberships: { some: { identityId: actorId, status: 'active', identity: { status: 'active' } } },
    } },
    select: { organization: { select: { memberships: {
      where: { identityId: actorId, status: 'active' }, select: { role: true },
    } } } },
  });
  if (!workspace) throw new AgentError('workspace_not_found', 404);
  return { workspaceId, identityId: actorId, manager: workspace.organization.memberships[0].role === 'manager' };
}
function contactsWhere(ctx: AgentContext) {
  return { workspaceId: ctx.workspaceId, ...(ctx.manager ? {} : { ownerIdentityId: ctx.identityId }) };
}
function introductionsWhere(ctx: AgentContext) {
  return { workspaceId: ctx.workspaceId, ...(ctx.manager ? {} : { agentIdentityId: ctx.identityId }) };
}
async function introduction(db: Db, ctx: AgentContext, id: string) {
  const row = await db.agentIntroduction.findFirst({
    where: { id, ...introductionsWhere(ctx) },
    include: { opportunity: true, relationship: true },
  });
  if (!row) throw new AgentError('record_not_found', 404);
  return row;
}
async function quote(db: Db, ctx: AgentContext, id: string) {
  const row = await db.agentQuote.findFirst({
    where: { id, workspaceId: ctx.workspaceId, introduction: introductionsWhere(ctx) },
    include: { version: true },
  });
  if (!row) throw new AgentError('record_not_found', 404);
  return row;
}
async function audit(db: Db, actor: string, action: string, entityId: string, workspaceId?: string) {
  await db.auditLog.create({ data: {
    actorIdentityId: actor, action, entityType: 'agent_module', entityId,
    data: workspaceId ? { workspaceId } : {},
  } });
}
export async function listAgentWorkspaces(db: PrismaClient, actorId: string) {
  return db.crmWorkspace.findMany({
    where: { active: true, organization: { status: 'active', orgType: 'brokerage', memberships: {
      some: { identityId: actorId, status: 'active', identity: { status: 'active' } },
    } } },
    select: { id: true, organization: { select: { name: true } } }, orderBy: { createdAt: 'asc' },
  });
}
export async function getAgentDashboard(db: PrismaClient, actorId: string, workspaceId: string, locale: string, query = '') {
  return db.$transaction(async tx => {
    const ctx = await getAgentContext(tx, actorId, workspaceId);
    const [contacts, opportunities, activities, quotes, knowledge, members, commissions] = await Promise.all([
      tx.crmContactRelationship.findMany({ where: contactsWhere(ctx), take: 100, orderBy: { updatedAt: 'desc' },
        select: { id: true, displayName: true, email: true, phone: true, telegram: true, privateNotes: true } }),
      tx.agentIntroduction.findMany({ where: introductionsWhere(ctx), take: 100, orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, agentIdentityId: true, relationship: { select: { displayName: true } },
          opportunity: { select: { id: true, title: true, type: true, stage: true, nextActionAt: true } },
          handover: { select: { id: true, status: true, createdAt: true, coordinator: { select: { firstName: true, lastName: true } } } } } }),
      tx.crmActivity.findMany({ where: { workspaceId, opportunity: {
        agentIntroduction: introductionsWhere(ctx) } }, take: 100, orderBy: { dueAt: 'asc' },
        select: { id: true, subject: true, dueAt: true, status: true, type: true } }),
      tx.agentQuote.findMany({ where: { workspaceId, introduction: introductionsWhere(ctx) },
        take: 100, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true,
          amountSatang: true, feeSatang: true, depositSatang: true, expiresAt: true } }),
      tx.agentKnowledgeArticle.findMany({ where: { status: 'published', locale,
        publishedAt: { lte: new Date() }, expiresAt: { gt: new Date() },
        ...(query.trim() ? { OR: [{ title: { contains: query.slice(0,200), mode: 'insensitive' } },
          { body: { contains: query.slice(0,200), mode: 'insensitive' } }] } : {}) },
        select: { id: true, title: true, body: true, sourceUrl: true, publishedAt: true, expiresAt: true },
        take: 30, orderBy: { publishedAt: 'desc' } }),
      tx.organizationMembership.findMany({ where: { organization: { crmWorkspace: { id: workspaceId } }, status: 'active' },
        select: { role: true, identity: { select: { firstName: true, lastName: true } } }, take: 100 }),
      tx.agentCommission.findMany({ where: { introduction: introductionsWhere(ctx) }, take: 100,
        select: { id: true, amountSatang: true, currency: true, status: true, dueAt: true, targetAt: true, deadlineAt: true,
          introduction: { select: { opportunity: { select: { title: true } } } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    return serialize({ ctx, contacts, opportunities, activities, quotes, knowledge, members, commissions });
  });
}

export async function agentAction(db: PrismaClient, actorId: string, workspaceId: string,
  resource: string, input: Record<string, unknown>) {
  return db.$transaction(async tx => {
    const ctx = await getAgentContext(tx, actorId, workspaceId);
    switch (resource) {
      case 'contacts': {
        const fields = contactInput(input);
        // Supplied channels remain private. Identity matching never returns
        // canonical PII or the existence of another agency's relationship.
        const locks = [fields.email, fields.phone, fields.telegram].filter((v): v is string => Boolean(v)).sort();
        for (const key of locks) await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',key);
        const canonical = await tx.identity.findMany({
          where: { OR: [...(fields.email ? [{ email: fields.email }] : []), ...(fields.phone ? [{ phone: fields.phone }] : [])] },
          select: { id: true, status: true },
        });
        const related = await tx.crmContactRelationship.findMany({
          where: { OR: [...(fields.email ? [{ email: fields.email }] : []), ...(fields.phone ? [{ phone: fields.phone }] : []),
            ...(fields.telegram ? [{ telegram: { equals: fields.telegram, mode: 'insensitive' as const } }] : [])] },
          select: { identity: { select: { id: true, status: true } } },
        });
        const candidates = [...canonical, ...related.map(r => r.identity)];
        const ids = [...new Set(candidates.map(r => r.id))];
        if (ids.length > 1 || candidates.some(r => !['active','invited'].includes(r.status))) throw new AgentError('identity_assistance_required',409);
        const identityId = ids[0] ?? (await tx.identity.create({ data: {
          firstName: fields.displayName, lastName: '', status: 'invited',
        }, select: { id: true } })).id;
        const existing = await tx.crmContactRelationship.findUnique({ where: { workspaceId_identityId: { workspaceId, identityId } } });
        if (existing) throw new AgentError('contact_already_registered',409);
        const row = await tx.crmContactRelationship.create({ data: {
          ...fields, workspaceId, identityId, ownerIdentityId: actorId,
        } });
        await audit(tx,actorId,'agent.contact.created',row.id,workspaceId);
        return { id: row.id };
      }
      case 'opportunities': {
        const relationship = await tx.crmContactRelationship.findFirst({
          where: { id: text(input.relationshipId), ...contactsWhere(ctx) },
        });
        if (!relationship) throw new AgentError('record_not_found',404);
        const type = input.type;
        if (!['rental','purchase','sale'].includes(String(type))) throw new AgentError('invalid_opportunity_type');
        const opportunity = await tx.crmOpportunity.create({ data: {
          identityId: relationship.identityId, assignedToIdentityId: relationship.ownerIdentityId,
          type: type as 'rental'|'purchase'|'sale', title: text(input.title), source: 'agent_portal',
        } });
        const row = await tx.agentIntroduction.create({ data: {
          workspaceId, relationshipId: relationship.id, opportunityId: opportunity.id, agentIdentityId: relationship.ownerIdentityId,
        } });
        await audit(tx,actorId,'agent.introduction.recorded',row.id,workspaceId);
        return { id: row.id, recordedAt: row.createdAt.toISOString() };
      }
      case 'stage': {
        const row = await introduction(tx,ctx,text(input.introductionId));
        const stage = text(input.stage);
        if (!['new','qualified','discovery','proposal','negotiation','nurture','lost'].includes(stage)) throw new AgentError('invalid_stage');
        if (['won','lost'].includes(row.opportunity.stage)) throw new AgentError('opportunity_terminal',409);
        const lostReason = stage === 'lost' ? text(input.lostReason,1000) : null;
        await tx.crmOpportunity.update({ where: { id: row.opportunityId }, data: {
          stage: stage as 'qualified', lostReason, lostAt: stage === 'lost' ? new Date() : null,
        } });
        await audit(tx,actorId,'agent.opportunity.stage.'+stage,row.opportunityId,workspaceId);
        return { id: row.id };
      }
      case 'activities': {
        const row = await introduction(tx,ctx,text(input.introductionId));
        const dueAt = new Date(text(input.dueAt,40));
        if (!Number.isFinite(dueAt.getTime())) throw new AgentError('invalid_date');
        const activity = await tx.crmActivity.create({ data: {
          workspaceId, identityId: row.opportunity.identityId, opportunityId: row.opportunityId,
          createdByIdentityId: actorId, type: 'task', subject: text(input.subject), dueAt,
        } });
        await tx.crmOpportunity.update({ where: { id: row.opportunityId }, data: { nextActionAt: dueAt } });
        await audit(tx,actorId,'agent.activity.created',activity.id,workspaceId);
        return { id: activity.id };
      }
      case 'complete-activity': {
        const row = await tx.crmActivity.findFirst({ where: { id: text(input.id), workspaceId,
          opportunity: { agentIntroduction: introductionsWhere(ctx) } } });
        if (!row) throw new AgentError('record_not_found',404);
        await tx.crmActivity.update({ where: { id: row.id }, data: { status: 'completed', completedAt: new Date() } });
        const next = await tx.crmActivity.findFirst({ where: {
          opportunityId: row.opportunityId, workspaceId, status: 'open', dueAt: { not: null },
        }, orderBy: { dueAt: 'asc' }, select: { dueAt: true } });
        await tx.crmOpportunity.update({ where: { id: row.opportunityId! }, data: { nextActionAt: next?.dueAt ?? null } });
        await audit(tx,actorId,'agent.activity.completed',row.id,workspaceId);
        return { id: row.id };
      }
      case 'handovers': {
        const row = await introduction(tx,ctx,text(input.introductionId));
        if (input.consentConfirmed !== true) throw new AgentError('sharing_consent_required');
        const handover = await tx.agentHandover.upsert({
          where: { introductionId: row.id }, update: {}, create: {
            introductionId: row.id, request: text(input.request,4000), sharedByIdentityId: actorId,
            consentConfirmedAt: new Date(), contactSnapshot: {
              displayName: row.relationship.displayName, email: row.relationship.email,
              phone: row.relationship.phone, telegram: row.relationship.telegram,
            },
          },
        });
        await audit(tx,actorId,'agent.handover.requested',handover.id,workspaceId);
        return { id: handover.id, status: handover.status };
      }
      case 'quotes': {
        const row = await introduction(tx,ctx,text(input.introductionId));
        const offering = await tx.commercialOffering.findFirst({ where: { id: text(input.offeringId),
          status: 'active', unit: { status: 'live', project: { status: 'live' } }, offeringType: { in: ['sale','long_term_rental'] } } });
        if (!offering?.unitId) throw new AgentError('offering_unavailable',409);
        const home = await getPublicCommercialHomeById(db,offering.unitId);
        if (!home?.intents.includes(offering.offeringType === 'sale' ? 'buy' : 'rent')) throw new AgentError('offering_unavailable',409);
        if ((row.opportunity.type === 'rental') !== (offering.offeringType === 'long_term_rental')) throw new AgentError('offering_type_mismatch');
        const amountSatang = amount(input.amountSatang);
        if (amountSatang <= 0n) throw new AgentError('invalid_amount');
        const result = await tx.agentQuote.create({ data: {
          workspaceId, introductionId: row.id, offeringId: offering.id, createdByIdentityId: actorId,
          title: text(input.title), amountSatang, feeSatang: amount(input.feeSatang),
          depositSatang: amount(input.depositSatang), terms: text(input.terms,8000), expiresAt: expires(input.expiresAt),
        } });
        await audit(tx,actorId,'agent.quote.drafted',result.id,workspaceId);
        return { id: result.id };
      }
      case 'submit-quote': {
        const row = await quote(tx,ctx,text(input.id));
        if (row.status !== 'draft' || row.expiresAt <= new Date()) throw new AgentError('quote_not_submittable',409);
        await tx.agentQuote.update({ where: { id: row.id }, data: { status: 'submitted' } });
        await audit(tx,actorId,'agent.quote.submitted',row.id,workspaceId);
        return { id: row.id };
      }
      case 'revoke-quote': {
        const row = await quote(tx,ctx,text(input.id));
        await tx.agentQuote.update({ where: { id: row.id }, data: { status: 'revoked' } });
        if (row.version) await tx.agentQuoteShare.updateMany({ where: { versionId: row.version.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await audit(tx,actorId,'agent.quote.revoked',row.id,workspaceId);
        return { id: row.id };
      }
      case 'shares': {
        const row = await quote(tx,ctx,text(input.id));
        if (row.status !== 'approved' || !row.version || row.expiresAt <= new Date()) throw new AgentError('quote_not_shareable',409);
        const token = randomBytes(32).toString('hex');
        const share = await tx.agentQuoteShare.create({ data: {
          versionId: row.version.id, createdByIdentityId: actorId,
          tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: row.expiresAt,
        } });
        await audit(tx,actorId,'agent.share.created',share.id,workspaceId);
        // A share link exists; this never means a messenger has sent it.
        return { id: share.id, path: '/p/'+token };
      }
      default: throw new AgentError('unknown_action',404);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getAgentInventory(db: PrismaClient, actorId: string, workspaceId: string) {
  await getAgentContext(db,actorId,workspaceId);
  const homes = await listPublicCommercialHomes(db);
  const offerings = await db.commercialOffering.findMany({ where: {
    unitId: { in: homes.map(h=>h.id) }, status: 'active', offeringType: { in: ['sale','long_term_rental'] },
  }, select: { id: true, unitId: true, offeringType: true } });
  return homes.map(home => ({ ...home, offerings: offerings.filter(o => o.unitId === home.id &&
    home.intents.includes(o.offeringType === 'sale' ? 'buy' : 'rent')) }));
}

async function requireAdmin(db: Db, actorId: string) {
  const actor = await db.identity.findFirst({ where: { id: actorId, status: 'active', isAdmin: true }, select: { id: true } });
  if (!actor) throw new AgentError('forbidden',403);
}
export async function getAgentAdminDashboard(db: PrismaClient, actorId: string) {
  await requireAdmin(db,actorId);
  const [workspaces, quotes, handovers, knowledge] = await Promise.all([
    db.crmWorkspace.findMany({ select: { id: true, active: true, organization: {
      select: { id: true, name: true, status: true, memberships: { select: {
        id: true, status: true, role: true, identity: { select: { firstName: true, lastName: true } },
      } } } } }, take:100 }),
    // Queue is a client quote projection, without private contacts or notes.
    db.agentQuote.findMany({ where: { status: 'submitted' }, select: {
      id:true,title:true,amountSatang:true,feeSatang:true,depositSatang:true,terms:true,expiresAt:true,
      workspace: { select: { organization: { select: { name:true } } } },
      offering: { select: { offeringType:true, unit: { select: { name:true } } } },
    },take:100,orderBy:{createdAt:'asc'} }),
    db.agentHandover.findMany({ select: { id:true,status:true,request:true,contactSnapshot:true,createdAt:true,
      coordinator: { select:{firstName:true,lastName:true} },
      introduction:{select:{id:true,createdAt:true,opportunity:{select:{id:true,title:true,stage:true,type:true}},
        agent:{select:{firstName:true,lastName:true}},workspace:{select:{organization:{select:{name:true}}}}}},
    }, take:100,orderBy:{createdAt:'desc'} }),
    db.agentKnowledgeArticle.findMany({ take:100,orderBy:{updatedAt:'desc'},
      select:{id:true,title:true,locale:true,body:true,sourceUrl:true,status:true,expiresAt:true} }),
  ]);
  return serialize({workspaces,quotes,handovers,knowledge});
}
export async function adminAgentAction(db: PrismaClient, actorId: string, input: Record<string,unknown>) {
  await requireAdmin(db,actorId);
  let home = null;
  if (input.action === 'approve-quote') {
    const candidate = await db.agentQuote.findUnique({where:{id:text(input.id)},include:{offering:true}});
    if (!candidate?.offering.unitId) throw new AgentError('record_not_found',404);
    home = await getPublicCommercialHomeById(db,candidate.offering.unitId);
    const kind = candidate.offering.offeringType === 'sale' ? 'buy' : 'rent';
    if (!home?.intents.includes(kind)) throw new AgentError('offering_unavailable',409);
  }
  return db.$transaction(async tx=>{
    await requireAdmin(tx,actorId);
    switch(input.action) {
      case 'provision': {
        const member = await tx.identity.findFirst({where:{email:text(input.email,254).toLowerCase(),status:'active'},select:{id:true}});
        if (!member) throw new AgentError('member_must_register_first');
        const organization = await tx.organization.create({data:{
          name:text(input.name),orgType:'brokerage',contactEmail:text(input.email,254).toLowerCase(),contactPhone:'',
          memberships:{create:{identityId:member.id,role:'manager'}},crmWorkspace:{create:{}},
        },select:{crmWorkspace:{select:{id:true}}}});
        await audit(tx,actorId,'agent.workspace.provisioned',organization.crmWorkspace!.id);
        return {id:organization.crmWorkspace!.id};
      }
      case 'add-member': {
        const workspace = await tx.crmWorkspace.findUnique({where:{id:text(input.workspaceId)}});
        const member = await tx.identity.findFirst({where:{email:text(input.email,254).toLowerCase(),status:'active'},select:{id:true}});
        if (!workspace || !member) throw new AgentError('record_not_found',404);
        const role = input.role === 'manager' ? 'manager' : 'agent';
        const membership = await tx.organizationMembership.upsert({where:{organizationId_identityId:{
          organizationId:workspace.organizationId,identityId:member.id}},update:{role,status:'active'},
          create:{organizationId:workspace.organizationId,identityId:member.id,role}});
        await audit(tx,actorId,'agent.membership.granted',membership.id,workspace.id);
        return {id:membership.id};
      }
      case 'revoke-member': {
        const membership = await tx.organizationMembership.update({where:{id:text(input.id)},data:{status:'revoked'}});
        await audit(tx,actorId,'agent.membership.revoked',membership.id);
        return {id:membership.id};
      }
      case 'toggle-workspace': {
        if(typeof input.active !== 'boolean') throw new AgentError('invalid_active');
        const workspace = await tx.crmWorkspace.update({where:{id:text(input.id)},data:{active:input.active}});
        await audit(tx,actorId,input.active?'agent.workspace.activated':'agent.workspace.suspended',workspace.id);
        return {id:workspace.id};
      }
      case 'approve-quote': {
        const row = await tx.agentQuote.findUnique({where:{id:text(input.id)},include:{offering:true}});
        if (!row || row.status !== 'submitted' || row.expiresAt <= new Date() || !home ||
            row.offering.status !== 'active') throw new AgentError('quote_not_approvable',409);
        await getAgentContext(tx,row.createdByIdentityId,row.workspaceId);
        const version = await tx.agentQuoteVersion.create({data:{
          quoteId:row.id,approvedByIdentityId:actorId,snapshot:{
            title:row.title,home:{name:home.name,project:home.project.name,bedrooms:home.bedrooms,bathrooms:home.bathrooms,sizeSqm:home.sizeSqm},
            offeringType:row.offering.offeringType,currency:row.currency,
            amountSatang:row.amountSatang.toString(),feeSatang:row.feeSatang.toString(),
            depositSatang:row.depositSatang.toString(),totalSatang:(row.amountSatang+row.feeSatang).toString(),
            terms:row.terms,expiresAt:row.expiresAt.toISOString(),
          },
        }});
        await tx.agentQuote.update({where:{id:row.id},data:{status:'approved'}});
        await audit(tx,actorId,'agent.quote.approved',version.id,row.workspaceId);
        return {id:version.id};
      }
      case 'handover-status': {
        if (!['acknowledged','completed','declined'].includes(String(input.status))) throw new AgentError('invalid_status');
        const row = await tx.agentHandover.update({where:{id:text(input.id)},data:{
          status:input.status as 'acknowledged',coordinatorIdentityId:actorId,
        }});
        await audit(tx,actorId,'agent.handover.'+row.status,row.id);
        return {id:row.id};
      }
      case 'knowledge-draft': {
        const sourceUrl = new URL(text(input.sourceUrl,2000));
        if (!['https:','http:'].includes(sourceUrl.protocol)) throw new AgentError('invalid_source_url');
        const locale = text(input.locale,5);
        if (!['en','ru','th','zh'].includes(locale)) throw new AgentError('invalid_locale');
        const row = await tx.agentKnowledgeArticle.create({data:{
          title:text(input.title),body:text(input.body,20000),locale,sourceUrl:sourceUrl.toString(),expiresAt:expires(input.expiresAt),
        }});
        await audit(tx,actorId,'agent.knowledge.drafted',row.id);
        return {id:row.id};
      }
      case 'publish-knowledge':
      case 'withdraw-knowledge': {
        const row = await tx.agentKnowledgeArticle.findUnique({where:{id:text(input.id)}});
        if(!row) throw new AgentError('record_not_found',404);
        if (input.action === 'publish-knowledge' && (row.status !== 'draft' || row.expiresAt <= new Date())) throw new AgentError('knowledge_not_publishable',409);
        await tx.agentKnowledgeArticle.update({where:{id:row.id},data:input.action === 'publish-knowledge'
          ?{status:'published',publishedAt:new Date(),reviewedByIdentityId:actorId}:{status:'withdrawn'}});
        await audit(tx,actorId,'agent.knowledge.'+String(input.action),row.id);
        return {id:row.id};
      }
      default: throw new AgentError('unknown_action',404);
    }
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function resolveAgentShare(db: PrismaClient, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const share = await db.agentQuoteShare.findUnique({where:{
    tokenHash:createHash('sha256').update(token).digest('hex'),
  },include:{version:{include:{quote:{include:{offering:true,workspace:{include:{organization:true}}}}}}}});
  if(!share || share.revokedAt || share.expiresAt<=new Date() ||
      share.version.quote.status !== 'approved' || !share.version.quote.workspace.active ||
      share.version.quote.workspace.organization.status !== 'active' ||
      share.version.quote.offering.status !== 'active' || !share.version.quote.offering.unitId) return null;
  try { await getAgentContext(db,share.createdByIdentityId,share.version.quote.workspaceId); }
  catch(error) { if(error instanceof AgentError) return null; throw error; }
  const home=await getPublicCommercialHomeById(db,share.version.quote.offering.unitId);
  const intent=share.version.quote.offering.offeringType==='sale'?'buy':'rent';
  if (!home?.intents.includes(intent)) return null;
  return share.version.snapshot;
}
