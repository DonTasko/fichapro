/* =====================================================================
   MÓDULO 5 — INTERFACE: núcleo (navegação, janelas, componentes)
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const h = U.esc;

const NAV = [
  ['dashboard', 'Dashboard'], ['ingredientes', 'Ingredientes e matérias-primas'], ['importacao', 'Importação de ingredientes'],
  ['fichas', 'Fichas técnicas / Estivas'], ['produtos', 'Produtos e pratos produzidos'], ['alergenios', 'Alergénios'],
  ['mao-de-obra', 'Custos de mão de obra'], ['custos', 'Custos energéticos e operacionais'], ['simulador', 'Simulador de preços'],
  ['relatorios', 'Relatórios'], ['configuracoes', 'Configurações'],
];
const Views = {};
const UI = { dirty: false, current: null };

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 6000 : 3200);
}
function modal({ title, body, footer = '', size = '', onMount }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="modal-h"><h2>${h(title)}</h2><button class="btn icon" data-close aria-label="Fechar">✕</button></div><div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  $('#modal-root').appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) bg._down = true; });
  bg.addEventListener('mouseup', (e) => { if (e.target === bg && bg._down) close(); bg._down = false; });
  $$('[data-close]', bg).forEach((b) => b.addEventListener('click', close));
  const m = { el: bg, close, $: (s) => $(s, bg), $$: (s) => $$(s, bg) };
  if (onMount) onMount(m);
  const first = $('input:not([type=checkbox]),select,textarea', bg); if (first) setTimeout(() => first.focus(), 30);
  return m;
}
function confirmDlg(message, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title, size: 'small', body: `<div>${message}</div>`, footer: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${h(ok)}</button>` });
    m.$('[data-ok]').addEventListener('click', () => { done = true; m.close(); resolve(true); });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe($('#modal-root'), { childList: true });
  });
}

/* ---------- Componentes ---------- */
function algBadge(id, trace = false, title) {
  const a = ALLERGEN_BY_ID[id]; if (!a) return '';
  return `<span class="alg ${trace ? 'trace' : ''}" style="${trace ? 'color' : 'background'}:${a.color}" title="${h(title || (trace ? tr('Pode conter') + ': ' : '') + tr(a.name))}">${a.id}</span>`;
}
function algList(ids = [], traces = []) {
  if (!ids.length && !traces.length) return '<span class="muted small">—</span>';
  return `<span class="alg-list">${ids.map((i) => algBadge(i)).join('')}${traces.map((i) => algBadge(i, true)).join('')}</span>`;
}
const demoTag = (o) => (o && o.demo ? ' <span class="badge demo">DEMO</span>' : '');
const options = (list, sel, { empty } = {}) => (empty !== undefined ? `<option value="">${h(empty)}</option>` : '') + list.map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${h(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${h(l)}</option>`; }).join('');
const vNum = (x) => (x === null || x === undefined || x === '' || !U.ok(Number(x)) ? '' : U.inNum(Number(x)));
const numInput = (name, val, attrs = '') => `<input class="num" inputmode="decimal" name="${name}" value="${h(vNum(val))}" ${attrs}>`;
const statusBadge = (s) => `<span class="badge ${s.cls}">${h(s.label)}</span>`;
const pctClass = (fc, target) => (!U.ok(fc) ? '' : fc > target + 0.05 ? 'red' : fc > target - 3 ? 'amber-t' : 'green-t');
const diffCls = (d) => (d > 0.00001 ? 'diff-up' : d < -0.00001 ? 'diff-down' : '');
const signPct = (d) => (U.ok(d) ? (d > 0 ? '+' : '') + U.num(d, 1) + ' %' : '—');
/** Preço unitário de uma linha: para g/ml/cl mostra por kg/L (mais legível). */
function fmtUnitPrice(up, unit) {
  if (!U.ok(up)) return '—';
  if (unit === 'g') return U.eur4(up * 1000) + '/kg';
  if (unit === 'ml') return U.eur4(up * 1000) + '/L';
  if (unit === 'cl') return U.eur4(up * 100) + '/L';
  return U.eur4(up) + '/' + (unit === 'dose' ? 'dose' : unit === 'emb' ? 'emb' : UNITS[unit] ? UNITS[unit].label : unit);
}
const signEur = (d) => (U.ok(d) ? (d > 0 ? '+' : '') + U.eur(d) : '—');

/** Lê valores de um formulário. Campos com class "num" são convertidos para número. */
function readForm(root) {
  const o = {};
  $$('[name]', root).forEach((el) => {
    if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; return; }
    if (el.type === 'checkbox') { o[el.name] = el.checked; return; }
    if (el.classList.contains('num')) { const t = el.value.trim(); o[el.name] = t === '' ? null : U.parseNum(t); return; }
    o[el.name] = el.value;
  });
  return o;
}
function markInvalid(root, names) { $$('.bad', root).forEach((e) => e.classList.remove('bad')); names.forEach((n) => { const el = $(`[name="${n}"]`, root); if (el) el.classList.add('bad'); }); }

/* ---------- Gráficos SVG simples ---------- */
function barChart(items, { target, unit = '%', max, height } = {}) {
  if (!items.length) return '<div class="empty">Sem dados para o gráfico.</div>';
  const W = 640, rowH = 26, padL = 190, padR = 60, H = height || items.length * rowH + 30;
  const mx = max || Math.max(target || 0, ...items.map((i) => i.value)) * 1.1 || 1;
  const x = (v) => padL + (Math.max(0, v) / mx) * (W - padL - padR);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  items.forEach((it, i) => {
    const y = 10 + i * rowH;
    const col = it.color || (target && it.value > target ? 'var(--red)' : 'var(--green)');
    s += `<text x="${padL - 8}" y="${y + 15}" text-anchor="end" font-size="12" fill="#334">${h(it.label.length > 28 ? it.label.slice(0, 27) + '…' : it.label)}</text>`;
    s += `<rect x="${padL}" y="${y + 3}" width="${Math.max(1, x(it.value) - padL)}" height="16" rx="3" fill="${col}"/>`;
    s += `<text x="${x(it.value) + 5}" y="${y + 15}" font-size="11.5" fill="#334">${unit === '€' ? U.eur(it.value) : U.num(it.value, 1) + ' %'}</text>`;
  });
  if (target) { const tx = x(target); s += `<line x1="${tx}" x2="${tx}" y1="4" y2="${H - 14}" stroke="var(--navy)" stroke-dasharray="4 3"/><text x="${tx}" y="${H - 2}" font-size="11" text-anchor="middle" fill="var(--navy)">Objetivo ${U.num(target, 0)} %</text>`; }
  return s + '</svg>';
}
function donut(parts, { size = 180, label = '' } = {}) {
  const total = U.sum(parts, (p) => p.value);
  if (!(total > 0)) return '<div class="empty">Sem dados.</div>';
  const r = 70, c = 2 * Math.PI * r; let off = 0;
  let s = `<svg viewBox="0 0 ${size + 220} ${size}" class="chart" style="max-width:420px"><g transform="translate(${size / 2},${size / 2}) rotate(-90)">`;
  parts.forEach((p) => { const len = (p.value / total) * c; s += `<circle r="${r}" fill="none" stroke="${p.color}" stroke-width="26" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"/>`; off += len; });
  s += `</g><text x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--navy)">${h(label)}</text><text x="${size / 2}" y="${size / 2 + 15}" text-anchor="middle" font-size="10.5" fill="#677">por dose</text>`;
  parts.forEach((p, i) => { const y = 28 + i * 26; s += `<rect x="${size + 14}" y="${y - 10}" width="12" height="12" rx="2" fill="${p.color}"/><text x="${size + 32}" y="${y}" font-size="12" fill="#334">${h(p.label)}: ${U.eur(p.value)} (${U.num((p.value / total) * 100, 0)} %)</text>`; });
  return s + '</svg>';
}
function lineChart(points, { height = 160 } = {}) {
  if (points.length < 2) return '<div class="muted small">Histórico insuficiente para gráfico (mínimo 2 registos).</div>';
  const W = 600, H = height, p = 34;
  const xs = points.map((q) => new Date(q.date).getTime()), ys = points.map((q) => q.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) * 0.95, y1 = Math.max(...ys) * 1.05;
  const X = (v) => p + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * p), Y = (v) => H - p + 10 - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * p);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="var(--green)" stroke-width="2.5" points="${points.map((q, i) => X(xs[i]) + ',' + Y(ys[i])).join(' ')}"/>`;
  points.forEach((q, i) => { s += `<circle cx="${X(xs[i])}" cy="${Y(ys[i])}" r="4" fill="var(--navy)"/><text x="${X(xs[i])}" y="${Y(ys[i]) - 8}" font-size="10.5" text-anchor="middle">${U.eur(ys[i])}</text><text x="${X(xs[i])}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#677">${U.fmtDate(q.date)}</text>`; });
  return s + '</svg>';
}

/* ---------- Impressão / PDF ---------- */
function printHTML(html, title = 'Documento') {
  html = I18N.trHTML(html); title = tr(title);
  if (Native.ok) {
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const doc = `<!DOCTYPE html><html lang="${document.documentElement.lang}"><head><meta charset="UTF-8"><title>${h(title)}</title><style>${css}\n#print-area{display:block!important}body{background:#fff}</style></head><body class="printing"><div id="print-area"><div class="print-doc">${html}</div></div></body></html>`;
    Native.call('printHtml', title, doc).catch((e) => toast(e.message, 'err'));
    setTimeout(() => Native.maybeInterstitial(), 1500);
    return;
  }
  const pa = $('#print-area');
  pa.innerHTML = `<div class="print-doc">${html}</div>`;
  const old = document.title; document.title = title;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); pa.innerHTML = ''; document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 1500); }, 60);
}
const fileStamp = () => U.todayISO();
function exportRows(kind, name, sheets) {
  const t = (c) => (typeof c === 'string' ? tr(c) : c && typeof c === 'object' && typeof c.v === 'string' ? { ...c, v: tr(c.v) } : c);
  sheets = sheets.map((s) => ({ ...s, name: tr(s.name), rows: s.rows.map((r) => (r || []).map(t)) }));
  setTimeout(() => Native.maybeInterstitial(), 1500);
  if (kind === 'xlsx') IO.download(IO.writeXlsx(sheets), `${name}_${fileStamp()}.xlsx`);
  else IO.download(new Blob([IO.toCSV(sheets[0].rows)], { type: 'text/csv;charset=utf-8' }), `${name}_${fileStamp()}.csv`);
}

