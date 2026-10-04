import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import OperatingSpaceManager from './space-manager';

export const dynamic='force-dynamic';

export default async function ManageOperatingSpacesPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/login?next=/ops/spaces/manage');
 if(!user.isAdmin)redirect('/ops/spaces');
 const labels=await getLabels({
  'staff.space_manage.back':'← Operating spaces',
  'staff.space_manage.title':'Operating-space setup',
  'staff.space_manage.subtitle':'Create management portfolios and define exactly which properties belong to each operating context.',
  'staff.space_manage.error':'Could not save the operating space.',
  'staff.space_manage.create':'Create operating space',
  'staff.space_manage.edit':'Edit operating space',
  'staff.space_manage.hint':'Use one space for each independently operated resort, portfolio, or management team context.',
  'staff.space_manage.cancel':'Cancel edit',
  'staff.space_manage.name':'Name',
  'staff.space_manage.key':'Key',
  'staff.space_manage.organization':'Organization',
  'staff.space_manage.status':'Status',
  'staff.space_manage.choose':'Choose organization',
  'staff.space_manage.active':'Active',
  'staff.space_manage.archived':'Archived',
  'staff.space_manage.properties':'Properties in this space',
  'staff.space_manage.properties_hint':'A space may contain a full resort or selected units across different projects.',
  'staff.space_manage.search':'Search project, category or property',
  'staff.space_manage.selected':'properties selected',
  'staff.space_manage.save':'Save operating space',
  'staff.space_manage.saving':'Saving…',
  'staff.space_manage.created':'Operating space created.',
  'staff.space_manage.updated':'Operating space updated.',
  'staff.space_manage.existing':'Existing operating spaces',
  'staff.space_manage.properties_count':'properties',
  'staff.space_manage.members_count':'operators',
  'staff.space_manage.teams_count':'teams',
  'staff.space_manage.edit_action':'Edit',
 });
 return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-24">
  <header><Link href="/ops/spaces" className="text-small font-semibold text-brand-andaman">{labels['staff.space_manage.back']}</Link>
   <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['staff.space_manage.title']}</h1>
   <p className="mt-8 max-w-3xl text-body text-text-secondary">{labels['staff.space_manage.subtitle']}</p>
  </header>
  <OperatingSpaceManager labels={labels}/>
 </div></main>;
}
