# Process 3 — owner statement → both sign-offs → payout → owner sees it

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../../../current/SYSTEM.md) и [реализация / остаток](../../../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Local production build, throw-away database; browser as admin and owner.

| Step | Result |
|---|---|
| Generate Oct 2026 statement for Villa A | PASS (gross ฿360, owner share ฿316.80) |
| Generate over a period that cuts through a stay | PASS — refused, reason shown to the operator ("A stay crosses this accounting period…") |
| Operator sign-off, then owner sign-off | PASS → `signed_off` |
| Admin records the payout (bank reference) | PASS — `payout_owner −31,680` in the ledger |
| Owner sees amount, date, method, bank reference | PASS |
| Owner screens show satang | FIXED: showed ฿317 while admin/bank showed ฿316.80 (`formatBahtExact`, `MoneyAmount exact`) |

Not covered: second payout against the same statement (covered by finance integration tests), provider (cleaner) payouts via remittance.
