import { describe, expect, it } from 'vitest';
import {
  lifecycleAfterWin,
  opportunityTypeForAudience,
  parseLeadContact,
  validateProbability,
} from './domain';

describe('CRM domain rules', () => {
  it('maps a guest purchase win to the owner lifecycle', () => {
    expect(lifecycleAfterWin('rental')).toBe('guest');
    expect(lifecycleAfterWin('purchase')).toBe('owner');
    expect(lifecycleAfterWin('sale')).toBe('former_client');
    expect(lifecycleAfterWin('management')).toBe('owner');
    expect(lifecycleAfterWin('developer_advisory')).toBeNull();
  });

  it('maps each public audience to the correct pipeline', () => {
    expect(opportunityTypeForAudience('owners')).toBe('management');
    expect(opportunityTypeForAudience('developers')).toBe('developer_advisory');
    expect(opportunityTypeForAudience('buyers')).toBe('purchase');
    expect(opportunityTypeForAudience('mc')).toBe('management');
  });

  it('normalizes lead contact data without guessing an invalid value', () => {
    expect(parseLeadContact('USER@Example.com')).toEqual({
      email: 'user@example.com',
      preferredChannel: 'email',
    });
    expect(parseLeadContact('+66 81 234 5678')).toEqual({
      phone: '+66812345678',
      preferredChannel: 'whatsapp',
    });
    expect(parseLeadContact('@telegram_name')).toEqual({ preferredChannel: 'manual' });
  });

  it('rejects probabilities outside the closed 0–100 range', () => {
    expect(validateProbability(0)).toBe(0);
    expect(validateProbability(100)).toBe(100);
    expect(() => validateProbability(101)).toThrow('invalid_probability');
    expect(() => validateProbability(10.5)).toThrow('invalid_probability');
  });
});
