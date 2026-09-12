# QA_ACCEPTANCE.md — Hard Product Acceptance Gates

## 1. Public portal
- practical purpose understood quickly;
- search works;
- real properties render;
- responsibility label truthful;
- no dead CTAs;
- mobile usable;
- EN/RU/TH critical copy covered;
- SEO metadata valid.

## 2. Booking
- same canonical price everywhere;
- unavailable dates cannot book;
- stale availability handled honestly;
- booking mode accurate;
- payment/request state accurate;
- duplicate submit idempotent;
- confirmation leads to Trip Hub.

## 3. Guest
- only own trips visible;
- travel-party permissions tested;
- pre-arrival contextual;
- access not leaked early;
- requests route to operations;
- service orders tracked;
- emergency route exists;
- checkout/post-stay accurate.

## 4. Owner
- can submit/claim/apply for management;
- self-managed authority works only when granted;
- cannot edit myUNO-managed pricing without delegation;
- owner A cannot access owner B;
- statements drill to canonical records.

## 5. Partner manager
Organization verification, authority proof, inventory onboarding, team invite, delegated pricing/availability, lateral isolation and truthful public responsibility.

## 6. Provider
Apply, vet, capability, order, accept/decline, fulfill, evidence, payout status and no unrelated guest access.

## 7. Services
Property-specific terms, standalone context, no false confirmation, SLA measurement, cancellation/refund, Trip Hub integration, quantity/duration/capacity separation.

## 8. Architecture
Canonical ownership matrix current; no duplicate global person tables; no ordinary new-property DB; event mapping idempotent; read models rebuildable.

## 9. Database
Migration compatibility, fresh backup, restore tested, no schema drift, row-count reconciliation and no orphan critical records.

## 10. Security
IDOR, cross-property, role escalation, private media, secret exposure and privileged endpoint auditing.

## 11. Design
Visual hierarchy, mobile, tokens, image-led public portal, no generic audience-card wall, correct state surfaces and reviewed screenshots.

## 12. Scale
Onboard a test property without code change, new DB, auth fork, service-table fork or bespoke dashboard.

## 13. Process completion
Each CO01–CO30 process has actor, state, authority, money where applicable, exceptions, terminal outcome, handover and E2E evidence.

## 14. Commerce concurrency
Test duplicate submit, payment timeout, cancellation vs fulfillment race, dispute vs close, capacity race, reschedule payment failure and late refund after settlement.

## 15. CRM
Scope-wide metrics before pagination; active opportunities have next action/explicit exception; stage transitions server-validated; property-sale won does not create ownership; handover links downstream transaction.

## 16. Migration/recovery
Build/install do not mutate migration history; restore rehearsal includes reconciliation of external payment/webhook side effects.
