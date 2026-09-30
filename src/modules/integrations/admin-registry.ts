import type { IntegrationKey, PrismaClient } from '@prisma/client';
import { getDecryptedConfig, registerIntegrationAccount } from './integrations';

export type IntegrationField = {
  key: string;
  label: string;
  secret?: boolean;
  env?: string;
  placeholder?: string;
};

export type IntegrationDefinition = {
  key: IntegrationKey;
  title: string;
  description: string;
  fields: IntegrationField[];
};

export const LIVE_INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: 'google_places',
    title: 'Google Places',
    description: 'Project/complex autocomplete, addresses and map coordinates.',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, env: 'GOOGLE_PLACES_API_KEY' },
    ],
  },
  {
    key: 'map_tiles',
    title: 'Map tiles & style',
    description: 'Renderer/provider settings for the public Phuket map.',
    fields: [
      { key: 'provider', label: 'Provider', env: 'NEXT_PUBLIC_MAP_PROVIDER', placeholder: 'maplibre' },
      { key: 'styleUrl', label: 'Style URL', env: 'NEXT_PUBLIC_MAP_STYLE_URL' },
    ],
  },
  {
    key: 'email_resend',
    title: 'Resend email',
    description: 'Transactional email delivery.',
    fields: [
      { key: 'apiKey', label: 'API key', secret: true, env: 'RESEND_API_KEY' },
      { key: 'from', label: 'From address', env: 'EMAIL_FROM', placeholder: 'hello@myuno.app' },
    ],
  },
  {
    key: 'google_oauth',
    title: 'Google OAuth',
    description: 'Google sign-in credentials.',
    fields: [
      { key: 'clientId', label: 'Client ID', env: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID' },
      { key: 'clientSecret', label: 'Client secret', secret: true, env: 'GOOGLE_CLIENT_SECRET' },
    ],
  },
  {
    key: 'whatsapp',
    title: 'WhatsApp',
    description: 'Messaging provider credentials when enabled.',
    fields: [
      { key: 'accessToken', label: 'Access token', secret: true },
      { key: 'phoneNumberId', label: 'Phone number ID' },
    ],
  },
  {
    key: 'telegram',
    title: 'Telegram',
    description: 'Telegram bot integration credentials.',
    fields: [
      { key: 'botToken', label: 'Bot token', secret: true },
      { key: 'chatId', label: 'Default chat ID' },
    ],
  },
  {
    key: 'crm_hubspot',
    title: 'HubSpot CRM',
    description: 'HubSpot private app credentials.',
    fields: [
      { key: 'accessToken', label: 'Private app access token', secret: true },
    ],
  },
  {
    key: 'ops_alerting',
    title: 'Ops alerting',
    description: 'Slack/Discord/PagerDuty-compatible incoming webhook.',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', secret: true, env: 'ALERT_WEBHOOK_URL' },
    ],
  },
];

export const BOOTSTRAP_VARIABLES = [
  { group: 'Database', env: 'DATABASE_URL', description: 'Production PostgreSQL connection.' },
  { group: 'Database', env: 'DATABASE_URL_TEST', description: 'Dedicated test database.' },
  { group: 'Database', env: 'DATABASE_POOLER_HOST', description: 'Optional Supabase pooler override.' },
  { group: 'Security', env: 'ENCRYPTION_KEY', description: 'Root AES-256-GCM key. Never store inside the database vault.' },
  { group: 'Security', env: 'SESSION_SECRET', description: 'Session-cookie signing secret.' },
  { group: 'Security', env: 'NEXTAUTH_SECRET', description: 'Fallback auth secret.' },
  { group: 'Security', env: 'ICAL_FEED_SECRET', description: 'Signs private iCal feed URLs.' },
  { group: 'Scheduler', env: 'CRON_SECRET', description: 'Protects scheduled-job endpoints.' },
  { group: 'Scheduler', env: 'SCHEDULER_MODE', description: 'Scheduler source/cadence mode.' },
  { group: 'Payments', env: 'PAYMENT_PROVIDER', description: 'Active payment rail.' },
  { group: 'Payments', env: 'OMISE_PUBLIC_KEY', description: 'Opn/Omise public key.' },
  { group: 'Payments', env: 'OMISE_SECRET_KEY', description: 'Opn/Omise secret key.' },
  { group: 'Payments', env: 'OMISE_WEBHOOK_SECRET', description: 'Opn webhook verification secret.' },
  { group: 'Storage', env: 'BLOB_READ_WRITE_TOKEN', description: 'Media object-storage token.' },
  { group: 'App', env: 'NEXT_PUBLIC_APP_URL', description: 'Canonical deployed application URL.' },
  { group: 'App', env: 'NEXTAUTH_URL', description: 'Auth callback/base URL.' },
  { group: 'App', env: 'CONTENT_REVIEW_GATE_ENABLED', description: 'Content review deployment gate.' },
  { group: 'Backups', env: 'BACKUP_DATABASE_URL', description: 'GitHub Actions backup-reader connection.' },
  { group: 'Backups', env: 'BACKUP_PASSPHRASE', description: 'GitHub Actions backup encryption passphrase.' },
] as const;

export async function getPlatformIntegrationConfig(
  db: PrismaClient,
  key: IntegrationKey
): Promise<Record<string, unknown>> {
  const account = await db.integrationAccount.findFirst({
    where: { integrationKey: key, scopeType: 'platform' },
    orderBy: { updatedAt: 'desc' },
  });
  return account ? getDecryptedConfig(account) : {};
}

export async function savePlatformIntegrationConfig(
  db: PrismaClient,
  key: IntegrationKey,
  config: Record<string, unknown>
) {
  return registerIntegrationAccount(db, key, 'platform', config);
}

export async function resolveIntegrationValue(
  db: PrismaClient,
  integrationKey: IntegrationKey,
  field: string,
  envName?: string
): Promise<string | undefined> {
  const config = await getPlatformIntegrationConfig(db, integrationKey);
  const value = config[field];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (envName) {
    const env = process.env[envName];
    if (typeof env === 'string' && env.trim()) return env.trim();
  }
  return undefined;
}
