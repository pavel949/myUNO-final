import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * Project-specific concierge preferences only.
 * myUNO marketplace services remain platform-wide; this route never hides a
 * service from another Project Space. It only creates/removes a project
 * commercial override.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const serviceId = typeof body?.serviceId === 'string' ? body.serviceId : '';
  const action = typeof body?.action === 'string' ? body.action : '';
  if (!serviceId) return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });

  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

  if (action === 'clear_override') {
    await prisma.serviceProject.deleteMany({ where: { service_id: serviceId, project_id: project.id } });
  } else if (action === 'update_terms') {
    const priceOverrideBaht = body.priceOverrideBaht === '' || body.priceOverrideBaht == null
      ? null : Number(body.priceOverrideBaht);
    const leadTimeHours = body.leadTimeHours === '' || body.leadTimeHours == null
      ? null : Number(body.leadTimeHours);
    const takeRatePct = body.takeRatePct === '' || body.takeRatePct == null
      ? null : Number(body.takeRatePct);
    if (priceOverrideBaht !== null && (!Number.isFinite(priceOverrideBaht) || priceOverrideBaht <= 0)) {
      return NextResponse.json({ error: 'Project price override must be a positive THB amount' }, { status: 400 });
    }
    if (leadTimeHours !== null && (!Number.isInteger(leadTimeHours) || leadTimeHours < 0 || leadTimeHours > 720)) {
      return NextResponse.json({ error: 'Lead time must be an integer from 0 to 720 hours' }, { status: 400 });
    }
    if (takeRatePct !== null && (!Number.isFinite(takeRatePct) || takeRatePct < 0 || takeRatePct > 100)) {
      return NextResponse.json({ error: 'Take rate must be between 0 and 100 percent' }, { status: 400 });
    }

    await prisma.serviceProject.upsert({
      where: { service_id_project_id: { service_id: serviceId, project_id: project.id } },
      create: {
        service_id: serviceId,
        project_id: project.id,
        enabled: true,
        public: true,
        price_override_thb: priceOverrideBaht === null ? null : Math.round(priceOverrideBaht * 100),
        lead_time_hours: leadTimeHours,
        take_rate_pct: takeRatePct,
        terms_version: 1,
      },
      update: {
        enabled: true,
        public: true,
        price_override_thb: priceOverrideBaht === null ? null : Math.round(priceOverrideBaht * 100),
        lead_time_hours: leadTimeHours,
        take_rate_pct: takeRatePct,
        terms_version: { increment: 1 },
        updated_at: new Date(),
      },
    });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await logAudit({
    actorIdentityId: guard.actorIdentityId,
    action: 'services:project_preference_update',
    entityType: 'Service',
    entityId: serviceId,
    data: { projectId: project.id, action },
  });

  return NextResponse.json({ ok: true });
}
