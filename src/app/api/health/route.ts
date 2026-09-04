import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function dbHealth(error: unknown): 'pool_exhausted' | 'unreachable' {
  const msg = error instanceof Error ? error.message : String(error);
  if (/EMAXCONNSESSION|max clients reached/i.test(msg)) return 'pool_exhausted';
  return 'unreachable';
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    const db = dbHealth(error);
    return Response.json({ status: 'degraded', db }, { status: 503 });
  }
}
