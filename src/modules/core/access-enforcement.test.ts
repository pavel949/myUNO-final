import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSIONS, accessSatisfies, resolvePermissionAction } from '@/modules/core/permissions';

/**
 * A mutation may not be authorised by a read-only grant.
 *
 * doc 03 marks some roles read-only on an action — the owner is "👁 own units"
 * for availability and pricing, the owner and MC member are read-only on
 * compliance records. `PERMISSIONS` records that as `access: 'read'`, and
 * until recently nothing read the field: `can()` matched on action alone, so a
 * read-only row passed exactly like an 'allow' row.
 *
 * That is now fixed at the source — `can()` honours `access`, defaulting to
 * 'read' so reads are unchanged. But a mutation route still has to *say* it is
 * mutating. This test is what makes that non-optional: it walks the API route
 * handlers and fails if a mutating handler is guarded on an action that has a
 * read-only holder without asserting write access.
 *
 * It is a static check because the failure mode is invisible at runtime. The
 * route returns correct data, the tests pass, and the only symptom is a role
 * doing something doc 03 says it may not.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const API_DIR = join(process.cwd(), 'src/app/api');

/** Actions where at least one role holds read-only access. */
function actionsWithReadOnlyHolders(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const p of PERMISSIONS) {
    if (!accessSatisfies(p.access, 'allow')) {
      m.set(p.action, [...(m.get(p.action) ?? []), p.role]);
    }
  }
  return m;
}

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (e === 'route.ts') out.push(full);
  }
  return out;
}

interface Handler {
  file: string;
  method: string;
  actions: string[];
  assertsWrite: boolean;
}

function handlers(): Handler[] {
  const out: Handler[] = [];
  for (const file of routeFiles(API_DIR)) {
    const src = readFileSync(file, 'utf8');
    const parts = src.split(/export async function (GET|POST|PUT|PATCH|DELETE)/);
    for (let i = 1; i < parts.length; i += 2) {
      const method = parts[i];
      const body = parts[i + 1] ?? '';
      const actions = [
        ...[...body.matchAll(/action:\s*'([^']+)'/g)].map((m) => m[1]),
        ...[...body.matchAll(/requireAction\(\s*'([^']+)'/g)].map((m) => m[1]),
      ];
      const assertsWrite =
        /requiredAccess:\s*'allow'/.test(body) || /canWriteAvailabilityAndPricing\s*\(/.test(body);
      if (actions.length) {
        out.push({ file: file.replace(`${process.cwd()}/`, ''), method, actions, assertsWrite });
      }
    }
  }
  return out;
}

describe('mutations are not authorised by read-only grants', () => {
  const readOnly = actionsWithReadOnlyHolders();
  const all = handlers();

  it('finds the permission rows and route handlers it guards', () => {
    expect(readOnly.size).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(20);
  });

  it('every mutating handler on a read-holder action asserts write access', () => {
    const gaps: string[] = [];

    for (const h of all) {
      if (!MUTATING.has(h.method)) continue;
      for (const a of h.actions) {
        const resolved = resolvePermissionAction(a);
        const holders = readOnly.get(resolved);
        if (holders && !h.assertsWrite) {
          gaps.push(
            `${h.method} ${h.file} — action '${a}' resolves to '${resolved}', ` +
              `read-only for ${holders.join(', ')}, but the handler never asserts write access`
          );
        }
      }
    }

    expect(gaps, `mutations reachable on a read-only grant:\n  ${gaps.join('\n  ')}`).toEqual([]);
  });

  it("can() defaults to read, so a read-only row still satisfies a read", () => {
    expect(accessSatisfies('read', 'read')).toBe(true);
    expect(accessSatisfies('read', 'allow')).toBe(false);
    expect(accessSatisfies('allow', 'read')).toBe(true);
    expect(accessSatisfies('allow', 'allow')).toBe(true);
  });
});
