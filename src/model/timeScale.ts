/**
 * A monotonic "warped" time axis. Pure log time crushes the dinosaurs between
 * microbes and the last ten thousand years of farming. Instead we blend a log
 * scale with the cumulative distribution of events in the data, so wherever
 * the tree branches a lot gets more room — while order is always preserved.
 *
 * s = 0 is the oldest moment (Earth forming), s = 1 is today.
 */
export class TimeScale {
  readonly max: number;
  private ts: number[]; // descending times (old → new)
  private ss: number[]; // matching positions 0..1

  constructor(times: number[], max: number, warp: number) {
    this.max = max;
    const c = 0.3;
    const logS = (t: number) => 1 - Math.log1p(t / c) / Math.log1p(max / c);
    const uniq = [...new Set([max, 0, ...times.filter((t) => t >= 0 && t <= max)].map((t) => +t.toPrecision(6)))].sort(
      (a, b) => b - a,
    );
    const n = uniq.length - 1;
    this.ts = uniq;
    this.ss = uniq.map((t, i) => warp * (i / n) + (1 - warp) * logS(t));
  }

  /** time (Ma) → 0..1 */
  s(t: number): number {
    const { ts, ss } = this;
    if (t >= ts[0]) return 0;
    if (t <= 0) return 1;
    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] >= t) lo = mid; else hi = mid;
    }
    // interpolate in log space between neighbouring event times
    const a = Math.log1p(ts[lo] / 0.0001), b = Math.log1p(ts[hi] / 0.0001), x = Math.log1p(t / 0.0001);
    const f = a === b ? 0 : (a - x) / (a - b);
    return ss[lo] + f * (ss[hi] - ss[lo]);
  }

  /** 0..1 → time (Ma) */
  t(s: number): number {
    if (s <= 0) return this.max;
    if (s >= 1) return 0;
    let lo = 0, hi = this.max;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (this.s(mid) > s) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
}
