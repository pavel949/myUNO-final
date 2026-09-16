import { prisma } from '@/lib/prisma';
import { listAreas } from '@/modules/projects';
import AreasClient from './areas-client';

export const dynamic = 'force-dynamic';

export default async function AreasPage() {
  const areas = await listAreas(prisma);
  return <AreasClient initialAreas={areas.map(area => ({ id: area.id, slug: area.slug, nameKey: area.nameKey, status: area.status }))} />;
}
