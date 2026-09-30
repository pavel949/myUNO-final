import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import MapAdminClient from './map-admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminMapPage() {
  const [projects, providers, labels] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        mapVisibility: true,
        googlePlaceId: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        mapVisibility: true,
        googlePlaceId: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    }),
    getLabels({
      'admin.map.title': 'Map & locations',
      'admin.map.subtitle': 'Manage canonical locations used across public maps, search and future Google Places integrations.',
      'admin.map.projects': 'Projects',
      'admin.map.providers': 'Partners & providers',
      'admin.map.address': 'Address',
      'admin.map.latitude': 'Latitude',
      'admin.map.longitude': 'Longitude',
      'admin.map.google_place_id': 'Google Place ID',
      'admin.map.visible': 'Show on map',
      'admin.map.save': 'Save',
      'admin.map.saved': 'Saved',
      'admin.map.error': 'Could not save this location.',
    }),
  ]);

  return (
    <MapAdminClient
      labels={labels}
      projects={projects.map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      }))}
      providers={providers.map((row) => ({
        ...row,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      }))}
    />
  );
}
