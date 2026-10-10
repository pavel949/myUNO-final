import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { UNIT_PUBLICATION_LABELS, UNIT_PUBLICATION_DRAFTS } from '@/modules/content/unit-publication.seed';
import { getUnitPublicationReadiness } from '@/modules/projects/unit-publication-readiness';

/** Admin-only read model, mounted inside the existing protected unit workspace. */
export default async function UnitPublicationPanel({ unitId }: { unitId: string }) {
  const [labels, report] = await Promise.all([
    getLabels(UNIT_PUBLICATION_LABELS, undefined, UNIT_PUBLICATION_DRAFTS),
    getUnitPublicationReadiness(unitId).catch(() => null),
  ]);
  const label = (key: string) => labels[`admin.unit_publication.${key}`];
  return <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24" aria-label={label('title')}>
    <h2 className="text-heading-3 font-semibold">{label('title')}</h2>
    {!report ? <p className="mt-12" role="status">{label('unavailable')}</p> : <>
      <div className="mt-12 flex flex-wrap gap-12">
        <p className="font-semibold">{label(report.canReceiveInquiry ? 'inquiries' : report.published ? 'visible' : 'private')}</p>
        <p>{label(report.bookingFlowAvailable ? 'booking_eligibility_only' : 'booking_disabled')}</p>
      </div>
      <p className="mt-8 text-small text-text-secondary">{label('booking_schema_warning')}</p>
      {report.published && <Link href={`/units/${unitId}`} className="mt-12 inline-block text-brand-andaman hover:underline">{label('view')} →</Link>}
      {report.detailsToAdd.length > 0 && <div className="mt-16">
        <h3 className="font-semibold">{label('details')}</h3>
        <p className="mt-8 text-small text-text-secondary">{label('details_hint')}</p>
        <ul className="mt-8 list-disc pl-20">{report.detailsToAdd.map(detail => <li key={detail}>{label(detail)}</li>)}</ul>
      </div>}
    </>}
  </section>;
}
