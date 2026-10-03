/**
 * The data model behind the Map of Evolution.
 *
 * Everything the UI shows comes from plain JSON files in `/data`. The UI never
 * hard-codes organisms, eras or stories — swap the JSON and the whole site
 * changes. See `data/README.md` for the authoring guide and
 * `schema/*.schema.json` for editor autocompletion/validation.
 */

/** Taxonomic rank, used for badges and label sizing. */
export type Rank =
  | 'root'
  | 'domain'
  | 'supergroup'
  | 'kingdom'
  | 'clade'
  | 'phylum'
  | 'class'
  | 'order'
  | 'family'
  | 'genus'
  | 'species'
  | 'subspecies'
  | 'cultivar'
  | 'breed'
  | 'hybrid';

export type Confidence = 'high' | 'medium' | 'low';

/** One lineage in the tree of life. */
export interface TaxonNode {
  /** Unique, stable, kebab-case id. Referenced by `parent`, `hybridOf` and journeys. */
  id: string;
  /** Friendly display name, e.g. "Tyrannosaurus rex", "Mammals", "Banana". */
  name: string;
  /** Formal scientific name when it differs from `name`, e.g. "Mammalia". */
  scientific?: string;
  /** The id of the lineage this one branched from. `null` only for the root. */
  parent: string | null;
  /**
   * Additional ancestors for reticulate evolution: hybrids (orange = pomelo × mandarin),
   * or endosymbiosis (mitochondria came from bacteria). Drawn as dashed links.
   */
  hybridOf?: string[];
  rank: Rank;
  /** Broad group id from `data/groups.json`; drives colour and filtering. */
  group: string;
  /** When this lineage originated, in millions of years ago (Ma). 0.01 = 10,000 years ago. */
  appeared: number;
  /** When this lineage went extinct, in Ma. Omit for living lineages. */
  extinct?: number;
  /** A single emoji used as an icon. */
  emoji?: string;
  /** One to three sentences, written for a curious 12-year-old and up. */
  summary: string;
  /** Short surprising facts. */
  facts?: string[];
  /** Free-form tags. Well-known: landmark, fruit, vegetable, crop, dinosaur, domesticated, human, ocean, flight. */
  tags?: string[];
  /** For domesticated lineages: where/when/how humans shaped it. */
  origin?: string;
  /** English Wikipedia article title (used for photos and "read more"). */
  wiki?: string;
  /**
   * Picture override: an English Wikipedia article title whose lead photo shows what this
   * looks like (e.g. a well-known member of a clade), or a full https:// image URL.
   * Defaults to the photo of `wiki`.
   */
  image?: string;
  /** How settled the science on dating/placement is. Defaults to "high". */
  confidence?: Confidence;
}

export interface TreeFile {
  $schema?: string;
  /** Optional note on what this file covers. */
  description?: string;
  nodes: TaxonNode[];
}

export interface Group {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface GroupsFile {
  $schema?: string;
  groups: Group[];
}

/** A slice of geological time (eon / era / period). */
export interface TimeSpan {
  id: string;
  name: string;
  level: 'eon' | 'era' | 'period';
  /** Start in Ma (older bound). */
  start: number;
  /** End in Ma (younger bound). */
  end: number;
  /** Official ICS chart colour — part of the scientific convention, not the UI theme. */
  color: string;
  summary: string;
}

/** A notable moment in Earth's history. */
export interface HistoryEvent {
  id: string;
  name: string;
  /** Ma */
  time: number;
  kind: 'extinction' | 'milestone' | 'planet';
  emoji: string;
  summary: string;
}

export interface TimeFile {
  $schema?: string;
  spans: TimeSpan[];
  events: HistoryEvent[];
}

export interface JourneyStep {
  /** Node to fly to. */
  node: string;
  /** Narration shown on the story card. Markdown-free plain text. */
  text: string;
  /** Optional heading override for this step. */
  title?: string;
}

export interface Journey {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  steps: JourneyStep[];
}

export interface JourneysFile {
  $schema?: string;
  journeys: Journey[];
}

/** Everything the app needs, merged. This is also the shape of an exported bundle. */
export interface Dataset {
  format: 'map-of-evolution';
  version: 1;
  title: string;
  nodes: TaxonNode[];
  groups: Group[];
  time: { spans: TimeSpan[]; events: HistoryEvent[] };
  journeys: Journey[];
}
