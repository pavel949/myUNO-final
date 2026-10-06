import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getMCProjectScopes, getStaffProjectIds } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: { month?: string; projectId?: string } };

/**
 * Compatibility route. For management-company users, Portfolio now opens the
 * managed-property section of PMS Today. Staff/admin retain the calendar route.
 */
export default async function ManagedPortfolioCompatibilityPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mc/portfolio');

  const scopes = getMCProjectScopes(user);
  const staffProjectIds = getStaffProjectIds(user);
  if (!scopes.length && !staffProjectIds.length && !user.isAdmin) redirect('/');

  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';

  if (scopes.length) {
    const activeScope =
      (requestedProjectId ? scopes.find((scope) => scope.projectId === requestedProjectId) : null) ??
      scopes[0];
    const query = new URLSearchParams({
      projectId: activeScope.projectId,
      organizationId: activeScope.organizationId,
    });
    redirect('/mc?' + query.toString() + '#managed-properties');
  }

  const query = new URLSearchParams();
  if (
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
