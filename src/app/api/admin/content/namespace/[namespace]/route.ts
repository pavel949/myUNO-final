import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { listContentKeys } from '@/modules/content/edit.service';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { namespace: string } }
) {
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
      action: 'content:view',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    const keys = await listContentKeys(prisma, params.namespace, { search, status });

    // Transform to response format
    const response = (keys as any).map((key: any) => ({
      id: key.id,
      key: key.key,
      namespace: key.namespace,
      description: key.description,
      supportsRich: key.supportsRich,
      translations: (key.translations as any).map((t: any) => ({
        locale: t.locale,
        value: t.value,
        status: t.status,
        updatedAt: t.updatedAt,
      })),
    }));

    return NextResponse.json({ keys: response });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list content keys' },
      { status: 400 }
    );
  }
}
