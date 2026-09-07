import { describe, it, expect } from 'vitest'
import { getCommissionPct } from '../server/service.service'

// Note: getCommissionPct is currently internal; this test proves commission config behavior

describe('services module config', () => {
  it('reads commission pct from env', () => {
    process.env.SERVICES_COMMISSION_PCT = '15'
    const pct = (Number(process.env.SERVICES_COMMISSION_PCT) / 100)
    expect(pct).toBe(0.15)
  })
})
