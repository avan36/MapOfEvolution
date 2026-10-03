import type { Dataset, Group, TaxonNode, TimeSpan } from '../data/types';
import { TimeScale } from './timeScale';
import { groupColor, theme } from '../theme';

export interface TNode {
  id: string;
  data: TaxonNode;
  index: number;
  parent: TNode | null;
  children: TNode[];
  /** Additional (hybrid / endosymbiotic) ancestors. */
  hybrids: TNode[];
  depth: number;
  leafCount: number;
  /** Position along the leaf axis (angle in the radial view, y in the timeline). */
  u: number;
  /** Warped time where the lineage starts (0 = oldest, 1 = today). */
  sStart: number;
  /** Warped time where the drawn lineage ends: extinction, or today. */
  sEnd: number;
  color: string;
  extinct: boolean;
  /** Lower-cased search haystack. */
  haystack: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class TreeModel {
  readonly dataset: Dataset;
  readonly nodes: TNode[];
  readonly byId = new Map<string, TNode>();
  readonly root: TNode;
  readonly leaves: TNode[] = [];
  readonly uTotal: number;
  readonly scale: TimeScale;
  readonly groups = new Map<string, Group>();
  readonly maxLeafCount: number;
  /** Drugs each lineage gives us (from `medicine.treatments[].from`), with the germs they treat. */
  private readonly drugSources = new Map<TNode, Map<string, TNode[]>>();

  constructor(dataset: Dataset) {
    this.dataset = dataset;
    for (const g of dataset.groups) this.groups.set(g.id, g);

    this.nodes = dataset.nodes.map((data, index) => ({
      id: data.id,
      data,
      index,
      parent: null,
      children: [],
      hybrids: [],
      depth: 0,
      leafCount: 0,
      u: 0,
      sStart: 0,
      sEnd: 1,
      color: groupColor(data.group),
      extinct: data.extinct !== undefined,
      haystack: norm([
        data.name, data.scientific ?? '', data.id.replace(/-/g, ' '), ...(data.tags ?? []),
        ...(data.medicine?.diseases ?? []), ...(data.medicine?.treatments.map((t) => t.drug) ?? []),
      ].join(' | ')),
    }));
    for (const n of this.nodes) this.byId.set(n.id, n);

    let root: TNode | undefined;
    for (const n of this.nodes) {
      const p = n.data.parent ? this.byId.get(n.data.parent) : undefined;
      if (p) { n.parent = p; p.children.push(n); } else if (!root || n.data.parent === null) root = root ?? n;
      for (const h of n.data.hybridOf ?? []) { const hn = this.byId.get(h); if (hn) n.hybrids.push(hn); }
    }
    if (!root) throw new Error('Dataset has no root node');
    this.root = root;

    // Time axis: adapt to every date in the data set.
    const times: number[] = [];
    for (const n of this.nodes) { times.push(n.data.appeared); if (n.data.extinct !== undefined) times.push(n.data.extinct); }
    for (const s of dataset.time.spans) times.push(s.start, s.end);
    for (const e of dataset.time.events) times.push(e.time);
    const max = Math.max(root.data.appeared, ...dataset.time.spans.map((s) => s.start), ...dataset.time.events.map((e) => e.time));
    this.scale = new TimeScale(times, max, theme.layout.timeWarp);

    // Depth-first ordering → leaf positions. Nodes reached from no root are ignored.
    let u = 0;
    let lastGroup: string | null = null;
    const visit = (n: TNode, depth: number) => {
      n.depth = depth;
      n.sStart = this.scale.s(n.data.appeared);
      n.sEnd = this.scale.s(n.data.extinct ?? 0);
      if (n.children.length === 0) {
        if (lastGroup !== null && lastGroup !== n.data.group) u += theme.layout.groupGap;
        lastGroup = n.data.group;
        n.u = u;
        u += 1;
        n.leafCount = 1;
        this.leaves.push(n);
        return;
      }
      for (const c of n.children) visit(c, depth + 1);
      n.leafCount = n.children.reduce((a, c) => a + c.leafCount, 0);
      n.u = (n.children[0].u + n.children[n.children.length - 1].u) / 2;
    };
    visit(root, 0);
    this.uTotal = Math.max(u, 1);
    this.maxLeafCount = root.leafCount;

    for (const n of this.nodes) {
      for (const t of n.data.medicine?.treatments ?? []) {
        const src = t.from ? this.byId.get(t.from) : undefined;
        if (!src) continue;
        const drugs = this.drugSources.get(src) ?? new Map<string, TNode[]>();
        this.drugSources.set(src, drugs);
        const treats = drugs.get(t.drug) ?? [];
        if (!treats.includes(n)) treats.push(n);
        drugs.set(t.drug, treats);
      }
    }
  }

  /** Medicines that come from this lineage, each with the germs it is used against. */
  drugsFrom(n: TNode): { drug: string; treats: TNode[] }[] {
    return [...(this.drugSources.get(n) ?? [])].map(([drug, treats]) => ({ drug, treats }));
  }

  /** A germ with medical notes, or a lineage that medicines come from. */
  isMedical(n: TNode): boolean {
    return !!n.data.medicine || this.drugSources.has(n);
  }

  /** Root → node (inclusive). */
  lineage(n: TNode): TNode[] {
    const out: TNode[] = [];
    for (let c: TNode | null = n; c; c = c.parent) out.push(c);
    return out.reverse();
  }

  /** Most recent common ancestor. */
  mrca(a: TNode, b: TNode): TNode {
    const set = new Set(this.lineage(a));
    for (let c: TNode | null = b; c; c = c.parent) if (set.has(c)) return c;
    return this.root;
  }

  descendants(n: TNode): TNode[] {
    const out: TNode[] = [];
    const stack = [n];
    while (stack.length) { const c = stack.pop()!; out.push(c); stack.push(...c.children); }
    return out;
  }

  /** The finest geological spans covering all of time: periods, else eras, else eons. */
  get bands(): TimeSpan[] {
    if (this._bands) return this._bands;
    const spans = this.dataset.time.spans;
    const overlap = (a: TimeSpan, b: TimeSpan) => a.start > b.end && a.end < b.start;
    const periods = spans.filter((s) => s.level === 'period');
    const eras = spans.filter((s) => s.level === 'era' && !periods.some((p) => overlap(p, s)));
    const eons = spans.filter((s) => s.level === 'eon' && !spans.some((x) => x.level !== 'eon' && overlap(x, s)));
    return (this._bands = [...eons, ...eras, ...periods].sort((a, b) => b.start - a.start));
  }
  private _bands: TimeSpan[] | null = null;

  /** Geological period (or era/eon) a time falls in, most specific first. */
  spansAt(ma: number): TimeSpan[] {
    const order = { period: 0, era: 1, eon: 2 } as const;
    return this.dataset.time.spans
      .filter((s) => ma <= s.start && ma >= s.end)
      .sort((a, b) => order[a.level] - order[b.level]);
  }

  search(query: string, limit = 30): TNode[] {
    const q = norm(query.trim());
    if (!q) return [];
    const words = q.split(/\s+/);
    const scored: { n: TNode; score: number }[] = [];
    for (const n of this.nodes) {
      const name = norm(n.data.name);
      const sci = norm(n.data.scientific ?? '');
      let score = 0;
      if (name === q || sci === q) score = 100;
      else if (name.startsWith(q) || sci.startsWith(q)) score = 80;
      else if (new RegExp(`\\b${escapeRe(q)}`).test(name) || new RegExp(`\\b${escapeRe(q)}`).test(sci)) score = 60;
      else if (words.every((w) => n.haystack.includes(w))) score = 30;
      else continue;
      if (n.data.tags?.includes('landmark')) score += 5;
      score -= Math.min(10, name.length / 6);
      scored.push({ n, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.n);
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
