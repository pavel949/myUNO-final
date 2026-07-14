import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as financeService from '@/modules/finance';

/**
 * POST /api/checkout/confirm
 * Confirm a pending payment and flip booking to confirmed.
 * Mock provider always confirms; real provider validates with provider API.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const result = await financeService.verifyAndConfirm(prisma, sessionId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
