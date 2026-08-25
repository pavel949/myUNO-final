// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import OnboardingClient from './onboarding-client';

/**
 * Q50 regression guard: the "annual NOI cap" field asks the admin for baht,
 * but was submitting the typed number straight into the satang column
 * (`noiCapAnnualThb`), and the read-only engagement list showed the raw
 * satang figure back as if it were baht. CLAUDE.md is explicit that a
 * direct-managed unit without its NOI cap refuses statement generation, and
 * the cap is compared directly against satang NOI totals elsewhere
 * (`statement.service.ts`) — an unconverted cap is not just a display bug,
 * it silently changes which statements get capped.
 */
describe('OnboardingClient NOI cap round-trip (Q50)', () => {
  const labels = {
    'admin.onboarding.owner_title': 'Owner',
    'admin.onboarding.owner_none': 'No owner set',
    'admin.onboarding.owner_email': 'Owner email',
    'admin.onboarding.owner_set': 'Set owner',
    'admin.onboarding.saving': 'Saving…',
    'admin.onboarding.engagement_title': 'Mandate',
    'admin.onboarding.engagement_none': 'No engagement yet',
    'admin.onboarding.engagement_type': 'Engagement type',
    'admin.onboarding.noi_cap': 'Annual NOI cap (THB)',
    'admin.onboarding.noi_cap_hint': 'Required for direct-managed. No default.',
    'admin.onboarding.record_engagement': 'Record engagement',
    'admin.onboarding.error_generic': 'Something went wrong',
    'admin.onboarding.compliance_title': 'Compliance',
    'admin.onboarding.compliance_none': 'No records yet',
    'admin.onboarding.record_type': 'Record type',
    'admin.onboarding.label': 'Label',
    'admin.onboarding.expires': 'Expires',
    'admin.onboarding.add_record': 'Add record',
    'admin.onboarding.confirm_record': 'Confirm',
    'admin.onboarding.title': 'Checklist',
    'admin.onboarding.no_checklist': 'No checklist yet',
    'admin.onboarding.start_checklist': 'Start checklist',
    'admin.onboarding.done': 'Done',
    'admin.onboarding.blocked': 'Blocked',
    'admin.onboarding.pending': 'Pending',
    'admin.onboarding.complete_step': 'Complete',
    'admin.onboarding.permitted_use_warning': 'Permitted use not confirmed',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an existing cap in baht, not raw satang', () => {
    render(
      <OnboardingClient
        unitId="unit-1"
        labels={labels}
        steps={[]}
        owner={null}
        engagements={[
          { id: 'eng-1', engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 500000000 }, // ฿5,000,000
        ]}
        complianceRecords={[]}
        permittedUseConfirmed={false}
      />
    );

    expect(screen.getByText(/฿5,000,000/)).toBeInTheDocument();
    expect(screen.queryByText(/500,000,000/)).not.toBeInTheDocument();
  });

  it('sends a baht-typed cap to the API as satang', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <OnboardingClient
        unitId="unit-1"
        labels={labels}
        steps={[]}
        owner={{ id: 'owner-1', name: 'Anna' }}
        engagements={[]}
        complianceRecords={[]}
        permittedUseConfirmed={false}
      />
    );

    await user.type(screen.getByLabelText(/Annual NOI cap/), '5000000');
    await user.click(screen.getByRole('button', { name: 'Record engagement' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/units/unit-1/engagement');
    const body = JSON.parse(init.body as string);
    // ฿5,000,000 typed -> 500,000,000 satang sent to the API.
    expect(body.noiCapAnnualThb).toBe(500000000);
  });

  it('omits the cap entirely when the admin leaves it blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <OnboardingClient
        unitId="unit-1"
        labels={labels}
        steps={[]}
        owner={{ id: 'owner-1', name: 'Anna' }}
        engagements={[]}
        complianceRecords={[]}
        permittedUseConfirmed={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Record engagement' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.noiCapAnnualThb).toBeUndefined();
  });
});
