import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPropertyReadiness } from '@/modules/projects';
import PropertyOnboardingClient from './property-onboarding-client';

export const dynamic = 'force-dynamic';

export default async function PropertyOnboardingPage({ params, searchParams }: { params: { id: string }; searchParams?: { gallery?: string } }) {
  const [project, readiness] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: {
        inventoryCategories: { include: { ratePlans: true }, orderBy: { name: 'asc' } },
        ratePlans: { orderBy: { name: 'asc' } },
        galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } },
        units: { include: { inventoryCategory: true, media: true, sleepingSpaces: { include: { beds: true } }, commercialOfferings: { include: { channelMappings: true } } }, orderBy: { name: 'asc' } },
      },
    }),
    getPropertyReadiness(prisma, params.id),
  ]);
  if (!project || !readiness) notFound();
  return <PropertyOnboardingClient initialProject={JSON.parse(JSON.stringify(project))} initialReadiness={readiness} initialGallery={searchParams?.gallery} />;
}
