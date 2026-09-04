import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. One dedicated
 * route historically used `X-Cron-Secret`; both are accepted so a manual
 * invoke and the platform scheduler share a gate. Unset CRON_SECRET never
 * authenticates — "Bearer undefined" must not pass.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const bearer = req.headers.get('authorization');
  if (bearer === `Bearer ${cronSecret}`) return true;

  const headerSecret = req.headers.get('x-cron-secret');
  return headerSecret === cronSecret;
}

export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
