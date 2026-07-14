// module: booking — public interface (see docs/14_tech_spec.md §3)
// Owns: Booking lifecycle state machine, hold/request expiry jobs
// Depends on: core, config

export {
  createBooking,
  approveBookingRequest,
  declineBookingRequest,
  confirmBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  completeBooking,
  expireHolds,
  autoDeclineRequests,
  getBooking,
  getUnitBookings,
  getGuestBookings,
  type CreateBookingInput,
  type ApproveBookingRequestInput,
  type DeclineBookingRequestInput,
  type ConfirmBookingInput,
  type CancelBookingInput,
} from './booking.service';

export {
  computeRefundPercentage,
  computeRefundAmount,
  DEFAULT_POLICIES,
  type PolicyStep,
  type CancellationPolicy,
} from './cancellation';
