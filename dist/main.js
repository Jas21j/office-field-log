import { loadHub, renderLedger, wireDrawer } from './ledger.js';

const chapters = [...document.querySelectorAll('.chapter')];
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
const copy = chapters.map(chapter => chapter.querySelector('.chapter-copy'));
const overlay = document.querySelector('#story-copy');
const stage = document.querySelector('.stage-wrap');
const surface = document.querySelector('#stage-render');
const [base, blend] = surface.querySelectorAll('.scene-frame');
const plan = surface.querySelector('.scene-plan');
const grid = surface.querySelector('.scene-grid');
const [accentA, accentB] = surface.querySelectorAll('.scene-accent');
const scan = surface.querySelector('.scene-scan');
const focus = document.querySelector('#stage-focus');
const bar = document.querySelector('.stage-progress span');
const mini = document.querySelector('#minimap');
const [miniA, miniB] = mini.querySelectorAll('img');
const cone = mini.querySelector('.cone');
const eyes = mini.querySelectorAll('circle');
const miniDay = mini.querySelector('figcaption b');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const bounds = [];
let active = -1;
let frames = [];
let geo = null;
let ready = false;
let orient = '';
const images = new Map();

for (const node of copy) {
  node.hidden = true;
  overlay.append(node);
}
document.querySelector('.chapters').classList.add('is-enhanced');

// ------------------------------------------------------------ images: decode ahead, show only what is decoded
function image(src) {
  if (!src) return null;
  let entry = images.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ok: false, used: performance.now() };
    images.set(src, entry);
    img.src = src;
    img.decode().then(() => { entry.ok = true; kick(); }).catch(() => {});
  }
  entry.used = performance.now();
  return entry;
}
const ready$ = src => { const e = image(src); return e && e.ok; };
function show(el, src) {
  if (src && el.getAttribute('src') !== src && ready$(src)) el.src = src;
  return src && el.getAttribute('src') === src;
}
function trim() {
  if (images.size < 40) return;
  const old = [...images.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, images.size - 32);
  for (const [src] of old) images.delete(src);
}

const pickOrient = () => (innerHeight > innerWidth * 1.08 ? 'P' : 'L');
const buildSrc = i => `assets/build/${String(i).padStart(2, '0')}-${orient}.webp`;
const accentSrc = i => frames[i]?.accent ? `assets/accent/${String(i).padStart(2, '0')}-${orient}.webp` : null;
const bpSrc = cam => `assets/bp/${cam}-${orient}.webp`;

// camera runs: consecutive states from one camera drift slowly in (a few percent) for the whole run
let runs = [];
function measureRuns() {
  const seen = new Set();
  for (const f of frames) { f.first = !seen.has(f.camera); seen.add(f.camera); }   // a camera's first appearance gets the plan -> built scan
  runs = [];
  frames.forEach((f, i) => {
    const last = runs[runs.length - 1];
    if (last && frames[last.end].camera === f.camera) last.end = i;
    else runs.push({ start: i, end: i });
  });
  for (const r of runs) {
    r.a = frames[r.start].at;
    r.b = frames[Math.min(r.end + 1, frames.length - 1)].at;
    if (r.b <= r.a) r.b = r.a + .5;
    for (let i = r.start; i <= r.end; i++) frames[i].run = r;
  }
}
const drift = (i, v) => {
  if (reduced.matches) return '';
  const r = frames[i].run, u = clamp((v - r.a) / (r.b - r.a));
  return `scale(${(1.012 + .038 * u).toFixed(4)}) translateY(${(-.6 * u).toFixed(3)}%)`;
};

