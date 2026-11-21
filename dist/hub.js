import {
  loadHub, money, moneyShort, num, esc, shortDate, dateRange, clock, STATUS, projectStatus,
  jobCosts, jobMetrics, rollup, contractOf, balanceOf, allTasks, renderLedger, wireDrawer, PENDING, invoiceOf, dueOf, gasGroups,
} from './ledger.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const portrait = matchMedia('(max-aspect-ratio: 4/5)');
const smooth = () => (reduced.matches ? 'auto' : 'smooth');
const pad2 = n => String(n).padStart(2, '0');
const DAY = 864e5;
const ROT_MS = 7000;
const now0 = new Date();
const todayISO = `${now0.getFullYear()}-${pad2(now0.getMonth() + 1)}-${pad2(now0.getDate())}`;

const ICONS = {
  calc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  slats: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 4v16M12 4v16M16 4v16"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  outdoor: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  supply: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  planning: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 11.5h7v8M14.5 4.5v6h6"/>',
  check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
  open: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5M12 15.6v.4"/>',
  next: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  ledger: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
};
const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.open}</svg>`;

let data, projects = [], tasks = [], cur = -1;
const foundations = new Map();
const F = id => foundations.get(id) ?? { id, name: id, desc: '' };
const trade = id => (id && data?.trades?.[id]) || '';
const rec = { f: 'home', project: 'all' };
const els = { rail: $('#rail'), hero: $('#hero'), jobrow: $('#jobrow'), pj: $('#pj'), tl: $('#tl'), sums: $('#sums'), bg: $$('.bg-img') };

const jobImg = (j, kind) => j.art ?? `assets/hub/${j.id}/${kind}.webp`;
const keyJob = p => p.jobs.find(j => j.id === p.keyJob) ?? p.jobs[0];
const shot = (j, e) => (e.img ? `assets/hub/${j.id}/${e.img}.webp` : null);
const backdropJobs = p => { const k = keyJob(p); return [k, ...p.jobs.filter(j => j !== k && !j.art)]; };
const statusOf = p => STATUS[projectStatus(p)];
const span = j => (j.start ? `${shortDate(j.start)}${!j.end ? ' – ongoing' : j.end !== j.start ? ` – ${shortDate(j.end)}` : ''}` : 'No date');
const whenLabel = e => [e.tag, e.date ? shortDate(e.date) : (e.upcoming ? 'Not scheduled' : 'No date'), clock(e.time)].filter(Boolean).join(' · ');
const where = (j, p = j.project) => (j.title === p.name ? p.name : `${j.title} · ${p.name}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listWords = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
function enter(el) {
  if (reduced.matches || !el) return;
  el.classList.remove('enter');
  void el.offsetWidth;
  el.classList.add('enter');
}

// ------------------------------------------------------------ status line
function renderTelemetry() {
  $('#t-count').textContent = `${plural(projects.length, 'project')} · ${plural(projects.reduce((t, p) => t + p.jobs.length, 0), 'job')}`;
  $('#foot-updated').textContent = `Data updated ${shortDate(data.updated)}, ${data.updated.slice(0, 4)}`;
  const tick = () => {
    const now = new Date();
    $('#t-clock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    $('#t-clock').dateTime = now.toISOString();
  };
  tick();
  setInterval(tick, 15e3);
}

// ------------------------------------------------------------ sliding selection pills (chapter tabs, record tabs)
function placeInd(group, active) {
  const ind = group.querySelector(':scope > .ind');
  if (!ind || !active) return;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
}
function ensureInd(group) {
  if (!group.querySelector(':scope > .ind')) group.insertAdjacentHTML('afterbegin', '<span class="ind" aria-hidden="true"></span>');
}

// ------------------------------------------------------------ the project row
function renderRail() {
  $('#home').classList.toggle('solo', projects.length < 2);
  els.rail.innerHTML = projects.map((p, i) => {
    const multi = p.jobs.length > 1, k = keyJob(p);
    const art = multi
      ? `<span class="mosaic">${backdropJobs(p).slice(0, 4).map(j => `<img src="${esc(jobImg(j, 'tile'))}" alt="" decoding="async">`).join('')}</span>`
      : `<img src="${esc(jobImg(k, 'tile'))}" alt="" width="480" height="480" decoding="async">`;
    const flag = p.id === data.featured ? 'Featured' : multi ? plural(p.jobs.length, 'job') : '';
    return `<button class="tile${!multi && k.art ? ' tile-art' : ''}" type="button" role="option" id="tile-${esc(p.id)}" data-i="${i}" aria-selected="false" tabindex="-1" aria-label="${esc(p.name)}, ${esc(statusOf(p).label)}, ${plural(p.jobs.length, 'job')}">
      ${art}<i class="tile-dot ${statusOf(p).cls}" aria-hidden="true"></i>${flag ? `<b class="tile-flag" aria-hidden="true">${flag}</b>` : ''}</button>`;
  }).join('');
}
const tiles = () => [...els.rail.children];
function keepInView(tile) {
  const r = els.rail, left = tile.offsetLeft, right = left + tile.offsetWidth;
  const padL = parseFloat(getComputedStyle(r).paddingLeft);
  if (left - padL < r.scrollLeft || right + 200 > r.scrollLeft + r.clientWidth) r.scrollTo({ left: Math.max(0, left - padL), behavior: smooth() });
}

// ------------------------------------------------------------ focus a project: everything follows at once
function select(i, { focus = false, push = true } = {}) {
  i = Math.max(0, Math.min(projects.length - 1, i));
  if (i === cur) { if (focus) tiles()[i].focus({ preventScroll: true }); return; }
  cur = i;
  const p = projects[i];
  tiles().forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  if (focus) tiles()[i].focus({ preventScroll: true });
  keepInView(tiles()[i]);
  document.documentElement.style.setProperty('--accent', p.accent ?? '#7f9a86');
  startBackdrop(p);
  renderHero(p); enter(els.hero);
  renderJobRow(p); enter(els.jobrow);
  renderProject(p); enter(els.pj);
  renderInvoice(p);
  if (push) history.replaceState(null, '', `#/${p.id}`);
  document.title = `${p.name} — Project Hub`;
}

// the environment: the project's key art; a project with several jobs drifts through them while it has the stage
let bgFront = 0, bgToken = 0, homeInView = true;
const rot = { list: [], k: 0, timer: 0 };
function startBackdrop(p) {
  clearInterval(rot.timer);
  rot.list = backdropJobs(p);
  rot.k = 0;
  showBackdrop(rot.list[0]);
  if (rot.list.length > 1 && !reduced.matches) {
    rot.timer = setInterval(() => {
      if (document.hidden || !homeInView || document.querySelector('dialog[open]')) return;
      rot.k = (rot.k + 1) % rot.list.length;
      showBackdrop(rot.list[rot.k]);
      markShowing();
    }, ROT_MS);
  }
}
async function showBackdrop(j) {
  const token = ++bgToken;
  const src = jobImg(j, portrait.matches ? 'hero-P' : 'hero-L');
  const pre = new Image();
  pre.src = src;
  try { await pre.decode(); } catch { /* show it anyway */ }
  if (token !== bgToken) return;
  const next = els.bg[bgFront ^ 1], prev = els.bg[bgFront];
  next.src = src;
  next.style.objectPosition = j.focus ?? '50% 50%';
  next.classList.add('on');
  prev.classList.remove('on');
  bgFront ^= 1;
  const n = rot.list[(rot.k + 1) % rot.list.length];
  if (n && n !== j) new Image().src = jobImg(n, portrait.matches ? 'hero-P' : 'hero-L');
}
function markShowing() {
  const id = rot.list.length > 1 ? rot.list[rot.k]?.id : null;
  for (const c of $$('.jc', els.jobrow)) {
    c.classList.remove('is-showing');
    if (c.dataset.job === id) { void c.offsetWidth; c.classList.add('is-showing'); }
  }
}

// ------------------------------------------------------------ the focused project at a glance: only what is recorded, plus a note for the rest
const metric = (label, value, note = '') => `<div class="metric"><span>${label}</span><b class="${value == null ? 'na' : String(value).length > 12 ? 'long' : ''}">${value ?? '—'}</b>${note ? `<small>${note}</small>` : ''}</div>`;
const partial = f => (f.of > 1 && f.n < f.of ? `${f.n} of ${f.of} recorded` : '');
function renderHero(p) {
  const r = rollup(p), s = statusOf(p), b = balanceOf(contractOf(p)), i = projects.indexOf(p);
  const shown = [], missing = [];
  const add = (label, f, fmt, word) => (f.sum == null ? missing.push(word) : shown.push(metric(label, fmt(f.sum), partial(f))));
  add('Days on site', r.days, num, 'days on site');
  add('Hours', r.hours, num, 'hours');
  add('Miles', r.miles, num, 'miles');
  add('Materials', r.materials, moneyShort, 'materials');
  const inv = invoiceOf(p), due = inv ? inv.due : b.balance;
  if (inv && r.hours.sum == null && inv.totals.timed) { missing.splice(missing.indexOf('hours'), 1); shown.splice(1, 0, metric('Hours logged', num(Math.round(inv.totals.minutes / 6) / 10), `${shortDate(inv.from)} – ${shortDate(inv.to)}`)); }
  if (inv && r.miles.sum == null && inv.totals.milesDays) { missing.splice(missing.indexOf('miles'), 1); shown.splice(2, 0, metric('Miles', `≈ ${num(Math.round(inv.totals.miles))}`, 'Estimated from stops')); }
  if (due == null) missing.push('balance'); else shown.push(metric('Balance due', moneyShort(due), inv ? (inv.materialsBilled ? 'Days, gas and materials' : 'Days on site and gas') : ''));
  if (inv) shown.length = 0, missing.length = 0, shown.push(
    metric('Days on site', String(inv.totals.days), `${shortDate(inv.from)} – ${shortDate(inv.to)}`),
    metric('Hours', num(Math.round(inv.totals.minutes / 6) / 10), 'On the clock'),
    metric('Miles', `≈ ${num(Math.round(inv.totals.miles))}`, 'Estimated'),
    metric('Stops', String(inv.totals.stops), 'Suppliers and sites'));
  els.hero.innerHTML = `
    <p class="hero-index eyebrow">${projects.length > 1 ? `N° ${pad2(i + 1)} / ${pad2(projects.length)}` : 'Active project'}${p.id === data.featured ? ' <span class="feat">Featured</span>' : ''}</p>
    <p class="hero-eyebrow"><span class="chip ${s.cls}"><i></i>${esc(p.statusLabel ?? s.label)}</span><span>${[p.type, p.city].filter(Boolean).map(esc).join(' · ')}</span></p>
    <h1 class="hero-title">${esc(p.name)}</h1>
    <p class="hero-meta">${esc(dateRange(r.start, r.end, r.ongoing))}<i>·</i>${plural(r.jobs, 'job')}</p>
    <p class="hero-summary">${esc(p.summary)}</p>
    <div class="metrics">${inv ? '' : metric('Jobs', String(r.jobs), r.open ? `${r.done} done · ${r.open} open` : `${r.done} done`)}${shown.join('')}</div>
    ${missing.length ? `<p class="pending-note">${esc(listWords(missing).replace(/^./, c => c.toUpperCase()))} not recorded yet</p>` : ''}
    <div class="hero-actions">
      ${inv ? `<button class="btn primary" type="button" data-act="invoice">Walk through the invoice ${icon('arrow')}</button>`
        : `<button class="btn primary" type="button" data-act="open">Open project ${icon('arrow')}</button>
      <button class="btn glass" type="button" data-act="ledger" aria-haspopup="dialog" aria-controls="ledger">${icon('ledger')} Ledger</button>`}
      ${(p.links ?? []).map(l => `<a class="btn glass" href="${esc(l.href)}">${esc(l.label)} ${icon('external')}</a>`).join('')}
    </div>`;
}
function renderJobRow(p) {
  els.jobrow.innerHTML = `<span class="jobrow-label" aria-hidden="true">Jobs</span>` + p.jobs.map(j => `
    <button class="jc" type="button" data-job="${esc(j.id)}" aria-label="Open job: ${esc(j.title)}" aria-haspopup="dialog">
      <span class="jc-thumb${j.art ? ' art' : ''}"><img src="${esc(jobImg(j, 'tile'))}" alt="" loading="lazy" decoding="async" width="480" height="480"></span>
      <span class="jc-text"><b>${esc(j.title)}</b><small><i class="dot ${STATUS[j.status].cls}"></i>${esc(span(j))} · ${esc(F(j.foundation).name)}</small></span>
      <span class="showing" aria-hidden="true"></span>
    </button>`).join('');
  els.jobrow.style.setProperty('--rot', `${ROT_MS}ms`);
  markShowing();
}

// ------------------------------------------------------------ the calm timeline
const COLS = [
  { label: 'Days', get: j => jobMetrics(j).days, fmt: num },
  { label: 'Hours', get: j => jobMetrics(j).hours, fmt: num },
  { label: 'Miles', get: j => jobMetrics(j).miles, fmt: num },
  { label: 'Materials', get: j => jobCosts(j).materials, fmt: moneyShort },
];
function axisFor(jobs) {
  const dated = jobs.filter(j => j.start);
  if (!dated.length) return null;
  const work = dated.filter(j => j.status !== 'planning');
  let t0 = Math.min(...(work.length ? work : dated).map(j => Date.parse(j.start)));
  let t1 = Math.max(Date.parse(todayISO), ...dated.map(j => Date.parse(j.end ?? todayISO)));
  const len = Math.max(t1 - t0, 14 * DAY);
  t0 -= len * .04 + DAY; t1 += len * .06 + DAY;
  const x = t => ((t - t0) / (t1 - t0)) * 100;
  const months = [];
  const d0 = new Date(t0);
  for (let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); d.getTime() < t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ x: x(d.getTime()), label: d.toLocaleString('en-US', { month: 'short' }) });
  if (!months.length || months[0].x > 18) months.unshift({ x: 0, label: d0.toLocaleString('en-US', { month: 'short' }), first: true });
  const tx = x(Date.parse(todayISO) + DAY / 2);
  return { x, months, todayX: tx >= 0 && tx <= 100 ? tx : null };
}
function bar(j, a) {
  if (!j.start) return `<span class="tl-nodate">No date recorded</span>`;
  let left = a.x(Date.parse(j.start));
  const right = Math.min(100, a.x(Date.parse(j.end ?? todayISO) + DAY));
  const clip = left < 0;
  if (clip) left = 0;
  const cls = { active: 'live', planning: 'plan' }[j.status] ?? '';
  return `<span class="tl-bar ${cls}${clip ? ' clip' : ''}" style="left:${left.toFixed(3)}%;width:${Math.max(.9, right - left).toFixed(3)}%"></span>`;
}
function timeline(groups, { heads = true } = {}) {
  const all = groups.flatMap(g => g.jobs);
  const a = axisFor(all);
  const cols = COLS.filter(c => all.some(j => c.get(j) != null));
  if (!a) return { html: '<p class="empty-note">No dated jobs yet.</p>', cols };
  const val = (c, v) => `<span class="tl-val">${v == null ? '' : c.fmt(v)}</span>`;
  const rows = groups.map(({ p, jobs }) => {
    const r = rollup({ jobs });
    const head = heads ? `
      <button class="tl-row head" type="button" data-pid="${esc(p.id)}" aria-label="Focus ${esc(p.name)}">
        <span class="tl-name"><b>${esc(p.name)}</b><small>${plural(jobs.length, 'job')} · ${esc(dateRange(r.start, r.end, r.ongoing))}</small></span>
        <span class="tl-track">${r.start ? `<span class="tl-span" style="left:${Math.max(0, a.x(Date.parse(r.start))).toFixed(3)}%;width:${Math.max(.6, Math.min(100, a.x(Date.parse(r.end ?? todayISO) + DAY)) - Math.max(0, a.x(Date.parse(r.start)))).toFixed(3)}%"></span>` : ''}</span>
        ${cols.map(c => { const vals = jobs.map(c.get).filter(v => v != null); return val(c, vals.length ? vals.reduce((x, y) => x + y, 0) : null); }).join('')}
      </button>` : '';
    return head + jobs.map(j => {
      const tag = j.status === 'active' ? '<i class="tag">In progress</i>' : j.status === 'planning' ? '<i class="tag plan">Planning</i>' : '';
      return `<button class="tl-row job" type="button" data-job="${esc(j.id)}" style="--c:${esc(j.accent ?? '#3ce04b')}" aria-label="${esc(j.title)}, ${esc(dateRange(j.start, j.end))}" aria-haspopup="dialog">
        <span class="tl-name"><b>${esc(j.title)}${tag}</b><small>${esc(j.start ? dateRange(j.start, j.end) : 'No date recorded')}</small></span>
        <span class="tl-track">${bar(j, a)}</span>
        ${cols.map(c => val(c, c.get(j))).join('')}
      </button>`;
    }).join('');
  }).join('');
  const scale = `<div class="tl-axis"><span></span><div class="tl-scale">${a.months.map(m => `<span class="${m.first ? 'first' : ''}" style="left:${m.x.toFixed(2)}%">${m.label}</span>`).join('')}${a.todayX != null ? `<span class="today-label" style="left:${a.todayX.toFixed(2)}%">Today</span>` : ''}</div>${cols.map(c => `<span class="tl-col">${c.label}</span>`).join('')}</div>`;
  return { html: scale + rows, cols, style: `--cols:${cols.length};--today:${a.todayX == null ? -10 : a.todayX.toFixed(3)}%` };
}

