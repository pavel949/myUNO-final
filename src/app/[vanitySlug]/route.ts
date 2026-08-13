import { NextRequest, NextResponse } from 'next/server';
import { resolveLiveProjectSlug, vanityNotFound } from './vanity';

export const dynamic = 'force-dynamic';

/**
 * Vanity project URLs (LY-5): myuno.app/layantara → /projects/layantara.
 * Config-not-code: any live project slug works; the canonical page stays
 * under /projects so every resort shares one structure (doc 08 §4).
 *
 * A Route Handler, not a page: the root loading.tsx makes every page stream
 * a 200 shell before notFound()/redirect() can run, so a page here could
 * only soft-redirect (meta refresh) and soft-404. A handler controls the
 * real HTTP status — 307 for live slugs, 404 (branded, localized) otherwise.
 * Static segments still win over this dynamic one, so /search etc. are
 * unaffected.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { vanitySlug: string } }
) {
  const slug = await resolveLiveProjectSlug(params.vanitySlug);
  if (!slug) return vanityNotFound();
  return NextResponse.redirect(new URL(`/projects/${slug}`, req.url), 307);
}
