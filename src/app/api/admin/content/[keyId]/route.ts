import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { getContentKey, updateTranslation } from '@/modules/content/edit.service';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
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
    const key = await getContentKey(prisma, params.keyId);
    if (!key) {
      return NextResponse.json({ error: 'Content key not found' }, { status: 404 });
    }

    const keyData = key as any;
    return NextResponse.json({
      id: keyData.id,
      key: keyData.key,
      namespace: keyData.namespace,
      description: keyData.description,
      supportsRich: keyData.supportsRich,
      translations: keyData.translations.map((t: any) => ({
        locale: t.locale,
        value: t.value,
        status: t.status,
        updatedAt: t.updatedAt,
        updatedBy: t.updatedBy
          ? { id: t.updatedBy.id, email: t.updatedBy.email, name: `${t.updatedBy.firstName} ${t.updatedBy.lastName}`.trim() }
          : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch content key' },
      { status: 400 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { keyId: string } }
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
      action: 'content:edit',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { locale, value } = body;

    if (!locale || value === undefined) {
      return NextResponse.json(
        { error: 'locale and value are required' },
        { status: 400 }
      );
    }

    await updateTranslation(prisma, {
      contentKeyId: params.keyId,
      locale,
      value,
      identityId: user.identityId,
    });

    const updated = await getContentKey(prisma, params.keyId);
    return NextResponse.json({
      success: true,
      key: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update content key' },
      { status: 400 }
    );
  }
}
