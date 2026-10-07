import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getStaffProjectIds } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

/** One entry point for project, category and individual-home occupancy. */
export default async function OpsCalendarIndexPage({ searchParams }: {
  searchParams?: { spaceId?: string; projectId?: string; categoryId?: string; unitId?: string; start?: string; days?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/calendar');
  if (!user.isAdmin && !getStaffProjectIds(user).length) redirect('/');
  const query = new URLSearchParams();
  for (const key of ['spaceId', 'projectId', 'categoryId', 'unitId', 'start', 'days'] as const) {
    const value = searchParams?.[key];
    if (typeof value === 'string' && value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect('/ops/calendar/board' + (suffix ? '?' + suffix : ''));
}
