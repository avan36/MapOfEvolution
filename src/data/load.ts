import { assembleDataset } from './assemble';
import type { Dataset, GroupsFile, JourneysFile, TimeFile, TreeFile } from './types';
import meta from '../../data/meta.json';
import groups from '../../data/groups.json';
import time from '../../data/time.json';
import journeys from '../../data/journeys.json';

// Every JSON file dropped into data/tree/ is picked up automatically.
const treeModules = import.meta.glob<TreeFile>('../../data/tree/*.json', { eager: true, import: 'default' });

export const bundledDataset: Dataset = assembleDataset({
  meta,
  groups: groups as GroupsFile,
  time: time as TimeFile,
  journeys: journeys as JourneysFile,
  treeFiles: Object.entries(treeModules).map(([path, file]) => ({ path, file })),
});
