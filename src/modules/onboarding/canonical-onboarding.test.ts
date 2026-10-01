import { describe, expect, it } from 'vitest';
import {
  canonicalOfferings,
  classifyPropertySubmission,
  normalizeUnitIdentifier,
  requestedOfferToCanonical,
} from './canonical-onboarding';

describe('canonical onboarding domain contracts', () => {
  it('maps presentation rental intents into canonical offering types', () => {
    expect(requestedOfferToCanonical('short_stay')).toBe('short_term_stay');
    expect(requestedOfferToCanonical('monthly')).toBe('long_term_rental');
    expect(requestedOfferToCanonical('yearly')).toBe('long_term_rental');
    expect(requestedOfferToCanonical('sale')).toBe('sale');
    expect(canonicalOfferings(['monthly', 'yearly', 'sale'])).toEqual(['long_term_rental', 'sale']);
  });

  it('keeps CRM classification distinct across sale rental and management', () => {
    expect(classifyPropertySubmission({ kind: 'home', offers: ['sale'], operatingModel: 'owner_direct' })).toBe('sale');
    expect(classifyPropertySubmission({ kind: 'home', offers: ['monthly'], operatingModel: 'owner_direct' })).toBe('rental');
    expect(classifyPropertySubmission({ kind: 'home', offers: ['short_stay'], operatingModel: 'via_management_company' })).toBe('rental');
    expect(classifyPropertySubmission({ kind: 'home', offers: ['monthly'], operatingModel: 'direct_managed' })).toBe('management');
    expect(classifyPropertySubmission({ kind: 'management', offers: ['monthly'], operatingModel: 'via_management_company' })).toBe('management');
  });

  it('normalizes common Unit labels for duplicate detection', () => {
    expect(normalizeUnitIdentifier('F705')).toBe(normalizeUnitIdentifier('F-705'));
    expect(normalizeUnitIdentifier('Unit F 705')).toBe(normalizeUnitIdentifier('F705'));
    expect(normalizeUnitIdentifier('Building F / 705')).toBe(normalizeUnitIdentifier('F705'));
  });
});
