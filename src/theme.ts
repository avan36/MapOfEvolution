/**
 * UI theme & behaviour knobs. Everything visual that is NOT data lives here,
 * so you can restyle the whole experience without touching `/data`.
 */
export const theme = {
  /** Colour for each group id in data/groups.json. Unknown groups get a generated hue. */
  groupColors: {
    origins: '#fff4c2',
    bacteria: '#7cf5d1',
    archaea: '#ffb86b',
    protists: '#c8a6ff',
    fungi: '#ff9ec7',
    plants: '#8cf26b',
    invertebrates: '#ff7a7a',
    fish: '#58b7ff',
    amphibians: '#3df2a5',
    reptiles: '#d5e86a',
    dinosaurs: '#ff9548',
    birds: '#62e7ff',
    mammals: '#ffcf5c',
    humans: '#ff6bd6',
  } as Record<string, string>,
  /** Highlight colours. */
  lineage: '#ffffff',
  compareA: '#5ee7ff',
  compareB: '#ff7ad9',
  hybrid: '#ffd36b',
  extinction: '#ff4d6d',

  fonts: {
    ui: '"Inter Tight", "Inter", system-ui, -apple-system, Segoe UI, sans-serif',
    display: '"Instrument Serif", "Iowan Old Style", Georgia, serif',
  },

  layout: {
    /** World units between neighbouring leaves. */
    leafSpacing: 13,
    /** Extra leaf-slots inserted where the colour group changes. */
    groupGap: 3,
    /** Fraction of the circle left open as a wedge (where the tree "starts"). */
    wedge: 0.05,
    /** Linear (timeline) view width in world units. */
    timelineWidth: 3200,
    /**
     * How strongly the time axis adapts to the data: 0 = pure logarithmic time,
     * 1 = every branching event gets equal room. Busy moments (the dinosaurs,
     * domestication) get more space while eras stay in true order.
     */
    timeWarp: 0.6,
  },

  motion: {
    /** ms for the radial ⇄ timeline morph. */
    morph: 1500,
    /** ms for the intro "growth" of the tree. */
    grow: 4200,
    /** seconds to play the whole history from LUCA to today. */
    playback: 45,
    particles: 140,
  },

  /** Fetch thumbnail photos from Wikipedia for the detail panel. */
  wikipediaImages: true,
};

export function groupColor(group: string): string {
  const c = theme.groupColors[group];
  if (c) return c;
  let h = 0;
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 85% 70%)`;
}
