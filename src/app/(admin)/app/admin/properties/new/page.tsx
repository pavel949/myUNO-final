import { prisma } from '@/lib/prisma';
import { listAreas } from '@/modules/projects';
import NewPropertyClient from './new-property-client';

export const dynamic = 'force-dynamic';

export default async function NewPropertyPage() {
  const areas = await listAreas(prisma);
  return <NewPropertyClient areas={areas.map(({ id, slug }) => ({ id, slug }))} />;
}
