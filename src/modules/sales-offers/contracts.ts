/** Deliberate guest allowlist. Never accept this projection from a client. */
export type OfferLocale = 'en' | 'ru' | 'th';
export type StayInput = { startDate: string; endDate: string; adults: number; children: number; pets: number };
export type GuestOption = {
  name: string; property: string; bedrooms: number; maxGuests: number; amenities: string[];
  image: string | null; stay: StayInput;
  state: 'ready' | 'review_required' | 'unavailable';
  currency: string; ruleVersion: string | null;
  price: null | { nights: { date: string; amount: number }[]; subtotal: number; cleaning: number;
    service: number; tax: number; losDiscount: number; earlyDiscount: number; total: number; inclusions: null | { taxes: boolean; serviceCharge: boolean; breakfast: boolean } };
  terms: null | { cancellation: { name: string; steps: { days_before_checkin: number; refund_pct: number }[] };
    payment: string | null; balance: string | null; minimumNights: number | null; amendmentsAllowed: boolean | null;
    securityDeposit: null | { thbSatang: number; usdCents: number }; included: string[]; excluded: string[]; stayTerms: string | null };
};
export type GuestOffer = {
  version: number; locale: OfferLocale; expiresAt: string; salesperson: string; clientNote: string;
  options: GuestOption[];
};
export class OfferError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export function parseStay(input: unknown): StayInput {
  if (!input || typeof input !== 'object') throw new OfferError('INVALID_INPUT', 400);
  const s = input as StayInput;
  for (const day of [s.startDate, s.endDate]) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(new Date(day).getTime()) || new Date(day).toISOString().slice(0, 10) !== day)
      throw new OfferError('INVALID_DATES', 400);
  }
  const nights = (Date.parse(s.endDate) - Date.parse(s.startDate)) / 86400000;
  if (nights < 1 || nights > 366 || s.startDate < new Date().toISOString().slice(0, 10)) throw new OfferError('INVALID_DATES', 400);
  if (![s.adults, s.children, s.pets].every(n => Number.isInteger(n) && n >= 0 && n <= 100) || s.adults < 1)
    throw new OfferError('INVALID_PARTY', 400);
  return { startDate: s.startDate, endDate: s.endDate, adults: s.adults, children: s.children, pets: s.pets };
}
