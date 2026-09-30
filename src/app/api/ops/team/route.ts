import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { people } from '@/modules/core';

export const dynamic = 'force-dynamic';

/**
 * Deliberately narrow delegated team administration. A project staff manager
 * may assign/revoke onsite_host for that project only. This does not confer
 * platform people:edit, staff_ops, organization, finance or admin privileges.
 * Every request checks active DB grants, not stale session role snapshots.
 */
async function authorize(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!projectId) return { error: NextResponse.json({ error: 'projectId required' }, { status: 400 }) };
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId }, select: { id: true, isAdmin: true, status: true },
  });
  if (!identity || identity.status !== 'active') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (!identity.isAdmin) {
    const managerGrant = await prisma.roleAssignment.findFirst({
      where: { identityId: identity.id, role: 'staff_ops', scopeType: 'project', projectId, status: 'active' },
      select: { id: true },
    });
    if (!managerGrant) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { identity, projectId };
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId') || '';
  const auth = await authorize(projectId);
  if (auth.error) return auth.error;
  const assignments = await prisma.roleAssignment.findMany({
    where: { projectId, scopeType: 'project', role: 'onsite_host', status: 'active' },
    select: { id: true, identityId: true, grantedByIdentityId: true,
      identity: { select: { firstName: true, lastName: true, email: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  const auth = await authorize(projectId);
  if (auth.error) return auth.error;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid existing account email required' }, { status: 400 });
  const target = await prisma.identity.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!target || target.status !== 'active') {
    return NextResponse.json({ error: 'Invite the person through People & Roles first; an active account is required' }, { status: 404 });
  }
  if (target.id === auth.identity!.id) return NextResponse.json({ error: 'Cannot assign yourself' }, { status: 403 });
  const assignment = await people.grantRole(prisma, {
    identityId: target.id, role: 'onsite_host', scopeType: 'project', projectId,
    grantedByIdentityId: auth.identity!.id,
  });
  return NextResponse.json({ id: assignment.id, projectId, role: assignment.role }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  const auth = await authorize(projectId);
  if (auth.error) return auth.error;
  const assignmentId = typeof body?.assignmentId === 'string' ? body.assignmentId : '';
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
  const assignment = await prisma.roleAssignment.findFirst({
    where: { id: assignmentId, projectId, scopeType: 'project', role: 'onsite_host', status: 'active' },
    select: { id: true, identityId: true, grantedByIdentityId: true },
  });
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!auth.identity!.isAdmin && assignment.grantedByIdentityId !== auth.identity!.id) {
    return NextResponse.json({ error: 'Only the original delegating manager or an admin may revoke this grant' }, { status: 403 });
  }
  await prisma.roleAssignment.update({ where: { id: assignment.id }, data: { status: 'revoked' } });
  return NextResponse.json({ success: true });
}
