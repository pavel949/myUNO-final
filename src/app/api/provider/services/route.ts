import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createService, getServicesByProvider } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a provider member and get provider ID
    const roleAssignment = await prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        role: 'provider_member',
        status: 'active',
      },
    });

    if (!roleAssignment?.providerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providerId = roleAssignment.providerId;
    const services = await getServicesByProvider(prisma, providerId);

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching provider services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a provider member and get provider ID
    const roleAssignment = await prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        role: 'provider_member',
        status: 'active',
      },
    });

    if (!roleAssignment?.providerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providerId = roleAssignment.providerId;
    const body = await req.json();

    const result = await createService(prisma, {
      providerId,
      categoryKey: body.categoryKey,
      title: body.title,
      description: body.description,
      priceModel: body.priceModel,
      basePriceThb: body.basePriceThb,
      availableProjectIds: body.availableProjectIds || [],
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
