# AI Audit Report Template — copy for a specific branch and environment

Do not fill statuses from assumptions. Attach exact file/line or runtime evidence. This report is an output artifact, not the canonical product specification.

## Assessment identity
- Assessed at (ISO date/time and timezone):
- Repository and main HEAD:
- Feature/release PR and HEAD:
- Deployment environment, URL and served commit:
- Database environment and applied migration:
- Data-source authority, sync lag and external systems:
- Access limitations:
- Auditor / test method:

## Summary without synthetic score
- P0 blockers:
- P1 broken journeys:
- P2 quality/scale issues:
- P3 refinements:
- Not checked:
- Main vs PR vs deployed differences:
- Cutover: go / no-go / not assessable; named sign-off and evidence.

## Flow evidence ledger
One row per CO01–CO30 and AT01–AT30. Use the full process passport and crosswalk.

| ID | Actor / intent | Route → API → service → model | Permission/tenant | State + money | Test/evidence | Main | PR | Runtime | Blocker/owner |
|---|---|---|---|---|---|---|---|---|---|
| CO01 | Lead intake | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |
| CO05 | Onboarding | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |
| CO07 | Stay booking | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |
| CO14 | Services | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |
| CO19 | Close/payout | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |
| CO26 | Guest → owner | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | Not checked | |

Repeat this row for every omitted process/acceptance ID; omission is NOT completion.

## Capability readiness matrix
Each capability must separately record nine dimensions: specification_complete, code_present, migration_applied, data_config_ready, permission_verified, ui_reachable, critical_test_passed, deployed, runtime_checked. Allowed: verified / partial / failed / not checked / not applicable.

| Capability | Specification | Code | Migration | Data/config | Permission | UI | Test | Deploy | Runtime | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Layantara project inventory | | | | | | | | | | |
| Canonical price/availability | | | | | | | | | | |
| Gallery (project/category/unit) | | | | | | | | | | |
| Short/long stay, lease, sale | | | | | | | | | | |
| Service/order/provider | | | | | | | | | | |
| Owner/manager/worker | | | | | | | | | | |
| Trust/compliance/tenant | | | | | | | | | | |
| Finance/settlement | | | | | | | | | | |
| Integration/backup/recovery | | | | | | | | | | |

## Source-of-truth crosswalk
| Business fact | Writer | Reader(s) | Scope / ownership | Constraint | Event / retry | Duplicates / drift |
|---|---|---|---|---|---|---|
| Unit identity | | | | | | |
| Booking/hold | | | | | | |
| Rate/quote | | | | | | |
| Owner/mandate | | | | | | |
| Payment/payout | | | | | | |
| Service fulfillment | | | | | | |
| Compliance/label | | | | | | |

## Surface and usability inspection
| Audience | Page | Parent navigation | Primary job/CTA | API/permission | Mobile/EN/RU/TH | Loading/error/empty/forbidden | Test/runtime | Result |
|---|---|---|---|---|---|---|---|---|
| Public | / | | | | | | | |
| Guest | /trips | | | | | | | |
| Owner | /owner | | | | | | | |
| Manager | /mc | | | | | | | |
| Frontline | /ops | | | | | | | |
| Provider | /provider | | | | | | | |
| Admin | /app/admin | | | | | | | |

## Reconciliation / release
- Source manifest and checksums; 39 villas / categories / media actual byte coverage / rates and Golden Master; booking, holds and financial snapshots separately.
- Migration fresh replay/drift, backup/restore, source/target aggregate counts and orphan/conflict checks.
- Auth/IDOR role matrix, API and private-media scope.
- Build/test/CI URL and exact SHA; deployed mobile/localization and critical smoke sequence.
- Risk, rollback owner, cutover approval, remaining issues with explicit severity.
