import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function PropertySubmissionsPage() {
  const rows = await prisma.crmOpportunity.findMany({
    where: { source: 'myuno_property_submission_v1' },
    include: { identity: { select: { firstName: true, lastName: true, email: true } }, project: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
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
        <p className="mt-4">Intent: {Array.isArray(data.offers) ? data.offers.join(', ') : 'Not set'} · {photos} photos</p>
        <p className="mt-4 text-small text-text-secondary">Contact: {String(data.contact || 'Not supplied')}</p>
        <p className="mt-8 whitespace-pre-wrap text-small">{String(data.description || '')}</p>
        {row.projectId && <Link href={`/app/admin/projects/${row.projectId}`} className="mt-12 inline-block text-brand-andaman underline">Open existing project →</Link>}
        <p className="mt-12 text-small text-text-secondary">Verify authority, duplicate inventory, photos, contract and permitted use before using the canonical onboarding workflow.</p>
      </article>;
    })}</div>}
  </main>;
}
