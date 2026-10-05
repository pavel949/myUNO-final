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

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
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

  // Cache every level independently, including a negative lookup. Pricing reads
  // are often unit-scoped but fall back to the same project/global values. The
  // previous implementation only checked project/global cache when no unitId
  // was supplied, so a 24-card search repeatedly queried identical fallback
  // rows for every unit and could saturate the serverless DB pool.
  if (unitId) {
    const unitKey = getCacheKey(key, unitId);
    if (cache.has(unitKey)) {
      const cached = cache.get(unitKey);
      if (cached !== undefined) return cached;
      // undefined is a cached "no unit override" marker; continue to project.
    } else {
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
        cache.set(unitKey, override.value);
        return override.value as AllConfig[K];
      }
      cache.set(unitKey, undefined);
    }
  }

  if (projectId) {
    const projectKey = getCacheKey(key, undefined, projectId);
    if (cache.has(projectKey)) {
      const cached = cache.get(projectKey);
      if (cached !== undefined) return cached;
      // undefined means no project override; continue to global.
    } else {
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
        cache.set(projectKey, override.value);
        return override.value as AllConfig[K];
      }
      cache.set(projectKey, undefined);
    }
  }

  const globalKey = getCacheKey(key);
  if (cache.has(globalKey)) {
    return cache.get(globalKey) as AllConfig[K] | undefined;
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
    cache.set(globalKey, globalOverride.value);
    return globalOverride.value as AllConfig[K];
  }

  const param = await db.configParameter.findUnique({
    where: { key },
  });

  const value = param?.defaultValue as AllConfig[K] | undefined;
  cache.set(globalKey, value);
  return value;
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
 * Invalidate every cached scope of one parameter key. Call after any write to
 * a parameter's value (override or default) so readers don't serve stale config.
 */
export function invalidateConfig(key: string): void {
  cache.invalidatePrefix(key);
}

/**
 * Clear the entire config cache (e.g., when database is reset in tests)
 */
export function clearConfigCache(): void {
  cache.clear();
}