// ------------------------------------------------------------ the stage at a (smoothed) scroll value
function render(v) {
  const n = frames.length;
  let i = frames.findLastIndex(f => f.at <= v);
  if (i < 0) i = 0;
  const j = Math.min(i + 1, n - 1);
  const a = frames[i], b = frames[j];
  const t = b.at > a.at ? clamp((v - a.at) / (b.at - a.at)) : 0;
  const cut = a.camera !== b.camera && b.first && !reduced.matches;
  const revisit = a.camera !== b.camera && !cut;
  // only the two states being mixed; the neighbourhood of the scroll target is fetched first (prefetch)
  for (const k of [i, j]) { image(buildSrc(k)); image(accentSrc(k)); }
  if (cut) image(bpSrc(b.camera));
  trim();

  if (!show(base, buildSrc(i))) return;
  base.style.transform = drift(i, v);
  let mixB = 0, clipB = '', planOn = 0, gridClip = '', scanOn = 0, scanY = 0, accA = 0, accB = 0;
  if (!cut) {
    // same camera: dissolve between states; back to a camera already seen: a slower dissolve held in the middle
    mixB = reduced.matches ? (t > .5 ? 1 : 0) : revisit ? smooth(.2, .8, t) : smooth(0, 1, t);
    accA = 1 - smooth(0, .5, t);
    accB = smooth(.35, 1, t);
  } else {
    // old view dissolves into the new camera's blueprint, holds, then a scan line builds the new view top to bottom
    const p1 = smooth(0, .34, t), p3 = ease(clamp((t - .46) / .5));
    planOn = p1;
    mixB = p3 > 0 ? 1 : 0;
    clipB = `inset(0 0 ${((1 - p3) * 100).toFixed(2)}% 0)`;
    gridClip = `inset(${(p3 * 100).toFixed(2)}% 0 0 0)`;
    scanOn = p3 > 0 && p3 < 1 ? Math.min(1, p3 * 6, (1 - p3) * 6) : 0;
    scanY = p3;
    accA = 1 - p1;
    accB = p3;
  }
  const haveB = show(blend, buildSrc(j));
  blend.style.opacity = haveB ? mixB : 0;
  blend.style.clipPath = clipB;
  blend.style.transform = drift(j, v);
  const havePlan = planOn > 0 && show(plan, bpSrc(b.camera));
  plan.style.opacity = havePlan ? planOn : 0;
  plan.style.transform = drift(j, v);
  grid.style.opacity = havePlan ? planOn * .9 : 0;
  grid.style.clipPath = gridClip;
  scan.style.opacity = scanOn;
  scan.style.transform = `translateY(${(scanY * surface.clientHeight).toFixed(1)}px)`;
  const srcA = accentSrc(i), srcB = accentSrc(j);
  accentA.style.opacity = srcA && accA > 0 && show(accentA, srcA) ? accA : 0;
  accentA.style.transform = drift(i, v);
  accentB.style.opacity = srcB && j !== i && accB > 0 && show(accentB, srcB) ? accB : 0;
  accentB.style.transform = drift(j, v);
  accentB.style.clipPath = cut ? clipB : '';

  const shown = (cut ? t > .6 : mixB > .7) ? b : a;
  const label = `Day ${String(shown.day).padStart(2, '0')} · ${shown.label}`;
  if (label !== focus.textContent) focus.textContent = label;
  renderMini(a, b, cut ? ease(smooth(.12, .9, t)) : 0, cut ? t : smooth(0, 1, t), shown.day);
}

