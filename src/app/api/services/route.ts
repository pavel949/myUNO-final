import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { listPublicServices } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the project context from the user's roles
    const userRole = user.roles[0];
    if (!userRole?.projectId) {
      return NextResponse.json(
        { error: 'No project context' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const categoryKey = searchParams.get('categoryKey') || undefined;

    const services = await listPublicServices(prisma, userRole.projectId, {
      categoryKey: categoryKey || undefined,
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
