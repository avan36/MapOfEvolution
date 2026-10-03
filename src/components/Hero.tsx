import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { TreeModel } from '../model/tree';
import { Logo } from './Logo';

function useCount(target: number, delay = 0, dur = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      setV(Math.round(target * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, dur]);
  return v;
}

const ease = [0.2, 0.8, 0.2, 1] as const;

export function Hero({ model, onEnter, onJourney }: { model: TreeModel; onEnter(): void; onJourney(): void }) {
  const lineages = useCount(model.nodes.length, 900);
  const extinct = useCount(model.nodes.filter((n) => n.extinct).length, 1000);
  const years = useCount(Math.round(model.root.data.appeared / 100), 1100); // tenths of a billion
  const words = ['Every', 'living', 'thing', 'is'];
  const firstJourney = model.dataset.journeys.find((j) => j.steps.length);

  return (
    <motion.section
      className="hero"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.9, ease }}
    >
      <div className="hero__vignette" />
      <div className="hero__content">
        <motion.div className="hero__eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease }}>
          <Logo size={20} /> An interactive atlas of life on Earth
        </motion.div>
        <h1 className="hero__title">
          {words.map((w, i) => (
            <motion.span key={w} className="hero__word" initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.35 + i * 0.12, duration: 0.9, ease }}>
              {w}
            </motion.span>
          ))}
          <br />
          <motion.em className="hero__family" initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.95, duration: 1.1, ease }}>
            family.
          </motion.em>
        </h1>
        <motion.p className="hero__lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.9, ease }}>
          Trace four billion years of evolution — from the first cell to Tyrannosaurus rex, the banana in your kitchen, and you.
        </motion.p>
        <motion.div className="hero__ctas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 0.9, ease }}>
          <button className="cta cta--primary" onClick={onEnter} autoFocus>
            Explore the tree <span className="cta__arrow">→</span>
          </button>
          {firstJourney && (
            <button className="cta cta--ghost" onClick={onJourney}>
              <span>{firstJourney.emoji}</span> {firstJourney.title}
            </button>
          )}
        </motion.div>
        <motion.dl className="hero__stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1 }}>
          <div><dt>{lineages.toLocaleString()}</dt><dd>lineages</dd></div>
          <div><dt>{extinct.toLocaleString()}</dt><dd>extinct</dd></div>
          <div><dt>{(years / 10).toFixed(1)}<small>bn</small></dt><dd>years of history</dd></div>
          <div><dt>{model.dataset.journeys.length}</dt><dd>guided journeys</dd></div>
        </motion.dl>
      </div>
      <motion.div className="hero__hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }}>
        Scroll to zoom · Drag to pan · Press <kbd>/</kbd> to search
      </motion.div>
    </motion.section>
  );
}
