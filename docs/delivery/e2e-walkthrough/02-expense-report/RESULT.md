# Process 2 — expense → private receipt → owner report → owner sign-off

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../../../current/SYSTEM.md) и [реализация / остаток](../../../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Local production build, throw-away database. Clicked in a real browser as: ops staff, admin, owner; plus guest/anonymous for access checks.

| Step | Result |
|---|---|
| Staff open "Record a cost", fill unit/type/date/amount/note, attach receipt | PASS |
| Cost saved and listed with "View receipt" | PASS |
| Admin generates Sept 2026 report for Villa A | PASS — includes the cost (expenses ฿1,285.50) |
| Operator sign-off → report goes to owner review | PASS |
| Owner sees the report, opens expense source line, sees receipt link | PASS |
| Receipt: owner 200 image (private, no-store); another user 404; anonymous 401 | PASS |
| Owner signs off → "Approved" | PASS |

Not covered: payout of a positive balance (process 3).
