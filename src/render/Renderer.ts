import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { select, type Selection } from 'd3-selection';
import { interpolateZoom } from 'd3-interpolate';
import { quadtree, type Quadtree } from 'd3-quadtree';
import { easeCubicInOut } from 'd3-ease';
import type { TNode, TreeModel } from '../model/tree';
import { theme } from '../theme';
import { formatTick } from '../lib/format';
import { rgba, toRgb, type RGB } from './color';

export type ViewMode = 'radial' | 'linear';

export interface Highlight {
  hovered: TNode | null;
  selected: TNode | null;
  compare: [TNode, TNode] | null;
  /** Nodes that match the active filter; null = no filter. */
  filter: Set<TNode> | null;
}

export interface RendererCallbacks {
  onHover?(node: TNode | null, x: number, y: number): void;
  onClick?(node: TNode | null): void;
  onTime?(s: number, playing: boolean): void;
  onUserMove?(): void;
}

export interface Insets { top: number; right: number; bottom: number; left: number }

interface Particle { node: TNode; t: number; speed: number }
interface Star { x: number; y: number; z: number; r: number; tw: number }

const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Draws the tree of life on a <canvas>. Every element is positioned in an
 * abstract (u, s) space — u = position along the leaves, s = warped time — and
 * then mapped either onto a circle (radial view) or a plane (timeline view).
 * Because both mappings share that space, the two views morph continuously.
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private model: TreeModel;
  private cb: RendererCallbacks;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private raf = 0;
  private lastFrame = performance.now();
  private clock = 0;

  // geometry
  private R = 1000;
  private H = 6000;
  private W = theme.layout.timelineWidth;

  // view state
  private mode: ViewMode = 'radial';
  private morph = 0;
  private morphAnim: { from: number; to: number; start: number } | null = null;
  private rotation = 0;
  private idleSpin = false;
  private sT = 1;
  private timeAnim: { from: number; to: number; start: number; dur: number; ease: (t: number) => number } | null = null;
  private playing = false;

  // highlight state, animated per node
  private hl: Highlight = { hovered: null, selected: null, compare: null, filter: null };
  private alpha: Float32Array;
  private alphaTarget: Float32Array;
  private lineage = new Set<TNode>();
  private lineageB = new Set<TNode>();
  private mrca: TNode | null = null;

  // camera
  private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>;
  private sel: Selection<HTMLCanvasElement, unknown, null, undefined>;
  private transform: ZoomTransform = zoomIdentity;
  private fly: { start: number; dur: number; interp: (t: number) => [number, number, number]; to: ZoomTransform } | null = null;
  private insets: Insets = { top: 72, right: 0, bottom: 120, left: 0 };

  // interaction
  private qt: Quadtree<{ x: number; y: number; n: TNode }> | null = null;
  private qtDirty = true;
  private pointer: { x: number; y: number } | null = null;
  private hoverId: string | null = null;
  /** A mouse pan is in progress (d3-zoom is listening for its mouseup). */
  private dragging = false;

  // decoration
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private rgb = new Map<TNode, RGB>();
  private textWidths = new Map<string, number>();
  /** Branch geometry only changes with morph / time / rotation — not with the camera. */
  private geom: { key: string; branch: (Path2D | null)[]; lines: Map<string, Path2D> } = { key: '', branch: [], lines: new Map() };
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, model: TreeModel, cb: RendererCallbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.model = model;
    this.cb = cb;
    this.alpha = new Float32Array(0);
    this.alphaTarget = new Float32Array(0);
    this.setModel(model);

    for (let i = 0; i < 260; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, r: Math.random() * 1.2 + 0.2, tw: Math.random() * TAU });
    }

    this.sel = select(canvas);
    this.zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.04, 60])
      .on('start', (e) => {
        if (e.sourceEvent) { this.fly = null; this.cb.onUserMove?.(); }
        if (e.sourceEvent?.type === 'mousedown') this.dragging = true;
      })
      .on('zoom', (e) => {
        this.transform = e.transform;
        if (e.sourceEvent) this.fly = null;
      })
      .on('end', () => { this.dragging = false; });
    this.sel.call(this.zoomBehavior).on('dblclick.zoom', null);
    // If the button is released where the page can't see it (another app, browser chrome, an OS gesture),
    // d3-zoom never gets its mouseup and the map stays glued to the cursor. Notice and let go.
    window.addEventListener('pointermove', this.releaseLostDrag, true);
    window.addEventListener('blur', this.releaseLostDrag);

    canvas.addEventListener('pointermove', this.handleMove);
    canvas.addEventListener('pointerleave', this.handleLeave);
    canvas.addEventListener('click', this.handleClick);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.fit(false);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.handleMove);
    this.canvas.removeEventListener('pointerleave', this.handleLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('pointermove', this.releaseLostDrag, true);
    window.removeEventListener('blur', this.releaseLostDrag);
    this.sel.on('.zoom', null);
  }

  // ───────────────────────────── public API ─────────────────────────────

  setModel(model: TreeModel) {
    this.model = model;
    const { leafSpacing, wedge } = theme.layout;
    this.R = (model.uTotal * leafSpacing) / (TAU * (1 - wedge));
    this.H = model.uTotal * leafSpacing;
    this.W = Math.max(theme.layout.timelineWidth, this.H * 0.45);
    this.alpha = new Float32Array(model.nodes.length).fill(1);
    this.alphaTarget = new Float32Array(model.nodes.length).fill(1);
    this.rgb.clear();
    for (const n of model.nodes) this.rgb.set(n, toRgb(n.color));
    this.particles = [];
    this.geom = { key: '', branch: [], lines: new Map() };
    this.lineage.clear();
    this.lineageB.clear();
    this.mrca = null;
    this.hl = { hovered: null, selected: null, compare: null, filter: null };
    this.qtDirty = true;
  }

  getModel() { return this.model; }

  setInsets(insets: Partial<Insets>) { this.insets = { ...this.insets, ...insets }; }

  setMode(mode: ViewMode, refit = true) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.morphAnim = { from: this.morph, to: mode === 'linear' ? 1 : 0, start: performance.now() };
    this.qtDirty = true;
    if (refit) {
      const focus = this.hl.selected;
      // Fly to where things will be once the morph completes.
      setTimeout(() => (focus ? this.focusNode(focus) : this.fit(true)), 30);
    }
  }

  getMode() { return this.mode; }

  setIdleSpin(on: boolean) {
    this.idleSpin = on;
    if (!on) this.qtDirty = true;
  }

  /** Set the time cursor (0 = Earth forms, 1 = today). */
  setTimeS(s: number) {
    this.timeAnim = null;
    this.playing = false;
    this.sT = clamp(s, 0, 1);
    this.cb.onTime?.(this.sT, false);
  }

  getTimeS() { return this.sT; }
  isPlaying() { return this.playing || this.timeAnim !== null; }

  /** Grow the tree from LUCA to today. */
  grow(duration = theme.motion.grow, from = 0) {
    this.playing = false;
    this.timeAnim = { from, to: 1, start: performance.now(), dur: duration, ease: easeCubicInOut };
  }

  play() {
    if (this.sT >= 0.999) this.sT = 0;
    this.timeAnim = null;
    this.playing = true;
  }

  pause() {
    this.playing = false;
    this.timeAnim = null;
    this.cb.onTime?.(this.sT, false);
  }

  setHighlight(hl: Partial<Highlight>) {
    this.hl = { ...this.hl, ...hl };
    const { selected, hovered, compare, filter } = this.hl;
    this.lineage.clear();
    this.lineageB.clear();
    this.mrca = null;
    const focus = selected ?? hovered;
    if (compare) {
      for (const n of this.model.lineage(compare[0])) this.lineage.add(n);
      for (const n of this.model.lineage(compare[1])) this.lineageB.add(n);
      this.mrca = this.model.mrca(compare[0], compare[1]);
    } else if (focus) {
      for (const n of this.model.lineage(focus)) this.lineage.add(n);
    }

    let filterAncestors: Set<TNode> | null = null;
    if (filter) {
      filterAncestors = new Set();
      for (const n of filter) for (let p = n.parent; p && !filterAncestors.has(p); p = p.parent) filterAncestors.add(p);
    }
    const focusDesc = focus && !compare ? new Set(this.model.descendants(focus)) : null;

    for (const n of this.model.nodes) {
      let a = 1;
      if (filter) a = filter.has(n) ? 1 : filterAncestors!.has(n) ? 0.5 : 0.07;
      if (compare) a = this.lineage.has(n) || this.lineageB.has(n) ? 1 : Math.min(a, 0.1);
      else if (focus) {
        const strong = selected !== null;
        if (this.lineage.has(n) || focusDesc!.has(n)) a = Math.max(a, strong ? 1 : 0.9);
        else a = Math.min(a, strong ? 0.13 : 0.3);
      }
      this.alphaTarget[n.index] = a;
    }
  }

  /** Smoothly fly the camera to frame these nodes. */
  focusNodes(nodes: TNode[], maxK = 6, duration?: number) {
    if (!nodes.length) return;
    const m = this.morphTargetValue();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      for (const s of [n.sStart, n.children.length ? n.sStart : n.sEnd]) {
        const [x, y] = this.pos(n.u, s, m, this.rotation);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    const pad = 140;
    this.flyToBox(x0, y0, x1, y1, pad, maxK, duration);
  }

  focusNode(n: TNode, duration?: number) {
    // Leaves are framed together with their siblings, so there is context around them.
    const group = n.children.length ? this.model.descendants(n) : n.parent ? this.model.descendants(n.parent) : [n];
    this.focusNodes(group, n.children.length ? 5 : 3.2, duration);
  }

  /** Frame the whole tree. */
  fit(animate = true) {
    if (this.morphTargetValue() > 0.5) {
      // The timeline is tall: fit its width and start at the top.
      const { w } = this.viewport();
      const k = (w * 0.9) / (this.W * 1.15);
      const t = zoomIdentity.translate(this.insets.left + w / 2, this.insets.top + 40 + (this.H / 2) * k).scale(k);
      return animate ? this.flyTo(t) : this.jumpTo(t);
    }
    this.flyToBox(-this.R, -this.R, this.R, this.R, 30, 100, animate ? undefined : 0);
  }

  zoomBy(f: number) {
    const { w, h } = this.viewport();
    const cx = this.insets.left + w / 2, cy = this.insets.top + h / 2;
    const t = this.transform;
    const k = clamp(t.k * f, 0.04, 60);
    const wx = (cx - t.x) / t.k, wy = (cy - t.y) / t.k;
    this.flyTo(zoomIdentity.translate(cx - wx * k, cy - wy * k).scale(k), 450);
  }

  /** World → screen position of a node (for anchoring HTML overlays). */
  screenPos(n: TNode): [number, number] {
    const [x, y] = this.pos(n.u, n.sStart, this.morph, this.rotation);
    return [this.transform.applyX(x), this.transform.applyY(y)];
  }

  // ───────────────────────────── geometry ─────────────────────────────

  private morphTargetValue() { return this.mode === 'linear' ? 1 : 0; }

  private angle(u: number, rot: number) {
    const { wedge } = theme.layout;
    return -Math.PI / 2 + wedge * Math.PI + ((u + 0.5) / this.model.uTotal) * TAU * (1 - wedge) + rot;
  }

  /** (u, s) → world coordinates for a morph value m. */
  private pos(u: number, s: number, m: number, rot: number): [number, number] {
    let rx = 0, ry = 0, lx = 0, ly = 0;
    if (m < 1) {
      const a = this.angle(u, rot), r = s * this.R;
      rx = Math.cos(a) * r; ry = Math.sin(a) * r;
      if (m === 0) return [rx, ry];
    }
    lx = (s - 0.5) * this.W;
    ly = ((u + 0.5) / this.model.uTotal - 0.5) * this.H;
    if (m === 1) return [lx, ly];
    const e = m;
    return [lerp(rx, lx, e), lerp(ry, ly, e)];
  }

  private viewport() {
    return {
      w: Math.max(100, this.w - this.insets.left - this.insets.right),
      h: Math.max(100, this.h - this.insets.top - this.insets.bottom),
    };
  }

  private flyToBox(x0: number, y0: number, x1: number, y1: number, pad: number, maxK: number, duration?: number) {
    const { w, h } = this.viewport();
    const bw = Math.max(x1 - x0, 1) + pad * 2, bh = Math.max(y1 - y0, 1) + pad * 2;
    const k = clamp(Math.min(w / bw, h / bh), 0.04, maxK);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const t = zoomIdentity.translate(this.insets.left + w / 2 - cx * k, this.insets.top + h / 2 - cy * k).scale(k);
    if (duration === 0) this.jumpTo(t);
    else this.flyTo(t, duration);
  }

  private jumpTo(t: ZoomTransform) {
    this.fly = null;
    this.zoomBehavior.transform(this.sel, t);
    this.transform = t;
  }

  private flyTo(to: ZoomTransform, duration?: number) {
    const from = this.transform;
    const { w, h } = this.viewport();
    const size = Math.min(w, h);
    // interpolateZoom works on [centerX, centerY, viewSize] in world space.
    const cx = this.insets.left + w / 2, cy = this.insets.top + h / 2;
    const a: [number, number, number] = [(cx - from.x) / from.k, (cy - from.y) / from.k, size / from.k];
    const b: [number, number, number] = [(cx - to.x) / to.k, (cy - to.y) / to.k, size / to.k];
    const interp = (interpolateZoom as typeof interpolateZoom & { rho(r: number): typeof interpolateZoom }).rho(1.3)(a, b);
    const dur = duration ?? clamp(interp.duration * 0.9, 700, 2400);
    this.fly = {
      start: performance.now(),
      dur,
      to,
      interp: (t) => {
        const [x, y, s] = interp(t);
        const k = size / s;
        return [cx - x * k, cy - y * k, k];
      },
    };
  }

  // ───────────────────────────── interaction ─────────────────────────────

  private handleMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.updateHover();
  };

  private releaseLostDrag = (e: Event) => {
    if (!this.dragging) return;
    if (e instanceof PointerEvent && (e.pointerType === 'touch' || e.buttons & 1)) return;
    this.dragging = false;
    // d3-zoom ends the pan on a window mouseup, so hand it the one it missed.
    window.dispatchEvent(new MouseEvent('mouseup', { view: window }));
  };

  private handleLeave = () => {
    this.pointer = null;
    if (this.hoverId !== null) { this.hoverId = null; this.cb.onHover?.(null, 0, 0); }
  };

  private handleClick = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const n = this.pick(e.clientX - r.left, e.clientY - r.top);
    this.cb.onClick?.(n);
  };

  private updateHover() {
    if (!this.pointer) return;
    const n = this.morphAnim || this.idleSpin ? null : this.pick(this.pointer.x, this.pointer.y);
    const id = n?.id ?? null;
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.canvas.style.cursor = n ? 'pointer' : 'grab';
    }
    this.cb.onHover?.(n, this.pointer.x, this.pointer.y);
  }

  private pick(sx: number, sy: number): TNode | null {
    if (this.qtDirty || !this.qt) this.buildQuadtree();
    const t = this.transform;
    const wx = (sx - t.x) / t.k, wy = (sy - t.y) / t.k;
    const hit = this.qt!.find(wx, wy, 16 / t.k);
    if (!hit) return null;
    return this.visible(hit.n) ? hit.n : null;
  }

  private buildQuadtree() {
    const pts: { x: number; y: number; n: TNode }[] = [];
    const m = this.morph;
    for (const n of this.model.nodes) {
      const [x, y] = this.pos(n.u, n.sStart, m, this.rotation);
      pts.push({ x, y, n });
      if (!n.children.length) {
        const [ex, ey] = this.pos(n.u, n.sEnd, m, this.rotation);
        pts.push({ x: ex, y: ey, n });
        const [mx, my] = this.pos(n.u, (n.sStart + n.sEnd) / 2, m, this.rotation);
        pts.push({ x: mx, y: my, n });
      }
    }
    this.qt = quadtree<{ x: number; y: number; n: TNode }>().x((d) => d.x).y((d) => d.y).addAll(pts);
    this.qtDirty = false;
  }

  private visible(n: TNode) { return n.sStart <= this.sT + 1e-6; }

  // ───────────────────────────── frame loop ─────────────────────────────

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.clock += dt;
    this.step(now, dt);
    this.draw(dt);
  };

  private step(now: number, dt: number) {
    if (this.morphAnim) {
      const t = clamp((now - this.morphAnim.start) / theme.motion.morph, 0, 1);
      this.morph = lerp(this.morphAnim.from, this.morphAnim.to, easeCubicInOut(t));
      if (t >= 1) { this.morphAnim = null; this.qtDirty = true; }
    }
    if (this.idleSpin) { this.rotation += dt * 0.035; this.qtDirty = true; }

    if (this.timeAnim) {
      const t = clamp((now - this.timeAnim.start) / this.timeAnim.dur, 0, 1);
      this.sT = lerp(this.timeAnim.from, this.timeAnim.to, this.timeAnim.ease(t));
      this.cb.onTime?.(this.sT, t < 1);
      if (t >= 1) this.timeAnim = null;
    } else if (this.playing) {
      this.sT = Math.min(1, this.sT + dt / theme.motion.playback);
      if (this.sT >= 1) this.playing = false;
      this.cb.onTime?.(this.sT, this.playing);
    }

    if (this.fly) {
      const t = clamp((now - this.fly.start) / this.fly.dur, 0, 1);
      if (t >= 1) { this.jumpTo(this.fly.to); this.fly = null; }
      else {
        const [x, y, k] = this.fly.interp(easeCubicInOut(t));
        const tr = zoomIdentity.translate(x, y).scale(k);
        this.zoomBehavior.transform(this.sel, tr);
        this.transform = tr;
      }
    }

    // ease per-node emphasis
    const a = this.alpha, at = this.alphaTarget;
    const f = 1 - Math.pow(0.0005, dt);
    for (let i = 0; i < a.length; i++) a[i] += (at[i] - a[i]) * f;
  }

  private draw(dt: number) {
    const { ctx, dpr, w, h } = this;
    const t = this.transform;
    const m = this.morph;
    const rot = this.rotation;
    const sqrtK = Math.sqrt(t.k);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.drawStars(dt);

    ctx.setTransform(dpr * t.k, 0, 0, dpr * t.k, dpr * t.x, dpr * t.y);
    this.drawBands(m, rot);
    this.drawEvents(m, rot);

    const nodes = this.model.nodes;
    const sT = this.sT;
    this.ensureGeometry(m, rot, sT);
    const maxLC = Math.log(1 + this.model.maxLeafCount);

    // ── branches: a soft additive glow pass, then the crisp core.
    for (const pass of [0, 1] as const) {
      ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const n of nodes) {
        if (!n.parent || !this.visible(n.parent)) continue;
        const alpha = this.alpha[n.index];
        if (alpha < 0.02) continue;
        const thick = 0.7 + 3.4 * Math.pow(Math.log(1 + n.leafCount) / maxLC, 1.35);
        const lw = thick / sqrtK;
        const col = this.rgb.get(n)!;
        const fossil = n.extinct && sT >= n.sEnd - 1e-6;
        if (pass === 0) {
          ctx.strokeStyle = rgba(col, 0.09 * alpha);
          ctx.lineWidth = lw * 5;
        } else {
          ctx.strokeStyle = rgba(col, (fossil ? 0.55 : 0.92) * alpha);
          ctx.lineWidth = lw;
        }
        const path = this.geom.branch[n.index];
        if (path) ctx.stroke(path);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    this.drawHybrids(m, rot);
    this.drawLineages(sqrtK);
    this.drawParticles(dt, m, rot, sqrtK);
    this.drawNodes(m, rot, sqrtK);
    this.drawTimeFront(m, rot);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawLabels(m, rot);
  }

  private ensureGeometry(m: number, rot: number, sT: number) {
    const key = `${m.toFixed(4)}|${rot.toFixed(4)}|${sT.toFixed(5)}|${this.model.nodes.length}`;
    if (key === this.geom.key) return;
    const branch: (Path2D | null)[] = new Array(this.model.nodes.length).fill(null);
    for (const n of this.model.nodes) {
      if (!n.parent || !this.visible(n.parent)) continue;
      const p = new Path2D();
      this.traceBranch(p, n, m, rot, sT);
      branch[n.index] = p;
    }
    this.geom = { key, branch, lines: new Map() };
  }

  /** Cached closed band (s0..s1) or open line (s) path, morph-aware. */
  private cachedShape(id: string, build: (p: Path2D) => void): Path2D {
    let p = this.geom.lines.get(id);
    if (!p) { p = new Path2D(); build(p); this.geom.lines.set(id, p); }
    return p;
  }

  /** Path from the parent to n, then n's own lifespan if it is a leaf, clipped at time sT. */
  private traceBranch(path: Path2D, n: TNode, m: number, rot: number, sT: number) {
    const p = n.parent!;
    const sp = p.sStart, sc = n.sStart;
    const span = sc - sp;
    const tEnd = span <= 1e-9 ? 1 : clamp((sT - sp) / span, 0, 1);
    const du = Math.abs(n.u - p.u) / this.model.uTotal;
    const steps = Math.max(4, Math.ceil(6 + du * 120 * (1 - m * 0.7)));
    for (let i = 0; i <= steps; i++) {
      const tt = (i / steps) * tEnd;
      const e = 1 - Math.pow(1 - tt, 3);
      const [x, y] = this.pos(lerp(p.u, n.u, e), sp + span * tt, m, rot);
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    if (tEnd >= 1 && !n.children.length) {
      const end = Math.min(n.sEnd, sT);
      if (end > sc) {
        // straight in both views, but arcs need no subdivision here (constant u)
        const [x, y] = this.pos(n.u, end, m, rot);
        path.lineTo(x, y);
      }
    }
  }

  private bandPath(ctx: Path2D, s0: number, s1: number, m: number, rot: number) {
    const U = this.model.uTotal;
    const steps = 96;
    const u0 = -0.5 - 1, u1 = U - 0.5 + 1;
    for (let i = 0; i <= steps; i++) {
      const [x, y] = this.pos(lerp(u0, u1, i / steps), s1, m, rot);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const [x, y] = this.pos(lerp(u0, u1, i / steps), s0, m, rot);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private linePath(ctx: Path2D, s: number, m: number, rot: number) {
    const U = this.model.uTotal;
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const [x, y] = this.pos(lerp(-1.5, U + 0.5, i / steps), s, m, rot);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  private drawBands(m: number, rot: number) {
    const { ctx } = this;
    const k = this.transform.k;
    const scale = this.model.scale;
    const bands = this.model.bands;
    bands.forEach((b, i) => {
      const s0 = scale.s(b.start), s1 = scale.s(b.end);
      if (s0 > this.sT) return;
      const rgb = toRgb(b.color);
      ctx.fillStyle = rgba(rgb, i % 2 ? 0.045 : 0.07);
      ctx.fill(this.cachedShape(`band:${b.id}`, (p) => this.bandPath(p, s0, Math.min(s1, this.sT), m, rot)));
    });
    // boundaries
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (const b of bands) {
      const s = scale.s(b.end);
      if (s > this.sT || b.end <= 0) continue;
      ctx.stroke(this.cachedShape(`line:${s}`, (p) => this.linePath(p, s, m, rot)));
    }
    // labels at the open wedge (radial) or along the top (timeline)
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `600 10.5px ${theme.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of bands) {
      const s0 = scale.s(b.start), s1 = scale.s(b.end);
      if (s0 > this.sT) continue;
      const uL = -2.6;
      const [ax, ay] = this.toScreen(this.pos(uL, s0, m, rot));
      const [bx, by] = this.toScreen(this.pos(uL, Math.min(s1, this.sT), m, rot));
      const room = Math.hypot(bx - ax, by - ay);
      const label = b.name.toUpperCase();
      const need = lerp(15, this.measure(label, 10.5) + 10, m);
      if (room < need) continue;
      ctx.fillStyle = rgba(toRgb(b.color), 0.75);
      ctx.fillText(label, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.restore();
  }

  private drawEvents(m: number, rot: number) {
    const { ctx } = this;
    const k = this.transform.k;
    const scale = this.model.scale;
    ctx.save();
    for (const ev of this.model.dataset.time.events) {
      if (ev.kind !== 'extinction') continue;
      const s = scale.s(ev.time);
      if (s > this.sT) continue;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * 2 + ev.time);
      ctx.setLineDash([6 / k, 6 / k]);
      ctx.lineWidth = 1.4 / k;
      ctx.strokeStyle = rgba(toRgb(theme.extinction), 0.35 + pulse * 0.25);
      ctx.stroke(this.cachedShape(`line:${s}`, (p) => this.linePath(p, s, m, rot)));
    }
    ctx.restore();
    // emoji markers at the wedge / top
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `14px ${theme.fonts.ui}`;
    for (const ev of this.model.dataset.time.events) {
      const s = scale.s(ev.time);
      if (s > this.sT) continue;
      const [x, y] = this.toScreen(this.pos(lerp(-6.5, -9, m), s, m, rot));
      ctx.globalAlpha = ev.kind === 'extinction' ? 0.95 : 0.6;
      ctx.fillText(ev.emoji, x, y);
    }
    ctx.restore();
  }

  private drawHybrids(m: number, rot: number) {
    const { ctx } = this;
    const k = this.transform.k;
    const col = toRgb(theme.hybrid);
    ctx.save();
    ctx.setLineDash([5 / k, 5 / k]);
    ctx.lineDashOffset = -this.clock * 18 / k;
    ctx.lineCap = 'round';
    for (const n of this.model.nodes) {
      if (!n.hybrids.length || !this.visible(n)) continue;
      const a = this.alpha[n.index];
      if (a < 0.05) continue;
      for (const h of n.hybrids) {
        const s0 = h.children.length ? h.sStart : clamp(n.sStart, h.sStart, h.sEnd);
        const s1 = n.sStart;
        const du = Math.abs(n.u - h.u) / this.model.uTotal;
        const bulge = Math.min(0.12, 0.04 + du * 0.25);
        const steps = Math.ceil(16 + du * 160);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const e = t * t * (3 - 2 * t);
          const s = lerp(s0, s1, t) - Math.sin(Math.PI * t) * bulge * (1 - m * 0.4);
          const [x, y] = this.pos(lerp(h.u, n.u, e), Math.max(0.005, s), m, rot);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const focused = this.lineage.has(n) || this.hl.selected === h;
        ctx.strokeStyle = rgba(col, (focused ? 0.95 : 0.55) * a);
        ctx.lineWidth = (focused ? 2.2 : 1.2) / Math.sqrt(k);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawLineages(sqrtK: number) {
    const { ctx } = this;
    const sets: [Set<TNode>, string][] = this.hl.compare
      ? [[this.lineage, theme.compareA], [this.lineageB, theme.compareB]]
      : [[this.lineage, theme.lineage]];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [set, color] of sets) {
      if (!set.size) continue;
      const rgb = toRgb(color);
      for (const pass of [0, 1, 2]) {
        ctx.globalCompositeOperation = pass < 2 ? 'lighter' : 'source-over';
        const base = 2.6 / sqrtK;
        if (pass === 0) { ctx.strokeStyle = rgba(rgb, 0.08); ctx.lineWidth = base * 7; }
        else if (pass === 1) { ctx.strokeStyle = rgba(rgb, 0.22); ctx.lineWidth = base * 2.6; }
        else { ctx.strokeStyle = rgba(rgb, 0.95); ctx.lineWidth = base * 0.8; }
        for (const n of set) {
          const path = this.geom.branch[n.index];
          if (path) ctx.stroke(path);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private spawn(): Particle {
    const root = this.model.root;
    return { node: this.pickChild(root) ?? root, t: 0, speed: 0.6 + Math.random() * 0.8 };
  }

  private pickChild(n: TNode): TNode | null {
    if (!n.children.length) return null;
    const inLineage = n.children.filter((c) => this.lineage.has(c) || this.lineageB.has(c));
    if (inLineage.length && Math.random() < 0.7) return inLineage[(Math.random() * inLineage.length) | 0];
    let r = Math.random() * n.leafCount;
    for (const c of n.children) { r -= c.leafCount; if (r <= 0) return c; }
    return n.children[n.children.length - 1];
  }

  private drawParticles(dt: number, m: number, rot: number, sqrtK: number) {
    const { ctx } = this;
    if (!this.model.root.children.length) return;
    const target = theme.motion.particles;
    while (this.particles.length < target) {
      const p = this.spawn();
      p.t = Math.random();
      this.particles.push(p);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const n = p.node;
      const par = n.parent!;
      const span = Math.max(0.01, n.sStart - par.sStart);
      p.t += (dt * p.speed * 0.09) / span;
      if (p.t >= 1) {
        const c = this.pickChild(n);
        if (c) { p.node = c; p.t = 0; } else { this.particles[i] = this.spawn(); }
        continue;
      }
      const sNow = par.sStart + span * p.t;
      if (sNow > this.sT) continue;
      const a = this.alpha[n.index];
      if (a < 0.1) continue;
      const e = 1 - Math.pow(1 - p.t, 3);
      const [x, y] = this.pos(lerp(par.u, n.u, e), sNow, m, rot);
      const tb = Math.max(0, p.t - 0.06);
      const eb = 1 - Math.pow(1 - tb, 3);
      const [bx, by] = this.pos(lerp(par.u, n.u, eb), par.sStart + span * tb, m, rot);
      const col = this.lineage.has(n) ? toRgb(theme.lineage) : this.rgb.get(n)!;
      ctx.strokeStyle = rgba(col, 0.5 * a);
      ctx.lineWidth = 2.2 / sqrtK;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 / sqrtK, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawNodes(m: number, rot: number, sqrtK: number) {
    const { ctx } = this;
    const k = this.transform.k;
    for (const n of this.model.nodes) {
      if (!this.visible(n)) continue;
      const a = this.alpha[n.index];
      if (a < 0.04) continue;
      const col = this.rgb.get(n)!;
      const [x, y] = this.pos(n.u, n.sStart, m, rot);
      const landmark = n.data.tags?.includes('landmark');
      if (n === this.model.root) {
        const pulse = 1 + 0.15 * Math.sin(this.clock * 2.2);
        const r = (14 * pulse) / sqrtK;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, 'rgba(255,250,220,0.95)');
        g.addColorStop(0.25, 'rgba(255,220,150,0.45)');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, TAU);
        ctx.fill();
        continue;
      }
      const isLeaf = !n.children.length;
      const r = (isLeaf ? 1.5 : landmark ? 3.2 : 2) / sqrtK;
      if (k * r < 0.6 && !landmark) continue;
      ctx.fillStyle = rgba(col, a);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (landmark) {
        ctx.strokeStyle = rgba(col, 0.6 * a);
        ctx.lineWidth = 1 / sqrtK;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, TAU);
        ctx.stroke();
      }
      // leaf tips: a dot for the living, a hollow ring for the extinct
      if (isLeaf && this.sT >= n.sEnd - 1e-6) {
        const [ex, ey] = this.pos(n.u, n.sEnd, m, rot);
        ctx.beginPath();
        ctx.arc(ex, ey, 2 / sqrtK, 0, TAU);
        if (n.extinct) { ctx.strokeStyle = rgba(col, 0.8 * a); ctx.lineWidth = 0.9 / sqrtK; ctx.stroke(); }
        else { ctx.fillStyle = rgba(col, a); ctx.fill(); }
      }
    }

    // pulse rings for selection, hover, comparison
    const rings: [TNode | null, string][] = [
      [this.hl.selected, theme.lineage],
      [this.hl.hovered, theme.lineage],
      [this.hl.compare?.[0] ?? null, theme.compareA],
      [this.hl.compare?.[1] ?? null, theme.compareB],
      [this.mrca, theme.hybrid],
    ];
    for (const [n, color] of rings) {
      if (!n || !this.visible(n)) continue;
      const tip = !n.children.length ? n.sEnd : n.sStart;
      const [x, y] = this.pos(n.u, Math.min(tip, this.sT), m, rot);
      const ph = (this.clock * 0.9) % 1;
      const rgb = toRgb(color);
      for (const off of [0, 0.5]) {
        const q = (ph + off) % 1;
        ctx.strokeStyle = rgba(rgb, (1 - q) * 0.8);
        ctx.lineWidth = 1.6 / k;
        ctx.beginPath();
        ctx.arc(x, y, (6 + q * 22) / k, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(rgb, 1);
      ctx.beginPath();
      ctx.arc(x, y, 3.5 / k, 0, TAU);
      ctx.fill();
    }
  }

  private drawTimeFront(m: number, rot: number) {
    if (this.sT >= 0.9995) return;
    const { ctx } = this;
    const k = this.transform.k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const front = this.cachedShape('front', (p) => this.linePath(p, this.sT, m, rot));
    for (const [wid, al] of [[18, 0.05], [7, 0.12], [1.6, 0.85]] as const) {
      ctx.strokeStyle = `rgba(190,235,255,${al})`;
      ctx.lineWidth = wid / k;
      ctx.stroke(front);
    }
    ctx.restore();
    const [x, y] = this.toScreen(this.pos(-2.6, this.sT, m, rot));
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `700 12px ${theme.fonts.ui}`;
    ctx.textAlign = m > 0.5 ? 'center' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(220,245,255,0.95)';
    ctx.fillText(formatTick(this.model.scale.t(this.sT)), m > 0.5 ? x : x - 8, m > 0.5 ? y - 14 : y);
    ctx.restore();
  }

  private drawStars(dt: number) {
    const { ctx, w, h } = this;
    const t = this.transform;
    for (const s of this.stars) {
      s.tw += dt * (0.6 + s.z);
      const px = ((s.x * w + t.x * 0.03 * s.z) % w + w) % w;
      const py = ((s.y * h + t.y * 0.03 * s.z) % h + h) % h;
      const a = (0.25 + 0.35 * Math.sin(s.tw) ** 2) * s.z;
      ctx.fillStyle = `rgba(200,220,255,${a.toFixed(3)})`;
      ctx.fillRect(px - s.r, py - s.r, s.r * 2, s.r * 2);
    }
  }

  private toScreen([x, y]: [number, number]): [number, number] {
    const t = this.transform;
    return [x * t.k + t.x, y * t.k + t.y];
  }

  private measure(text: string, size: number) {
    const key = text;
    let w = this.textWidths.get(key);
    if (w === undefined) {
      this.ctx.save();
      this.ctx.font = `500 100px ${theme.fonts.ui}`;
      w = this.ctx.measureText(text).width / 100;
      this.ctx.restore();
      this.textWidths.set(key, w);
    }
    return w * size;
  }

  private drawLabels(m: number, rot: number) {
    const { ctx, w, h } = this;
    const k = this.transform.k;
    const placed: [number, number, number, number][] = [];
    const overlaps = (x0: number, y0: number, x1: number, y1: number) => {
      for (const b of placed) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return true;
      return false;
    };
    const onScreen = (x: number, y: number, pad = 60) => x > -pad && x < w + pad && y > -pad && y < h + pad;

    // 1) Clade labels (internal nodes): pill labels, collision-culled by importance.
    const internals = this.model.nodes
      .filter((n) => n.children.length && n !== this.model.root && this.visible(n))
      .map((n) => {
        const important = this.lineage.has(n) || this.lineageB.has(n) || n === this.mrca || n === this.hl.hovered;
        const landmark = n.data.tags?.includes('landmark') ? 1 : 0;
        return { n, pri: (important ? 1e6 : 0) + landmark * 1e4 + n.leafCount * 10 - n.depth };
      })
      .sort((a, b) => b.pri - a.pri);

    ctx.textBaseline = 'middle';
    for (const { n, pri } of internals) {
      const a = this.alpha[n.index];
      if (a < 0.25) continue;
      const [x, y] = this.toScreen(this.pos(n.u, n.sStart, m, rot));
      if (!onScreen(x, y)) continue;
      // room the clade occupies on screen
      const arc = n.leafCount * theme.layout.leafSpacing * k * lerp(Math.max(n.sStart, 0.25), 1, m);
      const important = pri >= 1e6;
      const size = important ? 13 : clamp(9 + Math.log2(1 + arc / 80), 10, 14);
      const label = `${n.data.emoji ? n.data.emoji + ' ' : ''}${n.data.name}`;
      const tw = this.measure(label, size);
      if (!important && arc < tw * 0.9) continue;
      const bx = x - tw / 2 - 7, by = y - size * 1.9 - 4;
      const bw = tw + 14, bh = size + 9;
      if (overlaps(bx, by, bx + bw, by + bh)) continue;
      placed.push([bx, by, bx + bw, by + bh]);
      const col = this.rgb.get(n)!;
      ctx.globalAlpha = Math.min(1, a * 1.15);
      ctx.fillStyle = important ? 'rgba(14,18,40,0.92)' : 'rgba(8,10,26,0.72)';
      roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.strokeStyle = rgba(col, important ? 0.9 : 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = important ? '#fff' : rgba(col, 0.95);
      ctx.font = `${important ? 650 : 560} ${size}px ${theme.fonts.ui}`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x, by + bh / 2 + 0.5);
      // little stem to the node
      ctx.strokeStyle = rgba(col, 0.35);
      ctx.beginPath();
      ctx.moveTo(x, by + bh);
      ctx.lineTo(x, y - 3);
      ctx.stroke();
    }

    // 2) Leaf labels along the rim (radial) or to the right (timeline).
    for (const n of this.model.leaves) {
      if (!this.visible(n)) continue;
      const a = this.alpha[n.index];
      if (a < 0.2) continue;
      const end = Math.min(n.sEnd, this.sT);
      const spacing = theme.layout.leafSpacing * k * lerp(Math.max(end, 0.05), 1, m);
      const important = this.lineage.has(n) || this.lineageB.has(n) || n === this.hl.hovered;
      // Famous leaves (T. rex, E. coli…) stay labelled even when zoomed out.
      const landmark = spacing < 8.5 && n.data.tags?.includes('landmark');
      if (spacing < 8.5 && !important && !landmark) continue;
      const [x, y] = this.toScreen(this.pos(n.u, end, m, rot));
      if (!onScreen(x, y, 200)) continue;
      const size = important ? 13 : landmark ? 11 : clamp(spacing * 0.78, 8, 13.5);
      const ang = this.angle(n.u, rot);
      const flip = Math.cos(ang) < 0;
      const a0 = flip ? ang + Math.PI : ang;
      const rotA = lerp(Math.atan2(Math.sin(a0), Math.cos(a0)), 0, m);
      const label = `${n.data.emoji ? n.data.emoji + ' ' : ''}${n.data.name}`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotA);
      const right = m > 0.5 || !flip;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.font = `${important ? 650 : 500} ${size}px ${theme.fonts.ui}`;
      const col = this.rgb.get(n)!;
      ctx.globalAlpha = a;
      if (important) {
        const tw = this.measure(label, size);
        ctx.fillStyle = 'rgba(10,12,30,0.85)';
        roundRect(ctx, right ? 4 : -tw - 14, -size * 0.8, tw + 10, size * 1.6, 5);
        ctx.fill();
      }
      ctx.fillStyle = important ? '#fff' : n.extinct ? rgba(col, 0.62) : rgba(col, 0.92);
      ctx.fillText(label, right ? 9 : -9, 0.5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

