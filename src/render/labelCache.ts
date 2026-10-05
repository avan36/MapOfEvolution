/**
 * Pre-rendered label sprites. Drawing text (above all emoji) with fillText every
 * frame is the most expensive part of a frame, so each distinct label is rasterised
 * once into a small canvas and then blitted with drawImage.
 */
export interface LabelStyle {
  font: string;
  /** Font size in CSS px (also sets the sprite height). */
  size: number;
  color: string;
  /** Optional rounded background box. */
  bg?: string;
  border?: string;
  /** Horizontal padding inside the box, CSS px. */
  padX?: number;
  /** Box height, CSS px (defaults to the text line height). */
  boxH?: number;
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size in CSS px. */
  w: number;
  h: number;
}

const MAX_SPRITES = 600;

export class LabelCache {
  private sprites = new Map<string, Sprite>();
  private dpr = 1;

  setDpr(dpr: number) {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.sprites.clear();
  }

  clear() { this.sprites.clear(); }

  private scratch = document.createElement('canvas').getContext('2d')!;

  get(text: string, st: LabelStyle): Sprite {
    const key = `${text}\u0000${st.font}\u0000${st.color}\u0000${st.bg ?? ''}\u0000${st.border ?? ''}\u0000${st.padX ?? 0}\u0000${st.boxH ?? 0}`;
    const hit = this.sprites.get(key);
    if (hit) {
      // keep recently used sprites at the end (LRU)
      this.sprites.delete(key);
      this.sprites.set(key, hit);
      return hit;
    }
    this.scratch.font = st.font;
    const textWidth = this.scratch.measureText(text).width;
    const padX = st.padX ?? 0;
    const h = Math.ceil(st.boxH ?? st.size * 1.6) + 2;
    const w = Math.ceil(textWidth + padX * 2) + 2;
    const canvas = document.createElement('canvas');
    const dpr = this.dpr;
    canvas.width = Math.max(1, Math.ceil(w * dpr));
    canvas.height = Math.max(1, Math.ceil(h * dpr));
    const c = canvas.getContext('2d')!;
    c.scale(dpr, dpr);
    if (st.bg) {
      const bh = h - 2, bw = w - 2, r = Math.min(bh / 2, padX > 6 ? bh / 2 : 5);
      c.beginPath();
      c.roundRect(1, 1, bw, bh, r);
      c.fillStyle = st.bg;
      c.fill();
      if (st.border) { c.strokeStyle = st.border; c.lineWidth = 1; c.stroke(); }
    }
    c.font = st.font;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = st.color;
    c.fillText(text, w / 2, h / 2 + 0.5);
    const sprite = { canvas, w, h };
    this.sprites.set(key, sprite);
    if (this.sprites.size > MAX_SPRITES) {
      const oldest = this.sprites.keys().next().value!;
      this.sprites.delete(oldest);
    }
    return sprite;
  }
}
