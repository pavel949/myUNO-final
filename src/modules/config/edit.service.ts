import { PrismaClient } from '@prisma/client';
import { ConfigKey } from './types';
import { getConfig, invalidateConfig } from './config.service';

interface ConfigChangeInput {
  identityId: string;
  paramKey: ConfigKey;
  newValue: any;
  projectId?: string;
  unitId?: string;
}

/**
 * Validation rules for specific config parameters
 */
const VALIDATION_RULES: Record<string, (value: any) => { valid: boolean; error?: string }> = {
  'compliance.tm30_sla_hours': (value: any) => {
    if (typeof value !== 'number' || value < 0 || value > 24) {
      return { valid: false, error: 'tm30_sla_hours must be between 0 and 24 hours' };
    }
    return { valid: true };
  },
  'booking.hold_minutes': (value: any) => {
    if (typeof value !== 'number' || value <= 0) {
      return { valid: false, error: 'hold_minutes must be positive' };
    }
    return { valid: true };
  },
  'pricing.season.calendar': (value: any) => {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'season calendar must be an array' };
    }
    for (const season of value) {
      if (!season.name || !season.from || !season.to || typeof season.markup_pct !== 'number') {
        return {
          valid: false,
          error: 'Each season must have name, from (MM-DD), to (MM-DD), and markup_pct',
        };
      }
    }
    return { valid: true };
  },
};

/**
 * Update a configuration parameter and log the change
 */
export async function updateConfigParameter(
  db: PrismaClient,
  input: ConfigChangeInput
): Promise<void> {
  const { identityId, paramKey, newValue, projectId, unitId } = input;

  // Validate the parameter value against business rules
  const validator = VALIDATION_RULES[paramKey];
  if (validator) {
    const validation = validator(newValue);
    if (!validation.valid) {
      throw new Error(validation.error || `Invalid value for ${paramKey}`);
    }
  }

  // Determine the scope
  let scopeType = 'global';
  let scopeId = 'global';
  if (unitId) {
    scopeType = 'unit';
    scopeId = unitId;
  } else if (projectId) {
    scopeType = 'project';
    scopeId = projectId;
  }

  // Get the old value for the change record
  const oldValue = await getConfig(db, paramKey, { projectId, unitId });

  // Write or update the override
  await db.configOverride.upsert({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: paramKey as string,
        scopeType,
        scopeId,
      },
    },
    update: {
      value: newValue as any,
      updatedByIdentityId: identityId,
    },
    create: {
      parameterKey: paramKey as string,
      scopeType,
      scopeId,
      value: newValue as any,
      updatedByIdentityId: identityId,
    },
  });

  // Log the change
  await db.configChange.create({
    data: {
      parameterKey: paramKey as string,
      scopeType,
      scopeId,
      oldValue: oldValue as any,
      newValue: newValue as any,
      changedByIdentityId: identityId,
    } as any,
  });

  // Invalidate cache so the new value takes effect immediately
  invalidateConfig(paramKey as string);
}

/**
 * Clear an override and revert to the next level down
 */
export async function clearConfigOverride(
  db: PrismaClient,
  identityId: string,
  paramKey: ConfigKey,
  projectId?: string,
  unitId?: string
): Promise<void> {
  // Determine the scope
  let scopeType = 'global';
  let scopeId = 'global';
  if (unitId) {
    scopeType = 'unit';
    scopeId = unitId;
  } else if (projectId) {
    scopeType = 'project';
    scopeId = projectId;
  }

  // Get the current value before deletion
  const oldValue = await getConfig(db, paramKey, { projectId, unitId });

  // Delete the override
  // deleteMany is idempotent — clearing a scope with no override is a no-op,
  // not an error (delete() would throw P2025).
  await db.configOverride.deleteMany({
    where: {
      parameterKey: paramKey as string,
      scopeType,
      scopeId,
    },
  });

  // Log the change as a revert
  await db.configChange.create({
    data: {
      parameterKey: paramKey as string,
      scopeType,
      scopeId,
      oldValue: oldValue as any,
      newValue: null,
      changedByIdentityId: identityId,
    } as any,
  });

  // Invalidate cache so the reverted value takes effect immediately
  invalidateConfig(paramKey as string);
}
