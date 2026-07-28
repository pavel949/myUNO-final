import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Project-branded guest entry (LY-5): myuno.app/layantara/guest.
 * Redirects to the guest access flow (LY-7) carrying the project slug;
 * until that page ships, /login covers the signed-in path.
 */
export default async function VanityGuestRedirect({
  params,
}: {
  params: { vanitySlug: string };
}) {
  const project = await prisma.project.findUnique({
    where: { slug: params.vanitySlug },
    select: { slug: true, status: true },
  });
  if (!project || project.status !== 'live') notFound();
  redirect(`/guests/access?project=${project.slug}`);
}
