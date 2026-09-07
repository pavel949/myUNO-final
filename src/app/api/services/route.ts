import { NextResponse } from 'next/server'
import * as svc from './service.service'

export async function GET(req: Request) {
  return NextResponse.json({ ok: true, message: 'Services API root' })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body._op === 'createService') {
      const created = await svc.createService(body.payload)
      return NextResponse.json({ created })
    }
    return NextResponse.json({ ok: false, error: 'unknown operation' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
