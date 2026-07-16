import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify the service belongs to the provider
    const service = await prisma.service.findUnique({
      where: { id: params.id },
    });

    if (!service || service.provider_id !== providerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only allow deletion of draft services
    if (service.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft services can be deleted' },
        { status: 400 }
      );
    }

    await prisma.service.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}
