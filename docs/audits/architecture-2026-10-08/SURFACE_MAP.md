# Surface / architecture crosswalk

| Audience/job | Primary routes | Application/domain seam | Scope | Detailed evidence | Runtime here |
|---|---|---|---|---|---|
| Public discover | /,/areas,/projects,/search,/units/[id] | home/publicdiscovery/projects,searchquote,booking | published project/unit; destination missing | ../../architecture-funnel-audit.md and architecture-destination-audit.md | service/areas/project read-only checked; not whole funnel |
| Guest booking/stay | /book/review,/checkout/[sessionId],/trips,/bookings/[id]/home-space | Booking,Payment,HomeSpace | session guest + canonical physical unit | ../../architecture-operations-audit.md | no commit/payment created |
| Marketplace | /services,/services/[id],/services/orders | Service/ServiceProject/ServiceOrder,fulfillment,payout | project/stay validated; standalone gap | ../../architecture-funnel-audit.md | service detail visually checked; no order created |
| Operations | /ops,/ops/reservations,/ops/stays,/ops/tasks,/ops/spaces | booking/task/space command services | role/department/MC/space capabilities; inconsistent paths | ../../architecture-operations-audit.md | auth wall |
| Owner/manager | /owner/**,/mc/** | ownership/engagement,finance derived views | identity+unit/project/org/mandate | ../../architecture-security-platform-audit.md | auth wall |
| Provider | /provider/** | provider queue,serviceorder,remittance | provider identity | ../../architecture-operations-audit.md | auth wall |
| Controlplane | /app/admin/**,/admin/finance/reconciliation | CRM/config/content/assets/finance/integrations | admin or scoped action | ../../architecture-security-platform-audit.md | auth wall |

Full staticroute/source list in INVENTORY.json. Navigation/mobile/state evidence in ../../stitch-fidelity-audit.md and earlier public/PMS reports. This focused architecturecrosswalk is not an assertion that every screen/API was clicked.
