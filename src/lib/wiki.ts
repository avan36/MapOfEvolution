import { useEffect, useState } from 'react';
import { theme } from '../theme';

export interface WikiSummary { image?: string; url: string; extract?: string }

const cache = new Map<string, Promise<WikiSummary | null>>();

function fetchSummary(title: string): Promise<WikiSummary | null> {
  let p = cache.get(title);
  if (!p) {
    const slug = encodeURIComponent(title.replace(/ /g, '_'));
    p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        j
          ? {
              image: (j.originalimage?.width ?? 0) > 640 && j.thumbnail?.source ? j.thumbnail.source.replace(/\/\d+px-/, '/640px-') : j.originalimage?.source ?? j.thumbnail?.source,
              url: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
              extract: j.extract,
            }
          : null,
      )
      .catch(() => null);
    cache.set(title, p);
  }
  return p;
}

export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** Photo + link for a Wikipedia article. Resolves to null offline or when disabled. */
export function useWiki(title: string | undefined) {
  const [data, setData] = useState<{ title: string; summary: WikiSummary | null } | null>(null);
  useEffect(() => {
    if (!title || !theme.wikipediaImages) return;
    let live = true;
    fetchSummary(title).then((summary) => live && setData({ title, summary }));
    return () => { live = false; };
  }, [title]);
  return data && data.title === title ? data.summary : undefined;
}
