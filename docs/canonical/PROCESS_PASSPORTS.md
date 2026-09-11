# PROCESS_PASSPORTS.md — Canonical CO01–CO30 Process Passports

This file is normative. `PROCESS_MAP.md` defines the process catalog; this file defines the minimum executable contract for each process. Implementation details may extend these passports but may not weaken authority, transaction, audit, idempotency, money, or handover rules.

## Common contract
Every process must expose: actor and fallback owner; scoped authority; start and terminal states; transaction boundary for material writes; idempotency/retry behavior; money basis where applicable; user-visible status; canonical events/evidence; and explicit handover. A process is incomplete if the UI appears finished but the canonical state cannot be reconstructed from stored facts.

### CO01 — Lead intake and first action
- **Actor / owner:** CRM intake automation; fallback CRM manager.
- **States:** received → matched/created → assigned/unassigned → first_action_due → qualified/disqualified/converted.
- **Authority:** contact creation may be automated; account-owner assignment requires CRM-operating permission.
- **Transaction:** Identity/Party match + CRM profile + source attribution must not create duplicate persons; assignment/audit write atomically where changed.
- **Money:** none.
- **Retry / exception:** duplicate channel submissions resolve idempotently to the same Party when confidence is sufficient; ambiguous matches enter review.
- **Outcome / evidence:** source, consent/provenance, owner, next action, timestamps.
- **Handover:** CO02, CO04, CO23 or nurture queue.

### CO02 — Qualification to conversion
- **Actor / owner:** account owner; fallback sales/CRM manager.
- **States:** discovery → qualified → proposed → negotiating → accepted/won or lost/deferred.
- **Authority:** opportunity edits scoped to permitted CRM; commercial acceptance follows deal-specific approval rules.
- **Transaction:** terminal stage change and next-process reference must commit together when acceptance creates downstream work.
- **Money:** opportunity value is forecast only; never ledger truth.
- **Retry / exception:** stale proposals version rather than overwrite accepted terms.
- **Evidence:** requirement notes, proposal/quote version, decision, next action.
- **Handover:** CO07, CO14, CO04/05, CO26 or typed referral.

### CO03 — External partner sourcing
- **Actor / owner:** concierge/sourcing operator.
- **States:** need_open → sourcing → partner_identified → terms_received → customer_proposed → accepted/declined → fulfilled/closed.
- **Authority:** partner terms and commission visible only to commercial roles.
- **Transaction:** accepted partner terms snapshot with downstream referral/order reference.
- **Money:** commission/receivable uses accepted snapshot, not later partner config.
- **Retry:** provider search can fan out; only one accepted fulfillment path may become financially recognized unless explicitly split.
- **Evidence:** partner, terms, customer acceptance, fulfillment proof.
- **Handover:** CO14 or finance close CO19.

### CO04 — Owner acquisition
- **Actor / owner:** owner-relations/BD.
- **States:** lead → qualified_asset → inspected → model_proposed → mandate_contracting → accepted/declined.
- **Authority:** commercial proposal/management model approval restricted; ownership is never inferred from CRM stage.
- **Transaction:** accepted mandate/authority evidence creates onboarding case atomically or remains accepted-pending-onboarding.
- **Money:** fees/commission terms are versioned contract facts.
- **Evidence:** Party, asset reference, authority proof, proposal, mandate.
- **Handover:** CO05.

### CO05 — Property/unit onboarding
- **Actor / owner:** onboarding operator; fallback platform admin.
- **States:** draft → identity/location → ownership/authority → inventory/pricing → compliance/content → operations/team/services → readiness → approved/live.
- **Authority:** scoped project admins edit; live transition requires go-live permission and readiness gate.
- **Transaction:** individual steps autosave; `live` is a guarded state transition after deterministic readiness evaluation.
- **Money:** no booking revenue until sellable/pricing status is valid.
- **Retry:** incomplete records remain draft; activation failure returns all blockers.
- **Evidence:** readiness report, credential verification, operator assignment, publishable unit facts.
- **Handover:** CO06 and operating processes.

