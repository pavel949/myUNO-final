import { NextResponse } from 'next/server';
import { requireAction } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Minimal, bounded inventory picker for the founder's role-assignment form. */
export async function GET(req: Request) {
  const guard = await requireAction('people:edit');
  if (!guard.ok) return guard.error;

  const params = new URL(req.url).searchParams;
  const projectId = params.get('projectId')?.trim();
  const query = params.get('q')?.trim() ?? '';
  if (!projectId || projectId.length > 200 || query.length > 200) {
    return NextResponse.json({ error: 'A valid projectId and search query are required' }, { status: 400 });
  }

  const items = await prisma.unit.findMany({
    where: {
      projectId,
      ...(query ? { OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { id: query },
      ] } : {}),
    },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 51,
  });
  return NextResponse.json({ items: items.slice(0, 50), hasMore: items.length > 50 });
}
