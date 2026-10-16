# Оплаты, расходы и отчёт владельцу

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. Убедиться в правильной booking/order, валюте THB, сумме и источнике. UI показывает baht, core использует integer satang.
2. Cash/transfer: подтвердить фактическое получение, записать получателя/receipt/reference через штатный экран. Transfer instructions не являются подтверждением банка.
3. Card provider используется только при реально настроенном Opn и доступном method. Mock запрещён в production. Success/charge/refund проверяет provider adapter, не browser return сам по себе.
4. /ops/costs: выбрать разрешённый объект, expense type, business date, amount, описание и idempotency; receipt приватный. Ошибку исправить штатным reversal, не delete ledger row.
5. /app/admin/statements: сформировать snapshot, сверить sources/receivables/ownership и sign-off. Owner читает /owner/statements после разрешённого статуса; устаревший draft пересоздать.
6. /app/admin/payouts и reconciliation: подтвердить право и сумму; отметить фактически исполненный перевод. Запись payout не выполняет банк автоматически.
7. Refund: инициировать штатным действием и подтвердить реальное исполнение; failed/unknown provider result требует reconciliation. Не повторять бесконечно новый refund.
8. Damage/deposit claim — по configured policy/approved provider flow; не обещать работающий preauth без проверки merchant capability. Сроки payout/refund брать из действующих terms/provider, не из старой SOP.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