// ------------------------------------------------------------ mini-map: the room from above, where the camera stands
function pose(f) {
  const [eye, aim, lens] = geo.cameras[f.camera][orient];
  const halfSensor = orient === 'L' ? 18 : 18 * (1080 / 1920);   // horizontal half-width of the sensor
  return { eye, aim, half: Math.atan(halfSensor / lens) };
}
function renderMini(a, b, u, mix, day) {
  if (!geo?.plan || !a.plan) return;
  mini.hidden = false;
  const p = geo.plan, [W, H] = p.size;
  if (show(miniA, a.plan)) miniA.style.opacity = 1;
  const other = b.plan && b.plan !== a.plan && show(miniB, b.plan);
  miniB.style.opacity = other ? mix : 0;
  const A = pose(a), B = pose(b);
  const lerp = (x, y) => x + (y - x) * u;
  const ex = lerp(A.eye[0], B.eye[0]), ey = lerp(A.eye[1], B.eye[1]);
  const ax = lerp(A.aim[0], B.aim[0]), ay = lerp(A.aim[1], B.aim[1]);
  const half = lerp(A.half, B.half);
  const px = x => W / 2 + (x - p.cx) * p.ppi, py = y => H / 2 - (y - p.cy) * p.ppi;
  const m = 26;
  const X = Math.min(W - m, Math.max(m, px(ex))), Y = Math.min(H - m, Math.max(m, py(ey)));
  const dir = Math.atan2(py(ay) - Y, px(ax) - X), len = 170;
  const p1 = [X + Math.cos(dir - half) * len, Y + Math.sin(dir - half) * len];
  const p2 = [X + Math.cos(dir + half) * len, Y + Math.sin(dir + half) * len];
  cone.setAttribute('d', `M${X.toFixed(1)} ${Y.toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}A${len} ${len} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z`);
  for (const c of eyes) { c.setAttribute('cx', X.toFixed(1)); c.setAttribute('cy', Y.toFixed(1)); }
  const d = `Day ${String(day).padStart(2, '0')}`;
  if (miniDay.textContent !== d) miniDay.textContent = d;
}

// ------------------------------------------------------------ scroll: chapters follow the page; the stage glides after it
let target = 0, shown = 0, raf = 0, last = 0;
function scrollValue() {
  const y = scrollY;
  let chapter = bounds.findIndex(({ end }) => y < end);
  if (chapter === -1) chapter = bounds.length - 1;
  if (active !== chapter) {
    if (active >= 0) copy[active].hidden = true;
    chapterLinks[active]?.removeAttribute('aria-current');
    copy[chapter].hidden = false;
    chapterLinks[chapter].setAttribute('aria-current', 'step');
    active = chapter;
  }
  const { start, end } = bounds[chapter];
  return chapter + clamp((y - start) / (end - start));
}
function step(now) {
  const dt = last ? Math.min(64, now - last) : 16;
  last = now;
  const gap = target - shown;
  if (reduced.matches) shown = target;
  else {
    if (Math.abs(gap) > .35) shown = target - Math.sign(gap) * .35;   // a jump (nav link, End key): skip ahead, glide the last stretch
    shown += (target - shown) * (1 - Math.exp(-dt / 170));         // ~170 ms glide behind the scroll
  }
  if (Math.abs(target - shown) < .0004) shown = target;
  bar.style.transform = `scaleX(${shown / chapters.length})`;
  if (ready) render(shown);
  if (shown !== target) raf = requestAnimationFrame(step);
  else { raf = 0; last = 0; }
}
let lastTarget = 0;
function prefetch(v) {
  if (!ready) return;
  let i = frames.findLastIndex(f => f.at <= v);
  if (i < 0) i = 0;
  const dir = v >= lastTarget ? 1 : -1;            // look further ahead in the direction of travel (phone flicks)
  lastTarget = v;
  for (const k of [i, i + dir, i + 2 * dir, i + 3 * dir, i - dir]) {
    const f = frames[k];
    if (!f) continue;
    image(buildSrc(k)); image(accentSrc(k)); image(f.plan);
    if (f.first) image(bpSrc(f.camera));
  }
}
function kick() {
  target = scrollValue();
  prefetch(target);
  if (!raf) raf = requestAnimationFrame(step);
}

// ------------------------------------------------------------ warm-up: pull every frame for this orientation into the HTTP cache
// in the background (no decoding, so memory stays flat), nearest first, one at a time, after the page settles.
// A fast scroll then decodes from cache in a few ms instead of waiting on the network.
const warmed = new Set();
let warming = false;
async function warm() {
  if (warming || !ready || navigator.connection?.saveData) return;
  warming = true;
  const o = orient;
  const near = Math.max(0, frames.findLastIndex(f => f.at <= target));
  const order = frames.map((_, k) => k).sort((x, y) => Math.abs(x - near) - Math.abs(y - near));
  const list = [];
  for (const k of order) {
    const f = frames[k];
    list.push(buildSrc(k), accentSrc(k), f.plan);
    if (f.first) list.push(bpSrc(f.camera));
  }
  for (const src of list) {
    if (o !== orient) break;                        // rotated: the next measure() starts a fresh pass
    if (!src || warmed.has(src)) continue;
    warmed.add(src);
    try { await fetch(src, { priority: 'low' }); } catch { warmed.delete(src); }
    await new Promise(r => (window.requestIdleCallback || setTimeout)(r, { timeout: 400 }));
  }
  warming = false;
  if (o !== orient) warm();
}

