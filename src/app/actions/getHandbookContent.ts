'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './getCurrentUser';
import { getRequestLocale } from '@/lib/i18n';
import { t } from '@/modules/content';

export async function fetchHandbookContent(bookingId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Fetch the booking and verify access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Verify the user is the guest on this booking
    if (booking.guestIdentityId !== user.identityId) {
      throw new Error('Access denied');
    }

    // Fetch the project handbook key
    const project = await prisma.project.findUnique({
      where: { id: booking.unit.projectId },
      select: {
        id: true,
        name: true,
        handbookKey: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Fetch the handbook content using the translation seam
    const handbookContentKey = project.handbookKey || 'project.handbook.default';
    const locale = getRequestLocale();
    const handbookContent = await t(prisma, handbookContentKey, undefined, locale);

    return {
      projectName: project.name,
      handbookKey: handbookContentKey,
      handbookContent: handbookContent && handbookContent !== handbookContentKey ? handbookContent : '',
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch handbook content');
  }
}
