/**
 * POST /api/ledger/record-cost
 * Record a manual cost entry in the unit ledger (F-OPS-3, F-MC-2).
 *
 * Authority is per unit (staff, or an MC member for a unit their company
 * manages), decided in `recordManualCost`. The request must carry an
 * `Idempotency-Key` (UUID): a retry returns the same row (200), the same key
 * with different content is a 409, and nothing is ever written twice.
 *
 * `amountThb` is a positive whole number of satang (the platform's only unit);
 * the ledger stores the cost negative. `occurredOn` is the business date
 * (YYYY-MM-DD) in the unit's project zone and cannot be in the future.
 *
 * A receipt is NOT accepted here — upload it to `/api/ledger/receipts` once the
 * cost exists. `receiptMediaId` is refused so nobody believes one was attached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  ManualCostError,
  ManualCostInputError,
  parseManualCostRequest,
  recordManualCost,
} from '@/modules/finance';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

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

    const body = await req.json().catch(() => null);
    const request = parseManualCostRequest(body, req.headers.get('idempotency-key'));

    const result = await recordManualCost(prisma, identity, request);

    return NextResponse.json(
      {
        id: result.entry.id,
        entryType: result.entry.entryType,
        amountThb: result.entry.amountSatang,
        unitId: result.entry.unitId,
        description: result.entry.description,
        occurredOn: result.entry.occurredOn,
        createdAt: result.entry.createdAt,
        replayed: result.replayed,
        reportImpact: result.reportImpact,
      },
      { status: result.replayed ? 200 : 201, headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof ManualCostInputError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400, headers: NO_STORE }
      );
    }
    if (error instanceof ManualCostError) {
      const status =
        error.kind === 'forbidden' ? 403 : error.kind === 'unit_not_found' ? 404 : 409;
      return NextResponse.json(
        { error: error.message, code: error.kind },
        { status, headers: NO_STORE }
      );
    }
    console.error('Record cost error:', error);
    return NextResponse.json({ error: 'Recording cost failed' }, { status: 500, headers: NO_STORE });
  }
}
