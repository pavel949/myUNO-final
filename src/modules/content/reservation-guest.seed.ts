const rows = [
  [
    "add",
    "Add a new guest",
    "Добавить нового гостя"
  ],
  [
    "first",
    "First name",
    "Имя"
  ],
  [
    "last",
    "Last name",
    "Фамилия"
  ],
  [
    "email",
    "Email (optional if phone provided)",
    "Email (необязательно при наличии телефона)"
  ],
  [
    "phone",
    "International phone (+country code)",
    "Телефон с кодом страны (+…)"
  ],
  [
    "save",
    "Save guest",
    "Сохранить гостя"
  ],
  [
    "saving",
    "Saving guest…",
    "Сохраняем гостя…"
  ],
  [
    "cancel",
    "Cancel",
    "Отмена"
  ],
  [
    "note",
    "Contact record only. No invitation or login access is created.",
    "Только карточка гостя. Приглашение и доступ ко входу не создаются."
  ],
  [
    "saved",
    "Guest saved and selected for this reservation.",
    "Гость сохранён и выбран для бронирования."
  ],
  [
    "failed",
    "Could not save guest. Your details are preserved.",
    "Не удалось сохранить гостя. Введённые данные сохранены."
  ],
  [
    "created",
    "Reservation created. Open the stay to review its status and payment.",
    "Бронирование создано. Откройте карточку для проверки статуса и оплаты."
  ],
  [
    "open",
    "Open reservation →",
    "Открыть бронирование →"
  ]
] as const;
export const RESERVATION_GUEST_LABELS: Record<string,string> = Object.fromEntries(rows.map(([key,en])=>['reservations.guest_entry.'+key,en]));
export const RESERVATION_GUEST_DRAFTS = Object.fromEntries(rows.map(([key,en,ru])=>['reservations.guest_entry.'+key,{en,ru}]));
export const RESERVATION_GUEST_KEYS = rows.map(([key,en,ru])=>({
  key:'reservations.guest_entry.'+key,namespace:'reservations',description:'Manual reservation guest: '+key,
  en,ru,status:'needs_review' as const,
}));
