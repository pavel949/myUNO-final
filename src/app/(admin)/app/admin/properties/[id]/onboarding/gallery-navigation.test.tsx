// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PropertyOnboardingClient from './property-onboarding-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// Keep real hrefs and click handlers; query navigation is driven explicitly by
// rerender, just as the server page supplies new searchParams to this client.
vi.mock('next/link', () => ({ default: ({ children, onClick, ...props }: React.ComponentProps<'a'>) =>
  <a {...props} onClick={event => { onClick?.(event); event.preventDefault(); }}>{children}</a>,
}));

const units = ['unit-1', 'unit-2'].map((id, index) => ({
  id, name: `Villa ${index + 1}`, ownerIdentityId: `owner-${index + 1}`,
  media: [], sleepingSpaces: [], commercialOfferings: [],
}));
const project = {
  id: 'project-1', name: 'Resort', status: 'draft', coverMediaId: null,
  galleryMedia: [], inventoryCategories: [], ratePlans: [], structureNodes: [], units,
};
const readiness = { projectId: project.id, score: 20, readyForActivation: false, blockers: [], warnings: [], checkedAt: '2026-10-15T00:00:00Z' };
const labels = {
  'admin.gallery.level': 'Level', 'admin.gallery.object': 'Object',
  'admin.gallery.project': 'Project', 'admin.gallery.unit': 'Unit',
  'admin.gallery.loading': 'Loading gallery', 'admin.gallery.empty': 'No photos',
};
function page(initialGallery?: string) {
  return <PropertyOnboardingClient initialProject={project} initialReadiness={readiness} initialGallery={initialGallery} galleryLabels={labels} />;
}

describe('real onboarding to scoped gallery wiring', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

  it('reopens A from its same URL after selecting B and follows query back/forward', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverMediaId: null, media: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/app/admin/properties/project-1/onboarding?gallery=unit:unit-1#step-7');
    const { rerender } = render(page('unit:unit-1'));
    await screen.findByText('No photos');
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'unit:unit-2' } });
    await screen.findByText('No photos');
    expect(screen.getByLabelText('Object')).toHaveValue('unit:unit-2');
    fireEvent.click(screen.getByRole('link', { name: 'Open unit gallery: Villa 1' }));
    await screen.findByText('No photos');
    expect(screen.getByLabelText('Object')).toHaveValue('unit:unit-1');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/units/unit-1/media', { cache: 'no-store' });

    for (const selection of ['unit:unit-2', 'unit:unit-1', undefined]) {
      rerender(page(selection));
      await screen.findByText('No photos');
      expect(screen.getByLabelText('Object')).toHaveValue(selection ?? 'project:project-1');
    }
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'unit' } });
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'unit:unit-2' } });
    await screen.findByText('No photos');
    const callsBeforeRefresh = fetchMock.mock.calls.length;
    rerender(page());
    expect(screen.getByLabelText('Object')).toHaveValue('unit:unit-2');
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeRefresh);
  });

  it('keeps the current selection when a gallery link opens in another tab', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverMediaId: null, media: [] }) }));
    window.history.replaceState(null, '', '/app/admin/properties/project-1/onboarding#step-7');
    render(page('unit:unit-2'));
    await screen.findByText('No photos');
    const link = screen.getByRole('link', { name: 'Open unit gallery: Villa 1' });
    for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      fireEvent.click(link, modifier);
      expect(screen.getByLabelText('Object')).toHaveValue('unit:unit-2');
    }
    expect(new URL(link.getAttribute('href')!, window.location.origin).searchParams.get('gallery')).toBe('unit:unit-1');
  });
});
