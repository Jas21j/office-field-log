// Project data, roll-ups and the ledger, shared by the Project Hub (index.html) and the office story page.
// Shape of data/projects.json: projects → jobs → timeline entries → tasks (each task filed under a foundation).
// Money and effort live in two places: a job's `metrics` (days on site, hours, miles) and `costs` (materials,
// labor), and the project's `ledger` (agreed price, changes, payments) — the part a passcode can lock later.
// null means "not recorded yet": it is shown as such and never guessed or counted as zero.

const DATA_URL = new URL('data/projects.json', import.meta.url);
const MANIFEST_URL = new URL('assets/hub/manifest.json', import.meta.url);
let cache = null;
export function loadHub() {
  cache ??= Promise.all([
    fetch(`${DATA_URL}?v=20261127`).then(r => { if (!r.ok) throw new Error(`projects.json ${r.status}`); return r.json(); }),
    fetch(`${MANIFEST_URL}?v=20261127`).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
  ]).then(([data, manifest]) => {
    // archived projects stay in the file (nothing is deleted) but leave the hub
    data.archived = data.projects.filter(p => p.archived);
    data.projects = data.projects.filter(p => !p.archived);
    for (const p of data.projects) {
      for (const j of p.jobs) { j.accent ??= manifest[j.id]?.accent; j.project = p; }
      p.accent ??= (p.jobs.find(j => j.id === p.keyJob) ?? p.jobs[0]).accent;
    }
    return data;
  });
  return cache;
}

// ------------------------------------------------------------ formatting
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const PENDING = 'Not recorded';
export const money = n => (n == null ? PENDING : usd.format(n));
export const moneyShort = n => (n == null ? '—' : n >= 1000 ? usd0.format(n) : usd.format(n));
export const num = n => (n == null ? '—' : n.toLocaleString('en-US'));
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = iso => iso.split('-').map(Number);
export const shortDate = iso => (iso ? `${MONTHS[parts(iso)[1] - 1]} ${parts(iso)[2]}` : 'No date');
export function dateRange(a, b, ongoing = false) {
  if (!a) return 'No date recorded';
  if (!b || ongoing) return `${shortDate(a)}, ${parts(a)[0]} – ongoing`;
  if (a === b) return `${shortDate(a)}, ${parts(a)[0]}`;
  const [ya, ma] = parts(a), [yb, mb] = parts(b);
  if (ya === yb && ma === mb) return `${shortDate(a)}–${parts(b)[2]}, ${yb}`;
  return ya === yb ? `${shortDate(a)} – ${shortDate(b)}, ${yb}` : `${shortDate(a)}, ${ya} – ${shortDate(b)}, ${yb}`;
}
export const calendarDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
export function clock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
const round2 = n => Math.round(n * 100) / 100;
const sum = list => round2(list.reduce((t, x) => t + (x.amount ?? 0), 0));

// ------------------------------------------------------------ status
export const STATUS = {
  active: { label: 'In progress', cls: 'live', rank: 0 },
  planning: { label: 'Planning', cls: 'plan', rank: 1 },
  complete: { label: 'Complete', cls: 'ok', rank: 2 },
  reported: { label: 'Owner reported', short: 'Reported', cls: 'ok', rank: 3 },
};
export function projectStatus(p) {
  const s = p.jobs.map(j => j.status);
  return s.includes('active') ? 'active' : s.includes('planning') && s.every(x => x === 'planning') ? 'planning' : s.includes('planning') ? 'active' : 'complete';
}

// ------------------------------------------------------------ a job's practical numbers
export function jobCosts(j) {
  const c = j.costs ?? {};
  const mats = c.materials ?? [];
  return { materials: mats.length ? sum(mats) : null, purchases: mats.length, labor: c.labor ?? null, agreed: c.agreed ?? null };
}
export function jobMetrics(j) {
  const m = j.metrics ?? {};
  return { days: m.daysOnSite ?? null, hours: m.hours ?? null, miles: m.miles ?? null, note: m.note ?? '' };
}

