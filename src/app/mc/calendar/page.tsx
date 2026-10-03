import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getMCProjectScopes } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

interface McCalendarIndexPageProps {
  searchParams?: {
    projectId?: string;
    organizationId?: string;
    categoryId?: string;
    unitId?: string;
    start?: string;
    days?: string;
  };
}

/**
 * Compatibility entry point. MC calendar authority now lives in the shared
 * operational projection at /ops/calendar/board; unit writes remain on the
 * existing canonical unit availability/pricing screens.
 */
export default async function McCalendarIndexPage({ searchParams }: McCalendarIndexPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mc/calendar');

  const scopes = getMCProjectScopes(user);
  if (!scopes.length) redirect('/');

  const requestedProjectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : '';
  const requestedOrganizationId =
    typeof searchParams?.organizationId === 'string' ? searchParams.organizationId : '';

  const activeScope =
    scopes.find((scope) =>
      scope.projectId === requestedProjectId &&
      (!requestedOrganizationId || scope.organizationId === requestedOrganizationId)
    ) ??
    (requestedProjectId ? scopes.find((scope) => scope.projectId === requestedProjectId) : null) ??
    scopes[0];

  const query = new URLSearchParams({
    mc: '1',
    projectId: activeScope.projectId,
    organizationId: activeScope.organizationId,
  });
  for (const key of ['categoryId', 'unitId', 'start', 'days'] as const) {
    const value = searchParams?.[key];
    if (typeof value === 'string' && value) query.set(key, value);
  }

  redirect('/ops/calendar/board?' + query.toString());
}
