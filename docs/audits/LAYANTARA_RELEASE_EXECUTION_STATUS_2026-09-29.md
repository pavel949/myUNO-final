# Layantara → myUNO: release execution and QA evidence

**Observed:** 2026-09-29. **Scope:** connected GitHub PR #144/#147 and read-only checks of connected source Layan Tara OS and target MyUno-final databases. **Deployment decision: NO-GO.** This is an evidence log, not approval to switch the production writer.

## 1. CI / integration — PASS for code, not production

- PR #147 merged into #144 as commit `fa077e999788e113454d46a78cd6392e40af62a3` after the exact #147 head `c5bae1ee4e0179feea41c56affce79f90bb800d4` passed its workflow.
- Final combined PR #144 CI run: https://github.com/pavel949/myUNO-final/actions/runs/36518258728 — **success** on exact commit `fa077e999788e113454d46a78cd6392e40af62a3`. It ran lint, a complete migration replay on throwaway PostgreSQL, database reproducibility/drift, TypeScript, focused tests, **240 test files / 2,287 tests passed**, and production build.
- #144 is a DRAFT based on the staged release branch, not merged to `main`; source-control, pricing and data-activation guards remain in place. CI does not mean that the live target schema was migrated.

## 2. Authenticated browser E2E — NOT EXECUTED

The connected Vercel team returned zero accessible projects and the intended deployment URL was unavailable through the connected fetch action. The working container has no `agent-browser` binary and cannot resolve GitHub for a local checkout. No authenticated preview URL or QA identities were available to run a real browser journey. **Never report API/unit/integration tests as browser E2E.**

| Journey | Repository evidence | Browser acceptance |
|---|---|---|
| Onboarding / readiness and live gate | PR #144 + passing Vitest | NOT RUN |
| Three-tier project/category/exact-unit gallery; upload, reorder, cover and unlink | Scoped gallery routes, editor tests | NOT RUN |
| Staff / MC full project, category and unit occupancy, controls, role isolation | Shared calendar projection + MC scope tests | NOT RUN |
| Search → quote → booking → payment / availability conflict | Canonical quote and booking tests | NOT RUN |
| Pre-arrival → check-in → in-house → checkout | One Booking lifecycle and tests | NOT RUN |
| Lease / sale CRM opportunity → agreement → evidence → signature → close | Staged agreement service and tests | NOT RUN |
| Finance, refund, deposit, owner reconciliation | Regression tests | NOT RUN |

Do not create fake production bookings, agreements or payments to compensate for absent QA credentials.

## 3. Backup and migration — BLOCKED; zero live DDL

The repository's `.github/workflows/backup.yml` is designed to dump, restore into PostgreSQL 17, inspect restored tables and migration history, encrypt and store a 30-day artifact. **No fresh, matching, restorable production backup artifact was available or verified.** The latest scheduled [Backup run #36502420328](https://github.com/pavel949/myUNO-final/actions/runs/36502420328) FAILED at `Check required configuration`: both `BACKUP_DATABASE_URL` and `BACKUP_PASSPHRASE` are unset in GitHub Actions. Dump, scratch restore, integrity assertions, encryption and artifact upload were skipped. Its output reported `pg_dump 16.15` despite PostgreSQL 17 being installed; isolated [PR #149](https://github.com/pavel949/myUNO-final/pull/149) pins explicit PostgreSQL 17 binaries, but does not create credentials or a backup. Earlier inspected scheduled Backup runs also failed. Provider-managed backup availability remains unverified. A successful *scratch CI migration* is NOT a backup or production restore drill.

Read-only target migration-history comparison:
- Repository release migration files: 63; target finished Prisma migration records: 53, including eight history names absent from the current repository.
- **18 release migrations are not recorded as applied** in the live target, including the gallery, structure and agreement migrations:
  `20260929090000_inventory_category_gallery`, `20260929100000_project_structure_nodes`, `20260929110000_property_deal_agreements`.
- All three corresponding target tables are absent; no new migration was applied and no existing data overwritten.
- The older missing `20260907001000_unit_project_coherence` and other absent migration records require a live drift/baseline assessment, not blind `migrate deploy`.

**Hard gate:** verify an encrypted full backup of BOTH source and target, decryption, scratch restore, table counts, Prisma history, relevant booking/finance/occupancy row counts, and an actual rollback rehearsal. Resolve migration history and drift on an isolated restore. Only then apply the **ordered full chain** to target, verify RLS, grants, triggers and API behavior; no isolated cherry-pick of the three new files.

