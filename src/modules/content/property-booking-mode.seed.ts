/** EN/RU copy; other locales use English fallback pending review. */
export const PROPERTY_BOOKING_MODE_KEYS = [
  { key: 'property.booking_mode.title', en: "Assigned booking modes", ru: "Режим бронирования назначенных объектов" },
  { key: 'property.booking_mode.intro', en: "Choose an assigned property. Preview every affected unit before applying a mode change.", ru: "Выберите назначенный объект. Перед сохранением проверьте все затрагиваемые юниты." },
  { key: 'property.booking_mode.empty', en: "No booking-mode rights are assigned.", ru: "Прав на изменение режима бронирования пока нет." },
  { key: 'property.booking_mode.open', en: "Edit booking mode", ru: "Изменить режим бронирования" },
  { key: 'property.booking_mode.back', en: "Assigned booking modes", ru: "Режимы бронирования объектов" },
  { key: 'admin.booking_mode.preview_unit', en: "Preview this unit", ru: "Проверить этот юнит" },
  { key: 'admin.booking_mode.preview_category', en: "Preview category ({count} units)", ru: "Проверить категорию ({count} юнитов)" },
  { key: 'admin.booking_mode.affected', en: "Affected units", ru: "Затрагиваемые юниты" },
  { key: 'admin.booking_mode.confirm', en: "I reviewed every affected unit and the selected booking mode.", ru: "Я проверил все затрагиваемые юниты и выбранный режим бронирования." },
  { key: 'admin.booking_mode.apply', en: "Apply reviewed change", ru: "Применить проверенное изменение" },
  { key: 'admin.booking_mode.blocked', en: "Instant booking cannot be enabled for these units until the administrator completes the required property, pricing and compliance setup:", ru: "Мгновенное бронирование недоступно для этих юнитов, пока администратор не завершит обязательные настройки объекта, тарифов и разрешительных данных:" },
  { key: 'admin.booking_mode.loading', en: "Checking current access and property readiness…", ru: "Проверяем текущие права и готовность объектов…" },
  { key: 'admin.booking_mode.saved_units', en: "Saved for {count} unit(s). Existing bookings and occupancy are unchanged.", ru: "Сохранено для {count} юнитов. Существующие брони и занятость не изменены." },
  { key: 'admin.booking_mode.no_price_change', en: "This change does not change rates, occupancy or existing reservations.", ru: "Это изменение не меняет тарифы, занятость и существующие брони." },
].map(row => ({ ...row, th: row.en, zh: row.en, namespace: 'property', description: 'Scoped booking-mode preview and apply', status: 'needs_review' as const }));
export const PROPERTY_BOOKING_MODE_LABELS = Object.fromEntries(PROPERTY_BOOKING_MODE_KEYS.map(row => [row.key, row.en]));
export const PROPERTY_BOOKING_MODE_DRAFTS = Object.fromEntries(PROPERTY_BOOKING_MODE_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, th: row.th, zh: row.zh }]));
