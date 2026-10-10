import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { readOwnerEvidenceDraft, saveOwnerEvidenceDraft } from '@/modules/projects/owner-evidence.service';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const statuses: Record<string, number> = { OWNER_EVIDENCE_FORBIDDEN: 403, PROJECT_NOT_FOUND: 404,
    OWNER_EVIDENCE_CONFLICT: 409, OWNER_EVIDENCE_INVALID: 400, OWNER_EVIDENCE_VERSION_REQUIRED: 428 };
  return NextResponse.json({ error: statuses[code] ? code : 'OWNER_EVIDENCE_FAILED' }, { status: statuses[code] ?? 500, headers });
}
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try { return NextResponse.json(await readOwnerEvidenceDraft(prisma, params.id, user.identityId), { headers }); }
  catch (error) { return failure(error); }
}
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    const raw = await req.text();
    if (raw.length > 12000) throw new Error('OWNER_EVIDENCE_INVALID');
    let body;
    try { body = JSON.parse(raw); } catch { throw new Error('OWNER_EVIDENCE_INVALID'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['expectedVersion','evidence'].includes(k))) throw new Error('OWNER_EVIDENCE_INVALID');
    return NextResponse.json(await saveOwnerEvidenceDraft(prisma, {
      projectId: params.id, actorIdentityId: user.identityId, expectedVersion: body.expectedVersion, evidence: body.evidence,
    }), { headers });
  } catch (error) { return failure(error); }
}
