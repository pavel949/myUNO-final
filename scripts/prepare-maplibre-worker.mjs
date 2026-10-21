#!/usr/bin/env node
// Local build asset only: no downloads, credentials, database or CDN dependency.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageFile = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(packageFile, 'utf8'));
if (!/^6\.\d+\.\d+$/.test(version)) throw new Error('Review worker packaging before changing the MapLibre major');
const destination = join(root, 'public', 'maplibre');
mkdirSync(destination, { recursive: true });
copyFileSync(join(dirname(packageFile), 'dist', 'maplibre-gl-worker.mjs'), join(destination, `maplibre-gl-worker-${version}.mjs`));
console.log(`Prepared same-origin MapLibre ${version} worker`);
