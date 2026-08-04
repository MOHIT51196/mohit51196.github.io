/* ============================================================
 *  medium-common.js — shared helpers for the Medium import
 *  pipeline (import-medium-export.js).
 *  Zero dependencies (Node >= 18).
 * ============================================================ */

'use strict';

const WORDS_PER_MINUTE = 220;
const EXCERPT_MAX_CHARS = 220;
const SLUG_MAX_CHARS = 64;
const MIN_STRUCTURED_WORDS = 120;

const TAG_RULES = [
  { pattern: /node\.?js|console\.log|event loop|express|libuv|adonis/i, tag: 'Node.js' },
  { pattern: /kubernetes|k8s|autoscaling|helm/i, tag: 'Kubernetes' },
  { pattern: /kafka|warpstream|rabbitmq|queue|stream/i, tag: 'Event Streaming' },
  { pattern: /saga|microservice|consistency|distributed|monolith|scal(e|ing)|circuit breaker|transaction/i, tag: 'Distributed Systems' },
  { pattern: /postgres|elasticsearch|database|quer(y|ies)|sql|redis|mongo/i, tag: 'Databases' },
  { pattern: /aws|nat gateway|azure|cloud|lambda|serverless/i, tag: 'Cloud' },
  { pattern: /docker|podman|container/i, tag: 'Containers' },
  { pattern: /cursor|\bai\b|mcp|agent|llm|copilot/i, tag: 'AI Tooling' },
  { pattern: /golang|\bgo\b/i, tag: 'Go' },
  { pattern: /\bjava\b|jvm/i, tag: 'Java' },
  { pattern: /rust/i, tag: 'Rust' },
  { pattern: /python/i, tag: 'Python' },
  { pattern: /c\+\+|cpp|cmake|jni/i, tag: 'C++' },
  { pattern: /grafana|graphite|monitoring|observab/i, tag: 'Observability' },
  { pattern: /engineer|career|senior|mistake|art\b|principle|product/i, tag: 'Craft' },
];

function decodeEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function textOf(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function slugify(title) {
  let slug = String(title)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > SLUG_MAX_CHARS) {
    slug = slug.slice(0, SLUG_MAX_CHARS);
    const cut = slug.lastIndexOf('-');
    if (cut > 30) slug = slug.slice(0, cut);
  }
  return slug || 'post';
}

function classifyTags(text) {
  const tags = [];
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(text) && !tags.includes(rule.tag)) tags.push(rule.tag);
    if (tags.length === 2) break;
  }
  return tags.length ? tags : ['Engineering'];
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* Real articles have structure — headings, figures or code blocks.
 * Medium comment-responses are bare paragraphs (sometimes long, and
 * Medium even gives them subtitles), so structure is the primary
 * signal, with a word floor for structured fragments. */
function isBareOrTiny(bodyHtml) {
  const hasStructure = /<h[34][\s>]|<figure|<pre/i.test(bodyHtml);
  if (!hasStructure) return true;
  return textOf(bodyHtml).split(' ').length < MIN_STRUCTURED_WORDS;
}

function readingMins(wordCount) {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

module.exports = {
  EXCERPT_MAX_CHARS,
  decodeEntities,
  textOf,
  slugify,
  classifyTags,
  truncate,
  isBareOrTiny,
  readingMins,
};
