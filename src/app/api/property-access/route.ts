import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { PropertyCapabilityError } from '@/modules/core/property-capability-access';
import { isPropertyCapabilityRole } from '@/modules/core/property-capability-policy';
import { grantPropertyCapability, revokePropertyCapability } from '@/modules/core/property-capability-grants';
import { propertyDelegationWorkspace, propertyDelegationUnits, resolvePropertyDelegationRecipient } from '@/modules/core/property-capability-directory';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => error instanceof PropertyCapabilityError
  ? NextResponse.json({ error: error.message }, { status: error.status })
  : NextResponse.json({ error: 'Could not update property access' }, { status: 500 });
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json(query.has('parentGrantId')
      ? await propertyDelegationUnits(prisma, user.identityId, { role: query.get('role'), parentGrantId: query.get('parentGrantId'), query: query.get('q') ?? '' })
      : await propertyDelegationWorkspace(prisma, user.identityId));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PropertyCapabilityError('Invalid request', 400);
    const value = body as Record<string, unknown>;
    if (value.action === 'revoke') {
      if (Object.keys(value).some(key => !['action', 'roleAssignmentId'].includes(key)) || typeof value.roleAssignmentId !== 'string')
        throw new PropertyCapabilityError('Invalid revocation', 400);
      const result = await revokePropertyCapability(prisma, user.identityId, value.roleAssignmentId);
      return NextResponse.json({ id: result.grant.id, status: result.grant.status, alreadyRevoked: result.alreadyRevoked });
    }
    if (value.action !== 'grant' || Object.keys(value).some(key => !['action', 'email', 'role', 'parentGrantId', 'scopeType', 'projectId', 'unitId', 'expiresAt', 'expectedUpdatedAt'].includes(key)) ||
      !isPropertyCapabilityRole(value.role) || typeof value.parentGrantId !== 'string') throw new PropertyCapabilityError('Invalid assignment', 400);
    const identityId = await resolvePropertyDelegationRecipient(prisma, user.identityId, value.role, value.parentGrantId, value.email);
    const result = await grantPropertyCapability(prisma, user.identityId, { identityId, role: value.role, parentGrantId: value.parentGrantId,
      scopeType: value.scopeType, projectId: value.projectId, unitId: value.unitId, expiresAt: value.expiresAt, expectedUpdatedAt: value.expectedUpdatedAt, canDelegate: false });
    return NextResponse.json({ id: result.grant.id, status: result.grant.status, alreadyGranted: result.alreadyGranted });
  } catch (error) { return failure(error); }
}
