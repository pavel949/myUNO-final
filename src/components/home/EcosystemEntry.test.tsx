import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HOMEPAGE_V4_KEYS } from '@/modules/content/homepage-v4.seed';
import type { PlaceOption } from '@/lib/place-search';
import { EcosystemEntry } from './EcosystemEntry';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const prefix = 'landing.hp.ecosystem.';
const copy = Object.fromEntries(HOMEPAGE_V4_KEYS
  .filter((entry) => entry.key.startsWith(prefix))
  .map((entry) => [entry.key.slice(prefix.length), entry.en]));

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe('homepage ecosystem place links', () => {
  it('supplies the canonical project slug from the homepage read model', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8');
    expect(page).toMatch(/\.\.\.projects\.map\(\(project\) => \(\{[\s\S]*?slug: project\.slug,/);
  });

  it.each<[string, PlaceOption, string]>([
    ['project slug instead of its UUID', { kind: 'project', id: '1ab6c92e-8b79-4bdf-9093-77d5c4b3aa56', slug: 'lagoon-residences', name: 'Lagoon Residences' }, '/projects/lagoon-residences'],
    ['project search fallback when a slug is absent', { kind: 'project', id: 'project-uuid', name: 'Lagoon Residences' }, '/search?projectId=project-uuid'],
    ['unit ID', { kind: 'unit', id: 'unit-uuid', name: 'Lagoon Villa' }, '/units/unit-uuid'],
    ['area slug', { kind: 'area', id: 'area-uuid', slug: 'lagoon-area', name: 'Lagoon Area' }, '/search?areaSlug=lagoon-area'],
    ['area search fallback when a slug is absent', { kind: 'area', id: 'area-uuid', name: 'Lagoon Area' }, '/search'],
  ])('uses the canonical %s', (_label, place, href) => {
    render(<EcosystemEntry places={[place]} copy={copy} />);
    fireEvent.change(screen.getByLabelText(copy.searchLabel), { target: { value: 'Lagoon' } });
    expect(screen.getByRole('link', { name: place.name })).toHaveAttribute('href', href);
  });

  it('preserves all seven journey destinations', () => {
    render(<EcosystemEntry places={[]} copy={copy} />);
    const routes = { stay: '/search', monthly: '/homes?intent=rent', buy: '/homes?intent=buy', move: '/relocation', services: '/services', owner: '/owners', partner: '/partners' };
    for (const [key, href] of Object.entries(routes)) {
      const title = screen.getByRole('link', { name: new RegExp(copy[`route.${key}.title`]) });
      expect(title.closest('a')).toHaveAttribute('href', href);
    }
  });

  it('ignores an empty search and preserves service intent routing', () => {
    render(<EcosystemEntry places={[]} copy={copy} />);
    const form = screen.getByRole('search');
    fireEvent.submit(form);
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText(copy.searchLabel), { target: { value: '  flowers  ' } });
    fireEvent.submit(form);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/services?q=flowers');
  });
});