// ------------------------------------------------------------ chapter 02: the work inside the focused project
function renderProject(p) {
  const r = rollup(p), b = balanceOf(contractOf(p)), i = projects.indexOf(p), due = dueOf(p), inv = invoiceOf(p);
  const t = timeline([{ p, jobs: p.jobs }], { heads: false });
  const ptasks = tasks.filter(x => x.p === p);
  const open = p.jobs.flatMap(j => (j.open ?? []).map(o => ({ o, j })));
  const next = ptasks.filter(x => x.upcoming);
  const known = [], missing = [];
  const line = (label, v, fmt, word) => (v == null ? missing.push(word) : known.push(`<dt>${label}</dt><dd>${fmt(v)}</dd>`));
  if (inv) known.push(`<dt>Invoice · ${shortDate(inv.from)} – ${shortDate(inv.to)}</dt><dd>${inv.totals.days} days · ${inv.totals.gasDays} gas</dd>`);
  else line('Agreed price', b.agreed, money, 'agreed price');
  if (b.approvedCount) known.push(`<dt>Approved changes (${b.approvedCount})</dt><dd>${money(b.changes)}</dd>`);
  line('Paid', b.paid, money, 'payments');
  line('Labor', r.labor.sum, money, 'labor');
  line('Hours on site', r.hours.sum, v => `${num(v)} h`, 'hours');
  line('Mileage', r.miles.sum, v => `${num(v)} mi`, 'mileage');
  const paidPct = b.total && b.paid != null ? Math.min(100, (b.paid / b.total) * 100) : 0;
  const counts = [...foundations.values()].map(f => ({ f, n: ptasks.filter(x => x.f === f.id && !x.upcoming).length }));
  els.pj.innerHTML = `
    <header class="ch-head row">
      <div style="display:grid;gap:14px">
        <p class="ch-num">02 <span>The work</span></p>
        <h2 id="pj-title">${esc(p.name)}</h2>
        <p class="ch-lede">${esc(`${plural(r.jobs, 'job')}${r.start ? `, ${dateRange(r.start, r.end, r.ongoing)}` : ''}. Open any job for its photos, tasks and costs.`)}</p>
      </div>
      <div class="pj-nav">
        <button class="icon-btn" type="button" data-act="prev" aria-label="Previous project" ${i === 0 ? 'disabled' : ''}>‹</button>
        <button class="icon-btn" type="button" data-act="next" aria-label="Next project" ${i === projects.length - 1 ? 'disabled' : ''}>›</button>
      </div>
    </header>
    <div class="panel tl-wrap"><div class="tl" style="${t.style ?? ''}">${t.html}</div></div>
    <div class="pj-grid">
      <div class="panel">
        <div class="panel-head"><h3>Ledger</h3><p>Contract and costs</p></div>
        <div class="lg-top">
          <div><span>Balance due</span><b class="lg-big${due == null ? ' is-pending' : ''}">${money(due)}</b></div>
          <div style="text-align:right"><span>Materials so far</span><b class="lg-big${r.materials.sum == null ? ' is-pending' : ''}">${money(r.materials.sum)}</b></div>
        </div>
        ${inv ? '' : `<div class="lg-bar${b.total == null ? ' is-pending' : ''}" role="img" aria-label="${b.total == null ? 'Agreed price not recorded' : `${Math.round(paidPct)}% paid`}"><i style="width:${paidPct}%"></i></div>`}
        ${known.length ? `<dl class="lg-rows">${known.join('')}</dl>` : ''}
        <div class="lg-foot">
          ${inv ? `<button class="btn glass small" type="button" data-act="invoice">${icon('receipt')} Invoice</button>` : ''}
          <button class="btn glass small" type="button" data-act="ledger" aria-haspopup="dialog" aria-controls="ledger">${icon('ledger')} Full ledger</button>
          <p>${missing.length ? `Not recorded yet: ${esc(listWords(missing))}. ` : ''}${r.purchases ? `${plural(r.purchases, 'purchase')} documented.` : ''}</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Record</h3><p>${plural(ptasks.filter(x => !x.upcoming).length, 'item')} on file</p><span class="end"><button class="btn glass small" type="button" data-act="record">See all ${icon('arrow')}</button></span></div>
        <div class="fsum">${counts.map(({ f, n }) => `<button class="fs${n ? '' : ' is-empty'}" type="button" data-rf="${esc(f.id)}"><span>${icon(f.id)}${esc(f.name)}</span><b>${n}</b></button>`).join('')}</div>
      </div>
    </div>
    ${open.length || next.length ? `
    <div class="pj-grid">
      ${next.length ? `<div class="panel"><div class="panel-head"><h3>Next up</h3><p>Planned, not scheduled</p></div>
        <ul class="checks next">${next.map(x => `<li>${icon('next')}<span>${esc(x.t)}<small>${esc(where(x.j))}</small></span></li>`).join('')}</ul></div>` : ''}
      ${open.length ? `<div class="panel"><div class="panel-head"><h3>Not confirmed yet</h3><p>Kept honest</p></div>
        <ul class="checks open">${open.map(({ o, j }) => `<li>${icon('open')}<span>${esc(o)}${p.jobs.length > 1 ? `<small>${esc(j.title)}</small>` : ''}</span></li>`).join('')}</ul></div>` : ''}
    </div>` : ''}`;
}

