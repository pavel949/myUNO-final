# Agent module implementation and rollout

This branch implements the first secure vertical slice of [AGENT_MODULE.md](./AGENT_MODULE.md). It extends the existing global Identity and CRM opportunity/activity engine with agency relationship scopes; it does not create a second sales pipeline.

## Implemented surfaces

- Public entry: /partners/agents, global navigation and authenticated surface switcher.
- Agent workspace: /agent with contacts, opportunities, activities, inventory, client offers, approved knowledge/FAQ search, commissions read model and agency team.
- MyUNO review/coordination: /app/admin/agent-partners; /work/crm routes authorized administrators there.
- Client quotation: /p/[token], with immutable approval snapshot and fresh legal/source authority checks on access.
- Agency activation, member grant/revocation, suspension, quote review and knowledge review use existing administrator authority. A separate MyUNO team permission is not invented.

## Access and protection

Every agent action checks current membership, active Identity, active agency and active workspace on the server. Managers coordinate the agency; ordinary members can access their own relationships and introductions. A private contact relationship owns supplied channels and private notes. Global Identity reconciliation uses exact normalized channel matching, including existing private relationships, but never returns another agency's existence or canonical PII. New supplied channels do not overwrite the global Identity or CrmProfile.

One canonical opportunity is linked to an immutable introduction receipt containing originating agency and agent. Agent stages cannot mark financial completion. Handover requires the agent to confirm client permission and shares an explicit contact snapshot and request; private notes are excluded. The receipt proves recorded introduction and does not imply exclusivity or commission entitlement.

The old CRM endpoints use a scoped Prisma client that excludes unshared agency opportunities and all private agency activities from list, aggregate and direct-ID operations. Explicit handover adds the same opportunity to the internal CRM, with private activity projections filtered; the coordinator can continue through the existing contract/deal engine. New private tables and the opportunity/activity tables have RLS enabled and Data API privileges revoked, including PUBLIC, anon, authenticated and service_role. Application Prisma credentials remain server-only. Immutable introduction, approved quote version and agreement version rows are protected by database triggers.

## Quotes, inventory and messaging

Inventory reuses current sale/long-term rental publication gates and source authority. Agents prepare draft client amounts, fees, deposits and terms in exact integer satang; an authorized MyUNO administrator reviews those against commercial conditions before publication. These are reviewed quotations, not automatic binding pricing, inventory reservations, contracts, payments or title transfer.

Only an approved version can produce a random 256-bit share token; only its SHA-256 hash is stored. Client pages contain property facts, client amounts, deposit, terms and expiry, without relationship IDs, owner evidence, private notes or commission. Revocation, expiry, suspended agency/workspace, revoked creator membership, paused offering or failed current legal authority make links unavailable. Opening WhatsApp or Telegram uses the agent's own messenger compose flow and does not mark a message sent or delivered.

## Knowledge

Knowledge is a separate governed article model, not mutable UI translations or unreviewed marketing FAQ copy. Draft → published requires administrator review; expired/withdrawn articles and other languages are excluded. Answers show their source and review/expiry dates. No approved match prompts the agent to ask the coordinator. Generative AI, semantic retrieval and automatic legal answers are not activated in this slice.

## Finance boundary

AgentAgreementVersion and AgentCommission are additive, immutable agreement/read models tied to the existing LedgerEntry and Payout. No rate, due milestone, commission or payment is seeded or inferred. Paid commission requires finance evidence references. There is no payout execution or accrual adapter in this release; existing Payout payee semantics must be extended and reviewed before enabling it. Same-day target and maximum three-day due-payment policy need approved agreements defining the due milestone and calendar/business-day interpretation.

## Migration and rollback

Deploy the additive migration before application code. It adds organization type brokerage, memberships, agency workspace/relationship/introduction/handover/quote/share/knowledge/agreement/commission models and a nullable activity workspace reference. Existing CRM records remain internal; no legacy records or finances are reclassified or backfilled. Deployment/build must not apply migrations against production implicitly.

The migration closes Data API access on crm_opportunity and crm_activity as well as new private tables. Check deployed integrations for direct REST/GraphQL reads before release; repository application code uses Prisma. Confirm the production Prisma role can access the private tables while Data API roles cannot.

Rollback application code by reverting the branch while retaining additive schema and evidence; do not drop introductions, quote snapshots or agreements. Suspending workspaces stops agent access and public shares. Do not re-grant public Data API access as a rollback shortcut.

## Remaining work before claiming the whole specification

- Finance-approved commission accrual/settlement adapter, payout payee support and due-date scheduler.
- Team-specific MyUNO CRM grants beyond current administrator authority.
- Pagination/export/import and richer contact editing, deduplication/dispute resolution and team reassignment.
- Offer revisions, automatic authoritative fee calculation, short-stay quoting, multi-property shortlists, client response capture and PDFs.
- Automatic quote acceptance into a contract/booking; coordinators currently use the existing contract/deal engine manually from the shared opportunity.
- AI assistant/semantic search and connected WhatsApp/Telegram delivery/webhook adapters.
- Translation approval, content publication, agent agreement and operating SLA configuration.
- Production migration, deployment and post-deployment verification.

Recent lists show at most 100 records (inventory 200); the interface states the limit. All new UI strings have RU/EN needs_review seed entries and existing locale fallback.

## Verification

The repository CI runs platform inventory audit, migration replay/Data API closure/drift/idempotence, lint, the full test suite, typecheck and production build. A subsequent production Chromium verification exercises actual server routes and rendered forms: private contact → opportunity → quote draft → review → approval → client share → WhatsApp/Telegram compose; explicit MyUNO handover; anonymous/cross-agency/cross-origin denial; mobile viewport; revocation. Screenshots, server log and verification report are uploaded as agent-portal-verification.

Current evidence and CI links are recorded in the pull request. A successful compile is not production deployment or proof that approved commercial terms exist.
