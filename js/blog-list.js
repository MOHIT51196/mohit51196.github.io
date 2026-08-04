/* ============================================================
 *  blog-list.js — renders the Blog listing page (blog/index.html)
 *  from window.BLOG with client-side search + tag filtering.
 * ============================================================ */

(function () {
  'use strict';

  var posts = window.BLOG || [];
  var list = document.getElementById('journalList');
  var empty = document.getElementById('journalEmpty');
  var count = document.getElementById('journalCount');
  var search = document.getElementById('journalSearch');
  var tagsHost = document.getElementById('journalTags');
  if (!list || !posts.length) return;

  var TOP_TAGS = 8;
  var state = { query: '', tag: '' };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dayLabel(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ---------- header meta ---------- */

  var years = posts.map(function (p) { return p.year; });
  var minYear = Math.min.apply(null, years);
  var maxYear = Math.max.apply(null, years);
  count.textContent =
    posts.length + ' essays · ' + minYear + ' → ' + maxYear + ' · also published on Medium';

  /* ---------- tag chips ---------- */

  var tagCounts = {};
  posts.forEach(function (p) {
    p.tags.forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });
  var topTags = Object.keys(tagCounts)
    .sort(function (a, b) { return tagCounts[b] - tagCounts[a]; })
    .slice(0, TOP_TAGS);

  tagsHost.innerHTML = ['<button class="journal__chip is-active" data-tag="" data-hover>All</button>']
    .concat(topTags.map(function (t) {
      return '<button class="journal__chip" data-tag="' + esc(t) + '" data-hover>' + esc(t) + '</button>';
    }))
    .join('');

  tagsHost.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-tag]');
    if (!chip) return;
    state.tag = chip.dataset.tag;
    tagsHost.querySelectorAll('.journal__chip').forEach(function (c) {
      c.classList.toggle('is-active', c === chip);
    });
    render();
  });

  /* ---------- search ---------- */

  var debounce = null;
  search.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      state.query = search.value.trim().toLowerCase();
      render();
    }, 120);
  });

  /* ---------- rendering ---------- */

  function matches(post) {
    if (state.tag && post.tags.indexOf(state.tag) === -1) return false;
    if (!state.query) return true;
    var haystack = (post.title + ' ' + post.subtitle + ' ' + post.excerpt + ' ' + post.tags.join(' ')).toLowerCase();
    return state.query.split(/\s+/).every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function rowHtml(post) {
    return (
      '<a class="journal__row" href="' + esc(post.slug) + '.html" data-hover>' +
        '<span class="journal__date">' + esc(dayLabel(post.date)) + '</span>' +
        '<span class="journal__main">' +
          '<span class="journal__rowtitle">' + esc(post.title) + '</span>' +
          (post.subtitle ? '<span class="journal__excerpt">' + esc(post.subtitle) + '</span>' : '') +
        '</span>' +
        '<span class="journal__meta">' +
          post.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
          (post.readingMins ? '<span class="journal__mins">' + post.readingMins + ' min</span>' : '') +
        '</span>' +
      '</a>'
    );
  }

  function render() {
    var visible = posts.filter(matches);
    empty.hidden = visible.length > 0;

    var byYear = {};
    visible.forEach(function (p) {
      (byYear[p.year] = byYear[p.year] || []).push(p);
    });

    list.innerHTML = Object.keys(byYear)
      .sort(function (a, b) { return b - a; })
      .map(function (year) {
        return (
          '<section class="journal__year">' +
            '<h2 class="journal__yearlabel">' + year + '</h2>' +
            '<div class="journal__rows">' + byYear[year].map(rowHtml).join('') + '</div>' +
          '</section>'
        );
      })
      .join('');
  }

  render();
})();