/* ---------- Router ---------- */
function renderNav() {
  const cur = (location.hash.slice(2) || 'dashboard').split('/')[0];
  const active = cur === 'ficha' ? 'fichas' : cur;
  $('#nav').innerHTML = NAV.map(([k, l], i) => `<a href="#/${k}" class="${k === active ? 'active' : ''}"><span class="n">${i + 1}</span>${h(l)}</a>`).join('');
  $('#sideFoot').innerHTML = Sync.mode() === 'cloud' && Tenants.current
    ? `<b style="color:#fff">${h(Tenants.current.name)}</b><br>${h(Auth.user ? Auth.user.email : '')}<br>Dados na nuvem, sincronizados.`
    : `Armazenamento: ${h(Repo.kind)}${Repo.persisted ? ' (persistente)' : ''}<br>Dados guardados só neste navegador.`;
}
async function route(keepScroll = false) {
  const y = window.scrollY;
  const parts = (location.hash.slice(2) || 'dashboard').split('/');
  const key = parts[0];
  const view = Views[key] || Views.dashboard;
  renderNav();
  $('#sidebar').classList.remove('open');
  UI.current = key;
  const title = key === 'ficha' ? 'Ficha técnica' : (NAV.find((n) => n[0] === key) || NAV[0])[1];
  $('#pageTitle').textContent = title;
  const el = $('#view');
  el.innerHTML = '';
  try { await view(el, parts.slice(1)); }
  catch (e) { console.error(e, e.stack); el.innerHTML = `<div class="alert err">Ocorreu um erro ao abrir esta secção: ${h(e.message)}</div>`; }
  window.scrollTo(0, keepScroll ? y : 0);
}
let lastHash = location.hash;
window.addEventListener('hashchange', async () => {
  if (UI.dirty && !(await confirmDlg('Tem alterações por guardar nesta ficha. Sair sem guardar?', { ok: 'Sair sem guardar', danger: true }))) {
    history.replaceState(null, '', lastHash); renderNav(); return;
  }
  UI.dirty = false; lastHash = location.hash; route();
});
window.addEventListener('beforeunload', (e) => { if (UI.dirty) { e.preventDefault(); e.returnValue = ''; } });
const go = (hash) => { location.hash = hash; };

/* ---------- Funções partilhadas ---------- */
function computeAll(ctx) {
  const data = dataView();
  const ev = Calc.evaluator(data, ctx);
  return [...data.recipes.values()].map((r) => {
    const c = ev.cost(r);
    const p = Calc.pricing(r, c, data.settings, ctx);
    return { r, c, p, s: Calc.status(r, c, p, data.settings) };
  });
}
function backupDownload() {
  const data = Repo.exportAll();
  IO.download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `copia-seguranca-fichas_${fileStamp()}.json`);
  saveSettings({ lastBackup: U.nowISO() });
  toast('Cópia de segurança exportada', 'ok');
}