### CO06 — Rate and distribution change
- **Actor / owner:** revenue manager/admin.
- **States:** draft_change → previewed → approved(if required) → active → sync_pending → synced or sync_failed.
- **Authority:** pricing write and distribution authority are explicit scopes.
- **Transaction:** active rate/rule version is atomic; external channel writes carry idempotency keys.
- **Money:** canonical quote reads active version and snapshots applied commercial terms.
- **Retry:** sync retry cannot create a second internal rate truth.
- **Evidence:** before/after version, actor, approval, sync result.
- **Handover:** CO07 / CO29 on failure.

### CO07 — Stay booking
- **Actor / owner:** guest/agent; booking operations fallback.
- **States:** search → quote → hold → pending_payment/request → confirmed or expired/declined/cancelled.
- **Authority:** guest may create own booking; privileged overrides audited.
- **Transaction:** availability hold and booking uniqueness protect capacity; payment confirmation and financially material status changes are idempotent.
- **Money:** one canonical pricing result; tax/discount/rate snapshot retained.
- **Retry:** duplicate submit/provider callback cannot duplicate booking or payment recognition.
- **Evidence:** quote snapshot, hold, payment, confirmation event.
- **Handover:** CO08 and guest Trip Hub.

### CO08 — Pre-arrival
- **Actor / owner:** guest-care/operations manager.
- **States:** pending → collecting_requirements → work_in_progress → blocked/ready.
- **Authority:** only scoped staff see sensitive arrival/access facts.
- **Transaction:** readiness is derived from canonical prerequisites/tasks, not a free manual green flag.
- **Money:** unresolved mandatory payment can be a blocker.
- **Retry:** failed task/provider actions remain explicit blockers with owner/SLA.
- **Evidence:** ETA, guest facts, tasks, inspection/evidence, blocker reasons.
- **Handover:** CO09.

### CO09 — Check-in
- **Actor / owner:** host/front office.
- **States:** expected → arrived → verified → access_released → checked_in; exception = blocked/escalated.
- **Authority:** access release only after configured prerequisites and scoped staff action.
- **Transaction:** check-in event and access issuance must not contradict readiness/identity state.
- **Money:** payment/deposit prerequisites follow property policy.
- **Evidence:** identity/compliance confirmation where required, access event, timestamp.
- **Handover:** CO10/13/14 during stay.

### CO10 — In-stay request
- **Actor / owner:** guest-care intake; assigned department/provider owner.
- **States:** created → acknowledged → assigned → in_progress → resolved → verified/closed; reopened allowed.
- **Authority:** guest sees own request; workers see assigned/permitted scope.
- **Transaction:** material transition emits event/evidence; related task/order reference canonical.
- **Money:** chargeable request must route through explicit service/order terms.
- **Retry:** escalation on SLA breach; duplicate communication does not duplicate work item.
- **Handover:** CO11/12/13/14/17 as typed work.

### CO11 — Housekeeping
- **Actor / owner:** housekeeping supervisor/team.
- **States:** queued → assigned → in_progress → exception/inspection → complete/verified.
- **Authority:** department/project scoped.
- **Transaction:** checklist/evidence writes attach to one canonical job/task.
- **Money:** internal cost or vendor order separately recorded; completion is not revenue.
- **Retry:** failed inspection reopens job; cleaning completion does not override maintenance/access blockers.
- **Evidence:** checklist, photos where configured, verifier.
- **Handover:** readiness/CO09 or turnover after CO15.

