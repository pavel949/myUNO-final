import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { BOOKING_WINDOWS, validateBookingWindow, type BookingWindowKey } from '@/modules/config/booking-windows';

/** The same fresh policy drives new bookings and approved requests. */
export async function getBookingTimingConfig(db: PrismaClient, scope: { projectId: string; unitId: string }) {
  const read = async (key: BookingWindowKey) => {
    const configured = await getConfig(db, key, { ...scope, fresh: true });
    return validateBookingWindow(key, configured === undefined ? BOOKING_WINDOWS[key].defaultValue : configured);
  };
  const [holdMinutes, manualHoldHours, requestHours] = await Promise.all([
    read('booking.hold_minutes'), read('booking.manual_payment_hold_hours'), read('booking.request_hours'),
  ]);
  return { holdMinutes, manualHoldMinutes: manualHoldHours * 60, requestHours };
}
