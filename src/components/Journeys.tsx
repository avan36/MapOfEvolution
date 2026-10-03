import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Journey } from '../data/types';
import type { TreeModel } from '../model/tree';
import { formatAgo } from '../lib/format';

export function JourneyPicker({ model, onStart, onClose }: { model: TreeModel; onStart(j: Journey): void; onClose(): void }) {
  const journeys = model.dataset.journeys;
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="journeys glass" initial={{ y: 30, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} role="dialog" aria-label="Guided journeys">
        <header className="journeys__head">
          <div>
            <div className="eyebrow">Guided journeys</div>
            <h2>Pick a story through time</h2>
          </div>
          <button className="panel__close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="journeys__grid">
          {journeys.map((j, i) => {
            const first = model.byId.get(j.steps[0]?.node);
            const last = model.byId.get(j.steps[j.steps.length - 1]?.node);
            return (
              <motion.button
                key={j.id}
                className="journey-card"
                onClick={() => onStart(j)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4 }}
                style={{ '--c1': first?.color ?? '#7cf5d1', '--c2': last?.color ?? '#ff7ad9' } as React.CSSProperties}
              >
                <span className="journey-card__emoji">{j.emoji}</span>
                <span className="journey-card__title">{j.title}</span>
                <span className="journey-card__sub">{j.subtitle}</span>
                <span className="journey-card__meta">
                  {j.steps.length} stops
                  {first && last && <> · {formatAgo(first.data.appeared, true)} → {last.extinct ? formatAgo(last.data.extinct!, true) : 'today'}</>}
                </span>
                <span className="journey-card__path">
                  {j.steps.slice(0, 9).map((s) => <i key={s.node}>{model.byId.get(s.node)?.data.emoji ?? '•'}</i>)}
                </span>
              </motion.button>
            );
          })}
          {!journeys.length && <p className="muted">No journeys in this dataset yet — add some to data/journeys.json.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

const AUTO_MS = 9000;

export function StoryCard({ model, journey, step, onStep, onExit }: { model: TreeModel; journey: Journey; step: number; onStep(i: number): void; onExit(): void }) {
  const [auto, setAuto] = useState(false);
  const s = journey.steps[step] ?? { node: '', text: '' };
  const node = model.byId.get(s.node);
  const last = step === journey.steps.length - 1;

  useEffect(() => {
    if (!auto) return;
    if (last) { setAuto(false); return; }
    const t = setTimeout(() => onStep(step + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, step, last, onStep]);

  return (
    <motion.div className="story glass" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} style={{ '--c': node?.color } as React.CSSProperties}>
      <div className="story__top">
        <span className="story__journey">{journey.emoji} {journey.title}</span>
        <button className="story__exit" onClick={onExit}>Exit tour ✕</button>
      </div>
      <div className="story__progress">
        {journey.steps.map((_, i) => (
          <button key={i} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} onClick={() => onStep(i)} aria-label={`Step ${i + 1}`}>
            {i === step && auto && <motion.i key={`${step}-auto`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTO_MS / 1000, ease: 'linear' }} />}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="story__body" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }}>
          <div className="story__emoji">{node?.data.emoji ?? '✨'}</div>
          <div>
            <div className="story__when">{node ? (node.extinct ? `${formatAgo(node.data.appeared)} – ${formatAgo(node.data.extinct!)}` : formatAgo(node.data.appeared)) : ''}</div>
            <h3>{s.title ?? node?.data.name}</h3>
            <p>{s.text}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="story__nav">
        <button className="btn" onClick={() => onStep(step - 1)} disabled={step === 0}>← Back</button>
        <button className={`btn btn--ghost ${auto ? 'is-active' : ''}`} onClick={() => setAuto((a) => !a)}>{auto ? '❚❚ Pause' : '▶ Autoplay'}</button>
        <span className="story__count">{step + 1} / {journey.steps.length}</span>
        {last ? (
          <button className="btn btn--primary" onClick={onExit}>Finish ✓</button>
        ) : (
          <button className="btn btn--primary" onClick={() => onStep(step + 1)}>Next →</button>
        )}
      </div>
    </motion.div>
  );
}
