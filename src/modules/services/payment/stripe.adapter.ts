import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY || ''
const stripe = new Stripe(stripeKey, { apiVersion: '2022-11-15' })

export async function createImmediateCharge(amountCents: number, currency: string, paymentMethodId: string, description?: string, metadata?: Record<string,string>) {
  // Creates a PaymentIntent and captures immediately
  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    payment_method: paymentMethodId,
    confirm: true,
    capture_method: 'automatic',
    confirmation_method: 'manual',
    off_session: true,
    description,
    metadata,
  })
  return pi
}
