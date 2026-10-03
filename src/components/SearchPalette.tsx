import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { TNode, TreeModel } from '../model/tree';
import { formatAgo } from '../lib/format';

interface Props {
  model: TreeModel;
  compareFrom: TNode | null;
  onPick(n: TNode): void;
  onClose(): void;
}

const SUGGESTIONS = ['Tyrannosaurus', 'Banana', 'Human', 'Broccoli', 'Orange', 'Blue whale', 'Mushroom', 'Chicken', 'Apple', 'Octopus'];

export function SearchPalette({ model, compareFrom, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (q.trim()) return model.search(q, 40);
    // Empty query: a few inviting starting points that exist in this dataset.
    const out: TNode[] = [];
    for (const s of SUGGESTIONS) {
      const hit = model.search(s, 1)[0];
      if (hit && !out.includes(hit)) out.push(hit);
    }
    return out;
  }, [q, model]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && results[active]) onPick(results[active]);
    else if (e.key === 'Escape') onClose();
  };

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="palette glass"
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        role="dialog"
        aria-label="Search the tree of life"
      >
        {compareFrom && (
          <div className="palette__context">
            Compare <b>{compareFrom.data.emoji} {compareFrom.data.name}</b> with… find your closest shared ancestor
          </div>
        )}
        <div className="palette__input">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={compareFrom ? 'Pick something to compare…' : 'Search organisms, groups, fruits, dinosaurs…'}
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
          />
          <kbd>esc</kbd>
        </div>
        {!q.trim() && <div className="palette__section">{compareFrom ? 'Try one of these' : 'Popular starting points'}</div>}
        <ul className="palette__results" id="palette-results" ref={listRef} role="listbox">
          {results.map((n, i) => {
            const g = model.groups.get(n.data.group);
            return (
              <li
                key={n.id}
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={i === active ? 'is-active' : ''}
                onPointerEnter={() => setActive(i)}
                onClick={() => onPick(n)}
              >
                <span className="palette__emoji" style={{ '--c': n.color } as React.CSSProperties}>{n.data.emoji ?? '•'}</span>
                <span className="palette__main">
                  <span className="palette__name">{highlight(n.data.name, q)}</span>
                  <span className="palette__meta">
                    {n.data.scientific && <i>{n.data.scientific} · </i>}
                    {g?.label ?? n.data.group} · {n.extinct ? `extinct ${formatAgo(n.data.extinct!, true)}` : `since ${formatAgo(n.data.appeared, true)}`}
                  </span>
                </span>
                <span className="palette__rank">{n.data.rank}</span>
              </li>
            );
          })}
          {!results.length && <li className="palette__empty">No lineages match “{q}”. Try a common name like “cat” or “rose”.</li>}
        </ul>
        <div className="palette__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> {compareFrom ? 'compare' : 'fly there'}</span>
          <span>{model.nodes.length} lineages indexed</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function highlight(text: string, q: string) {
  const t = q.trim();
  if (!t) return text;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  );
}
