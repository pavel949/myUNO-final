# Public funnel analytics mapping

Date: 2026-10-05

The homepage strategy names business funnel concepts. myUNO analytics keeps one canonical event per real transition rather than duplicating aliases.

| Strategy concept | Canonical event | Authority |
| --- | --- | --- |
| landing viewed | `page_landing_viewed` | server page render |
| intent selected | `intent_selected` | whitelisted public interaction |
| search submitted | `search_submitted` | whitelisted public interaction |
| search completed | `search_completed` / `search_zero_results` / `search_failed` | server search |
| result opened | `result_opened` | whitelisted public interaction |
| project opened | `project_opened` | server project page |
| unit opened | `unit_opened` | server unit/commercial-home page |
| service opened | `service_opened` | server service page |
| quote outcome | `quote_succeeded` / `quote_failed` | canonical pricing engine endpoint |
| lead started | `lead_started` | whitelisted form interaction, no PII |
| lead submitted | `lead_submitted` | server lead creation |
| owner lead submitted | `lead_submitted` with owner audience | server lead creation; no duplicate alias |
| booking started | `stay_booking_started` | server booking flow |
| booking confirmed | `stay_confirmed` | canonical booking/payment transition |
| service order started | `service_order_placed` | canonical service-order transition |
| service order confirmed | state-specific `service_order_paid` / `service_order_accepted` | no ambiguous generic alias |
| service order fulfilled | `service_order_fulfilled` | canonical fulfilment transition |
| login started | `login_started` | server login endpoint, no email in dimensions |
| login success | `login_success` | server login endpoint with identityId |

## Public event boundary

`/api/analytics/public` accepts only low-risk interaction events:
`intent_selected`, `search_submitted`, `result_opened`, `owner_goal_selected`, `lead_started`.

It must reject business outcomes such as booking confirmation, quote success, lead submission, payments, login success and service-order transitions. Those are emitted only by the server transition that actually owns the state.
