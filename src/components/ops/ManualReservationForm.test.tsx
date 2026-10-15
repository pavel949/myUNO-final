import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManualReservationForm from './ManualReservationForm';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const labels = {
  'reservations.guest_entry.add':'Add a new guest','reservations.guest_entry.save':'Save guest','reservations.guest_entry.saving':'Saving guest…',
  'reservations.guest_entry.first':'First name','reservations.guest_entry.last':'Last name','reservations.guest_entry.email':'Email','reservations.guest_entry.phone':'Phone',
  'reservations.guest_entry.failed':'Guest save failed','reservations.guest_entry.saved':'Guest saved',
  'reservations.guest_entry.created':'Reservation created','reservations.guest_entry.open':'Open reservation →',
  'reservations.create': 'Create reservation',
  'reservations.create_action': 'Create reservation',
  'reservations.creating': 'Creating…',
  'reservations.create_failed': 'Reservation creation failed',
  'reservations.unit': 'Property', 'reservations.guest': 'Guest',
  'reservations.start': 'Check-in', 'reservations.end': 'Check-out',
  'reservations.note': 'Notes',
};
function setup() {
  const { container } = render(<ManualReservationForm operatingSpaceId="space"
    units={[{ id: 'unit', name: 'Villa', project: { name: 'Estate' }, instantBook: true }]}
    guests={[{ id: 'guest', firstName: 'Test', lastName: 'Guest', email: null, phone: null }]}
    groups={[]} labels={labels} />);
  fireEvent.change(screen.getByRole('combobox', { name: /^Property/ }), { target: { value: 'unit' } });
  fireEvent.change(screen.getByRole('combobox', { name: /^Guest/ }), { target: { value: 'guest' } });
  fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: '2027-01-10' } });
  fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2027-01-13' } });
  fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Accepted dates' } });
  return container.querySelector('form')!;
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('manual reservation submission', () => {
  it('resets the captured form after an asynchronous successful response and becomes usable', async () => {
    let resolve!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    fireEvent.submit(setup());
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    await act(async () => resolve({ ok: true, json: async () => ({ booking: { id: 'booking' } }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create reservation' })).toBeEnabled());
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /^Guest/ })).toHaveValue('');
    expect(screen.getByLabelText('Check-in')).toHaveValue('');
    expect(screen.getByPlaceholderText('Notes')).toHaveValue('');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      operatingSpaceId: 'space', unitId: 'unit', guestIdentityId: 'guest',
      startDate: '2027-01-10', endDate: '2027-01-13', guestNote: 'Accepted dates',
    });
  });

  it('preserves the canonical refusal and entered values, without refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Dates are already booked' }) }));
    fireEvent.submit(setup());
    expect(await screen.findByRole('alert')).toHaveTextContent('Dates are already booked');
    expect(screen.getByRole('button', { name: 'Create reservation' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveValue('unit');
    expect(screen.getByPlaceholderText('Notes')).toHaveValue('Accepted dates');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each(['network', 'invalid-json'])('recovers from %s without leaving the form stuck', async failure => {
    const fetchMock = failure === 'network'
      ? vi.fn().mockRejectedValue(new Error('Connection lost'))
      : vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('Invalid JSON'); } });
    vi.stubGlobal('fetch', fetchMock);
    fireEvent.submit(setup());
    expect(await screen.findByRole('alert')).toHaveTextContent('Reservation creation failed');
    expect(screen.getByRole('button', { name: 'Create reservation' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveValue('unit');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('new guest entry keeps the reservation draft',()=>{
  it('saves and selects a contact without losing dates, villa or notes',async()=>{
    const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({guest:{id:'new-guest',firstName:'New',lastName:'Person',email:'new@example.test',phone:null}})});
    vi.stubGlobal('fetch',fetchMock);setup();
    fireEvent.click(screen.getByRole('button',{name:'Add a new guest'}));
    fireEvent.change(screen.getByLabelText('First name'),{target:{value:'New'}});
    fireEvent.change(screen.getByLabelText('Last name'),{target:{value:'Person'}});
    fireEvent.change(screen.getByLabelText('Email'),{target:{value:'new@example.test'}});
    fireEvent.submit(screen.getByRole('form',{name:'Add a new guest'}));
    await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Guest/})).toHaveValue('new-guest'));
    expect(screen.getByLabelText('Check-in')).toHaveValue('2027-01-10');
    expect(screen.getByRole('combobox',{name:/^Property/})).toHaveValue('unit');
    expect(screen.getByPlaceholderText('Notes')).toHaveValue('Accepted dates');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ops/reservation-guests');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('preserves contact fields on network failure and suppresses repeated saves',async()=>{
    let reject!:(error:Error)=>void;
    const fetchMock=vi.fn().mockReturnValue(new Promise((_resolve,no)=>{reject=no;}));
    vi.stubGlobal('fetch',fetchMock);setup();
    fireEvent.click(screen.getByRole('button',{name:'Add a new guest'}));
    fireEvent.change(screen.getByLabelText('First name'),{target:{value:'New'}});
    const form=screen.getByRole('form',{name:'Add a new guest'});
    fireEvent.submit(form);fireEvent.submit(form);expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async()=>reject(new Error('offline')));
    expect(screen.getByLabelText('First name')).toHaveValue('New');
    expect(screen.getByRole('alert')).toHaveTextContent('Guest save failed');
  });
});
