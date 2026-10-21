const rows = [
  ['title', 'Account management', 'Управление аккаунтами'],
  ['manageAccount', 'Manage account', 'Редактировать аккаунт'],
  ['save', 'Save', 'Сохранить'], ['saved', 'Saved', 'Сохранено'],
  ['failed', 'The change could not be saved', 'Не удалось сохранить изменения'],
  ['firstName', 'First name', 'Имя'], ['lastName', 'Last name', 'Фамилия'],
  ['displayName', 'Name in this workspace', 'Имя в рабочем пространстве'], ['language', 'Language', 'Язык'],
  ['active', 'Active', 'Доступ открыт'], ['disabled', 'Disabled', 'Доступ отключён'],
  ['disable', 'Disable access', 'Отключить доступ'], ['enable', 'Restore access', 'Восстановить доступ'],
  ['confirmDisable', 'Disable this person’s access?', 'Отключить доступ этого пользователя?'],
  ['localHint', 'Changes apply to this workspace. Profile and access in other workspaces remain independent.',
    'Изменения относятся к этому рабочему пространству. Профиль и доступ в других пространствах настраиваются отдельно.'],
  ['globalHint', 'These changes apply to the account across myUNO. Disabling the account ends its current sessions.',
    'Изменения относятся ко всему аккаунту myUNO. При отключении аккаунта его текущие сессии завершаются.'],
  ['more', 'Next page', 'Следующая страница'], ['back', 'Back', 'Назад'],
  ['languageEn', 'English', 'English'], ['languageRu', 'Русский', 'Русский'],
  ['languageTh', 'ไทย', 'ไทย'], ['languageZh', '中文', '中文'],
] as const;
export const ADMINISTRATION_DEFAULTS = Object.fromEntries(rows.map(([key, en]) => ['administration.' + key, en]));
export const ADMINISTRATION_DRAFTS = Object.fromEntries(rows.map(([key, en, ru]) => ['administration.' + key, { en, ru }]));
export const ADMINISTRATION_KEYS = rows.map(([key, en, ru]) => ({ key: 'administration.' + key, namespace: 'admin',
  description: 'Bounded account management: ' + key, en, ru, status: 'needs_review' as const }));
