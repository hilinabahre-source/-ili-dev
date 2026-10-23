# ILI

Source for [ilipatterns.com](https://ilipatterns.com): a static site on GitHub Pages. There's no build step: the files in this repo are exactly what gets served.

## Layout

```
index.html        Markup only: nav, one <section> per page, modals, footer, Jelly
CNAME             Custom domain for GitHub Pages (must stay at the root)

css/              Stylesheets, linked in this order (later files win ties):
  base.css          variables, reset, buttons, pills, chips, toast, footer
  nav.css           top nav and garment buttons
  home.css          hero, logo, floating cards, "How it works"
  patterns.css      Discover grid, pattern detail, My Patterns
  forms.css         Request a Pattern and Leave Feedback
  diagrams.css      seam-diagram animations
  modals.css        avatar form inside the profile modal
  jelly.css         Jelly helper
  responsive.css    every @media rule (keep it last)

js/               ES modules, loaded from js/main.js
  main.js           entry point: puts inline-handler functions on window,
                    renders Home, starts Jelly, then loads Supabase/BodyDouble
  state.js          app state and constants (trends, colors, feedback levels)
  router.js         navigate(), render(), toast()
  data/             PATTERNS and DONATION_CAUSES
  lib/              geometry (curve maths) and SVG diagram helpers
  views/            one file per page, plus the construction modal
  services/         Supabase accounts and saved-pattern cloud sync
  components/       profile modal, BodyDouble avatar, Jelly

assets/
  images/           pattern photos
  patterns/         printable pattern PDFs
  icons/            favicons
  models/           3D model files
```

### Things to know when editing

- **Inline handlers need `window`.** HTML attributes like `onclick="navigate('home')"`, including ones inside JS template strings, can only call globals. Module functions aren't global, so any function used that way must be added to the `Object.assign(window, {...})` list in `js/main.js`.
- **Load order matters.** The Supabase CDN `<script>` in `index.html` must stay above `js/main.js`. Supabase and the BodyDouble viewer are loaded with a dynamic `import()` at the end of `main.js`, so a slow BodyDouble CDN doesn't block the rest of the site. Those modules talk to the rest of the app through `window.*` functions (`window.loadCloudPatterns`, `window.renderAuthUI`, etc.).
- **Asset paths are relative to the site root**, e.g. `assets/images/…` in `js/data/patterns.js`.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

The BodyDouble 3D avatar won't render on localhost, because BodyDouble only allows its viewer to be embedded on approved sites. The measurement form still works.

## Deploy

Push to `main`. GitHub Pages serves the repository root as-is.
