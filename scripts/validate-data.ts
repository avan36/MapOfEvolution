import { readDataset } from './read-data';
import { validateDataset } from '../src/data/validate';

const ds = readDataset();
const { errors, warnings } = validateDataset(ds);
for (const w of warnings) console.warn(`  ⚠ ${w}`);
for (const e of errors) console.error(`  ✖ ${e}`);

const extinct = ds.nodes.filter((n) => n.extinct !== undefined).length;
console.log(
  `\n${errors.length ? '✖' : '✔'} ${ds.nodes.length} lineages (${extinct} extinct), ` +
    `${ds.groups.length} groups, ${ds.time.spans.length} time spans, ${ds.time.events.length} events, ` +
    `${ds.journeys.length} journeys — ${errors.length} errors, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
