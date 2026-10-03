import { useEffect, useState } from 'react';
import type { TaxonNode } from '../data/types';
import { theme } from '../theme';

/**
 * Pictures come from English Wikipedia, fetched in the browser (both APIs below allow CORS).
 *
 *  - Lead photos: batched MediaWiki `pageimages` queries, up to 50 titles per request, so
 *    prefetching (hover cards, compare cards) costs almost nothing.
 *  - Galleries: the REST `media-list` endpoint, filtered to photos.
 *
 * Each node tries a chain of titles — `image`, `wiki`, scientific name, name — and shows the
 * first that has a photo and isn't a disambiguation page. Everything resolves to `null` when
 * offline or blocked, and the UI falls back to the emoji.
 */

const API = 'https://en.wikipedia.org/w/api.php';
const REST = 'https://en.wikipedia.org/api/rest_v1';
/** Wikimedia serves a fixed set of thumbnail widths; stick to those. */
const HERO_W = 960;
const THUMB_W = 250;

export interface Photo {
  /** ~960px wide, for the detail panel. */
  src: string;
  /** Small (~250px) version for hover cards and thumbnails. */
  thumb: string;
  /** Largest sensible version, for the lightbox. */
  large: string;
  width?: number;
  height?: number;
  /** Wikipedia article the photo came from. */
  article: string;
  /** "File:…" page on Wikipedia, for credit/licensing. */
  file?: string;
  caption?: string;
}

export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

const resize = (url: string, w: number) => url.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`);
const isUrl = (s: string) => /^https?:\/\//i.test(s);
const key = (t: string) => {
  const s = t.trim().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ------------------------------------------------------------------ lead photos */

interface PageHit { article: string; photo: Photo | null }

const pageCache = new Map<string, Promise<PageHit | null>>();
let queue: { title: string; resolve(v: PageHit | null): void }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function pageImage(title: string): Promise<PageHit | null> {
  const k = key(title);
  let p = pageCache.get(k);
  if (!p) {
    p = new Promise((resolve) => {
      queue.push({ title: k, resolve });
      timer ??= setTimeout(flush, 25);
    });
    pageCache.set(k, p);
  }
  return p;
}

function flush() {
  timer = undefined;
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += 50) void lookup(batch.slice(i, i + 50));
}

async function lookup(items: { title: string; resolve(v: PageHit | null): void }[]) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    redirects: '1',
    prop: 'pageimages|pageprops',
    piprop: 'thumbnail|original|name',
    pithumbsize: String(HERO_W),
    pilimit: '50',
    ppprop: 'disambiguation',
    titles: items.map((i) => i.title).join('|'),
  });
  try {
    const r = await fetch(`${API}?${params}`);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const q = j.query ?? {};
    // Follow the title through normalisation and redirects to the page it lands on.
    const hop = new Map<string, string>();
    for (const n of q.normalized ?? []) hop.set(n.from, n.to);
    for (const n of q.redirects ?? []) hop.set(n.from, n.to);
    const pages = new Map<string, any>();
    for (const pg of q.pages ?? []) pages.set(pg.title, pg);
    for (const it of items) {
      let t = it.title;
      for (let i = 0; i < 4 && hop.has(t); i++) t = hop.get(t)!;
      const pg = pages.get(t);
      if (!pg || pg.missing || pg.invalid || pg.pageprops?.disambiguation !== undefined) {
        it.resolve(null);
        continue;
      }
      const th = pg.thumbnail?.source as string | undefined;
      const orig = pg.original as { source: string; width: number; height: number } | undefined;
      const photo: Photo | null =
        th || orig
          ? {
              src: th ?? orig!.source,
              thumb: th && (orig?.width ?? Infinity) > THUMB_W ? resize(th, THUMB_W) : th ?? orig!.source,
              large: orig && orig.width <= 2400 ? orig.source : th ? resize(th, 1920) : orig!.source,
              width: orig?.width ?? pg.thumbnail?.width,
              height: orig?.height ?? pg.thumbnail?.height,
              article: pg.title,
              file: pg.pageimage ? `File:${pg.pageimage}` : undefined,
            }
          : null;
      it.resolve({ article: pg.title, photo });
    }
  } catch {
    // Network trouble: forget these so a later attempt can retry.
    for (const it of items) {
      pageCache.delete(it.title);
      it.resolve(null);
    }
  }
}

type ImageSource = Pick<TaxonNode, 'image' | 'wiki' | 'scientific' | 'name'>;

/** The titles to try for a node, best first. */
function candidates(d: ImageSource): string[] {
  const out: string[] = [];
  for (const t of [d.image, d.wiki, d.scientific, d.name]) {
    if (t && !isUrl(t) && !t.includes('|') && !out.some((o) => key(o) === key(t))) out.push(t);
  }
  return out;
}

const nodeCache = new Map<string, Promise<Photo | null>>();

export function nodePhoto(d: ImageSource): Promise<Photo | null> {
  if (d.image && isUrl(d.image)) {
    return Promise.resolve({ src: d.image, thumb: d.image, large: d.image, article: d.wiki ?? d.name });
  }
  const list = candidates(d);
  const k = list.join('|');
  let p = nodeCache.get(k);
  if (!p) {
    p = Promise.all(list.map(pageImage)).then((hits) => hits.find((h) => h?.photo)?.photo ?? null);
    nodeCache.set(k, p);
    // Don't pin a network failure forever.
    p.then((v) => { if (!v) setTimeout(() => nodeCache.delete(k), 30_000); });
  }
  return p;
}

export type PhotoState = { status: 'loading' } | { status: 'ready'; photo: Photo } | { status: 'none' };

/** Lead photo for a node, trying `image`, `wiki`, scientific name, then name. */
export function usePhoto(d: ImageSource | undefined): PhotoState {
  const id = d ? (d.image ?? '') + '|' + candidates(d).join('|') : '';
  const [state, setState] = useState<{ id: string; s: PhotoState }>({ id: '', s: { status: 'loading' } });
  useEffect(() => {
    if (!d || !theme.wikipediaImages) return;
    let live = true;
    nodePhoto(d).then((photo) => live && setState({ id, s: photo ? { status: 'ready', photo } : { status: 'none' } }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!d || !theme.wikipediaImages) return { status: 'none' };
  return state.id === id ? state.s : { status: 'loading' };
}

/* ------------------------------------------------------------------ galleries */

/** Files that are almost never a picture of the organism itself. */
const NOT_A_PHOTO = /(map|range|distribution|clad|phylo|diagram|chart|graph|logo|icon|symbol|flag|coat[_ ]of[_ ]arms|stamp|timeline|tree[_ ]of|comparison|scale|size|silhouette|life[_ ]cycle|lifecycle|anatomy|label|structure|schema|svg$)/i;

const galleryCache = new Map<string, Promise<Photo[]>>();

function mediaList(article: string): Promise<Photo[]> {
  const k = key(article);
  let p = galleryCache.get(k);
  if (!p) {
    p = fetch(`${REST}/page/media-list/${encodeURIComponent(k.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) =>
        (j.items ?? [])
          .filter((it: any) => it.type === 'image' && it.showInGallery !== false && it.srcset?.length && !NOT_A_PHOTO.test(it.title ?? ''))
          .map((it: any): Photo => {
            const abs = (s: string) => (s.startsWith('//') ? `https:${s}` : s);
            const sorted = [...it.srcset].sort((a: any, b: any) => parseFloat(a.scale) - parseFloat(b.scale));
            const base = abs(sorted[0].src);
            return {
              src: base,
              thumb: /\/\d+px-/.test(base) ? resize(base, THUMB_W) : base,
              large: abs(sorted[sorted.length - 1].src),
              article: k,
              file: it.title,
              caption: it.caption?.text?.trim() || undefined,
            };
          }),
      )
      .catch(() => {
        galleryCache.delete(k);
        return [];
      });
    galleryCache.set(k, p);
  }
  return p;
}

