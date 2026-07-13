import { PrismaClient, Prisma } from '@prisma/client';
import { AllConfig, ConfigKey } from './types';

const CACHE_TTL_SECONDS = 60;

interface CacheEntry {
  value: any;
  expiresAt: number;
}

/**
 * In-memory cache for config values with TTL
 */
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
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new ConfigCache();

/**
 * Build a cache key from parameter key and scope
 */
function getCacheKey(
  paramKey: string,
  unitId?: string,
  projectId?: string
): string {
  if (unitId) return `${paramKey}:unit:${unitId}`;
  if (projectId) return `${paramKey}:project:${projectId}`;
  return `${paramKey}:global`;
}

/**
 * Get a configuration value with resolution order: unit → project → global
 */
export async function getConfig<K extends ConfigKey>(
  db: PrismaClient,
  key: K,
  options?: { unitId?: string; projectId?: string }
): Promise<AllConfig[K] | undefined> {
  const unitId = options?.unitId;
  const projectId = options?.projectId;

  // Try unit-level cache first
  if (unitId) {
    const cacheKey = getCacheKey(key, unitId);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  // Try project-level cache
  if (projectId && !unitId) {
    const cacheKey = getCacheKey(key, undefined, projectId);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  // Try global cache
  if (!unitId && !projectId) {
    const cacheKey = getCacheKey(key);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  // Resolve from database
  let value: any = undefined;

  // 1. Try unit-level override
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

  // 2. Try project-level override
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

  // 3. Get global default from ConfigParameter
  const param = await db.configParameter.findUnique({
    where: { key },
  });

  if (param) {
    value = param.defaultValue;
    cache.set(getCacheKey(key), value);
    return value;
  }

  return undefined;
}

/**
 * Set a configuration override and invalidate cache
 */
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
  // Get current value for audit trail
  const existing = await db.configOverride.findUnique({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: key,
        scopeType: options.scopeType,
        scopeId: options.scopeId,
      },
    },
  });

  // Upsert the override
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

  // Write audit log
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

  // Invalidate cache for this parameter
  cache.invalidatePrefix(key);
}

/**
 * Clear the entire config cache (e.g., when database is reset in tests)
 */
export function clearConfigCache(): void {
  cache.clear();
}
