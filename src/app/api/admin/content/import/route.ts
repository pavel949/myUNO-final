import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { importFromCSV } from '@/modules/content/edit.service';
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
    !(await can({
      identity,
      action: 'content:edit',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const namespace = formData.get('namespace') as string;

    if (!file || !namespace) {
      return NextResponse.json(
        { error: 'file and namespace are required' },
        { status: 400 }
      );
    }

    const csvContent = await file.text();
    const result = await importFromCSV(prisma, namespace, csvContent, user.identityId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to import content' },
      { status: 400 }
    );
  }
}
