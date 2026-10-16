# Бронирование и проживание

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. Гость выбирает даты/состав, открывает /search и карточку /units/[id] или категории проекта. Проверить финальный quote; quote не является hold.
2. /book/review фиксирует exact-unit/category selection и accepted terms. Request требует ответа в /ops/requests; instant создаёт pending payment по разрешённому режиму.
3. Оплата — доступным реальным способом. Сотрудник регистрирует cash/transfer только после факта получения; provider confirmation идёт по проверенным данным. До оплаты не обещать confirmed автоматически.
4. Гость видит /trips/[id], Home Space и pre-arrival инструкции. Паспортные данные — только через защищённую форму; не отправлять их в общий чат.
5. В /ops/stays/[bookingId]/check-in проверить booking/readiness/checklist и отметить заезд. TM30 — отдельная очередь /ops/tm30 с доказательством фактической подачи.
6. Extension/date change проходит server recalculation/conflict checks; новый replacement-hold reschedule пока в backlog.
7. Checkout создаёт/связывает turnover tasks; завершить уборку/inspection и устранить blockers. Отмена/возврат — через booking/finance actions, не ручное переписывание ledger.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
