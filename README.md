# Mohit Malhotra — Portfolio

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=github&logoColor=white)](https://pages.github.com/)

A fully static, multi-page portfolio with an editorial light theme — paper, ink, and a single blue accent, set in Space Grotesk, Inter, and JetBrains Mono. No build step for the site, no backend: open `index.html` locally or host from any static origin.

**Live:** [mohit51196.github.io](https://mohit51196.github.io)

---

## Features

- **3D hero & system anatomy** — WebGL scenes via Three.js with CSS fallbacks when WebGL is unavailable
- **Terminal mode** — press `` ` `` or the `>_` nav control for Tab autocomplete, ghost suggestions, history, and an in-shell article pager (`help`, `blogs`, `read 1`, `banner`, `sudo hire-me`)
- **Versioned blog** — Medium export → committed JSON corpus → generated article pages (no scheduled fetch)
- **Accessible by default** — `prefers-reduced-motion`, focus-trapped terminal dialog, touch-aware cursor

---

## Tech stack

| Layer | Technology |
|---|---|
| Markup / style / logic | HTML5, CSS3, vanilla JavaScript |
| 3D | Three.js `0.147` (CDN) |
| Typography | Space Grotesk, Inter, JetBrains Mono |
| Content tooling | Node.js ≥ 18 (dependency-free scripts) |
| Hosting | GitHub Pages (static) |

---

## Pages

| Page | Content |
|---|---|
| `index.html` | 3D hero, double stack ticker, about story, testimonials, contact CTA |
| `work.html` | Products built (Celigo, Barco, AgVa, Reclancers), exploded 3D microservice view, open source contributions |
| `journey.html` | Experience and certifications |
| `blog/index.html` | Essay index with search and tag filters |
| `blog/<slug>.html` | Full articles with “Read on Medium” links |
| `contact.html` | Email, socials, availability |

---

## Getting started

Requires Node.js ≥ 18 only when regenerating blog content. The site itself needs no install.

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

---

## Content

Site copy (name, roles, experience, contributions, certifications, contact) lives in **`js/content.js`**. Lines marked `// ✏️ EDIT` are placeholders for details that should stay private or stay current.

### Scripts

All tooling lives under `scripts/`. Zero npm dependencies. There are no API keys or secrets in these scripts — they read local files and write site assets only.

| Script | Role | How to run |
|---|---|---|
| `scripts/medium-common.js` | Shared helpers (slugify, tags, excerpt, comment-response filter). Not executable. | Imported by the import script |
| `scripts/import-medium-export.js` | Medium export → `content/posts/*.json` + mirrored images under `assets/blog/` | `node scripts/import-medium-export.js` |
| `scripts/build-blog.js` | Corpus → `blog/<slug>.html` + `js/blog-data.js` | `node scripts/build-blog.js` |

#### Refresh blog from a Medium export

Articles are version-controlled. There is no periodic fetch workflow.

1. Download your archive from Medium (Settings → Download your information) and unzip it under `medium-exports/`:
   ```
   medium-exports/medium-export-<hash>/posts/*.html
   ```
   The `medium-exports/` directory is gitignored. Medium exports include personal data (profile, sessions, IPs, follows) and must never be committed.
2. Import into the committed corpus (idempotent; reuses already-mirrored images):
   ```sh
   node scripts/import-medium-export.js
   ```
3. Regenerate article pages and the client index:
   ```sh
   node scripts/build-blog.js
   ```

| When | Run |
|---|---|
| New or updated Medium export | import → build |
| Hand-edited `content/posts/*.json` only | build |
| Changed article page template in `build-blog.js` | build |

| Path | Role |
|---|---|
| `content/posts/*.json` | Committed article corpus |
| `assets/blog/<slug>/` | Mirrored article images |
| `blog/*.html`, `js/blog-data.js` | Generated output (committed; do not edit `blog-data.js` by hand) |

---

## Performance & accessibility

- Both 3D scenes clamp device pixel ratio, lazy-init, pause off-screen and on hidden tabs, and fall back to CSS without WebGL
- Custom cursor is disabled on touch; full `prefers-reduced-motion` paths throughout
- Terminal uses `role="dialog"`, focus trapping, and keyboard-first interaction

---

## Project structure

```
├── index.html                  # landing: hero + ticker + about + testimonials
├── work.html                   # products + exploded 3D view + OSS contributions
├── journey.html                # experience + certifications
├── contact.html                # contact
├── blog/
│   ├── index.html              # listing (search + tag filters)
│   └── <slug>.html             # generated article pages
├── content/posts/*.json        # committed article corpus
├── assets/
│   ├── blog/<slug>/*           # mirrored article images
│   └── favicon.svg
├── css/
│   ├── style.css               # design system
│   └── terminal.css            # terminal mode
├── js/
│   ├── content.js              # site copy (edit here)
│   ├── blog-data.js            # generated article index
│   ├── main.js                 # rendering + interactions
│   ├── scene.js                # hero 3D scene
│   ├── anatomy.js              # exploded-view system anatomy
│   ├── terminal.js             # terminal mode
│   └── blog-list.js            # blog listing renderer
└── scripts/
    ├── medium-common.js        # shared import helpers (library)
    ├── import-medium-export.js # Medium export → corpus
    └── build-blog.js           # corpus → pages + data
```

---

## License

Personal portfolio. All rights reserved unless otherwise noted.
