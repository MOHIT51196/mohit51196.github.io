#!/usr/bin/env node
/* ============================================================
 *  build-blog.js — render the committed corpus into the site
 *
 *  content/posts/*.json  →  blog/<slug>.html  (article pages)
 *                        →  js/blog-data.js   (window.BLOG index)
 *
 *  Zero dependencies (Node >= 18). Deterministic: same corpus in,
 *  same bytes out. Run after import-medium-export.js:
 *      node scripts/build-blog.js
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_DIR = path.join(ROOT, 'content', 'posts');
const BLOG_DIR = path.join(ROOT, 'blog');
const DATA_FILE = path.join(ROOT, 'js', 'blog-data.js');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function monthYear(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function lazyImages(html) {
  return html.replace(/<img (?!(?:[^>]*loading=))/g, '<img loading="lazy" decoding="async" ');
}

/* Medium export bodies carry layout debris that creates stray gaps:
 * empty paragraphs (often just a <br>), the title/subtitle repeated
 * as leading headings, and a divider before the very first section. */
function cleanBody(html) {
  let out = html;
  out = out.replace(/<h3[^>]*graf--title[^>]*>[\s\S]*?<\/h3>/gi, '');
  out = out.replace(/<h4[^>]*graf--subtitle[^>]*>[\s\S]*?<\/h4>/gi, '');
  out = out.replace(/<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
  // Drop the divider that Medium places before the first section.
  out = out.replace(/^(\s*<section[^>]*section--first[^>]*>\s*)<div class="section-divider"><hr class="section-divider"><\/div>/i, '$1');
  // Soften Medium em-dash typography in rendered HTML only (corpus unchanged).
  out = out.replace(/\u200A*\u2014\u200A*/g, ', ');
  return out;
}

function navHtml() {
  return `  <header class="nav" id="nav">
    <a href="../index.html" class="nav__logo" data-magnetic data-hover>MM<span>.</span></a>
    <nav class="nav__links" aria-label="Primary">
      <a href="../index.html" data-hover>About</a>
      <a href="../journey.html" data-hover>Journey</a>
      <a href="../work.html" data-hover>Work</a>
      <a href="index.html" class="is-active" data-hover>Blog</a>
      <a href="../contact.html" data-hover>Contact</a>
    </nav>
    <div class="nav__side">
      <button class="nav__term" id="terminalOpen" aria-label="Open terminal" data-hover>&gt;_</button>
      <a href="../contact.html" class="nav__cta" data-magnetic data-hover>Say hello</a>
    </div>
    <button class="nav__burger" id="navBurger" aria-label="Open menu" aria-expanded="false" data-hover>
      <span></span><span></span>
    </button>
  </header>

  <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
    <nav aria-label="Mobile">
      <a href="../index.html">About</a>
      <a href="../journey.html">Journey</a>
      <a href="../work.html">Work</a>
      <a href="index.html">Blog</a>
      <a href="../contact.html">Contact</a>
    </nav>
  </div>`;
}

function footerHtml() {
  return `  <footer class="footer">
    <span class="footer__spacer" aria-hidden="true"></span>
    <span class="footer__center">
      <span>Designed &amp; built by hand.</span>
      <span id="footerYear"></span>
    </span>
    <nav class="footer__socials" id="footerSocials" aria-label="Social links"></nav>
  </footer>`;
}

function pageShellOpen(meta) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(meta.title)} · Mohit Malhotra</title>
  <meta name="description" content="${esc(meta.description)}" />
  <meta name="author" content="Mohit Malhotra" />
  <meta name="theme-color" content="#f7f5f0" />
${meta.canonical ? `  <link rel="canonical" href="${esc(meta.canonical)}" />\n` : ''}  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(meta.title)}" />
  <meta property="og:description" content="${esc(meta.description)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="stylesheet" href="../css/terminal.css" />
</head>
<body>

  <div class="cursor-dot" id="cursorDot" aria-hidden="true"></div>
  <div class="cursor-ring" id="cursorRing" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

${navHtml()}
`;
}

function pageShellClose() {
  return `
