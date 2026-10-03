import type { Dataset, Rank } from './types';

const RANKS: Rank[] = [
  'root', 'domain', 'supergroup', 'kingdom', 'clade', 'phylum', 'class', 'order',
  'family', 'genus', 'species', 'subspecies', 'cultivar', 'breed', 'hybrid',
];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

/**
 * Checks a dataset for structural problems. Shared by the build script
 * (`npm run validate`) and the in-app "load your own data" importer.
 */
export function validateDataset(ds: Dataset): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map<string, Dataset['nodes'][number]>();
  if (!Array.isArray(ds.nodes) || !Array.isArray(ds.groups) || !ds.time || !Array.isArray(ds.time.spans) || !Array.isArray(ds.time.events) || !Array.isArray(ds.journeys)) {
    return { errors: ['dataset needs "nodes", "groups", "time.spans", "time.events" and "journeys" arrays'], warnings };
  }
  const groupIds = new Set(ds.groups.map((g) => g.id));

  for (const n of ds.nodes) {
    const where = `node "${n.id}"`;
    if (!n.id || !ID.test(n.id)) errors.push(`${where}: id must be kebab-case`);
    if (byId.has(n.id)) errors.push(`${where}: duplicate id`);
    byId.set(n.id, n);
    if (!n.name) errors.push(`${where}: missing name`);
    if (!RANKS.includes(n.rank)) errors.push(`${where}: unknown rank "${n.rank}"`);
    if (!groupIds.has(n.group)) errors.push(`${where}: unknown group "${n.group}"`);
    if (typeof n.appeared !== 'number' || !(n.appeared >= 0)) errors.push(`${where}: "appeared" must be a number ≥ 0 (Ma)`);
    if (n.extinct !== undefined) {
      if (typeof n.extinct !== 'number' || n.extinct < 0) errors.push(`${where}: "extinct" must be a number ≥ 0 (Ma)`);
      else if (n.extinct > n.appeared) errors.push(`${where}: extinct (${n.extinct}) is older than appeared (${n.appeared})`);
    }
    if (!n.summary) warnings.push(`${where}: no summary`);
  }

  const roots = ds.nodes.filter((n) => n.parent === null);
  if (roots.length !== 1) errors.push(`expected exactly one root (parent: null), found ${roots.length}`);

  for (const n of ds.nodes) {
    const where = `node "${n.id}"`;
    if (n.parent !== null) {
      const p = byId.get(n.parent);
      if (!p) errors.push(`${where}: parent "${n.parent}" does not exist`);
      else {
        if (n.appeared > p.appeared) errors.push(`${where}: appeared ${n.appeared} Ma, before its parent "${p.id}" (${p.appeared} Ma)`);
        if (p.extinct !== undefined && n.appeared < p.extinct)
          warnings.push(`${where}: appeared ${n.appeared} Ma, after its parent "${p.id}" went extinct (${p.extinct} Ma)`);
      }
    }
    for (const h of n.hybridOf ?? []) {
      if (!byId.has(h)) errors.push(`${where}: hybridOf "${h}" does not exist`);
      if (h === n.parent) warnings.push(`${where}: hybridOf repeats the parent "${h}"`);
    }
  }

  // Cycle check: every node must reach the root.
  for (const n of ds.nodes) {
    const seen = new Set<string>();
    let cur: string | null = n.id;
    while (cur !== null) {
      if (seen.has(cur)) { errors.push(`node "${n.id}": parent chain has a cycle`); break; }
      seen.add(cur);
      cur = byId.get(cur)?.parent ?? null;
    }
  }

  for (const j of ds.journeys) {
    if (!j.steps?.length) errors.push(`journey "${j.id}": needs at least one step`);
    for (const s of j.steps) if (!byId.has(s.node)) errors.push(`journey "${j.id}": unknown node "${s.node}"`);
  }
  for (const s of ds.time.spans) if (s.start <= s.end) errors.push(`time span "${s.id}": start must be older than end`);

  return { errors, warnings };
}
