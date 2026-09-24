#!/usr/bin/env node
/**
 * scripts/sync-core.mjs
 * Copies the canonical /core ES modules into each deployable shell so both the
 * Catalyst static frontend and the Sigma widget are self-contained (drag-and-
 * drop / git-deployable) with no bundler.
 *
 *   /core  ->  catalyst/client/capacity_app/lib
 *   /core  ->  sigma/app/lib
 *
 * The copies are committed so the repo is always deploy-ready, but /core is the
 * source of truth. Edit /core, then run:  npm run sync   (or node scripts/sync-core.mjs)
 * CI runs this before packaging/deploy too, so a stale copy can never ship.
 */
import { cp, rm, readdir, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'core');
const TARGETS = [
  join(root, 'catalyst', 'client', 'capacity_app', 'lib'),
  join(root, 'sigma', 'app', 'lib'),
];
const BANNER = '/* AUTO-GENERATED from /core by scripts/sync-core.mjs — edit the source, not this copy. */\n';

async function stampBanner(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { await stampBanner(p); continue; }
    if (entry.name.endsWith('.js')) {
      const body = await readFile(p, 'utf8');
      if (!body.startsWith('/* AUTO-GENERATED')) await writeFile(p, BANNER + body);
    }
  }
}

async function main() {
  if (!existsSync(SRC)) throw new Error(`core/ not found at ${SRC}`);
  for (const dest of TARGETS) {
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await cp(SRC, dest, { recursive: true });
    await stampBanner(dest);
    console.log(`synced core -> ${dest.replace(root + '/', '')}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