function measure() {
  for (let index = 0; index < chapters.length; index += 1) {
    const { top, height } = chapters[index].getBoundingClientRect();
    bounds[index] = { start: top + scrollY, end: top + scrollY + height };
  }
  const o = pickOrient();
  if (o !== orient) { orient = o; images.clear(); warm(); }
  kick();
}

addEventListener('scroll', kick, { passive: true });
addEventListener('resize', measure, { passive: true });
new ResizeObserver(measure).observe(document.querySelector('.chapters'));
reduced.addEventListener('change', kick);
measure();

const sequenceObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  sequenceObserver.disconnect();
  try {
    const [f, g] = await Promise.all(['assets/build/frames.json?v=20261115', 'assets/build/cameras.json?v=20261115'].map(u => fetch(u).then(r => r.ok ? r.json() : null)));
    if (!f) return;
    frames = f;
    geo = g;
    measureRuns();
    ready = true;
    shown = target = scrollValue();
    kick();
    setTimeout(warm, 1200);
  } catch {
    // The opening Blender render remains visible if the sequence cannot load.
  }
}, { rootMargin: '900px' });
sequenceObserver.observe(stage);

// ------------------------------------------------------------ landing orbit
const hero = document.querySelector('.hero');
const figure = hero.querySelector('.hero-visual');
const movie = hero.querySelector('.hero-motion');
const orbitControl = hero.querySelector('.orbit-control');
let inView = true;
let paused = false;

function updateOrbitControl() {
  const playing = !movie.paused;
  orbitControl.innerHTML = playing ?
    '<span aria-hidden="true">Ⅱ</span> Pause orbit' :
    '<span aria-hidden="true">▷</span> Play orbit';
}

function setOrbit() {
  if (reduced.matches || paused || !inView || document.hidden) {
    movie.pause();
    return;
  }
  movie.muted = true;
  if (!movie.src) movie.src = 'assets/hero-loop.mp4?v=20261115';
  movie.play().catch(updateOrbitControl);
}

movie.addEventListener('loadeddata', () => { orbitControl.hidden = reduced.matches; });
movie.addEventListener('playing', () => {
  figure.classList.add('motion-ready');
  updateOrbitControl();
});
movie.addEventListener('pause', updateOrbitControl);
orbitControl.addEventListener('click', () => {
  paused = !movie.paused;
  setOrbit();
});
reduced.addEventListener('change', () => {
  orbitControl.hidden = reduced.matches || movie.readyState < 2;
  if (reduced.matches) figure.classList.remove('motion-ready');
  setOrbit();
});
document.addEventListener('visibilitychange', setOrbit);
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  setOrbit();
}, { threshold: .22 }).observe(hero);

// ------------------------------------------------------------ ledger drawer (figures from data/projects.json, shared with the Project Hub)
const ledger = document.querySelector('#materials');
const ledgerToggle = document.querySelector('#ledger-toggle');
const invoiceRoot = document.querySelector('#invoice');
const openLedger = wireDrawer(ledger, ledgerToggle);
ledgerToggle.addEventListener('click', () => openLedger());
if (['#materials', '#invoice', '#ledger'].includes(location.hash)) openLedger();
loadHub().then(hub => {
  const project = hub.projects.find(p => p.jobs.some(j => j.id === invoiceRoot.dataset.job));
  if (project) renderLedger(project, invoiceRoot, { jobId: invoiceRoot.dataset.job });
}).catch(() => {
  invoiceRoot.querySelector('.ledger-note').textContent = 'The ledger could not load. Refresh to try again.';
});