// ------------------------------------------------------------ chapter 03: the invoice, told one day at a time
const ivEl = $('#iv');
const iv = { data: null, filter: 'all', now: null, io: null, shownDue: false, media: [] };

// the viewer: every photo and receipt on the invoice, in story order
const lb = $('#lightbox');
let lbK = 0, lbToken = 0, lbOpener = null;
function openLightbox(k, opener) {
  if (!iv.media.length) return;
  lbK = k; lbOpener = opener ?? null;
  paintLightbox();
  if (!lb.open) lb.showModal();
}
function paintLightbox() {
  const m = iv.media[lbK], stage = $('#lb-stage'), token = ++lbToken;
  $('#lb-kind').textContent = m.kind;
  $('#lb-when').textContent = m.when;
  $('#lb-title').textContent = m.title;
  $('#lb-pos').textContent = `${lbK + 1} / ${iv.media.length}`;
  const img = new Image();
  img.className = 'lb-img'; img.alt = m.title; img.src = m.src;
  img.decode().catch(() => {}).then(() => {
    if (token !== lbToken) return;
    for (const old of $$('.lb-img', stage)) { old.classList.remove('on'); setTimeout(() => old.remove(), 450); }
    stage.append(img);
    requestAnimationFrame(() => img.classList.add('on'));
  });
  const next = iv.media[(lbK + 1) % iv.media.length];
  if (next) new Image().src = next.src;   // warm the next one
}
const lbStep = n => { lbK = (lbK + n + iv.media.length) % iv.media.length; paintLightbox(); };
$('#lb-prev').addEventListener('click', () => lbStep(-1));
$('#lb-next').addEventListener('click', () => lbStep(1));
$('#lb-day').addEventListener('click', () => { const i = iv.media[lbK].day; lb.close(); setTimeout(() => goDay(i), 60); });
lb.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); lbStep(1); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); lbStep(-1); }
});
lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.id === 'lb-stage') lb.close(); });
lb.addEventListener('close', () => { lbOpener?.focus({ preventScroll: true }); lbOpener = null; });

// what if: the same invoice charged by the hour instead of by the day (a sandbox, nothing here is saved to the invoice)
const calc = $('#calc');
let calcOpener = null;
const CALC_KEY = 'hub-calc';
function calcBase() {
  const I = iv.data, billed = I.days.filter(d => d.charge.settled == null);
  const worked = billed.filter(d => d.dayRate);
  return {
    due: Math.round(total(billed, d => d.charge.total) * 100) / 100,
    labor: total(billed, d => d.charge.day),
    gas: total(billed, d => d.charge.gas),
    mat: Math.round(total(billed, d => d.charge.materials) * 100) / 100,
    hours: Math.round(total(worked, d => d.minutes) / 6) / 10,
    days: worked.length,
  };
}
function openCalc(opener) {
  if (!iv.data) return;
  const B = calcBase();
  const even = B.hours ? B.labor / B.hours : 0;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CALC_KEY) || '{}'); } catch { /* storage off */ }
  const rate = saved.rate ?? Math.round(even + 4);
  $('#calc-body').innerHTML = `
    <p class="eyebrow">What if</p>
    <h3 id="calc-title">Charge by the hour</h3>
    <p class="calc-lede">The same ${B.days} days, priced by the hour instead of ${money(iv.data.rates.day)} a day. Just for testing; the invoice doesn't change.</p>
    <label class="calc-field"><span>Hourly rate</span>
      <span class="calc-rate"><b>$</b><input id="calc-rate" type="number" inputmode="decimal" min="0" step="1" value="${rate}"><i>/ hr</i></span>
      <input id="calc-slide" type="range" min="10" max="80" step="1" value="${Math.min(80, Math.max(10, rate))}" aria-label="Hourly rate">
    </label>
    <label class="calc-field"><span>Hours</span>
      <span class="calc-rate"><input id="calc-hours" type="number" inputmode="decimal" min="0" step="0.5" value="${saved.hours ?? B.hours}"><i>hrs</i></span>
      <small>${hrs(B.hours * 60)} on the clock across ${B.days} days</small>
    </label>
    <div class="calc-toggles">
      <label><input id="calc-gas" type="checkbox" ${saved.gas === false ? '' : 'checked'}><span>Gas <b>${money(B.gas)}</b></span></label>
      <label><input id="calc-mat" type="checkbox" ${saved.mat === false ? '' : 'checked'}><span>Materials <b>${money(B.mat)}</b></span></label>
    </div>
    <div class="calc-out">
      <p class="eyebrow">Balance at <span id="calc-at"></span></p>
      <b id="calc-due" data-v="${B.due}">${money(B.due)}</b>
      <p class="calc-diff" id="calc-diff"></p>
    </div>
    <dl class="calc-compare">
      <div><dt>At the day rate</dt><dd id="calc-base">${money(B.due)}</dd></div>
      <div><dt>Break-even rate</dt><dd>${money(even)} / hr</dd></div>
    </dl>
    <button class="btn glass small calc-reset" type="button" id="calc-reset">Reset</button>`;
  const $r = $('#calc-rate'), $s = $('#calc-slide'), $h = $('#calc-hours'), $g = $('#calc-gas'), $m = $('#calc-mat');
  const paint = (instant = false) => {
    const r = Math.max(0, Number($r.value) || 0), h = Math.max(0, Number($h.value) || 0);
    const extras = ($g.checked ? B.gas : 0) + ($m.checked ? B.mat : 0);
    const due = Math.round((r * h + extras) * 100) / 100;
    const base = Math.round((B.labor + extras) * 100) / 100;   // the day-rate total with the same items included
    const diff = Math.round((due - base) * 100) / 100;
    $('#calc-base').textContent = money(base);
    $('#calc-at').textContent = `${money(r)} an hour`;
    tween($('#calc-due'), due, money, instant ? 1 : 320);
    const el = $('#calc-diff');
    el.className = `calc-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`;
    el.textContent = diff === 0 ? 'Same as the day rate' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than the day rate`;
    try { localStorage.setItem(CALC_KEY, JSON.stringify({ rate: r, hours: h, gas: $g.checked, mat: $m.checked })); } catch { /* storage off */ }
  };
  $r.addEventListener('input', () => { $s.value = Math.min(80, Math.max(10, Number($r.value) || 0)); paint(); });
  $s.addEventListener('input', () => { $r.value = $s.value; paint(); });
  [$h, $g, $m].forEach(x => x.addEventListener('input', () => paint()));
  $('#calc-reset').addEventListener('click', () => {
    try { localStorage.removeItem(CALC_KEY); } catch { /* storage off */ }
    $r.value = $s.value = Math.round(even + 4); $h.value = B.hours; $g.checked = $m.checked = true; paint();
  });
  paint(true);
  calcOpener = opener ?? null;
  calc.showModal();
}
calc.addEventListener('click', ev => { if (ev.target === calc) calc.close(); });
calc.addEventListener('close', () => { calcOpener?.focus({ preventScroll: true }); calcOpener = null; });
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dObj = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const isoOf = dt => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const wday = iso => WD[dObj(iso).getDay()];
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hm = m => `${Math.floor(m / 60)} h ${pad2(m % 60)} m`;
const hrs = m => `${(Math.round(m / 6) / 10).toLocaleString('en-US')} h`;
const clockM = m => clock(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`);
const usdW = n => money(Math.round(n * 100) / 100).replace(/\.00$/, '');   // drops .00 on whole amounts, keeps real cents
const total = (list, get) => list.reduce((t, x) => t + (get(x) ?? 0), 0);
const DAY0 = 7 * 60, DAYSPAN = 15 * 60;                        // the clock track runs 7 AM – 10 PM
const pct = m => Math.max(0, Math.min(100, ((m - DAY0) / DAYSPAN) * 100));
const jobAccent = j => j?.accent ?? '#7f9a86';
const jobChip = (code, j) => `<span class="iv-job" style="--c:${esc(jobAccent(j))}"><i></i>${esc(code)} · ${esc(j?.short ?? j?.title ?? '')}</span>`;
const shows = d => iv.filter === 'all' || d.job.includes(iv.filter);