### CO12 — Maintenance
- **Actor / owner:** technician/maintenance manager.
- **States:** reported → triaged → diagnosed → awaiting_approval/parts/vendor → in_progress → fixed → verified/closed; reopen supported.
- **Authority:** cost approval follows threshold/owner/property authority.
- **Transaction:** approved estimate and resulting procurement/service order reference preserved.
- **Money:** cost/owner charge/operating cost classification explicit.
- **Retry:** unresolved blocker remains visible; vendor failure can reassign without rewriting history.
- **Evidence:** diagnosis, estimate, approval, work proof, condition history.
- **Handover:** CO18/20 as needed, then readiness.

### CO13 — F&B
- **Actor / owner:** guest/operator; kitchen/vendor fulfiller.
- **States:** requested → confirmed/quoted → preparation → delivery/service → completed/problem/cancelled.
- **Authority:** dietary/private guest data scoped to need-to-know.
- **Transaction:** accepted order terms and fulfillment evidence stable.
- **Money:** entitlement vs charge clearly distinguished; charge flows through order/payment ledger.
- **Retry:** substitutions require policy/customer approval where material.
- **Evidence:** pax/allergy acknowledgments, delivery/completion.
- **Handover:** CO14/17/19.

### CO14 — Service/product/rental order
- **Actor / owner:** guest/owner/customer/manager; provider fulfiller.
- **States:** commercial, fulfillment, payment, dispute and settlement dimensions remain distinct; terminal administrative close only after applicable dimensions settle.
- **Authority:** orderer sees own orders; provider sees assigned orders; admin scopes explicit.
- **Transaction:** acceptance snapshots terms; fulfillment + earning recognition atomic; confirm/dispute serialized by row lock; duplicate disputes prevented.
- **Money:** immutable take-rate/price terms; late refunds carried into a payable period; unresolved refunds/disputes hold payout.
- **Retry:** idempotent create/payment/fulfillment/occurrence keys; reschedule preserves old capacity until replacement safe.
- **Evidence:** accepted terms, provider evidence, confirmation/dispute, settlement references.
- **Handover:** Trip Hub, CO17 and CO19.

### CO15 — Checkout
- **Actor / owner:** guest-care + operations.
- **States:** departure_due → departed → access_returned → inspection → issues_resolved → turnover_open → closed.
- **Authority:** damage/financial decisions require appropriate role.
- **Transaction:** final stay state and evidence do not erase later claim/dispute rights allowed by policy.
- **Money:** final charges/refunds/deposit claim linked to source evidence.
- **Retry:** inspection exception creates typed case/task.
- **Evidence:** departure, access revocation, inspection, claim references.
- **Handover:** CO11, CO17, post-stay CRM.

### CO16 — Cancellation/reschedule/extension/no-show
- **Actor / owner:** guest/agent/operator depending policy.
- **States:** change_requested → policy_evaluated → capacity/funding_pending → committed or rejected.
- **Authority:** override requires privileged permission and audit.
- **Transaction:** reschedule commits replacement before releasing old capacity; money delta and state transition coordinated.
- **Money:** cancellation/refund snapshot from accepted booking/order policy.
- **Retry:** provider/payment failure leaves original commitment intact unless cancellation separately committed.
- **Evidence:** policy version, calculation, consent, payment/refund.
- **Handover:** CO07/08/14/19.

### CO17 — Complaint/incident/dispute
- **Actor / owner:** affected guest/owner/customer; case manager/admin decision owner.
- **States:** opened → acknowledged → investigating → decision_pending → remedied/rejected → resolved/closed; reopen rules explicit.
- **Authority:** raiser must own relevant subject; decision/refund authority restricted.
- **Transaction:** ticket + dispute creation atomic; subject locking prevents confirm/close race; one active canonical dispute per subject path.
- **Money:** remedy references refund/adjustment seam; no direct money mutation from UI.
- **Retry:** duplicate raise rejected idempotently; failed remedy remains reconciliation exception.
- **Evidence:** complaint, subject, decision note, refund/ledger refs.
- **Handover:** CO19/25 as needed.

