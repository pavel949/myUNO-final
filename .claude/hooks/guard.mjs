#!/usr/bin/env node
// PreToolUse guard for myUNO final. Runs before every Bash and Supabase MCP call.
// - Supabase: deny any call aimed at a project other than the production ref;
//   force a human "ask" on migrations, edge-function deploys and write SQL.
// - Bash: deny commands that rewrite schema or migration history outside Prisma migrate.
// Exit 0 with JSON = decision. Any internal error fails open to "ask", never silently allows a write.

const PROD_REF = 'burcnghheyzbzffzgmjz';

const decide = (permissionDecision, reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    decide('ask', 'guard.mjs could not parse the tool call; confirm manually.');
  }
  const tool = String(evt.tool_name || '');
  const input = evt.tool_input || {};

  if (/supabase/i.test(tool)) {
    const ref = input.project_id || input.project_ref || input.projectId;
    if (ref && ref !== PROD_REF) {
      decide('deny', `Supabase target ${ref} is not myUNO final (${PROD_REF}). Only that ref is permitted.`);
    }
    if (/apply_migration|deploy_edge_function|merge_branch|reset_branch|pause_project|restore_project|create_project/.test(tool)) {
      decide('ask', 'Spine rule: schema, deploy and project-level Supabase changes need Pavel\'s line-by-line approval. Print the full SQL/code first.');
    }
    if (/execute_sql/.test(tool)) {
      const q = String(input.query || '');
      if (/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|comment\s+on)\b/i.test(q)) {
        decide('ask', 'execute_sql contains a write or DDL statement. Production data/schema change needs approval; prefer a Prisma migration file.');
      }
    }
    process.exit(0);
  }

  if (tool === 'Bash') {
    const cmd = String(input.command || '');
    const banned = [
      [/prisma\s+db\s+push/, 'prisma db push is forbidden (AI_AGENT_RULES §6). Write a migration file.'],
      [/prisma\s+migrate\s+reset/, 'prisma migrate reset wipes the database. Forbidden.'],
      [/supabase\s+db\s+(push|reset)/, 'Supabase CLI schema push/reset bypasses Prisma history. Forbidden.'],
      [/git\s+push\s+.*(--force|-f\b)/, 'Force-push is forbidden on this repo.'],
    ];
    for (const [re, why] of banned) if (re.test(cmd)) decide('deny', why);
    if (/prisma\s+migrate\s+(deploy|resolve)/.test(cmd) && /DATABASE_URL|burcnghheyzbzffzgmjz|supabase\.co/.test(cmd)) {
      decide('ask', 'This touches production migration history. Confirm with Pavel.');
    }
  }
  process.exit(0);
});
