# ILI: Split `index.html` into separate CSS, JS and asset files

**Project:** ilipatterns.com, a static site hosted on GitHub Pages
**Goal:** Break the single 2,200-line `index.html` into organized CSS, JS and asset files. The site must look and behave exactly the same afterwards.
**Approach:** Option A, with no build step and no new tools. The site keeps deploying exactly as it does today.

---

## 1. Why

All of the site is currently in one file: about 400 lines of CSS, 1,200 lines of JavaScript and the HTML for every page. That makes it hard to find things, hard to review changes, and easy to break one feature while editing another. Splitting it by responsibility (styles, page logic, data, backend) fixes that and keeps hosting unchanged.

## 2. Target folder structure

```
ili/
├── index.html                  # HTML only: <head>, nav, the <section> for each page, modals, footer, Jelly markup
├── CNAME                       # stays at the root (required by GitHub Pages)
├── README.md                   # short note on how the project is organized
│
├── css/
│   ├── base.css                # :root variables, fonts, reset, buttons, pills, chips, toast, footer
│   ├── nav.css                 # top navigation and garment buttons
│   ├── home.css                # hero, sashiko logo animation, floating cards, "How it works"
│   ├── patterns.css            # browse grid, pattern detail, steps, My Patterns
│   ├── forms.css               # Request a Pattern and Leave Feedback forms
│   ├── diagrams.css            # seam-diagram and mini-Jelly animations
│   ├── modals.css              # profile modal, construction modal, avatar form
│   ├── jelly.css               # Jelly helper and Discord badge
│   └── responsive.css          # all @media rules, loaded last
│
├── js/
│   ├── main.js                 # entry point: imports everything, exposes onclick handlers, starts the app
│   ├── state.js                # state object, TRENDS, DIFFICULTIES, color maps, FEEDBACK_LEVELS
│   ├── router.js               # navigate(), render(), toast()
│   │
│   ├── data/
│   │   ├── patterns.js         # PATTERNS array
│   │   └── donations.js        # DONATION_CAUSES array
│   │
│   ├── lib/
│   │   ├── geometry.js         # bez(), bezTangent(), sampleSideCurve(), pointsToPath(), mirrorPoints()
│   │   └── diagrams.js         # svgDiagram(), constructionIcon(), assemblyPieceSvg(), miniJellySvg(), thumbGradient()
│   │
│   ├── views/
│   │   ├── home.js             # renderHome()
│   │   ├── browse.js           # renderBrowse(), filters, toggleSave()
│   │   ├── detail.js           # renderDetail(), steps, yardage, assembly guide
│   │   ├── construction.js     # construction modal (openConstructionModal)
│   │   ├── my-patterns.js      # renderMyPatterns()
│   │   ├── request.js          # renderRequest(), submitRequest(), searchPinterest()
│   │   ├── feedback.js         # renderFeedbackView(), submitFeedback()
│   │   └── donate.js           # renderDonate(), donationCauseHtml()
│   │
│   ├── services/
│   │   ├── supabase.js         # Supabase client, auth UI, measurements load/save
│   │   └── cloud-sync.js       # syncPatternToCloud(), loadCloudPatterns(), resetLocalPatternState()
│   │
│   └── components/
│       ├── profile-modal.js    # profile button and modal open/close
│       ├── avatar.js           # BodyDouble 3D viewer and measurement form
│       └── jelly.js            # Jelly helper tips
│
└── assets/
    ├── images/                 # pattern photos (.jpg)
    ├── patterns/               # printable pattern PDFs
    ├── icons/                  # favicon.svg, favicon-16.png, favicon-32.png, apple-touch-icon.png
    └── models/                 # avatar_shapekey.glb
```

## 3. Where things live today

Line numbers refer to the current `index.html` at commit `363b0fb`. Treat them as approximate and match on content.

| Current location | What it is | Moves to |
|---|---|---|
| L10–348 `<style>` | Main stylesheet. Its comment headers (`layout shell`, `HOME`, `BROWSE`, `PATTERN DETAIL`, `CREATE`, `REQUEST DESIGN`, `MY PATTERNS`, `diagram animations`) map directly to the CSS files | `css/*.css` |
| L2019–2118 `<style>` | Jelly helper styles | `css/jelly.css` |
| L480–634 `<script>` | Construction modal IIFE: curve maths, `pieceSvg`, `window.openConstructionModal` | `js/lib/geometry.js` and `js/views/construction.js` |
| L636–767 `<script>` | `DONATION_CAUSES`, `donationCauseHtml`, `window.renderDonate` | `js/data/donations.js` and `js/views/donate.js` |
| L769–816 `<script>` | Profile button and modal open/close | `js/components/profile-modal.js` |
| L968–1616 `<script>` | Main app: state, data, diagrams, router, every view, cloud sync, init | Split across `state.js`, `data/`, `lib/`, `router.js`, `views/`, `services/cloud-sync.js`, `main.js` |
| L1654 | Supabase library from CDN (classic script) | Stays in `index.html` as a classic `<script>`, before the modules |
| L1655–2009 `<script type="module">` | Supabase client, auth, measurements, BodyDouble viewer | `js/services/supabase.js` and `js/components/avatar.js` |
| L2147–2220 `<script>` | Jelly tips | `js/components/jelly.js` |
| Root `*.jpg`, `*.pdf`, favicons, `.glb` | Assets | `assets/…`, with every path in HTML and JS updated |

## 4. Rules

