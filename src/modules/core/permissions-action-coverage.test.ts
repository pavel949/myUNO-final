import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isKnownPermissionAction } from './permissions';

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    found.push(path);
  }
  return found;
}

function actionsInCanCalls(source: string): string[] {
  const actions: string[] = [];
  let cursor = 0;

  while (true) {
    const start = source.indexOf('can({', cursor);
    if (start === -1) break;
    const end = source.indexOf('})', start);
    if (end === -1) break;
    const snippet = source.slice(start, end + 2);
    const action = snippet.match(/action:\s*'([^']+)'/)?.[1];
    if (action) actions.push(action);
    cursor = start + 4;
  }

  return actions;
}

describe('permission action coverage', () => {
  it('uses only known action names in can() checks', () => {
    const roots = [join(process.cwd(), 'src/app'), join(process.cwd(), 'src/modules')];
    const actions = roots
      .flatMap(sourceFiles)
      .flatMap((path) => actionsInCanCalls(readFileSync(path, 'utf8')));

    const unknown = [...new Set(actions.filter((action) => !isKnownPermissionAction(action)))];

    expect(
      unknown,
      'these action names are used in can() but are not declared in permissions aliases/admin-only/actions'
    ).toEqual([]);
  });
});
