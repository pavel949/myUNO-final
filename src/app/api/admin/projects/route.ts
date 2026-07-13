import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { createProject, listProjects } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !can({
      identity,
      action: 'projects:create',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const project = await createProject({
      ...body,
      actorIdentityId: user.identityId,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !can({
      identity,
      action: 'projects:list',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const status = req.nextUrl.searchParams.get('status');
    const projectList = await listProjects(status as any);
    return NextResponse.json(projectList);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch projects' },
      { status: 400 }
    );
  }
}
