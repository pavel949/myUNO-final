/**
 * GET /api/ledger/receipts/[receiptId] — download a private receipt.
 *
 * Authorised on every request from live data: an operator with write authority
 * on the cost's unit, or the recorded recipient of a visible statement that
 * cites this receipt. Anyone else — including a receipt that does not exist —
 * gets the same 404. Never cached, never inline, never sniffed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { ReceiptIntegrityError, readExpenseReceipt } from '@/modules/finance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export async function GET(_req: NextRequest, { params }: { params: { receiptId: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
    }
    const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
    }

    const download = await readExpenseReceipt(prisma, identity, params.receiptId);
    if (!download) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: PRIVATE_HEADERS });
    }

    return new NextResponse(new Uint8Array(download.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': download.mimeType,
        'Content-Length': String(download.bytes.length),
        'Content-Disposition': `attachment; filename="${download.filename}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof ReceiptIntegrityError) {
      return NextResponse.json(
        { error: 'Receipt could not be read' },
        { status: 500, headers: PRIVATE_HEADERS }
      );
    }
    console.error('Receipt download error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { error: 'Receipt could not be read' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
