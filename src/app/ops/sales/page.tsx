import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { getScopedOperationalAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import { RESERVATION_DEPARTMENTS } from '@/modules/ops/reservation-guests.service';
import { SALES_LABELS, SALES_DRAFTS } from '@/modules/content/sales-offer.seed';
import SalesDesk from './sales-client';
export const dynamic = 'force-dynamic';
export default async function SalesPage(props: { searchParams: Promise<{ spaceId?: string }> }) {
  const { spaceId } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/sales');
  if (!spaceId) redirect('/ops/spaces');
  const access = await getScopedOperationalAccess(prisma,user.identityId,spaceId,'manage_reservations',RESERVATION_DEPARTMENTS).catch(error=>{
    if(error instanceof OperatingAccessError) notFound(); throw error;
  });
  const [labels,saved] = await Promise.all([
    getLabels(SALES_LABELS,undefined,SALES_DRAFTS),
    prisma.salesOffer.findMany({where:{operatingSpaceId:spaceId,options:{every:{unitId:{in:access.unitIds}}}},select:{id:true,version:true,createdAt:true},orderBy:{createdAt:'desc'},take:30}),
  ]);
  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-24"><header>
    <Link href={'/ops/reservations?spaceId='+encodeURIComponent(spaceId)}>{labels['sales.back']}</Link>
    <h1 className="mt-16 font-display text-display-xl">{labels['sales.title']}</h1><p className="mt-8 text-text-secondary">{labels['sales.intro']}</p>
  </header><SalesDesk spaceId={spaceId} labels={labels} saved={saved.map(o=>({...o,createdAt:o.createdAt.toISOString()}))}/></div></main>;
}
