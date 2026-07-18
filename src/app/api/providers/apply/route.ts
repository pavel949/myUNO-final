import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createProviderApplication } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, contactEmail, contactPhone, categoryKeys } = await req.json();

    if (!name || !contactEmail || !contactPhone || !categoryKeys?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await createProviderApplication(prisma, {
      name,
      description,
      contactEmail,
      contactPhone,
      categoryKeys,
      identityId: user.identityId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Provider application error:', error);
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}
