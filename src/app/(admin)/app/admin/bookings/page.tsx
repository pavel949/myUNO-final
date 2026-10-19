import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Booking records and operational actions are now one workspace, not a second
 * admin-owned lifecycle. The former admin list remains a stable entry URL for
 * bookmarks and navigation; all writes happen against the canonical Booking
 * through /ops/stays and /ops. Financial reconciliation has a separate,
 * read-only booking journey under /app/admin/bookings/[id]/journey.
 */
export default async function AdminBookingsPage(
  props: {
    searchParams?: Promise<{ projectId?: string; department?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const query = new URLSearchParams();
  if (searchParams?.projectId) query.set('projectId', searchParams.projectId);
  if (searchParams?.department) query.set('department', searchParams.department);
  const suffix = query.toString();
  redirect('/ops/stays' + (suffix ? '?' + suffix : ''));
}
