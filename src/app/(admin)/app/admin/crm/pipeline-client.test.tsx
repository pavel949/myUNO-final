// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CrmPipelineClient from './pipeline-client';

/**
 * T-070 regression guard — the Q49/Q50 class on a third form.
 *
 * `crm_opportunity.value_thb` was the one monetary column holding baht: this
 * form stored the typed number unmultiplied, and every reader rendered it back
 * unchanged. Self-consistent, and 100× away from every other amount in the
 * database. It matters because pipeline value and ledger revenue are summed
 * into the same reporting — D-3 exists for exactly that reason — and a board
 * number wrong by two orders of magnitude is worse than a missing one.
 *
 * Both directions are pinned: what the operator types is multiplied on the way
 * in, and what the database holds is divided on the way out.
 */
describe('CrmPipelineClient opportunity value round-trip (T-070)', () => {
  const labels = {
    'admin.crm.title': 'Pipeline',
    'admin.crm.new': 'New opportunity',
    'admin.crm.contact': 'Contact',
    'admin.crm.type': 'Type',
    'admin.crm.opportunity_title': 'Title',
    'admin.crm.source': 'Source',
    'admin.crm.value': 'Value (THB)',
    'admin.crm.next_action': 'Next action',
    'admin.crm.partner': 'Partner',
    'admin.crm.create': 'Create',
  };

  const contact = {
    id: 'id-1',
    firstName: 'Anna',
    lastName: 'Ivanova',
    email: 'anna@example.com',
    phone: null,
  };

  const opportunity = {
    id: 'opp-1',
    identityId: 'id-1',
    type: 'purchase',
    stage: 'new',
    title: 'Villa purchase',
    source: 'referral',
    valueThb: 500_000_000, // ฿5,000,000 in satang
    probability: 20,
    nextActionAt: null,
    externalPartner: null,
    identity: contact,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a stored value in baht, not raw satang', () => {
    render(
      <CrmPipelineClient
        opportunities={[opportunity]}
        counts={[{ stage: 'new', count: 1, valueThb: 500_000_000 }]}
        contacts={[contact]}
        labels={labels}
      />
    );

    expect(screen.getAllByText(/฿5,000,000/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/500,000,000/)).not.toBeInTheDocument();
  });

  it('sends a baht-typed value to the API as satang', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <CrmPipelineClient
        opportunities={[]}
        counts={[]}
        contacts={[contact]}
        labels={labels}
      />
    );

    await user.click(screen.getByRole('button', { name: 'New opportunity' }));
    await user.type(screen.getByLabelText(/Title/), 'Villa purchase');
    await user.type(screen.getByLabelText(/Source/), 'referral');
    await user.type(screen.getByLabelText(/Value/), '5000000');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    // ฿5,000,000 typed -> 500,000,000 satang sent to the API.
    expect(body.valueThb).toBe(500_000_000);
  });

  it('sends null rather than zero when the value is left blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <CrmPipelineClient
        opportunities={[]}
        counts={[]}
        contacts={[contact]}
        labels={labels}
      />
    );

    await user.click(screen.getByRole('button', { name: 'New opportunity' }));
    await user.type(screen.getByLabelText(/Title/), 'Rental enquiry');
    await user.type(screen.getByLabelText(/Source/), 'website');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).valueThb).toBeNull();
  });
});
