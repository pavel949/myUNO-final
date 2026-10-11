import { createHash } from 'crypto'; // unprefixed on purpose: this file is reachable from the finance barrel, which a client component imports (see CLAUDE.md, module rule 2 exception)
import type { LedgerEntryType } from '@prisma/client';
import { calendarDayIn, startOfCalendarDayUtc, DEFAULT_TIME_ZONE } from '@/lib/date';

/**
 * Input rules for a manually recorded cost (doc 07 F-OPS-3, F-MC-2).
 *
 * Pure: no database, no clock beyond the `now` it is handed. The route parses,
 * the service re-validates through the same functions, so the rule exists once.
 *
 * ## Money
 * `amountSatang` is a positive integer number of satang — the platform's only
 * monetary unit (`lib/money.ts`). The field it is stored in is named
 * `amountThb` for history, but holds satang; nothing here converts. The ledger
 * stores a cost as a NEGATIVE amount (doc 02 §5.3: − = cost/outflow), so the
 * service applies {@link MANUAL_COST_SIGN} exactly once, at the write.
 *
 * ## Why `adjustment` is not a cost type
 * A free-form adjustment is a way to put any number into an owner's report
 * without a category or a reason. A cost is one of four named kinds; a mistake
 * is corrected by a traceable reversal, never by an adjustment typed in.
 */
export const MANUAL_COST_TYPES = [
  'cleaning_cost',
  'maintenance_cost',
  'consumables_cost',
  'utilities_cost',
] as const satisfies readonly LedgerEntryType[];

export type ManualCostType = (typeof MANUAL_COST_TYPES)[number];

/** A cost is an outflow: stored negative. */
export const MANUAL_COST_SIGN = -1 as const;

/** The `amount_thb` column is a 32-bit integer; this is its ceiling, not a business cap. */
export const MAX_COST_SATANG = 2_147_483_647;

export const DESCRIPTION_MIN = 3;
export const DESCRIPTION_MAX = 500;

/** Earliest accepted business date — an input sanity bound, not a policy. */
export const EARLIEST_COST_DAY = '2020-01-01';

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type ManualCostErrorCode =
  | 'invalid_body'
  | 'missing_idempotency_key'
  | 'invalid_idempotency_key'
  | 'invalid_unit'
  | 'invalid_entry_type'
  | 'invalid_amount'
  | 'invalid_date'
  | 'date_in_future'
  | 'invalid_description'
  | 'receipt_media_not_supported';

export class ManualCostInputError extends Error {
  readonly code: ManualCostErrorCode;
  constructor(code: ManualCostErrorCode, message: string) {
    super(message);
    this.name = 'ManualCostInputError';
    this.code = code;
  }
}

export interface ManualCostRequest {
  unitId: string;
  entryType: ManualCostType;
  /** Positive integer satang. */
  amountSatang: number;
  /** The business date, `YYYY-MM-DD`, in the unit's project zone. */
  occurredOn: string;
  description: string;
  idempotencyKey: string;
}

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

export function isManualCostType(value: unknown): value is ManualCostType {
  return typeof value === 'string' && (MANUAL_COST_TYPES as readonly string[]).includes(value);
}

/** Real calendar day in `YYYY-MM-DD` form — `2026-02-30` is not one. */
export function isCalendarDayString(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** NFC, trimmed, inner whitespace runs collapsed — the form that is stored and fingerprinted. */
export function normalizeDescription(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Validate a business date against "today" in the unit's zone. A cost cannot be
 * recognised on a day that has not happened yet, and the day is the PROJECT's
 * day (Phuket), not the browser's or the server's UTC date.
 */
export function assertBusinessDay(day: unknown, now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  if (!isCalendarDayString(day) || day < EARLIEST_COST_DAY) {
    throw new ManualCostInputError('invalid_date', 'The date must be a real calendar day (YYYY-MM-DD).');
  }
  if (day > calendarDayIn(now, timeZone)) {
    throw new ManualCostInputError('date_in_future', 'A cost cannot be dated in the future.');
  }
  return day;
}

/** The stored `occurred_on`: UTC midnight of the business day. */
export function businessDayToStoredDate(day: string): Date {
  return startOfCalendarDayUtc(day);
}

/**
 * Parse and validate a request body. Everything that identifies WHO is writing
 * or WHERE the money lands (actor, project) is deliberately not read from it.
 */
export function parseManualCostRequest(
  body: unknown,
  idempotencyKey: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE
): ManualCostRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ManualCostInputError('invalid_body', 'Expected a JSON object.');
  }
  const raw = body as Record<string, unknown>;

  if (idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === '') {
    throw new ManualCostInputError('missing_idempotency_key', 'An Idempotency-Key header is required.');
  }
  if (!isIdempotencyKey(idempotencyKey)) {
    throw new ManualCostInputError('invalid_idempotency_key', 'Idempotency-Key must be a UUID.');
  }

  // Accepting a media id that is then ignored would let a caller believe a
  // receipt was attached. Receipts have their own private upload.
  if (raw.receiptMediaId !== undefined && raw.receiptMediaId !== null) {
    throw new ManualCostInputError(
      'receipt_media_not_supported',
      'Attach a receipt with the private receipt upload after recording the cost.'
    );
  }

  const unitId = raw.unitId;
  if (typeof unitId !== 'string' || unitId.length === 0 || unitId.length > 64) {
    throw new ManualCostInputError('invalid_unit', 'A unit is required.');
  }

  if (!isManualCostType(raw.entryType)) {
    throw new ManualCostInputError('invalid_entry_type', 'Choose a cost type.');
  }

  const amount = raw.amountThb;
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > MAX_COST_SATANG
  ) {
    throw new ManualCostInputError('invalid_amount', 'The amount must be a positive whole number of satang.');
  }

  const occurredOn = assertBusinessDay(raw.occurredOn, now, timeZone);

  if (typeof raw.description !== 'string') {
    throw new ManualCostInputError('invalid_description', 'A description is required.');
  }
  const description = normalizeDescription(raw.description);
  if (
    description.length < DESCRIPTION_MIN ||
    description.length > DESCRIPTION_MAX ||
    CONTROL_CHARS.test(description)
  ) {
    throw new ManualCostInputError(
      'invalid_description',
      `The description must be ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters.`
    );
  }

  return {
    unitId,
    entryType: raw.entryType,
    amountSatang: amount,
    occurredOn,
    description,
    idempotencyKey: idempotencyKey.toLowerCase(),
  };
}

/**
 * The identity of what is being recorded, independent of the key it travels
 * under. Same key + same fingerprint = a retry; same key + different
 * fingerprint = a conflict that must not write a second row.
 */
export function manualCostFingerprint(
  request: Pick<ManualCostRequest, 'unitId' | 'entryType' | 'amountSatang' | 'occurredOn' | 'description'>
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'manual-cost.v1',
        request.unitId,
        request.entryType,
        request.amountSatang,
        request.occurredOn,
        normalizeDescription(request.description),
      ])
    )
    .digest('hex');
}
