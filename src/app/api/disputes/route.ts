import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { ServiceOrderClosureError } from '@/modules/services/service-order-closure';
import { raiseDispute, DisputeRequestError } from '@/modules/comms/dispute.service';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import type { DisputeSubjectType, RoleType } from '@prisma/client';

const SUBJECT_TYPES: DisputeSubjectType[] = ['booking', 'service_order', 'statement'];

/**
 * POST /api/disputes — raise a dispute over a booking, service order, or
 * statement (doc 07 F-DIS-2, Q52).
 * Body: { subjectType, subjectId, title, description }
 *
 * `raiseDispute` itself refuses a dispute raised over a record the caller
 * doesn't own — this route only needs to work out which role the caller is
 * acting as, for the ticket's own record.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const { subjectType, subjectId, title, description } = body ?? {};

    if (!SUBJECT_TYPES.includes(subjectType)) {
      throw createPublicError(
        `invalid request: subjectType must be one of ${SUBJECT_TYPES.join(', ')}`,
        400
      );
    }
    if (typeof subjectId !== 'string' || !subjectId.trim() || subjectId.length > 200 ||
        typeof title !== 'string' || !title.trim() || title.length > 200 ||
        typeof description !== 'string' || !description.trim() || description.length > 4000) {
      throw createPublicError(
        'invalid request: subjectId, title, and description are required',
        400
      );
    }

    const defaultRole: RoleType = subjectType === 'statement' ? 'owner' : 'guest';
    const raisedByRole =
      user.roles.find((r) => r.role === defaultRole)?.role ?? (user.isAdmin ? 'staff_ops' : defaultRole);

    const dispute = await raiseDispute(prisma, {
      subjectType,
      subjectId: subjectId.trim(),
      raisedByIdentityId: user.identityId,
      raisedByRole: raisedByRole as RoleType,
      title: title.trim(),
      description: description.trim(),
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    if (error instanceof DisputeRequestError) return handleError(createPublicError(error.status === 404 ? 'not found' : error.message, error.status));
    if (error instanceof ServiceOrderClosureError) return handleError(createPublicError('The service order is no longer open for a dispute. Contact support for further help.', 409));
    return handleError(error);
  }
}
