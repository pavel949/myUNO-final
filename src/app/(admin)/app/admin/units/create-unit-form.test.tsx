// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import CreateUnitForm from './create-unit-form';

describe('CreateUnitForm canonical inventory creation', () => {
  const labels = {
    'admin.units.create': 'Create unit',
    'admin.units.cancel': 'Cancel',
    'admin.units.saving': 'Saving…',
    'admin.units.no_projects': 'No projects',
    'admin.units.project': 'Project',
    'admin.units.category': 'Inventory category',
    'admin.units.category_required': 'Category required',
    'admin.units.name': 'Name',
    'admin.units.type': 'Type',
    'admin.units.bedrooms': 'Bedrooms',
    'admin.units.bathrooms': 'Bathrooms',
    'admin.units.max_guests': 'Max guests',
    'admin.units.address_supplement': 'Address supplement',
    'admin.units.base_nightly': 'Canonical base ฿/night',
    'admin.units.min_nights': 'Min nights',
    'admin.units.error_generic': 'Something went wrong',
  } as Record<string, string>;

  const projects = [{ id: 'proj-1', name: 'Layantara' }];
  const categories = [
    {
      id: 'cat-2br',
      projectId: 'proj-1',
      categoryKey: 'superior_2br',
      name: 'Superior 2BR',
      bedrooms: 2,
      bathrooms: 2,
      maxGuests: 4,
      baseNightlyThb: 1_200_000,
      minNights: 2,
    },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submit() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'unit-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<CreateUnitForm projects={projects} categories={categories} labels={labels} />);

    await user.click(screen.getByRole('button', { name: 'Create unit' }));
    await user.selectOptions(screen.getByLabelText(/Project/), 'proj-1');
    await user.selectOptions(screen.getByLabelText(/Inventory category/), 'cat-2br');
    await user.type(screen.getByLabelText(/^Name/), 'Villa One');
    await user.type(screen.getByLabelText(/Address supplement/), 'Wing A');
    await user.click(screen.getByRole('button', { name: 'Create unit' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/units');
    return JSON.parse(init.body as string);
  }

  it('sends the canonical InventoryCategory id instead of a second unit price source', async () => {
    const body = await submit();
    expect(body.inventoryCategoryId).toBe('cat-2br');
    expect(body.baseNightlyThb).toBeUndefined();
    expect(body.minNights).toBeUndefined();
    expect(body.bedrooms).toBe(2);
    expect(body.bathrooms).toBe(2);
    expect(body.maxGuests).toBe(4);
  });
});
