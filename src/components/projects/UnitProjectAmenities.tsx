import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getPublicAmenityProjectBySlug, listPublicProjectAmenities } from '@/modules/projects/project-amenities.service';
import { AMENITY_USAGE_LABELS, AMENITY_USAGE_DRAFTS, amenityUsageLabels } from '@/modules/projects/amenity-usage-copy';
import ProjectAmenitiesSection from './ProjectAmenitiesSection';

/** Called after public unit eligibility is established. Never copies facilities into Unit. */
export default async function UnitProjectAmenities({ unitId }: { unitId: string }) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { project: { select: { id: true, slug: true, name: true, status: true } } },
  });
  if (!unit) return null;
  const project = await getPublicAmenityProjectBySlug(prisma, unit.project.slug);
  if (!project) return null;
  const locale = getRequestLocale();
  const amenities = await listPublicProjectAmenities(prisma, unit.project.id, locale);
  if (!amenities.length) return null;
  const labels = await getLabels({
    ...AMENITY_USAGE_LABELS,
    'project_amenities.title': 'Amenities & facilities',
    'project_amenities.free': 'Free',
    'project_amenities.included': 'Included',
    'project_amenities.booking_required': 'Booking required',
  }, locale, AMENITY_USAGE_DRAFTS);
  const usage = amenityUsageLabels(labels);
  return <div>
    <p className="mx-auto max-w-content px-20 pt-24 text-body text-text-secondary md:px-32">{usage.body.replace('{project}', unit.project.name)}</p>
    <ProjectAmenitiesSection projectSlug={unit.project.slug} amenities={amenities}
      title={usage.shared} viewAllLabel={labels['project_amenities.title']}
      labels={{ kicker: unit.project.name, included: labels['project_amenities.included'], free: labels['project_amenities.free'], bookingRequired: labels['project_amenities.booking_required'] }} />
  </div>;
}
