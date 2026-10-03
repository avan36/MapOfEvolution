import type { Renderer } from '../render/Renderer';

export function ZoomControls({ renderer }: { renderer: React.RefObject<Renderer | null> }) {
  return (
    <div className="zoom glass" role="group" aria-label="Zoom">
      <button onClick={() => renderer.current?.zoomBy(1.6)} aria-label="Zoom in">+</button>
      <button onClick={() => renderer.current?.zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
      <button onClick={() => renderer.current?.fit()} aria-label="Show everything" title="Show everything (F)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
      </button>
    </div>
  );
}