function tween(el, to, fmt, ms = 700, pow = 3) {
  if (!el) return;
  const from = Number(el.dataset.v ?? 0);
  el.dataset.v = String(to);
  cancelAnimationFrame(el._raf);
  if (reduced.matches || Math.abs(to - from) < 1e-9) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** pow;
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

const mi1 = v => (Math.round(v * 10) / 10).toLocaleString('en-US');
function dayCard(d, I, media) {
  const dt = d.date ? dObj(d.date) : null, c = d.charge, multi = d.job.length > 1;
  const lines = [];
  if (c.settled != null) lines.push(`<li class="settled"><span>Paid the same day</span><b>${usdW(c.settled)}</b></li>`);
  else {
    if (d.dayRate) lines.push(`<li><span>Day on site</span><b>${usdW(c.day)}</b></li>`);
    if (d.gas) lines.push(`<li class="gas"><span>Gas · ${d.dayRate ? 'supply runs' : 'the run'}</span><b>+${usdW(c.gas)}</b></li>`);
  }
  if (d.buys.length) lines.push(`<li class="mat${I.materialsBilled ? ' billed' : ''}"><span>${I.materialsBilled ? `Materials · ${plural(d.buys.length, 'purchase')}` : 'Receipts · not in the total'}</span><b>${d.materials ? `${I.materialsBilled && c.settled == null ? '+' : ''}${money(d.materials)}` : 'Not priced'}${d.unpriced && d.materials ? ' + unpriced' : ''}</b></li>`);
  const shift = d.minutes != null ? `${clockM(d.start)} – ${clockM(d.end)}</span><i>·</i><span>${hm(d.minutes)}` : d.start != null ? clockM(d.start) : 'Time not recorded';
  const ticks = d.stops.filter(s => s.t).map(s => `<i class="k-${esc(s.kind)}" style="left:${pct(mins(s.t)).toFixed(2)}%"></i>`).join('');
  const span = d.minutes != null ? `<span class="iv-span" style="left:${pct(d.start).toFixed(2)}%;width:${(pct(d.end) - pct(d.start)).toFixed(2)}%"></span>` : '';
  const stops = d.stops.map((s, k) => `
        <li class="iv-stop k-${esc(s.kind)}" style="--k:${k}">
          <span class="iv-t"><time>${s.t ? clock(s.t) : ''}</time>${s.mi ? `<small title="Estimated drive from the previous stop">${d.rode ? 'ride ' : '+'}${mi1(s.mi)} mi</small>` : ''}</span><span class="iv-pin" aria-hidden="true"></span>
          <div class="iv-stop-text"><b>${esc(s.place)}${s.city ? ` <small>${esc(s.city)}</small>` : ''}${s.job && multi ? ` <em class="iv-code" style="--c:${esc(jobAccent(I.byCode(s.job)))}">${esc(s.job)}</em>` : ''}</b><p>${esc(s.what)}</p></div>
          ${s.amount != null || s.kind === 'buy' ? (s.receiptFull
            ? `<button class="iv-rcpt" type="button" data-media="${media.get(`r${d.i}:${k}`)}" aria-label="${esc(`Open the receipt: ${s.place}, ${s.amount != null ? money(s.amount) : 'no price'}`)}" aria-haspopup="dialog"><span class="iv-rcpt-img"><img src="assets/hub/${esc(s.receipt)}.webp" alt="" loading="lazy" decoding="async">${icon('expand')}</span><b>${s.amount != null ? money(s.amount) : 'No price yet'}</b>${s.cash ? '<small>Cash</small>' : ''}</button>`
            : `<span class="iv-rcpt none" title="No receipt on file yet"><b>${s.amount != null ? money(s.amount) : 'No price yet'}</b>${s.cash ? '<small>Cash</small>' : ''}</span>`) : ''}
        </li>`).join('');
  const photo = d.photo ? `<figure class="iv-photo"><button type="button" data-media="${media.get(`p${d.i}`)}" aria-label="${esc(`Open the photo: end of the day, ${d.date ? shortDate(d.date) : ''}`)}" aria-haspopup="dialog"><img src="assets/hub/${esc(d.photo)}.webp" alt="${esc(`End of the day${d.date ? `, ${shortDate(d.date)}` : ''}: ${d.title}`)}" loading="lazy" decoding="async"><span class="iv-zoom" aria-hidden="true">${icon('expand')}</span></button><figcaption>${d.photoAt ? `Final photo · ${clock(d.photoAt)}` : 'From the build log'}</figcaption></figure>` : '';
  const sub = c.settled != null ? 'Settled' : [c.day && 'Day', c.gas && 'gas', c.materials && 'materials'].filter(Boolean).join(' + ').replace(/^./, x => x.toUpperCase()) || 'No charge';
  return `
  <li class="iv-day" id="day-${d.date ?? `undated-${d.i}`}" data-i="${d.i}" style="--c:${esc(jobAccent(d.jobs[0]))}">
    <article class="panel">
      <header class="iv-dh">
        <div class="iv-date">${dt ? `<small>${WD[dt.getDay()]}</small><b>${dt.getDate()}</b><span>${shortDate(d.date).slice(0, 3)}</span>` : '<small>Date</small><b>—</b><span>Not set</span>'}</div>
        <div class="iv-title">
          <p class="iv-jobs">${d.job.length ? d.job.map(code => jobChip(code, I.byCode(code))).join('') : '<span class="iv-job none"><i></i>No job assigned</span>'}</p>
          <h3>${esc(d.title)}</h3>
          <p class="iv-shift">${icon('next')}<span>${shift}</span><i>·</i><span>${plural(d.stops.length, 'stop')}</span>${d.rode ? '<i>·</i><span>Rode in</span>' : d.miles ? `<i>·</i><span class="iv-mi">≈ ${mi1(d.miles)} mi${d.milesPartial ? '+' : ''}</span>` : ''}</p>
        </div>
        <div class="iv-amt${c.settled != null ? ' settled' : ''}"><b>${usdW(c.settled ?? c.total)}</b><small>${sub}</small></div>
      </header>
      <div class="iv-clock" aria-hidden="true">
        <div class="iv-track">${span}${ticks}</div>
        <div class="iv-hours">${['7a', '10a', '1p', '4p', '7p', '10p'].map((h, k) => `<span style="left:${k * 20}%">${h}</span>`).join('')}</div>
      </div>
      <div class="iv-body${photo ? '' : ' solo'}">
        <ol class="iv-route">${stops}
        </ol>
        ${photo}
      </div>
      <footer class="iv-df">
        <ul class="iv-lines">${lines.join('')}</ul>
        ${d.note ? `<p class="iv-note">${icon('check')}<span>${esc(d.note)}</span></p>` : ''}
        ${d.confirm?.length ? `<div class="iv-confirm">${icon('open')}<div><b>To confirm</b><ul>${d.confirm.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      </footer>
    </article>
  </li>`;
}

function calendar(I) {
  const first = dObj(I.from), last = dObj(I.to);
  const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const end = new Date(last); end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const byDate = new Map(I.days.filter(d => d.date).map(d => [d.date, d]));
  const cells = [];
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const iso = isoOf(dt), d = byDate.get(iso), inside = dt >= first && dt <= last;
    const mon = dt.getDate() === 1 || iso === I.from ? `<em>${shortDate(iso).slice(0, 3)}</em>` : '';
    if (d) {
      const cls = ['iv-cell', 'on', d.gas && 'gas', !d.dayRate && 'trip', d.confirm?.length && 'ask', d.job.length > 1 && 'split'].filter(Boolean).join(' ');
      cells.push(`<button class="${cls}" type="button" data-goto="${d.i}" style="--c:${esc(jobAccent(d.jobs[0]))};--c2:${esc(jobAccent(d.jobs[1] ?? d.jobs[0]))}" aria-label="${esc(`${WD[dt.getDay()]}, ${shortDate(iso)}: ${d.title}, ${usdW(d.charge.total)}`)}">${mon}<b>${dt.getDate()}</b><small>${usdW(d.charge.total)}</small><i class="pip" aria-hidden="true"></i></button>`);
    } else cells.push(`<span class="iv-cell${inside ? '' : ' out'}">${mon}<b>${dt.getDate()}</b></span>`);
  }
  const undated = I.days.filter(d => !d.date).map(d => `<button class="iv-undated" type="button" data-goto="${d.i}" style="--c:${esc(jobAccent(d.jobs[0]))}"><i></i><span><b>${esc(d.title)}</b><small>Date not set · ${d.charge.settled != null ? `settled ${usdW(d.charge.settled)}` : usdW(d.charge.total)}</small></span></button>`).join('');
  return `<div class="iv-cal-grid" role="group" aria-label="Days on this invoice">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="iv-wd" aria-hidden="true">${x}</span>`).join('')}${cells.join('')}</div>${undated ? `<div class="iv-undated-row">${undated}</div>` : ''}`;
}

function statementHTML(I) {
  const days = I.days, billed = days.filter(d => d.charge.settled == null);
  const labor = total(billed, d => d.charge.day), gas = total(billed, d => d.charge.gas);
  const mat = Math.round(total(billed, d => d.charge.materials) * 100) / 100;
  const due = Math.round(total(billed, d => d.charge.total) * 100) / 100;
  const onSite = billed.filter(d => d.dayRate).length;
  const minutes = total(days, d => d.minutes), miles = total(days, d => d.miles);
  const buys = days.flatMap(d => d.buys.filter(s => s.amount != null).map(s => ({ d, s })));
  const perHour = minutes ? (labor + gas) / (minutes / 60) : null;
  const w = v => (due ? (v / due) * 100 : 0).toFixed(2);
  return `
    <header class="ivs-intro" style="--s:0">
      <p class="eyebrow">Statement · ${esc(dateRange(I.from, I.to))}</p>
      <h3>${onSite} days of work.<br>Here is what it comes to.</h3>
    </header>
    <dl class="ivs-facts">
      <div style="--s:1"><dt>Days on site</dt><dd>${onSite}</dd></div>
      <div style="--s:2"><dt>Hours on the clock</dt><dd>${hrs(minutes)}</dd></div>
      <div style="--s:3"><dt>Miles driven</dt><dd>≈ ${num(Math.round(miles))}</dd></div>
      <div style="--s:4"><dt>Purchases</dt><dd>${buys.length}</dd></div>
    </dl>
    <dl class="ivs-rows">
      <div class="d" style="--s:5"><dt><i></i>Days on site<small>${onSite} × ${money(I.rates.day)}</small></dt><dd>${money(labor)}</dd></div>
      <div class="g" style="--s:6"><dt><i></i>Gas<small>${gasGroups(billed)}</small></dt><dd>${money(gas)}</dd></div>
      ${mat ? `<div class="m" style="--s:7"><dt><i></i>Materials<small>${plural(buys.length, 'purchase')} at receipt cost</small></dt><dd>${money(mat)}</dd></div>` : ''}
    </dl>
    ${buys.length ? `
    <details class="ivs-mats" style="--s:8">
      <summary><span>${icon('supply')} Every purchase, by day</span><b>${money(mat)}</b></summary>
      <table>
        <thead><tr><th scope="col">Day</th><th scope="col">Supplier</th><th scope="col">What</th><th scope="col">Amount</th></tr></thead>
        <tbody>${buys.map(({ d, s }) => `
          <tr><td><button type="button" data-goto="${d.i}">${d.date ? `${wday(d.date)} ${shortDate(d.date)}` : 'Undated'}</button></td>
          <td>${esc(s.place)}${s.city ? ` <small>${esc(s.city)}</small>` : ''}</td>
          <td>${esc(s.what)} <small>${esc([s.cash && 'Paid in cash', d.job.length && codeOfDay(I, d)].filter(Boolean).join(' · '))}</small></td>
          <td>${money(s.amount)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th scope="row" colspan="3">Materials</th><td>${money(mat)}</td></tr></tfoot>
      </table>
    </details>` : ''}
    <div class="ivs-split" aria-hidden="true" style="--s:9"><i class="d" style="--w:${w(labor)}%"></i><i class="g" style="--w:${w(gas)}%"></i>${mat ? `<i class="m" style="--w:${w(mat)}%"></i>` : ''}</div>
    <div class="ivs-total" style="--s:10">
      <p class="eyebrow">Balance due</p>
      <b class="ivs-due" id="ivs-due">${money(iv.shownDue || reduced.matches ? due : 0)}</b>
      ${perHour ? `<p class="ivs-frame">Labor and gas work out to about ${usdW(Math.round(perHour))} an hour on the clock. Materials pass through at cost.</p>` : ''}
    </div>
    <p class="ivs-nudge" style="--s:11"><span>Interest?</span></p>
    <div class="ivs-tools" style="--s:12"><button class="ivs-calc-btn" type="button" data-act="calc" aria-haspopup="dialog" aria-controls="calc">${icon('calc')} Try an hourly rate</button></div>`;
}
const codeOfDay = (I, d) => d.job.map(k => `Juniper ${k}`).join(' + ');
function paintStatement() {
  const el = $('#ivs');
  if (!el || !iv.data) return;
  el.innerHTML = statementHTML(iv.data);
  if (iv.shownDue) { el.classList.add('go'); tween($('#ivs-due'), dueVisible(), money, 1); }
}
function dueVisible() {
  const b = iv.data.days.filter(d => d.charge.settled == null);
  return Math.round(total(b, d => d.charge.total) * 100) / 100;
}

// the running total: follows the day in the middle of the screen
function paintMeter() {
  const I = iv.data;
  if (!I) return;
  const vis = I.days, n = iv.now;
  let upto, when;
  if (n === 'all') { upto = vis; when = `${shortDate(I.from)} – ${shortDate(I.to)}, all days`; }
  else if (n == null || n < 0) { upto = []; when = `From ${wday(I.from)}, ${shortDate(I.from)}`; }
  else { upto = vis.filter(d => d.i <= n); const d = I.days[n]; when = d.date ? `Through ${wday(d.date)}, ${shortDate(d.date)}` : `Through ${d.title}`; }
  const billed = upto.filter(d => d.charge.settled == null), full = vis.filter(d => d.charge.settled == null);
  const labor = total(billed, d => d.charge.day), gas = total(billed, d => d.charge.gas), billedMat = total(billed, d => d.charge.materials);
  const mat = total(upto, d => d.materials);
  const end = total(full, d => d.charge.total) || 1;
  $('#ivm-when').textContent = when;
  tween($('#ivm-due'), labor + gas + billedMat, usdW);
  tween($('#ivm-days'), billed.filter(d => d.dayRate).length, v => String(Math.round(v)));
  tween($('#ivm-hours'), total(upto, d => d.minutes) / 60, v => (Math.round(v * 10) / 10).toLocaleString('en-US'));
  tween($('#ivm-gas'), billed.filter(d => d.gas).length, v => String(Math.round(v)));
  tween($('#ivm-mat'), mat, v => usdW(v));
  const miles = total(upto, d => d.miles);
  tween($('#ivm-miles'), miles, v => `≈ ${Math.round(v).toLocaleString('en-US')}`);
  $('#ivm-mini').textContent = `≈ ${Math.round(miles).toLocaleString('en-US')} mi · ${usdW(mat)} materials`;
  $('#ivm-bar .d').style.width = `${(labor / end) * 100}%`;
  $('#ivm-bar .g').style.width = `${(gas / end) * 100}%`;
  $('#ivm-bar .m').style.width = `${(billedMat / end) * 100}%`;
  const pos = n === 'all' ? vis.length : n == null || n < 0 ? 0 : vis.findIndex(d => d.i === n) + 1;
  $('#ivm-of').textContent = pos === vis.length ? `All ${vis.length} days` : pos ? `Day ${pos} of ${vis.length}` : `${vis.length} days ahead`;
}
function setNow(n) {
  if (n === iv.now) return;
  iv.now = n;
  for (const el of $$('.iv-day', ivEl)) el.classList.toggle('is-now', Number(el.dataset.i) === n);
  for (const el of $$('.iv-cell.on, .iv-undated', ivEl)) el.classList.toggle('is-now', Number(el.dataset.goto) === n);
  paintMeter();
}
function watchInvoice() {
  iv.io?.disconnect();
  iv.io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const t = en.target;
      if (t.id === 'ivs') {
        setNow('all');
        if (!iv.shownDue) {
          iv.shownDue = true;
          t.classList.add('go');
          setTimeout(() => tween($('#ivs-due'), dueVisible(), money, 2200, 4), reduced.matches ? 0 : 1250);
        }
      } else if (t.classList.contains('iv-cal')) setNow(-1);
      else setNow(Number(t.dataset.i));
    }
  }, { rootMargin: '-44% 0px -50% 0px' });
  $$('.iv-day, .iv-cal, #ivs', ivEl).forEach(el => iv.io.observe(el));
}
// cards resolve as they arrive: the clock span sweeps in and the route draws itself
const dayReveal = new IntersectionObserver(entries => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); dayReveal.unobserve(en.target); }
}, { threshold: .08, rootMargin: '0px 0px -8% 0px' });

function setInvoiceFilter(f) {
  iv.filter = f;
  const I = iv.data;
  for (const el of $$('.iv-day', ivEl)) el.hidden = !shows(I.days[Number(el.dataset.i)]);
  for (const el of $$('.iv-cell.on, .iv-undated', ivEl)) el.classList.toggle('dim', !shows(I.days[Number(el.dataset.goto)]));
  const group = $('.iv-filter', ivEl);
  let active = null;
  for (const b of $$('button', group)) { const on = b.dataset.ivf === f; b.setAttribute('aria-pressed', String(on)); if (on) active = b; }
  placeInd(group, active);
}
function goDay(i) {
  const d = iv.data?.days[i];
  if (!d) return;
  if (!shows(d)) setInvoiceFilter('all');
  const el = $(`.iv-day[data-i="${i}"]`, ivEl);
  el.classList.add('in');
  el.scrollIntoView({ behavior: smooth(), block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

function renderInvoice(p) {
  const sec = $('#invoice'), I = invoiceOf(p);
  iv.data = I; iv.filter = 'all'; iv.now = null; iv.shownDue = false;
  iv.io?.disconnect();
  sec.hidden = !I;
  for (const t of $$('.tabs [data-tab="days"], .tabs [data-tab="statement"]')) t.hidden = !I;
  if (!I) { ivEl.innerHTML = ''; return; }
  const lp = I.lastPayment, codes = Object.keys(I.jobs).filter(k => I.byCode(k));
  // every photo and receipt, in story order, for the viewer
  const media = new Map();
  iv.media = [];
  for (const d of I.days) {
    const when = d.date ? `${wday(d.date)}, ${shortDate(d.date)}` : 'Undated';
    if (d.photo) { media.set(`p${d.i}`, iv.media.length); iv.media.push({ src: `assets/hub/${d.photo}.webp`, day: d.i, when: `${when}${d.photoAt ? ` · ${clock(d.photoAt)}` : ''}`, title: d.photoAt ? `End of the day: ${d.title}` : `${d.title} (from the build log)`, kind: 'Photo' }); }
    d.stops.forEach((s, k) => {
      if (!s.receiptFull) return;
      media.set(`r${d.i}:${k}`, iv.media.length);
      iv.media.push({ src: `assets/hub/${s.receiptFull}.webp`, day: d.i, when: `${when}${s.t ? ` · ${clock(s.t)}` : ''}`, title: `${s.place}${s.city ? `, ${s.city}` : ''} · ${s.amount != null ? money(s.amount) : 'No price'}${s.cash ? ' · cash' : ''}`, kind: 'Receipt' });
    });
  }
  ivEl.innerHTML = `
    <header class="ch-head reveal">
      <p class="ch-num">01 <span>Invoice</span></p>
      <h2 id="iv-title">Since the last payment,<br>one day at a time.</h2>
      <p class="ch-lede">${esc(I.rule)}${lp ? ` The last payment was ${esc(money(lp.amount))} on ${wday(lp.date)}, ${shortDate(lp.date)}.` : ''} Every day after it is here: where it went, how long it ran, and what it adds.</p>
    </header>
    <div class="panel iv-cal reveal">
      <div class="iv-cal-head">
        <div><p class="eyebrow">${esc(dateRange(I.from, I.to))}</p><h3>${plural(I.days.length, 'day')} on the record</h3></div>
        <div class="iv-filter" role="group" aria-label="Show days from">
          <button type="button" data-ivf="all" aria-pressed="true">All</button>
          ${codes.map(k => `<button type="button" data-ivf="${esc(k)}" aria-pressed="false" style="--c:${esc(jobAccent(I.byCode(k)))}"><i></i>${esc(k)}<span> · ${esc(I.byCode(k).short ?? I.byCode(k).title)}</span></button>`).join('')}
        </div>
      </div>
      ${calendar(I)}
      <p class="iv-legend"><span><i class="lg-day"></i>Day on site</span><span><i class="lg-gas"></i>Gas day</span><span><i class="lg-trip"></i>Supply run only</span></p>
    </div>
    <div class="iv-layout">
      <aside class="iv-meter glass" aria-label="Running total">
        <p class="eyebrow" id="ivm-when"></p>
        <div class="ivm-due"><b id="ivm-due">$0</b><small id="ivm-of"></small></div>
        <p class="ivm-mini" id="ivm-mini"></p>
        <div class="ivm-bar" id="ivm-bar" aria-hidden="true"><i class="d"></i><i class="g"></i><i class="m"></i></div>
        <dl class="ivm-stats">
          <div><dt>Days</dt><dd id="ivm-days">0</dd></div>
          <div><dt>Hours</dt><dd id="ivm-hours">0</dd></div>
          <div><dt>Gas days</dt><dd id="ivm-gas">0</dd></div>
          <div><dt>Miles</dt><dd id="ivm-miles">≈ 0</dd></div>
          <div class="wide"><dt>${I.materialsBilled ? 'Materials' : 'Receipts'}</dt><dd id="ivm-mat">$0</dd></div>
        </dl>
        <p class="ivm-note"><span class="k d"></span>Days <span class="k g"></span>Gas${I.materialsBilled ? ' <span class="k m"></span>Materials' : ''}<br>Miles are estimates from each stop’s town</p>
      </aside>
      <ol class="iv-days">${I.days.map(d => dayCard(d, I, media)).join('')}</ol>
    </div>
    <div class="panel iv-statement reveal" id="ivs"></div>`;
  paintStatement();
  const group = $('.iv-filter', ivEl);
  ensureInd(group);
  requestAnimationFrame(() => placeInd(group, group.querySelector('[aria-pressed="true"]')));
  $$('.reveal', ivEl).forEach(el => revealer.observe(el));
  $$('.iv-day', ivEl).forEach(el => dayReveal.observe(el));
  watchInvoice();
  $('.iv-cal', ivEl).dataset.tab = 'days'; $('.iv-layout', ivEl).dataset.tab = 'days'; $('#ivs').dataset.tab = 'statement';
  [$('.iv-cal', ivEl), $('.iv-layout', ivEl), $('#ivs')].forEach(el => tabWatch.observe(el));
  setNow(-1);
}

// ------------------------------------------------------------ chapter 04: the schedule
function renderSchedule() {
  const all = projects.flatMap(p => p.jobs);
  const R = rollup({ jobs: all });
  const priced = projects.map(p => ({ balance: dueOf(p) })).filter(b => b.balance != null);
  const sum = (label, value, note = '') => `<div class="sum"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
  const items = [sum('Projects', projects.length), sum('Jobs', R.jobs, `${R.done} done · ${R.open} open`)];
  const missing = [];
  const add = (label, f, fmt, word) => (f.sum == null ? missing.push(word) : items.push(sum(label, fmt(f.sum), `${f.n} of ${f.of} jobs recorded`)));
  add('Days on site', R.days, num, 'days on site');
  add('Hours on site', R.hours, num, 'hours');
  add('Miles', R.miles, num, 'miles');
  add('Materials', R.materials, moneyShort, 'materials');
  if (priced.length) items.push(sum('Balance due', moneyShort(priced.reduce((t, b) => t + b.balance, 0)), `${priced.length} of ${projects.length} projects priced`)); else missing.push('balances');
  els.sums.innerHTML = items.join('') + (missing.length ? `<p class="sum-note">${esc(listWords(missing).replace(/^./, c => c.toUpperCase()))} not recorded yet</p>` : '');
  const t = timeline(projects.map(p => ({ p, jobs: p.jobs })));
  els.tl.setAttribute('style', t.style ?? '');
  els.tl.innerHTML = t.html;
}

// ------------------------------------------------------------ chapter 05: the record, in four foundations
function recordTasks() { return tasks.filter(t => rec.project === 'all' || t.p.id === rec.project); }
function renderRecordControls() {
  $('#rec-project').innerHTML = [`<option value="all">All projects</option>`, ...projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)].join('');
}
function renderRecord() {
  const list = recordTasks();
  const tabs = $('#ftabs');
  tabs.innerHTML = [...foundations.values()].map(f => {
    const n = list.filter(t => t.f === f.id && !t.upcoming).length;
    return `<button type="button" role="tab" id="ft-${esc(f.id)}" data-f="${esc(f.id)}" aria-selected="${rec.f === f.id}" aria-controls="rec-body" tabindex="${rec.f === f.id ? 0 : -1}">${esc(f.name)} <em>${n}</em></button>`;
  }).join('');
  ensureInd(tabs);
  requestAnimationFrame(() => placeInd(tabs, tabs.querySelector('[aria-selected="true"]')));
  const done = list.filter(t => !t.upcoming);
  const supply = done.filter(t => t.kind === 'supply').length;
  $('#rec-lede').textContent = `${plural(done.length - supply, 'task')} and ${plural(supply, 'supply run')} on file, consolidated under four foundations. Pick one to see everything in it.`;
  $('#fdesc').textContent = F(rec.f).desc;
  const body = $('#rec-body');
  const inF = list.filter(t => t.f === rec.f);
  if (!inF.length) { body.innerHTML = '<p class="empty-note">Nothing on file here yet.</p>'; enter(body); return; }
  if (rec.f === 'supply') {
    const rows = [...inF].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const total = rows.reduce((t, x) => t + (x.amount ?? 0), 0);
    body.innerHTML = `<div class="panel" style="padding:0"><div class="sup-wrap"><table class="sup">
      <thead><tr><th>Date</th><th>Supplier</th><th>What</th><th>For</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows.map(x => `<tr data-ti="${tasks.indexOf(x)}" tabindex="0"><td>${esc(shortDate(x.date))}</td><td>${esc(x.t)}</td><td>${esc(x.note)}</td><td>${esc(x.j.title)}${x.j.title !== x.p.name ? `<small>${esc(x.p.name)}</small>` : ''}</td><td class="r">${x.amount == null ? '' : money(x.amount)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">${plural(rows.length, 'stop')} · ${plural(rows.filter(x => x.amount != null).length, 'priced purchase')}</td><td class="r">${money(Math.round(total * 100) / 100)}</td></tr></tfoot>
    </table></div></div>`;
    enter(body);
    return;
  }
  const byJob = [];
  for (const t of inF) { let g = byJob.find(x => x.j === t.j); if (!g) byJob.push(g = { j: t.j, list: [] }); g.list.push(t); }
  body.innerHTML = byJob.map(({ j, list: tl }, k) => `
    <details class="tj" ${k < 2 ? 'open' : ''} style="--c:${esc(j.accent ?? '#3ce04b')}">
      <summary><span class="tj-title"><b>${esc(j.title)}</b><small>${esc(j.project.name)} · ${esc(j.start ? dateRange(j.start, j.end) : 'No date recorded')}</small></span><span class="tj-count">${tl.filter(t => !t.upcoming).length || tl.length}</span><span class="tj-chev" aria-hidden="true"></span></summary>
      <ul class="tk-list">${tl.map(t => `<li><button class="tk${t.upcoming ? ' next' : ''}" type="button" data-ti="${tasks.indexOf(t)}">${icon(t.upcoming ? 'next' : 'check')}<span class="tk-t"><b>${esc(t.t)}</b><small>${esc([trade(t.trade), t.img ? 'Photo' : ''].filter(Boolean).join(' · '))}</small></span><span class="tk-d">${t.upcoming ? 'Planned' : esc(t.date ? shortDate(t.date) : 'No date')}</span></button></li>`).join('')}</ul>
    </details>`).join('');
  enter(body);
}
function setRecord(next) { Object.assign(rec, next); $('#rec-project').value = rec.project; renderRecord(); }
function goRecord(next) { if (next) setRecord(next); $('#record').scrollIntoView({ behavior: smooth(), block: 'start' }); }
function runTask(t, opener) { if (t.kind === 'supply') openLedger(t.p, opener, t.j.id); else openViewer(t.j, t.k, opener); }

// ------------------------------------------------------------ the job sheet
const sheet = $('#sheet');
let sheetJob = null;
function costChips(j, date) {
  if (!date) return '';
  const c = (j.costs?.materials ?? []).filter(m => m.date === date).map(m => `<span class="cost">${money(m.amount)} · ${esc(m.vendor)}</span>`);
  const ch = (contractOf(j.project).changes ?? []).filter(x => x.date === date && (!x.job || x.job === j.id)).map(x => `<span class="cost change">Change ${x.amount >= 0 ? '+' : ''}${money(x.amount)}</span>`);
  return [...c, ...ch].join('');
}
function openSheet(j, opener) {
  sheetJob = j;
  const p = j.project, m = jobMetrics(j), c = jobCosts(j), s = STATUS[j.status], f = F(j.foundation);
  const idx = p.jobs.indexOf(j), prev = p.jobs[idx - 1], next = p.jobs[idx + 1];
  const jt = j.timeline.flatMap(e => (e.tasks ?? []).map(t => ({ ...t, upcoming: t.upcoming || e.upcoming })));
  const mats = j.costs?.materials ?? [];
  const shownM = [], missingM = [];
  const addM = (label, v, fmt, word) => (v == null ? missingM.push(word) : shownM.push(metric(label, fmt(v))));
  addM('Days on site', m.days, num, 'days on site');
  addM('Hours', m.hours, num, 'hours');
  addM('Miles', m.miles, num, 'miles');
  addM('Materials', c.materials, money, 'materials');
  addM('Labor', c.labor, money, 'labor');
  $('#sheet-body').innerHTML = `
    <header class="sh-hero">
      <img src="${esc(jobImg(j, 'hero-L'))}" alt="" style="object-position:${esc(j.focus ?? '50% 50%')}">
      <div>
        <p class="eyebrow">${esc(p.name)} · Job ${idx + 1} of ${p.jobs.length}</p>
        <h2 id="sheet-title">${esc(j.title)}</h2>
        <p class="row"><span class="chip ${s.cls}"><i></i>${esc(j.statusLabel ?? s.label)}</span>${icon(f.id)}<span>${esc(f.name)} · ${esc(dateRange(j.start, j.end))}</span></p>
      </div>
    </header>
    <div class="sh-body">
      <p class="sh-summary">${esc(j.summary)}</p>
      <div class="sh-metrics">${shownM.join('')}${(j.facts ?? []).map(x => metric(esc(x.label), esc(x.value), esc(x.note ?? ''))).join('')}</div>
      ${missingM.length ? `<p class="pending-note" style="margin-top:-4px">${esc(listWords(missingM).replace(/^./, ch => ch.toUpperCase()))} not recorded yet${m.note ? ` · ${esc(m.note)}` : ''}</p>` : ''}
      <section>
        <div class="panel-head"><h3>Updates</h3><p>${plural(j.timeline.length, 'entry', 'entries')}, oldest first</p></div>
        <ol class="strip">${j.timeline.map((e, k) => `
          <li><button class="up${e.milestone ? ' milestone' : ''}${e.upcoming ? ' upcoming' : ''}" type="button" data-k="${k}" aria-label="${esc(whenLabel(e))}: ${esc(e.title)}">
            <span class="up-img${shot(j, e) ? '' : ' noimg'}">${shot(j, e) ? `<img src="${esc(shot(j, e))}" alt="" loading="lazy" decoding="async" width="720" height="450">` : icon(e.upcoming ? 'next' : e.milestone ? 'check' : f.id)}
              ${e.milestone ? `<b class="flag done">${icon('check')}Done</b>` : e.upcoming ? '<b class="flag next">Next</b>' : ''}</span>
            <span class="up-body"><span class="up-when">${esc(whenLabel(e))}</span><span class="up-title">${esc(e.title)}</span>${costChips(j, e.date) ? `<span class="chips">${costChips(j, e.date)}</span>` : ''}</span>
          </button></li>`).join('')}
        </ol>
      </section>
      <div class="sh-grid">
        <div class="sh-panel"><h3>Tasks · ${jt.filter(t => !t.upcoming).length} done</h3>
          ${jt.length ? `<ul class="checks${jt.every(t => t.upcoming) ? ' next' : ''}">${jt.map(t => `<li>${icon(t.upcoming ? 'next' : 'check')}<span>${esc(t.t)}${t.trade ? `<small>${esc(trade(t.trade))}</small>` : ''}</span></li>`).join('')}</ul>` : '<p class="ledger-note">No tasks logged.</p>'}
        </div>
        <div class="sh-panel"><h3>Costs</h3>
          ${mats.length ? `<ul class="checks">${mats.map(x => `<li>${icon('supply')}<span>${esc(x.vendor)} · ${money(x.amount)}<small>${esc(shortDate(x.date))} · ${esc(x.item)}</small></span></li>`).join('')}</ul>` : '<p class="ledger-note">No purchases recorded for this job yet.</p>'}
          <div class="lg-foot"><button class="btn glass small" type="button" data-act="job-ledger">${icon('ledger')} Ledger</button></div>
        </div>
      </div>
      ${j.objectives?.length || j.open?.length ? `<div class="sh-grid">
        ${j.objectives?.length ? `<div class="sh-panel"><h3>Objectives</h3><ul class="checks${j.status === 'planning' ? ' next' : ''}">${j.objectives.map(o => `<li>${icon(j.status === 'planning' ? 'next' : 'check')}<span>${esc(o)}</span></li>`).join('')}</ul></div>` : ''}
        ${j.open?.length ? `<div class="sh-panel"><h3>Not confirmed yet</h3><ul class="checks open">${j.open.map(o => `<li>${icon('open')}<span>${esc(o)}</span></li>`).join('')}</ul></div>` : ''}
      </div>` : ''}
      <nav class="sh-nav" aria-label="Other jobs in ${esc(p.name)}">
        ${prev ? `<button class="btn glass small" type="button" data-sheet="${esc(prev.id)}">‹ ${esc(prev.title)}</button>` : ''}
        <span class="sp"></span>
        ${(j.links ?? p.links ?? []).map(l => `<a class="btn glass small" href="${esc(l.href)}">${esc(l.label)} ${icon('external')}</a>`).join('')}
        ${next ? `<button class="btn glass small" type="button" data-sheet="${esc(next.id)}">${esc(next.title)} ›</button>` : ''}
      </nav>
    </div>`;
  if (!sheet.open) { sheet.showModal(); sheet._opener = opener; } else enter($('#sheet-body'));
  sheet.scrollTop = 0;
}
sheet.addEventListener('click', ev => { if (ev.target === sheet) sheet.close(); });
sheet.addEventListener('close', () => sheet._opener?.focus?.({ preventScroll: true }));

// ------------------------------------------------------------ the update viewer
const viewer = $('#viewer');
let vJob = null, vk = 0;
function openViewer(j, k, opener) {
  vJob = j; vk = Math.max(0, k);
  paintViewer();
  if (!viewer.open) { viewer.showModal(); viewer._opener = opener; }
}
function paintViewer() {
  const j = vJob, e = j.timeline[vk], src = shot(j, e);
  $('#viewer-media').innerHTML = src
    ? `<img src="${esc(src)}" alt="${esc(e.title)}" width="720" height="450">`
    : `<span class="noimg${e.milestone ? ' milestone' : ''}${e.upcoming ? ' upcoming' : ''}">${icon(e.upcoming ? 'next' : e.milestone ? 'check' : j.foundation)}</span>`;
  enter($('#viewer-media').firstElementChild);
  $('#viewer-when').textContent = `${j.project.name} · ${j.title} · ${whenLabel(e)}`;
  $('#viewer-title').textContent = e.title;
  $('#viewer-note').textContent = e.note;
  $('#viewer-tasks').innerHTML = e.tasks?.length ? `<ul class="checks${e.upcoming ? ' next' : ''}">${e.tasks.map(t => `<li>${icon(e.upcoming || t.upcoming ? 'next' : 'check')}<span>${esc(t.t)}<small>${esc([F(t.f).name, trade(t.trade)].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ul>` : '';
  $('#viewer-chips').innerHTML = costChips(j, e.date) ? `<div class="chips">${costChips(j, e.date)}</div>` : '';
  $('#viewer-pos').textContent = `${vk + 1} / ${j.timeline.length}`;
  $('#viewer-prev').disabled = vk === 0;
  $('#viewer-next').disabled = vk === j.timeline.length - 1;
  $('#viewer-job').hidden = sheet.open && sheetJob === j;
}
$('#viewer-prev').addEventListener('click', () => { if (vk > 0) { vk--; paintViewer(); } });
$('#viewer-next').addEventListener('click', () => { if (vk < vJob.timeline.length - 1) { vk++; paintViewer(); } });
$('#viewer-job').addEventListener('click', () => { const j = vJob; viewer.close(); openSheet(j); });
viewer.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowLeft') { ev.preventDefault(); $('#viewer-prev').click(); }
  if (ev.key === 'ArrowRight') { ev.preventDefault(); $('#viewer-next').click(); }
});
viewer.addEventListener('click', ev => { if (ev.target === viewer) viewer.close(); });
viewer.addEventListener('close', () => viewer._opener?.focus?.({ preventScroll: true }));

// ------------------------------------------------------------ the ledger drawer
const drawer = $('#ledger');
const openDrawer = wireDrawer(drawer, null, () => { if (projects[cur] && location.hash.endsWith('/ledger')) history.replaceState(null, '', `#/${projects[cur].id}`); });
function openLedger(p, opener, jobId = null) {
  renderLedger(p, $('#ledger-body'), { jobId });
  openDrawer(opener);
  if (!jobId) history.replaceState(null, '', `#/${p.id}/ledger`);
}

// ------------------------------------------------------------ search (⌘K or /)
const palette = $('#palette'), palQ = $('#pal-q'), palList = $('#pal-list');
let palAll = [], palShown = [], palActive = 0;
function buildPalette() {
  palAll = [
    ...projects.map(p => ({ type: 'Project', title: p.name, sub: `${plural(p.jobs.length, 'job')} · ${p.type ?? ''}`, img: jobImg(keyJob(p), 'tile'), art: p.jobs.length === 1 && !!keyJob(p).art, run: () => { select(projects.indexOf(p)); scrollTo({ top: 0, behavior: smooth() }); } })),
    ...projects.flatMap(p => p.jobs.map(j => ({ type: 'Job', title: j.title, sub: `${p.name} · ${F(j.foundation).name} · ${span(j)}`, img: jobImg(j, 'tile'), art: !!j.art, run: () => { if (projects[cur] !== p) select(projects.indexOf(p)); openSheet(j); } }))),
    ...projects.flatMap(p => { const I = invoiceOf(p); return I ? [
      { type: 'Chapter', title: 'Invoice', sub: `${p.name} · ${shortDate(I.from)} – ${shortDate(I.to)} · ${money(I.due)} due`, ico: 'receipt', run: () => { if (projects[cur] !== p) select(projects.indexOf(p)); $('#invoice').scrollIntoView({ behavior: smooth() }); } },
      ...I.days.map(d => ({ type: 'Invoice day', title: `${d.date ? `${wday(d.date)} ${shortDate(d.date)}` : 'Undated'} · ${d.title}`, sub: `${d.charge.settled != null ? `Settled ${money(d.charge.settled)}` : money(d.charge.total)} · ${[...new Set(d.stops.map(s => s.place))].join(', ')}`, ico: 'receipt', task: true, run: () => { if (projects[cur] !== p) select(projects.indexOf(p)); goDay(d.i); } })),
    ] : []; }),
    ...tasks.map(t => ({ type: t.kind === 'supply' ? 'Supply run' : 'Task', title: t.t, sub: `${where(t.j, t.p)} · ${t.upcoming ? 'Planned' : t.date ? shortDate(t.date) : 'No date'}${t.amount != null ? ` · ${money(t.amount)}` : ''}`, ico: t.f, task: true, run: () => runTask(t) })),
  ];
}
function paintPalette() {
  const q = palQ.value.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  palShown = (q ? palAll.filter(x => words.every(w => `${x.title} ${x.sub} ${x.type}`.toLowerCase().includes(w))) : palAll.filter(x => !x.task)).slice(0, 40);
  palActive = Math.min(palActive, Math.max(0, palShown.length - 1));
  palList.innerHTML = palShown.length ? palShown.map((x, k) => `
    <li class="pal-item" role="option" id="pal-${k}" data-k="${k}" aria-selected="${k === palActive}">
      <span class="pi">${x.img ? `<img src="${esc(x.img)}" alt="" style="${x.art ? 'transform:scale(1.8)' : ''}">` : icon(x.ico)}</span>
      <span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><em>${esc(x.type)}</em>
    </li>`).join('') : '<li class="empty-note">Nothing found.</li>';
  palQ.setAttribute('aria-activedescendant', palShown.length ? `pal-${palActive}` : '');
}
function openPalette() {
  if (palette.open) return;
  palQ.value = '';
  palActive = 0;
  paintPalette();
  palette.showModal();
  palQ.focus();
}
function runPalette(k) { const x = palShown[k]; if (!x) return; palette.close(); setTimeout(x.run, 30); }
palQ.addEventListener('input', () => { palActive = 0; paintPalette(); });
palQ.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    palActive = (palActive + (ev.key === 'ArrowDown' ? 1 : -1) + palShown.length) % Math.max(1, palShown.length);
    paintPalette();
    $(`#pal-${palActive}`)?.scrollIntoView({ block: 'nearest' });
  } else if (ev.key === 'Enter') { ev.preventDefault(); runPalette(palActive); }
});
palList.addEventListener('click', ev => { const li = ev.target.closest('.pal-item'); if (li) runPalette(Number(li.dataset.k)); });
palList.addEventListener('pointermove', ev => {
  const li = ev.target.closest('.pal-item');
  if (li && Number(li.dataset.k) !== palActive) { palActive = Number(li.dataset.k); for (const x of $$('.pal-item', palList)) x.setAttribute('aria-selected', String(x === li)); }
});
palette.addEventListener('click', ev => { if (ev.target === palette) palette.close(); });
$('#search-btn').addEventListener('click', openPalette);

// ------------------------------------------------------------ input
function onKey(ev) {
  const typing = ev.target.closest?.('input, textarea, select');
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openPalette(); return; }
  if (ev.key === '/' && !typing && !document.querySelector('dialog[open]')) { ev.preventDefault(); openPalette(); return; }
  if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey || typing || document.querySelector('dialog[open]')) return;
  const t = ev.target;
  if (t.closest?.('#ftabs') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
    ev.preventDefault();
    const ids = [...foundations.keys()], k = ids.indexOf(rec.f) + (ev.key === 'ArrowRight' ? 1 : -1);
    setRecord({ f: ids[(k + ids.length) % ids.length] });
    $(`#ft-${rec.f}`)?.focus();
    return;
  }
  const inRail = !!t.closest?.('#rail');
  if (!inRail && !(scrollY < innerHeight * .55 && (t === document.body || t.closest?.('.hero')))) return;
  const keys = { ArrowRight: 1, ArrowLeft: -1 };
  if (ev.key in keys) { ev.preventDefault(); select(cur + keys[ev.key], { focus: true }); }
  else if (inRail && ev.key === 'Home') { ev.preventDefault(); select(0, { focus: true }); }
  else if (inRail && ev.key === 'End') { ev.preventDefault(); select(projects.length - 1, { focus: true }); }
  else if (inRail && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openProject(); }
  else if (inRail && ev.key === 'ArrowDown') { ev.preventDefault(); els.hero.querySelector('.btn')?.focus(); }
  else if (t.closest?.('.hero-actions') && ev.key === 'ArrowUp') { ev.preventDefault(); tiles()[cur].focus(); }
}
const openProject = () => $('#project').scrollIntoView({ behavior: smooth(), block: 'start' });
const jobById = id => projects.flatMap(p => p.jobs).find(j => j.id === id);

