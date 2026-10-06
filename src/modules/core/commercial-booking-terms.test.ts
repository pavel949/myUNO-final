import { describe, expect, it } from 'vitest';
import { resolveSourceBookingTerms } from './commercial-booking-terms';
const rule=(season:string|null) => ({
  id:'policy-'+season, active:true,scope_type:'project',
  rate_mode:'daily',season_code:season,min_nights:5,
  confirmation_payment_type:'percentage',confirmation_payment_value:50,
  security_deposit_thb:3000,security_deposit_usd:100,
  cancellation_summary:'Cancellation by signed terms',
  balance_timing:'Balance at check-in',stay_terms:'Arrival from 15:00',
  amendments_allowed:true,included:['Breakfast'],excluded:['Deposit'],
});
describe('commercial booking term migration',()=>{
  it('resolves season-specific terms without losing deposit or payment rules',()=>{
    expect(resolveSourceBookingTerms([rule(null),rule('HIGH')],'daily','HIGH')).toMatchObject({
      sourcePolicyId:'policy-HIGH',minimumNights:5,confirmationPaymentValue:50,
      securityDepositThbSatang:300000,securityDepositUsdCents:10000,
      seasonCode:'HIGH',included:['Breakfast'],
    });
  });
  it('fails closed for ambiguous or missing source terms',()=>{
    expect(()=>resolveSourceBookingTerms([rule('HIGH'),rule('HIGH')],'daily','HIGH')).toThrow(/conflicting/);
    expect(()=>resolveSourceBookingTerms([rule('HIGH')],'daily','GREEN')).toThrow(/Missing/);
  });
  it('carries the season refund ladder when the source rule has one (ruling 2026-10-06)',()=>{
    const green={...rule('GREEN'),cancellation_steps:[{days:14,pct:100},{days:0,pct:0}]};
    expect(resolveSourceBookingTerms([green],'daily','GREEN').cancellationSteps)
      .toEqual([{days:14,pct:100},{days:0,pct:0}]);
    expect(resolveSourceBookingTerms([rule('HIGH')],'daily','HIGH').cancellationSteps).toBeUndefined();
  });
  it('rejects a malformed ladder instead of refunding the wrong amount',()=>{
    for (const steps of [[], [{days:0,pct:150}], [{days:0,pct:0},{days:14,pct:100}], [{days:-1,pct:0}]]) {
      expect(()=>resolveSourceBookingTerms([{...rule('GREEN'),cancellation_steps:steps}],'daily','GREEN'))
        .toThrow(/Invalid source cancellation steps/);
    }
  });
});
