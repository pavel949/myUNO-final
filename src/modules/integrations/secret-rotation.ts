import crypto from 'crypto';
import type { IntegrationKey, PrismaClient } from '@prisma/client';
import { reportError } from '@/lib/observability';
import {
  LIVE_INTEGRATIONS,
  getPlatformIntegrationConfig,
  savePlatformIntegrationConfig,
} from './admin-registry';

function integrationDefinition(key: IntegrationKey) {
  return LIVE_INTEGRATIONS.find((item) => item.key === key);
}

function secretField(key: IntegrationKey, fieldKey: string) {
  return integrationDefinition(key)?.fields.find((field) => field.key === fieldKey && field.secret);
}

function configHash(config: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

export async function validateSecretCandidate(
  integrationKey: IntegrationKey,
  fieldKey: string,
  candidate: string,
  currentConfig: Record<string, unknown>
): Promise<{ ok: true; note: string }> {
  if (!secretField(integrationKey, fieldKey)) {
    throw new Error('This field is not eligible for secret rotation.');
  }
  if (!candidate.trim()) throw new Error('New secret is required.');

  if (integrationKey === 'google_places' && fieldKey === 'apiKey') {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': candidate.trim(),
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({
        input: 'Phuket',
        languageCode: 'en',
        regionCode: 'TH',
        includedRegionCodes: ['th'],
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Google Places rejected the key (HTTP ${response.status}).`);
    }
    return { ok: true, note: 'Google Places API accepted the key.' };
  }

  if (integrationKey === 'email_resend' && fieldKey === 'apiKey') {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${candidate.trim()}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the key (HTTP ${response.status}).`);
    }
    return { ok: true, note: 'Resend API accepted the key.' };
  }

  // Future providers must add a non-destructive validation request before
  // their secret field is made editable through this workflow.
  void currentConfig;
  throw new Error('No safe validation probe is implemented for this secret yet.');
}

async function platformAccount(db: PrismaClient, integrationKey: IntegrationKey) {
  return db.integrationAccount.findFirst({
    where: { integrationKey, scopeType: 'platform' },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function rotateIntegrationSecret(
  db: PrismaClient,
  input: {
    integrationKey: IntegrationKey;
    fieldKey: string;
    candidate: string;
    actorIdentityId: string;
    confirmation: string;
  }
) {
  const definition = integrationDefinition(input.integrationKey);
  const field = secretField(input.integrationKey, input.fieldKey);
  if (!definition || !field) throw new Error('Unknown secret field.');

  const expected = `ROTATE ${definition.title}`;
  if (input.confirmation.trim() !== expected) {
    throw new Error(`Type "${expected}" to confirm rotation.`);
  }

  const currentConfig = await getPlatformIntegrationConfig(db, input.integrationKey);
  const validation = await validateSecretCandidate(
    input.integrationKey,
    input.fieldKey,
    input.candidate,
    currentConfig
  );

  const latestConfig = await getPlatformIntegrationConfig(db, input.integrationKey);
  const before = await platformAccount(db, input.integrationKey);
  const previousConfig = before?.config ?? null;
  const expectedBeforeHash = configHash(previousConfig);

  const rotation = await db.integrationSecretRotation.create({
    data: {
      integrationKey: input.integrationKey,
      fieldKey: input.fieldKey,
      status: 'validated',
      actorIdentityId: input.actorIdentityId,
      accountId: before?.id ?? null,
      previousConfig: previousConfig as any,
      validationNote: validation.note,
      validatedAt: new Date(),
    },
  });

  try {
    const currentAccount = await platformAccount(db, input.integrationKey);
    if (configHash(currentAccount?.config ?? null) !== expectedBeforeHash) {
      throw new Error(
        'Integration settings changed during rotation. Nothing was applied; reload and validate again.'
      );
    }

    const next = { ...latestConfig, [input.fieldKey]: input.candidate.trim() };
    await savePlatformIntegrationConfig(db, input.integrationKey, next);

    const after = await platformAccount(db, input.integrationKey);
    if (!after) throw new Error('Integration account was not created.');

    // Re-run the provider probe after the write so the active runtime value is
    // verified, not only the submitted request body.
    const active = await getPlatformIntegrationConfig(db, input.integrationKey);
    const activeValue = active[input.fieldKey];
    if (typeof activeValue !== 'string' || !activeValue.trim()) {
      throw new Error('The new secret was not readable after storage.');
    }
    await validateSecretCandidate(
      input.integrationKey,
      input.fieldKey,
      activeValue,
      active
    );

    return await db.integrationSecretRotation.update({
      where: { id: rotation.id },
      data: {
        accountId: after.id,
        status: 'applied',
        appliedAt: new Date(),
        appliedConfigHash: configHash(after.config),
      },
    });
  } catch (error) {
    const account = await platformAccount(db, input.integrationKey);
    let rollbackSucceeded = true;
    let rollbackMessage = '';

    try {
      if (account) {
        if (previousConfig == null) {
          await db.integrationAccount.delete({ where: { id: account.id } });
        } else {
          await db.integrationAccount.update({
            where: { id: account.id },
            data: { config: previousConfig as any },
          });
        }
      }
    } catch (rollbackError) {
      rollbackSucceeded = false;
      rollbackMessage =
        rollbackError instanceof Error ? rollbackError.message : 'Automatic rollback failed.';
      reportError(rollbackError, {
        route: 'integration-secret-rotation',
        integrationKey: input.integrationKey,
        phase: 'automatic_rollback',
        severity: 'critical',
      });
    }

    const message = error instanceof Error ? error.message : 'Secret rotation failed.';
    await db.integrationSecretRotation.update({
      where: { id: rotation.id },
      data: {
        status: 'failed',
        errorMessage: (
          rollbackSucceeded
            ? `${message} Previous configuration restored automatically.`
            : `${message} CRITICAL: automatic rollback also failed: ${rollbackMessage}`
        ).slice(0, 500),
        rolledBackAt: rollbackSucceeded ? new Date() : null,
      },
    });

    reportError(error, {
      route: 'integration-secret-rotation',
      integrationKey: input.integrationKey,
      fieldKey: input.fieldKey,
      phase: 'apply',
      rollbackSucceeded,
      expected: false,
    });

    if (!rollbackSucceeded) {
      throw new Error(
        `CRITICAL: rotation failed and automatic rollback also failed. The integration requires manual recovery: ${message}`
      );
    }

    throw new Error(`Rotation failed and the previous configuration was restored: ${message}`);
  }
}

export async function rollbackIntegrationSecret(
  db: PrismaClient,
  rotationId: string,
  actorIdentityId: string
) {
  const rotation = await db.integrationSecretRotation.findUnique({ where: { id: rotationId } });
  if (!rotation) throw new Error('Rotation record not found.');
  if (rotation.status !== 'applied') throw new Error('Only an applied rotation can be rolled back.');

  const account = await platformAccount(db, rotation.integrationKey);
  if (!account) throw new Error('Current integration account not found.');

  if (!rotation.appliedConfigHash || configHash(account.config) !== rotation.appliedConfigHash) {
    throw new Error('A newer integration change exists. Rollback was blocked to protect the newer configuration.');
  }

  if (rotation.previousConfig == null) {
    await db.integrationAccount.delete({ where: { id: account.id } });
  } else {
    await db.integrationAccount.update({
      where: { id: account.id },
      data: { config: rotation.previousConfig as any },
    });
  }

  return db.integrationSecretRotation.update({
    where: { id: rotation.id },
    data: {
      status: 'rolled_back',
      rolledBackAt: new Date(),
      errorMessage: null,
      validationNote: `${rotation.validationNote || ''} Manual rollback by ${actorIdentityId}.`.trim(),
    },
  });
}

export async function listRecentSecretRotations(db: PrismaClient, take = 20) {
  return db.integrationSecretRotation.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      integrationKey: true,
      fieldKey: true,
      status: true,
      actorIdentityId: true,
      validationNote: true,
      errorMessage: true,
      validatedAt: true,
      appliedAt: true,
      rolledBackAt: true,
      createdAt: true,
    },
  });
}
