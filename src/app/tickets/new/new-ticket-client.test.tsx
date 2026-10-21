import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewTicketClient from './new-ticket-client';
const navigation = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useSearchParams: () => navigation.params }));
const labels = { 'tickets.new.title': 'Request help', 'tickets.new.back': 'Requests', 'tickets.new.missing_context': 'Select the home',
  'tickets.new.choose_trip': 'Choose your trip', 'tickets.new.subject': 'Subject', 'tickets.new.submit': 'Send request',
  'tickets.new.error_generic': 'Please try again', 'catalog.ticket_categories.access.label': 'Access' };
beforeEach(() => { navigation.params = new URLSearchParams(); navigation.push.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('guest request recovery', () => {
  it('opens standalone order support without fabricating a property scope', async () => {
    navigation.params = new URLSearchParams('serviceOrderId=order-fixture&projectId=forged-project&unitId=forged-unit');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ticket: { id: 'order-ticket' } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<NewTicketClient labels={labels} categories={['other']} />);
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: 'Delivery question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/tickets/order-ticket'));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ serviceOrderId: 'order-fixture', categoryKey: 'other' });
    expect(sent).not.toHaveProperty('projectId'); expect(sent).not.toHaveProperty('unitId');
  });
  it('provides a trip recovery path when context is missing', () => {
    render(<NewTicketClient labels={labels} categories={['access']} />);
    expect(screen.getByRole('link', { name: 'Choose your trip' })).toHaveAttribute('href', '/trips');
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument();
  });
  it('uses an available category and opens the acknowledged request', async () => {
    navigation.params.set('projectId', 'project-fixture');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ticket: { id: 'ticket-fixture' } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<NewTicketClient labels={labels} categories={['access']} />);
    expect(screen.getByRole('button', { name: 'Access' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: '  Key issue  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/tickets/ticket-fixture'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ title: 'Key issue', categoryKey: 'access', projectId: 'project-fixture' });
  });
  it('retains the subject and exposes an accessible failure after a failed request', async () => {
    navigation.params.set('projectId', 'project-fixture');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Please try again')));
    render(<NewTicketClient labels={labels} categories={['access']} />);
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: 'Key issue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
    expect(screen.getByLabelText(/^Subject/)).toHaveValue('Key issue');
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
