import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
export const dynamic='force-dynamic';
export default async function TeamCrmEntry() {
  const user=await getCurrentUser();
  if(!user) redirect('/login?next=/work/crm');
  // Administrative authority is retained until a team-specific grant exists.
  if(!user.isAdmin) redirect('/agent');
  redirect('/app/admin/agent-partners');
}
