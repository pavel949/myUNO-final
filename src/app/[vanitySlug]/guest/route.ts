import { NextRequest, NextResponse } from 'next/server';
import { resolveLiveProjectSlug, vanityNotFound } from '@/app/[vanitySlug]/vanity';

export const dynamic = 'force-dynamic';

/**
 * Project-branded guest entry (LY-5): myuno.app/layantara/guest → the guest
 * access flow (LY-7) carrying the project slug. Route Handler for the same
 * reason as the parent segment: real 307/404 statuses instead of a streamed
 * 200 shell.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { vanitySlug: string } }
) {
  const slug = await resolveLiveProjectSlug(params.vanitySlug);
  if (!slug) return vanityNotFound();
  return NextResponse.redirect(new URL(`/guests/access?project=${slug}`, req.url), 307);
}
