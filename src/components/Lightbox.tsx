import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { wikiUrl, type Photo } from '../lib/wiki';

interface Props {
  photos: Photo[];
  index: number;
  title: string;
  color: string;
  onIndex(i: number): void;
  onClose(): void;
}

const slide = {
  enter: (dir: number) => ({ x: dir * 80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -80, opacity: 0, scale: 0.96 }),
};

/** Full-screen photo viewer: arrows / swipe to browse, Esc to close. */
export function Lightbox({ photos, index, title, color, onIndex, onClose }: Props) {
  const [dir, setDir] = useState(0);
  const n = photos.length;
  const go = (d: number) => {
    if (n < 2) return;
    setDir(d);
    onIndex((index + d + n) % n);
  };
  const p = photos[index];

  useEffect(() => {
    // Capture phase so the app's own shortcuts (Esc closes the panel, arrows step journeys) don't fire too.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Warm the neighbours so browsing feels instant.
  useEffect(() => {
    for (const d of [1, -1]) {
      const q = photos[(index + d + n) % n];
      if (q) new Image().src = q.large;
    }
  }, [index, photos, n]);

  if (!p) return null;

  return createPortal(
    <motion.div
      className="lightbox"
      style={{ '--c': color } as React.CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${title}`}
    >
      <div className="lightbox__glow" />
      <div className="lightbox__top" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox__title">{title}</span>
        {n > 1 && <span className="lightbox__count">{index + 1} / {n}</span>}
        <button className="lightbox__close" onClick={onClose} aria-label="Close photos">✕</button>
      </div>

      <div className="lightbox__stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={p.large}
            className="lightbox__img"
            src={p.large}
            alt={p.caption ?? title}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            drag={n > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) go(1);
              else if (info.offset.x > 70) go(-1);
            }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </AnimatePresence>
        {n > 1 && (
          <>
            <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo">‹</button>
            <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo">›</button>
          </>
        )}
      </div>

      <div className="lightbox__foot" onClick={(e) => e.stopPropagation()}>
        {p.caption && <p className="lightbox__caption">{p.caption}</p>}
        <div className="lightbox__credit">
          From Wikipedia{p.article && <> · <a href={wikiUrl(p.article)} target="_blank" rel="noreferrer">{p.article}</a></>}
          {p.file && <> · <a href={wikiUrl(p.file)} target="_blank" rel="noreferrer">photo credit &amp; licence</a></>}
        </div>
        {n > 1 && (
          <div className="lightbox__thumbs">
            {photos.map((q, i) => (
              <button
                key={q.src}
                className={`lightbox__thumb ${i === index ? 'is-on' : ''}`}
                onClick={() => { setDir(i > index ? 1 : -1); onIndex(i); }}
                aria-label={`Photo ${i + 1}`}
              >
                <img src={q.thumb} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
