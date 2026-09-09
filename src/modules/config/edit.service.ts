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

const VALIDATION_RULES: Record<string, (value: any) => { valid: boolean; error?: string }> = {
  'compliance.tm30_sla_hours': (value: any) => {
    if (typeof value !== 'number' || value < 0 || value > 24) {
      return { valid: false, error: 'tm30_sla_hours must be between 0 and 24 hours' };
    }
    return { valid: true };
  },
  'auth.token_ttl_minutes.email_verify': (value: any) => {
    if (!Number.isInteger(value) || value <= 0) {
      return { valid: false, error: 'token TTL must be a positive whole number of minutes' };
    }
    return { valid: true };
  },
  'auth.token_ttl_minutes.password_reset': (value: any) => {
    if (!Number.isInteger(value) || value <= 0) {
      return { valid: false, error: 'token TTL must be a positive whole number of minutes' };
    }
    return { valid: true };
  },
  'compliance.expiry_warning_days': (value: any) => {
    if (!Number.isInteger(value) || value < 0) {
      return { valid: false, error: 'expiry warning must be a whole number of days, zero or more' };
    }
    return { valid: true };
  },
  'booking.hold_minutes': (value: any) => {
    if (typeof value !== 'number' || value <= 0) {
      return { valid: false, error: 'hold_minutes must be positive' };
    }
    return { valid: true };
  },
  'service.fulfilment_confirm_window_hours': (value: any) => {
    if (!Number.isInteger(value) || value <= 0) {
      return {
        valid: false,
        error: 'fulfilment confirm window must be a positive whole number of hours',
      };
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
  'pricing.category_rates': (value: any) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, error: 'category rates must be an object keyed by category' };
    }
    for (const [category, entry] of Object.entries(value as Record<string, any>)) {
      if (typeof entry !== 'object' || entry === null) {
        return { valid: false, error: `${category}: entry must be {nightly?, monthly?}` };
      }
      for (const [kind, minimum] of [
        ['nightly', 10_000],
        ['monthly', 100_000],
      ] as const) {
        const rates = entry[kind];
        if (rates === undefined) continue;
        if (typeof rates !== 'object' || rates === null) {
          return { valid: false, error: `${category}.${kind}: must map season name → satang` };
        }
        for (const [season, amount] of Object.entries(rates as Record<string, any>)) {
          if (!Number.isInteger(amount) || (amount as number) < minimum) {
            return {
              valid: false,
              error: `${category}.${kind}.${season}: amounts are satang integers (THB × 100) — ${amount} looks like raw THB or is invalid`,
            };
          }
        }
      }
    }
    return { valid: true };
  },
  'pricing.early_bird': (value: any) => {
    if (typeof value !== 'object' || value === null) {
      return { valid: false, error: 'early_bird must be {min_days_before, pct}' };
    }
    const { min_days_before, pct } = value;
    if (min_days_before !== null && (!Number.isInteger(min_days_before) || min_days_before <= 0)) {
      return { valid: false, error: 'min_days_before must be null (disabled) or a positive integer' };
    }
    if (typeof pct !== 'number' || pct < 0 || pct > 100) {
      return { valid: false, error: 'pct must be between 0 and 100' };
    }
    return { valid: true };
  },
  'catalog.unit_categories': (value: any) => {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'unit categories must be an array' };
    }
    for (const entry of value) {
      if (!entry.key || !/^[a-z0-9_]+$/.test(entry.key)) {
        return { valid: false, error: 'each category needs a snake_case key' };
      }
      if (entry.bedrooms !== undefined && (!Number.isInteger(entry.bedrooms) || entry.bedrooms <= 0)) {
        return { valid: false, error: `${entry.key}: bedrooms must be a positive integer` };
      }
    }
    return { valid: true };
  },
  'comms.whatsapp_number': (value: any) => {
    if (typeof value !== 'string' || (value !== '' && !/^\+?[0-9]{7,15}$/.test(value))) {
      return { valid: false, error: 'whatsapp number must be E.164 digits (or empty to hide CTAs)' };
    }
    return { valid: true };
  },
  'notify.prearrival_days_before': (value: any) => {
    if (!Number.isInteger(value) || value <= 0 || value > 30) {
      return { valid: false, error: 'must be a positive integer of days (max 30)' };
    }
    return { valid: true };
  },
  'notify.review_prompt_days_after': (value: any) => {
    if (!Number.isInteger(value) || value <= 0 || value > 14) {
      return { valid: false, error: 'must be a positive integer of days (max 14)' };
    }
    return { valid: true };
  },
  'notify.post_stay_days_after': (value: any) => {
    if (!Number.isInteger(value) || value <= 0 || value > 30) {
      return { valid: false, error: 'must be a positive integer of days (max 30)' };
    }
    return { valid: true };
  },
  'notify.service_review_prompt_hours_after': (value: any) => {
    if (!Number.isInteger(value) || value <= 0 || value > 72) {
      return { valid: false, error: 'must be a positive integer of hours (max 72)' };
    }
    return { valid: true };
  },
};

export async function updateConfigParameter(
  db: PrismaClient,
  input: ConfigChangeInput
): Promise<void> {
  const { identityId, paramKey, newValue, projectId, unitId } = input;

  const validator = VALIDATION_RULES[paramKey];
  if (validator) {
    const validation = validator(newValue);
    if (!validation.valid) {
      throw new Error(validation.error || `Invalid value for ${paramKey}`);
    }
  }

  let scopeType = 'global';
  let scopeId = 'global';
  if (unitId) {
    scopeType = 'unit';
    scopeId = unitId;
  } else if (projectId) {
    scopeType = 'project';
    scopeId = projectId;
  }

  const oldValue = await getConfig(db, paramKey, { projectId, unitId });

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

  invalidateConfig(paramKey as string);
}

export async function clearConfigOverride(
  db: PrismaClient,
  identityId: string,
  paramKey: ConfigKey,
  projectId?: string,
  unitId?: string
): Promise<void> {
  let scopeType = 'global';
  let scopeId = 'global';
  if (unitId) {
    scopeType = 'unit';
    scopeId = unitId;
  } else if (projectId) {
    scopeType = 'project';
    scopeId = projectId;
  }

  const oldValue = await getConfig(db, paramKey, { projectId, unitId });

  await db.configOverride.deleteMany({
    where: {
      parameterKey: paramKey as string,
      scopeType,
      scopeId,
    },
  });

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

  invalidateConfig(paramKey as string);
}
