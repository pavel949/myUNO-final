import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { ProviderProfileSchema } from '@/modules/services/validation/schemas'

export async function GET(req: Request) {
  try {
    const user = { identityId: 'provider-demo' } // TODO: replace with auth
    const profile = await prisma.providerProfile.findUnique({ where: { identityId: user.identityId } })
    return NextResponse.json({ ok: true, profile })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = { identityId: 'provider-demo' } // TODO: replace with auth
    const body = await req.json()

    const parsed = ProviderProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 })
    }

    const { name, taxNumber, managingDirector, email, contacts, payout } = parsed.data
    const payoutEncrypted = encrypt(JSON.stringify(payout || {}))

    const profile = await prisma.providerProfile.upsert({ where: { identityId: user.identityId }, update: { name, taxNumber, managingDirector, email, contacts: contacts || {}, payoutEncrypted }, create: { identityId: user.identityId, name, taxNumber, managingDirector, email, contacts: contacts || {}, payoutEncrypted } })

    return NextResponse.json({ ok: true, profile })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