${footerHtml()}

  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script defer src="../js/content.js"></script>
  <script defer src="../js/blog-data.js"></script>
  <script defer src="../js/main.js"></script>
  <script defer src="../js/terminal.js"></script>
</body>
</html>
`;
}

function neighborCard(post, direction) {
  if (!post) return `<span class="article__neighbor article__neighbor--empty"></span>`;
  const arrow = direction === 'prev' ? '←' : '→';
  const label = direction === 'prev' ? 'Newer' : 'Older';
  return `<a class="article__neighbor article__neighbor--${direction}" href="${esc(post.slug)}.html" data-hover>
        <span class="article__neighbor-label">${direction === 'prev' ? arrow + ' ' + label : label + ' ' + arrow}</span>
        <span class="article__neighbor-title">${esc(post.title)}</span>
      </a>`;
}

function articleBody(post) {
  return `    <article class="prose">
${lazyImages(cleanBody(post.bodyHtml))}
    </article>`;
}

function articlePage(post, newer, older) {
  const tags = post.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  const subtitle = post.subtitle
    ? `\n      <p class="article__subtitle">${esc(post.subtitle)}</p>`
    : '';
  const mins = post.readingMins
    ? `\n        <span aria-hidden="true">·</span>\n        <span>${post.readingMins} min read</span>`
    : '';
  const mediumLink = post.canonicalUrl
    ? `\n        <a class="btn btn--ghost" href="${esc(post.canonicalUrl)}" target="_blank" rel="noopener" data-magnetic data-hover>Read on Medium ↗</a>`
    : '';

  return (
    pageShellOpen({
      title: post.title,
      description: post.excerpt,
      canonical: post.canonicalUrl,
    }) +
    `
  <main class="article">
    <header class="article__hero">
      <a class="article__back" href="index.html" data-hover>← All articles</a>
      <div class="tag-row article__tags">${tags}</div>
      <h1 class="article__title">${esc(post.title)}</h1>${subtitle}
      <div class="article__meta">
        <span>${esc(dateLabel(post.date))}</span>${mins}
      </div>
    </header>

${articleBody(post)}

    <footer class="article__footer">
      <a class="article__back" href="index.html" data-hover>← Back to all articles</a>
      <div class="article__actions">${mediumLink}
        <a class="btn btn--solid" href="../contact.html" data-magnetic data-hover>Work with me</a>
      </div>
      <nav class="article__nav" aria-label="More articles">
      ${neighborCard(newer, 'prev')}
      ${neighborCard(older, 'next')}
      </nav>
    </footer>
  </main>
` +
    pageShellClose()
  );
}

function main() {
  if (!fs.existsSync(CORPUS_DIR)) {
    console.error('error: content/posts/ not found. Run import-medium-export.js first');
    process.exitCode = 1;
    return;
  }

  const posts = fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8')))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.mkdirSync(BLOG_DIR, { recursive: true });

  // Remove stale generated article pages (keep the listing page).
  for (const file of fs.readdirSync(BLOG_DIR)) {
    if (file.endsWith('.html') && file !== 'index.html') {
      fs.unlinkSync(path.join(BLOG_DIR, file));
    }
  }

  posts.forEach((post, i) => {
    const newer = i > 0 ? posts[i - 1] : null;
    const older = i < posts.length - 1 ? posts[i + 1] : null;
    fs.writeFileSync(path.join(BLOG_DIR, post.slug + '.html'), articlePage(post, newer, older));
  });

  const index = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    date: p.date,
    dateLabel: monthYear(p.date),
    year: new Date(p.date).getFullYear(),
    tags: p.tags,
    readingMins: p.readingMins,
    excerpt: p.excerpt,
    mediumUrl: p.canonicalUrl,
    url: 'blog/' + p.slug + '.html',
  }));

  const banner =
    '/* ============================================================\n' +
    ' * AUTO-GENERATED FILE. Do not edit by hand.\n' +
    ' * Written by scripts/build-blog.js from content/posts/*.json.\n' +
    ' * ============================================================ */\n';
  fs.writeFileSync(DATA_FILE, banner + 'window.BLOG = ' + JSON.stringify(index, null, 2) + ';\n');

  console.log(`info: built ${posts.length} article pages + js/blog-data.js`);
}

main();
