import { describe, it, expect } from 'vitest';
import { buildCloseWindowState } from './order-close-window';

const NOW = new Date('2026-09-08T12:00:00Z');

function hoursBefore(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

describe('buildCloseWindowState (F-PROV-3)', () => {
  it('offers confirm and dispute inside the window', () => {
    const state = buildCloseWindowState({
      status: 'fulfilled',
      fulfilledAt: hoursBefore(2),
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canConfirm).toBe(true);
    expect(state.canDispute).toBe(true);
    expect(state.lapsed).toBe(false);
    expect(state.hoursRemaining).toBe(46);
  });

  it('offers neither once the window has lapsed', () => {
    const state = buildCloseWindowState({
      status: 'fulfilled',
      fulfilledAt: hoursBefore(49),
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canConfirm).toBe(false);
    expect(state.canDispute).toBe(false);
    expect(state.lapsed).toBe(true);
    expect(state.hoursRemaining).toBe(0);
  });

  it('treats a closed order as finished', () => {
    const state = buildCloseWindowState({
      status: 'closed',
      fulfilledAt: hoursBefore(1),
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canConfirm).toBe(false);
    expect(state.canDispute).toBe(false);
    expect(state.lapsed).toBe(true);
  });

  it('stops offering either action once a dispute is open', () => {
    const state = buildCloseWindowState({
      status: 'fulfilled',
      fulfilledAt: hoursBefore(2),
      windowHours: 48,
      hasDispute: true,
      now: NOW,
    });

    expect(state.canConfirm).toBe(false);
    expect(state.canDispute).toBe(false);
    // The clock is still shown — the dispute is being argued inside it.
    expect(state.lapsed).toBe(false);
  });

  it('follows a shortened project window', () => {
    const state = buildCloseWindowState({
      status: 'fulfilled',
      fulfilledAt: hoursBefore(7),
      windowHours: 6,
      hasDispute: false,
      now: NOW,
    });

    expect(state.lapsed).toBe(true);
    expect(state.canDispute).toBe(false);
  });

  it('keeps a no-show grievance disputable with no fulfilment clock', () => {
    const state = buildCloseWindowState({
      status: 'failed',
      fulfilledAt: null,
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canDispute).toBe(true);
    expect(state.canConfirm).toBe(false);
    expect(state.deadline).toBeNull();
    expect(state.lapsed).toBe(false);
  });

  it('offers nothing on an order that was never accepted', () => {
    const state = buildCloseWindowState({
      status: 'placed',
      fulfilledAt: null,
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canConfirm).toBe(false);
    expect(state.canDispute).toBe(false);
  });

  it('keeps the window open when a fulfilled order has no timestamp', () => {
    // Defensive: never strip the orderer's recourse over missing data.
    const state = buildCloseWindowState({
      status: 'fulfilled',
      fulfilledAt: null,
      windowHours: 48,
      hasDispute: false,
      now: NOW,
    });

    expect(state.canConfirm).toBe(true);
    expect(state.canDispute).toBe(true);
    expect(state.lapsed).toBe(false);
  });
});
