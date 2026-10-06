import { prisma } from '@/lib/prisma';
import { listAreas } from '@/modules/projects';
import AreasClient from './areas-client';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AreasPage() {
  const [areas, labels] = await Promise.all([listAreas(prisma), getLabels({
    'admin.areas.kicker': 'Canonical geography',
    'admin.areas.title': 'Areas',
    'admin.areas.subtitle': 'Areas are reusable location records selected by every newly onboarded property.',
    'admin.areas.create_title': 'Add an area',
    'admin.areas.slug': 'URL name',
    'admin.areas.slug_placeholder': 'phuket-bang-tao',
    'admin.areas.name_key': 'Name content key',
    'admin.areas.name_key_placeholder': 'area.phuket_bang_tao',
    'admin.areas.create': 'Create area',
    'admin.areas.list_title': 'All areas',
    'admin.areas.empty': 'No areas yet.',
    'admin.areas.archive': 'Archive',
    'admin.areas.publish': 'Publish',
    'admin.areas.status.live': 'Live',
    'admin.areas.status.archived': 'Archived',
    'admin.areas.status.draft': 'Draft',
    'admin.areas.continue': 'Continue to Add Property →',
    'admin.areas.error_create': 'Could not create the area. Check that the URL name is unique.',
    'admin.areas.error_update': 'Could not update the area.',
  })]);
  return <AreasClient labels={labels} initialAreas={areas.map(area => ({ id: area.id, slug: area.slug, nameKey: area.nameKey, status: area.status }))} />;
}
