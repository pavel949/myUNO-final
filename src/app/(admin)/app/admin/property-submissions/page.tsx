/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import ConvertPropertySubmission from './convert-client';

export const dynamic = 'force-dynamic';

export default async function PropertySubmissionsPage() {
  const [rows, projects, organizations] = await Promise.all([prisma.crmOpportunity.findMany({
    where: { source: 'myuno_property_submission_v1' },
    include: { identity: { select: { firstName: true, lastName: true, email: true } }, project: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  }), prisma.project.findMany({ where: { status: { not: 'archived' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }), prisma.organization.findMany({ where: { status: 'active', orgType: 'management_company' }, select: { id: true, name: true, projectId: true }, orderBy: { name: 'asc' } })]);
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
      const photos = Array.isArray(data.photos) ? data.photos.length : 0;
      return <article key={row.id} className="rounded-xl border border-border-line bg-surface-paper p-20">
        <div className="flex flex-wrap justify-between gap-12"><h2 className="font-semibold">{row.title}</h2><span className="text-small">{String(data.status || 'draft')}</span></div>
        <p className="mt-8 text-small text-text-secondary">{row.identity.firstName} {row.identity.lastName} · {row.identity.email}</p>
        <p className="mt-8">Residence: {row.project?.name || String(data.proposedProject || 'Not selected')}</p>
        <p className="mt-4">Intent: {Array.isArray(data.offers) ? data.offers.join(', ') : 'Not set'} · {photos} home photos</p>
        <p className="mt-4 text-small">Project: {String(data.projectType || '')} · {String(data.projectAddress || '')} · area {String(data.areaId || '')} · {String(data.latitude ?? '')}, {String(data.longitude ?? '')}</p>
        {(['projectPhotos', 'photos'] as const).map(scope => <div key={scope} className="mt-12"><h3 className="text-small font-semibold">{scope === 'projectPhotos' ? 'Complex gallery' : 'Home gallery'}</h3><div className="mt-8 flex flex-wrap gap-8">{(Array.isArray(data[scope]) ? data[scope] as string[] : []).map((id, index) => photoUrl.get(id) ? <Image key={id} src={photoUrl.get(id)!} width={180} height={120} alt={`${scope === 'projectPhotos' ? 'Complex' : 'Home'} photo ${index + 1}`} className="h-32 w-44 rounded-lg object-cover" /> : <span key={id} className="text-small text-state-warning">Image unavailable</span>)}</div></div>)}
        <p className="mt-4 text-small text-text-secondary">Contact: {String(data.contact || 'Not supplied')}</p>
        <p className="mt-8 whitespace-pre-wrap text-small">{String(data.description || '')}</p>
        {row.projectId && <Link href={`/app/admin/projects/${row.projectId}`} className="mt-12 inline-block text-brand-andaman underline">Open existing project →</Link>}
        <p className="mt-12 text-small text-text-secondary">Verify authority, duplicate inventory and the project's real-world location. Conversion never publishes an offer.</p>
        <ConvertPropertySubmission id={row.id} status={String(data.status || 'draft')} existingProjectId={row.projectId} projects={projects} organizations={organizations} applicantKind={String(data.kind || '')} canonicalProjectId={typeof data.canonicalProjectId === 'string' ? data.canonicalProjectId : null} canonicalUnitId={typeof data.canonicalUnitId === 'string' ? data.canonicalUnitId : null} />
      </article>;
    })}</div>}
  </main>;
}
