/**
 * A stay that cannot be sold for these dates, guests or pets — a commercial
 * answer, not a fault. Minimum-stay rules, dates outside the published season,
 * party size, pets, and offerings not yet approved for sale all end here.
 *
 * Callers decide what "not sellable" means for them: search drops the unit
 * from results, booking returns a 400 the guest can act on. Data-integrity
 * faults (invalid tariff rows, missing category, overflow) stay plain errors
 * and keep surfacing as 500s.
 *
 * Search used to recognise these by matching message text; a reworded message
 * ("below seasonal minimum of 5") slipped through and turned every 4-night
 * search into a 500 for the whole site. The type is the contract, not the text.
 */
export class StayUnquotableError extends Error {
  readonly name: string = 'StayUnquotableError';
  /** Stable, machine-readable reason a guest-facing page can branch on. */
  readonly code: 'stay_unquotable' | 'lease_request_required' = 'stay_unquotable';
}

/**
 * The stay reaches the property's annual-lease minimum (founder ruling
 * 2026-10-06, Layantara Partner Guide): the 12-month rate is agreed through a
 * lease request and a signed lease, never instant-booked or priced as twelve
 * monthly blocks. The guest is routed to an enquiry instead of a checkout.
 */
export class LeaseRequestRequiredError extends StayUnquotableError {
  readonly name = 'LeaseRequestRequiredError';
  readonly code = 'lease_request_required' as const;
}
