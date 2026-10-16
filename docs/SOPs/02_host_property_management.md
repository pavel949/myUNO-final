# Объекты и управление

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. Проверить полномочия: owner/MC/staff role и project/unit/operating-space scope. Пользователь видит только разрешённые workspace/actions.
2. /property/onboard или /property/create сохраняет draft. /property/listings и admin unit/project дают редакторы; контент сотрудника может требовать /app/admin/property-content-proposals review.
3. Заполнить факты, owner/responsibility, спальни, фото, rates/offering и regulatory evidence. Инфраструктура комплекса редактируется отдельно и отображается связанным квартирам.
4. /property/pricing и /property/booking-mode требуют отдельных делегированных capability. Изменение тарифа не переписывает принятую booking snapshot.
5. Проверить readiness и причины запрета. Submit/review/convert не равны go-live; нельзя обходить activation gate.
6. /ops/calendar и /mc/calendar — проекции canonical bookings/blocks; блокировать даты через штатное действие, не создавать теневой календарь.
7. /owner и /mc/portfolio показывают доступный портфель, брони, compliance и деньги. Подписанный statement не переписывается новым owner/contract configuration.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
