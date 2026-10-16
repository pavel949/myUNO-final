# Assigned property content workflow

> **Дополнительный справочный материал / спецификация.** Может содержать проектные или прежние решения; не подтверждает текущее поведение или production. Начать с [текущей системы](../current/SYSTEM.md) и [остатка работ](../current/IMPLEMENTATION_STATUS.md), сверенных 2026-10-16.

## Scope and entry points

- Employee signs in with their own identity at `/login?next=%2Fproperty%2Fcontent` and works at `/property/content`.
- Admin invites the person through `/app/admin/people`. The claim link lets that person choose their own password. Do not share an administrator password.
- Admin assigns `content_contributor` to one exact unit plus its real project, or to one project for **shared complex content only**. A project grant does not cover its units. There is no platform/organization/provider contributor grant.
- The People form links to the employee workspace. Reviewers use `/app/admin/property-content-proposals`, also in the admin inventory navigation.
- Ordinary new-property intake remains `/property/onboard?kind=home`, reviewed separately at `/app/admin/property-submissions`. A content employee is not automatically the property's owner or manager.

## Lifecycle

1. The employee selects one assigned target, loads its server-owned baseline, edits the permitted facts, optionally selects one description language, and prepares the gallery/order/cover.
2. Save stores a CRM draft (`myuno_property_content_proposal_v1`); canonical inventory is untouched. The employee can resume their draft.
3. Submit makes the proposal read-only. An active administrator sees before/after facts, exact locale prose, ordered galleries and author attribution.
4. Return requires a note and allows correction. Refresh baseline explicitly discards proposed changes and reloads the current canonical property; the employee must confirm this in the UI.
5. Approve atomically rechecks the active employee assignment, target binding, current baseline and media eligibility, applies permitted content and records one audit event. Concurrent/stale revisions fail with 409. An identical approval retry returns the approved result without applying it twice.

An approval changes the existing canonical card. Already-public cards show approved content immediately. This is not a publication-state transition: draft/live status, owners, engagements, prices, availability, bookings and compliance are outside this workflow.

## Content boundary

Unit: name, bedrooms, bathrooms, capacity, fallback area, canonical gross area, floor, address supplement and amenity keys. Project: name, brand, address, city, district, project type and total units. Project facilities are canonical ProjectAmenity rows, not the deprecated facilities array; they are outside this initial form. All proposed keys/types/bounds are strict; zero capacity can preserve an unknown value. Unsupported legacy facts or a detached cover fail with 409 before a proposal is created. An administrator must first clean up those canonical values; malformed snapshots cannot become unreopenable saved drafts.

One explicitly selected description locale changes at a time. Approval creates a fresh per-target/per-proposal content key, copies previous locales and repoints only this target. For units, approval pins the original resolved marketing-title key in a nullable explicit pointer before changing the description pointer. Existing explicit title pointers stay unchanged. Title rows and translations are never copied or changed, so both existing CMS edits and a title created concurrently under the old key remain reachable. Public readers use the explicit pointer first and retain the legacy derived-key fallback when it is null. Existing text keys may be shared with other surfaces; their translations are never overwritten by this flow. Incorrect namespace/shared description bindings fail closed. `needs_review` is translation metadata, not a hiding mechanism.

Gallery IDs must already be attached to the target or belong to the applicant as supported public, unencrypted photos. Unrelated uploads cannot be borrowed. Removing a gallery link does not delete the original media asset. Uploaded photos are accessible by URL before approval; private documents must not be uploaded here.

## Isolation and rollout

The new role has no legacy operational permissions. Generic legacy service-order, ticket and amenity-reservation relationship checks exclude this role while preserving independent real guest/owner/resident relationships. Roles are additive: pre-existing owner/manager/staff roles retain their independent authority. The contributor role alone cannot write canonical content, publish, set prices, read passports, access operations or approve proposals.

The checked-in migrations add the role enum and a role-specific scope constraint, plus one nullable unit marketing-title pointer with no inferred backfill. It must be reviewed and applied through the normal deployment process before enabling the feature. Committing code does not create accounts, send invitations, grant production roles, apply a production migration or publish property content.

Tests use an explicitly isolated local test database. Browser acceptance uses the existing guarded `myuno_browser_test` fixture, never production identities/data. Photo input reachability and prepared gallery operations do not prove Vercel Blob upload transport or invitation email delivery. Those require a separately authorized staging/real-user acceptance check.

Editor/reviewer copy is registered as `needs_review` EN/RU drafts; TH/ZH currently use the existing locale fallback. Role assignment controls have EN/RU/TH/ZH drafts. Portfolio-manager approval is not delegated in this bounded release; active admins review.

## Explicit remaining card coverage

This first slice does not claim full-card completion: videos and public house rules are a separate increment. Sleeping spaces/beds, views/features, project editorial sections, maps/nearby places and rich ProjectAmenity content remain outside this form. Private access instructions and guest communication require their separate operational permissions.
