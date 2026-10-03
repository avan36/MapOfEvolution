import { AnimatePresence, motion } from 'framer-motion';
import { createStore, useStore } from '../lib/store';

interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' }
const store = createStore<Toast[]>([]);
let seq = 0;

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++seq, text, kind };
  store.set([...store.get(), t]);
  setTimeout(() => store.set(store.get().filter((x) => x.id !== t.id)), kind === 'error' ? 7000 : 3800);
}

export function Toasts() {
  const toasts = useStore(store);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast--${t.kind}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
          >
            <span>{t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '✅' : '✨'}</span>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
