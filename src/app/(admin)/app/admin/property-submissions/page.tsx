/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getEmployeeCreationReviewOptions } from '@/modules/onboarding/employee-creation.service';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { EMPLOYEE_CREATION_LABELS, EMPLOYEE_CREATION_DRAFTS } from '@/modules/content/employee-creation.seed';
import ConvertPropertySubmission from './convert-client';

export const dynamic = 'force-dynamic';

export default async function PropertySubmissionsPage() {
  const creationLabels = await getLabels(EMPLOYEE_CREATION_LABELS, getRequestLocale(), EMPLOYEE_CREATION_DRAFTS);
  const l = (key: string) => creationLabels[`property.creation.${key}`];
  const [rows, projects, organizations, areas] = await Promise.all([prisma.crmOpportunity.findMany({
    where: { source: 'myuno_property_submission_v1' },
    include: { identity: { select: { firstName: true, lastName: true, email: true } }, project: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  }), prisma.project.findMany({ where: { status: { not: 'archived' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }), prisma.organization.findMany({ where: { status: 'active', orgType: 'management_company' }, select: { id: true, name: true, projectId: true }, orderBy: { name: 'asc' } }), prisma.area.findMany({ where: { status: 'live' }, select: { id: true, slug: true }, orderBy: { sort: 'asc' } })]);
  const reviewer = await getCurrentUser();
  const employeeReviewOptions = new Map(await Promise.all(rows.filter(row => {
    const requirements = row.requirements as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(requirements, 'employeeCreation') && requirements.status === 'submitted';
  }).map(async row => {
    if (!reviewer) return [row.id, null] as const;
    try { return [row.id, await getEmployeeCreationReviewOptions(prisma, reviewer.identityId, row.id)] as const; }
    catch (error) { if (error instanceof EmployeeCreationError) return [row.id, null] as const; throw error; }
  })));
  const receipts = rows.flatMap(row => {
    const value = (row.requirements as Record<string, unknown>).employeeCreation;
    return value && typeof value === 'object' && !Array.isArray(value) ? [value as Record<string, unknown>] : [];
  });
  const receiptSpaceIds = [...new Set(receipts.flatMap(receipt => typeof receipt.spaceId === 'string' ? [receipt.spaceId] : []))];
  const receiptOrganizationIds = [...new Set(receipts.flatMap(receipt => typeof receipt.organizationId === 'string' ? [receipt.organizationId] : []))];
  const [creationSpaces, creationOrganizations] = await Promise.all([
    receiptSpaceIds.length ? prisma.operatingSpace.findMany({ where: { id: { in: receiptSpaceIds } }, select: { id: true, name: true } }) : [],
    receiptOrganizationIds.length ? prisma.organization.findMany({ where: { id: { in: receiptOrganizationIds } }, select: { id: true, name: true } }) : [],
  ]);
  const spaceNames = new Map(creationSpaces.map(space => [space.id, space.name]));
  const organizationNames = new Map(creationOrganizations.map(organization => [organization.id, organization.name]));
  const mediaIds = [...new Set(rows.flatMap(row => {
    const data = row.requirements as Record<string, unknown>;
    return [...(Array.isArray(data.photos) ? data.photos : []), ...(Array.isArray(data.projectPhotos) ? data.projectPhotos : [])].filter((id): id is string => typeof id === 'string');
  }))];
  const media = mediaIds.length ? await prisma.mediaAsset.findMany({ where: { id: { in: mediaIds }, kind: 'photo', encrypted: false }, select: { id: true, storageKey: true } }) : [];
  const photoUrl = new Map(media.map(asset => [asset.id, asset.storageKey]));
  return <main className="max-w-5xl">
    <h1 className="font-display text-display-xl font-semibold">Property applications</h1>
    <p className="mt-8 mb-24 text-text-secondary">Review owner and manager submissions before creating or editing canonical property records. A submitted application is not a live listing.</p>
    {rows.length === 0 ? <p>No applications yet.</p> : <div className="space-y-16">{rows.map(row => {
      const data = row.requirements as Record<string, unknown>;
      const employeeMarker = Object.prototype.hasOwnProperty.call(data, 'employeeCreation');
      const rawReceipt = data.employeeCreation && typeof data.employeeCreation === 'object' && !Array.isArray(data.employeeCreation) ? data.employeeCreation as Record<string, unknown> : null;
      const employeeCreation = rawReceipt && (rawReceipt.kind === 'unit' || rawReceipt.kind === 'complex') && typeof rawReceipt.spaceId === 'string' && typeof rawReceipt.organizationId === 'string'
        ? { kind: rawReceipt.kind as 'unit' | 'complex', spaceId: rawReceipt.spaceId, organizationId: rawReceipt.organizationId, scopeProjectId: typeof rawReceipt.scopeProjectId === 'string' ? rawReceipt.scopeProjectId : null, createdProjectId: typeof rawReceipt.createdProjectId === 'string' ? rawReceipt.createdProjectId : null, createdUnitId: typeof rawReceipt.createdUnitId === 'string' ? rawReceipt.createdUnitId : null } : null;
      const photos = Array.isArray(data.photos) ? data.photos.length : 0;
      return <article key={row.id} className="stitch-panel p-20">
        <div className="flex flex-wrap justify-between gap-12"><h2 className="font-semibold">{row.title}</h2><span className="text-small">{String(data.status || 'draft')}</span></div>
        <p className="mt-8 text-small text-text-secondary">{row.identity.firstName} {row.identity.lastName} · {row.identity.email}</p>
        {employeeCreation && <div className="mt-12 rounded-md border border-border-line p-12 text-small"><p className="font-semibold">{l('admin.employee')} · {l(employeeCreation.kind)}</p><p>{l('admin.organization')}: {organizationNames.get(employeeCreation.organizationId) || employeeCreation.organizationId}</p><p>{l('admin.space')}: {spaceNames.get(employeeCreation.spaceId) || employeeCreation.spaceId}</p><p className="mt-8">{l('admin.safety')}</p></div>}
        <p className="mt-8">Residence: {row.project?.name || String(data.proposedProject || 'Not selected')}</p>
        {!employeeMarker && <p className="mt-4">Intent: {Array.isArray(data.offers) ? data.offers.join(', ') : 'Not set'} · {photos} home photos</p>}
        <p className="mt-4 text-small">Project: {String(data.projectType || '')} · {String(data.projectAddress || '')} · area {String(data.areaId || '')} · {String(data.latitude ?? '')}, {String(data.longitude ?? '')}</p>
        {(['projectPhotos', 'photos'] as const).map(scope => <div key={scope} className="mt-12"><h3 className="text-small font-semibold">{scope === 'projectPhotos' ? 'Complex gallery' : 'Home gallery'}</h3><div className="mt-8 flex flex-wrap gap-8">{(Array.isArray(data[scope]) ? data[scope] as string[] : []).map((id, index) => photoUrl.get(id) ? <Image key={id} src={photoUrl.get(id)!} width={180} height={120} alt={`${scope === 'projectPhotos' ? 'Complex' : 'Home'} photo ${index + 1}`} className="h-32 w-44 rounded-lg object-cover" /> : <span key={id} className="text-small text-state-warning">Image unavailable</span>)}</div></div>)}
        {!employeeMarker && <p className="mt-4 text-small text-text-secondary">Contact: {String(data.contact || 'Not supplied')}</p>}
        <p className="mt-8 whitespace-pre-wrap text-small">{String(data.description || '')}</p>
        {!employeeMarker && row.projectId && <Link href={`/app/admin/projects/${row.projectId}`} className="mt-12 inline-block text-brand-andaman underline">Open existing project →</Link>}
        {!employeeMarker && <p className="mt-12 text-small text-text-secondary">Verify authority, duplicate inventory and the project's real-world location. Conversion never publishes an offer.</p>}
        {employeeMarker && !employeeCreation ? <p role="alert" className="mt-12 text-state-error">{l('error.conflict')}</p> : <ConvertPropertySubmission employeeReviewOptions={employeeReviewOptions.get(row.id) || null} employeeExistingUnitId={typeof data.existingUnitId === 'string' ? data.existingUnitId : null} employeeCreation={employeeCreation} creationLabels={creationLabels} descriptionLocale={typeof data.descriptionLocale === 'string' ? data.descriptionLocale : null} hasDescription={Boolean(String(data.description || '').trim())} id={row.id} status={String(data.status || 'draft')} existingProjectId={row.projectId} projects={projects} organizations={organizations} areas={areas} proposedAddress={String(data.projectAddress || '')} proposedAreaId={typeof data.areaId === 'string' ? data.areaId : null} proposedLatitude={typeof data.latitude === 'number' ? data.latitude : null} proposedLongitude={typeof data.longitude === 'number' ? data.longitude : null} applicantKind={String(data.kind || '')} operatingModel={typeof data.operatingModel === 'string' ? data.operatingModel : null} requestedManagementCompanyName={String(data.requestedManagementCompanyName || '')} canonicalProjectId={typeof data.canonicalProjectId === 'string' ? data.canonicalProjectId : null} canonicalUnitId={typeof data.canonicalUnitId === 'string' ? data.canonicalUnitId : null} />}
      </article>;
    })}</div>}
  </main>;
}
