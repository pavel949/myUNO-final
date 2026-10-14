import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

/**
 * Repeat the admin layout's gate before server-page reads. Next.js may render
 * a page and its layout in parallel, so the layout is not the read boundary.
 */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/app/admin');
  if (!user.isAdmin) redirect('/');
  return user;
}
