import { writeFileSync } from 'node:fs';
import { readDataset } from './read-data';

// Writes the whole merged dataset to one portable JSON file, e.g. for another UI.
const out = process.argv[2] ?? 'map-of-evolution.dataset.json';
const ds = readDataset();
writeFileSync(out, JSON.stringify(ds, null, 2));
console.log(`Wrote ${ds.nodes.length} lineages to ${out}`);
