# Surface map and coverage limits

INVENTORY.json records 174 pages, 248 handlers (245 API), 21 modules, 556 test files, 118 models, 94 migrations and zero static route collisions. Discovery is not reachability or acceptance.

| Audience | Candidate surface | Current assessment |
|---|---|---|
| Public | /, /search, /projects, /units/[id] | Source/inventory only; live search, image, price parity and mobile not checked |
| Guest | /trips, /checkout/[sessionId], /bookings/[bookingId]/home-space | Live booking, funding and access-release flow not checked |
| Owner | /owner | Live ownership isolation, statements and approvals not checked |
| Manager/frontline | /mc, /ops, /property | Live delegated actions and check-in/turnover not checked |
| Provider | /provider, /services/orders | Live assignment, completion, dispute and settlement not checked |
| Admin | /app/admin | Live controls, errors and reporting not checked |
| Health | /api/health | Source performs SELECT 1; protected connector request denied 403 |

Every discovered route is in INVENTORY.json. No claim is made that every route's navigation, writers, permissions, empty/error states, translations or responsive behavior was individually inspected. Detailed runtime surface acceptance remains outstanding.
