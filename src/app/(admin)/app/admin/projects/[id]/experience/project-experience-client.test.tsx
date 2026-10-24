import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render as renderUi, screen, waitFor, within } from '@testing-library/react';
import ProjectExperienceClient, { type AmenityRow } from './project-experience-client';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/projects/AmenityTranslationsEditor', () => ({ default: () => null }));
const row: AmenityRow = { id:'amenity', updatedAt:'2026-10-15T12:00:00.000Z', slug:'reception', name:'Reception', categoryKey:null, shortDescription:null, description:null, iconKey:null, locationLabel:'Floor 1', coverMediaId:null, accessType:'not_specified', accessInstructions:null, bookingRequired:false, bookingMode:'none', bookingUrl:null, reservationConfig:{ customPolicy:'preserve me' }, pricingType:'not_specified', priceThb:null, capacity:null, minAge:null, openingHours:{ daily:[['00:00','24:00']], staffContact:[['09:00','18:00']], timezone:'Asia/Bangkok' }, rules:['Respect quiet hours'], terms:null, isFeatured:false, published:true, sort:0, coverMedia:null, media:[] };
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<ProjectExperienceClient projectId="project" timezone="Asia/Bangkok" initialAmenities={[row]} canOperateReservations={false}/>);
describe('complex amenity editing', () => {
  it('lets staff choose a common facility without inventing hours or saving immediately', () => {
    mount();
    const form = screen.getByRole('button', { name: 'Add draft' }).closest('form')!;
    fireEvent.change(within(form).getByLabelText('Choose a common facility (optional)'), { target: { value: 'Sauna' } });
    expect((within(form).getByLabelText('Name') as HTMLInputElement).value).toBe('Sauna');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('saves a daily schedule, staff contact and rules without JSON entry', async () => {
    fetchMock.mockResolvedValueOnce(response({ amenity:row })).mockResolvedValueOnce(response({ amenities:[row] }));
    mount();
    const form = screen.getByRole('button', { name:'Save amenity' }).closest('form')!;
    fireEvent.change(within(form).getByLabelText('Staff contact until (optional)'), { target:{ value:'17:00' } });
    fireEvent.click(within(form).getByRole('button', { name:'Save amenity' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.openingHours).toEqual({ daily:[['00:00','24:00']], staffContact:[['09:00','17:00']], timezone:'Asia/Bangkok' });
    expect(body.expectedUpdatedAt).toBe(row.updatedAt); expect(body.locationLabel).toBe('Floor 1'); expect(body.rules).toEqual(['Respect quiet hours']);
    expect(body.reservationConfig.customPolicy).toBe('preserve me');
    expect(screen.queryByText('Manage reservations →')).toBeNull();
  });
  it('recovers from network failure and retains entered content', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));
    mount();
    const form = screen.getByRole('button', { name:'Save amenity' }).closest('form')!;
    fireEvent.change(within(form).getByLabelText('Full guest description'), { target:{ value:'Keep this edit' } });
    fireEvent.click(within(form).getByRole('button', { name:'Save amenity' }));
    await screen.findByText('Network unavailable');
    expect((screen.getByRole('button', { name:'Save amenity' }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(form).getByLabelText('Full guest description') as HTMLTextAreaElement).value).toBe('Keep this edit');
  });
  it('does not send repeated save requests while the first is pending', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); mount();
    const form = screen.getByRole('button', { name:'Save amenity' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('creates a draft then resets the captured form after asynchronous response', async () => {
    fetchMock.mockResolvedValueOnce(response({ amenity:row })).mockResolvedValueOnce(response({ amenities:[row] })); mount();
    const form = screen.getByRole('button', { name:'Add draft' }).closest('form')!;
    fireEvent.change(within(form).getByLabelText('Name'), { target:{ value:'New facility' } }); fireEvent.submit(form);
    await screen.findByText('Amenity created as draft.');
    expect((within(form).getByLabelText('Name') as HTMLInputElement).value).toBe('');
  });
});

it('locks all editable facility controls while a deferred save is pending', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response({ amenities: [row] }));
  mount();
  const form = screen.getByRole('button', { name: 'Save amenity' }).closest('form')!;
  fireEvent.submit(form);
  const description = within(form).getByLabelText('Full guest description');
  expect(description.matches(':disabled')).toBe(true);
  expect(within(form).getByLabelText('Staff contact from (optional)').matches(':disabled')).toBe(true);
  await act(async () => { finish(response({ amenity: row })); });
  await waitFor(() => expect(screen.getByLabelText('Full guest description').matches(':disabled')).toBe(false));
});

// Behavioral fixtures exercise English explicitly; locale rendering has separate coverage.
import { LocaleProvider } from '@/components/LocaleProvider';
const render = (ui: React.ReactNode) => renderUi(<LocaleProvider locale="en">{ui}</LocaleProvider>);
