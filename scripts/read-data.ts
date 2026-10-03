import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleDataset } from '../src/data/assemble';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

const read = (p: string) => JSON.parse(readFileSync(join(DATA_DIR, p), 'utf8'));

/** Reads `/data` from disk exactly the way the app bundles it. */
export function readDataset() {
  const treeFiles = readdirSync(join(DATA_DIR, 'tree'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ path: `tree/${f}`, file: read(`tree/${f}`) }));
  return assembleDataset({
    meta: read('meta.json'),
    groups: read('groups.json'),
    time: read('time.json'),
    journeys: read('journeys.json'),
    treeFiles,
  });
}