const fileKey = (f?: string) => (f ?? '').replace(/^File:/i, '').replace(/_/g, ' ').toLowerCase();

/** A few more photos from the article(s): the lead photo first, then the rest. Max `limit`. */
export function useGallery(lead: Photo | undefined, articles: (string | undefined)[], limit = 8): Photo[] {
  const list = [...new Set(articles.filter((a): a is string => !!a && !isUrl(a)).map(key))];
  const id = `${lead?.src ?? ''}|${list.join('|')}`;
  const [state, setState] = useState<{ id: string; photos: Photo[] }>({ id: '', photos: [] });
  useEffect(() => {
    if (!theme.wikipediaImages || !list.length) return;
    let live = true;
    Promise.all(list.map(mediaList)).then((lists) => {
      if (!live) return;
      const seen = new Set<string>();
      const out: Photo[] = [];
      if (lead) {
        out.push(lead);
        seen.add(fileKey(lead.file));
      }
      for (const p of lists.flat()) {
        const fk = fileKey(p.file);
        if (seen.has(fk)) {
          // Same file as the lead photo: borrow its caption.
          if (lead && fk === fileKey(lead.file) && !out[0].caption && p.caption) out[0] = { ...out[0], caption: p.caption };
          continue;
        }
        seen.add(fk);
        out.push(p);
        if (out.length >= limit) break;
      }
      setState({ id, photos: out });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return state.id === id ? state.photos : lead ? [lead] : [];
}
