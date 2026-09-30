import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPropertyReadiness } from '@/modules/projects';
import { getLabels } from '@/lib/i18n';
import PropertyOnboardingClient from './property-onboarding-client';

export const dynamic = 'force-dynamic';

export default async function PropertyOnboardingPage({ params, searchParams }: { params: { id: string }; searchParams?: { gallery?: string } }) {
  const [project, readiness, galleryLabels] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: {
        inventoryCategories: { include: { ratePlans: true }, orderBy: { name: 'asc' } },
        structureNodes: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        ratePlans: { orderBy: { name: 'asc' } },
        galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } },
        units: { include: { inventoryCategory: true, media: true, sleepingSpaces: { include: { beds: true } }, commercialOfferings: { include: { channelMappings: true } } }, orderBy: { name: 'asc' } },
      },
    }),
    getPropertyReadiness(prisma, params.id),
    getLabels({
      'admin.gallery.title': 'Which gallery are you editing?',
      'admin.gallery.scope_hint': 'Project, category and exact-unit galleries are edited separately.',
      'admin.gallery.level': 'Level',
      'admin.gallery.project': '1. Property / hotel / resort',
      'admin.gallery.category': '2. Room / villa category',
      'admin.gallery.unit': '3. Individual villa / condo',
      'admin.gallery.object': 'Object',
      'admin.gallery.photos': 'photos',
      'admin.gallery.hint': 'Upload photos, set a cover, adjust order, or remove a photo from this gallery.',
      'admin.gallery.add': 'Add photos',
      'admin.gallery.saving': 'Saving…',
      'admin.gallery.loading': 'Loading gallery…',
      'admin.gallery.empty': 'No photos yet. Add images for this level.',
      'admin.gallery.cover': 'Cover photo',
      'admin.gallery.set_cover': 'Set cover',
      'admin.gallery.remove': 'Remove from gallery',
      'admin.gallery.safe_remove': 'Removing a photo only detaches it from this gallery.',
      'admin.gallery.saved': 'Gallery saved.',
    }),
  ]);
  if (!project || !readiness) notFound();
  return <PropertyOnboardingClient initialProject={JSON.parse(JSON.stringify(project))} initialReadiness={readiness} initialGallery={searchParams?.gallery} galleryLabels={galleryLabels} />;
}
