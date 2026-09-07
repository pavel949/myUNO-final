import { describe, it, expect } from 'vitest'
import { ProviderProfileSchema, FlowersMetaSchema } from '../validation/schemas'

describe('validation schemas', () => {
  it('validates provider profile shape', () => {
    const ok = ProviderProfileSchema.safeParse({ name: 'X', email: 'a@b.com', payout: { bankName: 'B', accountNumber: '123', routingNumber: '456' } })
    expect(ok.success).toBe(true)
  })

  it('rejects invalid flowers meta', () => {
    const res = FlowersMetaSchema.safeParse({ vaseRequired: 'notbool' })
    expect(res.success).toBe(false)
  })
})
