import { prisma } from '@/lib/prisma';
import { listPublicDiscoveryUnits } from './public-discovery';
import { getPublicUnitById } from './public.service';

export type PublicationDetail = 'description' | 'sleeping' | 'video' | 'measurements' | 'photos' | 'owner' | 'category' | 'pricing';
export interface UnitPublicationReadiness {
  unitId: string;
  published: boolean;
  canReceiveInquiry: boolean;
  bookingFlowAvailable: boolean;
  detailsToAdd: PublicationDetail[];
}

/** Read-only presentation, never an activation command or a booking authorization.
 * Reuse the exact public readers rather than treating every draft as published
 * or reconstructing a weaker sellability check from status alone.
 */
export async function getUnitPublicationReadiness(unitId: string): Promise<UnitPublicationReadiness | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true, descriptionKey: true, sizeSqm: true, grossAreaSqm: true,\n      ownerIdentityId: true, inventoryCategoryId: true, baseNightlyThb: true, coverMediaId: true,\n      media: { select: { mediaId: true } },
      project: { select: { status: true } },
      sleepingSpaces: { select: { beds: { select: { count: true } } } },
    },
  });
  if (!unit) return null;
  const [discovery, booking, description] = await Promise.all([
    listPublicDiscoveryUnits({ unitId }),
    getPublicUnitById(unitId),
    unit.descriptionKey ? prisma.contentKey.findUnique({
      where: { key: unit.descriptionKey },
      select: { translations: { select: { value: true, status: true } } },
    }) : Promise.resolve(null),
  ]);
  const visible = discovery.find(row => row.id === unitId);
  const published = Boolean(visible || booking?.id === unitId);
  const detailsToAdd: PublicationDetail[] = [];\n  if (!unit.ownerIdentityId) detailsToAdd.push('owner');\n  if (!unit.inventoryCategoryId) detailsToAdd.push('category');\n  if (!unit.coverMediaId || unit.media.length < 3) detailsToAdd.push('photos');\n  if (unit.baseNightlyThb <= 0) detailsToAdd.push('pricing');
  if (!description?.translations.some(row => row.status === 'ok' && row.value.trim())) detailsToAdd.push('description');
  if (!unit.sleepingSpaces.some(space => space.beds.some(bed => bed.count > 0))) detailsToAdd.push('sleeping');
  if (!(visible?.videoUrls?.length || booking?.videoUrls?.length)) detailsToAdd.push('video');
  const area = unit.grossAreaSqm === null ? unit.sizeSqm : Number(unit.grossAreaSqm);
  if (!area || !Number.isFinite(area) || area <= 0) detailsToAdd.push('measurements');
  return {
    unitId, published,
    // Matches the existing project-scoped /api/leads gate. Imported draft
    // projects can be visible without their inquiry endpoint accepting leads.
    canReceiveInquiry: published && unit.project.status === 'live',
    bookingFlowAvailable: Boolean(booking?.id === unitId && booking.bookable),
    detailsToAdd,
  };
}
