import { NextRequest, NextResponse } from 'next/server';
import { CrmActivityType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { addActivity } from '@/modules/crm';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    if (!Object.values(CrmActivityType).includes(body.type)) {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
    }
    const activity = await addActivity(prisma, {
      identityId: body.identityId,
      opportunityId: body.opportunityId,
      createdByIdentityId: user.identityId,
      type: body.type,
      subject: body.subject,
      body: body.body,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      metadata: body.metadata,
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'invalid_request' },
      { status: 400 }
    );
  }
}