// ------------------------------------------------------------ a project's roll-up: sums only over jobs that recorded the value
export function rollup(p) {
  const jobs = p.jobs;
  const field = get => {
    const vals = jobs.map(get).filter(v => v != null);
    return { sum: vals.length ? round2(vals.reduce((a, b) => a + b, 0)) : null, n: vals.length, of: jobs.length };
  };
  const dated = jobs.filter(j => j.start);
  const starts = dated.map(j => j.start).sort();
  const ends = dated.map(j => j.end).filter(Boolean).sort();
  const ongoing = dated.some(j => !j.end);
  return {
    jobs: jobs.length,
    done: jobs.filter(j => j.status === 'complete' || j.status === 'reported').length,
    open: jobs.filter(j => j.status === 'active' || j.status === 'planning').length,
    start: starts[0] ?? null,
    end: ongoing ? null : ends[ends.length - 1] ?? null,
    ongoing,
    days: field(j => jobMetrics(j).days),
    hours: field(j => jobMetrics(j).hours),
    miles: field(j => jobMetrics(j).miles),
    materials: field(j => jobCosts(j).materials),
    labor: field(j => jobCosts(j).labor),
    purchases: jobs.reduce((t, j) => t + jobCosts(j).purchases, 0),
  };
}

// ------------------------------------------------------------ the contract: what the client owes against what was agreed
// project.ledger = { agreed, changes: [{ date, job, title, reason, amount, status: 'approved' | 'proposed', evidence }], payments: [{ date, amount, note }] }
export function contractOf(p) {
  const lg = { agreed: null, changes: [], payments: [], ...(p.ledger ?? {}) };
  const priced = p.jobs.map(j => jobCosts(j).agreed);
  if (lg.agreed == null && priced.length && priced.every(v => v != null)) lg.agreed = round2(priced.reduce((a, b) => a + b, 0));
  return lg;
}
export function balanceOf(ledger) {
  const agreed = ledger.agreed ?? null;
  const approved = ledger.changes.filter(c => c.status === 'approved');
  const proposed = ledger.changes.filter(c => c.status !== 'approved');
  const paid = ledger.payments.length ? sum(ledger.payments) : null;

  // TODO(owner): decide how changes the client has not approved yet affect the balance.
  // Provisional rule: only approved changes count; proposed ones are shown beside the balance, not in it.
  const changes = sum(approved);
  const total = agreed == null ? null : round2(agreed + changes);
  const balance = total == null ? null : round2(total - (paid ?? 0));

  return { agreed, changes, approvedCount: approved.length, proposed: sum(proposed), proposedCount: proposed.length, total, paid, balance };
}

// ------------------------------------------------------------ the running invoice: one entry per day since the last payment
// project.invoice = { from, to, rates: { day, gas }, lastPayment, materialsBilled, jobs: { A: jobId, … }, days: [...] }
// a day = { date, job: ['A'], title, dayRate, gas, settled?, confirm?: [], photo?, stops: [{ t: 'HH:MM', place, what, kind, city?, amount?, receipt?, cash? }] }
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// What one day adds to the balance. The data says per day whether the day rate and the gas charge apply,
// so every charge is visible (and editable) in projects.json rather than inferred from the stops.
export function chargesFor(day, rates) {
  if (day.settled != null) return { day: 0, gas: 0, total: 0, settled: day.settled };
  const d = day.dayRate ? rates.day : 0;
  const g = typeof day.gas === 'number' ? day.gas : day.gas ? rates.gas : 0;   // true = the usual rate; a number = that day's amount
  return { day: d, gas: g, total: d + g, settled: null };
}

