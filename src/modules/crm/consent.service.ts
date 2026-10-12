import { Prisma, PrismaClient, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client';

/**
 * Consent, and the withdrawal of it (PDPA — doc 12, doc 17).
 *
 * The platform could record that someone consented and had no way, anywhere,
 * to record that they had changed their mind: `crm_consent` had exactly one
 * write path (`capturePublicLead`) and no update, withdrawal or revocation
 * route. Doc 17 describes a consent audit trail *with withdrawal history*.
 * Under the PDPA, withdrawal is a right, and a right nobody can exercise is
 * not implemented.
 *
 * ## Consent is a ledger, not a flag
 *
 * Every decision appends a row; nothing is ever mutated or deleted. The
 * current position is the newest row for that identity and purpose. This is
 * deliberate and it is the whole point: the question a regulator or a court
 * asks is not "does this person consent today" but "what were you relying on
 * when you sent that, and when did that change". Flipping a status in place
 * answers the first and destroys the answer to the second.
 *
 * The schema was already shaped for this — `CrmConsentStatus` has `withdrawn`,
 * and the index is `[identityId, purpose, capturedAt]`, which is a history's
 * index, not a current-state one. Only the code was missing.
 */

type ConsentDb = PrismaClient | Prisma.TransactionClient;

// Existing millisecond ties have no recoverable append order. Never let a
// random UUID pick a grant over a refusal/withdrawal or an expired grant.
// PostgreSQL enum order is granted < withdrawn < denied (schema.prisma).
const consentOrder: Prisma.CrmConsentOrderByWithRelationInput[] = [
  { capturedAt: 'desc' },
  { status: 'desc' },
  { expiresAt: { sort: 'asc', nulls: 'last' } },
  { id: 'asc' },
];

export interface ConsentDecisionInput {
  identityId: string;
  purpose: CrmConsentPurpose;
  /** Where the decision was made — 'account', 'website', 'email_link', 'staff'. */
  channel: string;
  /** What was shown or clicked. Never PII: a reference, not the person. */
  evidence?: Record<string, unknown>;
  /** Who recorded it, when that is not the person themselves (staff acting on a request). */
  recordedByIdentityId?: string;
  expiresAt?: Date | null;
}

async function appendDecision(
  db: ConsentDb,
  status: CrmConsentStatus,
  input: ConsentDecisionInput
) {
  const append = async (tx: Prisma.TransactionClient) => {
    // Every application consent writer uses this transaction-scoped lock.
    // It also serializes the first decision, when no consent row exists yet.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`crm-consent:${input.identityId}:${input.purpose}`}))
    `;
    const latest = await tx.crmConsent.findFirst({
      where: { identityId: input.identityId, purpose: input.purpose },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    });
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS "now"`;
    // Preserve a strict append order at the schema's millisecond precision,
    // even within one transaction or when the database clock moves backwards.
    const capturedAt = new Date(
      Math.max(clock.now.getTime(), (latest?.capturedAt.getTime() ?? -1) + 1)
    );
    return tx.crmConsent.create({
      data: {
        capturedAt,
        identityId: input.identityId,
        purpose: input.purpose,
        status,
        channel: input.channel,
        expiresAt: input.expiresAt ?? null,
        evidence: {
          ...(input.evidence ?? {}),
          ...(input.recordedByIdentityId
            ? { recordedByIdentityId: input.recordedByIdentityId }
            : {}),
        },
      },
    });
  };
  return '$transaction' in db ? db.$transaction(append) : append(db);
}

/** Record consent given. Appends; never edits an earlier decision. */
export async function grantConsent(db: ConsentDb, input: ConsentDecisionInput) {
  return appendDecision(db, 'granted', input);
}

/**
 * Record consent withdrawn — the path that did not exist.
 *
 * Withdrawing something never granted is allowed rather than refused: a person
 * asserting "stop using my data for this" should not have to be told their
 * request was unnecessary, and the record of them asking is itself worth
 * keeping.
 */
export async function withdrawConsent(db: ConsentDb, input: ConsentDecisionInput) {
  return appendDecision(db, 'withdrawn', input);
}

/** Record a refusal at the point of asking, which is not the same as withdrawal. */
export async function denyConsent(db: ConsentDb, input: ConsentDecisionInput) {
  return appendDecision(db, 'denied', input);
}

/**
 * Where consent stands for one purpose right now: the newest decision, with
 * an expiry treated as a lapse rather than as continuing consent.
 */
export async function getConsentStatus(
  db: PrismaClient,
  identityId: string,
  purpose: CrmConsentPurpose,
  now: Date = new Date()
): Promise<CrmConsentStatus | null> {
  const latest = await db.crmConsent.findFirst({
    where: { identityId, purpose },
    orderBy: consentOrder,
  });
  if (!latest) return null;
  if (latest.status === 'granted' && latest.expiresAt && latest.expiresAt <= now) {
    // Lapsed consent is not consent. Reported as withdrawn rather than
    // granted, so a caller asking "may I" gets the safe answer without having
    // to know about expiry.
    return 'withdrawn';
  }
  return latest.status;
}

/** Whether a purpose may currently be relied on. The question most callers mean. */
export async function hasConsent(
  db: PrismaClient,
  identityId: string,
  purpose: CrmConsentPurpose,
  now: Date = new Date()
): Promise<boolean> {
  return (await getConsentStatus(db, identityId, purpose, now)) === 'granted';
}

/**
 * The full history for one person, newest first — the PDPA subject-access
 * answer, and what makes the trail auditable rather than merely current.
 */
export async function getConsentHistory(db: PrismaClient, identityId: string) {
  return db.crmConsent.findMany({
    where: { identityId },
    orderBy: consentOrder,
  });
}

/** Current position across every purpose, for an account screen. */
export async function getConsentSummary(
  db: PrismaClient,
  identityId: string,
  now: Date = new Date()
): Promise<Array<{ purpose: CrmConsentPurpose; status: CrmConsentStatus | null }>> {
  const purposes: CrmConsentPurpose[] = ['service', 'marketing', 'property_matching', 'analytics'];
  return Promise.all(
    purposes.map(async (purpose) => ({
      purpose,
      status: await getConsentStatus(db, identityId, purpose, now),
    }))
  );
}
