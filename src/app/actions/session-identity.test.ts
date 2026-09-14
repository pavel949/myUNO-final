import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No server action may accept an identity as a parameter.
 *
 * Every file under `src/app/actions/` carries `'use server'`, so each export is
 * a callable RPC endpoint, not just a function server components import. An
 * identity id in its signature is therefore an assertion the *caller* makes
 * about who they are — and callers are not trustworthy.
 *
 * The services underneath scope correctly by relation (units by
 * `ownerIdentityId`, an MC by role assignment, a booking by its guest), which
 * is exactly why this was easy to miss: each one looked guarded. None of them
 * could tell whether the identity handed to it belonged to the person asking.
 *
 * `requireSessionIdentityId()` is the only sanctioned source.
 */
const ACTIONS_DIR = join(process.cwd(), 'src/app/actions');

/** Parameter names that name a person rather than a resource. */
const IDENTITY_PARAM = /\b(identityId|ownerIdentityId|guestIdentityId|mcIdentityId|actorIdentityId|userId)\s*:/;

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
}

describe('server action identity handling', () => {
  const files = actionFiles();

  it('finds the action files it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it('no exported server action takes an identity parameter', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (!src.includes("'use server'")) continue;

      // Each exported async function, with its parameter list up to the
      // closing paren of the signature.
      for (const m of src.matchAll(/export async function (\w+)\s*\(([^)]*)\)/g)) {
        const [, name, params] = m;
        if (IDENTITY_PARAM.test(params)) {
          offenders.push(`${file}:${name}(${params.trim().replace(/\s+/g, ' ')})`);
        }
      }
    }

    expect(offenders, `server actions taking a caller-supplied identity:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('actions that need an identity resolve it from the session', () => {
    // The four that previously took one must now import the helper.
    for (const file of ['getOwnerDashboard.ts', 'getMCDashboard.ts', 'getActiveStay.ts', 'getInStayHomeSpace.ts']) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      expect(src, `${file} must resolve identity from the session`).toContain('requireSessionIdentityId');
    }
  });
});