export function invoiceOf(p) {
  const iv = p.invoice;
  if (!iv) return null;
  const byCode = code => p.jobs.find(j => j.id === iv.jobs?.[code]) ?? null;
  const days = [...iv.days]
    .sort((a, b) => (a.date == null) - (b.date == null) || String(a.date).localeCompare(String(b.date)))
    .map((d, i) => {
      const times = d.stops.map(s => s.t).filter(Boolean).map(mins);
      const start = times.length ? Math.min(...times) : null;
      const end = times.length ? Math.max(...times) : null;
      const buys = d.stops.filter(s => s.kind === 'buy' || s.amount != null);
      const materials = sum(buys);
      const charge = chargesFor(d, iv.rates);
      // materials bought that day ride on the same day's charge once they are billed
      charge.materials = iv.materialsBilled && charge.settled == null ? materials : 0;
      charge.total = round2(charge.total + charge.materials);
      return {
        ...d, i, start, end, minutes: times.length > 1 ? end - start : null,
        charge, jobs: d.job.map(byCode).filter(Boolean),
        buys, materials, unpriced: buys.filter(s => s.amount == null).length,
      };
    });
  const billed = days.filter(d => d.charge.settled == null);
  const t = {
    days: billed.filter(d => d.dayRate).length,
    gasDays: billed.filter(d => d.gas).length,
    labor: billed.reduce((a, d) => a + d.charge.day, 0),
    gas: billed.reduce((a, d) => a + d.charge.gas, 0),
    billedMaterials: round2(billed.reduce((a, d) => a + d.charge.materials, 0)),
    minutes: days.reduce((a, d) => a + (d.minutes ?? 0), 0),
    timed: days.filter(d => d.minutes != null).length,
    miles: round2(days.reduce((a, d) => a + (d.miles ?? 0), 0)),
    milesDays: days.filter(d => d.miles != null).length,
    gasGroups: gasGroups(billed),
    stops: days.reduce((a, d) => a + d.stops.length, 0),
    materials: round2(days.reduce((a, d) => a + d.materials, 0)),
    purchases: days.reduce((a, d) => a + d.buys.filter(s => s.amount != null).length, 0),
    unpriced: days.reduce((a, d) => a + d.unpriced, 0),
    settled: days.reduce((a, d) => a + (d.charge.settled ?? 0), 0),
    settledDays: days.filter(d => d.charge.settled != null).length,
  };
  // Materials join the balance only once the owner says they are billed (materialsBilled: true).
  const due = round2(t.labor + t.gas + t.billedMaterials);
  const confirm = days.flatMap(d => (d.confirm ?? []).map(c => ({ d, c })));
  return { ...iv, days, totals: t, due, confirm, byCode };
}

// "8 days × $35.00 + 1 day × $10.00": the gas charges grouped by amount
export function gasGroups(days) {
  const by = new Map();
  for (const d of days) if (d.charge.gas) by.set(d.charge.gas, (by.get(d.charge.gas) ?? 0) + 1);
  return [...by].sort((a, b) => b[0] - a[0]).map(([amt, n]) => `${n} ${n === 1 ? 'day' : 'days'} × ${usd.format(amt)}`).join(' + ');
}

// What the client owes on a project: the invoice when there is one, otherwise the contract balance.
export function dueOf(p) {
  const iv = invoiceOf(p);
  return iv ? iv.due : balanceOf(contractOf(p)).balance;
}

// ------------------------------------------------------------ every task, plus supply runs read from the receipts
export function allTasks(data) {
  const out = [];
  for (const p of data.projects) for (const j of p.jobs) {
    j.timeline.forEach((e, k) => (e.tasks ?? []).forEach(t => out.push({
      kind: 'task', t: t.t, f: t.f, trade: t.trade ?? null, upcoming: !!(t.upcoming || e.upcoming), date: e.date ?? null, time: e.time ?? null,
      p, j, k, img: e.img ?? null,
    })));
    for (const m of j.costs?.materials ?? []) out.push({ kind: 'supply', t: `${m.vendor}${m.city ? `, ${m.city}` : ''}`, note: m.item, amount: m.amount, f: 'supply', date: m.date, p, j, k: -1 });
    for (const s of j.costs?.stops ?? []) out.push({ kind: 'supply', t: s.place, note: s.what, amount: null, f: 'supply', date: s.date, p, j, k: -1 });
  }
  return out;
}

