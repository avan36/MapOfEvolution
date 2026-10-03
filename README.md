# Map of Evolution

**An interactive, animated tree of life**, running from the first cell 4.2 billion years ago through bacteria, mushrooms, trilobites and dinosaurs to the banana in your kitchen and you.

- **🌳 Radial tree ⇄ 📈 timeline.** Two views of the same tree that morph into each other. The distance from the centre (or from the left edge) is time.
- **▶ Play history.** Scrub or play through four billion years and watch the tree grow. Mass extinctions pulse in red as you pass them.
- **🔎 Search everything** (`/` or `⌘K`) and fly to any organism.
- **⚖️ Compare any two organisms** to find their last common ancestor ("You and a banana last shared an ancestor 1.7 billion years ago").
- **🧭 Guided journeys.** Story tours such as *From the first cell to you*, *How dinosaurs became birds* and *Where your fruit bowl came from*.
- **🍊 Hybrids and mergers.** Reticulate evolution is drawn as flowing gold links: the orange is a pomelo × mandarin cross, and mitochondria were once free-living bacteria.
- **🍎 Spotlights** for fruits & crops, dinosaurs, extinct life, domesticated species and more.
- **🩺 Germs & medicine.** Germ cards show the diseases they cause, the antibiotics that treat them (each linked to the microbe the drug comes from) and a map of where they turn up in the US.
- **📦 Portable data.** All content is plain JSON. You can export it, edit it, or drag in your own dataset.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # validates the data, type-checks, builds to dist/
npm run validate   # check the data only
npm run export     # write the merged dataset to one JSON file
```

`dist/` is a static site that can be hosted anywhere (GitHub Pages, Netlify, S3, or a USB stick). It uses relative paths.

### Publishing online

- **GitHub Pages (set up already).** `.github/workflows/deploy.yml` builds and publishes the site on every push to the repo's default branch (GitHub only lets the default branch publish to Pages). One-time setup: in the repo go to *Settings → Pages* and set *Source* to **GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/`.
- **Netlify, Vercel or Cloudflare Pages.** Import the repo and use build command `npm run build` and output directory `dist`.

## How it's built

```
data/                ← CONTENT. Edit this to change what the site says.
  tree/*.json        ← lineages; every file here is merged automatically
  groups.json        ← colour/filter groups (Bacteria, Plants, Dinosaurs…)
  time.json          ← eons/eras/periods + events (mass extinctions…)
  journeys.json      ← guided story tours
  README.md          ← authoring guide for the data format
schema/              ← JSON Schemas → autocomplete & validation in your editor
src/
  theme.ts           ← LOOK & FEEL. Group colours, fonts, layout and animation knobs
  spotlights.ts      ← the quick filters in the dock
  styles.css         ← visual system (CSS custom properties at the top)
  data/              ← types, loader, validator (shared with the CLI scripts)
  model/             ← tree building, time axis, search, common ancestors
  render/Renderer.ts ← the canvas engine (layout, morph, glow, particles, labels)
  components/        ← React UI: panels, search, time bar, journeys…
scripts/             ← `validate` and `export` CLIs
```

**Data and UI are fully separate.** The UI never hard-codes an organism, era or story. That means you can:

- **Keep the data and rebuild the UI.** `npm run export` (or the in-app *Data → Export dataset*) writes one self-describing JSON file (`"format": "map-of-evolution"`) that any other front end can read.
- **Keep the UI and swap the data.** Edit `data/`, or drag a dataset onto the running site. A file containing only `{ "nodes": [...] }` is *merged in*, which is handy for adding your own organisms.
- **Restyle without touching either.** Change colours, fonts, timings and layout in `src/theme.ts` and `src/styles.css`.

### The time axis

Pure logarithmic time crushes the dinosaurs between the microbes and the last 10,000 years of farming. The axis instead blends log time with the density of branching events in the data. Busy stretches get more room, and the order of events is always kept. Set `theme.layout.timeWarp` from `0` (pure log) to `1` (equal room per event).

## Data sources and accuracy

Dates and relationships follow current mainstream phylogenetics and paleontology as summarised on Wikipedia and in recent literature. Dates are approximate, and nodes carry a `confidence` field where the science is unsettled. Photos (the detail-panel picture, its gallery and full-screen viewer, and hover-card thumbnails) are loaded from Wikipedia's public APIs at runtime, with credit and licence links for each image. A node uses the lead photo of its `image` article if it has one, otherwise its `wiki` article, then its scientific name and finally its common name. To turn photos off, set `theme.wikipediaImages = false`.
