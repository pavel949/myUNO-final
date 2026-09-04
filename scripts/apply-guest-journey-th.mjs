import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(join(__dirname, 'guest-journey-th-map.json'), 'utf8'));
const path = join(__dirname, '../src/modules/content/seed.ts');
const lines = fs.readFileSync(path, 'utf8').split('\n');

const namespaces = new Set([
  'search', 'catalog', 'listing', 'home', 'common', 'projects', 'project_page',
  'auth', 'legal', 'landing', 'trust', 'area', 'email', 'order',
]);

let updated = 0;
const missing = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const nsMatch = line.match(/namespace: '([^']+)'/);
  if (!nsMatch || !namespaces.has(nsMatch[1])) continue;
  if (/,\s*th:\s*'/.test(line)) continue;
  const keyMatch = line.match(/key: '([^']+)'/);
  if (!keyMatch) continue;
  const key = keyMatch[1];
  const translation = map[key];
  if (!translation) {
    missing.push(key);
    continue;
  }
  const escaped = translation.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  lines[i] = line.replace(/, status: NR/, `, th: '${escaped}', status: NR`);
  updated++;
}

if (missing.length) {
  console.warn('No translation for:', missing.slice(0, 10).join(', '));
  process.exit(1);
}

fs.writeFileSync(path, lines.join('\n'));
console.log(`Updated ${updated} guest-journey keys`);
