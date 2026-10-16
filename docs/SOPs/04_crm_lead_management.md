# Лиды и CRM

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. Public lead поступает в /api/leads и связывается с Identity/CRM profile/opportunity по текущему contract. Не создавать параллельную базу гостей/владельцев.
2. /app/admin/crm: проверить источник, consent, scope, opportunity type и следующий шаг. Перевести stage штатным действием, записать activity.
3. /app/admin/crm/opportunities/[id] и /deal: уточнить объект/стороны/terms, приложить разрешённые приватные evidence, выполнить допустимый переход.
4. Выигранная opportunity сама по себе не доказывает оплату, legal transfer, booking или management authority. Проверить downstream handover отдельно.
5. Учитывать opt-out и consent purpose. Внешнюю WhatsApp/Telegram коммуникацию фиксировать как activity; автоматическая provider send в main не реализована.
6. Проверить показатели до выводов: допустимый scope, период, denominator, источник money и pagination.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
