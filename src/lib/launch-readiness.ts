import type { PrismaClient } from '@prisma/client';
import { getSchedulerHealth, jobsNeedingAttention } from '@/jobs';
import { getConfig } from '@/modules/config';

/**
 * Launch readiness: what the platform still needs from its owner before it can
 * run real guests, money and mail. Everything here is a *fact read from the
 * running system* (environment presence, job history, catalogue counts) — never
 * a guess. A value is reported as present or absent; its content is never
 * returned, so this is safe to render on an admin page.
 *
 * `blocking` items stop a safe launch; the rest degrade a capability (card
 * payments, Google sign-in) that cash / bank transfer does not depend on.
 */

export type ReadinessGroup = 'security' | 'delivery' | 'automation' | 'payments' | 'catalogue';
export type ReadinessState = 'ok' | 'action';

export interface ReadinessItem {
  id: string;
  group: ReadinessGroup;
  state: ReadinessState;
  blocking: boolean;
  /** Free-form, non-secret fact (a count) shown beside the item. */
  detail?: string;
}

export interface ReadinessEnv {
  [key: string]: string | undefined;
}

const present = (env: ReadinessEnv, key: string) => Boolean(env[key] && env[key]!.trim().length > 0);

/** Pure part: everything decidable from environment variables alone. */
export function evaluateEnvReadiness(env: ReadinessEnv): ReadinessItem[] {
  const item = (id: string, group: ReadinessGroup, ok: boolean, blocking: boolean): ReadinessItem => ({
    id,
    group,
    state: ok ? 'ok' : 'action',
    blocking,
  });

  const cardReady =
    env.PAYMENT_PROVIDER === 'omise' &&
    present(env, 'OMISE_PUBLIC_KEY') &&
    present(env, 'OMISE_SECRET_KEY') &&
    present(env, 'OMISE_WEBHOOK_SECRET');

  return [
    item('encryption_key', 'security', present(env, 'ENCRYPTION_KEY'), true),
    item('session_secret', 'security', present(env, 'SESSION_SECRET'), true),
    item('app_url', 'security', present(env, 'NEXT_PUBLIC_APP_URL'), true),
    item('email', 'delivery', present(env, 'RESEND_API_KEY') && present(env, 'EMAIL_FROM'), true),
    item('media_storage', 'delivery', present(env, 'BLOB_READ_WRITE_TOKEN'), true),
    item('cron_secret', 'automation', present(env, 'CRON_SECRET'), true),
    item('scheduler_mode', 'automation', env.SCHEDULER_MODE === 'external', true),
    item('alert_webhook', 'automation', present(env, 'ALERT_WEBHOOK_URL'), true),
    item('ical_secret', 'automation', present(env, 'ICAL_FEED_SECRET'), false),
    item('card_payments', 'payments', cardReady, false),
    item(
      'google_signin',
      'security',
      present(env, 'NEXT_PUBLIC_GOOGLE_CLIENT_ID') && present(env, 'GOOGLE_CLIENT_SECRET'),
      false
    ),
  ];
}

/** Everything else: facts that live in the database. */
export async function evaluateDataReadiness(db: PrismaClient): Promise<ReadinessItem[]> {
  const [liveUnits, liveWithoutPermittedUse, health, legalName, bankNumber, bankEnabled] = await Promise.all([
    db.unit.count({ where: { status: 'live' } }),
    db.unit.count({ where: { status: 'live', permittedUseConfirmedAt: null } }),
    getSchedulerHealth(db),
    getConfig(db, 'merchant.legal_name'),
    getConfig(db, 'merchant.bank_account_number'),
    getConfig(db, 'merchant.bank_transfer_enabled'),
  ]);

  const attention = jobsNeedingAttention(health);
  const frequent = health.find((row) => row.cadence === 'frequent' && row.lastFinishedAt);
  const freshMs = frequent?.lastFinishedAt ? Date.now() - frequent.lastFinishedAt.getTime() : Infinity;

  return [
    {
      id: 'scheduler_running',
      group: 'automation',
      state: attention.length === 0 && freshMs < 30 * 60 * 1000 ? 'ok' : 'action',
      blocking: true,
    },
    {
      id: 'bank_details',
      group: 'payments',
      state: bankEnabled !== false && Boolean(legalName) && Boolean(bankNumber) ? 'ok' : 'action',
      blocking: true,
    },
    { id: 'live_units', group: 'catalogue', state: liveUnits > 0 ? 'ok' : 'action', blocking: true, detail: `${liveUnits}` },
    {
      id: 'permitted_use',
      group: 'catalogue',
      state: liveWithoutPermittedUse === 0 ? 'ok' : 'action',
      blocking: true,
      detail: `${liveWithoutPermittedUse}`,
    },
  ];
}

export async function collectLaunchReadiness(db: PrismaClient, env: ReadinessEnv = process.env) {
  const items = [...evaluateEnvReadiness(env), ...(await evaluateDataReadiness(db))];
  const blockingOpen = items.filter((i) => i.blocking && i.state === 'action').length;
  return { items, blockingOpen };
}
