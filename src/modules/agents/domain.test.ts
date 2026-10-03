import { describe, it, expect } from 'vitest';
import { amount, contactInput, composeLinks, expires } from './domain';
describe('agent input and messenger sharing',()=>{
  it('keeps high value money exact in integer satang',()=>{
    expect(amount('12500000000')).toBe(12500000000n);
    for(const bad of [10, '-1','1.5','01','999999999999999','NaN']) expect(()=>amount(bad)).toThrow('invalid_amount');
  });
  it('validates private client channels without modifying identity data',()=>{
    expect(contactInput({displayName:' Client ',email:'A@EXAMPLE.COM',phone:'+66812345678',telegram:'@client_name'}))
      .toMatchObject({displayName:'Client',email:'a@example.com',phone:'+66812345678',telegram:'client_name'});
    expect(()=>contactInput({displayName:'Client',phone:'0812345678'})).toThrow('phone_requires_e164');
    expect(()=>contactInput({displayName:'Client'})).toThrow('contact_channel_required');
  });
  it('encodes quotes, Cyrillic and tokens for WhatsApp and Telegram compose only',()=>{
    const url='https://example.com/p/abc';
    const message='Вилла & дом';
    const links=composeLinks(url,message);
    expect(new URL(links.whatsapp).searchParams.get('text')).toBe(message+'\n'+url);
    expect(new URL(links.telegram).searchParams.get('url')).toBe(url);
    expect(new URL(links.telegram).searchParams.get('text')).toBe(message);
    expect(()=>composeLinks('javascript:alert(1)',message)).toThrow('invalid_share_url');
  });
  it('rejects stale, malformed and excessively long quote expiries',()=>{
    const now=new Date('2026-10-02T00:00:00Z');
    expect(expires('2026-10-03T00:00:00Z',now).toISOString()).toBe('2026-10-03T00:00:00.000Z');
    for(const value of ['bad','2026-10-01','2027-10-01']) expect(()=>expires(value,now)).toThrow('invalid_expiry');
  });
});
