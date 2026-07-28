import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Vanity project URLs (LY-5): myuno.app/layantara → /projects/layantara.
 * Config-not-code: any live project slug works; the canonical page stays
 * under /projects so every resort shares one structure (doc 08 §4).
 * Static segments always win over this dynamic one in the App Router, so
 * existing routes (/search, /services, …) are unaffected.
 */
export default async function VanityProjectRedirect({
  params,
}: {
  params: { vanitySlug: string };
}) {
  const project = await prisma.project.findUnique({
    where: { slug: params.vanitySlug },
    select: { slug: true, status: true },
  });
  if (!project || project.status !== 'live') notFound();
  redirect(`/projects/${project.slug}`);
}
