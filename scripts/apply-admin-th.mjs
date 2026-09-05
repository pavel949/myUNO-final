import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(join(__dirname, 'admin-th-map.json'), 'utf8'));
const path = join(__dirname, '../src/modules/content/seed.ts');
const lines = fs.readFileSync(path, 'utf8').split('\n');

let updated = 0;
const missing = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.includes("namespace: 'admin'")) continue;
  if (/,\s*th:\s*'/.test(line)) continue;
  const keyMatch = line.match(/key: '(admin\.[^']+)'/);
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
console.log(`Updated ${updated} admin keys`);
