import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import {
  BOOTSTRAP_VARIABLES,
  LIVE_INTEGRATIONS,
  getPlatformIntegrationConfig,
  savePlatformIntegrationConfig,
} from '@/modules/integrations/admin-registry';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const integrations = [];
  for (const definition of LIVE_INTEGRATIONS) {
    const config = await getPlatformIntegrationConfig(prisma, definition.key);
    integrations.push({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      fields: definition.fields.map((field) => {
        const stored = config[field.key];
        const envValue = field.env ? process.env[field.env] : undefined;
        const storedConfigured = typeof stored === 'string' ? Boolean(stored.trim()) : stored != null;
        const envConfigured = typeof envValue === 'string' && Boolean(envValue.trim());
        return {
          key: field.key,
          label: field.label,
          secret: Boolean(field.secret),
          env: field.env || null,
          placeholder: field.placeholder || null,
          configured: storedConfigured || envConfigured,
          source: storedConfigured ? 'vault' : envConfigured ? 'environment' : 'missing',
          value: field.secret
            ? ''
            : typeof stored === 'string'
              ? stored
              : envConfigured
                ? envValue
                : '',
        };
      }),
    });
  }

  const bootstrap = BOOTSTRAP_VARIABLES.map((item) => ({
    ...item,
    configured: Boolean(process.env[item.env]?.trim()),
  }));

  return NextResponse.json({ integrations, bootstrap });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const key = String(body.key || '');
    const definition = LIVE_INTEGRATIONS.find((entry) => entry.key === key);
    if (!definition) {
      return NextResponse.json({ error: 'Unknown integration' }, { status: 400 });
    }

    const current = await getPlatformIntegrationConfig(prisma, definition.key);
    const incoming =
      body.values && typeof body.values === 'object'
        ? (body.values as Record<string, unknown>)
        : {};
    const clearSecrets = Array.isArray(body.clearSecrets)
      ? new Set(body.clearSecrets.filter((value: unknown): value is string => typeof value === 'string'))
      : new Set<string>();

    const next: Record<string, unknown> = { ...current };
    const changed: string[] = [];

    for (const field of definition.fields) {
      if (clearSecrets.has(field.key)) {
        delete next[field.key];
        changed.push(field.key);
        continue;
      }

      if (!(field.key in incoming)) continue;
      const raw = incoming[field.key];
      if (typeof raw !== 'string') continue;
      const value = raw.trim();

      // Empty secret input means "leave unchanged"; secrets are never round-tripped to the browser.
      if (field.secret && value === '') continue;

      if (value === '') delete next[field.key];
      else next[field.key] = value;
      changed.push(field.key);
    }

    await savePlatformIntegrationConfig(prisma, definition.key, next);
    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'integration_settings:update',
      entityType: 'IntegrationAccount',
      entityId: definition.key,
      data: { integrationKey: definition.key, changedFields: changed },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Integration settings update failed' },
      { status: 400 }
    );
  }
}