// ------------------------------------------------------------ the full ledger for a project (or one of its jobs), written into `root`
export function renderLedger(p, root, { jobId = null } = {}) {
  const job = jobId ? p.jobs.find(j => j.id === jobId) : null;
  const jobs = job ? [job] : p.jobs;
  const b = balanceOf(contractOf(p));
  const r = rollup(job ? { ...p, jobs } : p);
  const lg = contractOf(p);
  const mats = jobs.flatMap(j => (j.costs?.materials ?? []).map(m => ({ ...m, job: j })));
  const unpriced = jobs.flatMap(j => j.costs?.unpriced ?? []);
  const stops = jobs.flatMap(j => j.costs?.stops ?? []);
  const through = jobs.length === 1 && jobs[0].costs?.materialsThrough ? ` through ${shortDate(jobs[0].costs.materialsThrough)}` : '';
  const iv = invoiceOf(p);
  const due = iv ? iv.due : b.balance;
  const recorded = f => (f.of > 1 ? `${f.n} of ${f.of} jobs recorded` : '');
  const row = (label, value, note = '', fmt = money) =>
    `<div class="inv-row${value == null ? ' is-pending' : ''}"><dt>${label}${note ? `<small>${note}</small>` : ''}</dt><dd>${value == null ? PENDING : fmt(value)}</dd></div>`;
  const unit = u => v => `${v.toLocaleString('en-US')} ${u}`;
  const list = (items, empty, fn) => (items.length ? `<ul class="lg-list">${items.map(fn).join('')}</ul>` : `<p class="ledger-note">${empty}</p>`);
  root.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">${esc(job ? p.name : 'Project')} <span>/</span> Ledger</p>
        <h2 id="${root.dataset.titleId || 'ledger-title'}">${esc(job ? job.title : p.name)}</h2>
      </div>
      <div class="total">
        <p class="eyebrow">Balance due${job && p.jobs.length > 1 ? ` · ${esc(p.name)}` : ''}</p>
        <p class="amount${due == null ? ' is-pending' : ''}">${money(due)}</p>
      </div>
    </div>
    ${iv ? `
    <h3 class="inv-h">Invoice · ${shortDate(iv.from)} – ${shortDate(iv.to)}</h3>
    <dl class="inv-summary">
      ${row('Days on site', iv.totals.labor, `${iv.totals.days} × ${money(iv.rates.day)}`)}
      ${row('Gas', iv.totals.gas, iv.totals.gasGroups)}
      ${row('Miles', iv.totals.miles, 'Estimated from each stop’s town', v => `≈ ${Math.round(v).toLocaleString('en-US')} mi`)}
      ${row('Materials', iv.totals.materials, iv.materialsBilled ? `${iv.totals.purchases} purchases on receipts${iv.totals.unpriced ? `, ${iv.totals.unpriced} not priced yet` : ''}` : `${iv.totals.purchases} purchases · not in the balance until billing is confirmed`)}
      ${row('Balance due', iv.due)}
    </dl>` : ''}
    ${!iv || lg.agreed != null ? `<h3 class="inv-h">Contract</h3>
    <dl class="inv-summary">
      ${row('Agreed price', b.agreed)}
      ${row('Approved changes', b.approvedCount ? b.changes : null, b.approvedCount ? `${b.approvedCount} change${b.approvedCount > 1 ? 's' : ''}` : '')}
      ${b.proposedCount ? row('Proposed changes', b.proposed, 'Awaiting approval, not in the balance') : ''}
      ${row('Paid', b.paid)}
      ${row('Balance due', b.balance)}
    </dl>` : ''}
    <h3 class="inv-h">Costs so far</h3>
    <dl class="inv-summary">
      ${row('Materials', r.materials.sum, r.purchases ? `${r.purchases} documented purchases${through}` : '')}
      ${row('Labor', r.labor.sum, recorded(r.labor))}
      ${row('Hours on site', r.hours.sum, recorded(r.hours), unit('h'))}
      ${row('Mileage', r.miles.sum, recorded(r.miles), unit('mi'))}
      ${row('Days on site', r.days.sum, recorded(r.days), unit(r.days.sum === 1 ? 'day' : 'days'))}
    </dl>
    ${jobs.length > 1 ? `
    <h3 class="inv-h">By job</h3>
    <div class="ledger-table"><table class="lg-jobs">
      <thead><tr><th scope="col">Job</th><th scope="col">Days</th><th scope="col">Hours</th><th scope="col">Miles</th><th scope="col">Materials</th></tr></thead>
      <tbody>${jobs.map(j => { const m = jobMetrics(j), c = jobCosts(j); return `
        <tr><td>${esc(j.title)}<small>${esc(dateRange(j.start, j.end))}</small></td><td>${num(m.days)}</td><td>${num(m.hours)}</td><td>${num(m.miles)}</td><td>${c.materials == null ? '—' : money(c.materials)}</td></tr>`; }).join('')}
      </tbody>
    </table></div>` : ''}
    <h3 class="inv-h">Changes during the work</h3>
    ${list(lg.changes.filter(c => !job || !c.job || c.job === job.id), 'No changes recorded. Anything that changes the scope or price goes here with its date, reason, amount and photo.', ch => `
      <li><b>${shortDate(ch.date)}</b> ${esc(ch.title)} <span class="lg-status ${ch.status === 'approved' ? 'ok' : ''}">${ch.status === 'approved' ? 'Approved' : 'Proposed'}</span>${ch.reason ? `<small>${esc(ch.reason)}</small>` : ''}<em>${ch.amount >= 0 ? '+' : ''}${money(ch.amount)}</em></li>`)}
    <h3 class="inv-h">Payments</h3>
    ${list(lg.payments, 'No payments recorded.', pm => `<li><b>${shortDate(pm.date)}</b> ${esc(pm.note || 'Payment')}<em>${money(pm.amount)}</em></li>`)}
    ${mats.length ? `
    <h3 class="inv-h">Materials</h3>
    <div class="ledger-table">
      <table>
        <thead><tr><th scope="col">Date</th><th scope="col">Supplier</th><th scope="col">Purchase</th><th scope="col">Amount</th></tr></thead>
        <tbody>${mats.map(l => `
          <tr><td>${shortDate(l.date)}</td><td>${esc(l.vendor)}${l.city ? ` <small>${esc(l.city)}</small>` : ''}</td>
          <td>${esc(l.item)}${l.basis ? ` <small>${esc(l.basis)}</small>` : ''}${jobs.length > 1 ? ` <small>${esc(l.job.title)}</small>` : ''}</td><td>${money(l.amount)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><th scope="row" colspan="3">Documented subtotal</th><td>${money(r.materials.sum)}</td></tr></tfoot>
      </table>
    </div>` : ''}
    ${unpriced.length ? `<p class="ledger-note"><b>Bought, no confirmed price:</b> ${unpriced.map(esc).join(' · ')}.</p>` : ''}
    ${stops.length ? `
    <details class="route">
      <summary>Other stops on the route <span aria-hidden="true">+</span></summary>
      <ul>${stops.map(st => `<li><b>${shortDate(st.date)} <span>·</span> ${esc(st.place)}</b> ${esc(st.what)}</li>`).join('')}</ul>
    </details>` : ''}`;
}

// ------------------------------------------------------------ a side drawer (<dialog>) that holds a ledger
export function wireDrawer(dialog, toggle, onClose) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.focus({ preventScroll: true });
    onClose?.();
  });
  return opener => {
    if (dialog.open) return;
    toggle = opener ?? toggle;
    toggle?.setAttribute('aria-expanded', 'true');
    dialog.showModal();
  };
}
