import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServiceOrdersByProvider } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { requireProviderMember } from '@/app/libs/providerGuard';
import { handleError } from '@/app/libs/errorHandler';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';

const LOCATION_VISIBLE_STATUSES = new Set(['accepted', 'fulfilled', 'closed']);

/**
 * GET /api/provider/orders — the caller's provider's order queue.
 * Each unaccepted order carries its accept deadline (createdAt +
 * `service.accept_sla_hours`) so the portal can count down the SLA.
 *
 * Privacy invariant: exact fulfillment location is withheld until the provider
 * has accepted the order. We never expose customer phone/email from this API.
 */
export async function GET() {
  try {
    const { providerId } = await requireProviderMember();
    const orders = await getServiceOrdersByProvider(prisma, providerId);
    const slaHours =
      ((await getConfig(prisma, 'service.accept_sla_hours')) as number) ?? 12;

    const projectIds = Array.from(
      new Set(
        orders
          .map((order) => order.project_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    );
    const unitIds = Array.from(
      new Set(
        orders
          .map((order) => order.unit_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    );

    const [projects, units] = await Promise.all([
      projectIds.length
        ? prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, name: true, address: true },
          })
        : Promise.resolve([]),
      unitIds.length
        ? prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, name: true, addressSupplement: true },
          })
        : Promise.resolve([]),
    ]);

    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const unitsById = new Map(units.map((unit) => [unit.id, unit]));

    return NextResponse.json({
      orders: orders.map((order) => {
        const locationVisible = LOCATION_VISIBLE_STATUSES.has(order.status);
        const project = order.project_id ? projectsById.get(order.project_id) : null;
        const unit = order.unit_id ? unitsById.get(order.unit_id) : null;

        return {
          ...serializeOrder(order),
          noteToProvider: order.note_to_provider ?? null,
          acceptDeadline:
            order.status === 'placed' || order.status === 'paid'
              ? new Date(order.createdAt.getTime() + slaHours * 60 * 60 * 1000)
              : null,
          fulfillmentLocation: locationVisible
            ? {
                projectName: project?.name ?? null,
                projectAddress: project?.address ?? null,
                unitName: unit?.name ?? null,
                unitAddressSupplement: unit?.addressSupplement ?? null,
                addressNote: order.address_note ?? null,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
