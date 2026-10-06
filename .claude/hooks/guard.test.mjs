// Regression tests for .claude/hooks/guard.mjs. Run: npm run agents:guard:test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('./guard.mjs', import.meta.url));
const PROD = 'burcnghheyzbzffzgmjz';

const run = (payload) => {
  const r = spawnSync(process.execPath, [guard], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'allow';
};
const sb = (tool, input) => ({ tool_name: `mcp__supabase-myuno__${tool}`, tool_input: input });
const sh = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('denies Supabase calls to any other project ref', () => {
  assert.equal(
    run(sb('execute_sql', { project_id: 'omwoglpcwaiflaprgrne', query: 'select 1' })),
    'deny'
  );
  assert.equal(run(sb('list_tables', { project_id: 'aemliebrdrfmbslqutkp' })), 'deny');
});

test('matches claude.ai-provided Supabase connector names too', () => {
  const t = {
    tool_name: 'mcp__claude_ai_Supabase__execute_sql',
    tool_input: { project_id: 'fryejvtyzkuhjfsoofvu', query: 'select 1' },
  };
  assert.equal(run(t), 'deny');
});

test('asks before migrations, edge deploys and project-level changes on prod', () => {
  for (const tool of [
    'apply_migration',
    'deploy_edge_function',
    'merge_branch',
    'reset_branch',
    'pause_project',
  ]) {
    assert.equal(run(sb(tool, { project_id: PROD })), 'ask', tool);
  }
});

test('asks on write or DDL SQL, allows reads', () => {
  for (const q of [
    'update unit set x=1',
    'DELETE FROM booking',
    'alter table unit add c int',
    'drop table x',
    'grant all on unit to anon',
  ]) {
    assert.equal(run(sb('execute_sql', { project_id: PROD, query: q })), 'ask', q);
  }
  assert.equal(
    run(sb('execute_sql', { project_id: PROD, query: 'select count(*) from unit' })),
    'allow'
  );
});

test('denies schema-history bypasses and force-push in Bash', () => {
  for (const c of [
    'npx prisma db push',
    'npx prisma migrate reset --force',
    'supabase db push',
    'supabase db reset',
    'git push --force origin main',
    'git push -f',
  ]) {
    assert.equal(run(sh(c)), 'deny', c);
  }
});

test('asks when prisma migrate deploy/resolve points at production', () => {
  assert.equal(
    run(sh(`DATABASE_URL=postgres://x@db.${PROD}.supabase.co/postgres npx prisma migrate deploy`)),
    'ask'
  );
});

test('allows routine commands', () => {
  for (const c of ['npm run lint', 'npm test', 'git status', 'npx prisma generate'])
    assert.equal(run(sh(c)), 'allow', c);
});

test('fails to ask, never allow, on unparseable input', () => {
  assert.equal(run('not json'), 'ask');
});
