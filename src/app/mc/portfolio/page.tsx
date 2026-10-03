import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getMCProjectScopes, getStaffProjectIds } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: { month?: string; projectId?: string } };

export default async function ManagedPortfolioCalendarPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mc/portfolio');

  const scopes = getMCProjectScopes(user);
  const staffProjectIds = getStaffProjectIds(user);
  if (!scopes.length && !staffProjectIds.length && !user.isAdmin) redirect('/');

  const query = new URLSearchParams();
  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';

  if (scopes.length) {
    query.set('mc', '1');
    if (requestedProjectId && scopes.some((scope) => scope.projectId === requestedProjectId)) {
      query.set('projectId', requestedProjectId);
    }
  } else if (
    requestedProjectId &&
    (user.isAdmin || staffProjectIds.includes(requestedProjectId))
  ) {
    query.set('projectId', requestedProjectId);
  }

  const month = typeof searchParams?.month === 'string' ? searchParams.month : '';
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) query.set('start', month + '-01');
  query.set('days', '30');

  redirect('/ops/calendar/board?' + query.toString());
}