### CO18 — Procurement
- **Actor / owner:** requester → approver → procurement/finance.
- **States:** requisition → quoted → approved/rejected → ordered → partially_received/received → invoiced → paid/reconciled.
- **Authority:** threshold and budget/owner approval enforced.
- **Transaction:** receipts append; do not overwrite quantity history.
- **Money:** PO/invoice/payment references and tax treatment explicit.
- **Retry:** discrepancy keeps payable unresolved.
- **Evidence:** quotes, approval, receipt, invoice, payment.
- **Handover:** CO12/20/19.

### CO19 — Period financial close
- **Actor / owner:** finance/admin.
- **States:** open_period → collecting → exceptions → statement/remittance_ready → recorded → reconciled → closed.
- **Authority:** finance roles only; dashboards are read models, not write-side ledgers.
- **Transaction:** payout recording validates computed amount and no unresolved financial holds.
- **Money:** canonical payments/refunds/ledger/allocations; late adjustments enter a payable current period rather than mutate closed payout history.
- **Retry:** failed refund/payment/payout remains reconciliation exception.
- **Evidence:** period basis, calculations, payout/statement, reconciliation actor/date.
- **Handover:** owner/provider reporting, leadership CO30.

### CO20 — Owner approval / capex
- **Actor / owner:** manager requester; owner/authorized approver.
- **States:** need → estimate → approval_pending → approved/declined → procured/worked → verified → financially_closed.
- **Authority:** ownership/effective mandate determines approver; delegated thresholds supported.
- **Transaction:** approval evidence locked to estimate/version.
- **Money:** owner charge/reserve/capex classification explicit.
- **Retry:** revised estimate creates new approval version.
- **Evidence:** estimate, approval, invoices, completion.
- **Handover:** CO18/12/19.

### CO21 — Owner stay
- **Actor / owner:** owner/owner-relations.
- **States:** requested → ownership_verified → availability_checked → reserved/blocked → prearrival → stayed → turnover.
- **Authority:** effective ownership/usage rights only.
- **Transaction:** inventory block/booking uses same capacity truth as guest bookings.
- **Money:** owner-stay charges/cleaning follow contract, not assumed zero.
- **Retry:** conflict produces explicit alternative/denial.
- **Evidence:** ownership right, reservation, stay events.
- **Handover:** CO08/15.

### CO22 — Staff lifecycle
- **Actor / owner:** manager/admin.
- **States:** invited/created → active → role/scope_changed → suspended/deactivated.
- **Authority:** only authorized managers grant scopes; privilege elevation audited.
- **Transaction:** deactivate must revoke/suppress access and trigger work/account reassignment process.
- **Money:** payroll outside scope unless explicitly integrated.
- **Retry:** expired invite can reissue without duplicate identity.
- **Evidence:** membership, role assignments, actor, status history.
- **Handover:** operational queues/reassignment.

### CO23 — Provider lifecycle
- **Actor / owner:** provider applicant + network admin.
- **States:** application → needs_information → vetted/approved or rejected → active → suspended/offboarded.
- **Authority:** vetted badge only after evidence-backed admin decision.
- **Transaction:** activation requires organization/capability/commercial/payout prerequisites.
- **Money:** commercial terms versioned; no payout before valid payee setup.
- **Retry:** expired documents can suspend capability without deleting history.
- **Evidence:** docs, vetting actor/date, terms, coverage.
- **Handover:** CO14 and network quality.

### CO24 — Content/media lifecycle
- **Actor / owner:** content editor/reviewer.
- **States:** draft → localization/review → approved → published → stale/archived.
- **Authority:** publish requires content permission; private media stays private.
- **Transaction:** published version references rights/provenance and locale status.
- **Money:** none.
- **Retry:** `needs_review` blocks production publication, not preview inspection.
- **Evidence:** source/rights, reviewer, version, locale status.
- **Handover:** public portal/property/service surfaces.

