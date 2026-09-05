import { describe, it, expect } from 'vitest';
import { getOpportunityTypeVariant, getOpportunityTypeChipClasses, getStageClasses } from './crmPresentation';

describe('getOpportunityTypeVariant', () => {
  it('maps rental and management to info', () => {
    expect(getOpportunityTypeVariant('rental')).toBe('info');
    expect(getOpportunityTypeVariant('management')).toBe('info');
  });

  it('maps purchase and sale to warning', () => {
    expect(getOpportunityTypeVariant('purchase')).toBe('warning');
    expect(getOpportunityTypeVariant('sale')).toBe('warning');
  });

  it('maps developer_advisory, compliance and capex to neutral', () => {
    expect(getOpportunityTypeVariant('developer_advisory')).toBe('neutral');
    expect(getOpportunityTypeVariant('compliance')).toBe('neutral');
    expect(getOpportunityTypeVariant('capex')).toBe('neutral');
  });

  it('falls back to neutral for an unmapped value rather than throwing', () => {
    expect(getOpportunityTypeVariant('something_new')).toBe('neutral');
  });
});

describe('getOpportunityTypeChipClasses', () => {
  it('renders through the shared status variant classes', () => {
    expect(getOpportunityTypeChipClasses('rental')).toContain('bg-state-info-soft');
    expect(getOpportunityTypeChipClasses('purchase')).toContain('bg-state-warning-soft');
  });
});

describe('getStageClasses', () => {
  it('puts won on the success token and lost on neutral, never on the ramp', () => {
    expect(getStageClasses('won')).toContain('bg-state-success-soft');
    expect(getStageClasses('lost')).toContain('bg-surface-paper');
  });

  it('walks the six active stages up the sequential andaman ramp', () => {
    expect(getStageClasses('new')).toContain('bg-chart-seq-1');
    expect(getStageClasses('qualified')).toContain('bg-chart-seq-2');
    expect(getStageClasses('discovery')).toContain('bg-chart-seq-3');
    expect(getStageClasses('proposal')).toContain('bg-chart-seq-4');
    expect(getStageClasses('negotiation')).toContain('bg-chart-seq-5');
  });

  it('reads nurture at the same light rung as new, matching the canvas dashboard', () => {
    expect(getStageClasses('nurture')).toBe(getStageClasses('new'));
  });
});
