import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PropertySubmissionWizard from './wizard';
import { PROPERTY_ONBOARDING_KEYS } from '@/modules/content/property-onboarding.seed';
afterEach(() => vi.unstubAllGlobals());

describe('bounded onboarding UI locale without workflow changes', () => {
  it.each(['ru', 'en', 'th', 'zh'] as const)('renders shell, steps and preserves draft request in %s', async locale => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row[locale]]));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.body ? { id: 'saved', requirements: JSON.parse(String(init.body)) } : { items: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[]} initialLocale={locale} initialOffers={['short_stay']} />);
    expect(screen.getByRole('heading', { level: 1, name: labels['property.onboard.title'] })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: labels['property.onboard.steps.label'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: labels['property.onboard.kind.home'] + ' ' + labels['property.onboard.kind.home_hint'] })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: labels['property.onboard.action.next'] }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: labels['property.onboard.steps.residence'] })).toBeInTheDocument());
    const saved = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ kind: 'home', status: 'draft', offers: ['short_stay'], descriptionLocale: locale });
  });
});


describe('description language belongs to the draft', () => {
  it.each([['en', true], [null, true], ['en', false], [null, false]] as const)('preserves resumed language %s (direct link: %s) despite a different UI locale', async (descriptionLocale, directLink) => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row.ru]));
    const item = { id: 'draft', requirements: { kind: 'home', status: 'draft', description: 'Original prose', descriptionLocale, unitName: 'A201', photos: [], projectPhotos: [], offers: ['monthly'] } };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.body ? { id: 'draft', requirements: JSON.parse(String(init.body)) } : { items: [item] } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[]} initialLocale="ru" initialSubmissionId={directLink ? "draft" : undefined} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    if (!directLink) fireEvent.click(await screen.findByRole('button', { name: /A201 ·/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: labels['property.onboard.action.next'] })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: labels['property.onboard.action.next'] }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: labels['property.onboard.steps.residence'] })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: labels['property.onboard.action.next'] }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: labels['property.onboard.steps.details'] })).toBeInTheDocument());
    const picker = screen.getByRole('combobox', { name: labels['property.onboard.details.description_language'] });
    expect(picker).toHaveValue(descriptionLocale || '');
    expect(screen.getByRole('textbox', { name: labels['property.onboard.details.description'] })).toHaveValue('Original prose');
    fireEvent.change(picker, { target: { value: 'th' } });
    fireEvent.click(screen.getByRole('button', { name: labels['property.onboard.action.next'] }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: labels['property.onboard.steps.photos'] })).toBeInTheDocument());
    const saved = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').at(-1);
    expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ description: 'Original prose', descriptionLocale: 'th' });
  });
});

describe('all intake controls retain exact labels across filled draft steps', () => {
  it('labels project selects, filled description, photos and offers through all six steps', async () => {
    const labels = Object.fromEntries(PROPERTY_ONBOARDING_KEYS.map(row => [row.key, row.en]));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.body ? { id: 'saved', requirements: JSON.parse(String(init.body)) } : { items: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PropertySubmissionWizard labels={labels} projects={[]} areas={[{ id: 'area', slug: 'area', name: 'Synthetic area' }]} initialLocale="en" />);
    const label = (key: string) => labels[`property.onboard.${key}`];
    const control = (key: string) => screen.getByLabelText(label(key), { exact: true });
    const next = async (step: string) => {
      fireEvent.click(screen.getByRole('button', { name: label('action.next'), exact: true }));
      await screen.findByRole('heading', { level: 2, name: label(`steps.${step}`), exact: true });
    };
    await next('residence');
    expect(control('residence.type')).toHaveValue('condominium');
    fireEvent.change(control('residence.type'), { target: { value: 'resort' } });
    expect(control('residence.type')).toHaveValue('resort');
    fireEvent.change(control('residence.area'), { target: { value: 'area' } });
    expect(control('residence.area')).toHaveValue('area');
    expect(control('residence.photos')).toHaveAttribute('type', 'file');
    for (const key of ['residence.search', 'residence.not_listed', 'residence.address', 'residence.latitude', 'residence.longitude']) expect(control(key)).toBeVisible();
    await next('details');
    expect(control('details.type')).toHaveValue('condo');
    fireEvent.change(control('details.description_language'), { target: { value: 'ru' } });
    fireEvent.change(control('details.description'), { target: { value: 'Filled description survives exact label lookup.' } });
    expect(control('details.description')).toHaveValue('Filled description survives exact label lookup.');
    expect(control('details.description_language')).toHaveValue('ru');
    for (const key of ['details.name', 'details.max_guests', 'details.bedrooms', 'details.bathrooms', 'details.size', 'details.floor']) expect(control(key)).toBeVisible();
    await next('photos');
    expect(control('steps.photos')).toHaveAttribute('type', 'file');
    await next('offers');
    for (const key of ['offers.short_stay', 'offers.monthly', 'offers.yearly', 'offers.sale', 'operating.owner_direct', 'operating.via_management_company', 'operating.direct_managed', 'offers.price', 'offers.minimum', 'offers.contact']) expect(control(key)).toBeVisible();
    fireEvent.click(control('operating.via_management_company'));
    expect(control('operating.company')).toBeVisible();
    await next('review');
    expect(screen.getByRole('button', { name: label('action.submit'), exact: true })).toBeEnabled();
  });
});