document.addEventListener('keydown', onKey);
els.rail.addEventListener('click', ev => {
  const t = ev.target.closest('.tile');
  if (!t) return;
  const i = Number(t.dataset.i);
  if (i === cur) openProject(); else select(i, { focus: true });
});
document.addEventListener('click', ev => {
  const act = ev.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'open') openProject();
    else if (a === 'ledger') openLedger(projects[cur], act);
    else if (a === 'job-ledger' && sheetJob) openLedger(sheetJob.project, act, sheetJob.id);
    else if (a === 'prev') select(cur - 1);
    else if (a === 'next') select(cur + 1);
    else if (a === 'record') goRecord({ project: projects[cur].id });
    else if (a === 'invoice') $('#invoice').scrollIntoView({ behavior: smooth(), block: 'start' });
    else if (a === 'calc') openCalc(act);
    return;
  }
  const md = ev.target.closest('[data-media]');
  if (md) { openLightbox(Number(md.dataset.media), md); return; }
  const go = ev.target.closest('[data-goto]');
  if (go) { goDay(Number(go.dataset.goto)); return; }
  const ivf = ev.target.closest('[data-ivf]');
  if (ivf) { setInvoiceFilter(ivf.dataset.ivf); return; }
  const sj = ev.target.closest('[data-sheet]');
  if (sj) { openSheet(jobById(sj.dataset.sheet)); return; }
  const up = ev.target.closest('.up');
  if (up && sheetJob) { openViewer(sheetJob, Number(up.dataset.k), up); return; }
  const jobEl = ev.target.closest('.jc, .tl-row.job');
  if (jobEl) { openSheet(jobById(jobEl.dataset.job), jobEl); return; }
  const head = ev.target.closest('.tl-row.head');
  if (head) { select(projects.findIndex(p => p.id === head.dataset.pid)); scrollTo({ top: 0, behavior: smooth() }); return; }
  const rf = ev.target.closest('[data-rf]');
  if (rf) { goRecord({ project: projects[cur].id, f: rf.dataset.rf }); return; }
  const ft = ev.target.closest('#ftabs [data-f]');
  if (ft) { setRecord({ f: ft.dataset.f }); return; }
  const ti = ev.target.closest('[data-ti]');
  if (ti) runTask(tasks[Number(ti.dataset.ti)], ti);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.matches?.('tr[data-ti]')) { ev.preventDefault(); ev.target.click(); }
});
$('#rec-project').addEventListener('change', ev => setRecord({ project: ev.target.value }));

