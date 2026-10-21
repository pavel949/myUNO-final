import { PropertyEditConflict } from '@/modules/projects/edit-validation';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { updateProject } from '@/modules/projects';

async function guard(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const assigned = await prisma.roleAssignment.findFirst({
    where: { identityId: user.identityId, role: 'staff_ops', scopeType: 'project', projectId, status: 'active' },
    select: { id: true },
  });
  if (!user.isAdmin && !assigned) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, brand: true, address: true, city: true, district: true, projectType: true, totalUnits: true, status: true, updatedAt: true },
  });
  return project ? NextResponse.json(project) : NextResponse.json({ error: 'Project not found' }, { status: 404 });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  try {
    const body = await req.json();
    const allowed = ['name', 'brand', 'address', 'city', 'district', 'projectType', 'totalUnits', 'expectedUpdatedAt'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) {
      return NextResponse.json({ error: 'Only canonical descriptive project fields may be updated here.' }, { status: 403 });
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) throw new Error('Project name is required');
    if (body.address !== undefined && (typeof body.address !== 'string' || !body.address.trim())) throw new Error('Address is required');
    if (body.totalUnits !== undefined && body.totalUnits !== null && (!Number.isInteger(body.totalUnits) || body.totalUnits < 0)) throw new Error('Invalid total units');
    const fields = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
    const updated = await updateProject({ projectId: params.id, ...fields, actorIdentityId: access.user.identityId });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof PropertyEditConflict) return NextResponse.json({ error: 'property_edit_conflict', code: 'property_edit_conflict' }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update project' }, { status: 400 });
  }
}
