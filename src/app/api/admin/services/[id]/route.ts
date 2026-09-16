import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import {
  approveService,
  rejectService,
  updateService,
  type UpdateServiceInput,
} from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
      action: 'admin:modify',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, reason } = body;

    if (action === 'approve') {
      await approveService(prisma, params.id, user.identityId);
      return NextResponse.json({ message: 'Service approved' });
    }
    if (action === 'reject') {
      await rejectService(prisma, params.id, user.identityId, reason);
      return NextResponse.json({ message: 'Service rejected' });
    }

    /*
     * Taking a service off the marketplace and putting it back. Separate from
     * approve/reject, which are the vetting decision and happen once: pausing
     * is the day-to-day control the myUNO team needs when a provider is away
     * or a price has to be reworked.
     */
    if (action === 'pause' || action === 'activate') {
      await updateService(prisma, params.id, {
        status: action === 'pause' ? 'paused' : 'active',
      });
      return NextResponse.json({ message: `Service ${action}d` });
    }

    /*
     * Editing the service itself. The team could create a service and approve
     * it but never correct it — a typo in a live description was permanent.
     * `updateService` owns what may change at which status; this only decides
     * which fields an admin may send at all, so a stray body key cannot write
     * a column nobody meant to expose.
     */
    if (action === 'edit') {
      const input: UpdateServiceInput = {};

      const text = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);
      for (const field of [
        'title',
        'description',
        'titleRu',
        'titleEn',
        'titleTh',
        'descriptionRu',
        'descriptionEn',
        'descriptionTh',
      ] as const) {
        const value = text(body[field]);
        if (value !== undefined) input[field] = value;
      }

      // Money arrives in satang, as it is stored — the admin form converts on
      // the way out, so nothing here re-converts it (CLAUDE.md money rules).
      if (body.basePriceThb != null) {
        const price = Math.round(Number(body.basePriceThb));
        if (!Number.isFinite(price) || price <= 0) {
          return NextResponse.json(
            { error: 'basePriceThb must be a positive whole number of satang' },
            { status: 400 }
          );
        }
        input.basePriceThb = price;
      }
      if (body.durationMin != null) {
        input.durationMin = Math.max(0, Math.round(Number(body.durationMin)));
      }
      if (body.advanceNoticeHours != null) {
        input.advanceNoticeHours = Math.max(0, Math.round(Number(body.advanceNoticeHours)));
      }

      /*
       * The cover photograph. The id comes from POST /api/media/upload, which
       * has already checked the type and size — this only confirms the asset
       * is real, so a mistyped id cannot point a card at nothing. An explicit
       * null clears the picture.
       */
      if (body.coverMediaId !== undefined) {
        if (body.coverMediaId === null) {
          input.coverMediaId = null;
        } else if (typeof body.coverMediaId === 'string' && body.coverMediaId) {
          const asset = await prisma.mediaAsset.findUnique({
            where: { id: body.coverMediaId },
            select: { id: true },
          });
          if (!asset) {
            return NextResponse.json({ error: 'Unknown image' }, { status: 400 });
          }
          input.coverMediaId = asset.id;
        }
      }

      if (Object.keys(input).length === 0) {
        return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
      }

      await updateService(prisma, params.id, input);
      return NextResponse.json({ message: 'Service updated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process service' },
      { status: 400 }
    );
  }
}
