import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TNode, TreeModel } from '../model/tree';
import { formatAgo } from '../lib/format';
import { usePhoto, useGallery, wikiUrl, type Photo } from '../lib/wiki';
import { Lightbox } from './Lightbox';

interface Props {
  model: TreeModel;
  node: TNode;
  onSelect(n: TNode): void;
  onClose(): void;
  onCompare(n: TNode): void;
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const } } };

export function DetailPanel({ model, node, onSelect, onClose, onCompare }: Props) {
  return (
    <motion.aside
      className="panel glass"
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={{ '--c': node.color } as React.CSSProperties}
      aria-label={`${node.data.name} details`}
    >
      <button className="panel__close" onClick={onClose} aria-label="Close">✕</button>
      <AnimatePresence mode="wait">
        <motion.div key={node.id} className="panel__scroll" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          <PanelBody model={model} node={node} onSelect={onSelect} onCompare={onCompare} />
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}

function PanelBody({ model, node, onSelect, onCompare }: Omit<Props, 'onClose'>) {
  const d = node.data;
  const shot = usePhoto(d);
  const lead = shot.status === 'ready' ? shot.photo : undefined;
  const photos = useGallery(lead, [d.wiki, d.image]);
  const [viewing, setViewing] = useState<number | null>(null);
  // No lead photo on any candidate article? Borrow the first photo from the gallery.
  const hero = lead ?? (shot.status === 'none' ? photos[0] : undefined);
  const group = model.groups.get(d.group);
  const period = model.spansAt(d.appeared)[0];
  const lineage = model.lineage(node);

  return (
    <>
      <motion.div className="panel__media" variants={item}>
        <HeroPhoto key={hero?.src ?? shot.status} state={hero ? 'ready' : shot.status} photo={hero} emoji={d.emoji} name={d.name} onOpen={() => setViewing(0)} />
        <div className="panel__media-fade" />
        <div className="panel__badges">
          <span className="badge" style={{ '--c': node.color } as React.CSSProperties}>{group?.emoji} {group?.label ?? d.group}</span>
          <span className="badge badge--muted">{d.rank}</span>
          {node.extinct ? <span className="badge badge--extinct">Extinct</span> : <span className="badge badge--alive">Living</span>}
        </div>
        {hero && d.wiki && hero.article.toLowerCase() !== d.wiki.replace(/_/g, ' ').toLowerCase() && (
          <span className="panel__pictured">Pictured: {hero.article}</span>
        )}
      </motion.div>

      {photos.length > 1 && (
        <motion.div className="gallery" variants={item} aria-label="More photos">
          {photos.map((p, i) => (
            <motion.button
              key={p.src}
              className="gallery__item"
              onClick={() => setViewing(i)}
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05, type: 'spring', stiffness: 380, damping: 24 }}
              whileHover={{ y: -3, scale: 1.06 }}
              title={p.caption ?? d.name}
            >
              <GalleryThumb photo={p} />
            </motion.button>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {viewing !== null && photos.length > 0 && (
          <Lightbox
            photos={photos}
            index={Math.min(viewing, photos.length - 1)}
            title={d.name}
            color={node.color}
            onIndex={setViewing}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>

      <motion.header className="panel__head" variants={item}>
        <h2>
          {d.emoji && <span className="panel__title-emoji">{d.emoji}</span>}
          {d.name}
        </h2>
        {d.scientific && <div className="panel__sci">{d.scientific}</div>}
      </motion.header>

      <motion.div className="panel__time" variants={item}>
        <div className="stat">
          <span className="stat__label">Appeared</span>
          <span className="stat__value">{formatAgo(d.appeared)}</span>
          {period && <span className="stat__sub" style={{ color: period.color }}>{period.name} {period.level}</span>}
        </div>
        <div className="stat">
          <span className="stat__label">{node.extinct ? 'Went extinct' : 'Status'}</span>
          <span className="stat__value">{node.extinct ? formatAgo(d.extinct!) : 'Still alive today'}</span>
          {node.extinct && <span className="stat__sub">lasted ~{formatDuration(d.appeared - d.extinct!)}</span>}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <TimeStrip model={model} node={node} />
      </motion.div>

      <motion.p className="panel__summary" variants={item}>{d.summary}</motion.p>

      {d.hybridOf?.length ? (
        <motion.div className="callout callout--hybrid" variants={item}>
          <div className="callout__title">🧬 A merger of lineages</div>
          <div className="chips">
            {[node.parent, ...node.hybrids].filter(Boolean).map((p, i) => (
              <span key={p!.id} className="chips__join">
                {i > 0 && <span className="chips__x">×</span>}
                <Chip n={p!} onClick={onSelect} />
              </span>
            ))}
          </div>
        </motion.div>
      ) : null}

      {d.origin && (
        <motion.div className="callout callout--origin" variants={item}>
          <div className="callout__title">🧑‍🌾 Shaped by humans</div>
          <p>{d.origin}</p>
        </motion.div>
      )}

      {d.facts?.length ? (
        <motion.section className="panel__section" variants={item}>
          <h3>Did you know?</h3>
          <ul className="facts">
            {d.facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </motion.section>
      ) : null}

      <motion.div className="panel__actions" variants={item}>
        <button className="btn btn--primary" onClick={() => onCompare(node)}>
          <span>⚖️</span> Compare with…
        </button>
        {d.wiki && (
          <a className="btn" href={wikiUrl(d.wiki)} target="_blank" rel="noreferrer">
            <span>📖</span> Wikipedia
          </a>
        )}
      </motion.div>

      {node.children.length > 0 && (
        <motion.section className="panel__section" variants={item}>
          <h3>Branches into <span className="count">{node.children.length}</span></h3>
          <div className="chips">
            {node.children.map((c) => <Chip key={c.id} n={c} onClick={onSelect} />)}
          </div>
        </motion.section>
      )}

      {model.nodes.some((n) => n.hybrids.includes(node)) && (
        <motion.section className="panel__section" variants={item}>
          <h3>Also an ancestor of</h3>
          <div className="chips">
            {model.nodes.filter((n) => n.hybrids.includes(node)).map((c) => <Chip key={c.id} n={c} onClick={onSelect} />)}
          </div>
        </motion.section>
      )}

      <motion.section className="panel__section" variants={item}>
        <h3>Family line <span className="count">{lineage.length - 1} ancestors</span></h3>
        <Lineage lineage={lineage} onSelect={onSelect} />
      </motion.section>

      {d.confidence && d.confidence !== 'high' && (
        <motion.p className="panel__note" variants={item}>
          {d.confidence === 'low' ? '🔭 Scientists still debate' : '🔬 There is some uncertainty about'} exactly when or where this lineage fits — dates are best estimates.
        </motion.p>
      )}
    </>
  );
}

/** The big picture at the top of the panel: shimmer while loading, then a blur-to-sharp reveal. */
function HeroPhoto({ state, photo, emoji, name, onOpen }: { state: 'loading' | 'ready' | 'none'; photo?: Photo; emoji?: string; name: string; onOpen(): void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (state === 'none' || failed || (state === 'ready' && !photo)) return <div className="panel__emoji">{emoji ?? '🧬'}</div>;
  return (
    <button className={`panel__photo ${loaded ? 'is-loaded' : ''}`} onClick={onOpen} disabled={!loaded} aria-label={`View photos of ${name}`}>
      {!loaded && <div className="panel__shimmer"><span>{emoji ?? '🧬'}</span></div>}
      {photo && <img src={photo.src} alt={name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
      {loaded && <span className="panel__zoom">⤢</span>}
    </button>
  );
}

function GalleryThumb({ photo }: { photo: Photo }) {
  const [ok, setOk] = useState(true);
  return ok ? <img src={photo.thumb} alt="" loading="lazy" onError={() => setOk(false)} /> : <span className="gallery__miss">🖼️</span>;
}

function Chip({ n, onClick }: { n: TNode; onClick(n: TNode): void }) {
  return (
    <button className={`chip ${n.extinct ? 'chip--extinct' : ''}`} style={{ '--c': n.color } as React.CSSProperties} onClick={() => onClick(n)}>
      <span>{n.data.emoji ?? '•'}</span>
      {n.data.name}
    </button>
  );
}

function Lineage({ lineage, onSelect }: { lineage: TNode[]; onSelect(n: TNode): void }) {
  const [expanded, setExpanded] = useState(false);
  const shown: (TNode | 'more')[] =
    expanded || lineage.length <= 8 ? lineage : [...lineage.slice(0, 2), 'more', ...lineage.slice(-5)];
  return (
    <ol className="lineage">
      {shown.map((n, i) =>
        n === 'more' ? (
          <li key="more" className="lineage__more">
            <button onClick={() => setExpanded(true)}>⋯ show {lineage.length - 7} more ancestors</button>
          </li>
        ) : (
          <li key={n.id} className={i === shown.length - 1 ? 'is-self' : ''} style={{ '--c': n.color } as React.CSSProperties}>
            <button onClick={() => onSelect(n)}>
              <span className="lineage__dot" />
              <span className="lineage__name">{n.data.emoji} {n.data.name}</span>
              <span className="lineage__time">{formatAgo(n.data.appeared, true)}</span>
            </button>
          </li>
        ),
      )}
    </ol>
  );
}

/** A tiny bar of Earth's history showing when this lineage lived. */
function TimeStrip({ model, node }: { model: TreeModel; node: TNode }) {
  const spans = model.dataset.time.spans.filter((s) => s.level === 'eon');
  const sc = model.scale;
  const a = node.sStart, b = node.sEnd;
  return (
    <div className="timestrip" aria-hidden>
      <div className="timestrip__bar">
        {spans.map((s) => (
          <span key={s.id} style={{ left: `${sc.s(s.start) * 100}%`, width: `${(sc.s(s.end) - sc.s(s.start)) * 100}%`, background: s.color }} />
        ))}
        <motion.i
          className="timestrip__life"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ left: `${a * 100}%`, width: `${Math.max(0.8, (b - a) * 100)}%` }}
        />
      </div>
      <div className="timestrip__labels">
        <span>Earth forms</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function formatDuration(ma: number) {
  if (ma >= 1) return `${Math.round(ma * 10) / 10} million years`;
  if (ma >= 0.001) return `${Math.round(ma * 1000).toLocaleString()},000 years`;
  return `${Math.round(ma * 1e6).toLocaleString()} years`;
}