// ------------------------------------------------------------ chapter tabs follow the reader; the pill slides between them
const nav = $('.tabs');
const navIcons = { home: 'grid', days: 'calendar', statement: 'receipt', schedule: 'calendar', record: 'list', premise: 'spark' };
for (const a of $$('a', nav)) a.insertAdjacentHTML('afterbegin', icon(navIcons[a.dataset.tab]));
ensureInd(nav);
function setTab(id) {
  let active = null;
  for (const t of $$('a', nav)) { const on = t.dataset.tab === id; t.setAttribute('aria-current', String(on)); if (on) active = t; }
  placeInd(nav, active);
}
const tabWatch = new IntersectionObserver(entries => {
  for (const en of entries) if (en.isIntersecting) setTab(en.target.dataset.tab ?? (en.target.id === 'project' ? 'home' : en.target.id));
}, { rootMargin: '-45% 0px -50% 0px' });
['home', 'project', 'schedule', 'record', 'premise'].forEach(id => tabWatch.observe(document.getElementById(id)));
addEventListener('resize', () => {
  placeInd(nav, nav.querySelector('[aria-current="true"]'));
  const ft = $('#ftabs');
  placeInd(ft, ft.querySelector('[aria-selected="true"]'));
  const ivg = $('.iv-filter');
  if (ivg) placeInd(ivg, ivg.querySelector('[aria-pressed="true"]'));
}, { passive: true });

