# Data format

Everything the site shows comes from the JSON files in this folder. All of them have JSON Schemas in `/schema`, so editors like VS Code give you autocomplete and inline errors. After editing, run `npm run validate`.

## `tree/*.json`: lineages

Each file is `{ "nodes": [ ... ] }`. All files in `tree/` are merged (sorted by filename), so you can split the tree however you like. Add a new file to add a new branch.

```jsonc
{
  "id": "sweet-orange",                 // unique, kebab-case
  "name": "Sweet orange",               // display name
  "scientific": "Citrus × sinensis",    // optional
  "parent": "pomelo",                   // the lineage it branched from (null only for the root, LUCA)
  "hybridOf": ["mandarin"],             // optional extra ancestors (hybrids, endosymbiosis)
  "rank": "hybrid",                     // root|domain|supergroup|kingdom|clade|phylum|class|order|family|genus|species|subspecies|cultivar|breed|hybrid
  "group": "plants",                    // an id from groups.json (drives colour + filters)
  "appeared": 0.003,                    // millions of years ago (0.003 = 3,000 years ago)
  "extinct": 66,                        // optional; millions of years ago
  "emoji": "🍊",
  "summary": "One to three sentences.",
  "facts": ["Short surprising facts."],
  "tags": ["fruit", "domesticated"],    // free-form; see below
  "origin": "Where/when/how humans domesticated it.",
  "wiki": "Orange (fruit)",             // English Wikipedia title (photo + link)
  "confidence": "medium"                // high (default) | medium | low
}
```

**Rules the validator enforces**

- Exactly one root (`"parent": null`).
- Every `parent` and `hybridOf` id exists, and there are no cycles.
- A child cannot appear before its parent: `appeared ≤ parent.appeared`.
- `extinct ≤ appeared`.
- Journey steps point at real nodes.

**Tags the UI understands:** `landmark` (labelled even when zoomed out), `fruit`, `vegetable`, `crop`, `food` (🍎 spotlight), `dinosaur`, `domesticated`, `ocean`, `flight`, `living-fossil`. You can add any other tags, and they are searchable.

## `groups.json`

Broad colour groups (`id`, `label`, `emoji`, `description`). Colours live in `src/theme.ts` (`groupColors`) because they belong to the UI, not the science. A new group without a colour gets a generated one.

## `time.json`

- `spans`: eons, eras and periods with `start`/`end` in Ma and their official ICS chart colour.
- `events`: moments such as mass extinctions (`kind: "extinction"` draws a red ring), milestones and planetary events.

## `journeys.json`

Guided tours: `{ id, title, subtitle, emoji, steps: [{ node, title?, text }] }`. The first journey is offered on the welcome screen.

## Exported bundle

*Data → Export dataset* in the app (or `npm run export`) produces:

```jsonc
{ "format": "map-of-evolution", "version": 1, "title": "…",
  "nodes": [...], "groups": [...], "time": { "spans": [...], "events": [...] }, "journeys": [...] }
```

Drop that file onto the site to load it, or build a completely different UI on top of it.
