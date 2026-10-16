import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createEmployeeCreationService, employeeCreationFailure } from '@/modules/onboarding/employee-creation.service';
const service = createEmployeeCreationService(prisma);
const failure = (error: unknown) => { const result = employeeCreationFailure(error); return NextResponse.json({ error: result.error }, { status: result.status }); };
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const query = req.nextUrl.searchParams;
    if (query.has('id')) return NextResponse.json(await service.get(user.identityId, query.get('id')));
    if (query.has('requestId')) return NextResponse.json(await service.byRequest(user.identityId, query.get('requestId')));
    if (query.has('spaceId')) return NextResponse.json(await service.duplicates(user.identityId, { spaceId: query.get('spaceId'), kind: query.get('kind'), projectId: query.get('projectId'), q: query.get('q') }));
    return NextResponse.json(await service.list(user.identityId));
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await service.create(user.identityId, await req.json()), { status: 201 }); }
  catch (error) { return failure(error); }
}
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await service.update(user.identityId, await req.json())); }
  catch (error) { return failure(error); }
}
