import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { t, type Locale, LOCALES, DEFAULT_LOCALE } from '@/modules/content';
import { isMapEntityKind, type MapEntity, type MapEntityKind } from '@/modules/map';
import { parseMapBounds, type MapBounds } from '@/modules/browse';

function coordinateWhere(bounds: MapBounds | null) {
  if (!bounds) return {};
  const latitude = { gte: bounds.swLat, lte: bounds.neLat };
  return bounds.swLng <= bounds.neLng
    ? { latitude, longitude: { gte: bounds.swLng, lte: bounds.neLng } }
    : {
        latitude,
        OR: [
          { longitude: { gte: bounds.swLng } },
          { longitude: { lte: bounds.neLng } },
        ],
      };
}

function requestedKinds(req: NextRequest): Set<MapEntityKind> {
  const raw = req.nextUrl.searchParams.get('kinds');
  if (!raw) return new Set<MapEntityKind>(['project', 'unit', 'provider', 'service']);
  return new Set(raw.split(',').filter(isMapEntityKind));
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return values.some((value) => value?.toLocaleLowerCase().includes(needle));
}

export async function GET(req: NextRequest) {
  const parsedBounds = parseMapBounds((key) => req.nextUrl.searchParams.get(key));
  if (!parsedBounds.ok) {
    return NextResponse.json({ error: parsedBounds.error }, { status: 400 });
  }

  const kinds = requestedKinds(req);
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const cookieLocale = req.cookies.get('locale')?.value as Locale | undefined;
  const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const entities: MapEntity[] = [];

  if (kinds.has('project') || kinds.has('unit')) {
    const projects = await prisma.project.findMany({
      where: {
        status: 'live',
        mapVisibility: true,
        ...coordinateWhere(parsedBounds.bounds),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        area: { select: { nameKey: true } },
        coverMedia: { select: { storageKey: true } },
        units: kinds.has('unit')
          ? {
              where: { status: 'live', assetStatus: { not: 'suspended' } },
              select: {
                id: true,
                name: true,
                coverMedia: { select: { storageKey: true } },
              },
            }
          : false,
      },
      orderBy: { name: 'asc' },
    });

    for (const project of projects) {
      const areaLabel = project.area?.nameKey
        ? await t(prisma, project.area.nameKey, undefined, locale).catch(() => null)
        : null;

      if (kinds.has('project') && includesQuery([project.name, project.address, areaLabel], q)) {
        entities.push({
          id: project.id,
          kind: 'project',
          title: project.name,
          subtitle: areaLabel || project.address,
          latitude: Number(project.latitude),
          longitude: Number(project.longitude),
          href: `/projects/${project.slug}`,
          coverUrl: project.coverMedia?.storageKey || null,
          badge: 'Project',
          projectId: project.id,
        });
      }

      if (kinds.has('unit') && Array.isArray(project.units)) {
        for (const unit of project.units) {
          if (!includesQuery([unit.name, project.name, project.address, areaLabel], q)) continue;
          entities.push({
            id: unit.id,
            kind: 'unit',
            title: unit.name,
            subtitle: project.name,
            latitude: Number(project.latitude),
            longitude: Number(project.longitude),
            href: `/units/${unit.id}`,
            coverUrl: unit.coverMedia?.storageKey || project.coverMedia?.storageKey || null,
            badge: 'Home',
            projectId: project.id,
          });
        }
      }
    }
  }

  if (kinds.has('provider') || kinds.has('service')) {
    const providers = await prisma.provider.findMany({
      where: {
        status: 'active',
        mapVisibility: true,
        latitude: { not: null },
        longitude: { not: null },
        ...coordinateWhere(parsedBounds.bounds),
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        logoMedia: { select: { storageKey: true } },
        services: kinds.has('service')
          ? {
              where: { status: 'active' },
              select: {
                id: true,
                categoryKey: true,
                title: true,
                titleRu: true,
                titleEn: true,
                titleTh: true,
                coverMedia: { select: { storageKey: true } },
              },
            }
          : false,
      },
      orderBy: { name: 'asc' },
    });

    for (const provider of providers) {
      if (provider.latitude === null || provider.longitude === null) continue;
      const latitude = Number(provider.latitude);
      const longitude = Number(provider.longitude);

      if (
        kinds.has('provider') &&
        includesQuery([provider.name, provider.description, provider.address], q)
      ) {
        entities.push({
          id: provider.id,
          kind: 'provider',
          title: provider.name,
          subtitle: provider.address || provider.description,
          latitude,
          longitude,
          href: `/services?providerId=${provider.id}`,
          coverUrl: provider.logoMedia?.storageKey || null,
          badge: 'Partner',
          providerId: provider.id,
        });
      }

      if (kinds.has('service') && Array.isArray(provider.services)) {
        for (const service of provider.services) {
          const localizedTitle =
            locale === 'ru'
              ? service.titleRu || service.title
              : locale === 'th'
                ? service.titleTh || service.title
                : service.titleEn || service.title;
          if (!includesQuery([localizedTitle, provider.name, service.categoryKey], q)) continue;
          entities.push({
            id: service.id,
            kind: 'service',
            title: localizedTitle,
            subtitle: provider.name,
            latitude,
            longitude,
            href: `/services/${service.id}`,
            coverUrl: service.coverMedia?.storageKey || provider.logoMedia?.storageKey || null,
            badge: 'Service',
            providerId: provider.id,
          });
        }
      }
    }
  }

  return NextResponse.json({
    entities,
    count: entities.length,
    provider: process.env.NEXT_PUBLIC_MAP_PROVIDER || 'maplibre',
  });
}