1. **Behavior must not change.** This is a pure restructure. Don't fix bugs, change styles, rename user-facing text or "improve" anything along the way. Write any problems you notice in the final summary instead.
2. **No build step.** No npm, bundler or framework. The site must still work when served as plain static files on GitHub Pages.
3. **Use ES modules.** Load JS through a single `<script type="module" src="js/main.js">`, with files connected by `import`/`export`. The only classic script is the Supabase CDN script, which must still load before the modules.
4. **Keep the inline event handlers working.** These are `onclick`, `onmouseenter` and `onmouseleave`, both in the HTML and inside JS template strings. Modules don't create global functions, so those handlers can no longer reach them on their own. In `main.js`, explicitly assign each one to `window`. Find the full list with `grep -o 'on[a-z]*="[a-zA-Z]*(' index.html | sort -u`. Today that list is `navigate`, `toggleSave`, `toggleStep`, `resetProgress`, `openConstructionModal`, `setFeedbackLevel`, `submitFeedback`, `submitRequest`, `searchPinterest`, `showMiniJelly` and `hideMiniJelly`.
5. **Keep the existing `window.*` bridges** (`window.supabaseClient`, `window.iliGetCurrentUser`, `window.loadCloudPatterns`, `window.renderAuthUI`, and so on) for now, or replace them with imports. Either way, every caller must still work.
6. **Keep the CSS cascade order.** Link the stylesheets in the order their rules currently appear, with `responsive.css` last. Copy rules exactly as they are.
7. **Leave external URLs alone:** Google Fonts, the Supabase CDN, BodyDouble, the donation links and the Wikimedia and emoji images.
8. **Don't delete any file.** `avatar_shapekey.glb` looks unused but should still be moved, not deleted. `.DS_Store` can be removed and added to a new `.gitignore`.
9. **Keep `CNAME` at the repo root.**

## 5. Order of work

Make one commit per step, and check the site in a browser before moving on to the next.

1. **Assets:** move files into `assets/` and update every reference, including the `image:` and `url:` fields in `PATTERNS` and the favicon `<link>`.
2. **CSS:** extract both `<style>` blocks into `css/` and replace them with `<link>` tags in the same order.
3. **Data:** move `PATTERNS` and `DONATION_CAUSES` into `js/data/`.
4. **Shared libraries:** move `state.js`, `router.js`, `lib/geometry.js` and `lib/diagrams.js`.
5. **Views:** move one view at a time, starting with the simplest (home, then donate, request and feedback, then browse, my-patterns and detail, then construction).
6. **Services and components:** move Supabase, cloud sync, profile modal, avatar and Jelly.
7. **Entry point:** `main.js` imports everything, assigns the `window` handlers and calls `navigate('home')`. At this point `index.html` should contain no `<style>` blocks and no inline `<script>` code.
8. **Docs:** add a short `README.md` covering the folder layout, how to run locally (`python3 -m http.server 8000`) and how to deploy (push to `main`).

## 6. Testing

ES modules don't load over `file://`, so always test through a local server:

```
python3 -m http.server 8000
# open http://localhost:8000
```

After each step, check the following with the browser console open. There must be no new errors.

- [ ] Home loads, and the ILI logo animation and floating cards show
- [ ] Every nav button switches pages and highlights as active
- [ ] Discover shows both patterns, and the "coming soon" pattern still behaves as before
- [ ] White Mini Skirt detail: steps check and uncheck, the seam diagrams animate, the fabric estimate shows, the PDFs download, Reset works
- [ ] 📐 Construction modal opens and draws the Front and Back pieces
- [ ] The assembly guide and mini-Jelly appear on the detail page
- [ ] Heart or save a pattern, and it appears in My Patterns with the right progress
- [ ] Request a Pattern: submitting adds it to the feed, and the Pinterest search opens a new tab
- [ ] Leave Feedback: the level chips select, and submitting shows the toast
- [ ] Donation Bin lists all the causes with logos and links
- [ ] Profile modal opens, the BodyDouble 3D avatar loads, and editing measurements reshapes it
- [ ] Sign up and log in work, and saved measurements and progress reload after a page refresh
- [ ] Jelly greets on each page with the right tip, and dock and close work
- [ ] Mobile width (about 375px) looks the same as before

## 7. Done when

- `index.html` contains only markup, `<link>` tags, the Supabase CDN script and one `<script type="module" src="js/main.js">`
- Every item in the testing checklist passes, with no new console errors
- The live site works the same after pushing to `main`

---

## 8. Prompt for Claude Code

Copy everything in the block below into Claude Code, opened in the root of the repository:

```
Read RESTRUCTURE_PLAN.md in the repo root and carry it out.

Context: this is ILI (ilipatterns.com), a static GitHub Pages site where all of the HTML, CSS
and JS is in a single index.html. I want it split into the folder structure in section 2 of
the plan, with no build step.

How to work:
- Follow the rules in section 4 strictly. Behavior and appearance must not change at all.
  This is a move-only refactor. If you notice bugs, list them at the end; don't fix them.
- Before moving anything, read index.html in full and map each block to its new file.
  Line numbers in the plan are approximate, so match on content.
- Go through the steps in section 5 in order. Make a separate git commit for each step on a
  new branch called `restructure`. Don't push and don't merge into main.
- After each step, serve the site with `python3 -m http.server 8000` and check it against
  the testing checklist in section 6. If you can drive a browser, do that and watch the
  console for errors. If you can't, say so clearly, and at minimum grep for every function
  referenced in an inline onclick/onmouseenter/onmouseleave handler and confirm it is
  assigned to window in main.js.
- Pay special attention to: inline event handlers (modules aren't global), script load
  order (the Supabase CDN script must run before the modules), CSS order, and asset paths
  after the move to assets/.
- Don't delete any file except .DS_Store. Ask me before doing anything the plan doesn't cover.

When finished, give me:
1. The final file tree
2. A list of commits
3. Which checklist items you checked in a real browser and which you only checked by reading code
4. Any bugs or oddities you noticed but didn't fix
```
