// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CreateUnitForm from './create-unit-form';

/**
 * T-071 regression guard — the same class as Q49, Q50 and T-070, on the single
 * most important price in the business.
 *
 * `unit.base_nightly_thb` is satang. The field is labelled "Base ฿/night", so
 * an admin types baht into it, and the form posted that number unmultiplied.
 * A ฿12,000-a-night villa was created at 12,000 satang — ฿120 a night — and
 * would have been bookable at that rate. The admin list divides by 100 on the
 * way out, so the mistake was visible only as an implausibly small number on a
 * screen nobody re-reads after creating a unit.
 */
describe('CreateUnitForm nightly rate round-trip (T-071)', () => {
  const labels = {
    'admin.units.create': 'Create unit',
    'admin.units.cancel': 'Cancel',
    'admin.units.saving': 'Saving…',
    'admin.units.no_projects': 'No projects',
    'admin.units.project': 'Project',
    'admin.units.name': 'Name',
    'admin.units.type': 'Type',
    'admin.units.bedrooms': 'Bedrooms',
    'admin.units.bathrooms': 'Bathrooms',
    'admin.units.max_guests': 'Max guests',
    'admin.units.address_supplement': 'Address supplement',
    'admin.units.base_nightly': 'Base ฿/night',
    'admin.units.min_nights': 'Min nights',
    'admin.units.error_generic': 'Something went wrong',
  } as Record<string, string>;

  const projects = [{ id: 'proj-1', name: 'Layantara' }];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submitWithRate(rate: string) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'unit-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<CreateUnitForm projects={projects} labels={labels as never} />);

    await user.click(screen.getByRole('button', { name: 'Create unit' }));
    // Every required field, or the browser blocks submit and the assertion
    // below fails for a reason that has nothing to do with money.
    await user.selectOptions(screen.getByLabelText(/Project/), 'proj-1');
    await user.type(screen.getByLabelText(/^Name/), 'Villa One');
    await user.type(screen.getByLabelText(/Bedrooms/), '3');
    await user.type(screen.getByLabelText(/Bathrooms/), '2');
    await user.type(screen.getByLabelText(/Max guests/), '6');
    await user.type(screen.getByLabelText(/Address supplement/), 'Wing A');
    await user.type(screen.getByLabelText(/Base ฿\/night/), rate);
    await user.click(screen.getByRole('button', { name: 'Create unit' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/units');
    return JSON.parse(init.body as string);
  }

  it('sends a baht-typed nightly rate to the API as satang', async () => {
    // ฿12,000 a night typed -> 1,200,000 satang stored.
    expect((await submitWithRate('12000')).baseNightlyThb).toBe(1_200_000);
  });

  it('does not turn a plausible rate into an implausible one', async () => {
    const body = await submitWithRate('5479');
    expect(body.baseNightlyThb).toBe(547_900);
    // The bug shipped the typed number through untouched.
    expect(body.baseNightlyThb).not.toBe(5479);
  });
});
