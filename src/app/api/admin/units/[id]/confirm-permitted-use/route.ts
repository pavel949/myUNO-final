import { requireAction } from '@/app/libs/onboardingGuard';
import { confirmPermittedUse } from '@/modules/projects';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Confirming permitted use is the hard gate before a unit can go live, and
  // doc 03 marks `owner` and `mc_member` read-only on
  // `compliance:manage_compliance_records` — the canonical action behind this
  // route's legacy name. `can()` does not distinguish 'read' from 'allow'
  // (Q58), so this must assert write access explicitly, and scope the check to
  // the unit rather than a platform placeholder.
  const guard = await requireAction('compliance:confirm_permitted_use', {
    requiredAccess: 'allow',
    unitId: params.id,
  });
  if (!guard.ok) return guard.error;

  try {
    const unit = await confirmPermittedUse(params.id, guard.actorIdentityId);
    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to confirm permitted use' },
      { status: 400 }
    );
  }
}
