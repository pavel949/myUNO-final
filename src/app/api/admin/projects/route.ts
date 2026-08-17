import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { createProject, listProjects } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import { decodePlusCode } from '@/lib/plus-code';
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
    !(await can({
      identity,
      action: 'projects:create',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { plusCode, ...rest } = body;

    // A Plus Code, when given, is the authority for the position — decoded
    // here rather than in the browser so every entry point (this form, a future
    // import, a script) resolves it the same way and against the same
    // configured reference.
    const coordinates = plusCode
      ? await resolvePlusCode(plusCode)
      : { latitude: rest.latitude, longitude: rest.longitude };

    const project = await createProject({
      ...rest,
      ...coordinates,
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

/**
 * Turn a pasted Plus Code into coordinates, using the configured reference.
 *
 * Short codes — the form Google Maps displays — are only unique within about
 * 50 km of a reference point, so the anchor comes from configuration
 * (`geo.plus_code_reference_*`, defaulting to Phuket) rather than being assumed.
 */
async function resolvePlusCode(plusCode: string) {
  const [referenceLatitude, referenceLongitude] = await Promise.all([
    getConfig(prisma, 'geo.plus_code_reference_lat'),
    getConfig(prisma, 'geo.plus_code_reference_lng'),
  ]);

  const { latitude, longitude } = decodePlusCode(plusCode, {
    referenceLatitude: Number(referenceLatitude),
    referenceLongitude: Number(referenceLongitude),
  });

  return { latitude, longitude };
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
    !(await can({
      identity,
      action: 'projects:list',
      resource: { resourceType: 'platform' },
    }))
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