## 4. Layantara data and media — PARTIAL / BLOCKED

- Source `villa_master_crosswalk`: 39 operational/category IDs confirmed; physical specifications **8 confirmed / 31 pending**. All 31 pending have a document/evidence pointer but no source-page pointer, no `physical_source_unit_code` and no signed confirmation timestamp. Their identifiers: A8–A12, A14–A19, AA, B20–B29, GUY1–GUY2, V1–V7. Resolve each against actual floor plans or an authorized site inspection. Do not infer missing square metres/floor/view/physical identity from the separate DEMO LT-* rows. No pending spec was falsely marked confirmed.
- Source `villa_media`: 67 rows on 5 physical villas. All 67 match an indexed source `storage.objects` entry in the `villa-media` bucket, and their declared byte size and MIME type equal source Storage metadata. This is a **metadata/index match, not a content SHA-256 or a file-open proof**.
- Target: 67 `media_asset`/`unit_media` links, all 67 link to SOURCE public Supabase Storage URLs; a read-only query confirmed **0 target-owned objects** in target `villa-media` bucket. Independent byte copy/hash and failover NOT PROVED. The other 34 villas have no exact-unit source photos.
- Target Layan Tara project remains draft at latitude/longitude `0,0`. Source structured project tables do not provide a verified coordinate; a precise map pin must be confirmed by site/operator before changing the target.
- Do not misrepresent category representative room imagery as exact-unit condo/villa photography.

## 5. Tariffs, arithmetic and policies — STATIC PARITY PASS; COMMERCIAL ACTIVATION BLOCKED

Read-only comparison of live source category-rate records with staged target `layantara_copy.rate_matrix`: **72 source / 72 target, all 72 same IDs, amount in integer satang, category, season, rate mode, currency, unit, inclusive flags and sellability; zero field mismatches.** This includes 40 daily, 24 monthly and 8 yearly rows.

The 78 existing DRAFT `commercial_offering` records contain 351 repeated tariff-grid entries referencing all 72 source rate IDs. Every grid entry matched the staged matrix for amount, mode, currency, unit, VAT-included flag, service-charge-included flag, breakfast flag; zero observed mismatches. This proves static imported-rate equality, **not mathematical Golden Master quote equality for representative date ranges, discounts, fees, monthly allocation, policies, settlement or refunds**.

Source policy divergence requiring written approval:
- 40 nightly source rates mark taxes/service/breakfast INCLUDED, whereas 24 `30_nights` and 8 `month` rates mark all three EXCLUDED.
- Source `guest_price_display` says 7% VAT included for guest display, and `service_charge_rate_confirmed=false`. Confirm which charge components and permitted pricing/advertising treatment apply to every tariff.
- Source booking policies include different daily/monthly/peak deposit, advance, cancellation and utility terms. Bind and approve signed versions, not just arbitrary default text.
- All 39 short-stay and 39 long-term offers remain DRAFT; **zero tax-policy approvals**. Do not re-import 78 duplicate offers or activate a pricing rule merely because its ID/amount is present.

## 6. Occupancy and writer safety — POINT-IN-TIME MATCH; CUTOVER NO-GO

- Source `operational_occupancies`: 84 active (83 imported reservations, 1 owner stay) and 16 non-active. Target has 83 `ota_import` and 1 `owner_hold` protective blocks.
- Independent read-only comparison was **84/84 exact** on encoded source ID, source-inventory-ID → target Unit mapping, check-in, exclusive checkout and owner/import reason; zero mismatches at observation time. Of these, 70 extend beyond 2026-09-29.
- Source `source_reservation_blocks` separately has 95 rows (82 confirmed, 1 pending, 12 cancelled); the 12 cancellations must not become active blocks. Do not conflate source feed and canonical active occupancy.
- Target canonical Booking = 0 for live Layantara; protective blocks are not converted guest, booking or payment records.
- Source writer is still `bookingAuthority='source'`, `cutoverVerified=false`. No source freeze, last-delta snapshot, OTA acknowledgement or signed handover has occurred.

**Production calendar ownership: remains Layantara OS.** Keep target draft, all 84 protective blocks and single-writer guard. A safe cutover is forbidden until backup/restore, migrations, 31/31 approved specs, media/coordinates, tax/term signoff, mathematical Golden Master, real authenticated E2E, final source delta, serialized writer freeze/flip and rollback checks are evidenced.

No customer identity, credentials, source media URLs, payment details or raw secret values are stored in this file.
