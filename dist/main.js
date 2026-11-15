const chapters = [...document.querySelectorAll('.chapter')];
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
const copy = chapters.map(chapter => chapter.querySelector('.chapter-copy'));
const overlay = document.querySelector('#story-copy');
const stage = document.querySelector('.stage-wrap');
const renderSurface = document.querySelector('#stage-render');
const [base, blend] = renderSurface.querySelectorAll('.scene-frame');
const focus = document.querySelector('#stage-focus');
const bar = document.querySelector('.stage-progress span');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = value => Math.min(1, Math.max(0, value));

const bounds = [];
let active = -1;
let requested = 0;
let frames = [];
let adjacent = 0;
let ready = false;
const decoded = new Map();

for (const node of copy) {
  node.hidden = true;
  overlay.append(node);
}
document.querySelector('.chapters').classList.add('is-enhanced');

function loadFrame(index) {
  if (!frames[index] || decoded.has(index)) return;
  const img = new Image();
  const frame = frames[index];
  decoded.set(index, { img, available: false });
  img.src = frame.src;
  img.decode().then(() => {
    const entry = decoded.get(index);
    if (!entry || entry.img !== img) return;
    entry.available = true;
    schedule();
  }).catch(() => { /* Keep the current scene if this asset is unavailable. */ });
}

function render(value) {
  if (!frames.length) return;
  let current = frames.findLastIndex(frame => frame.at <= value);
  if (current < 0) current = 0;
  const next = Math.min(current + 1, frames.length - 1);
  const a = frames[current];
  const b = frames[next];
  const sameShot = a.camera === b.camera;
  const range = b.at - a.at;
  const t = range > 0 ? clamp((value - a.at) / range) : 0;
  const mix = sameShot && !reduced.matches ? t * t * (3 - 2 * t) : 0;
  // Load the destination first so a chapter jump never has to wait on earlier scenes.
  loadFrame(current);
  loadFrame(next);
  for (const offset of [-1, 2, 3]) loadFrame(current + offset);
  if (adjacent !== current) {
    for (const index of decoded.keys()) {
      if (Math.abs(index - current) > 7) decoded.delete(index);
    }
    adjacent = current;
  }
  const first = decoded.get(current);
  const second = decoded.get(next);
  if (!first?.available) return;
  if (base.getAttribute('src') !== a.src) {
    base.src = a.src;
    renderSurface.dataset.camera = a.camera;
    renderSurface.style.setProperty('--wide-shot', `url("${a.src}")`);
  }
  if (mix > 0 && second?.available && blend.getAttribute('src') !== b.src) blend.src = b.src;
  blend.style.opacity = second?.available ? mix : 0;
  const displayed = mix > .7 && second?.available ? b : a;
  const label = `Day ${String(displayed.day).padStart(2, '0')} · ${displayed.label}`;
  if (label !== focus.textContent) focus.textContent = label;
}

function update() {
  requested = 0;
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
  const value = chapter + clamp((y - start) / (end - start));
  bar.style.transform = `scaleX(${value / chapters.length})`;
  if (ready) render(value);
}

function schedule() {
  if (!requested) requested = requestAnimationFrame(update);
}

function measure() {
  for (let index = 0; index < chapters.length; index += 1) {
    const { top, height } = chapters[index].getBoundingClientRect();
    bounds[index] = { start: top + scrollY, end: top + scrollY + height };
  }
  schedule();
}

addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', measure, { passive: true });
new ResizeObserver(measure).observe(document.querySelector('.chapters'));
reduced.addEventListener('change', schedule);
measure();

const sequenceObserver = new IntersectionObserver(async entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  sequenceObserver.disconnect();
  try {
    const response = await fetch('assets/build/frames.json');
    if (!response.ok) return;
    frames = await response.json();
    ready = true;
    schedule();
  } catch {
    // The opening Blender render remains visible if the sequence cannot load.
  }
}, { rootMargin: '720px' });
sequenceObserver.observe(stage);

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
  if (!movie.src) movie.src = 'assets/hero-loop.mp4';
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

const ledger = document.querySelector('#materials');
const ledgerToggle = document.querySelector('#ledger-toggle');
function openLedger() {
  if (ledger.open) return;
  ledgerToggle.setAttribute('aria-expanded', 'true');
  ledger.showModal();
}
ledgerToggle.addEventListener('click', openLedger);
if (location.hash === '#materials') openLedger();
ledger.addEventListener('click', event => {
  if (event.target !== ledger) return;
  const bounds = ledger.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right) ledger.close();
});
ledger.addEventListener('close', () => {
  ledgerToggle.setAttribute('aria-expanded', 'false');
  ledgerToggle.focus({ preventScroll: true });
});
