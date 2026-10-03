import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TreeModel } from '../model/tree';
import { SPOTLIGHTS } from '../spotlights';
import { groupColor } from '../theme';

interface Props {
  model: TreeModel;
  groups: Set<string>;
  onGroups(g: Set<string>): void;
  spotlight: string | null;
  onSpotlight(s: string | null): void;
  hidden: boolean;
}

/** Legend + filters: tap a colour group or a spotlight to make it glow. */
export function FilterDock({ model, groups, onGroups, spotlight, onSpotlight, hidden }: Props) {
  const [open, setOpen] = useState(() => window.innerWidth > 1100);
  const counts = new Map<string, number>();
  for (const n of model.nodes) counts.set(n.data.group, (counts.get(n.data.group) ?? 0) + 1);
  const spots = SPOTLIGHTS.filter((s) => model.nodes.some(s.test));
  const active = groups.size + (spotlight ? 1 : 0);

  const toggle = (id: string) => {
    const next = new Set(groups);
    if (next.has(id)) next.delete(id); else next.add(id);
    onGroups(next);
  };

  return (
    <motion.nav
      className={`dock glass ${open ? 'is-open' : ''}`}
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: hidden ? -320 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label="Filters"
    >
      <button className="dock__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="dock__swatches">
          {model.dataset.groups.slice(0, 5).map((g) => <i key={g.id} style={{ background: groupColor(g.id) }} />)}
        </span>
        <span>Explore by group</span>
        {active > 0 && <span className="dock__badge">{active}</span>}
        <span className="dock__chev">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="dock__body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="dock__label">Spotlight</div>
            <div className="dock__spots">
              {spots.map((s) => (
                <button key={s.id} className={`spot ${spotlight === s.id ? 'is-active' : ''}`} onClick={() => onSpotlight(spotlight === s.id ? null : s.id)}>
                  <span>{s.emoji}</span>{s.label}
                </button>
              ))}
            </div>
            <div className="dock__label">
              Groups
              {active > 0 && <button className="dock__clear" onClick={() => { onGroups(new Set()); onSpotlight(null); }}>Clear</button>}
            </div>
            <ul className="dock__groups">
              {model.dataset.groups.filter((g) => counts.get(g.id)).map((g) => {
                const on = groups.has(g.id);
                return (
                  <li key={g.id}>
                    <button className={`legend ${on ? 'is-active' : ''} ${groups.size && !on ? 'is-dim' : ''}`} onClick={() => toggle(g.id)} title={g.description} style={{ '--c': groupColor(g.id) } as React.CSSProperties}>
                      <i />
                      <span className="legend__label">{g.emoji} {g.label}</span>
                      <span className="legend__count">{counts.get(g.id)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
