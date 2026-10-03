import { motion } from 'framer-motion';
import type { TNode, TreeModel } from '../model/tree';
import type { Medicine, UsRange } from '../data/types';
import { US_COLS, US_ROWS, US_TILES } from '../lib/usStates';

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const } } };

/** "In medicine": the diseases a germ causes, the drugs that treat it and where it turns up in the US. */
export function MedicineCallout({ model, medicine, onSelect }: { model: TreeModel; medicine: Medicine; onSelect(n: TNode): void }) {
  return (
    <motion.div className="callout callout--medicine med" variants={item}>
      <div className="callout__title">🩺 In medicine</div>

      <div className="med__label">Causes</div>
      <div className="med__diseases">
        {medicine.diseases.map((d) => <span key={d} className="med__disease">{d}</span>)}
      </div>

      <div className="med__label">Treated with</div>
      <ul className="med__drugs">
        {medicine.treatments.map((t) => {
          const src = t.from ? model.byId.get(t.from) : undefined;
          return (
            <li key={t.drug}>
              <span className="med__what">
                <span className="med__drug">{t.drug}</span>
                {t.note && <span className="med__note">{t.note}</span>}
              </span>
              {src && (
                <button className="med__from" style={{ '--c': src.color } as React.CSSProperties} onClick={() => onSelect(src)} title={`This drug comes from ${src.data.name}. Fly there`}>
                  from {src.data.emoji} {src.data.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {medicine.us && (
        <>
          <div className="med__label">Where in the US</div>
          <UsTileMap range={medicine.us} />
          <p className="med__us-note">{medicine.us.note}</p>
        </>
      )}

      {medicine.resistance && (
        <div className="med__resist">
          <span aria-hidden>⚠️</span>
          <p><strong>Resistance.</strong> {medicine.resistance}</p>
        </div>
      )}

      <p className="med__disclaimer">For learning, not medical advice. The right treatment depends on the patient, so ask a doctor.</p>
    </motion.div>
  );
}

/** For lineages that medicines come from (Streptomyces, Penicillium…): each drug and the germs it fights. */
export function DrugSources({ model, node, onSelect }: { model: TreeModel; node: TNode; onSelect(n: TNode): void }) {
  const drugs = model.drugsFrom(node);
  if (!drugs.length) return null;
  return (
    <motion.section className="panel__section" variants={item}>
      <h3>💊 Medicines from here <span className="count">{drugs.length}</span></h3>
      <ul className="med__sources">
        {drugs.map(({ drug, treats }) => (
          <li key={drug}>
            <span className="med__drug">{drug}</span>
            <span className="med__arrow" aria-label="used against">→</span>
            <span className="chips">
              {treats.map((g) => (
                <button key={g.id} className="chip" style={{ '--c': g.color } as React.CSSProperties} onClick={() => onSelect(g)}>
                  <span>{g.data.emoji ?? '•'}</span>{g.data.name}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

const S = 10; // tile pitch in SVG units
const T = 8.6; // tile size

/** Equal-square map of the US. Hot-spot states glow; "nationwide" tints every state. */
function UsTileMap({ range }: { range: UsRange }) {
  const hot = new Set(range.states ?? []);
  const named = US_TILES.filter((t) => hot.has(t.code)).map((t) => t.name);
  const label = range.nationwide
    ? `Map of the United States: found nationwide${named.length ? `, most common in ${named.join(', ')}` : ''}.`
    : `Map of the United States: most common in ${named.join(', ')}.`;
  return (
    <figure className="usmap">
      <svg viewBox={`0 0 ${US_COLS * S} ${US_ROWS * S}`} role="img" aria-label={label}>
        {US_TILES.map((t) => {
          const level = hot.has(t.code) ? 'hot' : range.nationwide ? 'some' : 'none';
          return (
            <g key={t.code} className={`usmap__tile is-${level}`} style={{ animationDelay: `${(t.col + t.row) * 28}ms` }}>
              <title>{t.name}</title>
              <rect x={t.col * S} y={t.row * S} width={T} height={T} rx={1.8} />
              <text x={t.col * S + T / 2} y={t.row * S + T / 2}>{t.code}</text>
            </g>
          );
        })}
      </svg>
      {range.nationwide && hot.size > 0 && (
        <figcaption className="usmap__legend">
          <span><i className="is-hot" /> Most common</span>
          <span><i className="is-some" /> Also found</span>
        </figcaption>
      )}
    </figure>
  );
}
