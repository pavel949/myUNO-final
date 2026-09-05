import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import UnitsAdminClient from './units-client';
import CreateUnitForm from './create-unit-form';

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

  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const labels = await getLabels({
    'admin.units.title': 'Projects & Units',
    'admin.units.create': 'Add a unit',
    'admin.units.cancel': 'Cancel',
    'admin.units.saving': 'Saving…',
    'admin.units.project': 'Project',
    'admin.units.name': 'Name',
    'admin.units.type': 'Type',
    'admin.units.bedrooms': 'Bedrooms',
    'admin.units.bathrooms': 'Bathrooms',
    'admin.units.max_guests': 'Sleeps',
    'admin.units.address_supplement': 'Address detail (unit number, building)',
    'admin.units.base_nightly': 'Base ฿/night',
    'admin.units.min_nights': 'Minimum nights',
    'admin.units.no_projects': 'Create a project before adding units.',
    'admin.units.status': 'Status',
    'admin.units.owner': 'Owner',
    'admin.units.price': 'Base ฿/night',
    'admin.units.permitted_use': 'Permitted use',
    'admin.units.confirmed': 'Confirmed',
    'admin.units.confirm_action': 'Confirm permitted use',
    'admin.units.set_live': 'Set live',
    'admin.units.pause': 'Pause',
    'admin.units.upload_photo': 'Set photo',
    'admin.units.asset_status': 'Asset status',
    'admin.units.asset_status_reason': 'Reason for asset status change',
    'admin.units.asset_status.managed': 'Managed',
    'admin.units.asset_status.verified_partner': 'Verified partner',
    'admin.units.asset_status.one_off_sourced': 'One-off sourced',
    'admin.units.asset_status.suspended': 'Suspended',
    'admin.units.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.units.title']}
      </h1>
      <CreateUnitForm projects={projects} labels={labels} />
      <UnitsAdminClient
        units={units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          projectName: unit.project?.name || '—',
          status: unit.status,
          assetStatus: unit.assetStatus,
          // Display boundary: baseNightlyThb is satang (THB x 100).
          baseNightlyThb: Math.round(unit.baseNightlyThb / 100),
          permittedUseConfirmed: Boolean(unit.permittedUseConfirmedAt),
          coverUrl: unit.coverMedia?.storageKey || null,
          ownerName: unit.owner ? `${unit.owner.firstName} ${unit.owner.lastName}` : '—',
        }))}
        labels={labels}
      />
    </div>
  );
}
