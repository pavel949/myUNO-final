// module: booking — public interface (see docs/14_tech_spec.md §3)
// Owns: Booking lifecycle state machine, hold/request expiry jobs
// Depends on: core, config

export {
  createBooking,
  resolveUnitForCategory,
  findAvailableUnitsForCategory,
  approveBookingRequest,
  declineBookingRequest,
  confirmBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  completeBooking,
  requestExtension,
  changeBookingDates,
  type ChangeDatesResult,
  markNoShow,
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
  type StayExtensionResult,
} from './booking.service';

export {
  BOOKING_REQUEST_DECLINE_REASONS,
  bookingRequestDeclineReasonLabelKey,
  formatDeclineCancellationReason,
  getBookingDeclineReasonOptions,
  isBookingRequestDeclineReason,
  parseDeclineCancellationReason,
  type BookingRequestDeclineReason,
} from './request-decline-reasons';

export {
  enrichBookingRequestInbox,
  summarizePriceBreakdown,
  type BookingRequestBreakdownLine,
  type BookingRequestInboxItem,
} from './request-inbox-enrichment';

export {
  computeRefundPercentage,
  computeRefundAmount,
  DEFAULT_POLICIES,
  resolveCancellationPolicy,
  type PolicyStep,
  type CancellationPolicy,
} from './cancellation';

export {
  getInStayHomeSpace,
  type InStayHomeSpaceData,
} from './home-space.service';

export {
  sendPrearrivalReminders,
  sendPostStayPrompts,
} from './lifecycle.jobs';

// Reviews of the guest, after their stay — the other direction from stay
// reviews. Built on the polymorphic Review with target_type 'guest'.
export {
  writeGuestReview,
  getGuestReviewEligibility,
  getGuestReputation,
  type WriteGuestReviewInput,
  type GuestReputation,
} from './guest-review.service';

// Stay reviews by guests — the input side of the rating system.
// Built on the polymorphic Review with target_type 'stay'.
export {
  writeStayReview,
  getStayReviewEligibility,
  type WriteStayReviewInput,
} from './stay-review.service';
