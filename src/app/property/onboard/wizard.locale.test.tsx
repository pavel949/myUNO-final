import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PropertySubmissionWizard from './wizard';
import { PROPERTY_ONBOARDING_KEYS } from '@/modules/content/property-onboarding.seed';
afterEach(() => vi.unstubAllGlobals());

describe('bounded onboarding UI locale without workflow changes', () => {
  it.each(['ru', 'en'] as const)('renders shell, steps and preserves draft request in %s', async locale => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row[locale]]));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.body ? { id: 'saved', requirements: JSON.parse(String(init.body)) } : { items: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[]} initialOffers={['short_stay']} />);
    expect(screen.getByRole('heading', { level: 1, name: labels['property.onboard.title'] })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: labels['property.onboard.steps.label'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: labels['property.onboard.kind.home'] + ' ' + labels['property.onboard.kind.home_hint'] })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: labels['property.onboard.action.next'] }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: labels['property.onboard.steps.residence'] })).toBeInTheDocument());
    const saved = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ kind: 'home', status: 'draft', offers: ['short_stay'] });
  });
});
