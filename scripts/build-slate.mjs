#!/usr/bin/env node
/**
 * scripts/build-slate.mjs
 * Assembles the deployable static site into ./dist at the repo root.
 *
 * The Catalyst Slate Git deployer runs the root `npm run build` and then serves
 * the `dist/` directory. Our app source lives in catalyst/client/capacity_app,
 * so this copies it (already containing the synced /core in lib/) into dist and
 * drops in the Slate static marker.
 *
 * Run order (via package.json): prebuild -> sync-core, then build -> this.
 */
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'catalyst', 'client', 'capacity_app');
const DIST = join(root, 'dist');

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  // Copy the whole static app (index.html, app.js, styles.css, lib/, .catalyst/).
  await cp(SRC, DIST, { recursive: true });
  // Ensure the Slate static marker exists in the output dir.
  const marker = join(DIST, '.catalyst');
  await mkdir(marker, { recursive: true });
  await writeFile(join(marker, 'slate-config.toml'), 'framework = "static"\ndeployment_name = "default"\n');
  console.log(`built static site -> dist/ (from ${SRC.replace(root + '/', '')})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
