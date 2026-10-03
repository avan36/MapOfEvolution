import type { Dataset, GroupsFile, JourneysFile, TimeFile, TreeFile } from './types';

export interface RawData {
  meta: { title: string };
  groups: GroupsFile;
  time: TimeFile;
  journeys: JourneysFile;
  treeFiles: { path: string; file: TreeFile }[];
}

/** Merges the split JSON files in `/data` into a single {@link Dataset}. */
export function assembleDataset(raw: RawData): Dataset {
  return {
    format: 'map-of-evolution',
    version: 1,
    title: raw.meta.title,
    nodes: raw.treeFiles
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .flatMap((f) => f.file.nodes),
    groups: raw.groups.groups,
    time: { spans: raw.time.spans, events: raw.time.events },
    journeys: raw.journeys.journeys,
  };
}
