# Заказ услуги

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. /services → /services/[id]: проверить активного vetted provider, цену/terms и допустимый context. Standalone order требует реальный area/address/responsible organization, а не фиктивный project.
2. Создать заказ через форму с согласованными датами/quantity/context; server вычисляет total и snapshot.
3. Выполнить разрешённую оплату. Текущий acceptServiceOrder требует paid; provider принимает/отклоняет в /provider, гость отслеживает /services/orders/[orderId].
4. После фактического исполнения provider отмечает fulfilled; сервис проверяет оплату и атомарно пишет commission/fulfillment.
5. Decline/cancel/no-show запускают предусмотренный refund/ticket path; окончание заказа не считать банковским возвратом до факта settlement.
6. Отзыв — штатным действием после eligibility. Payout/remittance — отдельный финансовый процесс.
7. Quote-mode request/version acceptance и полный confirm/dispute/auto-close lifecycle ещё не подтверждены рабочим runtime; не обучать сотрудников несуществующим кнопкам.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
