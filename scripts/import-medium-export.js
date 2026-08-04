#!/usr/bin/env node
/* ============================================================
 *  import-medium-export.js — one-time local import
 *
 *  Reads the Medium export archive under medium-exports/medium-export-*
 *  (gitignored, local only) and produces the COMMITTED corpus:
 *
 *    content/posts/<slug>.json   normalized article records
 *    assets/blog/<slug>/*        mirrored article images
 *
 *  Zero dependencies (Node >= 18). Run:
 *      node scripts/import-medium-export.js
 *
 *  Idempotent: already-mirrored images are reused, never re-fetched.
 *  Medium comment-responses are filtered out (see medium-common.js).
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXCERPT_MAX_CHARS,
  textOf,
  slugify,
  classifyTags,
  truncate,
  isBareOrTiny,
  readingMins,
} = require('./medium-common');

const ROOT = path.join(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT, 'medium-exports');
const CORPUS_DIR = path.join(ROOT, 'content', 'posts');
const IMAGES_DIR = path.join(ROOT, 'assets', 'blog');

const IMAGE_MAX_BYTES = 2.5 * 1024 * 1024;
const IMAGE_CONCURRENCY = 2;
const IMAGE_TIMEOUT_MS = 20000;
const IMAGE_RETRY_DELAY_MS = 2500;
const IMAGE_CHUNK_GAP_MS = 400;
const IMAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
  Referer: 'https://medium.com/',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---------- parsing ---------- */

function parsePost(html, filename) {
  const titleMatch = html.match(/<h1 class="p-name">([\s\S]*?)<\/h1>/);
  const title = titleMatch ? textOf(titleMatch[1]) : '';
  if (!title) return null;

  const subMatch = html.match(/<section data-field="subtitle" class="p-summary">([\s\S]*?)<\/section>/);
  const subtitle = subMatch ? textOf(subMatch[1]) : '';

  const bodyMarker = '<section data-field="body" class="e-content">';
  const bodyStart = html.indexOf(bodyMarker);
  const footerIdx = html.lastIndexOf('<footer>');
  if (bodyStart === -1 || footerIdx === -1) return null;
  const body = html.slice(bodyStart + bodyMarker.length, footerIdx).replace(/<\/section>\s*$/, '');

  const timeMatch = html.match(/<time class="dt-published" datetime="([^"]+)"/);
  const dateISO = timeMatch ? timeMatch[1] : '';

  const canonicalMatch = html.match(/<a href="([^"]+)" class="p-canonical">/);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : '';

  let id = '';
  const idFromCanonical = canonicalUrl.match(/-([0-9a-f]{8,})\/?$/);
  const idFromFile = filename.match(/-([0-9a-f]{8,})\.html$/);
  if (idFromCanonical) id = idFromCanonical[1];
  else if (idFromFile) id = idFromFile[1];

  return { title, subtitle, body, dateISO, canonicalUrl, id };
}

/* Cut Medium-specific self-promo tails: "give a clap / follow me"
 * CTAs (p or blockquote, optionally strong/em-wrapped), membership
 * plugs, "You can also read" headings and bare starred link lists.
 * Cuts at the EARLIEST marker found in the second half of the body,
 * then trims any structural debris the cut leaves behind. */
const PROMO_MARKERS = [
  /<(?:p|blockquote)[^>]*>(?:\s*<(?:strong|em)[^>]*>)*\s*If you appreciate/i,
  /<(?:h3|h4|p)[^>]*>(?:\s*<(?:strong|em)[^>]*>)*\s*You can also read/i,
  /<(?:p|blockquote)[^>]*>(?:\s*<(?:strong|em)[^>]*>)*\s*You can also join Medium membership/i,
  /<h4[^>]*>\s*\*\s*<a /i,
];

function stripPromoTail(body) {
  let cut = -1;
  for (const marker of PROMO_MARKERS) {
    const m = body.match(marker);
    if (m && m.index > body.length * 0.5 && (cut === -1 || m.index < cut)) cut = m.index;
  }
  let out = cut === -1 ? body : body.slice(0, cut);
  out = out.replace(/(?:\s|<section[^>]*>|<div[^>]*>|<hr[^>]*>)+$/i, '');
  return out;
}

/* ---------- images ---------- */

function extForImage(url, contentType) {
  const fromUrl = url.match(/\.(png|jpe?g|gif|webp)(?:$|\?)/i);
  if (fromUrl) return '.' + fromUrl[1].toLowerCase().replace('jpeg', 'jpg');
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[(contentType || '').split(';')[0]] || '.jpg';
}

function existingImage(destBase) {
  const dir = path.dirname(destBase);
  const base = path.basename(destBase);
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(base + '.'));
  return hit ? path.join(dir, hit) : null;
}

