import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ingestFederationEvent } from '@/modules/integrations';

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

/**
 * Generic federation ingress for Layantara and future property systems.
 * Disabled unless MYUNO_FEDERATION_SECRET is configured server-side.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.MYUNO_FEDERATION_SECRET;
  const provided = req.headers.get('x-myuno-federation-secret') || '';
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const occurredAt = new Date(body.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json({ error: 'occurredAt must be an ISO timestamp' }, { status: 400 });
    }
    const result = await ingestFederationEvent(prisma, {
      systemKey: String(body.systemKey || ''),
      environment: String(body.environment || ''),
      displayName: body.displayName ? String(body.displayName) : undefined,
      eventId: String(body.eventId || ''),
      aggregateType: String(body.aggregateType || ''),
      aggregateExternalId: String(body.aggregateExternalId || ''),
      eventType: String(body.eventType || ''),
      eventVersion: body.eventVersion === undefined ? undefined : Number(body.eventVersion),
      occurredAt,
      payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    });
    return NextResponse.json(result, { status: result.status === 'duplicate' ? 200 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Federation ingest failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
