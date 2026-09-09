import { PrismaClient, Prisma } from '@prisma/client';
import { AllConfig, ConfigKey } from './types';

const CACHE_TTL_SECONDS = 60;

interface CacheEntry {
  value: any;
  expiresAt: number;
}

/** Reject config values that can invalidate a contractual service-order window. */
function validateProtectedOverride(key: string, value: any): void {
  if (key === 'service.fulfilment_confirm_window_hours') {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('fulfilment confirm window must be a positive whole number of hours');
    }
  }
}

class ConfigCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new ConfigCache();

function getCacheKey(paramKey: string, unitId?: string, projectId?: string): string {
  if (unitId) return `${paramKey}:unit:${unitId}`;
  if (projectId) return `${paramKey}:project:${projectId}`;
  return `${paramKey}:global`;
}

export async function getConfig<K extends ConfigKey>(
  db: PrismaClient,
  key: K,
  options?: { unitId?: string; projectId?: string }
): Promise<AllConfig[K] | undefined> {
  const unitId = options?.unitId;
  const projectId = options?.projectId;

  if (unitId) {
    const cacheKey = getCacheKey(key, unitId);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  if (projectId && !unitId) {
    const cacheKey = getCacheKey(key, undefined, projectId);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  if (!unitId && !projectId) {
    const cacheKey = getCacheKey(key);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  let value: any = undefined;

  if (unitId) {
    const override = await db.configOverride.findUnique({
      where: {
        parameterKey_scopeType_scopeId: {
          parameterKey: key,
          scopeType: 'unit',
          scopeId: unitId,
        },
      },
    });
    if (override) {
      value = override.value;
      cache.set(getCacheKey(key, unitId), value);
      return value;
    }
  }

  if (projectId) {
    const override = await db.configOverride.findUnique({
      where: {
        parameterKey_scopeType_scopeId: {
          parameterKey: key,
          scopeType: 'project',
          scopeId: projectId,
        },
      },
    });
    if (override) {
      value = override.value;
      cache.set(getCacheKey(key, undefined, projectId), value);
      return value;
    }
  }

  const globalOverride = await db.configOverride.findUnique({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: key,
        scopeType: 'global',
        scopeId: 'global',
      },
    },
  });
  if (globalOverride) {
    value = globalOverride.value;
    cache.set(getCacheKey(key), value);
    return value;
  }

  const param = await db.configParameter.findUnique({ where: { key } });
  if (param) {
    value = param.defaultValue;
    cache.set(getCacheKey(key), value);
    return value;
  }

  return undefined;
}

export async function setConfigOverride(
  db: PrismaClient,
  key: string,
  value: any,
  options: {
    scopeType: 'project' | 'unit';
    scopeId: string;
    changedByIdentityId: string;
  }
): Promise<void> {
  validateProtectedOverride(key, value);

  const existing = await db.configOverride.findUnique({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: key,
        scopeType: options.scopeType,
        scopeId: options.scopeId,
      },
    },
  });

  await db.configOverride.upsert({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: key,
        scopeType: options.scopeType,
        scopeId: options.scopeId,
      },
    },
    create: {
      parameterKey: key,
      scopeType: options.scopeType,
      scopeId: options.scopeId,
      value,
      updatedByIdentityId: options.changedByIdentityId,
    },
    update: {
      value,
      updatedByIdentityId: options.changedByIdentityId,
    },
  });

  await db.configChange.create({
    data: {
      parameterKey: key,
      scopeType: options.scopeType,
      scopeId: options.scopeId,
      oldValue: existing?.value ?? Prisma.DbNull,
      newValue: value,
      changedByIdentityId: options.changedByIdentityId,
    },
  });

  cache.invalidatePrefix(key);
}

export function invalidateConfig(key: string): void {
  cache.invalidatePrefix(key);
}

export function clearConfigCache(): void {
  cache.clear();
}
