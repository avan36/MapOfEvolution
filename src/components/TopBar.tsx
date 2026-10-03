import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Dataset } from '../data/types';
import type { ViewMode } from '../render/Renderer';
import { exportCsv, exportJson, importFile } from '../lib/dataio';
import { Logo } from './Logo';
import { toast } from './Toasts';

interface Props {
  mode: ViewMode;
  onMode(m: ViewMode): void;
  onSearch(): void;
  onJourneys(): void;
  onHome(): void;
  dataset: Dataset;
  onLoad(ds: Dataset, label: string): void;
  onReset(): void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ mode, onMode, onSearch, onJourneys, onHome, dataset, onLoad, onReset }: Props) {
  return (
    <motion.header className="topbar" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
      <button className="brand" onClick={onHome} title="Back to the whole tree">
        <Logo />
        <span className="brand__name">
          Map of <em>Evolution</em>
        </span>
      </button>

      <div className="segmented" role="tablist" aria-label="View">
        {(['radial', 'linear'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => onMode(m)}>
            {mode === m && <motion.span layoutId="seg-pill" className="segmented__pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span className="segmented__label">{m === 'radial' ? <><IconRadial /> Tree</> : <><IconTimeline /> Timeline</>}</span>
          </button>
        ))}
      </div>

      <div className="topbar__actions">
        <button className="search-trigger" onClick={onSearch}>
          <IconSearch />
          <span className="search-trigger__text">Search life…</span>
          <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <button className="btn btn--glow" onClick={onJourneys}>
          <span>🧭</span><span className="hide-sm">Journeys</span>
        </button>
        <DataMenu dataset={dataset} onLoad={onLoad} onReset={onReset} />
      </div>
    </motion.header>
  );
}

function DataMenu({ dataset, onLoad, onReset }: { dataset: Dataset; onLoad(ds: Dataset, label: string): void; onReset(): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', f);
    return () => window.removeEventListener('pointerdown', f);
  }, [open]);

  const extinct = dataset.nodes.filter((n) => n.extinct !== undefined).length;
  return (
    <div className="menu" ref={ref}>
      <button className="btn btn--icon" onClick={() => setOpen((o) => !o)} aria-label="Data" aria-expanded={open} title="Data: export & import">
        <IconData />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu__pop glass"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="menu__head">
              <div className="menu__title">Your data, your UI</div>
              <p>
                Everything here is drawn from portable JSON. {dataset.nodes.length} lineages · {extinct} extinct · {dataset.journeys.length} journeys.
              </p>
            </div>
            <button className="menu__item" onClick={() => { exportJson(dataset); setOpen(false); }}>
              <span>⬇️</span><div><b>Export dataset</b><small>One JSON file with every node, era & journey</small></div>
            </button>
            <button className="menu__item" onClick={() => { exportCsv(dataset); setOpen(false); }}>
              <span>📊</span><div><b>Export as CSV</b><small>Open the tree in a spreadsheet</small></div>
            </button>
            <button className="menu__item" onClick={() => fileRef.current?.click()}>
              <span>📂</span><div><b>Load a dataset…</b><small>Or drag a .json file anywhere on the page</small></div>
            </button>
            <button className="menu__item" onClick={() => { onReset(); setOpen(false); }}>
              <span>↺</span><div><b>Restore built-in data</b><small>Undo any loaded file</small></div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const { dataset: ds, label } = await importFile(file, dataset);
                  onLoad(ds, label);
                  setOpen(false);
                } catch (err) {
                  toast((err as Error).message, 'error');
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
const IconRadial = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5V3M14.2 13.3l5.6 3.2M9.8 13.3l-5.6 3.2" /><circle cx="12" cy="12" r="9.5" strokeOpacity=".4" /></svg>
);
const IconTimeline = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h5M8 12c3 0 3-6 6-6h7M8 12c3 0 3 6 6 6h7M14 6c2 0 2 3 4 3h3" /></svg>
);
const IconData = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6M4.5 11.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6" /></svg>
);
