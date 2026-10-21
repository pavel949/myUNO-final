# Independent local security review

Reviewer: separate read-only agent `/root/security_review`. Reviewed singleton uniqueness,
atomic bootstrap/recovery, legacy global authority, scoped booking/receipt/member access,
global profile actions, owner safety, and revocation. No production writes or approvals.

Findings fixed and re-reviewed:

- P1: unit-only legacy readers could expose foreign workspace bookings/receipts. Both
  scope resolvers now exclude shared units and foreign reservation-group history.
- P2: coerced action values could bypass action-specific guards. Strict string validation.
- P2: owner trigger table shadowing. Schema-qualified `public.identity`.
- P2: unrelated identity updates could wait on administrative mutex. Lock only on owner loss.
- Blocked local administrators can have their role revoked without restoring login.
- Global profile target row locked; conflicting independent roles reject appointment.

Final reviewer conclusion: no remaining identified P1/P2 blocker in reviewed fixes.
Reviewer inspected tests but did not independently execute them. Root agent executed
verification. This is code-review evidence, not permission to release or assign accounts.

Limits: independent legacy authority remains; already-authorized in-flight command
cancellation is not guaranteed; ambiguous shared inventory is unavailable; live email
delivery and production runtime verification remain unperformed.

## Current-main integration review

After integrating main `24e3b805`, the separate reviewer checked the new imported
placement boundary. `source.reservationGroup.operatingSpaceId` is checked independently
of Booking existence, and both scope paths inherit the filter. The regression tests
foreign exclusion and local restoration with zero Bookings. No new P1/P2 blocker was
identified. Migration ordering remains additive with no automatic privilege assignment.
