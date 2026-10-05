import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
const SOURCE_SYSTEM_KEY = 'layantara_os';

/**
 * The project this source feeds is whichever project its mapped villas belong
 * to — read from the ExternalRecordLink rows, never a hard-coded id, so the
 * page works in every environment and for a re-imported project.
 */
async function resolveSourceProjectId(): Promise<string | null> {
  const link = await prisma.externalMapping.findFirst({
    where: { entity_type: 'unit', externalSystem: { system_key: SOURCE_SYSTEM_KEY } },
    select: { internal_id: true },
  });
  if (!link) return null;
  const unit = await prisma.unit.findUnique({ where: { id: link.internal_id }, select: { projectId: true } });
  return unit?.projectId ?? null;
}

type SourceAudit = { source_table:string; source_count:number; copied_count:number; verified:boolean };
type SourceState = { state:string; occupancy_kind:string; n:bigint };
type Verification = { specification:string; n:bigint };

export default async function LayantaraOperationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/app/admin/layantara');
  if (!user.isAdmin) redirect('/');

  const projectId = await resolveSourceProjectId();
  const scoped = <T,>(query: (id: string) => Promise<T>, empty: T) => (projectId ? query(projectId) : Promise.resolve(empty));

  // Only aggregates are shown here: no guest names, passport, finance details or
  // secret source payloads are exposed to browser clients.
  const [audit, sourceStates, specifications, mapped, blockers, unitCount, categoryCount, bookings, project, labels] =
    await Promise.all([
      // The source snapshot schema exists only where the import ran.
      prisma.$queryRaw<SourceAudit[]>`SELECT source_table, source_count, copied_count, verified FROM layantara_copy.import_audit ORDER BY source_table`.catch(() => [] as SourceAudit[]),
      prisma.$queryRaw<SourceState[]>`SELECT payload->>'state' AS state, payload->>'occupancy_kind' AS occupancy_kind, count(*)::bigint AS n FROM layantara_copy.source_row WHERE source_table = 'operational_occupancies' GROUP BY 1,2 ORDER BY 1,2`.catch(() => [] as SourceState[]),
      prisma.$queryRaw<Verification[]>`SELECT payload->>'specification_verification_status' AS specification, count(*)::bigint AS n FROM layantara_copy.source_row WHERE source_table = 'villa_master_crosswalk' GROUP BY 1 ORDER BY 1`.catch(() => [] as Verification[]),
      prisma.externalMapping.count({where:{entity_type:'unit',externalSystem:{system_key:SOURCE_SYSTEM_KEY}}}),
      scoped(id => prisma.blockedDate.count({where:{unit:{projectId:id},externalRef:{startsWith:'layantara:occupancy:'}}}), 0),
      scoped(id => prisma.unit.count({where:{projectId:id}}), 0),
      scoped(id => prisma.inventoryCategory.count({where:{projectId:id}}), 0),
      scoped(id => prisma.booking.count({where:{projectId:id}}), 0),
      scoped(id => prisma.project.findUnique({where:{id},select:{name:true,status:true}}), null),
      getLabels({
        'admin.layantara.title':'Layan Tara Villas · operations',
        'admin.layantara.subtitle':'Portfolio overview · categories, villas, calendar and stay operations.',
        'admin.layantara.project':'Project',
        'admin.layantara.categories':'Categories',
        'admin.layantara.units':'Physical villas',
        'admin.layantara.mappings':'Verified identity mappings',
        'admin.layantara.protection':'Protective occupancy blocks',
        'admin.layantara.canonical':'Canonical bookings',
        'admin.layantara.snapshots':'Source reconciliation',
        'admin.layantara.verified':'Verified records',
        'admin.layantara.source_occupancy':'Occupancy sources',
        'admin.layantara.specs':'Physical specification checks',
        'admin.layantara.gate':'Booking channel readiness',
        'admin.layantara.gate_text':'Keep project, categories and villas in draft until source deltas, booking/payment identities, rate plans, media and 31 pending specifications are reconciled. Protective blocks must remain in place until replaced atomically by confirmed bookings.',
        'admin.layantara.calendar':'Unified calendar',
        'admin.layantara.inventory':'Manage villas',
        'admin.layantara.bookings':'Bookings',
        'admin.layantara.ops':'Stay operations',
        'admin.layantara.source':'Source snapshot',
        'admin.layantara.status':'Status',
        'admin.layantara.count':'Records',
        'admin.layantara.passed':'Verified',
        'admin.layantara.failed':'Requires review',
        'admin.layantara.draft':'Sales paused · source calendar authoritative',
      }),
    ]);
  const approved = audit.filter(row => row.verified && row.source_count === row.copied_count).length;
  const stats = [
    [labels['admin.layantara.categories'],categoryCount],
    [labels['admin.layantara.units'],unitCount],
    [labels['admin.layantara.mappings'],mapped],
    [labels['admin.layantara.protection'],blockers],
    [labels['admin.layantara.canonical'],bookings],
    [labels['admin.layantara.verified'],approved + ' / ' + audit.length],
  ];
  return <main className="space-y-24">
    <header className="space-y-8">
      <p className="text-kicker font-bold uppercase tracking-wider text-brand-andaman">{labels['admin.layantara.project']}</p>
      <h1 className="font-display text-display-xl font-semibold text-text-ink">{project?.name || labels['admin.layantara.title']}</h1>
      <p className="max-w-3xl text-body text-text-secondary">{labels['admin.layantara.subtitle']}</p>
      <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-12 py-4 text-small font-semibold text-amber-900">{labels['admin.layantara.draft']}</span>
      <div className="flex flex-wrap gap-8">
        <Link className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white" href={projectId ? '/ops/calendar/board?projectId='+projectId : '/ops/calendar/board'}>{labels['admin.layantara.calendar']}</Link>
        <Link className="rounded-md border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink" href="/app/admin/units">{labels['admin.layantara.inventory']}</Link>
        <Link className="rounded-md border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink" href="/app/admin/bookings">{labels['admin.layantara.bookings']}</Link>
        <Link className="rounded-md border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink" href={projectId ? '/ops?projectId='+projectId : '/ops'}>{labels['admin.layantara.ops']}</Link>
      </div>
    </header>
    <section className="grid grid-cols-2 gap-12 md:grid-cols-3">
      {stats.map(([name,value])=><div key={name} className="rounded-lg border border-border-line bg-surface-paper p-16"><p className="text-small text-text-secondary">{name}</p><p className="mt-4 font-display text-heading-2 text-text-ink">{value}</p></div>)}
    </section>
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-20">
      <h2 className="font-display text-heading-3 font-semibold text-amber-950">{labels['admin.layantara.gate']}</h2>
      <p className="mt-8 text-body text-amber-950">{labels['admin.layantara.gate_text']}</p>
    </section>
    <div className="grid gap-16 lg:grid-cols-2">
      <section className="rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="font-display text-heading-3 text-text-ink">{labels['admin.layantara.source_occupancy']}</h2>
        <div className="mt-12 divide-y divide-border-line">{sourceStates.map(row=><div key={row.state+row.occupancy_kind} className="flex justify-between gap-12 py-8 text-small"><span className="text-text-secondary">{row.occupancy_kind} · {row.state}</span><strong className="text-text-ink">{String(row.n)}</strong></div>)}</div>
      </section>
      <section className="rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="font-display text-heading-3 text-text-ink">{labels['admin.layantara.specs']}</h2>
        <div className="mt-12 divide-y divide-border-line">{specifications.map(row=><div key={row.specification} className="flex justify-between gap-12 py-8 text-small"><span className="text-text-secondary">{row.specification}</span><strong className="text-text-ink">{String(row.n)}</strong></div>)}</div>
      </section>
    </div>
    <section className="rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-3 text-text-ink">{labels['admin.layantara.snapshots']}</h2>
      <div className="mt-12 overflow-x-auto"><table className="w-full text-left text-small"><thead><tr className="border-b border-border-line text-text-secondary"><th className="py-8">{labels['admin.layantara.source']}</th><th className="py-8">{labels['admin.layantara.count']}</th><th className="py-8">{labels['admin.layantara.status']}</th></tr></thead><tbody>{audit.map(row=><tr key={row.source_table} className="border-b border-border-line last:border-0"><td className="py-8">{row.source_table}</td><td className="py-8">{row.copied_count} / {row.source_count}</td><td className="py-8">{row.verified && row.source_count===row.copied_count?labels['admin.layantara.passed']:labels['admin.layantara.failed']}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
