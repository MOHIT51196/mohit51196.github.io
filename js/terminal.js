/* ============================================================
 *  terminal.js — full-screen interactive terminal
 *
 *  A real product, not a gimmick: command registry, Tab
 *  autocomplete with contextual arguments, fish-style ghost
 *  suggestions, per-session history, a pager for reading
 *  articles inside the terminal, and a help system.
 *
 *  100% static — all data comes from window.CONTENT and
 *  window.BLOG. Works on every page (home, blog, articles).
 *
 *  Open:  nav >_ button, or the ` (backtick) key
 *  Close: exit command, or Esc
 * ============================================================ */

(function () {
  'use strict';

  var C = window.CONTENT;
  if (!C) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Article/blog pages live one level down; adjust generated links.
  var ROOT = /\/blog\//.test(window.location.pathname) ? '../' : '';
  var IS_FILE = window.location.protocol === 'file:';

  var PROMPT = 'mohit@portfolio:~$';
  var HISTORY_KEY = 'term.history';
  var HISTORY_MAX = 100;
  var PAGER_BLOCK_SIZE = 12;

  function posts() { return window.BLOG || []; }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad(str, len) {
    str = String(str);
    return str.length >= len ? str : str + new Array(len - str.length + 1).join(' ');
  }

  /* ============================================================
   * DOM scaffold (injected so every page gets it for free)
   * ============================================================ */

  var overlay = document.createElement('div');
  overlay.className = 'term';
  overlay.id = 'terminal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Interactive terminal');
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="term__chrome">' +
      '<span class="term__dots"><i></i><i></i><i></i></span>' +
      '<span class="term__title">mohit@portfolio · zsh</span>' +
      '<button class="term__close" id="termClose" aria-label="Close terminal">esc ✕</button>' +
    '</div>' +
    '<div class="term__screen" id="termScreen"></div>' +
    '<div class="term__inputbar">' +
      '<span class="term__prompt">' + esc(PROMPT) + '</span>' +
      '<span class="term__field">' +
        '<span class="term__mirror" id="termMirror" aria-hidden="true"></span>' +
        '<input class="term__input" id="termInput" type="text" autocomplete="off" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Terminal input" />' +
        '<span class="term__ghost" id="termGhost" aria-hidden="true"></span>' +
        '<span class="term__caret" id="termCaret" aria-hidden="true"></span>' +
      '</span>' +
    '</div>' +
    '<div class="term__hints">' +
      '<span><b>Tab</b> autocomplete</span>' +
      '<span><b>→</b> accept suggestion</span>' +
      '<span><b>↑↓</b> history</span>' +
      '<span><b>help</b> all commands</span>' +
      '<span><b>Esc</b> exit</span>' +
    '</div>';
  document.body.appendChild(overlay);

  var screen = document.getElementById('termScreen');
  var input = document.getElementById('termInput');
  var mirror = document.getElementById('termMirror');
  var ghost = document.getElementById('termGhost');
  var caret = document.getElementById('termCaret');

  /* ============================================================
   * Output helpers
   * ============================================================ */

  function row(html) {
    var div = document.createElement('div');
    div.className = 'term__row';
    div.innerHTML = html;
    screen.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
    return div;
  }

  function print(text, cls) {
    String(text).split('\n').forEach(function (lineText) {
      row('<span class="' + (cls || '') + '">' + esc(lineText) + '</span>');
    });
  }

  function printHTML(html) { row(html); }

  function blank() { row('&nbsp;'); }

  function echoCommand(raw) {
    row(
      '<span class="t-accent">' + esc(PROMPT) + '</span> ' +
      '<span>' + esc(raw) + '</span>'
    );
  }

  function link(href, label, external) {
    return (
      '<a class="t-link" href="' + esc(href) + '"' +
      (external ? ' target="_blank" rel="noopener"' : '') +
      '>' + esc(label) + '</a>'
    );
  }

  /* ============================================================
   * Pager (used by `read`)
   * ============================================================ */

  var pager = null; // { blocks: [], pos: 0, title }

  function pagerShow() {
    var end = Math.min(pager.pos + PAGER_BLOCK_SIZE, pager.blocks.length);
    for (var i = pager.pos; i < end; i++) printHTML(pager.blocks[i]);
    pager.pos = end;
    if (pager.pos >= pager.blocks.length) {
      blank();
      print('── end of "' + pager.title + '" ──', 't-dim');
      pagerClose(true);
    } else {
      var pct = Math.round((pager.pos / pager.blocks.length) * 100);
      pager.status = row(
        '<span class="t-more">-- More (' + pct + '%) · Enter next · q quit --</span>'
      );
    }
  }

  function pagerNext() {
    if (pager && pager.status) pager.status.remove();
    pagerShow();
  }

  function pagerClose(finished) {
    if (pager && pager.status) pager.status.remove();
    if (!finished) print('(pager closed)', 't-dim');
    pager = null;
    updateGhostAndCaret();
  }

  /* ============================================================
   * Command registry
   * ============================================================ */

  var REGISTRY = {};
  var ALIASES = {
    whoami: 'about',
    ls: 'blogs',
    experience: 'xp',
    projects: 'oss',
    recommendations: 'recs',
    social: 'socials',
    quit: 'exit',
    neofetch: 'banner',
  };

  function cmd(name, def) { REGISTRY[name] = def; }

  function resolve(name) {
    if (REGISTRY[name]) return REGISTRY[name];
    if (ALIASES[name]) return REGISTRY[ALIASES[name]];
    return null;
  }

  function findPost(token) {
    if (!token) return null;
    var all = posts();
    var byIndex = parseInt(token, 10);
    if (!isNaN(byIndex) && byIndex >= 1 && byIndex <= all.length) return all[byIndex - 1];
    var lower = token.toLowerCase();
    return all.find(function (p) { return p.slug === lower; }) ||
           all.find(function (p) { return p.slug.indexOf(lower) === 0; }) || null;
  }

  function postCompletions(prefix) {
    var lower = (prefix || '').toLowerCase();
    return posts()
      .map(function (p) { return p.slug; })
      .filter(function (slug) { return slug.indexOf(lower) === 0; });
  }

  /* ---------- content commands ---------- */

  cmd('about', {
    desc: 'Who is Mohit Malhotra',
    usage: 'about',
    run: function () {
      print(C.profile.firstName + ' ' + C.profile.lastName + ' · ' + C.profile.role, 't-head');
      print(C.profile.focus + ' · ' + C.profile.location + ' · @ ' + C.profile.company, 't-dim');
      blank();
      C.profile.about.forEach(function (p) { print(p); blank(); });
    },
  });

  cmd('xp', {
    desc: 'Experience: a decade of building',
    usage: 'xp',
    run: function () {
      C.experience.forEach(function (job) {
        print(job.period + '  ·  ' + job.location, 't-dim');
        print(job.role + ' @ ' + job.company, 't-head');
        print(job.summary);
        print('[' + job.tags.join(' · ') + ']', 't-accent');
        blank();
      });
      print('Beyond the day job:', 't-head');
      C.beyond.forEach(function (b) {
        print('  ' + pad(b.big, 7) + b.title + ': ' + b.sub, 't-dim');
      });
    },
  });

  cmd('stack', {
    desc: 'Tools of the trade',
    usage: 'stack',
    run: function () {
      C.skills.forEach(function (group) {
        print(group.group, 't-accent');
        print('  ' + group.items.join('  ·  '));
        blank();
      });
    },
  });

  cmd('oss', {
    desc: 'Open-source projects',
    usage: 'oss',
    run: function () {
      C.openSource.forEach(function (repo, i) {
        printHTML(
          '<span class="t-dim">' + pad('0' + (i + 1), 4) + '</span>' +
          '<span class="t-head">' + esc(pad(repo.name, 26)) + '</span>' +
          '<span class="t-dim">' + esc(repo.lang) + '</span>'
        );
        print('    ' + repo.description);
        printHTML('    ' + link(repo.url, repo.url, true));
        blank();
      });
    },
  });

  cmd('blogs', {
    desc: 'List all articles (native to this site)',
    usage: 'blogs [--tag <topic>]',
    complete: function (prefix, tokens) {
      if (tokens[tokens.length - 2] === '--tag') {
        var tags = {};
        posts().forEach(function (p) { p.tags.forEach(function (t) { tags[t] = 1; }); });
        return Object.keys(tags).filter(function (t) {
          return t.toLowerCase().indexOf((prefix || '').toLowerCase()) === 0;
        });
      }
      return ['--tag'].filter(function (o) { return o.indexOf(prefix || '') === 0; });
    },
    run: function (args) {
      var all = posts();
      var tagIdx = args.indexOf('--tag');
      var filter = tagIdx !== -1 ? (args[tagIdx + 1] || '').toLowerCase() : '';
      var shown = 0;
      all.forEach(function (p, i) {
        if (filter && !p.tags.some(function (t) { return t.toLowerCase() === filter; })) return;
        shown += 1;
        printHTML(
          '<span class="t-dim">' + pad(('0' + (i + 1)).slice(-2), 4) + '</span>' +
          '<span class="t-dim">' + esc(pad(p.dateLabel, 10)) + '</span> ' +
          '<span class="t-head">' + esc(p.title) + '</span> ' +
          '<span class="t-dim">(' + (p.readingMins ? p.readingMins + ' min · ' : '') + esc(p.tags.join(', ')) + ')</span>'
        );
      });
      if (!shown) {
        print('no articles match that tag', 't-dim');
        return;
      }
      blank();
      print('read <n> to read here · open <n> for the full page', 't-dim');
    },
  });

  cmd('read', {
    desc: 'Read an article inside the terminal (pager)',
    usage: 'read <number|slug>',
    complete: postCompletions,
    run: function (args) {
      var post = findPost(args[0]);
      if (!post) {
        print('read: article not found. Try `blogs` first', 't-err');
        return;
      }
      print('Loading "' + post.title + '"…', 't-dim');
      var fallback = function () {
        blank();
        print(post.title, 't-head');
        print(post.dateLabel + ' · ' + post.readingMins + ' min', 't-dim');
        blank();
        print(post.excerpt);
        blank();
        printHTML(link(ROOT + post.url, '→ open the full article page', false));
      };
      if (IS_FILE) {
        fallback();
        return;
      }
      fetch(ROOT + post.url)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var prose = doc.querySelector('.prose');
          if (!prose) throw new Error('no content');
          var blocks = [];
          blocks.push('<span class="t-head">' + esc(post.title) + '</span>');
          if (post.subtitle) blocks.push('<span class="t-dim">' + esc(post.subtitle) + '</span>');
          blocks.push('<span class="t-dim">' + esc(post.dateLabel + ' · ' + post.readingMins + ' min read') + '</span>');
          blocks.push('&nbsp;');
          prose.querySelectorAll('p, h3, h4, li, blockquote, figcaption, pre').forEach(function (node) {
            // The export repeats title/subtitle as leading grafs — the
            // page hides them with CSS; skip them here too.
            if (/graf--title|graf--subtitle/.test(node.className)) return;
            var text = node.textContent.replace(/\s+/g, ' ').trim();
            if (!text) return;
            var tag = node.tagName.toLowerCase();
            if (tag === 'h3' || tag === 'h4') {
              blocks.push('&nbsp;');
              blocks.push('<span class="t-accent">## ' + esc(text) + '</span>');
            } else if (tag === 'blockquote') {
              blocks.push('<span class="t-quote">│ ' + esc(text) + '</span>');
            } else if (tag === 'figcaption') {
              blocks.push('<span class="t-dim">[img] ' + esc(text) + '</span>');
            } else if (tag === 'li') {
              blocks.push('<span>· ' + esc(text) + '</span>');
            } else if (tag === 'pre') {
              blocks.push('<span class="t-code">' + esc(text) + '</span>');
            } else {
              blocks.push('<span>' + esc(text) + '</span>');
              blocks.push('&nbsp;');
            }
          });
          blocks.push('&nbsp;');
          blocks.push(link(post.mediumUrl, '↗ also on Medium', true));
          pager = { blocks: blocks, pos: 0, title: post.title, status: null };
          blank();
          pagerShow();
        })
        .catch(fallback);
    },
  });

  cmd('open', {
    desc: 'Open an article page (leaves the terminal)',
    usage: 'open <number|slug>',
    complete: postCompletions,
    run: function (args) {
      var post = findPost(args[0]);
      if (!post) {
        print('open: article not found. Try `blogs` first', 't-err');
        return;
      }
      print('opening ' + post.slug + '…', 't-dim');
      window.location.href = ROOT + post.url;
    },
  });

  cmd('certs', {
    desc: 'Certifications',
    usage: 'certs',
    run: function () {
      C.certifications.forEach(function (c, i) {
        printHTML(
          '<span class="t-dim">' + pad(('0' + (i + 1)).slice(-2), 4) + '</span>' +
          '<span>' + esc(pad(c.name, 52)) + '</span>' +
          '<span class="t-dim">' + esc(c.issuer + (c.year ? ' · ' + c.year : '')) + '</span>'
        );
      });
    },
  });

  cmd('recs', {
    desc: 'Testimonials from colleagues',
    usage: 'recs',
    run: function () {
      C.recommendations.forEach(function (r) {
        print('“' + r.quote + '”', 't-quote');
        print('  ' + r.author + ' · ' + r.title + ', ' + r.company, 't-accent');
        blank();
      });
    },
  });

  cmd('contact', {
    desc: 'How to reach Mohit',
    usage: 'contact',
    run: function () {
      print(C.contact.heading + ' ' + C.contact.sub);
      blank();
      printHTML('email    ' + link('mailto:' + C.profile.email, C.profile.email, false));
      Object.keys(C.profile.socials).forEach(function (key) {
        var url = C.profile.socials[key];
        if (url) printHTML(pad(key, 9) + link(url, url, true));
      });
    },
  });

  cmd('socials', {
    desc: 'Profiles across the web',
    usage: 'socials',
    run: function () {
      Object.keys(C.profile.socials).forEach(function (key) {
        var url = C.profile.socials[key];
        if (url) printHTML(pad(key, 10) + link(url, url, true));
      });
    },
  });

  cmd('banner', {
    desc: 'The neofetch-style profile card',
    usage: 'banner',
    run: function () {
      var art = [
        '███╗   ███╗ ███╗   ███╗',
        '████╗ ████║ ████╗ ████║',
        '██╔████╔██║ ██╔████╔██║',
        '██║╚██╔╝██║ ██║╚██╔╝██║',
        '██║ ╚═╝ ██║ ██║ ╚═╝ ██║',
        '╚═╝     ╚═╝ ╚═╝     ╚═╝',
      ];
      var years = new Date().getFullYear() - 2015;
      var info = [
        ['user', 'mohit@portfolio'],
        ['role', C.profile.role + ' @ ' + C.profile.company],
        ['focus', C.profile.focus],
        ['uptime', years + ' years in production'],
        ['articles', posts().length + ' published essays'],
        ['stack', C.stackTicker.slice(0, 6).join(', ')],
        ['contact', C.profile.email],
      ];
      art.forEach(function (lineText, i) {
        var meta = info[i]
          ? '   <span class="t-dim">' + esc(pad(info[i][0], 9)) + '</span>' + esc(info[i][1])
          : '';
        printHTML('<span class="t-accent t-art">' + esc(lineText) + '</span>' + meta);
      });
      if (info.length > art.length) {
        info.slice(art.length).forEach(function (pair) {
          printHTML(esc(pad('', 24)) + '<span class="t-dim">' + esc(pad(pair[0], 9)) + '</span>' + esc(pair[1]));
        });
      }
    },
  });

  /* ---------- shell utilities ---------- */

  cmd('help', {
    desc: 'List all commands',
    usage: 'help [command]',
    complete: function (prefix) {
      return Object.keys(REGISTRY).filter(function (n) { return n.indexOf(prefix || '') === 0; });
    },
    run: function (args) {
      if (args[0]) {
        var target = resolve(args[0]);
        if (!target) { print('help: no such command: ' + args[0], 't-err'); return; }
        print(target.usage, 't-head');
        print(target.desc);
        return;
      }
      print('Available commands', 't-head');
      blank();
      var names = Object.keys(REGISTRY).filter(function (n) { return !REGISTRY[n].hidden; }).sort();
      names.forEach(function (name) {
        printHTML(
          '<span class="t-accent">' + esc(pad(name, 12)) + '</span>' +
          '<span>' + esc(REGISTRY[name].desc) + '</span>'
        );
      });
      blank();
      print('aliases: ' + Object.keys(ALIASES).map(function (a) {
        return a + '→' + ALIASES[a];
      }).join('  '), 't-dim');
      blank();
      print('Tab completes commands and arguments · try: blogs, read 1, banner', 't-dim');
    },
  });

  cmd('man', {
    desc: 'Manual page for a command',
    usage: 'man <command>',
    complete: function (prefix) {
      return Object.keys(REGISTRY).filter(function (n) { return n.indexOf(prefix || '') === 0; });
    },
    run: function (args) {
      var target = resolve(args[0] || '');
      if (!target) { print('man: no manual entry for ' + (args[0] || '(none)'), 't-err'); return; }
      print('NAME', 't-dim');
      print('  ' + (args[0]) + ': ' + target.desc);
      print('SYNOPSIS', 't-dim');
      print('  ' + target.usage);
    },
  });

  cmd('cat', {
    desc: 'Read a "file"',
    usage: 'cat <file>',
    complete: function (prefix) {
      return ['about.txt', 'stack.txt', 'contact.txt', 'resume.txt'].filter(function (f) {
        return f.indexOf(prefix || '') === 0;
      });
    },
    run: function (args) {
      var map = { 'about.txt': 'about', 'stack.txt': 'stack', 'contact.txt': 'contact' };
      var file = args[0] || '';
      if (map[file]) { REGISTRY[map[file]].run([]); return; }
      if (file === 'resume.txt') {
        if (C.profile.resumeUrl) printHTML(link(C.profile.resumeUrl, C.profile.resumeUrl, true));
        else print('resume.txt: ask nicely at ' + C.profile.email, 't-dim');
        return;
      }
      print('cat: ' + (file || '(none)') + ': No such file or directory', 't-err');
    },
  });

  cmd('history', {
    desc: 'Command history for this session',
    usage: 'history',
    run: function () {
      history_.forEach(function (entry, i) {
        print(pad(String(i + 1), 5) + entry, 't-dim');
      });
    },
  });

  cmd('echo', {
    desc: 'Print text',
    usage: 'echo <text>',
    run: function (args) { print(args.join(' ')); },
  });

  cmd('date', {
    desc: 'Current date and time',
    usage: 'date',
    run: function () { print(new Date().toString()); },
  });

  cmd('pwd', {
    desc: 'Print working directory',
    usage: 'pwd',
    run: function () { print('/home/mohit/portfolio'); },
  });

  cmd('clear', {
    desc: 'Clear the screen',
    usage: 'clear',
    run: function () { screen.innerHTML = ''; },
  });

  cmd('exit', {
    desc: 'Close the terminal',
    usage: 'exit',
    run: function () { close(); },
  });

  /* ---------- easter eggs (hidden from help) ---------- */

  cmd('sudo', {
    hidden: true,
    desc: 'With great power…',
    usage: 'sudo <anything>',
    run: function (args) {
      if (args.join(' ') === 'hire-me') {
        print('Permission granted.', 't-ok');
        blank();
        print('Excellent judgement. Generating offer letter…', 't-dim');
        printHTML(
          '→ ' + link(
            'mailto:' + C.profile.email + '?subject=Let%27s%20talk',
            'send the first email. I reply fast',
            false
          )
        );
        return;
      }
      print('mohit is not in the sudoers file. This incident will be reported (to no one).', 't-err');
      print('hint: try `sudo hire-me`', 't-dim');
    },
  });

  cmd('vim', {
    hidden: true,
    desc: 'You know what happens',
    usage: 'vim',
    run: function () {
      print('Entering vim…', 't-dim');
      print('Just kidding. Nobody escapes vim, and this is a portfolio.', 't-ok');
      print('Try `blogs` instead. The reading is better.', 't-dim');
    },
  });

  /* ============================================================
   * History
   * ============================================================ */

  var history_ = [];
  try {
    history_ = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
  } catch (err) { history_ = []; }
  var historyIdx = history_.length;
  var draft = '';

  function pushHistory(raw) {
    if (raw && history_[history_.length - 1] !== raw) {
      history_.push(raw);
      if (history_.length > HISTORY_MAX) history_.shift();
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history_)); } catch (err) { /* private mode */ }
    }
    historyIdx = history_.length;
  }

  /* ============================================================
   * Execution
   * ============================================================ */

  function exec(raw) {
    var trimmed = raw.trim();
    echoCommand(raw);
    if (!trimmed) return;
    pushHistory(trimmed);

    var tokens = trimmed.split(/\s+/);
    var name = tokens[0].toLowerCase();
    var command = resolve(name);
    if (!command) {
      print(name + ': command not found. Try `help`', 't-err');
      return;
    }
    command.run(tokens.slice(1));
  }

  /* ============================================================
   * Autocomplete + ghost suggestion
   * ============================================================ */

  function candidatesFor(value) {
    if (!value) return [];
    var tokens = value.split(/\s+/);
    if (tokens.length === 1) {
      var names = Object.keys(REGISTRY).concat(Object.keys(ALIASES));
      return names.filter(function (n) { return n.indexOf(tokens[0].toLowerCase()) === 0; }).sort();
    }
    var command = resolve(tokens[0].toLowerCase());
    if (command && command.complete) {
      return command.complete(tokens[tokens.length - 1], tokens) || [];
    }
    return [];
  }

  function ghostSuggestion(value) {
    if (!value) return '';
    // History first (fish-style), then completion candidates.
    for (var i = history_.length - 1; i >= 0; i--) {
      if (history_[i].indexOf(value) === 0 && history_[i] !== value) {
        return history_[i].slice(value.length);
      }
    }
    var candidates = candidatesFor(value);
    if (candidates.length) {
      var lastToken = value.split(/\s+/).pop();
      if (candidates[0].length > lastToken.length) {
        return candidates[0].slice(lastToken.length);
      }
    }
    return '';
  }

  function commonPrefix(list) {
    if (!list.length) return '';
    var prefix = list[0];
    for (var i = 1; i < list.length; i++) {
      while (list[i].indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
    }
    return prefix;
  }

  function completeTab() {
    var value = input.value;
    var candidates = candidatesFor(value);
    if (!candidates.length) return;

    var tokens = value.split(/\s+/);
    var lastToken = tokens.pop();
    var head = tokens.length ? tokens.join(' ') + ' ' : '';

    if (candidates.length === 1) {
      input.value = head + candidates[0] + (tokens.length === 0 ? ' ' : ' ');
    } else {
      var prefix = commonPrefix(candidates);
      if (prefix.length > lastToken.length) {
        input.value = head + prefix;
      } else {
        printHTML('<span class="t-dim">' + esc(candidates.join('   ')) + '</span>');
      }
    }
    setCaretToEnd();
    updateGhostAndCaret();
  }

  /* ============================================================
   * Ghost + custom block caret rendering
   * ============================================================ */

  function measure(text) {
    mirror.textContent = text;
    return mirror.offsetWidth;
  }

  function setCaretToEnd() {
    input.selectionStart = input.selectionEnd = input.value.length;
  }

  function updateGhostAndCaret() {
    var value = input.value;
    var suggestion = pager ? '' : ghostSuggestion(value);
    ghost.textContent = suggestion;
    ghost.style.left = measure(value) + 'px';

    var caretPos = input.selectionStart == null ? value.length : input.selectionStart;
    caret.style.left = measure(value.slice(0, caretPos)) + 'px';
  }

  /* ============================================================
   * Open / close
   * ============================================================ */

  var isOpen = false;
  var lastFocus = null;
  var welcomed = false;

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    // Force a layout so the open transition can play.
    void overlay.offsetHeight;
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    if (!welcomed) {
      welcomed = true;
      REGISTRY.banner.run([]);
      blank();
      print('Welcome to the interactive résumé. Type `help` to explore.', 't-dim');
      blank();
    }
    input.focus();
    updateGhostAndCaret();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (pager) pagerClose(true);
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    var after = function () { overlay.hidden = true; };
    if (REDUCED) after();
    else setTimeout(after, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ============================================================
   * Events
   * ============================================================ */

  document.querySelectorAll('#terminalOpen').forEach(function (btn) {
    btn.addEventListener('click', open);
  });

  document.getElementById('termClose').addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (!isOpen) {
      // Backtick opens the terminal (unless typing somewhere).
      var target = e.target;
      var typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '`' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        open();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    // Pager intercepts everything except Escape.
    if (pager) {
      e.preventDefault();
      if (e.key === 'Enter' || e.key === ' ') pagerNext();
      else if (e.key.toLowerCase() === 'q') pagerClose(false);
      return;
    }

    if (e.target !== input) input.focus();

    if (e.key === 'Tab') {
      e.preventDefault();
      completeTab();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var raw = input.value;
      input.value = '';
      exec(raw);
      historyIdx = history_.length;
      draft = '';
      updateGhostAndCaret();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx === history_.length) draft = input.value;
      if (historyIdx > 0) {
        historyIdx -= 1;
        input.value = history_[historyIdx];
        setCaretToEnd();
        updateGhostAndCaret();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < history_.length) {
        historyIdx += 1;
        input.value = historyIdx === history_.length ? draft : history_[historyIdx];
        setCaretToEnd();
        updateGhostAndCaret();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'End') {
      // Accept ghost when the caret is at the end.
      if (input.selectionStart === input.value.length && ghost.textContent) {
        e.preventDefault();
        input.value += ghost.textContent;
        setCaretToEnd();
        updateGhostAndCaret();
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      screen.innerHTML = '';
    } else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) {
      e.preventDefault();
      echoCommand(input.value + '^C');
      input.value = '';
      updateGhostAndCaret();
    }
  });

  ['input', 'click', 'keyup', 'select', 'focus'].forEach(function (evt) {
    input.addEventListener(evt, updateGhostAndCaret);
  });

  // Clicking dead space refocuses the input (unless selecting text).
  overlay.addEventListener('mouseup', function () {
    if (!window.getSelection().toString()) input.focus();
  });
})();
