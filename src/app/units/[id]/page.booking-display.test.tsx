import { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ methods: ['cash', 'bank_transfer'] as string[] | null, locale: 'ru', seasonOverride: '', unitExists: true }));
const config = vi.hoisted(() => ({ getConfig: vi.fn(async () => state.methods) }));
vi.mock('@/modules/config', () => config);
vi.mock('@/modules/projects', () => ({ getPublicUnitById: vi.fn(async () => ({
  id: 'unit-a', name: 'Villa A', bookable: true, descriptionKey: null, bedrooms: 2, bathrooms: 0,
  maxGuests: 4, sizeSqm: null, baseNightlyThb: 10000, coverUrl: null, sleepingSpaces: [],
  project: { name: 'Project A', slug: 'project-a', address: '', latitude: 0, longitude: 0 },
})) }));
vi.mock('@/modules/projects/public-discovery', () => ({ listPublicDiscoveryUnits: vi.fn(async () => []) }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => state.locale,
  getLabels: async (keys: Record<string, string>, _locale?: string, drafts?: Record<string, Record<string, string>>) =>
    Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key,
      key === 'catalog.cancellation_policies.season.label' && state.seasonOverride
        ? state.seasonOverride : drafts?.[key]?.[state.locale] ?? fallback,
    ])),
}));
vi.mock('@/lib/gallery-copy', () => ({ getGalleryCopy: async () => ({}) }));
vi.mock('@/components/DiscoveryHomes', () => ({ discoveryCopy: async () => ({}) }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ key: 'synthetic' }) }));
const db = vi.hoisted(() => ({ unit: { findUnique: vi.fn(async () => state.unitExists ? { projectId: 'project-a' } : null) } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/modules/content', () => ({ t: vi.fn() }));
vi.mock('@/components/UnitPhotoMosaic', () => ({ UnitPhotoMosaic: () => null }));
vi.mock('@/components/units/PublicSleepingSummary', () => ({ PublicSleepingSummary: () => null }));
vi.mock('@/app/(public)/lead-form-section', () => ({ LeadFormSection: () => null }));
vi.mock('./unit-client', () => ({ default: () => null }));
import UnitDetailPage from './page';
import UnitDetailClient from './unit-client';

function findClient(node: ReactNode): ReactElement | undefined {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.map(findClient).find(Boolean);
  const element = node as ReactElement;
  return element.type === UnitDetailClient ? element : findClient(element.props?.children);
}

async function clientLabels() {
  const page = await UnitDetailPage({ params: { id: 'unit-a' }, searchParams: { projectId: 'tampered-project' } });
  return findClient(page)!.props.labels;
}

beforeEach(() => { vi.clearAllMocks(); state.methods = ['cash', 'bank_transfer']; state.locale = 'ru'; state.seasonOverride = ''; state.unitExists = true; });

describe('server-resolved guest booking display', () => {
  it('uses the same project-scoped methods as review and never static card copy', async () => {
    const labels = await clientLabels();
    expect(db.unit.findUnique).toHaveBeenCalledWith({ where: { id: 'unit-a' }, select: { projectId: true } });
    expect(config.getConfig).toHaveBeenCalledWith(db, 'booking.payment.methods_enabled', { projectId: 'project-a' });
    expect(labels.paymentMethodsSummary).toBe('Наличными при заезде · Банковский перевод');
    expect(labels.paymentMethodsSummary).not.toContain('Карт');
    expect(labels).not.toHaveProperty('notChargedYet');
  });
  it('does not advertise global payment defaults when the canonical unit is no longer present', async () => {
    state.unitExists = false;
    expect((await clientLabels()).paymentMethodsSummary).toBe('');
    expect(config.getConfig).not.toHaveBeenCalled();
  });
  it('lists card only when configuration enables it', async () => {
    state.methods = ['card_provider'];
    expect((await clientLabels()).paymentMethodsSummary).toBe('Картой (онлайн)');
  });
  it('does not invent methods when the configured list is empty', async () => {
    state.methods = [];
    expect((await clientLabels()).paymentMethodsSummary).toBe('');
  });
  it('matches the review defaults when configuration is absent', async () => {
    state.methods = null;
    expect((await clientLabels()).paymentMethodsSummary).toBe('Наличными при заезде · Банковский перевод');
  });
  it('uses the registered Russian season draft when no CMS translation exists', async () => {
    expect((await clientLabels()).policyLabels.season).toBe('Условия сезона');
  });
  it('keeps the selected-locale CMS season text authoritative', async () => {
    state.seasonOverride = 'Отредактированные условия сезона';
    expect((await clientLabels()).policyLabels.season).toBe(state.seasonOverride);
  });
});
