import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import { resolveLanding } from '@/modules/core';
import type { RoleType } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * The adaptive landing (doc 08 §5).
 *
 * It did not exist, so where a person ended up depended entirely on which link
 * they had last been sent: an owner who typed the bare domain got the marketing
 * site, and a resident got it too, because there was nowhere else for them.
 *
 * A redirect rather than a page of its own. Anyone arriving here wants to be
 * somewhere, and an interstitial asking "which of your hats?" is a question the
 * roles already answer — the navigation carries the other hats for the people
 * who wear several.
 */
export default async function AppLandingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/app');
  }

  const activeBookingId = await getActiveStayId(user.identityId);

  const landing = resolveLanding({
    isAdmin: user.isAdmin,
    roles: user.roles.map((r) => r.role as RoleType),
    activeBookingId,
  });

  redirect(landing.path);
}
