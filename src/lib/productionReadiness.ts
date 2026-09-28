/**
 * A strict check is deliberately non-destructive and does not disclose secret
 * names or values to anonymous callers. It is not a replacement for a
 * successful backup restore, scheduler smoke test, or payment reconciliation.
 */
export function productionConfigurationReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const session = env.SESSION_SECRET || env.NEXTAUTH_SECRET || '';
  const url = env.NEXTAUTH_URL || env.NEXT_PUBLIC_APP_URL || '';
  let validOrigin = false;
  try {
    const parsed = new URL(url);
    validOrigin = parsed.protocol === 'https:' && !!parsed.hostname && parsed.hostname !== 'localhost';
  } catch {
    validOrigin = false;
  }

  return Boolean(
    env.DATABASE_URL &&
    session.length >= 32 &&
    !session.startsWith('change-me') &&
    /^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY || '') &&
    (env.CRON_SECRET || '').length >= 32 &&
    validOrigin &&
    env.BLOB_READ_WRITE_TOKEN &&
    env.ALERT_WEBHOOK_URL?.startsWith('https://') &&
    env.PAYMENT_PROVIDER === 'opn' &&
    env.OMISE_SECRET_KEY?.startsWith('skey_live_') &&
    env.OMISE_WEBHOOK_SECRET
  );
}

