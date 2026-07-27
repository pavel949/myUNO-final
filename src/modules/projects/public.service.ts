import { prisma } from '@/lib/prisma';

/**
 * Public (unauthenticated) read seam for project discovery pages.
 * Only `live` projects and `live` units are ever exposed — draft and
 * archived inventory stays invisible (doc 08 §4).
 */

export interface PublicProjectCard {
  id: string;
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  coverUrl: string | null;
  liveUnitCount: number;
  fromNightlyThb: number | null;
}

export interface PublicProjectUnit {
  id: string;
  name: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  sizeSqm: number | null;
  baseNightlyThb: number;
  instantBook: boolean;
  coverUrl: string | null;
}

export interface PublicProjectDetail {
  id: string;
  slug: string;
  name: string;
  areaLabelKey: string;
  descriptionKey: string;
  handbookKey: string;
  address: string;
  latitude: number;
  longitude: number;
  amenityKeys: string[];
  coverUrl: string | null;
  galleryUrls: string[];
  units: PublicProjectUnit[];
}

/** All live projects, for the /projects hub and the sitemap. */
export async function listPublicProjects(): Promise<PublicProjectCard[]> {
  const projects = await prisma.project.findMany({
    where: { status: 'live' },
    orderBy: { createdAt: 'asc' },
    include: {
      coverMedia: { select: { storageKey: true } },
      units: {
        where: { status: 'live' },
        select: { baseNightlyThb: true },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    areaLabelKey: p.areaLabelKey,
    descriptionKey: p.descriptionKey,
    coverUrl: p.coverMedia?.storageKey ?? null,
    liveUnitCount: p.units.length,
    fromNightlyThb: p.units.length
      ? Math.min(...p.units.map((u) => u.baseNightlyThb))
      : null,
  }));
}

/**
 * One live project by slug with its gallery and live units.
 * Returns null for unknown slugs AND for non-live projects, so drafts
 * never leak through a guessed URL.
 */
export async function getPublicProjectBySlug(
  slug: string
): Promise<PublicProjectDetail | null> {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      coverMedia: { select: { storageKey: true } },
      galleryMedia: {
        orderBy: { sort: 'asc' },
        include: { media: { select: { storageKey: true } } },
      },
      units: {
        where: { status: 'live' },
        orderBy: { baseNightlyThb: 'asc' },
        include: { coverMedia: { select: { storageKey: true } } },
      },
    },
  });

  if (!project || project.status !== 'live') return null;

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    areaLabelKey: project.areaLabelKey,
    descriptionKey: project.descriptionKey,
    handbookKey: project.handbookKey,
    address: project.address,
    latitude: Number(project.latitude),
    longitude: Number(project.longitude),
    amenityKeys: project.amenityKeys,
    coverUrl: project.coverMedia?.storageKey ?? null,
    galleryUrls: project.galleryMedia.map((g) => g.media.storageKey),
    units: project.units.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      maxGuests: u.maxGuests,
      sizeSqm: u.sizeSqm,
      baseNightlyThb: u.baseNightlyThb,
      instantBook: u.instantBook,
      coverUrl: u.coverMedia?.storageKey ?? null,
    })),
  };
}

/** Live units (id only) for the sitemap. */
export async function listPublicUnitIds(): Promise<string[]> {
  const units = await prisma.unit.findMany({
    where: { status: 'live', project: { status: 'live' } },
    select: { id: true },
  });
  return units.map((u) => u.id);
}
