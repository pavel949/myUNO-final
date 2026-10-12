import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * In a JSX string attribute a backslash is literal: `pattern="\\d{4}"` asks
 * for a backslash followed by `d`, which no value ever matches, so the browser
 * refuses every submit and says only "Please match the requested format".
 * That is how the guest passport form could never accept a date of birth and
 * the night-audit date field rejected its own default.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [path] : [];
  });
}

describe('JSX pattern attributes', () => {
  it('never double a backslash inside a string attribute', () => {
    const offenders = files(join(process.cwd(), 'src')).filter((file) => /pattern="[^"]*\\\\/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
