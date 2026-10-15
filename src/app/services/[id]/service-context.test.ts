import { describe, expect, it } from 'vitest';
import { serviceContextPath } from './service-context';

describe('service authentication return context', () => {
  it('preserves the unit and project for a service without a stay', () => {
    expect(serviceContextPath('cleaning', { projectId: 'project-a', unitId: 'unit-b' })).toBe('/services/cleaning?projectId=project-a&unitId=unit-b');
  });
  it('preserves the selected booking and encodes query values', () => {
    expect(serviceContextPath('transfer', { bookingId: 'stay & 1' })).toBe('/services/transfer?bookingId=stay+%26+1');
  });
  it('omits empty context', () => {
    expect(serviceContextPath('cleaning', { bookingId: null })).toBe('/services/cleaning');
  });
});
