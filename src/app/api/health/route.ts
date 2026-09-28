import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { productionConfigurationReady } from '@/lib/productionReadiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function dbHealth(error: unknown): 'pool_exhausted' | 'unreachable' {
  const msg = error instanceof Error ? error.message : String(error);
  if (/EMAXCONNSESSION|max clients reached/i.test(msg)) return 'pool_exhausted';
  return 'unreachable';
}

export async function GET(request: NextRequest) {
  const strict = request.nextUrl.searchParams.get('strict') === '1';
  const configurationReady = !strict || productionConfigurationReady();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const healthy = configurationReady;
    return Response.json(
      {
        status: healthy ? 'ok' : 'degraded',
        db: 'ok',
        ...(strict ? {
          configuration: configurationReady ? 'ok' : 'degraded',
          release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
        } : {}),
      },
      { status: healthy ? 200 : 503, headers: NO_STORE }
    );
  } catch (error) {
    return Response.json(
      { status: 'degraded', db: dbHealth(error) },
      { status: 503, headers: NO_STORE }
    );
  }
}
