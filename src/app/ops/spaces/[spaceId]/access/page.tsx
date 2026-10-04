import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { hasOperatingSpaceCapability } from '@/modules/ops';
import OperatingSpaceAccessClient from './access-client';

export const dynamic='force-dynamic';

export default async function OperatingSpaceAccessPage({params}:{params:{spaceId:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/spaces/'+encodeURIComponent(params.spaceId)+'/access');
  const space=await prisma.operatingSpace.findUnique({
    where:{id:params.spaceId},
    select:{id:true,name:true,status:true},
  });
  if(!space||space.status!=='active')redirect('/ops/spaces');
  if(!user.isAdmin&&!(await hasOperatingSpaceCapability(prisma,space.id,user.identityId,'manage_team'))){
    redirect('/ops/spaces/'+encodeURIComponent(space.id));
  }
  const labels=await getLabels({
    'staff.space_access.back':'← Workspace',
    'staff.space_access.title':'Team & access',
    'staff.space_access.subtitle':'Control exactly who can operate this portfolio, which properties they can touch, and what actions they may perform.',
    'staff.space_access.loading':'Loading access model…',
    'staff.space_access.error':'Could not update team access.',
    'staff.space_access.saved':'Access saved.',
    'staff.space_access.removed':'Access removed.',
    'staff.space_access.member_title':'Add or edit operator',
    'staff.space_access.member_hint':'Capabilities define what this person may do; selected properties define where they may do it.',
    'staff.space_access.email':'Existing myUNO account email',
    'staff.space_access.capabilities':'Capabilities',
    'staff.space_access.properties':'Managed properties',
    'staff.space_access.select_all':'Select all',
    'staff.space_access.save_member':'Save operator access',
    'staff.space_access.saving':'Saving…',
    'staff.space_access.members':'Operators',
    'staff.space_access.members_empty':'No operators assigned yet.',
    'staff.space_access.properties_count':'properties',
    'staff.space_access.no_capabilities':'No operational capabilities',
    'staff.space_access.edit':'Edit access',
    'staff.space_access.remove':'Remove',
    'staff.space_access.remove_confirm':'Remove this person from the operating space and revoke their unit access?',
    'staff.space_access.teams':'Operating teams',
    'staff.space_access.team_name':'Team name',
    'staff.space_access.create_team':'Create team',
    'staff.space_access.team_created':'Team created.',
    'staff.space_access.team_saved':'Team membership saved.',
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-20">
    <header>
      <Link href={'/ops/spaces/'+encodeURIComponent(space.id)} className="text-small font-semibold text-brand-andaman">{labels['staff.space_access.back']}</Link>
      <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['staff.space_access.title']}</h1>
      <p className="mt-8 max-w-3xl text-body text-text-secondary">{space.name} · {labels['staff.space_access.subtitle']}</p>
    </header>
    <OperatingSpaceAccessClient spaceId={space.id} labels={labels}/>
  </div></main>;
}
