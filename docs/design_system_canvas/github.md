repo: pavel949/myUNO-final
branch: claude/project-repo-clarification-bavpp0
path: src/, docs/06_design_system.md, prisma/schema.prisma, tailwind.config.ts

## Last sync
date: 2026-09-05T00:45:00Z

### Updated in this project
- Recreated the myUNO design system from doc 06 tokens and `src/components/` — foundations, primitives, data surfaces, app shell.
- Recreated the public, guest, owner, ops, CRM, admin, provider, MC and juristic screens on one pannable canvas.
- Added new work: the property modal (desktop + mobile), review-and-pay unhappy states, TM30 queue, payouts approval, content editor, onboarding screens.
- Drew nine end-to-end flows plus the data model, status state machines and route map.

## Screen map
| Screen / board | Built from |
| --- | --- |
| 01 Foundations | docs/06_design_system.md, tailwind.config.ts, src/app/globals.css |
| 02 Component library | src/components/{Button,Input,Chip,Badge,Avatar,StateComponents,StatTile,MoneyAmount,SlaCountdown}.tsx |
| 03 App shell & menus | src/app/layout.tsx, src/components/Navbar.tsx, src/components/Footer.tsx, src/app/(admin)/app/admin/layout.tsx |
| 04 Public surface | src/app/(public)/page.tsx, src/app/search/search-results.tsx, src/components/SearchBar.tsx |
| 05 Property modal | src/app/units/[id]/ (S4 spec in docs/06 §4), doc 06 §3.3 BookingWidget |
| 06 Stay / guest | src/app/bookings/[bookingId]/home-space/client.tsx, src/components/instay/*, src/app/checkout/[sessionId]/ |
| 07 Owners | src/app/owner/client.tsx, src/app/owner/statements/[statementId]/page.tsx, src/components/owner/* |
| 08 Buy & juristic | src/app/buying/page.tsx, src/app/juristic/page.tsx |
| 09 Operations | src/app/ops/ops-client.tsx, src/app/ops/tm30/, src/app/ops/claims/, src/app/ops/costs/ |
| 10 CRM | src/app/components/crm/{CrmDashboard,OpportunitiesKanban,OpportunityDetail}.tsx |
| 11 Admin | src/app/(admin)/app/admin/page.tsx + layout.tsx, src/app/api/admin/* |
| 12 Provider & MC | src/app/provider/page.tsx, src/app/provider/provider-orders-client.tsx, src/app/mc/page.tsx |
| 13 Flows | docs/07_flows.md references in code comments (F-GUEST, F-OWN, F-SVC, F-BUY, F-COM) |
| 14 Onboarding | src/app/auth/claim/, src/app/provider/apply/, prisma ManagementContract |
| 15 Schemas | prisma/schema.prisma (76 models, status enums), src/app/ route tree |
