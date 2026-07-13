import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

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
      action: 'people:view',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const orgType = req.nextUrl.searchParams.get('orgType') || undefined;
    const projectId = req.nextUrl.searchParams.get('projectId') || undefined;

    const organizations = await people.listOrganizations(prisma, {
      orgType: orgType as any,
      projectId,
    });

    return NextResponse.json({ organizations });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list organizations' },
      { status: 400 }
    );
  }
}

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
      action: 'people:edit',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, orgType, projectId, contactEmail, contactPhone } = body;

    if (!name || !orgType || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: 'name, orgType, contactEmail, and contactPhone are required' },
        { status: 400 }
      );
    }

    const organization = await people.createOrganization(prisma, {
      name,
      orgType,
      projectId,
      contactEmail,
      contactPhone,
    });

    return NextResponse.json({ success: true, organization });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create organization' },
      { status: 400 }
    );
  }
}
