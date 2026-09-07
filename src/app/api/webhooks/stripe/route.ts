import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { markOrderPaid } from '@/modules/services/server/service.service'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!stripeSecret || !webhookSecret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 })

    const stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' })
    const raw = await req.text()
    const signature = req.headers.get('stripe-signature') || ''
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret)
    } catch (err) {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    // Idempotency: record event if not seen
    const existing = await prisma.serviceOrderEvent.findFirst({ where: { type: 'WEBHOOK_RECEIVED', data: { path: ['webhookId'], equals: event.id } } as any })
    if (!existing) {
      await prisma.serviceOrderEvent.create({ data: { orderId: '', actorId: 'system', type: 'WEBHOOK_RECEIVED', data: { webhookId: event.id, raw: raw } } })
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      const orderId = (pi.metadata && (pi.metadata as any).orderId) as string | undefined
      if (orderId) {
        await markOrderPaid(orderId, pi.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
