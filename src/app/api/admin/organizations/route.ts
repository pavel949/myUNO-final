import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { addProjectOrganizationRole } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'people:view',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const orgType = req.nextUrl.searchParams.get('orgType') || undefined;
    const projectId = req.nextUrl.searchParams.get('projectId') || undefined;

    // Keep the mature people service as the compatibility read, then attach
    // canonical ProjectOrganizationRole relationships. The old scalar
    // Organization.projectId remains readable until all old records migrate,
    // but new surfaces no longer have to infer one-project-only semantics.
    const organizations = await people.listOrganizations(prisma, {
      orgType: orgType as any,
      projectId,
    });

    const organizationIds = organizations.map((organization) => organization.id);
    const projectRoles = organizationIds.length
      ? await prisma.projectOrganizationRole.findMany({
          where: {
            organizationId: { in: organizationIds },
            ...(projectId ? { projectId } : {}),
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        })
      : [];

    const rolesByOrganization = new Map<string, typeof projectRoles>();
    for (const role of projectRoles) {
      const current = rolesByOrganization.get(role.organizationId) || [];
      current.push(role);
      rolesByOrganization.set(role.organizationId, current);
    }

    return NextResponse.json({
      organizations: organizations.map((organization) => ({
        ...organization,
        projectRoles: rolesByOrganization.get(organization.id) || [],
      })),
    });
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

  if (
    !(await can({
      identity,
      action: 'people:edit',
      resource: { resourceType: 'platform' },
      requiredAccess: 'allow',
    }))
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

    let projectRole = null;
    if (projectId) {
      const roleKey =
        orgType === 'developer'
          ? 'developer'
          : orgType === 'juristic_person'
            ? 'juristic_person'
            : 'management_company';

      projectRole = await addProjectOrganizationRole(prisma, {
        projectId,
        organizationId: organization.id,
        roleKey,
        isPrimary: true,
        provenance: 'admin',
      });
    }

    return NextResponse.json({ success: true, organization, projectRole });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create organization' },
      { status: 400 }
    );
  }
}
