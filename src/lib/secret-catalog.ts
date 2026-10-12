/**
 * Every variable the platform needs, in one list: what it is, where it must be
 * set for the system to actually use it, and whether launch depends on it.
 * The admin "Keys" page renders this list; the key register stores values by
 * these names for the founder's reference only — nothing reads them back into
 * the running system (runtime secrets live in Vercel / GitHub).
 */
export type SecretPlace = 'vercel' | 'github' | 'external';
export type SecretGroup = 'core' | 'email_media' | 'automation' | 'payments' | 'auth' | 'channels' | 'accounts';

export interface SecretSpec {
  name: string;
  group: SecretGroup;
  place: SecretPlace;
  /** Launch cannot be safe without it. */
  blocking: boolean;
  /** True if the running app can report whether it is set (process.env). */
  runtime: boolean;
  /** Short plain-language purpose, English default for the content layer. */
  purpose: string;
}

export const SECRET_CATALOG: readonly SecretSpec[] = [
  { name: 'DATABASE_URL', group: 'core', place: 'vercel', blocking: true, runtime: true, purpose: 'Production database connection string.' },
  { name: 'ENCRYPTION_KEY', group: 'core', place: 'vercel', blocking: true, runtime: true, purpose: 'Encrypts passports and private files. Never change once data is stored.' },
  { name: 'SESSION_SECRET', group: 'core', place: 'vercel', blocking: true, runtime: true, purpose: 'Signs sign-in sessions.' },
  { name: 'NEXTAUTH_SECRET', group: 'core', place: 'vercel', blocking: false, runtime: true, purpose: 'Auth library secret.' },
  { name: 'NEXTAUTH_URL', group: 'core', place: 'vercel', blocking: false, runtime: true, purpose: 'Public address used by sign-in callbacks.' },
  { name: 'NEXT_PUBLIC_APP_URL', group: 'core', place: 'vercel', blocking: true, runtime: true, purpose: 'Final public https address of the site.' },
  { name: 'RESEND_API_KEY', group: 'email_media', place: 'vercel', blocking: true, runtime: true, purpose: 'Sends email (confirmations, receipts).' },
  { name: 'EMAIL_FROM', group: 'email_media', place: 'vercel', blocking: true, runtime: true, purpose: 'Sender address on the verified domain.' },
  { name: 'BLOB_READ_WRITE_TOKEN', group: 'email_media', place: 'vercel', blocking: true, runtime: true, purpose: 'Photo and file storage (Vercel Blob).' },
  { name: 'CRON_SECRET', group: 'automation', place: 'vercel', blocking: true, runtime: true, purpose: 'Authorises scheduled jobs. The same value must be a GitHub secret.' },
  { name: 'SCHEDULER_MODE', group: 'automation', place: 'vercel', blocking: true, runtime: true, purpose: 'Set to "external" once the GitHub scheduler is green.' },
  { name: 'APP_BASE_URL', group: 'automation', place: 'github', blocking: true, runtime: false, purpose: 'GitHub repository variable: site address the scheduler calls.' },
  { name: 'VERCEL_AUTOMATION_BYPASS_SECRET', group: 'automation', place: 'github', blocking: false, runtime: false, purpose: 'Only if Vercel deployment protection is on.' },
  { name: 'ALERT_WEBHOOK_URL', group: 'automation', place: 'vercel', blocking: true, runtime: true, purpose: 'Where production error alerts are sent.' },
  { name: 'ICAL_FEED_SECRET', group: 'automation', place: 'vercel', blocking: false, runtime: true, purpose: 'Signs calendar feeds shared with partners.' },
  { name: 'MEDIA_IMPORT_TOKEN', group: 'automation', place: 'vercel', blocking: false, runtime: true, purpose: 'Authorises managed media import.' },
  { name: 'PAYMENT_PROVIDER', group: 'payments', place: 'vercel', blocking: false, runtime: true, purpose: 'Set to "omise" when card payments go live.' },
  { name: 'OMISE_PUBLIC_KEY', group: 'payments', place: 'vercel', blocking: false, runtime: true, purpose: 'Opn/Omise public key.' },
  { name: 'OMISE_SECRET_KEY', group: 'payments', place: 'vercel', blocking: false, runtime: true, purpose: 'Opn/Omise secret key.' },
  { name: 'OMISE_WEBHOOK_SECRET', group: 'payments', place: 'vercel', blocking: false, runtime: true, purpose: 'Verifies Opn/Omise webhooks.' },
  { name: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', group: 'auth', place: 'vercel', blocking: false, runtime: true, purpose: 'Google sign-in client id.' },
  { name: 'GOOGLE_CLIENT_SECRET', group: 'auth', place: 'vercel', blocking: false, runtime: true, purpose: 'Google sign-in client secret.' },
  { name: 'LAYANTARA_WEBHOOK_SECRET', group: 'channels', place: 'vercel', blocking: false, runtime: true, purpose: 'Verifies Layantara channel webhooks.' },
  { name: 'SUPABASE_PROJECT_REF', group: 'accounts', place: 'external', blocking: false, runtime: true, purpose: 'Supabase project reference (burcnghheyzbzffzgmjz).' },
  { name: 'SUPABASE_DB_PASSWORD', group: 'accounts', place: 'external', blocking: false, runtime: false, purpose: 'Database password — for your records and rotation.' },
  { name: 'RESEND_ACCOUNT_LOGIN', group: 'accounts', place: 'external', blocking: false, runtime: false, purpose: 'Resend account login.' },
  { name: 'OMISE_MERCHANT_LOGIN', group: 'accounts', place: 'external', blocking: false, runtime: false, purpose: 'Opn merchant dashboard login.' },
  { name: 'VERCEL_ACCOUNT_LOGIN', group: 'accounts', place: 'external', blocking: false, runtime: false, purpose: 'Vercel account login.' },
  { name: 'GITHUB_ACCOUNT_LOGIN', group: 'accounts', place: 'external', blocking: false, runtime: false, purpose: 'GitHub account login.' },
  { name: 'ENCRYPTION_KEY_OFFLINE_BACKUP', group: 'accounts', place: 'external', blocking: true, runtime: false, purpose: 'Offline copy of ENCRYPTION_KEY. Losing it makes every passport unreadable.' },
];

export const SECRET_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

/** Russian purposes (the founder's working language); English lives on the spec. */
export const SECRET_PURPOSE_RU: Record<string, string> = {
  DATABASE_URL: 'Строка подключения к боевой базе данных.',
  ENCRYPTION_KEY: 'Шифрует паспорта и приватные файлы. После появления данных менять нельзя.',
  SESSION_SECRET: 'Подписывает сессии входа.',
  NEXTAUTH_SECRET: 'Секрет библиотеки авторизации.',
  NEXTAUTH_URL: 'Публичный адрес для возвратов после входа.',
  NEXT_PUBLIC_APP_URL: 'Итоговый публичный https-адрес сайта.',
  RESEND_API_KEY: 'Отправка писем (подтверждения, чеки).',
  EMAIL_FROM: 'Адрес отправителя на подтверждённом домене.',
  BLOB_READ_WRITE_TOKEN: 'Хранилище фото и файлов (Vercel Blob).',
  CRON_SECRET: 'Авторизует фоновые задачи. То же значение должно быть секретом в GitHub.',
  SCHEDULER_MODE: 'Значение «external» — когда планировщик GitHub стал зелёным.',
  APP_BASE_URL: 'Переменная репозитория GitHub: адрес сайта, который вызывает планировщик.',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'Нужен только если включена защита деплоя в Vercel.',
  ALERT_WEBHOOK_URL: 'Куда приходят оповещения о сбоях на проде.',
  ICAL_FEED_SECRET: 'Подписывает календарные ленты для партнёров.',
  MEDIA_IMPORT_TOKEN: 'Разрешает импорт медиа.',
  PAYMENT_PROVIDER: 'Значение «omise», когда включаются карты.',
  OMISE_PUBLIC_KEY: 'Публичный ключ Opn/Omise.',
  OMISE_SECRET_KEY: 'Секретный ключ Opn/Omise.',
  OMISE_WEBHOOK_SECRET: 'Проверяет вебхуки Opn/Omise.',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'Client ID для входа через Google.',
  GOOGLE_CLIENT_SECRET: 'Client secret для входа через Google.',
  LAYANTARA_WEBHOOK_SECRET: 'Проверяет вебхуки канала Layantara.',
  SUPABASE_PROJECT_REF: 'Идентификатор проекта Supabase (burcnghheyzbzffzgmjz).',
  SUPABASE_DB_PASSWORD: 'Пароль базы — для ваших записей и ротации.',
  RESEND_ACCOUNT_LOGIN: 'Логин аккаунта Resend.',
  OMISE_MERCHANT_LOGIN: 'Логин кабинета Opn.',
  VERCEL_ACCOUNT_LOGIN: 'Логин аккаунта Vercel.',
  GITHUB_ACCOUNT_LOGIN: 'Логин аккаунта GitHub.',
  ENCRYPTION_KEY_OFFLINE_BACKUP: 'Офлайн-копия ENCRYPTION_KEY. Потеря = все паспорта нечитаемы.',
};
