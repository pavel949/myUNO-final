import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import RecordCostClient from '@/app/ops/costs/record-cost-client';
import OwnerStatementGenerator from './owner-statement-generator';

export const dynamic='force-dynamic';

export default async function OperatingFinancePage({searchParams}:{searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/finance');
  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');
  const space=await prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,name:true,status:true}});
  if(!space||space.status!=='active')redirect('/ops/spaces');
  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    if(!membership?.active||!(await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'view_finance'))){
      redirect('/ops/spaces/'+encodeURIComponent(spaceId));
    }
  }
  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  const unitIds=user.isAdmin?spaceUnitIds:await getAuthorizedOperationalUnitIds(user,spaceUnitIds,['finance','reservations']);
  if(!unitIds.length)redirect('/ops/spaces/'+encodeURIComponent(spaceId));
  const [canRecord,canGenerate]=user.isAdmin
    ? [true,true]
    : await Promise.all([
        hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'record_expense'),
        hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'generate_owner_report'),
      ]);
  const [units,ledger,statements]=await Promise.all([
    prisma.unit.findMany({
      where:{id:{in:unitIds}},
      select:{id:true,name:true,project:{select:{name:true}}},
      orderBy:[{project:{name:'asc'}},{name:'asc'}],
    }),
    prisma.ledgerEntry.findMany({
      where:{unitId:{in:unitIds}},
      select:{id:true,entryType:true,amountThb:true,occurredOn:true,description:true,unit:{select:{name:true,project:{select:{name:true}}}}},
      orderBy:{occurredOn:'desc'},take:100,
    }),
    prisma.ownerStatement.findMany({
      where:{unitId:{in:unitIds}},
      select:{id:true,periodStart:true,periodEnd:true,status:true,grossRevenueTh:true,totalCostsTh:true,noiTh:true,ownerShareTh:true,unit:{select:{name:true,project:{select:{name:true}}}}},
      orderBy:{periodEnd:'desc'},take:50,
    }),
  ]);
  const labels=await getLabels({
    'staff.finance.back':'← Workspace',
    'staff.finance.title':'Finance & owner reporting',
    'staff.finance.subtitle':'Canonical ledger and owner statements for the properties in this operating space.',
    'staff.finance.ledger':'Ledger',
    'staff.finance.statements':'Owner statements',
    'staff.finance.no_ledger':'No ledger entries in this scope.',
    'staff.finance.no_statements':'No owner statements in this scope.',
    'staff.finance.revenue':'Revenue',
    'staff.finance.costs':'Costs',
    'staff.finance.noi':'NOI',
    'staff.finance.owner_share':'Owner',
    'staff.finance.generate_statement':'Generate owner statement',
    'staff.finance.generate_hint':'Create the draft owner statement from canonical bookings, payments, ledger costs and the active management engagement.',
    'staff.finance.statement_error':'Could not generate the owner statement.',
    'staff.finance.statement_created':'Draft owner statement created.',
    'staff.finance.property':'Property',
    'staff.finance.choose_property':'Choose property',
    'staff.finance.period_start':'Period start',
    'staff.finance.period_end':'Period end',
    'staff.finance.generate':'Generate draft',
    'staff.finance.generating':'Generating…',
    'ops.costs.title':'Record a cost','ops.costs.back':'← Workspace',
    'ops.costs.intro':'Costs recorded here appear on the owner statement for that unit.',
    'ops.costs.unit':'Unit','ops.costs.type':'Type','ops.costs.amount':'Amount (฿)',
    'ops.costs.date':'Date incurred','ops.costs.description':'What it was for','ops.costs.submit':'Record cost',
    'ops.costs.saving':'Recording…','ops.costs.saved':'Recorded. It will appear on the next statement.',
    'ops.costs.error':'Could not record that cost.','ops.costs.recent':'Recorded by you, most recent first',
    'ops.costs.none':'You have not recorded any costs yet.',
    'ops.costs.immutable':'A recorded cost cannot be edited or deleted — correct mistakes with an adjustment.',
    'catalog.ledger_entry_types.cleaning_cost.label':'Cleaning','catalog.ledger_entry_types.maintenance_cost.label':'Maintenance',
    'catalog.ledger_entry_types.consumables_cost.label':'Consumables','catalog.ledger_entry_types.utilities_cost.label':'Utilities',
    'catalog.ledger_entry_types.adjustment.label':'Adjustment',
  });
  const money=(value:number)=>'฿'+Math.round(value/100).toLocaleString();
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-24">
    <header><Link href={'/ops/spaces/'+encodeURIComponent(spaceId)} className="text-small font-semibold text-brand-andaman">{labels['staff.finance.back']}</Link>
      <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['staff.finance.title']}</h1>
      <p className="mt-8 text-body text-text-secondary">{space.name} · {labels['staff.finance.subtitle']}</p>
    </header>
    {canGenerate&&<OwnerStatementGenerator spaceId={spaceId} units={units.map(u=>({id:u.id,name:u.name,projectName:u.project.name}))} labels={labels}/>}
    {canRecord&&<RecordCostClient embedded units={units.map(u=>({id:u.id,name:u.name,projectName:u.project.name}))}
      recent={ledger.filter(item=>['cleaning_cost','maintenance_cost','consumables_cost','utilities_cost','adjustment'].includes(item.entryType)&&item.description).slice(0,10).map(item=>({
        id:item.id,entryType:item.entryType,amountThb:item.amountThb,occurredOn:item.occurredOn.toISOString().slice(0,10),
        description:item.description||'',unitName:item.unit?.name||'—',
      }))} labels={labels}/>}
    <div className="grid gap-20 xl:grid-cols-2">
      <section className="rounded-xl border border-border-line bg-surface-paper p-20"><h2 className="font-display text-heading-2 font-semibold">{labels['staff.finance.ledger']}</h2>
        <div className="mt-12 space-y-8">{ledger.length?ledger.map(item=><article key={item.id} className="border-b border-border-line pb-8 last:border-0">
          <div className="flex justify-between gap-8"><p className="font-semibold">{item.entryType.replace(/_/g,' ')}</p><p className="font-semibold">{money(item.amountThb)}</p></div>
          <p className="text-small text-text-secondary">{item.unit?.project.name} · {item.unit?.name} · {item.occurredOn.toLocaleDateString('en-GB',{timeZone:'Asia/Bangkok'})}</p>
          {item.description&&<p className="mt-4 text-small">{item.description}</p>}
        </article>):<p className="text-text-secondary">{labels['staff.finance.no_ledger']}</p>}</div>
      </section>
      <section className="rounded-xl border border-border-line bg-surface-paper p-20"><h2 className="font-display text-heading-2 font-semibold">{labels['staff.finance.statements']}</h2>
        <div className="mt-12 space-y-8">{statements.length?statements.map(item=><article key={item.id} className="rounded-md bg-surface-ivory p-12">
          <p className="font-semibold">{item.unit.project.name} · {item.unit.name}</p>
          <p className="text-small text-text-secondary">{item.periodStart.toISOString().slice(0,10)} → {item.periodEnd.toISOString().slice(0,10)} · {item.status}</p>
          <p className="mt-4 text-small">{labels['staff.finance.revenue']} {money(item.grossRevenueTh)} · {labels['staff.finance.costs']} {money(item.totalCostsTh)} · {labels['staff.finance.noi']} {money(item.noiTh)} · {labels['staff.finance.owner_share']} {money(item.ownerShareTh)}</p>
        </article>):<p className="text-text-secondary">{labels['staff.finance.no_statements']}</p>}</div>
      </section>
    </div>
  </div></main>;
}
