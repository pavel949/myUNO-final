import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createProviderApplication } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/providers/apply — submit a provider application (F-PROV-1).
 * Categories must come from the configured catalog; one live application
 * (applied/vetting/active) per identity.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const contactEmail =
      typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
    const contactPhone =
      typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';
    const categoryKeys: string[] = Array.isArray(body.categoryKeys)
      ? body.categoryKeys.filter((k: unknown): k is string => typeof k === 'string')
      : [];

    if (!name || !description || !contactEmail || !contactPhone || categoryKeys.length === 0) {
      throw createPublicError(
        'invalid request: name, description, contact details and at least one category are required',
        400
      );
    }

    const catalog =
      ((await getConfig(prisma, 'catalog.service_categories')) as
        | { key: string }[]
        | null) ?? [];
    const validKeys = new Set(catalog.map((c) => c.key));
    const unknown = categoryKeys.filter((k) => !validKeys.has(k));
    if (unknown.length > 0) {
      throw createPublicError(
        `invalid request: unknown categories: ${unknown.join(', ')}`,
        400
      );
    }

    const existing = await prisma.provider.findFirst({
      where: {
        applicant_identity_id: user.identityId,
        status: { in: ['applied', 'vetting', 'active'] },
      },
      select: { id: true },
    });
    if (existing) {
      throw createPublicError('conflict: you already have a provider application', 409);
    }

    const created = await createProviderApplication(prisma, {
      name,
      description,
      contactEmail,
      contactPhone,
      categoryKeys,
      applicantIdentityId: user.identityId,
    });

    return NextResponse.json({ providerId: created.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