// sections resolve into place once as they arrive
const revealer = new IntersectionObserver(entries => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); revealer.unobserve(en.target); }
}, { threshold: .12 });
$$('.reveal').forEach(el => revealer.observe(el));

// the environment eases back and dims into deep space as the page moves into detail
let rafScroll = 0;
function onScroll() {
  if (rafScroll) return;
  rafScroll = requestAnimationFrame(() => {
    rafScroll = 0;
    const y = scrollY, h = innerHeight;
    document.documentElement.style.setProperty('--dim', Math.min(.9, Math.max(0, (y - h * .15) / (h * .85))).toFixed(3));
    if (!reduced.matches) for (const img of els.bg) img.style.setProperty('--py', `${(-y * .07).toFixed(1)}px`);
  });
}
addEventListener('scroll', onScroll, { passive: true });
portrait.addEventListener('change', () => { if (rot.list.length) showBackdrop(rot.list[rot.k]); });
new IntersectionObserver(([en]) => { homeInView = en.isIntersecting; }, { threshold: .3 }).observe($('#home'));

// ------------------------------------------------------------ deep space: slow, sparse motes behind the glass
function space() {
  const c = $('#space'), ctx = c.getContext('2d');
  let w = 0, h = 0, dpr = 1, motes = [], raf = 0, last = 0;
  const seed = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = c.clientWidth; h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const n = Math.round(Math.min(110, (w * h) / 16000));
    motes = Array.from({ length: n }, () => {
      const z = .25 + Math.random() * .75;
      return { x: Math.random() * w, y: Math.random() * h, z, r: .5 + z * 1.1, vx: (Math.random() - .5) * 4 * z, vy: -(1.5 + z * 5), tw: Math.random() * Math.PI * 2 };
    });
  };
  const draw = dt => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sy = scrollY * .04;
    for (const m of motes) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.tw += dt * (.6 + m.z);
      if (m.y < -8) { m.y = h + 8; m.x = Math.random() * w; }
      if (m.x < -8) m.x = w + 8; else if (m.x > w + 8) m.x = -8;
      const y = ((m.y - sy * m.z) % (h + 16) + h + 16) % (h + 16) - 8;
      ctx.globalAlpha = (.18 + .5 * m.z) * (.7 + .3 * Math.sin(m.tw));
      ctx.beginPath();
      ctx.arc(m.x, y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = '#e8f3ea';
      ctx.fill();
    }
  };
  const loop = t => {
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0;
    last = t;
    draw(dt);
    raf = requestAnimationFrame(loop);
  };
  seed();
  addEventListener('resize', () => { seed(); if (reduced.matches) draw(0); }, { passive: true });
  if (reduced.matches) { draw(0); return; }
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf); last = 0;
    if (!document.hidden) raf = requestAnimationFrame(loop);
  });
}

