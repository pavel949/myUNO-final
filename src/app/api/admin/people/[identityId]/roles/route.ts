import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAction } from '@/app/libs/onboardingGuard';

/**
 * What roles this person holds, and where.
 *
 * `getIdentityRoleAssignments` existed with no caller — so the grant and revoke
 * routes could change a person's roles while nothing could show what they
 * already had. Granting blind is how someone ends up with two of the same role
 * or a scope nobody meant to give.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { identityId: string } }) {
  const guard = await requireAction('people:view');
  if (!guard.ok) return guard.error;

  const [identity, assignments] = await Promise.all([
    prisma.identity.findUnique({
      where: { id: params.identityId },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    }),
    prisma.roleAssignment.findMany({
      where: { identityId: params.identityId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!identity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    identity,
    assignments: assignments.map((a) => ({
      id: a.id,
      role: a.role,
      scopeType: a.scopeType,
      status: a.status,
      projectName: a.project?.name ?? null,
      unitName: a.unit?.name ?? null,
    })),
  });
}
