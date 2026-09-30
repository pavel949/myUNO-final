import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const PREFIX = 'private:regulatory-evidence:v1:';

/** Admin-only encrypted document store. Never exposes a public URL or raw PII in an audit event. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
    return NextResponse.json({ error: 'Upload a PDF/JPEG/PNG/WebP document up to 2 MB' }, { status: 400 });
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storageKey = PREFIX + encrypt(bytes.toString('base64'));
    const asset = await prisma.mediaAsset.create({ data: {
      storageKey, kind: 'document', encrypted: true,
      mimeType: file.type, sizeBytes: file.size,
      uploadedByIdentityId: guard.actorIdentityId,
    } });
    return NextResponse.json({ mediaAssetId: asset.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not protect evidence; check encryption configuration' }, { status: 500 });
  }
}

/** Evidence retrieval is privileged and intentionally never uses mediaUrl or public Blob. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Evidence ID required' }, { status: 400 });
  const asset = await prisma.mediaAsset.findUnique({
    where: { id }, select: { storageKey: true, mimeType: true, kind: true, encrypted: true },
  });
  if (!asset || asset.kind !== 'document' || !asset.encrypted || !asset.storageKey.startsWith(PREFIX)) {
    return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
  }
  try {
    const bytes = Buffer.from(decrypt(asset.storageKey.slice(PREFIX.length)), 'base64');
    return new NextResponse(bytes, { headers: {
      'Content-Type': asset.mimeType,
      'Content-Disposition': 'attachment; filename="regulatory-evidence"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return NextResponse.json({ error: 'Evidence could not be decrypted' }, { status: 500 });
  }
}
