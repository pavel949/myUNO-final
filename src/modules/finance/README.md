# finance — Оплаты и расчёты

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Cash/transfer records, Opn checkout/webhook/refund adapter, append-only ledger/reversals, manual costs/private receipts, deposits/claims, statements snapshots/sign-off, payouts/remittances/reconciliation.

## Пользовательские поверхности

/ops/costs · /ops/refunds · /owner/statements · /app/admin/statements · /app/admin/payouts.

## Что остаётся

Opn требует merchant configuration и доказательства реального charge/refund. Проверить statements на границах периодов, суммы, повторные выплаты и возвраты. Launch-readiness согласован с PAYMENT_PROVIDER=opn и реальной public/secret key конфигурацией; live charge/refund остаётся отдельной проверкой.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-finance) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
