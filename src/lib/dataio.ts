import type { Dataset, TaxonNode } from '../data/types';
import { validateDataset } from '../data/validate';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJson(ds: Dataset) {
  download('map-of-evolution.dataset.json', JSON.stringify(ds, null, 2), 'application/json');
}

const CSV_COLUMNS: (keyof TaxonNode)[] = [
  'id', 'name', 'scientific', 'parent', 'hybridOf', 'rank', 'group', 'appeared', 'extinct', 'emoji', 'summary', 'facts', 'tags', 'origin', 'wiki', 'confidence',
];

export function exportCsv(ds: Dataset) {
  const cell = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const s = Array.isArray(v) ? v.join(' | ') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [CSV_COLUMNS.join(','), ...ds.nodes.map((n) => CSV_COLUMNS.map((c) => cell(n[c])).join(','))];
  download('map-of-evolution.nodes.csv', rows.join('\n'), 'text/csv');
}

/**
 * Accepts either a full exported dataset, or a single tree file
 * (`{ "nodes": [...] }`) which is merged into the current dataset —
 * handy for adding your own organisms without touching the rest.
 */
export async function importFile(file: File, current: Dataset): Promise<{ dataset: Dataset; label: string }> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error(`${file.name} is not valid JSON`);
  }
  const obj = json as Partial<Dataset> & { nodes?: TaxonNode[] };
  let dataset: Dataset;
  let label: string;
  if (obj.format === 'map-of-evolution' && Array.isArray(obj.nodes)) {
    dataset = { ...current, ...obj, time: obj.time ?? current.time, groups: obj.groups ?? current.groups, journeys: obj.journeys ?? [] } as Dataset;
    label = file.name;
  } else if (Array.isArray(obj.nodes)) {
    const incoming = new Map(obj.nodes.map((n) => [n.id, n]));
    dataset = { ...current, nodes: [...current.nodes.filter((n) => !incoming.has(n.id)), ...obj.nodes] };
    label = `${file.name} (merged)`;
  } else {
    throw new Error(`${file.name} has no "nodes" array`);
  }
  const { errors } = validateDataset(dataset);
  if (errors.length) throw new Error(`${errors.length} problem${errors.length > 1 ? 's' : ''}: ${errors.slice(0, 3).join('; ')}`);
  return { dataset, label };
}
