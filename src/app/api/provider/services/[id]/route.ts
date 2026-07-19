import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateService, type UpdateServiceInput } from '@/modules/services';
import { requireProviderMember } from '@/app/libs/providerGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * PATCH /api/provider/services/[id] — edit one of the caller's provider's
 * services. The module enforces draft-only editing; another provider's
 * service reads as 404 (existence hidden).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { providerId } = await requireProviderMember();

    const service = await prisma.service.findUnique({
      where: { id: params.id },
      select: { provider_id: true },
    });
    if (!service || service.provider_id !== providerId) {
      throw createPublicError('not found', 404);
    }

    const body = await req.json();
    const input: UpdateServiceInput = {};
    if (typeof body.title === 'string' && body.title.trim()) {
      input.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      input.description = body.description.trim();
    }
    if (body.basePriceThb != null) {
      const price = Math.round(Number(body.basePriceThb));
      if (!price || price <= 0) {
        throw createPublicError('invalid request: basePriceThb must be positive', 400);
      }
      input.basePriceThb = price;
    }
    if (body.durationMin != null) {
      input.durationMin = Math.max(0, Math.round(Number(body.durationMin)));
    }
    if (body.advanceNoticeHours != null) {
      input.advanceNoticeHours = Math.max(0, Math.round(Number(body.advanceNoticeHours)));
    }
    if (Object.keys(input).length === 0) {
      throw createPublicError('invalid request: nothing to update', 400);
    }

    try {
      await updateService(prisma, params.id, input);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Cannot edit')) {
        throw createPublicError('invalid request: only draft services can be edited', 400);
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
