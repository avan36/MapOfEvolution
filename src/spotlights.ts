import type { TNode } from './model/tree';

/**
 * Quick "spotlight" filters shown in the filter dock. They are UI, not data:
 * each is a predicate over nodes, so you can add your own (e.g. by tag).
 */
export interface Spotlight { id: string; label: string; emoji: string; test: (n: TNode) => boolean }

const hasTag = (n: TNode, ...tags: string[]) => tags.some((t) => n.data.tags?.includes(t));

export const SPOTLIGHTS: Spotlight[] = [
  { id: 'fruits', label: 'Fruits & crops', emoji: '🍎', test: (n) => hasTag(n, 'fruit', 'vegetable', 'crop', 'food') },
  { id: 'dinosaurs', label: 'Dinosaurs', emoji: '🦖', test: (n) => n.data.group === 'dinosaurs' || hasTag(n, 'dinosaur') },
  { id: 'domesticated', label: 'Shaped by humans', emoji: '🧑‍🌾', test: (n) => hasTag(n, 'domesticated') },
  { id: 'extinct', label: 'Extinct', emoji: '🦴', test: (n) => n.extinct },
  { id: 'hybrids', label: 'Hybrids & mergers', emoji: '🧬', test: (n) => n.hybrids.length > 0 },
  { id: 'ocean', label: 'Ocean life', emoji: '🌊', test: (n) => hasTag(n, 'ocean') },
  { id: 'flight', label: 'Took flight', emoji: '🪽', test: (n) => hasTag(n, 'flight') },
];
