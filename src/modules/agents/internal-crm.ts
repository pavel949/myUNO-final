import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function restrictPrivateActivities(args: Record<string,unknown>) {
  for (const mode of ['select','include']) {
    const projection=args[mode] as Record<string,unknown>|undefined;
    if(!projection) continue;
    if(projection.activities) {
      const relation=projection.activities===true?{}:projection.activities as Record<string,unknown>;
      projection.activities={...relation,where:{AND:[relation.where??{},{workspaceId:null}]}};
    }
    const count=projection._count as {select?:Record<string,unknown>}|undefined;
    if(count?.select?.activities) count.select.activities={where:{workspaceId:null}};
    if(projection._count===true) projection._count={select:{activities:{where:{workspaceId:null}}}};
  }
}

/**
 * The existing CRM remains an internal workspace. Private agency records are
 * reached exclusively through agent services and the explicit handover queue.
 * This also scopes direct-ID and aggregate calls in legacy endpoints.
 */
const scopedOperations = new Set([
  'findUnique','findUniqueOrThrow','findFirst','findFirstOrThrow','findMany',
  'count','aggregate','groupBy','update','updateMany','delete','deleteMany',
]);
export const internalCrm = prisma.$extends({
  query: {
    crmOpportunity: {
      async $allOperations({operation,args,query}) {
        if(scopedOperations.has(operation)) {
          const value=args as {where?:Prisma.CrmOpportunityWhereInput};
          value.where={AND:[value.where??{},{OR:[{agentIntroduction:{is:null}},{agentIntroduction:{handover:{isNot:null}}}]}]};
          restrictPrivateActivities(args as Record<string,unknown>);
        }
        return query(args);
      },
    },
    crmActivity: {
      async $allOperations({operation,args,query}) {
        if(scopedOperations.has(operation)) {
          const value=args as {where?:Prisma.CrmActivityWhereInput};
          value.where={AND:[value.where??{},{workspaceId:null}]};
        }
        if(operation==='create') {
          const data=(args as Prisma.CrmActivityCreateArgs).data;
          if(('workspaceId' in data && data.workspaceId) || ('workspace' in data && data.workspace)) throw new Error('private_workspace_requires_scoped_service');
          const opportunityId='opportunityId' in data ? data.opportunityId : data.opportunity?.connect?.id;
          if(opportunityId && await prisma.agentIntroduction.count({where:{opportunityId,handover:{is:null}}}))
            throw new Error('private_opportunity_requires_scoped_service');
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;
