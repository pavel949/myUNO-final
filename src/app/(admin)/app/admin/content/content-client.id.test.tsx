import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentAdminClient from './content-client';
const labels = { 'admin.content.save': 'Save', 'admin.content.saved': 'Saved', 'admin.content.error_generic': 'Save failed' };
const key = 'project.services.title';
const contentId = 'a3dbe672-fb87-4e3b-b279-5bf62099f366';
afterEach(() => vi.unstubAllGlobals());
describe('CMS client uses stable ContentKey IDs', () => {
  it('sends edited locale/value to the canonical ID route while preserving text key display', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) })); vi.stubGlobal('fetch', fetchMock);
    render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 1 }]} initialNamespace="project" initialKeys={[{ id: contentId, key, description: '', translations: { ru: { value: 'Old', status: 'needs_review' } } }]} labels={labels} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Новое' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/content/${contentId}`, expect.objectContaining({ method: 'PUT', body: JSON.stringify({ locale: 'ru', value: 'Новое' }) })));
    expect(screen.getByText(key)).toBeInTheDocument();
  });
  it('fails closed if the server row has no stable ID; never falls back to the text key', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 1 }]} initialNamespace="project" initialKeys={[{ id: '', key, description: '', translations: {} }]} labels={labels} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Новое' } });
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled(); expect(fetchMock).not.toHaveBeenCalled();
  });
});

it('retains the stable ID when switching to an API-loaded namespace', async () => {
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/namespace/') ? { keys: [{ id: contentId, key, description: '', translations: [{ locale: 'ru', value: 'Old', status: 'needs_review' }] }] } : { success: true } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentAdminClient namespaces={[{ namespace: 'initial', count: 0 }, { namespace: 'project', count: 1 }]} initialNamespace="initial" initialKeys={[]} labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'project (1)' }));
  await screen.findByText(key);
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Новое' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/content/${contentId}`, expect.objectContaining({ method: 'PUT' })));
});
