import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PropertySubmissionWizard from './wizard';
import { PROPERTY_ONBOARDING_KEYS } from '@/modules/content/property-onboarding.seed';

// Exact production codes from deriveUnitOnboardingState, not lowercase UI key suffixes.
const canonicalBlockers = ['AUTHORITY_NOT_VERIFIED', 'PERMITTED_USE_NOT_VERIFIED', 'SHORT_STAY_RATE_PLAN_MISSING', 'PUBLIC_MEDIA_MISSING', 'MANAGEMENT_MANDATE_MISSING', 'DIRECT_MANAGED_ECONOMICS_MISSING', 'MANAGEMENT_ORGANIZATION_MISSING', 'UNIT_NOT_FOUND'];
afterEach(() => vi.unstubAllGlobals());

function convertedResponse(blockers: string[]) {
  return { items: [{ id: 'converted-submission', requirements: { status: 'converted', unitName: 'Source villa name', onboardingState: 'blocked', onboardingBlockers: blockers } }], media: {} };
}

describe('converted applications retain specific canonical blocker explanations', () => {
  it.each(['ru', 'en'] as const)('maps real uppercase codes to specific localized text in %s', async locale => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row[locale]]));
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => convertedResponse(canonicalBlockers) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[]} initialSubmissionId="converted-submission" />);
    await screen.findByText(labels['property.onboard.converted']);
    for (const blocker of canonicalBlockers) {
      expect(screen.getByText(labels[`property.onboard.blocker.${blocker.toLowerCase()}`])).toBeInTheDocument();
    }
    expect(screen.queryByText(labels['property.onboard.blocker.unknown'])).toBeNull();
    expect(screen.getByRole('button', { name: labels['property.onboard.action.submit'] })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps the neutral fallback for an unregistered uppercase code', async () => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row.ru]));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => convertedResponse(['FUTURE_CHECK_REQUIRED']) })));
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[]} initialSubmissionId="converted-submission" />);
    expect(await screen.findByText(labels['property.onboard.blocker.unknown'])).toBeInTheDocument();
    expect(screen.queryByText('FUTURE_CHECK_REQUIRED')).toBeNull();
  });
});
