import { motion } from 'framer-motion';
import type { TNode, TreeModel } from '../model/tree';
import { theme } from '../theme';
import { formatAgo } from '../lib/format';

export function CompareCard({ model, pair, onClose, onSelect }: { model: TreeModel; pair: [TNode, TNode]; onClose(): void; onSelect(n: TNode): void }) {
  const [a, b] = pair;
  const anc = model.mrca(a, b);
  const stepsA = model.lineage(a).length - model.lineage(anc).length;
  const stepsB = model.lineage(b).length - model.lineage(anc).length;
  const same = anc === a || anc === b;
  return (
    <motion.div className="compare glass" initial={{ y: -30, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
      <button className="panel__close" onClick={onClose} aria-label="Close comparison">✕</button>
      <div className="compare__pair">
        <button className="compare__who" style={{ '--c': theme.compareA } as React.CSSProperties} onClick={() => onSelect(a)}>
          <span className="compare__emoji">{a.data.emoji}</span>{a.data.name}
        </button>
        <span className="compare__amp">&amp;</span>
        <button className="compare__who" style={{ '--c': theme.compareB } as React.CSSProperties} onClick={() => onSelect(b)}>
          <span className="compare__emoji">{b.data.emoji}</span>{b.data.name}
        </button>
      </div>
      <div className="compare__verdict">
        {same ? (
          <>One is the direct ancestor of the other.</>
        ) : (
          <>
            share a common ancestor from <b>{formatAgo(anc.data.appeared)}</b>
          </>
        )}
      </div>
      <button className="compare__anc" onClick={() => onSelect(anc)}>
        <span className="compare__anc-label">Last common ancestor</span>
        <span className="compare__anc-name">{anc.data.emoji} {anc.data.name}{anc.data.scientific && anc.data.scientific !== anc.data.name ? <i> · {anc.data.scientific}</i> : null}</span>
      </button>
      <div className="compare__steps">
        <span style={{ color: theme.compareA }}>{stepsA} branch points</span> ↔ <span style={{ color: theme.compareB }}>{stepsB} branch points</span>
      </div>
    </motion.div>
  );
}
