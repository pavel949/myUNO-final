import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentProposalReview from './review-client';
import { CONTENT_PROPOSAL_REVIEW_KEYS } from '@/modules/content/content-proposal-review.seed';
const labels = Object.fromEntries(CONTENT_PROPOSAL_REVIEW_KEYS.map(row => [row.key, row.en]));
const facts = { name: 'A201', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: null, grossAreaSqm: null, floor: null, addressSupplement: '', amenityKeys: [] };
const row = { id: 'proposal-1', scope: 'unit', targetId: 'unit-1', projectId: 'project-1', targetName: 'A201', status: 'submitted', revision: 4, updatedAt: '', reviewNote: null };
const detail = { ...row, baseline: { facts, descriptions: { ru: 'Старое описание', en: 'Unchanged English' }, gallery: { mediaIds: [], coverMediaId: null, media: [] } }, proposal: { facts: { ...facts, name: 'A201 revised' }, description: { locale: 'ru', value: 'Новое описание' }, gallery: { mediaIds: [], coverMediaId: null } }, author: { id: 'employee-1', name: 'Synthetic Employee' } };
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
afterEach(() => { vi.unstubAllGlobals(); });
async function ready(fetchMock: (url: string, init?: RequestInit) => Promise<unknown>) {
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentProposalReview labels={labels} />);
  fireEvent.click(await screen.findByRole('button', { name: 'A201 One home · Awaiting review' }));
  await screen.findByRole('heading', { name: 'A201 revised' });
}
describe('administrator review applies only an explicitly reviewed revision', () => {
  it('shows before/after and author; sends only review action and expected revision after confirmation', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ok(init?.method === 'POST' ? { ...detail, status: 'approved', revision: 5 } : url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    expect(screen.getByText('Старое описание')).toBeVisible();
    expect(screen.getByText('Новое описание')).toBeVisible();
    expect(screen.getByText(/Synthetic Employee/)).toBeVisible();
    expect(screen.getByText(/visitors can see the new content immediately/)).toBeVisible();
    const approve = screen.getByRole('button', { name: 'Approve and apply content' });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(approve);
    await screen.findByText('The reviewed content was applied. Ownership, prices and publication status are unchanged.');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/admin/property-content-proposals/proposal-1/review');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: 'approve', expectedRevision: 4 });
    expect(screen.queryByRole('button', { name: 'Approve and apply content' })).not.toBeInTheDocument();
  });
  it('requires a note for return and preserves exact label after text is entered', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ok(init?.method === 'POST' ? { ...detail, status: 'returned', revision: 5, reviewNote: 'Correct the bedroom count.' } : url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    const returnButton = screen.getByRole('button', { name: 'Return for changes' });
    expect(returnButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review note (required when returning)', { exact: true }), { target: { value: ' Correct the bedroom count. ' } });
    expect(screen.getByLabelText('Review note (required when returning)', { exact: true })).toHaveValue(' Correct the bedroom count. ');
    fireEvent.click(returnButton);
    await screen.findByText('Returned to the author with your note.');
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))).toEqual({ action: 'return', expectedRevision: 4, note: 'Correct the bedroom count.' });
  });
  it('reports a stale approval without false success and requires renewed confirmation', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => init?.method === 'POST' ? { ok: false, status: 409, json: async () => ({ error: 'stale' }) } : ok(url.endsWith('proposal-1') ? detail : { items: [row] }));
    await ready(fetchMock);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and apply content' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was applied');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Approve and apply content' })).toBeDisabled();
    expect(screen.queryByText('The reviewed content was applied. Ownership, prices and publication status are unchanged.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'A201 revised' })).not.toBeInTheDocument());
  });
  it('retries a failed initial load and does not permit review of a draft', async () => {
    let first = true;
    const fetchMock = vi.fn(async (url: string) => { if (first) { first = false; throw new Error('offline'); } return ok(url.endsWith('proposal-1') ? { ...detail, status: 'draft' } : { items: [{ ...row, status: 'draft' }] }); });
    vi.stubGlobal('fetch', fetchMock); render(<ContentProposalReview labels={labels} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh queue' }));
    fireEvent.change(screen.getByLabelText('Proposal status', { exact: true }), { target: { value: 'draft' } });
    fireEvent.click(await screen.findByRole('button', { name: 'A201 One home · Draft' }));
    await screen.findByRole('heading', { name: 'A201 revised' });
    expect(screen.queryByRole('button', { name: 'Approve and apply content' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Proposal status', { exact: true })).toHaveValue('draft');
  });
});
