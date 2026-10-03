import type { TreeModel } from '../model/tree';
import { useStore, type Store } from '../lib/store';
import type { HoverState } from '../App';
import { formatAgo } from '../lib/format';
import { usePhoto } from '../lib/wiki';

/** Small floating card that follows the pointer over the tree. */
export function HoverCard({ store, model, hidden }: { store: Store<HoverState>; model: TreeModel; hidden: boolean }) {
  const { node, x, y } = useStore(store);
  // Also warms the cache, so the detail panel's photo is usually ready by the time you click.
  const shot = usePhoto(node?.data);
  if (!node || hidden) return null;
  const d = node.data;
  const g = model.groups.get(d.group);
  const flip = x > window.innerWidth - 320;
  return (
    <div className="hovercard glass" style={{ left: flip ? x - 16 : x + 16, top: y + 16, transform: flip ? 'translateX(-100%)' : undefined, '--c': node.color } as React.CSSProperties}>
      <div className="hovercard__row">
        {shot.status === 'ready' ? (
          <span className="hovercard__thumb"><img src={shot.photo.thumb} alt="" /></span>
        ) : (
          <span className="hovercard__emoji">{d.emoji ?? '•'}</span>
        )}
        <div>
          <div className="hovercard__name">{d.name}</div>
          {d.scientific && <div className="hovercard__sci">{d.scientific}</div>}
        </div>
      </div>
      <div className="hovercard__meta">
        <span className="hovercard__dot" /> {g?.label ?? d.group} · {node.extinct ? `${formatAgo(d.appeared, true)} → ${formatAgo(d.extinct!, true)}` : `since ${formatAgo(d.appeared, true)}`}
      </div>
      <div className="hovercard__hint">Click to explore</div>
    </div>
  );
}
