import { useEffect, useState } from 'react';
import type { Dataset } from '../data/types';
import { importFile } from '../lib/dataio';
import { toast } from './Toasts';

/** Drag a dataset (or a single tree file) anywhere onto the page to load it. */
export function DropZone({ current, onLoad }: { current: Dataset; onLoad(ds: Dataset, label: string): void }) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setOver(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overH = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = async (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setOver(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      try {
        const { dataset, label } = await importFile(file, current);
        onLoad(dataset, label);
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overH);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overH);
      window.removeEventListener('drop', drop);
    };
  }, [current, onLoad]);
  if (!over) return null;
  return (
    <div className="dropzone">
      <div className="dropzone__inner">
        <div className="dropzone__icon">🧬</div>
        <h3>Drop a dataset to explore it</h3>
        <p>A full <code>.dataset.json</code> export replaces the tree. A file with just <code>{'{"nodes": [...]}'}</code> is merged in.</p>
      </div>
    </div>
  );
}
