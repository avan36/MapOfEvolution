import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { bundledDataset } from './data/load';
import type { Dataset, Journey } from './data/types';
import { TreeModel, type TNode } from './model/tree';
import { Renderer, type ViewMode } from './render/Renderer';
import { createStore } from './lib/store';
import { SPOTLIGHTS } from './spotlights';
import { Stage } from './components/Stage';
import { TopBar } from './components/TopBar';
import { Hero } from './components/Hero';
import { SearchPalette } from './components/SearchPalette';
import { DetailPanel } from './components/DetailPanel';
import { TimeBar } from './components/TimeBar';
import { FilterDock } from './components/FilterDock';
import { JourneyPicker, StoryCard } from './components/Journeys';
import { CompareCard } from './components/CompareCard';
import { HoverCard } from './components/HoverCard';
import { ZoomControls } from './components/ZoomControls';
import { Toasts, toast } from './components/Toasts';
import { DropZone } from './components/DropZone';

export interface HoverState { node: TNode | null; x: number; y: number }
export interface TimeState { s: number; playing: boolean }

export default function App() {
  const [dataset, setDataset] = useState<Dataset>(bundledDataset);
  const model = useMemo(() => new TreeModel(dataset), [dataset]);
  const rendererRef = useRef<Renderer | null>(null);
  const hoverStore = useMemo(() => createStore<HoverState>({ node: null, x: 0, y: 0 }), []);
  const timeStore = useMemo(() => createStore<TimeState>({ s: 1, playing: false }), []);

  const [intro, setIntro] = useState(true);
  const [mode, setModeState] = useState<ViewMode>('radial');
  const [selected, setSelected] = useState<TNode | null>(null);
  const [compare, setCompare] = useState<[TNode, TNode] | null>(null);
  const [search, setSearch] = useState<{ open: boolean; compareFrom: TNode | null }>({ open: false, compareFrom: null });
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [journeysOpen, setJourneysOpen] = useState(false);
  const [journey, setJourney] = useState<{ j: Journey; step: number } | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const f = () => setIsMobile(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  // Dataset swapped (imported file) → reset view state.
  useEffect(() => {
    setSelected(null);
    setCompare(null);
    setJourney(null);
    setGroupFilter(new Set());
    setSpotlight(null);
  }, [model]);

  // ── keep the renderer's highlight in sync with React state
  const filterSet = useMemo(() => {
    if (!groupFilter.size && !spotlight) return null;
    const sp = SPOTLIGHTS.find((s) => s.id === spotlight);
    return new Set(model.nodes.filter((n) => (!groupFilter.size || groupFilter.has(n.data.group)) && (!sp || sp.test(n))));
  }, [model, groupFilter, spotlight]);

  // Frame whatever a filter highlights.
  useEffect(() => {
    if (filterSet?.size) rendererRef.current?.focusNodes([...filterSet], 2.5);
    else if (filterSet === null && !intro) rendererRef.current?.fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSet]);

  // Leave room for the side panel when framing things.
  const panelOpen = !!selected && !journey && !compare;
  useEffect(() => {
    // Overlays (side panel, story card, comparison card) shrink the free area the camera frames into.
    rendererRef.current?.setInsets({
      right: panelOpen && !isMobile ? 440 : 0,
      bottom: journey ? (isMobile ? 330 : 340) : isMobile ? (panelOpen ? window.innerHeight * 0.62 : 150) : 130,
      top: compare ? (isMobile ? 330 : 300) : isMobile ? 110 : 76,
      left: 0,
    });
  }, [panelOpen, isMobile, journey, compare]);

  const select = useCallback((n: TNode | null, opts: { fly?: boolean } = {}) => {
    setSelected(n);
    setCompare(null);
    if (n && opts.fly !== false) {
      // let the inset update land first so the node is centred in the free space
      requestAnimationFrame(() => rendererRef.current?.focusNode(n));
    }
  }, []);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    rendererRef.current?.setMode(m);
  }, []);

  const startCompare = useCallback((a: TNode, b: TNode) => {
    setSelected(null);
    setJourney(null);
    setCompare([a, b]);
    const ca = model.mrca(a, b);
    requestAnimationFrame(() => rendererRef.current?.focusNodes([a, b, ca], 3));
  }, [model]);

  // ── journeys
  useEffect(() => {
    if (!journey) return;
    // Ignore a journey left over from a dataset that has just been replaced.
    if (!model.dataset.journeys.includes(journey.j)) return;
    const step = journey.j.steps[journey.step];
    const n = step && model.byId.get(step.node);
    if (!n) return;
    setSelected(n);
    rendererRef.current?.focusNode(n);
  }, [journey, model]);

  const startJourney = useCallback((j: Journey) => {
    setJourneysOpen(false);
    setCompare(null);
    setIntro(false);
    rendererRef.current?.setIdleSpin(false);
    rendererRef.current?.setTimeS(1);
    setJourney({ j, step: 0 });
  }, []);

  const endJourney = useCallback(() => {
    setJourney(null);
    setSelected(null);
    rendererRef.current?.fit();
  }, []);

  const enter = useCallback(() => {
    setIntro(false);
    const r = rendererRef.current;
    if (!r) return;
    r.setIdleSpin(false);
    r.grow(2600, 0.15);
    r.fit();
  }, []);

  // ── renderer callbacks
  const onRendererReady = useCallback((r: Renderer) => {
    rendererRef.current = r;
    r.setIdleSpin(true);
    r.grow(5200);
  }, []);

  const onCanvasClick = useCallback((n: TNode | null) => {
    if (intro) return;
    if (journey) { if (n) select(n); return; }
    if (n) select(n, { fly: false });
    else { setSelected(null); setCompare(null); }
  }, [intro, journey, select]);

  // ── keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setIntro(false);
        rendererRef.current?.setIdleSpin(false);
        setSearch({ open: true, compareFrom: null });
        return;
      }
      if (typing) return;
      if (e.key === 'Escape') {
        if (search.open) setSearch({ open: false, compareFrom: null });
        else if (journeysOpen) setJourneysOpen(false);
        else if (journey) endJourney();
        else if (compare) setCompare(null);
        else if (selected) setSelected(null);
      } else if (journey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const d = e.key === 'ArrowRight' ? 1 : -1;
        setJourney((J) => J && { ...J, step: Math.max(0, Math.min(J.j.steps.length - 1, J.step + d)) });
      } else if (!intro && (e.key === 't' || e.key === 'T')) {
        setMode(mode === 'radial' ? 'linear' : 'radial');
      } else if (!intro && e.key === ' ') {
        e.preventDefault();
        const r = rendererRef.current;
        if (r) r.isPlaying() ? r.pause() : r.play();
      } else if (!intro && (e.key === '0' || e.key === 'f')) {
        rendererRef.current?.fit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search.open, journeysOpen, journey, compare, selected, intro, mode, setMode, endJourney]);

  const loadDataset = useCallback((ds: Dataset, label: string) => {
    setJourney(null);
    setSelected(null);
    setCompare(null);
    setDataset(ds);
    toast(`Loaded ${label}: ${ds.nodes.length} lineages`, 'success');
    setTimeout(() => rendererRef.current?.grow(3000), 50);
  }, []);

  return (
    <div className={`app ${intro ? 'is-intro' : ''}`}>
      <div className="aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <Stage
        model={model}
        onReady={onRendererReady}
        hoverStore={hoverStore}
        timeStore={timeStore}
        onClick={onCanvasClick}
        selected={selected}
        compare={compare}
        filter={filterSet}
      />

      <AnimatePresence>{intro && <Hero model={model} onEnter={enter} onJourney={() => { const j = model.dataset.journeys.find((x) => x.steps.length); if (j) startJourney(j); else enter(); }} />}</AnimatePresence>

      {!intro && (
        <>
          <TopBar
            mode={mode}
            onMode={setMode}
            onSearch={() => setSearch({ open: true, compareFrom: null })}
            onJourneys={() => setJourneysOpen(true)}
            onHome={() => { setSelected(null); setCompare(null); setJourney(null); rendererRef.current?.fit(); }}
            dataset={dataset}
            onLoad={loadDataset}
            onReset={() => loadDataset(bundledDataset, 'the built-in dataset')}
          />
          <FilterDock
            model={model}
            groups={groupFilter}
            onGroups={setGroupFilter}
            spotlight={spotlight}
            onSpotlight={setSpotlight}
            hidden={!!journey}
          />
          <ZoomControls renderer={rendererRef} />
          <TimeBar model={model} timeStore={timeStore} renderer={rendererRef} />
        </>
      )}

      <HoverCard store={hoverStore} model={model} hidden={intro || search.open} />

      <AnimatePresence>
        {panelOpen && selected && (
          <DetailPanel
            key="panel"
            model={model}
            node={selected}
            onSelect={(n) => select(n)}
            onClose={() => setSelected(null)}
            onCompare={(n) => setSearch({ open: true, compareFrom: n })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compare && <CompareCard key="compare" model={model} pair={compare} onClose={() => setCompare(null)} onSelect={(n) => select(n)} />}
      </AnimatePresence>

      <AnimatePresence>
        {journey && (
          <StoryCard
            key="story"
            model={model}
            journey={journey.j}
            step={journey.step}
            onStep={(step) => setJourney((J) => J && { ...J, step })}
            onExit={endJourney}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {journeysOpen && <JourneyPicker key="jp" model={model} onStart={startJourney} onClose={() => setJourneysOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {search.open && (
          <SearchPalette
            key="search"
            model={model}
            compareFrom={search.compareFrom}
            onClose={() => setSearch({ open: false, compareFrom: null })}
            onPick={(n) => {
              const from = search.compareFrom;
              setSearch({ open: false, compareFrom: null });
              setJourney(null);
              if (from && from !== n) startCompare(from, n);
              else select(n);
            }}
          />
        )}
      </AnimatePresence>

      <DropZone current={dataset} onLoad={loadDataset} />
      <Toasts />
    </div>
  );
}
