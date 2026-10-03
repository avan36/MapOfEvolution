import { useEffect, useRef } from 'react';
import type { TNode, TreeModel } from '../model/tree';
import { Renderer } from '../render/Renderer';
import type { Store } from '../lib/store';
import type { HoverState, TimeState } from '../App';

interface Props {
  model: TreeModel;
  onReady(r: Renderer): void;
  onClick(n: TNode | null): void;
  hoverStore: Store<HoverState>;
  timeStore: Store<TimeState>;
  selected: TNode | null;
  compare: [TNode, TNode] | null;
  filter: Set<TNode> | null;
}

/** The full-screen canvas. Owns the Renderer instance for the app's lifetime. */
export function Stage({ model, onReady, onClick, hoverStore, timeStore, selected, compare, filter }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    const r = new Renderer(canvasRef.current!, model, {
      onHover: (node, x, y) => {
        const prev = hoverStore.get().node;
        hoverStore.set({ node, x, y });
        if (prev !== node) r.setHighlight({ hovered: node });
      },
      onClick: (n) => clickRef.current(n),
      onTime: (s, playing) => {
        const cur = timeStore.get();
        if (cur.s !== s || cur.playing !== playing) timeStore.set({ s, playing });
      },
    });
    rendererRef.current = r;
    onReady(r);
    return () => r.destroy();
    // The renderer is created once; model changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (r && r.getModel() !== model) {
      r.setModel(model);
      hoverStore.set({ node: null, x: 0, y: 0 });
    }
  }, [model, hoverStore]);

  useEffect(() => {
    rendererRef.current?.setHighlight({ selected, compare, filter });
  }, [selected, compare, filter, model]);

  return <canvas ref={canvasRef} className="stage" aria-label="Interactive tree of life" />;
}
