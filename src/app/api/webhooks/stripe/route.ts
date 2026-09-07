import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { buffer } from 'micro'
import { markOrderPaid } from '@/modules/services/server/service.service'

// Note: Next.js App Router has a non-trivial webhook setup. This file is a minimal placeholder.

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

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      // Lookup order by metadata.orderId if we attached it
      const orderId = (pi.metadata && pi.metadata.orderId) as string | undefined
      if (orderId) {
        await markOrderPaid(orderId, pi.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
