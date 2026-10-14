import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PeopleAdminClient from './people-client';
afterEach(() => vi.unstubAllGlobals());
it('sends the canonical q search parameter when finding a person for role delegation', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ identities: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<PeopleAdminClient projects={[]} labels={{ 'admin.people.search': 'Find a person', 'admin.people.searching': 'Searching' }} />);
  fireEvent.change(screen.getByPlaceholderText('Find a person'), { target: { value: 'alex@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find a person' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/people/search?q=alex%40example.test');
});
