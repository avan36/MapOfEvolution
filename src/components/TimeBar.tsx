import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { TreeModel } from '../model/tree';
import type { Renderer } from '../render/Renderer';
import { useStore, type Store } from '../lib/store';
import type { TimeState } from '../App';
import { formatAgo, formatTick } from '../lib/format';

const TICKS = [4000, 3000, 2000, 1000, 541, 252, 145, 66, 23, 5, 1, 0.3, 0.1, 0.01, 0.001];

export function TimeBar({ model, timeStore, renderer }: { model: TreeModel; timeStore: Store<TimeState>; renderer: React.RefObject<Renderer | null> }) {
  const { s, playing } = useStore(timeStore);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(900);
  useEffect(() => {
    const el = trackRef.current!;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sc = model.scale;
  const spans = model.dataset.time.spans;

  const rows = useMemo(() => ({ eons: spans.filter((x) => x.level === 'eon'), fine: model.bands }), [spans, model]);

  const ticks = useMemo(() => {
    const out: { t: number; s: number }[] = [];
    for (const t of TICKS) {
      const p = sc.s(t);
      if (out.every((o) => Math.abs(o.s - p) * trackW > 48)) out.push({ t, s: p });
    }
    return out;
  }, [sc, trackW]);

  const t = sc.t(s);
  const now = s >= 0.9995;
  const period = model.spansAt(t)[0];

  const scrub = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    renderer.current?.setTimeS(p);
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    scrub(e.clientX);
  };

  const togglePlay = () => {
    const r = renderer.current;
    if (!r) return;
    if (r.isPlaying()) r.pause(); else r.play();
  };

  return (
    <motion.div className="timebar glass" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}>
      <button className={`timebar__play ${playing ? 'is-playing' : ''}`} onClick={togglePlay} aria-label={playing ? 'Pause history' : 'Play history'} title="Play the history of life (space)">
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>
        )}
      </button>

      <div className="timebar__readout">
        <div className="timebar__when">{now ? 'Today' : formatAgo(t)}</div>
        <div className="timebar__period" style={{ color: period?.color }}>
          {period ? `${period.name} ${period.level}` : '—'}
        </div>
      </div>

      <div className="timebar__track" ref={trackRef} onPointerDown={onDown} onPointerMove={(e) => e.buttons & 1 && scrub(e.clientX)} role="slider" aria-label="Time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s * 100)} aria-valuetext={now ? 'Today' : formatAgo(t)} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') renderer.current?.setTimeS(s - 0.01);
          if (e.key === 'ArrowRight') renderer.current?.setTimeS(s + 0.01);
        }}
      >
        <div className="timebar__events">
          {model.dataset.time.events.map((ev) => (
            <button
              key={ev.id}
              className={`timebar__event timebar__event--${ev.kind}`}
              style={{ left: `${sc.s(ev.time) * 100}%` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => renderer.current?.setTimeS(sc.s(ev.time) + 0.0005)}
              title={`${ev.name} — ${formatAgo(ev.time)}\n${ev.summary}`}
            >
              {ev.emoji}
            </button>
          ))}
        </div>
        <div className="timebar__bands">
          <div className="timebar__row timebar__row--eon">
            {rows.eons.map((x) => (
              <span key={x.id} style={{ left: `${sc.s(x.start) * 100}%`, width: `${(sc.s(x.end) - sc.s(x.start)) * 100}%`, background: x.color }} title={`${x.name} eon`} />
            ))}
          </div>
          <div className="timebar__row timebar__row--fine">
            {rows.fine.map((x) => {
              const w = (sc.s(x.end) - sc.s(x.start)) * 100;
              return (
                <span key={x.id} style={{ left: `${sc.s(x.start) * 100}%`, width: `${w}%`, '--band': x.color } as React.CSSProperties} title={`${x.name}: ${x.summary}`}>
                  {bandLabel(x.name, (w / 100) * trackW)}
                </span>
              );
            })}
          </div>
          <div className="timebar__past" style={{ width: `${s * 100}%` }} />
        </div>
        <div className="timebar__ticks">
          {ticks.map((k) => (
            <span key={k.t} style={{ left: `${k.s * 100}%` }}>{formatTick(k.t)}</span>
          ))}
        </div>
        <div className="timebar__handle" style={{ left: `${s * 100}%` }}>
          <i />
        </div>
      </div>

      <button className="timebar__today" onClick={() => renderer.current?.setTimeS(1)} disabled={now}>
        Today
      </button>
    </motion.div>
  );
}

/** Full name, a three-letter abbreviation, or nothing — whatever fits. */
function bandLabel(name: string, px: number) {
  if (px > name.length * 6.6 + 10) return name;
  if (px > 28) return name.slice(0, 3);
  return '';
}
