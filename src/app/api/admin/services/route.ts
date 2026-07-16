import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get services pending approval (draft status, not yet approved)
    const services = await prisma.service.findMany({
      where: {
        status: 'draft',
        approved_at: null,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        availableProjects: {
          select: { project_id: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json(
      services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        categoryKey: s.category_key,
        priceModel: s.price_model,
        basePriceThb: s.base_price_thb,
        provider: s.provider,
        createdAt: s.created_at,
        availableProjectIds: s.availableProjects.map((p) => p.project_id),
      }))
    );
  } catch (error) {
    console.error('Error fetching services for approval:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
