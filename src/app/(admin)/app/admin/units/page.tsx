import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import UnitsAdminClient from './units-client';

export const dynamic = 'force-dynamic';

export default async function AdminUnitsPage() {
  const units = await prisma.unit.findMany({
    include: {
      project: { select: { name: true } },
      coverMedia: { select: { storageKey: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const labels = await getLabels({
    'admin.units.title': 'Projects & Units',
    'admin.units.status': 'Status',
    'admin.units.owner': 'Owner',
    'admin.units.price': 'Base ฿/night',
    'admin.units.permitted_use': 'Permitted use',
    'admin.units.confirmed': 'Confirmed',
    'admin.units.confirm_action': 'Confirm permitted use',
    'admin.units.set_live': 'Set live',
    'admin.units.pause': 'Pause',
    'admin.units.upload_photo': 'Set photo',
    'admin.units.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.units.title']}
      </h1>
      <UnitsAdminClient
        units={units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          projectName: unit.project?.name || '—',
          status: unit.status,
          baseNightlyThb: unit.baseNightlyThb,
          permittedUseConfirmed: Boolean(unit.permittedUseConfirmedAt),
          coverUrl: unit.coverMedia?.storageKey || null,
          ownerName: unit.owner ? `${unit.owner.firstName} ${unit.owner.lastName}` : '—',
        }))}
        labels={labels}
      />
    </div>
  );
}