### CO25 — Standards
- **Actor / owner:** standards assessor/property manager.
- **States:** applicable → evidence_pending → assessed → compliant/noncompliant/exception → corrective_action → reassessed.
- **Authority:** endorsement cannot be self-declared without permitted assessment.
- **Transaction:** result stores standard version and evidence references.
- **Money:** none directly.
- **Retry:** missing evidence = not proven, not compliant.
- **Evidence:** seven evidence domains, scores, exceptions, corrective tasks.
- **Handover:** public endorsement/control plane/CO30.

### CO26 — Guest to buyer to owner
- **Actor / owner:** CRM/real-estate account owner.
- **States:** guest → interest → qualified opportunity → viewing/diligence → transaction_pending → buyer → ownership_verified → owner/managed.
- **Authority:** CRM stage is descriptive; ownership only created by legal/effective evidence and authorized write.
- **Transaction:** ownership creation and source transaction/evidence link atomic.
- **Money:** sales opportunity forecast separate from legal settlement/ledger.
- **Retry:** failed deal returns opportunity state without corrupting guest history.
- **Evidence:** Party continuity, opportunity, legal ownership proof.
- **Handover:** CO04/05/20/21.

### CO27 — Ownership/operator change
- **Actor / owner:** platform admin/legal/operations.
- **States:** proposed → verified → scheduled_effective → cutover → reconciled.
- **Authority:** documentary proof and privileged role required.
- **Transaction:** effective-dated relationships preserve history; future authority changes at cutover.
- **Money:** split obligations/settlements by effective dates and contract.
- **Retry:** incomplete cutover cannot silently revoke old responsibility without replacement.
- **Evidence:** documents, effective date, access changes, responsibility mapping.
- **Handover:** CO19/22/28 as applicable.

### CO28 — Property/partner offboarding
- **Actor / owner:** platform/property leadership.
- **States:** decision → obligations_inventory → transition_plan → future_sales_disabled → handover/export → access_revoked → finance_reconciled → archived.
- **Authority:** privileged; owner/operator contractual rights respected.
- **Transaction:** archive never deletes historical bookings/orders/finance/evidence.
- **Money:** outstanding settlements/refunds remain payable/reconcilable.
- **Retry:** failed handover blocks final offboarding status.
- **Evidence:** export/handover confirmation, revoked access, reconciliation.
- **Handover:** archive/alternate operator.

### CO29 — Integration failure/recovery
- **Actor / owner:** system + integration operator.
- **States:** detected → scoped → queued/retrying → reconciled or manual_intervention → recovered → RCA.
- **Authority:** replay/manual correction privileged and audited.
- **Transaction:** external mappings include environment/system identity; idempotency prevents duplicate business effects.
- **Money:** payment/webhook replay must reconcile before mutation.
- **Retry:** bounded retries + dead-letter/manual path; never infinite silent retry.
- **Evidence:** failure, attempts, external IDs, resolution, reconciliation.
- **Handover:** originating process resumes; CO30 for material incidents.

### CO30 — Leadership period review
- **Actor / owner:** portfolio leadership.
- **States:** period_open → facts_ready → exceptions_reviewed → decisions_recorded → actions_assigned → followup_closed.
- **Authority:** read across permitted portfolio; decisions/tasks scoped to responsible properties/functions.
- **Transaction:** dashboards remain derived; decisions create canonical tasks/actions rather than editing analytical aggregates.
- **Money:** review only canonical finance read models and reconciliation exceptions.
- **Retry:** missing data is surfaced as data-quality exception, not zero.
- **Evidence:** decisions, owners, deadlines, linked metrics/exceptions.
- **Handover:** CO01–CO29 action queues.

## Acceptance rule
For each implementation claim, map at least one E2E acceptance scenario to the corresponding passport. Tests must verify terminal state, forbidden lateral/role path where applicable, money result where applicable, idempotent retry/concurrency for material commands, and persisted evidence/event references.