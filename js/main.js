/* ============================================================
 *  main.js — content rendering + interactions
 *  Runs on every page (home, blog listing, article pages).
 *  Home-only sections are guarded; shared chrome (nav, cursor,
 *  footer, reveals) works everywhere. Animations degrade
 *  gracefully when a CDN is unreachable or the user prefers
 *  reduced motion.
 * ============================================================ */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var C = window.CONTENT;
  if (!C) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  if (hasST) window.gsap.registerPlugin(window.ScrollTrigger);

  function el(id) { return document.getElementById(id); }

  // Escape any value rendered via innerHTML that can originate
  // outside this repo (e.g. articles synced from Medium).
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============================================================
   * 1. RENDER CONTENT
   * Every renderer guards on its own host element, so this file
   * runs unchanged on every page (home, about, work, contact,
   * blog listing, article pages).
   * ============================================================ */

  function renderHero() {
    if (!el('heroName')) return;
    el('heroEyebrow').textContent =
      C.profile.role + ' · ' + C.profile.focus;
    el('heroTagline').textContent = C.profile.tagline;

    ['First', 'Last'].forEach(function (part) {
      var host = el('hero' + part);
      var text = part === 'First' ? C.profile.firstName : C.profile.lastName;
      host.setAttribute('aria-hidden', 'true');
      host.innerHTML = text.split('').map(function (ch) {
        return '<span class="char">' + ch + '</span>';
      }).join('');
    });

    el('heroMeta').innerHTML =
      C.profile.identities.map(function (identity) {
        return '<span>' + identity + '</span>';
      }).join('');
  }

  function renderTicker() {
    if (!el('tickerTrack')) return;
    var fill = function (host, list) {
      if (!host) return;
      var items = list.map(function (s) {
        return '<span>' + s + '</span>';
      }).join('');
      // Duplicated for a seamless -50% loop
      host.innerHTML = items + items;
    };
    fill(el('tickerTrack'), C.stackTicker);
    fill(el('tickerTrackAlt'), C.stackTickerAlt || []);
  }

  function renderAbout() {
    if (!el('aboutText')) return;
    el('aboutText').innerHTML = C.profile.about.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('');
  }

  function renderExperience() {
    if (!el('timeline')) return;
    el('timeline').innerHTML = C.experience.map(function (job) {
      return (
        '<article class="xp__row" data-reveal>' +
          '<div class="xp__period">' + job.period +
            '<span class="xp__location">' + job.location + '</span>' +
          '</div>' +
          '<div class="xp__main">' +
            '<h3 class="xp__role">' + job.role + '</h3>' +
            '<span class="xp__company">' + job.company + '</span>' +
            '<p class="xp__summary">' + job.summary + '</p>' +
            '<div class="tag-row">' +
              job.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function renderBeyond() {
    if (!el('beyondGrid')) return;
    el('beyondGrid').innerHTML = C.beyond.map(function (b) {
      var external = b.link.indexOf('http') === 0;
      return (
        '<div class="beyond__card" data-reveal>' +
          '<span class="beyond__big">' + b.big + '</span>' +
          '<h3 class="beyond__title">' + b.title + '</h3>' +
          '<p class="beyond__sub">' + b.sub + '</p>' +
          '<a class="beyond__link" href="' + b.link + '"' +
            (external ? ' target="_blank" rel="noopener"' : '') +
            ' data-hover>' + b.linkLabel + ' <span aria-hidden="true">→</span></a>' +
        '</div>'
      );
    }).join('');
  }

  function renderWriting() {
    if (!el('articlesGrid')) return;
    var posts = (window.BLOG || []).slice(0, 4);
    el('articlesGrid').innerHTML = posts.map(function (p, i) {
      var num = ('0' + (i + 1)).slice(-2);
      return (
        '<a class="article-card" href="' + esc(p.url) + '" data-reveal data-hover>' +
          '<span class="article-card__index" aria-hidden="true">' + num + '</span>' +
          '<div class="article-card__top">' +
            '<span class="tag">' + esc(p.tags[0] || 'Engineering') + '</span>' +
            '<span class="article-card__date">' + esc(p.dateLabel) + '</span>' +
          '</div>' +
          '<h3 class="article-card__title">' + esc(p.title) + '</h3>' +
          '<p class="article-card__blurb">' + esc(p.excerpt) + '</p>' +
          '<span class="article-card__more">Read here' + (p.readingMins ? ' · ' + p.readingMins + ' min' : '') + ' <span aria-hidden="true">→</span></span>' +
        '</a>'
      );
    }).join('');
  }

  function renderProducts() {
    if (!el('productsGrid')) return;
    el('productsGrid').innerHTML = C.products.map(function (product, i) {
      var num = ('0' + (i + 1)).slice(-2);
      return (
        '<a class="product" href="' + product.url + '" target="_blank" rel="noopener" data-reveal data-hover>' +
          '<div class="product__head">' +
            '<span class="product__num">' + num + '</span>' +
            '<div class="product__title">' +
              '<h3 class="product__name">' + product.name + '</h3>' +
              '<span class="product__domain">' + product.domain + ' · ' + product.kind + '</span>' +
            '</div>' +
            '<span class="product__arrow" aria-hidden="true">↗</span>' +
          '</div>' +
          '<p class="product__about">' + product.about + '</p>' +
          '<p class="product__built"><span>My part:</span> ' + product.built + '</p>' +
          '<div class="tag-row">' +
            product.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') +
          '</div>' +
        '</a>'
      );
    }).join('');
  }

  function renderOss() {
    if (!el('ossGrid')) return;
    el('ossGrid').innerHTML = C.openSource.map(function (repo) {
      return (
        '<a class="oss__card" href="' + repo.url + '" target="_blank" rel="noopener" data-reveal data-hover>' +
          '<div class="oss__top">' +
            '<h3 class="oss__name">' + repo.name + '</h3>' +
            '<span class="oss__arrow" aria-hidden="true">↗</span>' +
          '</div>' +
          '<p class="oss__desc">' + repo.description + '</p>' +
          '<span class="tag">' + repo.lang + '</span>' +
        '</a>'
      );
    }).join('');
  }

  function renderCerts() {
    if (!el('certsList')) return;
    el('certsList').innerHTML = C.certifications.map(function (c, i) {
      var num = ('0' + (i + 1)).slice(-2);
      return (
        '<li class="certs__item" data-reveal>' +
          '<span class="certs__num">' + num + '</span>' +
          '<span class="certs__name">' + c.name + '</span>' +
          '<span class="certs__issuer">' + c.issuer + '</span>' +
          '<span class="certs__year">' + c.year + '</span>' +
        '</li>'
      );
    }).join('');
  }

  function renderQuotes() {
    if (!el('quotesStage')) return;
    el('quotesStage').innerHTML = C.recommendations.map(function (r, i) {
      return (
        '<div class="quote' + (i === 0 ? ' is-active' : '') + '" data-quote>' +
          '<span class="quote__mark" aria-hidden="true">“</span>' +
          '<p class="quote__text">' + r.quote + '</p>' +
          '<footer class="quote__author">' +
            r.author +
            '<span class="quote__relation">' + r.title + ' · ' + r.company + '</span>' +
          '</footer>' +
        '</div>'
      );
    }).join('');

    el('quoteDots').innerHTML = C.recommendations.map(function (_, i) {
      return (
        '<button class="quotes__dot' + (i === 0 ? ' is-active' : '') + '" ' +
        'data-dot="' + i + '" aria-label="Show recommendation ' + (i + 1) + '" data-hover></button>'
      );
    }).join('');
  }

  function renderContact() {
    if (!el('contactHeading')) return;
    var words = C.contact.heading.split(' ');
    var last = words.pop();
    el('contactHeading').innerHTML = words.join(' ') + ' <em>' + last + '</em>';
    el('contactSub').textContent = C.contact.sub;

    var email = el('contactEmail');
    email.textContent = C.profile.email;
    email.href = 'mailto:' + C.profile.email;
  }

  function renderFooter() {
    var host = el('siteFooter');
    if (!host) return;

    var icons = {
      linkedin:
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22 0H2C.9 0 0 .9 0 2v20c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2z"/>' +
        '</svg>',
      github:
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .3z"/>' +
        '</svg>',
      medium:
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M13.54 12a6.54 6.54 0 1 1-13.08 0 6.54 6.54 0 0 1 13.08 0zM22 12c0 3.4-1.47 6.16-3.27 6.16S15.45 15.4 15.45 12s1.48-6.16 3.28-6.16S22 8.6 22 12zm2.02 0c0 3.05-.53 5.53-1.18 5.53-.65 0-1.18-2.48-1.18-5.53s.53-5.53 1.18-5.53c.65 0 1.18 2.48 1.18 5.53z"/>' +
        '</svg>',
      twitter:
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.81-5.96 6.81H1.69l7.73-8.84L1.25 2.25h6.81l4.71 6.23 5.47-6.23zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64z"/>' +
        '</svg>',
    };

    var socials = C.profile.socials || {};
    var order = [
      ['LinkedIn', 'linkedin', socials.linkedin],
      ['GitHub', 'github', socials.github],
      ['Medium', 'medium', socials.medium],
      ['Twitter', 'twitter', socials.twitter],
    ];

    var socialHtml = order
      .filter(function (s) { return !!s[2]; })
      .map(function (s) {
        return (
          '<a class="footer__social" href="' + s[2] + '" target="_blank" rel="noopener" ' +
          'aria-label="' + s[0] + '" title="' + s[0] + '" data-hover>' +
          icons[s[1]] +
          '</a>'
        );
      })
      .join('');

    host.innerHTML =
      '<div class="footer__copy">' +
        '<span>Designed &amp; built by hand.</span>' +
        '<span>Copyright © ' + new Date().getFullYear() + '</span>' +
      '</div>' +
      '<nav class="footer__socials" aria-label="Social links">' + socialHtml + '</nav>';
  }

  /* ---------- Code widget (article pages) ----------
   * Wraps each code block with a language bar + copy button.
   * Medium ships most blocks pre-tokenised with hljs classes (the
   * theme colours them); plain blocks are highlighted at runtime. */

  function codeText(pre) {
    var clone = pre.cloneNode(true);
    clone.querySelectorAll('br').forEach(function (br) {
      br.replaceWith('\n');
    });
    return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* best effort */ }
    ta.remove();
  }

  function enhanceCodeBlocks() {
    var pres = document.querySelectorAll('.prose pre');
    if (!pres.length) return;

    pres.forEach(function (pre) {
      var lang = (pre.getAttribute('data-code-block-lang') || '').toLowerCase();

      var wrapper = document.createElement('div');
      wrapper.className = 'codeblock';
      var bar = document.createElement('div');
      bar.className = 'codeblock__bar';
      bar.innerHTML =
        '<span class="codeblock__lang">' + esc(lang || 'code') + '</span>' +
        '<button type="button" class="codeblock__copy" data-hover aria-label="Copy code">Copy</button>';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(bar);
      wrapper.appendChild(pre);

      // Runtime highlight for blocks without Medium's hljs tokens.
      if (window.hljs && !pre.querySelector('[class*="hljs-"]')) {
        var codeEl = document.createElement('code');
        codeEl.textContent = codeText(pre);
        if (lang) codeEl.className = 'language-' + lang;
        pre.innerHTML = '';
        pre.appendChild(codeEl);
        try { window.hljs.highlightElement(codeEl); } catch (err) { /* plain is fine */ }
      }

      bar.querySelector('.codeblock__copy').addEventListener('click', function () {
        var btn = this;
        var text = codeText(pre);
        var done = function () {
          btn.textContent = 'Copied ✓';
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {
            fallbackCopy(text);
            done();
          });
        } else {
          fallbackCopy(text);
          done();
        }
      });
    });
  }

  renderHero();
  renderTicker();
  renderAbout();
  renderExperience();
  renderBeyond();
  renderWriting();
  renderProducts();
  renderOss();
  renderCerts();
  renderQuotes();
  renderContact();
  renderFooter();
  enhanceCodeBlocks();

  /* ============================================================
   * 2. SMOOTH SCROLL (Lenis, when loaded)
   * ============================================================ */

  var lenis = null;
  if (!REDUCED && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    if (hasGsap) {
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var rafLenis = function (time) {
        lenis.raf(time);
        requestAnimationFrame(rafLenis);
      };
      requestAnimationFrame(rafLenis);
    }
    if (hasST) lenis.on('scroll', window.ScrollTrigger.update);
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: -20, duration: 1.4 });
    else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(target);
    });
  });

  /* ============================================================
   * 3. PRELOADER + HERO INTRO (home only)
   * ============================================================ */

  var preloader = el('preloader');

  function heroIntro() {
    if (REDUCED || !hasGsap || !el('heroName')) return;
    var chars = document.querySelectorAll('.hero__line .char');
    var tl = window.gsap.timeline();
    tl.from(chars, {
      yPercent: 110,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.035,
    })
      .from('.hero__eyebrow', { opacity: 0, y: 18, duration: 0.7 }, '-=0.7')
      .from('.hero__tagline', { opacity: 0, y: 18, duration: 0.7 }, '-=0.5')
      .from('.hero__meta', { opacity: 0, y: 18, duration: 0.7 }, '-=0.5')
      .from('.hero__actions .btn', { opacity: 0, y: 18, duration: 0.6, stagger: 0.1 }, '-=0.5')
      .from('.hero__scroll', { opacity: 0, duration: 0.8 }, '-=0.3');
  }

  if (preloader) {
    var count = el('preloaderCount');
    var bar = el('preloaderBar');

    var finishPreloader = function () {
      preloader.classList.add('is-done');
      preloader.addEventListener('transitionend', function () {
        preloader.remove();
      }, { once: true });
      heroIntro();
    };

    if (REDUCED) {
      finishPreloader();
    } else {
      var progress = { value: 0 };
      var loaded = false;
      var minDone = false;

      window.addEventListener('load', function () { loaded = true; });
      setTimeout(function () { loaded = true; }, 3500); // hard cap
      setTimeout(function () { minDone = true; }, 900);  // minimum presence

      var tick = setInterval(function () {
        var target = loaded && minDone ? 100 : 88;
        progress.value += (target - progress.value) * 0.12;
        var shown = Math.round(progress.value);
        count.textContent = (shown < 10 ? '0' : '') + shown;
        bar.style.width = shown + '%';
        if (shown >= 100) {
          clearInterval(tick);
          setTimeout(finishPreloader, 250);
        }
      }, 30);
    }
  }

  /* ============================================================
   * 4. SCROLL REVEALS
   * ============================================================ */

  if (!REDUCED && hasST) {
    window.ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        batch.forEach(function (node, i) {
          setTimeout(function () { node.classList.add('is-in'); }, i * 90);
        });
      },
    });
  } else if (!REDUCED && 'IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealIO.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (n) { revealIO.observe(n); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (n) { n.classList.add('is-in'); });
  }

  /* ============================================================
   * 5. STAT COUNTERS
   * ============================================================ */

  function animateCounter(node) {
    var end = parseInt(node.dataset.count, 10);
    var suffix = node.dataset.suffix || '';
    if (REDUCED) { node.textContent = end + suffix; return; }
    var t0 = null;
    var DURATION = 1600;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / DURATION, 1);
      var easedP = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(end * easedP) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (n) { counterIO.observe(n); });

  /* ============================================================
   * 6. NAV — scrolled state, active link, mobile menu
   * ============================================================ */

  var nav = el('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  var burger = el('navBurger');
  var menu = el('mobileMenu');

  function closeMenu() {
    if (!burger || !menu) return;
    burger.classList.remove('is-open');
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  }

  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = !menu.classList.contains('is-open');
      burger.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
    });
  }

  /* ============================================================
   * 7. CUSTOM CURSOR + MAGNETIC + TILT (pointer devices only)
   * ============================================================ */

  if (!TOUCH && !REDUCED) {
    var dot = el('cursorDot');
    var ring = el('cursorRing');
    var pos = { x: -100, y: -100 };
    var ringPos = { x: -100, y: -100 };

    window.addEventListener('mousemove', function (e) {
      pos.x = e.clientX;
      pos.y = e.clientY;
    }, { passive: true });

    (function cursorLoop() {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      dot.style.transform = 'translate(' + (pos.x - 3) + 'px,' + (pos.y - 3) + 'px)';
      ring.style.transform =
        'translate(' + (ringPos.x - ring.offsetWidth / 2) + 'px,' +
        (ringPos.y - ring.offsetHeight / 2) + 'px)';
      requestAnimationFrame(cursorLoop);
    })();

    document.querySelectorAll('a, button, [data-hover]').forEach(function (n) {
      n.addEventListener('mouseenter', function () { ring.classList.add('is-hover'); });
      n.addEventListener('mouseleave', function () { ring.classList.remove('is-hover'); });
    });

    // Magnetic pull
    document.querySelectorAll('[data-magnetic]').forEach(function (n) {
      n.addEventListener('mousemove', function (e) {
        var r = n.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        n.style.transform = 'translate(' + x * 0.3 + 'px,' + y * 0.35 + 'px)';
        n.style.transition = 'transform 0.1s linear';
      });
      n.addEventListener('mouseleave', function () {
        n.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
        n.style.transform = 'translate(0, 0)';
      });
    });

    // 3D tilt on article cards
    document.querySelectorAll('.article-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.transform =
          'rotateY(' + (px - 0.5) * 5 + 'deg) rotateX(' + (0.5 - py) * 5 + 'deg)';
        card.style.setProperty('--glare-x', px * 100 + '%');
        card.style.setProperty('--glare-y', py * 100 + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = 'rotateY(0) rotateX(0)';
      });
    });
  }

  /* ============================================================
   * 8. RECOMMENDATIONS SLIDER (home only, guarded by DOM)
   * Auto-advances while the section is on screen. Pauses on
   * fine-pointer hover, keyboard focus, and when the tab is hidden.
   * ============================================================ */

  (function initQuotesCarousel() {
    var stage = el('quotesStage');
    var slider = el('quotesSlider');
    if (!stage || !slider) return;

    var quotes = Array.prototype.slice.call(stage.querySelectorAll('[data-quote]'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('#quoteDots [data-dot]'));
    if (quotes.length < 2) return;

    var AUTO_MS = 6500;
    var current = 0;
    var timer = null;
    var inView = false;
    var hovered = false;
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function showQuote(index) {
      current = (index + quotes.length) % quotes.length;
      quotes.forEach(function (q, i) { q.classList.toggle('is-active', i === current); });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === current); });
    }

    function stopAuto() {
      clearInterval(timer);
      timer = null;
    }

    function startAuto() {
      if (REDUCED || hovered || document.hidden || !inView) return;
      stopAuto();
      timer = setInterval(function () { showQuote(current + 1); }, AUTO_MS);
    }

    function goTo(index) {
      showQuote(index);
      startAuto();
    }

    el('quotePrev').addEventListener('click', function () { goTo(current - 1); });
    el('quoteNext').addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        goTo(parseInt(d.dataset.dot, 10));
      });
    });

    if (canHover) {
      slider.addEventListener('mouseenter', function () {
        hovered = true;
        stopAuto();
      });
      slider.addEventListener('mouseleave', function () {
        hovered = false;
        startAuto();
      });
    }

    slider.setAttribute('tabindex', '0');
    slider.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
          if (inView) startAuto();
          else stopAuto();
        });
      }, { threshold: [0, 0.35, 0.7] });
      io.observe(slider);
    } else {
      inView = true;
      startAuto();
    }
  })();
})();
