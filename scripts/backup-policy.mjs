const REF = 'burcnghheyzbzffzgmjz';
export function backupConnection(value, { testSource = false, scratch = false } = {}) {
  let u;
  try { u = new URL(value); } catch { throw new Error('Missing or invalid backup connection'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol)) throw new Error('PostgreSQL connection required');
  const user = decodeURIComponent(u.username), database = decodeURIComponent(u.pathname.slice(1));
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (scratch) {
    if (!local || !['restore_check', 'myuno_backup_restore_test'].includes(database)) throw new Error('Restore requires a dedicated local scratch database');
  } else if (testSource) {
    if (!local || database !== 'myuno_test' || user !== 'backup_test_reader') throw new Error('Test backup target rejected');
  } else {
    const direct = u.hostname === `db.${REF}.supabase.co`;
    const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname) && user.endsWith(`.${REF}`);
    if ((!direct && !pooler) || database !== 'postgres' || (u.port && u.port !== '5432') || user.split('.')[0] === 'postgres') throw new Error('Dedicated canonical backup principal required');
  }
  return {
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGDATABASE: database,
    PGUSER: user, PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: local ? 'disable' : 'require', PGCONNECT_TIMEOUT: '20',
    PGOPTIONS: '-c timezone=UTC' + (scratch ? '' : ' -c default_transaction_read_only=on'),
  };
}

export function restorePlan(toc) {
  const lines = toc.split('\n');
  // The scratch DB already has public. Skip only its CREATE SCHEMA item;
  // every table/function/data/constraint item still restores with stop-on-error.
  const list = lines.filter(line => !/\bSCHEMA - public(?:\s|$)/.test(line)).join('\n');
  // A schema-only selection in pg_dump omits extension declarations, but
  // citext and exclusion constraints still require the extension objects.
  const missingExtensions = ['citext', 'btree_gist'].filter(name => !lines.some(line => new RegExp(`\\bEXTENSION - ${name}(?:\\s|$)`).test(line)));
  return { list, missingExtensions };
}