// ------------------------------------------------------------ the premise, once per visit
function intro() {
  const el = $('#intro');
  const seen = document.documentElement.classList.contains('seen') || reduced.matches;
  if (seen) { el.remove(); return Promise.resolve(); }
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add('done');
      try { sessionStorage.setItem('hub-intro', '1'); } catch { /* private mode */ }
      ['click', 'keydown', 'wheel', 'touchstart'].forEach(e => removeEventListener(e, finish));
      setTimeout(() => el.remove(), 800);
      resolve();
    };
    ['click', 'keydown', 'wheel', 'touchstart'].forEach(e => addEventListener(e, finish, { passive: true }));
    setTimeout(finish, 2300);
  });
}

// ------------------------------------------------------------ start
function route() {
  const m = location.hash.match(/^#\/([\w-]+)(\/ledger)?$/);
  const i = m ? projects.findIndex(p => p.id === m[1]) : -1;
  return { i: i >= 0 ? i : 0, ledger: !!(m && m[2]) };
}
addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#/') || !projects.length) return;
  const r = route();
  select(r.i, { push: false });
  if (location.hash === '#/') scrollTo({ top: 0, behavior: smooth() });
  if (r.ledger) openLedger(projects[r.i]);
});
const introDone = intro();
space();
loadHub().then(async d => {
  data = d;
  for (const f of d.foundations ?? []) foundations.set(f.id, f);
  if (!foundations.has(rec.f)) rec.f = foundations.keys().next().value;
  projects = [...d.projects].sort((a, b) => (b.id === d.featured) - (a.id === d.featured) || (a.rank ?? 99) - (b.rank ?? 99));
  tasks = allTasks(d);
  renderRail();
  renderTelemetry();
  renderSchedule();
  renderRecordControls();
  renderRecord();
  buildPalette();
  const r = route();
  select(r.i, { push: false });
  if (r.ledger) openLedger(projects[r.i]);
  onScroll();
  setTab('home');
  await introDone;
  enter(els.rail);
}).catch(err => {
  els.hero.innerHTML = '<p class="hero-summary">The Project Hub could not load its data. Refresh to try again.</p>';
  console.error(err);
});
