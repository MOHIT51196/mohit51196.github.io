/* ============================================================
 *  anatomy.js — "System Anatomy" exploded 3D view
 *
 *  An ink-and-blue technical drawing of a microservice request
 *  stack (6 layers) with floating layer labels, a request pulse
 *  travelling the spine, messages flowing through the queue and
 *  a blueprint floor grid. Scrolling the pinned section pulls
 *  the stack apart; the legend highlights the layer in focus and
 *  reveals the skill set offered at that stage; drag rotates.
 *
 *  Degrades gracefully: no GSAP → auto-explode on enter;
 *  reduced motion / mobile → static exploded view with a
 *  tappable legend; no WebGL → flat CSS diagram.
 * ============================================================ */

(function () {
  'use strict';

  var section = document.getElementById('anatomy');
  var wrap = document.getElementById('anatomyWrap');
  var stage = document.getElementById('anatomyStage');
  var canvas = document.getElementById('anatomyCanvas');
  var legendHost = document.getElementById('anatomyLegend');
  var hint = document.getElementById('anatomyHint');
  if (!section || !stage || !canvas || !legendHost || !window.CONTENT) return;

  var LAYERS = window.CONTENT.anatomy;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = window.matchMedia('(max-width: 900px)').matches;
  var TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var hasST = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasST) window.gsap.registerPlugin(window.ScrollTrigger);

  var INK = 0x17150f;
  var ACCENT = 0x2b3fd4;

  var COMPACT_GAP = 0.62;
  var EXPLODED_GAP = 1.55;
  var LAYER_COUNT = LAYERS.length;

  /* ---------- legend (with per-layer skill chips) ---------- */

  legendHost.innerHTML = LAYERS.map(function (layer, i) {
    var chips = (layer.skills || []).map(function (s) {
      return '<span>' + s + '</span>';
    }).join('');
    return (
      '<li class="anatomy__item" data-layer="' + i + '" tabindex="0">' +
        '<span class="anatomy__num">0' + (i + 1) + '</span>' +
        '<span class="anatomy__body">' +
          '<span class="anatomy__name">' + layer.name + '</span>' +
          '<span class="anatomy__desc">' + layer.desc + '</span>' +
          '<span class="anatomy__skills">' + chips + '</span>' +
        '</span>' +
      '</li>'
    );
  }).join('');

  var legendItems = Array.prototype.slice.call(legendHost.children);

  function setLegendActive(idx) {
    legendItems.forEach(function (item, i) {
      item.classList.toggle('is-active', i === idx);
    });
  }

  /* ---------- no-WebGL fallback: flat labeled stack ---------- */

  function cssFallback() {
    canvas.remove();
    if (hint) hint.textContent = 'The layers of a resilient system, top to bottom.';
    var slabs = LAYERS.map(function (layer, i) {
      return '<div class="anatomy__slab" data-layer="' + i + '"><span>' + layer.name + '</span></div>';
    }).join('');
    stage.innerHTML = '<div class="anatomy__fallback">' + slabs + '</div>';
    setLegendActive(0);
    legendItems.forEach(function (item, i) {
      item.addEventListener('click', function () { setLegendActive(i); });
    });
  }

  if (!window.THREE) {
    cssFallback();
    return;
  }

  /* ---------- lazy init when the section approaches ---------- */

  var initialized = false;
  var initIO = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !initialized) {
      initialized = true;
      initIO.disconnect();
      init();
    }
  }, { rootMargin: '150% 0px' });
  initIO.observe(section);

  function init() {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      cssFallback();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(stage.clientWidth, stage.clientHeight);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(
      38,
      stage.clientWidth / stage.clientHeight,
      0.1,
      100
    );
    camera.position.set(7.2, 3.6, 10.6);
    camera.lookAt(0.4, 0.2, 0);

    var model = new THREE.Group();
    model.rotation.y = -0.42;
    scene.add(model);

    /* ---------- materials (one set per layer for highlighting) ---------- */

    var layerMaterials = [];
    function lineMaterial(idx) {
      var mat = new THREE.LineBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0.55,
      });
      layerMaterials[idx] = layerMaterials[idx] || [];
      layerMaterials[idx].push(mat);
      return mat;
    }

    function edges(geometry, idx) {
      return new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial(idx));
    }

    function wireframe(geometry, idx) {
      return new THREE.LineSegments(new THREE.WireframeGeometry(geometry), lineMaterial(idx));
    }

    /* ---------- blueprint floor grid ---------- */

    var floor = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.PlaneGeometry(17, 17, 14, 14)),
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.06 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.4;
    scene.add(floor);

    /* ---------- layer builders (top of stack = index 0) ---------- */

    var bobbers = [];   // meshes that float gently
    var spinners = [];  // meshes that rotate slowly
    var messages = [];  // queue message cubes

    function buildClients(idx) {
      var group = new THREE.Group();
      var positions = [
        [-1.7, 0.25, 0.6], [-0.6, 0.42, -0.7], [0.5, 0.2, 0.8],
        [1.5, 0.45, -0.3], [-1.1, 0.1, -0.2], [1.0, 0.15, 0.2], [0.05, 0.5, 0.05],
      ];
      positions.forEach(function (p, n) {
        var node = edges(new THREE.OctahedronGeometry(0.16), idx);
        node.position.set(p[0], p[1], p[2]);
        node.userData.baseY = p[1];
        node.userData.phase = n * 1.1;
        bobbers.push(node);
        group.add(node);
      });
      return group;
    }

    function buildEdge(idx) {
      var group = new THREE.Group();
      group.add(edges(new THREE.BoxGeometry(4.4, 0.22, 2.6), idx));
      var shield = edges(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 6), idx);
      shield.position.set(-1.6, 0.3, 0.5);
      group.add(shield);
      var lock = edges(new THREE.TorusGeometry(0.14, 0.045, 6, 12), idx);
      lock.position.set(1.6, 0.3, -0.4);
      spinners.push(lock);
      group.add(lock);
      return group;
    }

    function buildMesh(idx) {
      var group = new THREE.Group();
      var grid = wireframe(new THREE.PlaneGeometry(4.2, 2.4, 6, 4), idx);
      grid.rotation.x = -Math.PI / 2;
      group.add(grid);
      // discovery ring at the centre of the mesh
      var ring = edges(new THREE.TorusGeometry(0.5, 0.03, 8, 24), idx);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      spinners.push(ring);
      group.add(ring);
      return group;
    }

    function buildServices(idx) {
      var group = new THREE.Group();
      for (var s = 0; s < 5; s++) {
        var box = edges(new THREE.BoxGeometry(0.66, 0.58, 0.66), idx);
        box.position.set(-1.9 + s * 0.95, 0, (s % 2 === 0 ? 0.3 : -0.3));
        group.add(box);
        // replica shadow box behind every second service
        if (s % 2 === 1) {
          var replica = edges(new THREE.BoxGeometry(0.66, 0.58, 0.66), idx);
          replica.position.set(-1.9 + s * 0.95, 0.14, (s % 2 === 0 ? 0.3 : -0.3) - 0.5);
          replica.scale.setScalar(0.82);
          group.add(replica);
        }
      }
      return group;
    }

    function buildQueue(idx) {
      var group = new THREE.Group();
      var pipe = edges(new THREE.CylinderGeometry(0.34, 0.34, 3.8, 10, 1, true), idx);
      pipe.rotation.z = Math.PI / 2;
      group.add(pipe);
      for (var m = 0; m < 4; m++) {
        var msg = edges(new THREE.BoxGeometry(0.18, 0.18, 0.18), idx);
        msg.userData.offset = m / 4;
        messages.push(msg);
        group.add(msg);
      }
      return group;
    }

    function buildData(idx) {
      var group = new THREE.Group();
      [-1.5, -0.3].forEach(function (x) {
        var db = edges(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 12), idx);
        db.position.set(x, 0, 0.2);
        group.add(db);
        // disc seams so the cylinders read as databases
        [-0.14, 0.14].forEach(function (y) {
          var seam = edges(new THREE.TorusGeometry(0.42, 0.012, 4, 24), idx);
          seam.rotation.x = -Math.PI / 2;
          seam.position.set(x, y, 0.2);
          group.add(seam);
        });
      });
      var radar = edges(new THREE.ConeGeometry(0.34, 0.6, 4), idx);
      radar.position.set(1.3, 0.1, -0.2);
      spinners.push(radar);
      group.add(radar);
      var orbit = edges(new THREE.TorusGeometry(0.55, 0.02, 6, 28), idx);
      orbit.rotation.x = -Math.PI / 2.6;
      orbit.position.set(1.3, 0.1, -0.2);
      spinners.push(orbit);
      group.add(orbit);
      return group;
    }

    var builders = [buildClients, buildEdge, buildMesh, buildServices, buildQueue, buildData];
    var layerGroups = builders.map(function (build, i) {
      var group = build(i);
      group.userData.layer = i;
      model.add(group);
      return group;
    });

    /* ---------- request path (dashed spine + travelling pulse) ---------- */

    var spineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1, 0),
    ]);
    var spine = new THREE.Line(
      spineGeo,
      new THREE.LineDashedMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.55,
        dashSize: 0.16,
        gapSize: 0.12,
      })
    );
    model.add(spine);

    var pulse = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95 })
    );
    model.add(pulse);

    /* ---------- layout / explode ---------- */

    var spineTop = 0;
    var spineBottom = 0;

    function layerY(i, t) {
      var centered = (LAYER_COUNT - 1) / 2 - i; // top layer highest
      var gap = COMPACT_GAP + (EXPLODED_GAP - COMPACT_GAP) * t;
      return centered * gap;
    }

    function applyExplode(t) {
      layerGroups.forEach(function (group, i) {
        group.position.y = layerY(i, t);
      });
      spineTop = layerY(0, t) + 0.4;
      spineBottom = layerY(LAYER_COUNT - 1, t) - 0.3;
      spine.geometry.setFromPoints([
        new THREE.Vector3(0, spineTop, 0),
        new THREE.Vector3(0, spineBottom, 0),
      ]);
      spine.computeLineDistances();
    }

    /* ---------- highlighting ---------- */

    var scrollActive = 0;
    var manualActive = -1; // hover or legend tap; wins over scroll

    function paintActive() {
      var active = manualActive >= 0 ? manualActive : scrollActive;
      layerMaterials.forEach(function (mats, i) {
        mats.forEach(function (mat) {
          mat.color.setHex(i === active ? ACCENT : INK);
          mat.opacity = i === active ? 0.95 : 0.55;
        });
      });
      setLegendActive(active);
    }

    legendItems.forEach(function (item, i) {
      item.addEventListener('mouseenter', function () { manualActive = i; paintActive(); });
      item.addEventListener('mouseleave', function () { manualActive = -1; paintActive(); });
      item.addEventListener('click', function () { manualActive = i; paintActive(); });
    });

    /* ---------- hover raycast on the model ---------- */

    var raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.18 };
    var pointer = new THREE.Vector2(-10, -10);
    var pointerOverCanvas = false;

    if (!TOUCH) {
      canvas.addEventListener('mouseenter', function () { pointerOverCanvas = true; });
      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      }, { passive: true });
      canvas.addEventListener('mouseleave', function () {
        pointerOverCanvas = false;
        pointer.set(-10, -10);
        if (!dragging) { manualActive = -1; paintActive(); }
      });
    }

    function hoverCheck() {
      // The raycast only owns the highlight while the pointer is on
      // the canvas — otherwise it would stomp legend hover/click.
      if (TOUCH || dragging || !pointerOverCanvas) return;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(
        layerGroups.reduce(function (acc, g) { return acc.concat(g.children); }, []),
        true
      );
      var found = -1;
      for (var h = 0; h < hits.length; h++) {
        var node = hits[h].object;
        while (node && node.userData.layer === undefined) node = node.parent;
        if (node && node.userData.layer !== undefined) {
          found = node.userData.layer;
          break;
        }
      }
      if (found !== manualActive) {
        manualActive = found;
        paintActive();
      }
      canvas.style.cursor = found >= 0 ? 'pointer' : 'grab';
    }

    /* ---------- drag to rotate ---------- */

    var dragging = false;
    var dragX = 0;
    var rotTarget = -0.42;
    var rotVelocity = 0;

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      dragX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragX;
      dragX = e.clientX;
      rotVelocity = dx * 0.0055;
      rotTarget += rotVelocity;
    });
    ['pointerup', 'pointercancel'].forEach(function (evt) {
      canvas.addEventListener(evt, function () {
        dragging = false;
        canvas.style.cursor = 'grab';
      });
    });

    /* ---------- explode progress driver ---------- */

    var explodeCurrent = 0;
    var explodeTarget = 0;

    if (REDUCED) {
      explodeCurrent = explodeTarget = 1;
      scrollActive = 0;
      applyExplode(1);
      paintActive();
      renderer.render(scene, camera);
    } else if (hasST && !MOBILE) {
      window.ScrollTrigger.create({
        trigger: wrap,
        start: 'top top+=90',
        end: '+=140%',
        pin: true,
        scrub: 0.5,
        anticipatePin: 1,
        onUpdate: function (self) {
          explodeTarget = self.progress;
          var idx = Math.min(LAYER_COUNT - 1, Math.floor(self.progress * LAYER_COUNT));
          if (idx !== scrollActive) {
            scrollActive = idx;
            paintActive();
          }
        },
      });
    } else {
      // No GSAP or mobile: gently auto-explode when the section enters.
      var enterIO = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          explodeTarget = 1;
          enterIO.disconnect();
        }
      }, { threshold: 0.35 });
      enterIO.observe(stage);
    }

    /* ---------- render loop with visibility guards ---------- */

    var running = false;
    var inView = true;
    var clock = 0;

    function frame(now) {
      if (!running) return;
      clock = now * 0.001;

      explodeCurrent += (explodeTarget - explodeCurrent) * 0.08;
      applyExplode(explodeCurrent);

      if (!dragging) {
        rotVelocity *= 0.94;
        rotTarget += rotVelocity + 0.0011; // slow idle rotation
      }
      model.rotation.y += (rotTarget - model.rotation.y) * 0.1;
      model.rotation.x = Math.sin(clock * 0.25) * 0.02;

      // living details
      bobbers.forEach(function (node) {
        node.position.y = node.userData.baseY + Math.sin(clock * 1.3 + node.userData.phase) * 0.05;
      });
      spinners.forEach(function (node, i) {
        node.rotation.y += 0.008 + i * 0.001;
      });
      messages.forEach(function (msg) {
        var p = (clock * 0.14 + msg.userData.offset) % 1;
        msg.position.x = -1.7 + p * 3.4;
        msg.rotation.x = clock * 1.2;
      });
      var pp = (clock * 0.22) % 1;
      pulse.position.y = spineTop - pp * (spineTop - spineBottom);
      pulse.material.opacity = 0.55 + Math.sin(pp * Math.PI) * 0.4;
      pulse.rotation.y = clock * 2;

      spine.material.opacity = 0.4 + Math.sin(clock * 2.2) * 0.15;

      hoverCheck();
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    function play() {
      if (running || REDUCED) return;
      running = true;
      requestAnimationFrame(frame);
    }

    function pause() { running = false; }

    function sync() {
      if (inView && !document.hidden) play();
      else pause();
    }

    if (!REDUCED) {
      var viewIO = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.02 });
      viewIO.observe(stage);
      document.addEventListener('visibilitychange', sync);
      paintActive();
      play();
    }

    window.addEventListener('resize', function () {
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (REDUCED) renderer.render(scene, camera);
    }, { passive: true });
  }
})();
