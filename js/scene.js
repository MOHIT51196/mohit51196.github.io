/* ============================================================
 *  scene.js — WebGL hero (light theme)
 *  A technical-drawing look: ink geodesic wireframe on paper,
 *  accent-blue nodes, fine dust particles. Mouse parallax and
 *  scroll-driven camera drift. Degrades gracefully:
 *  reduced motion → single static frame; no WebGL → CSS fallback.
 * ============================================================ */

(function () {
  'use strict';

  var canvas = document.getElementById('webgl');
  var hero = document.getElementById('hero');
  if (!canvas || !hero) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = window.matchMedia('(max-width: 768px)').matches;
  var TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  var PAPER = 0xf7f5f0;
  var INK = 0x17150f;
  var ACCENT = 0x2b3fd4;
  var MUTED = 0x6f6a5e;

  // CDN blocked or WebGL unavailable → CSS gradient fallback
  if (!window.THREE) {
    hero.classList.add('hero--no-webgl');
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    hero.classList.add('hero--no-webgl');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  renderer.setSize(hero.clientWidth, hero.clientHeight);
  renderer.setClearColor(PAPER, 0); // transparent — paper shows through

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PAPER, 0.048);

  var camera = new THREE.PerspectiveCamera(
    45,
    hero.clientWidth / hero.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 8.5);

  var group = new THREE.Group();
  // Composition: structure sits right of centre on desktop so the
  // name rests on clean paper; centred (behind wash) on mobile.
  group.position.x = MOBILE ? 0 : 2.4;
  scene.add(group);

  /* ---------- Inner geodesic wireframe (vertex-morphing) ---------- */
  var geo = new THREE.IcosahedronGeometry(2.35, 1);
  var wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.34,
    })
  );
  group.add(wire);

  var wireBase = wire.geometry.attributes.position.array.slice();

  // Accent nodes at each vertex of the source geometry
  var nodeGeo = new THREE.IcosahedronGeometry(2.35, 1);
  var nodes = new THREE.Points(
    nodeGeo,
    new THREE.PointsMaterial({
      color: ACCENT,
      size: 0.055,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  group.add(nodes);

  var nodeBase = nodeGeo.attributes.position.array.slice();

  /* ---------- Outer ghost shell ---------- */
  var shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.4, 0)),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.09,
    })
  );
  group.add(shell);

  /* ---------- Fine dust particle field ---------- */
  var COUNT = MOBILE ? 1000 : 2600;
  var positions = new Float32Array(COUNT * 3);
  var colors = new Float32Array(COUNT * 3);
  var accent = new THREE.Color(ACCENT);
  var dust = new THREE.Color(MUTED);

  for (var i = 0; i < COUNT; i++) {
    // Spherical shell distribution, radius 4 → 11, around the group
    var r = 4 + Math.random() * 7;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) + group.position.x;
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    var c = Math.random() < 0.22 ? accent : dust;
    var dim = 0.55 + Math.random() * 0.45;
    colors[i * 3] = c.r * dim;
    colors[i * 3 + 1] = c.g * dim;
    colors[i * 3 + 2] = c.b * dim;
  }

  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  scene.add(particles);

  /* ---------- Organic vertex morphing ----------
   * Displacement is a pure function of base position + time, so
   * coincident vertices in the wireframe stay welded together. */
  function morph(attr, base, time, amp, freq) {
    var arr = attr.array;
    for (var j = 0; j < arr.length; j += 3) {
      var x = base[j];
      var y = base[j + 1];
      var z = base[j + 2];
      var n =
        Math.sin(x * freq + time) *
        Math.cos(y * freq + time * 0.8) *
        Math.sin(z * freq + time * 0.6);
      var s = 1 + n * amp;
      arr[j] = x * s;
      arr[j + 1] = y * s;
      arr[j + 2] = z * s;
    }
    attr.needsUpdate = true;
  }

  /* ---------- Interaction state ---------- */
  var mouse = { x: 0, y: 0 };
  var eased = { x: 0, y: 0 };

  if (!TOUCH) {
    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  function scrollProgress() {
    var h = hero.offsetHeight || 1;
    return Math.min(Math.max(window.scrollY / h, 0), 1);
  }

  /* ---------- Render loop with visibility guards ---------- */
  var running = false;
  var inView = true;
  var start = performance.now();

  function frame(now) {
    if (!running) return;
    var t = (now - start) * 0.001;

    eased.x += (mouse.x - eased.x) * 0.045;
    eased.y += (mouse.y - eased.y) * 0.045;

    morph(wire.geometry.attributes.position, wireBase, t * 0.55, 0.09, 1.15);
    morph(nodes.geometry.attributes.position, nodeBase, t * 0.55, 0.09, 1.15);

    group.rotation.y = t * 0.12 + eased.x * 0.35;
    group.rotation.x = Math.sin(t * 0.08) * 0.12 + eased.y * 0.25;
    shell.rotation.y = -t * 0.06;
    shell.rotation.z = t * 0.04;
    particles.rotation.y = t * 0.02;

    var p = scrollProgress();
    camera.position.z = 8.5 + p * 3.5;
    camera.position.y = -p * 1.2;
    camera.lookAt(group.position.x * 0.6, 0, 0);
    canvas.style.opacity = String(1 - p * 0.9);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function play() {
    if (running || REDUCED) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
  }

  function sync() {
    if (inView && !document.hidden) play();
    else pause();
  }

  if (REDUCED) {
    // One static, well-composed frame — no animation at all
    group.rotation.set(0.35, 0.6, 0);
    camera.lookAt(group.position.x * 0.6, 0, 0);
    renderer.render(scene, camera);
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.02 }
    );
    observer.observe(hero);
    document.addEventListener('visibilitychange', sync);
    play();
  }

  window.addEventListener('resize', function () {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    var nowMobile = window.matchMedia('(max-width: 768px)').matches;
    group.position.x = nowMobile ? 0 : 2.4;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (REDUCED) {
      camera.lookAt(group.position.x * 0.6, 0, 0);
      renderer.render(scene, camera);
    }
  }, { passive: true });
})();
