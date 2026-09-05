import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processOpnEvent, type OpnWebhookEvent } from '@/modules/finance/provider-webhook.service';
import { getPaymentProvider } from '@/modules/finance/providers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/opn
 * Opn/Omise payment webhook (doc 10 §1). Verifies by re-fetching the event
 * from the API — Opn does not sign webhook bodies.
 */
export async function POST(req: NextRequest) {
  if (process.env.PAYMENT_PROVIDER !== 'opn') {
    return NextResponse.json({ error: 'Opn webhooks are not enabled' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId =
    typeof body === 'object' && body !== null && 'id' in body && typeof (body as { id: unknown }).id === 'string'
      ? (body as { id: string }).id
      : null;

  if (!eventId) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  try {
    const provider = getPaymentProvider();
    if (!('fetchEvent' in provider) || typeof provider.fetchEvent !== 'function') {
      return NextResponse.json({ error: 'Provider does not support webhooks' }, { status: 503 });
    }

    const event = (await provider.fetchEvent(eventId)) as OpnWebhookEvent;
    const result = await processOpnEvent(prisma, event);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('[webhooks/opn] processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
  }
}
