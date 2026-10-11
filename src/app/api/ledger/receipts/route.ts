/**
 * POST /api/ledger/receipts — attach a private receipt to a manual cost.
 *
 * multipart/form-data: `ledgerEntryId`, `file` (PDF/JPEG/PNG/WebP, ≤ 4 MB).
 * Header `Idempotency-Key` (UUID) makes a retry return the same receipt (200).
 * Only the cost's author (or an admin) who still holds write authority on the
 * unit may attach. The file is sealed in the database; there is no public URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  MAX_RECEIPT_BYTES,
  ReceiptError,
  ReceiptFileError,
  attachExpenseReceipt,
  isIdempotencyKey,
} from '@/modules/finance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };
// Multipart framing around the file; the hard check on the file itself follows.
const FRAMING_ALLOWANCE = 64 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }
    const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    const key = req.headers.get('idempotency-key');
    if (!isIdempotencyKey(key)) {
      return NextResponse.json(
        { error: 'An Idempotency-Key header (UUID) is required.', code: 'invalid_idempotency_key' },
        { status: 400, headers: NO_STORE }
      );
    }

    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_RECEIPT_BYTES + FRAMING_ALLOWANCE) {
      return NextResponse.json(
        { error: 'The file is larger than 4 MB.', code: 'too_large' },
        { status: 413, headers: NO_STORE }
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const ledgerEntryId = form?.get('ledgerEntryId');
    if (!(file instanceof File) || typeof ledgerEntryId !== 'string' || ledgerEntryId.length === 0) {
      return NextResponse.json(
        { error: 'A file and a ledgerEntryId are required.', code: 'invalid_body' },
        { status: 400, headers: NO_STORE }
      );
    }

    const result = await attachExpenseReceipt(prisma, identity, {
      ledgerEntryId,
      uploadKey: key,
      declaredMime: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: NO_STORE,
    });
  } catch (error) {
    if (error instanceof ReceiptFileError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'too_large' ? 413 : 400, headers: NO_STORE }
      );
    }
    if (error instanceof ReceiptError) {
      const status = error.kind === 'not_found' ? 404 : 409;
      return NextResponse.json(
        { error: error.message, code: error.kind },
        { status, headers: NO_STORE }
      );
    }
    console.error('Receipt upload error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Receipt upload failed' }, { status: 500, headers: NO_STORE });
  }
}
