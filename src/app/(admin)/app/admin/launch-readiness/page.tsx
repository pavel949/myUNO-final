import { PageHeading } from '@/components/premium/StitchPage';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { collectLaunchReadiness, type ReadinessGroup } from '@/lib/launch-readiness';
import { listVaultEntries } from '@/modules/config';
import { SECRET_CATALOG, SECRET_PURPOSE_RU } from '@/lib/secret-catalog';
import { getRequestLocale } from '@/lib/i18n';
import KeysRegister, { type KeyRow } from './keys-register';

export const dynamic = 'force-dynamic';

const GROUPS: ReadinessGroup[] = ['security', 'delivery', 'automation', 'payments', 'catalogue'];

/**
 * Launch readiness: the single list of what only the founder can supply
 * (keys, accounts, decisions, data). Each row is a fact read from the running
 * system; nothing is ticked on trust.
 */
export default async function LaunchReadinessPage() {
  const { items, blockingOpen } = await collectLaunchReadiness(prisma);
  const vault = await listVaultEntries(prisma);
  const locale = getRequestLocale();

  const labels = await getLabels({
    'admin.launch.title': 'Launch readiness',
    'admin.launch.subtitle': 'What the platform still needs from you before real guests and real money. The code side is done; these rows are keys, accounts and data.',
    'admin.launch.headline.ready': 'Nothing blocks launch.',
    'admin.launch.headline.blocked': 'Blocking launch: {count}',
    'admin.launch.state.ok': 'Ready',
    'admin.launch.state.action': 'Needs you',
    'admin.launch.badge.blocking': 'Blocks launch',
    'admin.launch.badge.optional': 'Optional',
    'admin.launch.fix': 'What to do',
    'admin.launch.group.security': 'Security and sign-in',
    'admin.launch.group.delivery': 'Email and media',
    'admin.launch.group.automation': 'Automation and alerts',
    'admin.launch.group.payments': 'Payments',
    'admin.launch.group.catalogue': 'Catalogue',
    'admin.launch.item.encryption_key.title': 'Passport encryption key',
    'admin.launch.item.encryption_key.fix': 'Set ENCRYPTION_KEY in Vercel. Never change it once guest passports are stored.',
    'admin.launch.item.session_secret.title': 'Session secret',
    'admin.launch.item.session_secret.fix': 'Set SESSION_SECRET in Vercel (a long random string).',
    'admin.launch.item.app_url.title': 'Public site address',
    'admin.launch.item.app_url.fix': 'Set NEXT_PUBLIC_APP_URL in Vercel to the final https address.',
    'admin.launch.item.email.title': 'Email sending',
    'admin.launch.item.email.fix': 'Set RESEND_API_KEY and EMAIL_FROM in Vercel and verify the sending domain in Resend.',
    'admin.launch.item.media_storage.title': 'Photo storage',
    'admin.launch.item.media_storage.fix': 'Set BLOB_READ_WRITE_TOKEN in Vercel (Storage → Blob).',
    'admin.launch.item.cron_secret.title': 'Scheduler secret',
    'admin.launch.item.cron_secret.fix': 'Set CRON_SECRET in Vercel, and the same value as the GitHub secret CRON_SECRET.',
    'admin.launch.item.scheduler_mode.title': 'Scheduler mode',
    'admin.launch.item.scheduler_mode.fix': 'In GitHub add variable APP_BASE_URL (the site address) and secret CRON_SECRET, check the Scheduler workflow runs green, then set SCHEDULER_MODE=external in Vercel.',
    'admin.launch.item.alert_webhook.title': 'Error alerts',
    'admin.launch.item.alert_webhook.fix': 'Create a Slack or Telegram-bridge incoming webhook and set ALERT_WEBHOOK_URL in Vercel.',
    'admin.launch.item.ical_secret.title': 'Calendar feed secret',
    'admin.launch.item.ical_secret.fix': 'Set ICAL_FEED_SECRET in Vercel before sharing calendar feeds with partners.',
    'admin.launch.item.card_payments.title': 'Card payments',
    'admin.launch.item.card_payments.fix': 'After the Opn/Omise merchant account is approved, set PAYMENT_PROVIDER=omise and the three OMISE keys. Cash and bank transfer work without it.',
    'admin.launch.item.google_signin.title': 'Google sign-in',
    'admin.launch.item.google_signin.fix': 'Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Email sign-in works without it.',
    'admin.launch.item.scheduler_running.title': 'Background jobs are running',
    'admin.launch.item.scheduler_running.fix': 'Jobs are not firing on the 5-minute cadence. Fix the two scheduler rows above, then check the Scheduler page.',
    'admin.launch.item.bank_details.title': 'Bank transfer details',
    'admin.launch.item.bank_details.fix': 'Fill merchant legal name and bank account in Configuration (merchant.*).',
    'admin.launch.item.live_units.title': 'Published homes',
    'admin.launch.item.live_units.fix': 'Publish at least one home with a cover and three photos.',
    'admin.launch.item.permitted_use.title': 'Permitted-use confirmation',
    'admin.keys.title': 'Keys register',
    'admin.keys.disclaimer': 'Your private register of every key and account the platform needs. Values are encrypted and shown only on request (every reveal is logged). Nothing here is read by the running system: to make a key work, it must also be set in Vercel or GitHub, where indicated.',
    'admin.keys.place.vercel': 'Set in Vercel',
    'admin.keys.place.github': 'Set in GitHub',
    'admin.keys.place.external': 'Your records',
    'admin.keys.blocking': 'Required for launch',
    'admin.keys.runtime_set': 'Set in the system',
    'admin.keys.runtime_missing': 'Missing in the system',
    'admin.keys.value': 'value',
    'admin.keys.placeholder': 'Paste value',
    'admin.keys.save': 'Save',
    'admin.keys.reveal': 'Show for 15 s',
    'admin.keys.clear': 'Delete value',
    'admin.keys.saved': 'Saved.',
    'admin.keys.error': 'Could not complete that.',
    'admin.keys.custom_name': 'Another key name',
    'admin.keys.add_custom': 'Add key',
    'admin.keys.custom_purpose': 'Custom entry.',
    'admin.keys.group.core': 'Core',
    'admin.keys.group.email_media': 'Email and media',
    'admin.keys.group.automation': 'Automation and alerts',
    'admin.keys.group.payments': 'Payments',
    'admin.keys.group.auth': 'Sign-in',
    'admin.keys.group.channels': 'Channels',
    'admin.keys.group.accounts': 'Accounts and backups',
    'admin.keys.group.custom': 'Other',
    'admin.launch.item.permitted_use.fix': 'Some live homes lack permitted-use confirmation. Confirm each, or record a founder exception.',
  });

  const vaultByName = new Map(vault.map((v) => [v.name, v]));
  const catalogNames = new Set(SECRET_CATALOG.map((c) => c.name));
  const keyLabel = (k: string) => (labels as Record<string, string>)[`admin.keys.${k}`] ?? k;
  const keyRows: KeyRow[] = [
    ...SECRET_CATALOG.map((c) => ({
      name: c.name,
      purpose: locale === 'ru' ? SECRET_PURPOSE_RU[c.name] ?? c.purpose : c.purpose,
      place: c.place,
      groupLabel: keyLabel(`group.${c.group}`),
      blocking: c.blocking,
      runtimeSet: c.runtime ? Boolean(process.env[c.name]?.trim()) : null,
      hasValue: vaultByName.get(c.name)?.hasValue ?? false,
      last4: vaultByName.get(c.name)?.last4 ?? null,
      notes: vaultByName.get(c.name)?.notes ?? '',
    })),
    ...vault
      .filter((v) => !catalogNames.has(v.name))
      .map((v) => ({
        name: v.name,
        purpose: keyLabel('custom_purpose'),
        place: 'external',
        groupLabel: keyLabel('group.custom'),
        blocking: false,
        runtimeSet: null,
        hasValue: v.hasValue,
        last4: v.last4,
        notes: v.notes ?? '',
      })),
  ];
  const keysLabels = Object.fromEntries(
    [
      'disclaimer', 'blocking', 'runtime_set', 'runtime_missing', 'value', 'placeholder', 'save', 'reveal', 'clear',
      'saved', 'error', 'custom_name', 'add_custom', 'custom_purpose',
    ].map((k) => [k, keyLabel(k)])
  );
  for (const p of ['vercel', 'github', 'external']) keysLabels[`place_${p}`] = keyLabel(`place.${p}`);
  keysLabels.group_custom = keyLabel('group.custom');

  const t = (key: string) => (labels as Record<string, string>)[key] ?? key;
  const headline =
    blockingOpen === 0 ? t('admin.launch.headline.ready') : t('admin.launch.headline.blocked').replace('{count}', String(blockingOpen));

  return (
    <div>
      <PageHeading title={t('admin.launch.title')} subtitle={t('admin.launch.subtitle')} />
      <p className={`text-body font-semibold mb-24 ${blockingOpen === 0 ? 'text-state-success' : 'text-state-error'}`}>{headline}</p>
      {GROUPS.map((group) => {
        const rows = items.filter((i) => i.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group} className="mb-32">
            <h2 className="font-sans text-subtitle font-semibold text-text-ink mb-12">{t(`admin.launch.group.${group}`)}</h2>
            <ul className="divide-y divide-border-line rounded-lg border border-border-line bg-surface-paper">
              {rows.map((row) => (
                <li key={row.id} className="p-16">
                  <div className="flex flex-wrap items-center gap-8">
                    <span
                      className={`px-8 py-4 rounded-sm text-small font-semibold ${
                        row.state === 'ok' ? 'bg-state-success-soft text-state-success' : 'bg-state-error-soft text-state-error'
                      }`}
                    >
                      {t(`admin.launch.state.${row.state}`)}
                    </span>
                    <span className="font-semibold text-text-ink">{t(`admin.launch.item.${row.id}.title`)}</span>
                    {row.detail ? <span className="text-small text-text-secondary">· {row.detail}</span> : null}
                    <span className="text-small text-text-secondary">
                      {row.blocking ? t('admin.launch.badge.blocking') : t('admin.launch.badge.optional')}
                    </span>
                  </div>
                  {row.state === 'action' ? (
                    <p className="mt-8 text-small text-text-secondary">
                      <span className="font-semibold">{t('admin.launch.fix')}: </span>
                      {t(`admin.launch.item.${row.id}.fix`)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <h2 className="mb-12 mt-48 font-sans text-title font-semibold text-text-ink">{keyLabel('title')}</h2>
      <KeysRegister rows={keyRows} labels={keysLabels} />
    </div>
  );
}
