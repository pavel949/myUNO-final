import { NextResponse } from 'next/server'
import * as svc from '@/modules/services/server/service.service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body._op === 'book') {
      const order = await svc.bookService(body.payload)
      return NextResponse.json({ ok: true, order })
    }
    if (body._op === 'markPaid') {
      const order = await svc.markOrderPaid(body.payload.orderId, body.payload.paymentRef)
      return NextResponse.json({ ok: true, order })
    }
    return NextResponse.json({ ok: false, error: 'unknown operation' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
