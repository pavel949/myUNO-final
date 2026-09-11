import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'people:view',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const query = (req.nextUrl.searchParams.get('q') || '').trim();
    const rawLimit = req.nextUrl.searchParams.get('limit');
    const rawOffset = req.nextUrl.searchParams.get('offset');
    const requestedLimit = rawLimit === null ? 20 : Number(rawLimit);
    const requestedOffset = rawOffset === null ? 0 : Number(rawOffset);

    if (
      (rawLimit !== null && rawLimit.trim() === '') ||
      (rawOffset !== null && rawOffset.trim() === '') ||
      !Number.isInteger(requestedLimit) ||
      !Number.isInteger(requestedOffset)
    ) {
      return NextResponse.json({ error: 'limit and offset must be integers' }, { status: 400 });
    }

    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const offset = Math.max(requestedOffset, 0);

    // Email is an identity key, not fuzzy search text. Unit onboarding uses
    // this route to resolve an owner by email; returning the first partial
    // match could assign legal/financial ownership to the wrong person.
    // Identity.email is CITEXT+unique, so findUnique gives case-insensitive
    // exact resolution and zero ambiguity.
    if (query.includes('@')) {
      const exact = await prisma.identity.findUnique({ where: { email: query } });
      const identities = exact ? [exact] : [];
      return NextResponse.json({
        identities: identities.map(publicIdentity),
        total: identities.length,
        matchMode: 'exact_email',
      });
    }

    const { identities, total } = await people.searchIdentities(prisma, {
      query,
      limit,
      offset,
    });

    return NextResponse.json({
      identities: identities.map(publicIdentity),
      total,
      matchMode: 'search',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to search identities' },
      { status: 400 }
    );
  }
}

function publicIdentity(i: any) {
  return {
    id: i.id,
    email: i.email,
    firstName: i.firstName,
    lastName: i.lastName,
    phone: i.phone,
    status: i.status,
    isAdmin: i.isAdmin,
    createdAt: i.createdAt,
  };
}