async function downloadImage(url, destBase) {
  // Idempotent: reuse a previously mirrored file so re-runs never
  // re-hit the CDN for images we already have.
  const existing = existingImage(destBase);
  if (existing) return existing;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: IMAGE_HEADERS, signal: controller.signal });
      if (res.status === 429 && attempt === 1) {
        await sleep(IMAGE_RETRY_DELAY_MS);
        continue;
      }
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > IMAGE_MAX_BYTES || buf.byteLength === 0) return null;
      const dest = destBase + extForImage(url, res.headers.get('content-type'));
      fs.writeFileSync(dest, buf);
      return dest;
    } catch (err) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function mirrorImages(body, slug, counters) {
  const urls = [...new Set(
    [...body.matchAll(/<img[^>]+src="(https:\/\/cdn-images[^"]+)"/g)].map((m) => m[1])
  )];
  if (urls.length === 0) return { body, cover: '' };

  const dir = path.join(IMAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });

  const results = new Map();
  let index = 0;
  for (const group of chunk(urls, IMAGE_CONCURRENCY)) {
    const settled = await Promise.all(group.map((url) => {
      index += 1;
      const base = path.join(dir, 'img-' + String(index).padStart(2, '0'));
      return downloadImage(url, base).then((dest) => ({ url, dest }));
    }));
    for (const { url, dest } of settled) {
      if (dest) {
        results.set(url, 'assets/blog/' + slug + '/' + path.basename(dest));
        counters.imagesOk += 1;
      } else {
        counters.imagesKeptRemote += 1;
      }
    }
    await sleep(IMAGE_CHUNK_GAP_MS);
  }

  let out = body;
  let cover = '';
  for (const [url, rel] of results) {
    // Article pages live under blog/, hence the ../ prefix.
    out = out.split(url).join('../' + rel);
    if (!cover) cover = rel;
  }
  return { body: out, cover };
}

/* ---------- main ---------- */

async function main() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    console.error('error: medium-exports/ folder not found — the Medium export must be present locally');
    process.exitCode = 1;
    return;
  }
  const exportDir = fs.readdirSync(EXPORTS_DIR).find((d) => d.startsWith('medium-export'));
  if (!exportDir) {
    console.error('error: no medium-export-* folder inside medium-exports/');
    process.exitCode = 1;
    return;
  }
  const postsDir = path.join(EXPORTS_DIR, exportDir, 'posts');
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.html') && !f.startsWith('draft_'));

  fs.mkdirSync(CORPUS_DIR, { recursive: true });

  const counters = { kept: 0, skippedResponses: 0, skippedUnparsable: 0, imagesOk: 0, imagesKeptRemote: 0 };
  const usedSlugs = new Set();
  const records = [];

  for (const file of files) {
    const html = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const post = parsePost(html, file);
    if (!post || !post.dateISO) {
      counters.skippedUnparsable += 1;
      continue;
    }
    if (isBareOrTiny(post.body)) {
      counters.skippedResponses += 1;
      continue;
    }

    let slug = slugify(post.title);
    if (usedSlugs.has(slug)) slug = slug + '-' + (post.id ? post.id.slice(0, 6) : String(records.length));
    usedSlugs.add(slug);

    let body = stripPromoTail(post.body);
    const mirrored = await mirrorImages(body, slug, counters);
    body = mirrored.body;

    const plain = textOf(body);
    const wordCount = plain.split(' ').length;

    records.push({
      id: post.id || slug,
      slug,
      title: post.title,
      subtitle: post.subtitle,
      date: post.dateISO,
      tags: classifyTags(post.title + ' ' + post.subtitle),
      canonicalUrl: post.canonicalUrl,
      readingMins: readingMins(wordCount),
      wordCount,
      excerpt: truncate(post.subtitle || plain, EXCERPT_MAX_CHARS),
      cover: mirrored.cover,
      bodyHtml: body.trim(),
    });
    counters.kept += 1;
    console.log(`info: imported "${post.title}"`);
  }

  // Drop stale corpus files for the same Medium post under a
  // different slug (e.g. after a title edit on Medium changed the
  // slug between two imports).
  const importedIds = new Map(records.map((r) => [r.id, r.slug]));
  for (const file of fs.readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.json'))) {
    const existing = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8'));
    if (importedIds.has(existing.id) && file !== importedIds.get(existing.id) + '.json') {
      fs.unlinkSync(path.join(CORPUS_DIR, file));
      console.log(`info: removed superseded record ${file}`);
    }
  }

  for (const record of records) {
    fs.writeFileSync(
      path.join(CORPUS_DIR, record.slug + '.json'),
      JSON.stringify(record, null, 2) + '\n'
    );
  }

  console.log(
    `info: done — kept=${counters.kept}, responsesSkipped=${counters.skippedResponses}, ` +
    `unparsable=${counters.skippedUnparsable}, imagesMirrored=${counters.imagesOk}, ` +
    `imagesKeptRemote=${counters.imagesKeptRemote}`
  );
}

main().catch((err) => {
  console.error(`error: unexpected failure: ${err.message}`);
  process.exitCode = 1;
});
