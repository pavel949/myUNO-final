import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

/** GET /api/auth/me — the caller's identity summary (or 401). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    id: user.identityId,
    firstName: user.firstName,
    lastName: user.lastName,
    isAdmin: user.isAdmin,
    roles: user.roles.map((role) => role.role),
  });
}
