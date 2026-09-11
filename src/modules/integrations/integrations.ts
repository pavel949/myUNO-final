import { PrismaClient, IntegrationKey, IntegrationScopeType, IntegrationStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/encryption';

export interface IntegrationAccountConfig {
  [key: string]: any; // Integration-specific config, encrypted per doc 12
}

/**
 * Integration configs carry credentials (API tokens, portal passwords), so
 * the JSON is AES-256-GCM encrypted before storage: the `config` column
 * holds a single ciphertext string. Reads go through decryptConfig, which
 * also accepts legacy plaintext objects (pre-encryption rows).
 */
function encryptConfig(config: IntegrationAccountConfig): string {
  return encrypt(JSON.stringify(config));
}

function decryptConfig(stored: unknown): IntegrationAccountConfig {
  if (typeof stored === 'string') {
    try {
      return JSON.parse(decrypt(stored)) as IntegrationAccountConfig;
    } catch {
      return {};
    }
  }
  // Legacy plaintext object
  return (stored ?? {}) as IntegrationAccountConfig;
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
        config: encryptConfig(config),
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
      config: encryptConfig(config),
      status: IntegrationStatus.active,
    },
  });
}

/** Decrypt an account's config for use by an adapter. */
export function getDecryptedConfig(account: { config: unknown }): IntegrationAccountConfig {
  return decryptConfig(account.config);
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
