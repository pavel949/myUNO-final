import { PrismaClient, IntegrationKey, IntegrationScopeType, IntegrationStatus } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/encryption';

export type IntegrationEnvironment = 'production' | 'preview' | 'development' | 'test';

export interface IntegrationAccountConfig {
  /**
   * Environment is part of the external-system identity. It prevents a preview
   * or test registration from silently replacing production credentials for
   * the same integration key and scope in a shared database.
   */
  environment: IntegrationEnvironment;
  [key: string]: any; // Integration-specific config, encrypted per doc 12
}

/**
 * Infer a safe runtime environment for callers that do not explicitly supply
 * one yet. Vercel preview and production are distinct; local tests never
 * masquerade as production.
 */
export function currentIntegrationEnvironment(): IntegrationEnvironment {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  if (process.env.NODE_ENV === 'test') return 'test';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

/** Ensure every new registration carries an explicit canonical environment. */
function normalizeConfig(config: Partial<IntegrationAccountConfig>): IntegrationAccountConfig {
  return {
    ...config,
    environment: config.environment ?? currentIntegrationEnvironment(),
  } as IntegrationAccountConfig;
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

function decryptConfig(stored: unknown): Partial<IntegrationAccountConfig> {
  if (typeof stored === 'string') {
    try {
      return JSON.parse(decrypt(stored)) as Partial<IntegrationAccountConfig>;
    } catch {
      return {};
    }
  }
  return (stored ?? {}) as Partial<IntegrationAccountConfig>;
}

/**
 * Register one integration account for the current environment.
 *
 * The present schema has one row per integration key/scope. Until environment
 * becomes a first-class indexed column, fail closed rather than allowing an
 * account created by another environment to be overwritten in place.
 */
export async function registerIntegrationAccount(
  db: PrismaClient,
  integrationKey: IntegrationKey,
  scopeType: IntegrationScopeType,
  config: Partial<IntegrationAccountConfig>,
  scopeId?: string, // projectId or unitId
) {
  const projectId = scopeType === 'project' ? scopeId : null;
  const unitId = scopeType === 'unit' ? scopeId : null;
  const normalized = normalizeConfig(config);

  let account = await db.integrationAccount.findFirst({
    where: {
      integrationKey,
      scopeType,
      projectId,
      unitId,
    },
  });

  if (account) {
    const existing = decryptConfig(account.config);
    const existingEnvironment = existing.environment;
    if (existingEnvironment && existingEnvironment !== normalized.environment) {
      throw new Error(
        `Integration environment mismatch: existing=${existingEnvironment}, requested=${normalized.environment}`
      );
    }

    return await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        config: encryptConfig(normalized),
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
      config: encryptConfig(normalized),
      status: IntegrationStatus.active,
    },
  });
}

/**
 * Decrypt an account's config for an adapter and surface its environment.
 * Legacy rows are read using the caller's current environment but should be
 * resaved before federation is enabled so their environment becomes explicit.
 */
export function getDecryptedConfig(account: { config: unknown }): IntegrationAccountConfig {
  return normalizeConfig(decryptConfig(account.config));
}

export async function getIntegrationAccount(
  db: PrismaClient,
  integrationKey: IntegrationKey,
  scopeType: IntegrationScopeType,
  scopeId?: string,
  environment: IntegrationEnvironment = currentIntegrationEnvironment(),
) {
  const projectId = scopeType === 'project' ? scopeId : null;
  const unitId = scopeType === 'unit' ? scopeId : null;

  const account = await db.integrationAccount.findFirst({
    where: {
      integrationKey,
      scopeType,
      projectId,
      unitId,
    },
  });
  if (!account) return null;

  const config = decryptConfig(account.config);
  if (config.environment && config.environment !== environment) return null;
  return account;
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

/**
 * List only accounts that belong to the requested/current environment.
 * Legacy environment-less rows are included for backward compatibility until
 * they are explicitly resaved.
 */
export async function listIntegrationAccounts(
  db: PrismaClient,
  scopeType: IntegrationScopeType,
  scopeId?: string,
  environment: IntegrationEnvironment = currentIntegrationEnvironment(),
) {
  const [projectId, unitId] = scopeType === 'project'
    ? [scopeId, undefined]
    : scopeType === 'unit'
      ? [undefined, scopeId]
      : [undefined, undefined];

  const accounts = await db.integrationAccount.findMany({
    where: {
      scopeType,
      ...(projectId && { projectId }),
      ...(unitId && { unitId }),
    },
    orderBy: { updatedAt: 'desc' },
  });

  return accounts.filter((account) => {
    const config = decryptConfig(account.config);
    return !config.environment || config.environment === environment;
  });
}
