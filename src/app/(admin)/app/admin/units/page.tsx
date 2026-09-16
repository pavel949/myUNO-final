import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import UnitsAdminClient from './units-client';
import CreateUnitForm from './create-unit-form';

export const dynamic = 'force-dynamic';

export default async function AdminUnitsPage() {
  const units = await prisma.unit.findMany({
    include: {
      project: { select: { name: true } },
      inventoryCategory: { select: { baseNightlyThb: true } },
      coverMedia: { select: { storageKey: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // A unit cannot go live without an InventoryCategory, so the create form
  // offers each project's categories rather than leaving the operator to
  // discover the requirement at go-live (audit F-1).
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      inventoryCategories: {
        where: { status: 'live' },
        select: { categoryKey: true, name: true, baseNightlyThb: true, minNights: true },
        orderBy: { name: 'asc' },
      },
    },
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
    'admin.units.category': 'Category',
    'admin.units.category_none': 'No category yet',
    'admin.units.category_hint':
      'A unit can only go live once it belongs to a category. Categories are defined on the project page.',
    'admin.units.category_missing':
      'This project has no categories yet. Create one on the project page first — a unit without one cannot go live.',
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
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
        {labels['admin.units.title']}
      </h1>
      <CreateUnitForm
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          categories: project.inventoryCategories.map((category) => ({
            categoryKey: category.categoryKey,
            name: category.name,
            baseNightlyBaht: Math.round(category.baseNightlyThb / 100),
            minNights: category.minNights,
          })),
        }))}
        labels={labels}
      />
      <UnitsAdminClient
        units={units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          projectName: unit.project?.name || '—',
          status: unit.status,
          assetStatus: unit.assetStatus,
          baseNightlyThb: Math.round(
            (unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb) / 100
          ),
          permittedUseConfirmed: Boolean(unit.permittedUseConfirmedAt),
          coverUrl: unit.coverMedia?.storageKey || null,
          ownerName: unit.owner ? `${unit.owner.firstName} ${unit.owner.lastName}` : '—',
        }))}
        labels={labels}
      />
    </div>
  );
}
