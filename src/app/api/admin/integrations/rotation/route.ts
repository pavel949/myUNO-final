import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationKey } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';
import {
  LIVE_INTEGRATIONS,
  getPlatformIntegrationConfig,
} from '@/modules/integrations/admin-registry';
import {
  listRecentSecretRotations,
  rollbackIntegrationSecret,
  rotateIntegrationSecret,
  validateSecretCandidate,
} from '@/modules/integrations/secret-rotation';

function definitionFor(key: string) {
  return LIVE_INTEGRATIONS.find((item) => item.key === key);
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const rotations = await listRecentSecretRotations(prisma, 25);
  return NextResponse.json({ rotations });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'rollback') {
      const rotationId = String(body.rotationId || '');
      if (!rotationId) {
        return NextResponse.json({ error: 'rotationId is required' }, { status: 400 });
      }

      const rotation = await rollbackIntegrationSecret(
        prisma,
        rotationId,
        guard.actorIdentityId
      );

      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'integration_secret:rolled_back',
        entityType: 'IntegrationSecretRotation',
        entityId: rotation.id,
        data: {
          integrationKey: rotation.integrationKey,
          fieldKey: rotation.fieldKey,
        },
      });

      return NextResponse.json({ ok: true, rotation });
    }

    const key = String(body.key || '');
    const fieldKey = String(body.fieldKey || '');
    const candidate = typeof body.candidate === 'string' ? body.candidate.trim() : '';
    const definition = definitionFor(key);
    const field = definition?.fields.find((item) => item.key === fieldKey && item.secret);

    if (!definition || !field) {
      return NextResponse.json({ error: 'Unknown rotatable secret' }, { status: 400 });
    }
    if (!candidate) {
      return NextResponse.json({ error: 'New secret is required' }, { status: 400 });
    }

    if (action === 'validate') {
      const current = await getPlatformIntegrationConfig(prisma, definition.key);
      try {
        const validation = await validateSecretCandidate(
          definition.key as IntegrationKey,
          fieldKey,
          candidate,
          current
        );

        await logAudit({
          actorIdentityId: guard.actorIdentityId,
          action: 'integration_secret:validated',
          entityType: 'IntegrationAccount',
          entityId: definition.key,
          data: {
            integrationKey: definition.key,
            fieldKey,
            result: 'accepted',
          },
        });

        return NextResponse.json({
          ok: true,
          note: validation.note,
          confirmationPhrase: `ROTATE ${definition.title}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Validation failed.';
        await logAudit({
          actorIdentityId: guard.actorIdentityId,
          action: 'integration_secret:validation_failed',
          entityType: 'IntegrationAccount',
          entityId: definition.key,
          data: {
            integrationKey: definition.key,
            fieldKey,
            result: 'rejected',
            reason: message.slice(0, 200),
          },
        });
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    if (action === 'apply') {
      const confirmation = typeof body.confirmation === 'string' ? body.confirmation : '';
      const rotation = await rotateIntegrationSecret(prisma, {
        integrationKey: definition.key as IntegrationKey,
        fieldKey,
        candidate,
        actorIdentityId: guard.actorIdentityId,
        confirmation,
      });

      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'integration_secret:rotated',
        entityType: 'IntegrationSecretRotation',
        entityId: rotation.id,
        data: {
          integrationKey: definition.key,
          fieldKey,
          status: rotation.status,
        },
      });

      return NextResponse.json({ ok: true, rotation });
    }

    return NextResponse.json({ error: 'Unknown rotation action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Secret rotation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
