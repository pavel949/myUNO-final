import { PrismaClient, IntegrationKey, IntegrationScopeType, IntegrationStatus } from '@prisma/client';

export interface IntegrationAccountConfig {
  [key: string]: any; // Integration-specific config, encrypted per doc 12
}

export async function registerIntegrationAccount(
  db: PrismaClient,
  integrationKey: IntegrationKey,
  scopeType: IntegrationScopeType,
  config: IntegrationAccountConfig,
  scopeId?: string, // projectId or unitId
) {
  const projectId = scopeType === 'project' ? scopeId : null;
  const unitId = scopeType === 'unit' ? scopeId : null;

  // Find or create the integration account
  let account = await db.integrationAccount.findFirst({
    where: {
      integrationKey,
      scopeType,
      projectId,
      unitId,
    },
  });

  if (account) {
    return await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        config,
        status: IntegrationStatus.active,
      },
    });
  }

  return await db.integrationAccount.create({
    data: {
      integrationKey,
      scopeType,
      projectId,
      unitId,
      config,
      status: IntegrationStatus.active,
    },
  });
}

export async function getIntegrationAccount(
  db: PrismaClient,
  integrationKey: IntegrationKey,
  scopeType: IntegrationScopeType,
  scopeId?: string,
) {
  const projectId = scopeType === 'project' ? scopeId : null;
  const unitId = scopeType === 'unit' ? scopeId : null;

  return await db.integrationAccount.findFirst({
    where: {
      integrationKey,
      scopeType,
      projectId,
      unitId,
    },
  });
}

export async function updateIntegrationStatus(
  db: PrismaClient,
  accountId: string,
  status: IntegrationStatus,
  error?: string,
) {
  return await db.integrationAccount.update({
    where: { id: accountId },
    data: {
      status,
      lastError: error || null,
    },
  });
}

export async function recordIntegrationSync(
  db: PrismaClient,
  accountId: string,
  error?: string,
) {
  return await db.integrationAccount.update({
    where: { id: accountId },
    data: {
      lastSyncAt: new Date(),
      status: error ? IntegrationStatus.error : IntegrationStatus.active,
      lastError: error || null,
    },
  });
}

export async function disableIntegrationAccount(
  db: PrismaClient,
  accountId: string,
) {
  return await db.integrationAccount.update({
    where: { id: accountId },
    data: {
      status: IntegrationStatus.disabled,
    },
  });
}

export async function listIntegrationAccounts(
  db: PrismaClient,
  scopeType: IntegrationScopeType,
  scopeId?: string,
) {
  const [projectId, unitId] = scopeType === 'project'
    ? [scopeId, undefined]
    : scopeType === 'unit'
      ? [undefined, scopeId]
      : [undefined, undefined];

  return await db.integrationAccount.findMany({
    where: {
      scopeType,
      ...(projectId && { projectId }),
      ...(unitId && { unitId }),
    },
    orderBy: { updatedAt: 'desc' },
  });
}
