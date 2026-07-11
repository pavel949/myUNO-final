# legacy — the parts bin (reference only)

The founder's existing repositories are attached to the workspace as **sibling folders** and referenced in place rather than copied here, to keep this repository clean:

- `../My-Airbnb-Clone-Copy` — full-stack Airbnb clone (“StayFinder”); the richest source of booking/payment/messaging patterns.
- `../condo` — clone of open-condo-software/condo; production-grade property-management reference (roles, tickets, announcements, payment splitting).
- `../phuket-flea-market-e90916d2` — “SALA” flea-market SPA; feed UX + EN/RU/TH i18n seed.
- `../airbnb-price-optimizer-rio` — ML pricing pipeline; phase-2 dynamic-pricing reference.
- `../MyCommand-center` — Android founder cockpit; KPI-taxonomy inspiration only.
- `../geo-seo-claude` — third-party GEO/SEO toolkit; external tooling for the public pages.
- `../myUNO-PMS-OS` — empty stub.
- `../awesome-system-design-resources` — third-party study material.

**A parts bin, not a foundation, and not the look.** Every reusable piece has a take / don't-take / finish decision in `../docs/00_legacy_audit.md`. The platform is built fresh around **project → unit → identity → roles**; the visual language is single and new. Never wire the new app to legacy architecture; never run legacy code as part of the new system.
