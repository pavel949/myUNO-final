// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/components/property/ScopedGalleryEditor', () => ({ default: () => null }));
import PropertyOnboardingClient from './property-onboarding-client';

const project = {
  id: 'project-1', name: 'Test Resort', status: 'draft', coverMediaId: null,
  galleryMedia: [], inventoryCategories: [], ratePlans: [], structureNodes: [], units: [],
};
const readiness = {
  projectId: 'project-1', score: 20, readyForActivation: false,
  blockers: [], warnings: [], checkedAt: '2026-09-28T00:00:00Z',
};

describe('property onboarding form wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('opens the step named by a direct hash link', async () => {
    window.history.replaceState(null, '', '/app/admin/properties/project-1/onboarding#step-7');
    const { container } = render(<PropertyOnboardingClient initialProject={project} initialReadiness={readiness} galleryLabels={{}} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '7. Content and galleries' })).toBeVisible());
    expect(container.querySelector('#step-1')).toHaveAttribute('hidden');
  });

  it('opens a two-digit step from a direct hash link', async () => {
    window.history.replaceState(null, '', '/app/admin/properties/project-1/onboarding#step-10');
    render(<PropertyOnboardingClient initialProject={project} initialReadiness={readiness} galleryLabels={{}} />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '10. Review and publish' })).toBeVisible());
  });

  it('follows hash changes and preserves the current step for invalid hashes', () => {
    render(<PropertyOnboardingClient initialProject={project} initialReadiness={readiness} galleryLabels={{}} />);

    for (const [hash, heading] of [
      ['#step-7', '7. Content and galleries'],
      ['#step-10', '10. Review and publish'],
      ['#step-1', '1. Project and area'],
    ]) {
      window.history.replaceState(null, '', `/app/admin/properties/project-1/onboarding${hash}`);
      fireEvent(window, new HashChangeEvent('hashchange'));
      expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    }

    for (const hash of ['#step-0', '#step-11', '#step-seven', '#step-7-extra']) {
      window.history.replaceState(null, '', `/app/admin/properties/project-1/onboarding${hash}`);
      fireEvent(window, new HashChangeEvent('hashchange'));
      expect(screen.getByRole('heading', { name: '1. Project and area' })).toBeVisible();
    }
  });

  it('submits an explicit base rate in baht, minimum nights, and the category key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'category-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertyOnboardingClient initialProject={project} initialReadiness={readiness} galleryLabels={{}} />);

    fireEvent.click(screen.getByRole('button', { name: /2\. Categories & homes/ }));
    const form = screen.getByLabelText('Base nightly rate (THB)').closest('form')!;
    fireEvent.change(screen.getByLabelText('Category key'), { target: { value: 'garden_2br' } });
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Garden 2BR' } });
    fireEvent.change(screen.getByLabelText('Base nightly rate (THB)'), { target: { value: '3500' } });
    fireEvent.change(screen.getByLabelText('Minimum nights'), { target: { value: '2' } });
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/projects/project-1/catalog');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      action: 'category', categoryKey: 'garden_2br',
      baseNightlyThb: '3500', minNights: 2,
    });
  });

  it('uses BAR rather than a free-form code for category master pricing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'bar-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertyOnboardingClient
      initialProject={{
        ...project,
        inventoryCategories: [{
          id: 'category-1', name: 'Garden 2BR', categoryKey: 'garden_2br',
          baseNightlyThb: 350000, minNights: 1, status: 'live', ratePlans: [],
        }],
      }}
      initialReadiness={readiness}
      galleryLabels={{}}
    />);
    fireEvent.click(screen.getByRole('button', { name: /6\. Pricing/ }));
    const form = screen.getByRole('button', { name: 'Save BAR' }).closest('form')!;
    const category = form.querySelector('select[name="category"]')!;
    fireEvent.change(category, { target: { value: 'category-1' } });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      action: 'rate_plan', categoryId: 'category-1', code: 'BAR', isMaster: true,
    });
  });

  it('keeps categories and physical homes together in the canonical onboarding step', () => {
    render(<PropertyOnboardingClient initialProject={project} initialReadiness={readiness} galleryLabels={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /2\. Categories & homes/ }));
    expect(screen.getByRole('heading', { name: '2. Categories and homes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /7\. Content & photos/ }));
    expect(screen.getByRole('heading', { name: '7. Content and galleries' })).toBeInTheDocument();
  });
});


describe('onboarding unit destinations', () => {
  const units = ['unit-1', 'unit-2'].map((id, index) => ({
    id, name: `Villa ${index + 1}`, ownerIdentityId: `owner-${index + 1}`,
    media: [], sleepingSpaces: [], commercialOfferings: [],
  }));

  it('links each gallery directly to its own scoped editor and leaves owner links intact', () => {
    render(<PropertyOnboardingClient initialProject={{ ...project, units }} initialReadiness={readiness} galleryLabels={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /7\. Content & photos/ }));
    for (const unit of units) {
      const link = screen.getByRole('link', { name: `Open unit gallery: ${unit.name}` });
      const url = new URL(link.getAttribute('href')!, window.location.origin);
      expect(url.pathname).toBe('/app/admin/properties/project-1/onboarding');
      expect(url.searchParams.get('gallery')).toBe(`unit:${unit.id}`);
      expect(url.hash).toBe('#step-7');
    }
    fireEvent.click(screen.getByRole('button', { name: /3\. Owner & contract/ }));
    for (const unit of units) {
      expect(screen.getByRole('link', { name: `Open owner and contract workspace: ${unit.name}` }))
        .toHaveAttribute('href', `/app/admin/units/${unit.id}`);
    }
    fireEvent.click(screen.getByRole('button', { name: /4\. Compliance/ }));
    expect(screen.getByRole('link', { name: 'Complete compliance checklist: Villa 1' }))
      .toHaveAttribute('href', '/app/admin/units/unit-1');
  });
});
