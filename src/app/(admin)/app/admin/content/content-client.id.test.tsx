import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentAdminClient from './content-client';
const labels = { 'admin.content.save': 'Save', 'admin.content.saved': 'Saved', 'admin.content.error_generic': 'Save failed' };
const key = 'project.services.title';
const contentId = 'a3dbe672-fb87-4e3b-b279-5bf62099f366';
afterEach(() => vi.unstubAllGlobals());
describe('CMS client uses stable ContentKey IDs', () => {
  it('sends edited locale/value to the canonical ID route while preserving text key display', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, key: { id: contentId, key, description: '', translations: [{ locale: 'ru', value: 'Новое', status: 'needs_review' }] } }) })); vi.stubGlobal('fetch', fetchMock);
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
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/namespace/') ? { keys: [{ id: contentId, key, description: '', translations: [{ locale: 'ru', value: 'Old', status: 'needs_review' }] }] } : { success: true, key: { id: contentId, key, description: '', translations: [{ locale: 'ru', value: 'Новое', status: 'needs_review' }] } } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentAdminClient namespaces={[{ namespace: 'initial', count: 0 }, { namespace: 'project', count: 1 }]} initialNamespace="initial" initialKeys={[]} labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'project (1)' }));
  await screen.findByText(key);
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Новое' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/content/${contentId}`, expect.objectContaining({ method: 'PUT' })));
});

it('restores the exact original key after visiting another namespace', async () => {
  const otherKey = { id: 'other-id', key: 'other.description', description: '', translations: [] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [otherKey] }) }));
  render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 251 }, { namespace: 'other', count: 1 }]}
    initialNamespace="project" initialKeys={[{ id: contentId, key, description: '', translations: {} }]} labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'other (1)' }));
  await screen.findByText(otherKey.key);
  fireEvent.click(screen.getByRole('button', { name: 'project (251)' }));
  expect(await screen.findByText(key)).toBeInTheDocument();
  expect(screen.queryByText(otherKey.key)).not.toBeInTheDocument();
});

it('ignores a stale namespace response after returning to the exact original key', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(done => { resolve = done; })));
  render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 251 }, { namespace: 'other', count: 1 }]}
    initialNamespace="project" initialKeys={[{ id: contentId, key, description: '', translations: {} }]} labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'other (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'project (251)' }));
  await act(async () => resolve({ ok: true, json: async () => ({ keys: [{ id: 'other-id', key: 'other.description', translations: [] }] }) }));
  expect(screen.getByText(key)).toBeInTheDocument();
  expect(screen.queryByText('other.description')).not.toBeInTheDocument();
});

it('keeps confirmed description edits after saving, switching namespace and returning', async () => {
  const saved = 'Saved description';
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () =>
    url.includes('/namespace/')
      ? { keys: [{ id: 'other-id', key: 'other.description', translations: [] }] }
      : { success: true, key: { id: contentId, key, description: '', translations: [{ locale: 'ru', value: saved, status: 'needs_review' }] } },
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 251 }, { namespace: 'other', count: 1 }]}
    initialNamespace="project" initialKeys={[{ id: contentId, key, description: '', translations: { ru: { value: 'Old description', status: 'needs_review' } } }]} labels={labels} />);
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: saved } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await screen.findByRole('button', { name: 'Saved' });
  fireEvent.click(screen.getByRole('button', { name: 'other (1)' }));
  await screen.findByText('other.description');
  fireEvent.click(screen.getByRole('button', { name: 'project (251)' }));
  expect(screen.getAllByRole('textbox')[0]).toHaveValue(saved);
  expect(screen.queryByDisplayValue('Old description')).not.toBeInTheDocument();
});

it('does not acknowledge a successful response for a different content key', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    success: true, key: { id: 'other-id', key: 'other.description', translations: [] },
  }) }));
  render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 1 }]} initialNamespace="project"
    initialKeys={[{ id: contentId, key, description: '', translations: {} }]} labels={labels} />);
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Keep this draft' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await screen.findByText('Save failed');
  expect(screen.getAllByRole('textbox')[0]).toHaveValue('Keep this draft');
  expect(screen.queryByRole('button', { name: 'Saved' })).not.toBeInTheDocument();
});

it('serializes locale saves so a delayed row snapshot cannot overwrite a newer locale', async () => {
  let finishFirst!: (value: unknown) => void;
  const first = new Promise(resolve => { finishFirst = resolve; });
  const fetchMock = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({
    ok: true, json: async () => ({
      success: true, key: { id: contentId, key, description: '', translations: [
        { locale: 'ru', value: 'New RU', status: 'needs_review' },
        { locale: 'en', value: 'New EN', status: 'needs_review' },
      ] },
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentAdminClient namespaces={[{ namespace: 'project', count: 1 }]} initialNamespace="project"
    initialKeys={[{ id: contentId, key, description: '', translations: {
      ru: { value: 'Old RU', status: 'needs_review' },
      en: { value: 'Old EN', status: 'needs_review' },
    } }]} labels={labels} />);
  const textboxes = screen.getAllByRole('textbox');
  fireEvent.change(textboxes[0], { target: { value: 'New RU' } });
  fireEvent.change(textboxes[1], { target: { value: 'New EN' } });
  const saveButtons = screen.getAllByRole('button', { name: 'Save' });
  fireEvent.click(saveButtons[0]);
  fireEvent.click(saveButtons[1]);
  expect(saveButtons[1]).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => finishFirst({
    ok: true, json: async () => ({
      success: true, key: { id: contentId, key, description: '', translations: [
        { locale: 'ru', value: 'New RU', status: 'needs_review' },
        { locale: 'en', value: 'Old EN', status: 'needs_review' },
      ] },
    }),
  }));
  expect(textboxes[1]).toHaveValue('New EN');
  expect(saveButtons[1]).toBeEnabled();
  fireEvent.click(saveButtons[1]);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(saveButtons[1]).toHaveTextContent('Saved'));
  expect(saveButtons[1]).toBeDisabled();
  expect(textboxes[0]).toHaveValue('New RU');
  expect(textboxes[1]).toHaveValue('New EN');
});
