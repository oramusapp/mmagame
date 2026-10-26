'use strict';

/* =========================================================
   SDCA · thenotoriousg
   Statyczna aplikacja: dane startowe są zaszyfrowane (seed.enc.js),
   dane użytkownika zapisywane zaszyfrowane w localStorage.
   Hasło wymagane przy każdym wejściu.
   ========================================================= */

const VAULT_KEY = 'sdca.vault.v1';
const THEME_KEY = 'sdca.theme';
const CATS = ['fundamental', 'technical', 'sentiment'];
const CAT_LABEL = { fundamental: 'Fundamental', technical: 'Technical', sentiment: 'Sentiment' };
const LINK_CATS = {
  fundamental: 'Fundamental',
  technical: 'Technical',
  sentiment: 'Sentiment',
  research: 'Strony z danymi',
  docs: 'Dokumenty',
};
const PROVIDED_BY = ['Own research', 'Adam', 'Select'];
const REQ = { fundamental: 5, technical: 5, sentiment: 2, total: 15, adamMax: 5 };
const RESULTS = ['High Value', 'Value', 'Neutral', 'Low Value', 'No Value'];
const RESULT_RULE = {
  'High Value': 'Z ≥ 1.5',
  'Value': '0 < Z < 1.5',
  'Neutral': 'Z = 0',
  'Low Value': '−1.5 < Z < 0',
  'No Value': 'Z ≤ −1.5',
};
// podpowiedzi z szablonu arkusza (kolumny D/E/F)
const HINTS = {
  why: 'Write down pros, cons, long-term, short-term. Does it suffer from decay? What made you pick this Input?, along with any other details to fully grasp the understanding.',
  how: 'normalized/logarithmic, Chart / Time Frame, and Settings if needed.',
  score: 'Provide values of the indicator that imply +2/−2 Z (e.g. RSI 30 = +2SD, RSI 70 = −2SD). This is also where you would describe the adjustments for decay.',
};
const VIEWS = [
  ['sdca', 'SDCA'],
  ['chart', 'Wykres i aktualizacje'],
  ['links', 'Baza linków'],
  ['library', 'Baza wskaźników'],
  ['checklist', 'Checklista'],
  ['settings', 'Ustawienia'],
];

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dkey();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;
const fmtZ = (v, d = 2) => (isNum(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) : '—');
const niceDate = (k) => {
  if (!k) return '—';
  const [y, m, d] = k.split('-');
  return `${d}.${m}.${y}`;
};
const daysAgo = (k) => (k ? Math.round((Date.parse(today()) - Date.parse(k)) / 864e5) : null);
const urlKey = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
function safeUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '';
  } catch { return ''; }
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function shortUrl(u) {
  try {
    const x = new URL(u);
    const p = (x.pathname + x.search).replace(/\/$/, '');
    return x.hostname.replace(/^www\./, '') + (p.length > 38 ? p.slice(0, 36) + '…' : p);
  } catch { return u; }
}

/* ---------- valuation (formuła z arkusza SDCA v2) ----------
   =IFS(Z<=-1.5,"No Value",AND(Z<0,Z>-1.5),"Low Value",Z=0,"Neutral",AND(0<Z,Z<1.5),"Value",Z>=1.5,"High Value") */
function valuation(z) {
  if (!isNum(z)) return null;
  if (z <= -1.5) return 'No Value';
  if (z < 0) return 'Low Value';
  if (z === 0) return 'Neutral';
  if (z < 1.5) return 'Value';
  return 'High Value';
}
const resCls = (r) => (r ? 'r-' + r.toLowerCase().replace(/\s+/g, '-') : 'r-none');
const badge = (r, extra = '') => `<span class="badge ${resCls(r)} ${extra}" title="${r ? esc(RESULT_RULE[r]) : 'brak Z-score'}">${r ? esc(r) : '—'}</span>`;

/* ---------- crypto ---------- */
function b64enc(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64dec(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function deriveKey(password, saltB64, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64dec(saltB64), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
async function decryptJSON(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64dec(blob.iv) }, key, b64dec(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64enc(iv), ct: b64enc(ct) };
}

/* ---------- session ---------- */
let S = null;      // stan aplikacji (odszyfrowany)
let SEED = null;   // dane z Excela (odszyfrowane)
let KEY = null;    // klucz AES (tylko w pamięci)
let SALT = null;
let ITER = 0;
let failCount = 0;
let lockedUntil = 0;
let saveTimer = null;
let saveState = 'saved';

const ui = {
  view: 'sdca',
  expanded: new Set(),
  linkCat: 'all', linkQ: '', linkUsed: false,
  libCat: 'all', libQ: '', libShow: 'all',
  chartSeries: 'market',
};

function fromSeed(seed) {
  const s = clone(seed);
  s.settings = {};
  return migrate(s);
}
function migrate(s) {
  s.indicators ||= [];
  s.links ||= [];
  s.updates ||= [];
  s.checklist ||= [];
  s.categories ||= SEED?.categories || {};
  s.notes ||= {};
  s.settings ||= {};
  for (const i of s.indicators) {
    i.altLinks ||= [];
    i.aliases ||= [];
    i.history ||= [];
    if (!PROVIDED_BY.includes(i.providedBy)) i.providedBy = 'Select';
  }
  return s;
}

function save() {
  if (!KEY || !S) return;
  saveState = 'saving';
  updateSaveState();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}
async function flushSave() {
  clearTimeout(saveTimer);
  if (!KEY || !S) return;
  try {
    const enc = await encryptJSON(KEY, S);
    localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 1, iter: ITER, salt: SALT, ...enc }));
    saveState = 'saved';
  } catch (e) {
    console.error(e);
    saveState = 'error';
  }
  updateSaveState();
}
function updateSaveState() {
  const el = $('#savestate');
  if (!el) return;
  el.textContent = { saving: 'zapisywanie…', saved: '🔐 zapisano (zaszyfrowane)', error: '⚠️ błąd zapisu' }[saveState];
  el.className = 'savestate ' + saveState;
}

async function login(password) {
  const enc = window.SDCA_SEED_ENC;
  if (!enc) throw new Error('Brak pliku seed.enc.js');
  const key = await deriveKey(password, enc.salt, enc.iter);
  let seed;
  try { seed = await decryptJSON(key, enc); } catch { throw new Error('bad-password'); }
  let state = null;
  const raw = localStorage.getItem(VAULT_KEY);
  if (raw) {
    try {
      const vault = JSON.parse(raw);
      const k = vault.salt === enc.salt && vault.iter === enc.iter ? key : await deriveKey(password, vault.salt, vault.iter);
      state = migrate(await decryptJSON(k, vault));
    } catch (e) {
      console.warn('Nie udało się odszyfrować danych lokalnych', e);
      state = null;
      toastLater('⚠️ Zapisanych danych nie dało się odczytać – wczytano dane z Excela. Stary zapis został zachowany jako kopia.');
      localStorage.setItem(VAULT_KEY + '.backup', raw);
    }
  }
  SEED = seed;
  KEY = key;
  SALT = enc.salt;
  ITER = enc.iter;
  S = state || fromSeed(seed);
  if (!state) save();
}

function lock() {
  if (KEY && S) flushSave();
  S = null; SEED = null; KEY = null;
  closeModal();
  renderLogin();
}

/* ---------- derived data ---------- */
const active = () => S.indicators.filter((i) => i.active).sort((a, b) => a.order - b.order);
const activeBy = (cat) => active().filter((i) => i.category === cat);
function avgZ(list = active()) {
  const v = list.map((i) => i.z).filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
const sortedUpdates = () => [...S.updates].sort((a, b) => a.date.localeCompare(b.date));
const lastUpdate = () => sortedUpdates().at(-1) || null;
const indById = (id) => S.indicators.find((i) => i.id === id);
function usedBy(url) {
  const k = urlKey(url);
  return S.indicators.filter((i) => urlKey(i.source) === k || i.altLinks.some((a) => urlKey(a) === k));
}
function indHistory(ind) {
  const rows = new Map();
  for (const h of ind.history || []) rows.set(h.date, { date: h.date, z: h.z, from: h.sheet });
  for (const u of S.updates) if (u.values && isNum(u.values[ind.id])) rows.set(u.date, { date: u.date, z: u.values[ind.id], from: 'aktualizacja' });
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
}
const missingDesc = (i) => !i.why || !i.how || !i.score;
const isTV = (i) => i.tv || /tradingview\.com/i.test(i.source || '') || /tradingview/i.test(i.sourceText || '');

/* =========================================================
   LOGIN
   ========================================================= */
function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch { /* ignore */ }
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function footer() {
  return `<footer class="footer">
    <div>© ${new Date().getFullYear()} <b>thenotoriousg</b>. All rights reserved.</div>
    <div class="credits">Credits: <span>The Real World</span> · <span>Prof Adam</span> · <span>Crypto Investing Campus</span></div>
  </footer>`;
}

function renderLogin(msg = '') {
  document.title = 'SDCA · logowanie';
  $('#app').innerHTML = `
  <main class="login">
    <form class="login-card" data-form="login" autocomplete="off">
      <div class="login-logo" aria-hidden="true">₿</div>
      <h1>SDCA</h1>
      <p class="muted">thenotoriousg · system wyceny</p>
      <label class="field">
        <span>Hasło</span>
        <span class="pw">
          <input type="password" name="password" required autocomplete="current-password" autofocus aria-label="Hasło">
          <button type="button" class="icon-btn" data-act="pw-toggle" aria-label="Pokaż hasło">👁</button>
        </span>
      </label>
      <p class="login-err" role="alert">${esc(msg)}</p>
      <button class="btn primary block" type="submit">Wejdź</button>
      <p class="muted small">Hasło jest wymagane przy każdym wejściu. Dane są zaszyfrowane.</p>
    </form>
  </main>
  ${footer()}`;
  $('input[name=password]')?.focus();
}

/* =========================================================
   APP SHELL
   ========================================================= */
function render() {
  if (!S) return renderLogin();
  document.title = 'SDCA · thenotoriousg';
  const views = { sdca: viewSDCA, chart: viewChart, links: viewLinks, library: viewLibrary, checklist: viewChecklist, settings: viewSettings };
  $('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="logo" aria-hidden="true">₿</span><div><b>SDCA</b><small>thenotoriousg</small></div></div>
    <nav class="tabs" aria-label="Widoki">${VIEWS.map(([k, n]) => `<button class="tab ${ui.view === k ? 'on' : ''}" data-act="view" data-v="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${n}</button>`).join('')}</nav>
    <div class="top-actions">
      <span id="savestate" class="savestate"></span>
      <button class="btn ghost small" data-act="lock" title="Zablokuj aplikację">🔒 Zablokuj</button>
    </div>
  </header>
  <main class="main" id="main">${views[ui.view]()}</main>
  ${footer()}`;
  updateSaveState();
  if (ui.view === 'chart') drawChart();
}

/* ---------- SDCA (wzór: arkusz SDCA v2) ---------- */
function viewSDCA() {
  const a = avgZ();
  const m = isNum(a) ? -a : null;
  const act = active();
  const counts = Object.fromEntries(CATS.map((c) => [c, activeBy(c).length]));
  const adam = act.filter((i) => i.providedBy === 'Adam').length;
  const last = lastUpdate();
  const ago = daysAgo(S.dateUpdated);
  const zCount = act.filter((i) => isNum(i.z)).length;
  const ok = (v) => `<span class="ok ${v ? 'yes' : 'no'}">${v ? '✓' : '✗'}</span>`;
  return `
  <section class="summary">
    <div class="tile hero">
      <span class="tile-label">Market Value Z-score</span>
      <span class="hero-val">${fmtZ(m)}</span>
      <span class="tile-sub">Avg Z Score × −1 · formuła IFS: <b>${esc(valuation(m) || '—')}</b></span>
    </div>
    <div class="tile">
      <span class="tile-label">Avg Z Score</span>
      <span class="tile-val">${fmtZ(a)}</span>
      ${badge(valuation(a), 'big')}
      <span class="tile-sub">średnia z ${zCount} aktywnych wskaźników</span>
    </div>
    <div class="tile">
      <span class="tile-label">Wskaźniki (min. ${REQ.total})</span>
      <span class="tile-val">${act.length} <small>/ ${REQ.total}</small> ${ok(act.length >= REQ.total)}</span>
      <span class="tile-sub mini">${CATS.map((c) => `${CAT_LABEL[c]} ${counts[c]}/${REQ[c]} ${ok(counts[c] >= REQ[c])}`).join('<br>')}</span>
    </div>
    <div class="tile">
      <span class="tile-label">Date updated</span>
      <input type="date" class="date-in" value="${esc(S.dateUpdated || '')}" data-change="date-updated" aria-label="Data aktualizacji">
      <span class="tile-sub">${ago == null ? 'brak daty' : ago === 0 ? 'dziś' : `${ago} dni temu`} · <button class="link" data-act="date-today">ustaw dziś</button></span>
      <span class="tile-sub">Adam: ${adam}/${REQ.adamMax} ${ok(adam <= REQ.adamMax)}</span>
    </div>
  </section>
  ${last && daysAgo(last.date) > 7 ? `<div class="notice">⏰ Ostatnia zapisana aktualizacja: ${niceDate(last.date)} (${daysAgo(last.date)} dni temu). ${esc(S.notes.forward || '')}</div>` : ''}
  <div class="toolbar">
    <button class="btn primary" data-act="snapshot">💾 Zapisz aktualizację</button>
    <button class="btn" data-act="add-ind">＋ Dodaj wskaźnik</button>
    <button class="btn ghost" data-act="expand-all">${ui.expanded.size ? 'Zwiń opisy' : 'Rozwiń opisy'}</button>
    <button class="btn ghost" data-act="csv">⬇ CSV</button>
  </div>
  ${CATS.map(catTable).join('')}
  ${legendCard()}`;
}

function catTable(cat) {
  const list = activeBy(cat);
  const cat_ = S.categories[cat] || {};
  const ca = avgZ(list);
  return `<section class="card cat">
    <div class="cat-head">
      <div>
        <h2>${esc(cat_.name || CAT_LABEL[cat] + ' Indicators')} <span class="count ${list.length >= REQ[cat] ? 'good' : 'bad'}" title="minimum ${REQ[cat]}">${list.length}/${REQ[cat]}</span></h2>
        ${cat_.desc ? `<p class="muted small">${esc(cat_.desc)}</p>` : ''}
      </div>
      <div class="cat-avg"><span class="muted small">średnia kategorii</span> <b>${fmtZ(ca)}</b> ${badge(valuation(ca))}</div>
    </div>
    ${list.length ? `<div class="table-wrap"><table class="sdca">
      <thead><tr><th class="num">#</th><th>Indicator</th><th>Result</th><th>Z Score</th><th>Provided by</th><th>Source</th><th>Zmieniono</th><th class="acts-h"><span class="sr">Akcje</span></th></tr></thead>
      <tbody>${list.map((i, n) => indRow(i, n, list.length)).join('')}</tbody>
    </table></div>` : '<p class="muted small empty">Brak wskaźników w tej kategorii.</p>'}
    <button class="btn ghost small" data-act="add-ind" data-cat="${cat}">＋ Dodaj wskaźnik (${CAT_LABEL[cat]})</button>
  </section>`;
}

function indRow(i, n, len) {
  const src = safeUrl(i.source);
  const open = ui.expanded.has(i.id);
  const flags = [
    isTV(i) ? '<span class="tag" title="Wskaźnik TradingView – podaj ustawienia i timeframe w opisie">TV</span>' : '',
    missingDesc(i) ? '<span class="tag warn" title="Brakuje opisu (Why / How / Score)">opis</span>' : '',
    i.providedBy === 'Select' ? '<span class="tag warn" title="Uzupełnij Provided by">źródło?</span>' : '',
  ].join('');
  return `<tr class="${open ? 'open' : ''}">
    <td class="num">${n + 1}</td>
    <td class="name"><button class="namebtn" data-act="open-ind" data-id="${i.id}">${esc(i.name)}</button><span class="flags">${flags}</span></td>
    <td class="res">${badge(valuation(i.z))}</td>
    <td class="z">
      <div class="zbox">
        <button class="step" data-act="z-step" data-id="${i.id}" data-d="-0.1" aria-label="Zmniejsz Z o 0.1">−</button>
        <input type="number" step="0.01" inputmode="decimal" value="${isNum(i.z) ? i.z : ''}" data-z="${i.id}" aria-label="Z Score ${esc(i.name)}">
        <button class="step" data-act="z-step" data-id="${i.id}" data-d="0.1" aria-label="Zwiększ Z o 0.1">+</button>
      </div>
    </td>
    <td class="pb"><select data-pb="${i.id}" aria-label="Provided by">${PROVIDED_BY.map((p) => `<option ${i.providedBy === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
    <td class="src">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer" title="${esc(src)}">${esc(hostOf(src))} ↗</a>` : `<span class="muted">${esc(i.sourceText || '—')}</span>`}${i.altLinks.length ? ` <span class="muted small" title="${esc(i.altLinks.join('\n'))}">+${i.altLinks.length}</span>` : ''}</td>
    <td class="upd">${i.updatedAt ? niceDate(i.updatedAt) : '<span class="muted">—</span>'}</td>
    <td class="acts">
      <button class="icon-btn" data-act="toggle-desc" data-id="${i.id}" aria-label="Opisy" aria-expanded="${open}">${open ? '▴' : '▾'}</button>
      <button class="icon-btn" data-act="edit-ind" data-id="${i.id}" aria-label="Edytuj">✎</button>
      <button class="icon-btn" data-act="move" data-id="${i.id}" data-d="-1" ${n === 0 ? 'disabled' : ''} aria-label="W górę">↑</button>
      <button class="icon-btn" data-act="move" data-id="${i.id}" data-d="1" ${n === len - 1 ? 'disabled' : ''} aria-label="W dół">↓</button>
      <button class="icon-btn danger" data-act="deactivate" data-id="${i.id}" aria-label="Usuń z SDCA">✕</button>
    </td>
  </tr>
  ${open ? `<tr class="desc-row"><td></td><td colspan="7">${descGrid(i)}</td></tr>` : ''}`;
}

function descGrid(i) {
  const block = (t, v) => `<div><h4>${t}</h4>${v ? `<p>${esc(v)}</p>` : '<p class="muted">— brak —</p>'}</div>`;
  return `<div class="desc-grid">
    ${block('Why did you choose this indicator?', i.why)}
    ${block('How does the indicator work?', i.how)}
    ${block('What is Positive and Negative Score?', i.score)}
  </div>
  ${i.descFrom && i.descFrom !== 'SDCA v2' ? `<p class="muted small">Opis zaczerpnięty z arkusza „${esc(i.descFrom)}”.</p>` : ''}`;
}

function legendCard() {
  return `<details class="card legend-card">
    <summary><h3>Jak liczona jest wycena</h3></summary>
    <p class="formula"><code>=IFS(Z&lt;=-1.5,"No Value", AND(Z&lt;0,Z&gt;-1.5),"Low Value", Z=0,"Neutral", AND(0&lt;Z,Z&lt;1.5),"Value", Z&gt;=1.5,"High Value")</code></p>
    <div class="legend-grid">${RESULTS.map((r) => `<div>${badge(r)} <span class="muted small">${RESULT_RULE[r]}</span></div>`).join('')}</div>
    <ul class="small muted">
      <li><b>Avg Z Score</b> = średnia Z-score aktywnych wskaźników (Excel: <code>=AVERAGE(I5:I27)</code>). Puste wiersze nie są liczone – zgodnie z punktem 9 checklisty.</li>
      <li><b>Market Value Z-score</b> = Avg Z Score × −1 (Excel: <code>=I31*-1</code>). Ta wartość trafia na wykres i do listy aktualizacji.</li>
      <li>Konwencja z szablonu arkusza: stan wyprzedania (oversold) = wysoki dodatni Z, wykupienia (overbought) = wysoki ujemny Z.</li>
    </ul>
  </details>`;
}

/* ---------- Wykres i aktualizacje ---------- */
function viewChart() {
  const ups = sortedUpdates().reverse();
  const a = avgZ();
  return `
  <section class="card">
    <div class="card-head">
      <div><h2>${ui.chartSeries === 'market' ? 'Market Value Z-score' : 'Avg Z Score'}</h2>
      <p class="muted small">${ui.chartSeries === 'market' ? 'Avg Z Score × −1 · wyżej = wskaźniki wskazują drożej (mniej wartości)' : 'Średni Z-score aktywnych wskaźników · wyżej = więcej wartości'}</p></div>
      <div class="seg" role="group" aria-label="Seria">
        <button class="${ui.chartSeries === 'market' ? 'on' : ''}" data-act="series" data-s="market">Market Value Z</button>
        <button class="${ui.chartSeries === 'avg' ? 'on' : ''}" data-act="series" data-s="avg">Avg Z</button>
      </div>
    </div>
    <div class="chart" id="chart" role="img" aria-label="Wykres Z-score w czasie"></div>
    <p class="muted small">Tło = strefa wyniku <b>Avg Z Score</b> według formuły IFS.${chartPoints().cur ? ` Pusty punkt „teraz” to bieżący, jeszcze niezapisany stan (${fmtZ(ui.chartSeries === 'market' ? -a : a)}).` : ''}</p>
  </section>
  <section class="card">
    <div class="card-head">
      <div><h2>Lista aktualizacji <span class="muted">(Forward Testing)</span></h2>
      <p class="muted small">${esc(S.notes.forward || '')}</p></div>
      <div class="row wrap">
        <button class="btn primary small" data-act="snapshot">💾 Zapisz bieżący stan</button>
        <button class="btn small" data-act="update-new">＋ Dodaj ręcznie</button>
      </div>
    </div>
    ${ups.length ? `<div class="table-wrap"><table class="grid">
      <thead><tr><th>Data</th><th>Avg Z</th><th>Wynik (Avg)</th><th>Market Value Z</th><th>Wskaźników</th><th>Notatka</th><th class="acts-h"><span class="sr">Akcje</span></th></tr></thead>
      <tbody>${ups.map((u) => `<tr>
        <td>${niceDate(u.date)}</td>
        <td class="numc">${fmtZ(u.avgZ)}</td>
        <td>${badge(valuation(u.avgZ))}</td>
        <td class="numc">${fmtZ(isNum(u.avgZ) ? -u.avgZ : null)}</td>
        <td class="numc">${u.count ?? '—'}</td>
        <td class="note">${esc(u.note || '')}</td>
        <td class="acts">
          ${u.values ? `<button class="icon-btn" data-act="update-view" data-id="${u.id}" aria-label="Szczegóły">👁</button>` : ''}
          <button class="icon-btn" data-act="update-edit" data-id="${u.id}" aria-label="Edytuj">✎</button>
          <button class="icon-btn danger" data-act="update-del" data-id="${u.id}" aria-label="Usuń">✕</button>
        </td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small empty">Brak aktualizacji. Zapisz bieżący stan, aby rozpocząć wykres.</p>'}
  </section>`;
}

function chartPoints() {
  const pts = sortedUpdates().filter((u) => isNum(u.avgZ)).map((u) => ({ date: u.date, avg: u.avgZ, note: u.note, count: u.count }));
  const a = avgZ();
  const cur = isNum(a) && !pts.some((p) => p.date === today() && Math.abs(p.avg - a) < 1e-4) ? { date: today(), avg: a, current: true, count: active().filter((i) => isNum(i.z)).length } : null;
  const val = (p) => (ui.chartSeries === 'market' ? -p.avg : p.avg);
  return { pts: pts.map((p) => ({ ...p, v: val(p) })), cur: cur && { ...cur, v: val(cur) } };
}

function drawChart() {
  const el = $('#chart');
  if (!el) return;
  const { pts, cur } = chartPoints();
  const all = cur ? [...pts, cur] : pts;
  if (!all.length) { el.innerHTML = '<p class="muted small empty">Brak danych do wykresu.</p>'; return; }
  const W = Math.max(300, el.clientWidth), H = 300;
  const M = { l: 44, r: 92, t: 14, b: 30 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const vals = all.map((p) => p.v);
  const lo = Math.floor(Math.min(-2.5, ...vals) * 2) / 2 - 0.25;
  const hi = Math.ceil(Math.max(2.5, ...vals) * 2) / 2 + 0.25;
  const t = all.map((p) => Date.parse(p.date));
  const t0 = Math.min(...t), t1 = Math.max(...t);
  const x = (d) => M.l + (t1 === t0 ? iw / 2 : ((Date.parse(d) - t0) / (t1 - t0)) * iw);
  const y = (v) => M.t + ((hi - v) / (hi - lo)) * ih;
  const flip = ui.chartSeries === 'market' ? -1 : 1;
  // strefy: kolor i etykieta = wynik Avg Z (dla serii market odwrócone)
  const zones = [
    [1.5, hi, flip > 0 ? 'High Value' : 'No Value'],
    [0, 1.5, flip > 0 ? 'Value' : 'Low Value'],
    [-1.5, 0, flip > 0 ? 'Low Value' : 'Value'],
    [lo, -1.5, flip > 0 ? 'No Value' : 'High Value'],
  ];
  const ticks = [];
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) ticks.push(v);
  const fmtD = (d) => { const [yy, mm, dd] = d.split('-'); return `${dd}.${mm}.${yy.slice(2)}`; };
  const xc = all.length <= 6 ? all.map((p) => p.date) : [0, 0.25, 0.5, 0.75, 1].map((f) => dkey(new Date(t0 + f * (t1 - t0))));
  const xt = [];
  for (const d of [...new Set(xc)].reverse()) if (xt.every((o) => Math.abs(x(o) - x(d)) >= 64)) xt.push(d);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const lastP = pts.at(-1);
  const endLbl = cur || lastP;
  el.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    ${zones.map(([a, b, r]) => `<rect class="zone ${resCls(r)}" x="${M.l}" y="${y(b)}" width="${iw}" height="${Math.max(0, y(a) - y(b))}"/>
      <text class="zone-lbl" x="${M.l + iw + 8}" y="${(y(a) + y(b)) / 2 + 4}">${r}</text>`).join('')}
    ${ticks.map((v) => `<line class="gridline" x1="${M.l}" x2="${M.l + iw}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${v > 0 ? '+' + v : v}</text>`).join('')}
    <line class="axis0" x1="${M.l}" x2="${M.l + iw}" y1="${y(0)}" y2="${y(0)}"/>
    ${xt.map((d) => `<text class="tick" x="${x(d)}" y="${H - 8}" text-anchor="middle">${fmtD(d)}</text>`).join('')}
    ${pts.length > 1 ? `<path class="series" d="${line}"/>` : ''}
    ${cur && lastP ? `<path class="series pending" d="M${x(lastP.date)},${y(lastP.v)} L${x(cur.date)},${y(cur.v)}"/>` : ''}
    ${pts.map((p) => `<circle class="dot" cx="${x(p.date)}" cy="${y(p.v)}" r="4.5"/>`).join('')}
    ${cur ? `<circle class="dot hollow" cx="${x(cur.date)}" cy="${y(cur.v)}" r="5"/>` : ''}
    ${endLbl ? `<text class="end-lbl" x="${x(endLbl.date)}" y="${y(endLbl.v) + (endLbl.v > hi - 0.6 ? 20 : -12)}" text-anchor="${x(endLbl.date) > M.l + iw - 50 ? 'end' : x(endLbl.date) < M.l + 50 ? 'start' : 'middle'}">${endLbl.current ? 'teraz ' : ''}${fmtZ(endLbl.v)}</text>` : ''}
    <line class="cross" id="cross" y1="${M.t}" y2="${M.t + ih}" x1="0" x2="0" visibility="hidden"/>
    <rect class="hit" x="${M.l - 10}" y="${M.t}" width="${iw + 20}" height="${ih}"/>
  </svg>
  <div class="tip" id="tip" hidden></div>`;
  const svg = $('svg', el), tip = $('#tip', el), cross = $('#cross', el);
  const near = (px) => all.reduce((best, p) => (Math.abs(x(p.date) - px) < Math.abs(x(best.date) - px) ? p : best), all[0]);
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    const p = near(px);
    const cx = x(p.date);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${niceDate(p.date)}${p.current ? ' · teraz (niezapisane)' : ''}</b>
      <div>Market Value Z: <b>${fmtZ(-p.avg)}</b></div>
      <div>Avg Z: <b>${fmtZ(p.avg)}</b> ${badge(valuation(p.avg))}</div>
      ${p.count ? `<div class="muted">${p.count} wskaźników</div>` : ''}${p.note ? `<div class="muted">${esc(p.note)}</div>` : ''}`;
    const left = (cx / W) * r.width;
    tip.style.left = Math.min(Math.max(left, 90), r.width - 90) + 'px';
    tip.style.top = Math.max(0, (y(p.v) / H) * r.height - 12) + 'px';
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}

/* ---------- Baza linków ---------- */
function filteredLinks() {
  const q = ui.linkQ.trim().toLowerCase();
  return S.links.filter((l) => {
    if (ui.linkCat !== 'all' && l.category !== ui.linkCat) return false;
    const users = usedBy(l.url);
    if (ui.linkUsed && !users.some((i) => i.active)) return false;
    if (!q) return true;
    return [l.title, l.url, l.note, (l.tags || []).join(' '), users.map((i) => i.name).join(' ')].join(' ').toLowerCase().includes(q);
  });
}

function viewLinks() {
  const cats = Object.keys(LINK_CATS);
  const count = (c) => S.links.filter((l) => c === 'all' || l.category === c).length;
  return `
  <section class="card">
    <div class="card-head">
      <div><h2>Baza linków <span class="muted">(${S.links.length})</span></h2><p class="muted small">Wszystkie strony ze wskaźnikami i materiały z arkuszy. Wybierz z listy, aby otworzyć.</p></div>
      <button class="btn primary small" data-act="link-new">＋ Dodaj link</button>
    </div>
    <div class="row wrap">
      <input type="search" class="grow" placeholder="Szukaj: nazwa, strona, wskaźnik, tag…" value="${esc(ui.linkQ)}" data-input="linkq" aria-label="Szukaj linków">
      <select data-change="quick-open" aria-label="Szybkie otwarcie linku">
        <option value="">↗ Szybkie otwarcie…</option>
        ${cats.map((c) => { const ls = S.links.filter((l) => l.category === c); return ls.length ? `<optgroup label="${LINK_CATS[c]}">${ls.map((l) => `<option value="${l.id}">${esc(l.title)}</option>`).join('')}</optgroup>` : ''; }).join('')}
      </select>
    </div>
    <div class="chips">${['all', ...cats].map((c) => `<button class="chip ${ui.linkCat === c ? 'on' : ''}" data-act="link-cat" data-c="${c}">${c === 'all' ? 'Wszystkie' : LINK_CATS[c]} <span>${count(c)}</span></button>`).join('')}
      <label class="chip toggle"><input type="checkbox" data-change="link-used" ${ui.linkUsed ? 'checked' : ''}> tylko używane w SDCA</label>
    </div>
  </section>
  <div id="link-grid" class="cards">${linkCards()}</div>`;
}

function linkCards() {
  const ls = filteredLinks();
  if (!ls.length) return '<p class="muted empty">Brak linków dla tych filtrów.</p>';
  return ls.map((l) => {
    const url = safeUrl(l.url);
    const users = usedBy(l.url);
    return `<article class="lcard">
      <div class="lcard-top">
        <span class="cat-dot c-${l.category}" aria-hidden="true"></span>
        <div class="grow">
          ${url ? `<a class="ltitle" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)}</a>` : `<span class="ltitle">${esc(l.title)}</span>`}
          <div class="muted small lurl" title="${esc(l.url)}">${esc(shortUrl(l.url))}</div>
        </div>
      </div>
      <div class="ltags"><span class="tag c-${l.category}">${LINK_CATS[l.category] || l.category}</span>${(l.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      ${users.length ? `<div class="lusers">${users.map((i) => `<button class="pill ${i.active ? 'on' : ''}" data-act="open-ind" data-id="${i.id}" title="${i.active ? 'w SDCA' : 'w bazie wskaźników'}">${esc(i.name)}</button>`).join('')}</div>` : ''}
      ${l.note ? `<p class="small">${esc(l.note)}</p>` : ''}
      <div class="lacts">
        ${url ? `<a class="btn small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Otwórz ↗</a>` : ''}
        <button class="btn ghost small" data-act="link-copy" data-id="${l.id}">Kopiuj</button>
        <button class="icon-btn" data-act="link-edit" data-id="${l.id}" aria-label="Edytuj link">✎</button>
        <button class="icon-btn danger" data-act="link-del" data-id="${l.id}" aria-label="Usuń link">✕</button>
      </div>
    </article>`;
  }).join('');
}

/* ---------- Baza wskaźników ---------- */
function filteredLib() {
  const q = ui.libQ.trim().toLowerCase();
  return [...S.indicators].sort((a, b) => (b.active - a.active) || CATS.indexOf(a.category) - CATS.indexOf(b.category) || a.order - b.order).filter((i) => {
    if (ui.libCat !== 'all' && i.category !== ui.libCat) return false;
    if (ui.libShow === 'active' && !i.active) return false;
    if (ui.libShow === 'inactive' && i.active) return false;
    if (!q) return true;
    return [i.name, i.why, i.how, i.score, i.source, i.aliases.map((a) => a.name).join(' ')].join(' ').toLowerCase().includes(q);
  });
}

function viewLibrary() {
  return `
  <section class="card">
    <div class="card-head">
      <div><h2>Baza wskaźników <span class="muted">(${S.indicators.length})</span></h2><p class="muted small">Wskaźniki ze wszystkich arkuszy (SDCA v2, „na tym pracuje”, stare SDCA v1.0 i v2.0). Dodawaj je do SDCA jednym kliknięciem.</p></div>
      <button class="btn primary small" data-act="ind-new">＋ Nowy wskaźnik</button>
    </div>
    <div class="row wrap">
      <input type="search" class="grow" placeholder="Szukaj wskaźnika lub opisu…" value="${esc(ui.libQ)}" data-input="libq" aria-label="Szukaj wskaźników">
      <div class="seg" role="group" aria-label="Pokaż">
        ${[['all', 'Wszystkie'], ['active', 'W SDCA'], ['inactive', 'Poza SDCA']].map(([k, n]) => `<button class="${ui.libShow === k ? 'on' : ''}" data-act="lib-show" data-s="${k}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="chips">${['all', ...CATS].map((c) => `<button class="chip ${ui.libCat === c ? 'on' : ''}" data-act="lib-cat" data-c="${c}">${c === 'all' ? 'Wszystkie' : CAT_LABEL[c]}</button>`).join('')}</div>
  </section>
  <div id="lib-grid" class="cards">${libCards()}</div>`;
}

function libCards() {
  const list = filteredLib();
  if (!list.length) return '<p class="muted empty">Brak wskaźników dla tych filtrów.</p>';
  return list.map((i) => {
    const src = safeUrl(i.source);
    const sheets = [...new Set(i.aliases.map((a) => a.sheet))];
    return `<article class="lcard ${i.active ? 'is-active' : ''}">
      <div class="lcard-top">
        <span class="cat-dot c-${i.category}" aria-hidden="true"></span>
        <div class="grow">
          <button class="ltitle namebtn" data-act="open-ind" data-id="${i.id}">${esc(i.name)}</button>
          <div class="muted small">${CAT_LABEL[i.category]} · ${esc(i.providedBy)}${i.active ? ' · <b class="in-sdca">w SDCA</b>' : ''}</div>
        </div>
        <div class="zcol">${fmtZ(i.z)} ${badge(valuation(i.z))}</div>
      </div>
      ${i.why ? `<p class="small clamp">${esc(i.why)}</p>` : ''}
      <div class="ltags">${sheets.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}${isTV(i) ? '<span class="tag">TV</span>' : ''}</div>
      <div class="lacts">
        ${i.active ? `<button class="btn small" data-act="deactivate" data-id="${i.id}">− Usuń z SDCA</button>` : `<button class="btn primary small" data-act="activate" data-id="${i.id}">＋ Dodaj do SDCA</button>`}
        ${src ? `<a class="btn ghost small" href="${esc(src)}" target="_blank" rel="noopener noreferrer">Źródło ↗</a>` : ''}
        <button class="icon-btn" data-act="edit-ind" data-id="${i.id}" aria-label="Edytuj">✎</button>
        <button class="icon-btn danger" data-act="ind-del" data-id="${i.id}" aria-label="Usuń z bazy">🗑</button>
      </div>
    </article>`;
  }).join('');
}

/* ---------- Checklista (Submission Checklist) ---------- */
function autoCheck(item) {
  const act = active();
  const n = act.length;
  const cnt = (f) => act.filter(f).length;
  const sec = (item.section || '').toUpperCase();
  if (sec.startsWith('GENERAL')) {
    switch (item.num) {
      case 3: {
        const c = Object.fromEntries(CATS.map((k) => [k, activeBy(k).length]));
        const ok = n >= REQ.total && CATS.every((k) => c[k] >= REQ[k]);
        return { ok, text: `${n}/${REQ.total} · F ${c.fundamental}/${REQ.fundamental} · T ${c.technical}/${REQ.technical} · S ${c.sentiment}/${REQ.sentiment}` };
      }
      case 4: {
        const linked = cnt((i) => safeUrl(i.source));
        const fresh = cnt((i) => i.updatedAt === today());
        return { ok: linked === n && fresh === n && n > 0, text: `z linkiem ${linked}/${n} · Z-score z dzisiaj ${fresh}/${n}` };
      }
      case 5: {
        const tv = act.filter(isTV);
        const withSet = tv.filter((i) => i.how).length;
        return { ok: withSet === tv.length, text: `wskaźniki TradingView: ${tv.length} · z ustawieniami w opisie ${withSet}/${tv.length}` };
      }
      case 6: {
        const full = cnt((i) => !missingDesc(i));
        return { ok: full === n && n > 0, text: `pełne opisy (Why / How / Score) ${full}/${n}` };
      }
      case 7: {
        const filled = cnt((i) => i.providedBy !== 'Select');
        return { ok: filled === n && n > 0, text: `„Provided by” uzupełnione ${filled}/${n}` };
      }
      case 8: {
        const u = S.updates.filter((x) => isNum(x.avgZ)).length;
        return { ok: u >= 1 && isNum(avgZ()), text: `Market Value Z-score działa · punktów na wykresie: ${u}` };
      }
      case 9: {
        const zeroStale = cnt((i) => i.z === 0 && !i.updatedAt);
        return { ok: zeroStale === 0, text: zeroStale ? `${zeroStale} wskaźników ma Z = 0 bez aktualizacji (sprawdź)` : 'puste wiersze nie są liczone do średniej' };
      }
      default: return null;
    }
  }
  if (sec.startsWith('TERMS') && item.num === 2) {
    const adam = cnt((i) => i.providedBy === 'Adam');
    return { ok: adam <= REQ.adamMax, text: `wskaźniki z arkusza Adama: ${adam}/${REQ.adamMax}` };
  }
  return null;
}

function viewChecklist() {
  const items = S.checklist;
  const good = items.filter((i) => i.status === 'Complete' || i.status === 'Agree').length;
  const ready = items.length > 0 && good === items.length;
  const sections = [...new Set(items.map((i) => i.section))];
  return `
  <section class="card status-card ${ready ? 'ready' : 'not-ready'}">
    <div><span class="tile-label">Submission status</span><div class="status-val">${ready ? 'READY' : 'NOT READY'}</div></div>
    <div class="muted">${good} / ${items.length} pozycji: Complete / Agree</div>
  </section>
  ${sections.map((s) => `<section class="card">
    <h2 class="sec-title">${esc(s)}</h2>
    <ol class="checklist">${items.filter((i) => i.section === s).map((i) => {
      const a = autoCheck(i);
      const good_ = i.status === 'Complete' || i.status === 'Agree';
      return `<li class="${good_ ? 'done' : ''}">
        <span class="cnum">${i.num ?? ''}.</span>
        <div class="grow">
          <p>${esc(i.text)}</p>
          ${a ? `<div class="auto ${a.ok ? 'yes' : 'no'}">${a.ok ? '✓' : '✗'} Auto-kontrola: ${esc(a.text)}</div>` : ''}
        </div>
        <select data-check="${i.id}" class="${good_ ? 'st-good' : 'st-bad'}" aria-label="Status">${(i.options.length ? i.options : ['Complete', 'Not Complete']).map((o) => `<option ${i.status === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
      </li>`;
    }).join('')}</ol>
  </section>`).join('')}`;
}

/* ---------- Ustawienia ---------- */
function viewSettings() {
  let theme = 'system';
  try { theme = localStorage.getItem(THEME_KEY) || 'system'; } catch { /* ignore */ }
  return `
  <section class="card">
    <h2>Wygląd</h2>
    <div class="seg" role="group" aria-label="Motyw">${[['system', 'Systemowy'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, n]) => `<button class="${theme === k ? 'on' : ''}" data-act="theme" data-t="${k}">${n}</button>`).join('')}</div>
  </section>
  <section class="card">
    <h2>Dane</h2>
    <p class="muted small">Dane są zapisywane w tej przeglądarce, zaszyfrowane Twoim hasłem (AES-GCM). Żeby przenieść je na inne urządzenie, zrób eksport i import.</p>
    <div class="row wrap">
      <button class="btn" data-act="export-json">⬇ Eksport JSON</button>
      <label class="btn">⬆ Import JSON<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <button class="btn" data-act="csv">⬇ Eksport SDCA do CSV</button>
      <button class="btn ghost danger" data-act="reset">↺ Przywróć dane z Excela</button>
    </div>
    <p class="muted small">Uwaga: plik eksportu JSON nie jest zaszyfrowany. Przechowuj go bezpiecznie.</p>
  </section>
  <section class="card">
    <h2>Bezpieczeństwo</h2>
    <ul class="small">
      <li>Hasło jest wymagane przy każdym wejściu i po każdym odświeżeniu strony. Klucz jest trzymany tylko w pamięci.</li>
      <li>Hasła nie ma w kodzie. Dane z Excela są zaszyfrowane (PBKDF2-SHA256, ${ITER.toLocaleString('pl-PL')} iteracji + AES-GCM 256), więc bez hasła nie da się ich odczytać.</li>
      <li>To aplikacja statyczna, bez serwera. Siła ochrony zależy od siły hasła.</li>
    </ul>
    <button class="btn" data-act="lock">🔒 Zablokuj teraz</button>
  </section>
  <section class="card">
    <h2>Źródło danych</h2>
    <p class="small">Plik: <b>${esc(SEED?.source || '—')}</b>. Arkusz <b>SDCA v2</b> wyznacza aktywne wskaźniki. Pozostałe arkusze („na tym pracuje”, „stare sdca v1.0”, „stare sdca v2.0”, „Forward Testing”) uzupełniają opisy, historię, bazę wskaźników i bazę linków. „Submission Checklist” to checklista.</p>
  </section>`;
}

/* =========================================================
   MODALS
   ========================================================= */
let modalOpts = {};
function showModal(html, opt = {}) {
  modalOpts = opt;
  $('#modal-root').innerHTML = `<div class="backdrop" data-act="backdrop"><div class="modal ${opt.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(opt.label || 'Okno')}"><button class="x icon-btn" data-act="close-modal" aria-label="Zamknij">✕</button>${html}</div></div>`;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    $('#modal-root .backdrop')?.classList.add('in');
    ($('#modal-root [autofocus]') || $('#modal-root .modal input:not([type=hidden]), #modal-root .modal button:not(.x)'))?.focus();
  });
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
  modalOpts = {};
}

function toast(html, opt = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${html}</span>${opt.action ? `<button class="btn small">${esc(opt.action)}</button>` : ''}`;
  if (opt.action) $('button', el).addEventListener('click', () => { opt.onAction?.(); el.remove(); });
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), opt.ms || 4000);
  setTimeout(() => el.remove(), (opt.ms || 4000) + 400);
}
const pendingToasts = [];
const toastLater = (h) => pendingToasts.push(h);

function linkOptions(selected = '') {
  const sk = urlKey(selected);
  return Object.keys(LINK_CATS).map((c) => {
    const ls = S.links.filter((l) => l.category === c);
    return ls.length ? `<optgroup label="${LINK_CATS[c]}">${ls.map((l) => `<option value="${esc(l.url)}" ${urlKey(l.url) === sk ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}

function openIndicator(id) {
  const i = indById(id);
  if (!i) return;
  const src = safeUrl(i.source);
  const hist = indHistory(i);
  showModal(`
    <div class="modal-head">
      <span class="cat-dot c-${i.category}" aria-hidden="true"></span>
      <div><h2>${esc(i.name)}</h2><p class="muted small">${CAT_LABEL[i.category]} · Provided by: ${esc(i.providedBy)}${i.active ? ' · <b class="in-sdca">w SDCA</b>' : ' · poza SDCA'}</p></div>
    </div>
    <div class="detail-top">
      <div><span class="tile-label">Z Score</span><div class="tile-val">${fmtZ(i.z)}</div></div>
      <div>${badge(valuation(i.z), 'big')}</div>
      <div><span class="tile-label">Zmieniono</span><div>${i.updatedAt ? niceDate(i.updatedAt) : '—'}</div></div>
    </div>
    <h4>Source</h4>
    <ul class="linklist">
      ${src ? `<li><a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(src))} ↗</a></li>` : `<li class="muted">${esc(i.sourceText || 'brak linku')}</li>`}
      ${i.altLinks.map((u) => safeUrl(u) ? `<li><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(u))} ↗</a> <span class="muted small">alternatywa</span></li>` : '').join('')}
    </ul>
    ${descGrid(i)}
    ${hist.length ? `<h4>Historia Z-score</h4><table class="grid compact"><tbody>${hist.map((h) => `<tr><td>${niceDate(h.date)}</td><td class="numc">${fmtZ(h.z)}</td><td>${badge(valuation(h.z))}</td><td class="muted small">${esc(h.from)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${i.aliases.length > 1 ? `<h4>Występuje w arkuszach</h4><ul class="small">${i.aliases.map((a) => `<li><b>${esc(a.sheet)}</b>: ${esc(a.name)}</li>`).join('')}</ul>` : ''}
    <div class="row wrap modal-actions">
      <button class="btn primary" data-act="edit-ind" data-id="${i.id}">✎ Edytuj</button>
      ${i.active ? `<button class="btn" data-act="deactivate" data-id="${i.id}">− Usuń z SDCA</button>` : `<button class="btn" data-act="activate" data-id="${i.id}">＋ Dodaj do SDCA</button>`}
    </div>`, { cls: 'wide', label: i.name });
}

function openEditor(id, preset = {}) {
  const i = id ? indById(id) : { id: '', name: '', category: preset.category || 'fundamental', z: 0, providedBy: 'Select', source: '', sourceText: '', altLinks: [], why: '', how: '', score: '', tv: false, active: preset.active ?? true };
  showModal(`
    <h2>${id ? 'Edytuj wskaźnik' : 'Nowy wskaźnik'}</h2>
    <form data-form="ind" class="form" autocomplete="off">
      <input type="hidden" name="id" value="${esc(i.id)}">
      <label class="field"><span>Indicator *</span><input name="name" value="${esc(i.name)}" required maxlength="140" autofocus></label>
      <div class="grid3">
        <label class="field"><span>Kategoria</span><select name="category">${CATS.map((c) => `<option value="${c}" ${i.category === c ? 'selected' : ''}>${CAT_LABEL[c]}</option>`).join('')}</select></label>
        <label class="field"><span>Z Score</span><input name="z" type="number" step="0.01" inputmode="decimal" value="${isNum(i.z) ? i.z : ''}"></label>
        <label class="field"><span>Provided by</span><select name="providedBy">${PROVIDED_BY.map((p) => `<option ${i.providedBy === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Source (link)</span><input name="source" type="url" placeholder="https://…" value="${esc(i.source)}"></label>
      <label class="field"><span>…albo wybierz z bazy linków</span><select data-change="pick-src"><option value="">— wybierz —</option>${linkOptions(i.source)}</select></label>
      <label class="field"><span>Linki alternatywne (jeden w linii)</span><textarea name="alt" rows="2" placeholder="https://web.archive.org/…">${esc(i.altLinks.join('\n'))}</textarea></label>
      <label class="field"><span>Why did you choose this indicator?</span><textarea name="why" rows="4" placeholder="${esc(HINTS.why)}">${esc(i.why)}</textarea></label>
      <label class="field"><span>How does the indicator work? (ustawienia TV i timeframe)</span><textarea name="how" rows="3" placeholder="${esc(HINTS.how)}">${esc(i.how)}</textarea></label>
      <label class="field"><span>What is Positive and Negative Score?</span><textarea name="score" rows="3" placeholder="${esc(HINTS.score)}">${esc(i.score)}</textarea></label>
      <div class="row wrap">
        <label class="check"><input type="checkbox" name="tv" ${i.tv ? 'checked' : ''}> Wskaźnik TradingView</label>
        <label class="check"><input type="checkbox" name="active" ${i.active ? 'checked' : ''}> Aktywny w SDCA</label>
      </div>
      <div class="row wrap modal-actions">
        <button class="btn primary" type="submit">Zapisz</button>
        <button class="btn ghost" type="button" data-act="close-modal">Anuluj</button>
      </div>
    </form>`, { cls: 'wide', label: 'Edycja wskaźnika' });
}

function openAddIndicator(cat) {
  const render_ = (c, q = '') => {
    const ql = q.toLowerCase();
    const list = S.indicators.filter((i) => !i.active && (c === 'all' || i.category === c) && (!ql || i.name.toLowerCase().includes(ql)));
    return list.length ? list.map((i) => `<li class="pick">
      <span class="cat-dot c-${i.category}" aria-hidden="true"></span>
      <div class="grow"><b>${esc(i.name)}</b><div class="muted small">${CAT_LABEL[i.category]} · ${esc(i.providedBy)} · ostatni Z ${fmtZ(i.z)}</div></div>
      ${badge(valuation(i.z))}
      <button class="btn primary small" data-act="activate" data-id="${i.id}" data-keep="1">Dodaj</button>
    </li>`).join('') : '<li class="muted small">Brak wskaźników poza SDCA dla tego filtra.</li>';
  };
  showModal(`
    <h2>Dodaj wskaźnik do SDCA</h2>
    <p class="muted small">Wybierz z bazy wskaźników (z innych arkuszy) albo utwórz nowy.</p>
    <div class="row wrap">
      <select data-change="add-cat" id="add-cat" aria-label="Kategoria"><option value="all">Wszystkie kategorie</option>${CATS.map((c) => `<option value="${c}" ${cat === c ? 'selected' : ''}>${CAT_LABEL[c]}</option>`).join('')}</select>
      <input type="search" class="grow" id="add-q" placeholder="Szukaj…" data-input="addq" aria-label="Szukaj">
      <button class="btn" data-act="ind-new" data-cat="${cat || ''}">＋ Nowy wskaźnik</button>
    </div>
    <ul class="picklist" id="picklist">${render_(cat || 'all')}</ul>`, { cls: 'wide', label: 'Dodaj wskaźnik', renderPick: render_ });
}

function openSnapshot() {
  const a = avgZ();
  if (!isNum(a)) { toast('Brak wskaźników z Z-score – nie ma czego zapisać.'); return; }
  const n = active().filter((i) => isNum(i.z)).length;
  showModal(`
    <h2>Zapisz aktualizację</h2>
    <p class="muted small">Zapisuje bieżące Z-score wszystkich aktywnych wskaźników do listy aktualizacji (wykres Market Value Z-score) i ustawia „Date updated”.</p>
    <div class="detail-top">
      <div><span class="tile-label">Avg Z</span><div class="tile-val">${fmtZ(a)}</div></div>
      <div><span class="tile-label">Market Value Z</span><div class="tile-val">${fmtZ(-a)}</div></div>
      <div>${badge(valuation(a), 'big')}<div class="muted small">${n} wskaźników</div></div>
    </div>
    <form data-form="snapshot" class="form">
      <label class="field"><span>Data</span><input type="date" name="date" value="${today()}" required></label>
      <label class="field"><span>Notatka (opcjonalnie)</span><input name="note" maxlength="200" placeholder="np. cotygodniowa aktualizacja"></label>
      <div class="row wrap modal-actions"><button class="btn primary" type="submit">💾 Zapisz</button><button class="btn ghost" type="button" data-act="close-modal">Anuluj</button></div>
    </form>`, { label: 'Zapisz aktualizację' });
}

function openUpdateEditor(id) {
  const u = id ? S.updates.find((x) => x.id === id) : { id: '', date: today(), avgZ: 0, note: '', count: null };
  showModal(`
    <h2>${id ? 'Edytuj aktualizację' : 'Dodaj aktualizację ręcznie'}</h2>
    <form data-form="update" class="form">
      <input type="hidden" name="id" value="${esc(u.id)}">
      <label class="field"><span>Data</span><input type="date" name="date" value="${esc(u.date)}" required></label>
      <div class="grid2">
        <label class="field"><span>Avg Z Score</span><input type="number" step="0.0001" name="avgZ" value="${isNum(u.avgZ) ? round2(u.avgZ * 100) / 100 : ''}" data-input="avg-link" required></label>
        <label class="field"><span>Market Value Z-score</span><input type="number" step="0.0001" name="marketZ" value="${isNum(u.avgZ) ? round2(-u.avgZ * 100) / 100 : ''}" data-input="market-link"></label>
      </div>
      <label class="field"><span>Liczba wskaźników</span><input type="number" min="0" name="count" value="${u.count ?? ''}"></label>
      <label class="field"><span>Notatka</span><input name="note" maxlength="200" value="${esc(u.note || '')}"></label>
      ${u.values ? '<p class="muted small">Ta aktualizacja ma zapisane wartości poszczególnych wskaźników. Zmiana Avg Z nie zmienia tych wartości.</p>' : ''}
      <div class="row wrap modal-actions"><button class="btn primary" type="submit">Zapisz</button><button class="btn ghost" type="button" data-act="close-modal">Anuluj</button></div>
    </form>`, { label: 'Aktualizacja' });
}

function openUpdateView(id) {
  const u = S.updates.find((x) => x.id === id);
  if (!u) return;
  const rows = Object.entries(u.values || {}).map(([k, z]) => ({ ind: indById(k), z })).sort((a, b) => (a.ind ? CATS.indexOf(a.ind.category) : 9) - (b.ind ? CATS.indexOf(b.ind.category) : 9));
  showModal(`
    <h2>Aktualizacja ${niceDate(u.date)}</h2>
    <div class="detail-top">
      <div><span class="tile-label">Avg Z</span><div class="tile-val">${fmtZ(u.avgZ)}</div></div>
      <div><span class="tile-label">Market Value Z</span><div class="tile-val">${fmtZ(-u.avgZ)}</div></div>
      <div>${badge(valuation(u.avgZ), 'big')}</div>
    </div>
    ${u.note ? `<p class="muted">${esc(u.note)}</p>` : ''}
    <table class="grid compact"><thead><tr><th>Indicator</th><th>Kategoria</th><th>Z</th><th>Result</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r.ind ? `<button class="namebtn" data-act="open-ind" data-id="${r.ind.id}">${esc(r.ind.name)}</button>` : '<span class="muted">(usunięty)</span>'}</td><td>${r.ind ? CAT_LABEL[r.ind.category] : ''}</td><td class="numc">${fmtZ(r.z)}</td><td>${badge(valuation(r.z))}</td></tr>`).join('')}
    </tbody></table>`, { cls: 'wide', label: 'Szczegóły aktualizacji' });
}

function openLinkEditor(id) {
  const l = id ? S.links.find((x) => x.id === id) : { id: '', url: '', title: '', category: 'research', tags: [], note: '' };
  showModal(`
    <h2>${id ? 'Edytuj link' : 'Dodaj link'}</h2>
    <form data-form="link" class="form" autocomplete="off">
      <input type="hidden" name="id" value="${esc(l.id)}">
      <label class="field"><span>URL *</span><input name="url" type="url" required value="${esc(l.url)}" placeholder="https://…" autofocus></label>
      <label class="field"><span>Nazwa</span><input name="title" maxlength="140" value="${esc(l.title)}" placeholder="np. MVRV Z-Score — Checkonchain"></label>
      <div class="grid2">
        <label class="field"><span>Kategoria</span><select name="category">${Object.entries(LINK_CATS).map(([k, n]) => `<option value="${k}" ${l.category === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Tagi (po przecinku)</span><input name="tags" value="${esc((l.tags || []).join(', '))}"></label>
      </div>
      <label class="field"><span>Notatka</span><textarea name="note" rows="2">${esc(l.note || '')}</textarea></label>
      <div class="row wrap modal-actions"><button class="btn primary" type="submit">Zapisz</button><button class="btn ghost" type="button" data-act="close-modal">Anuluj</button></div>
    </form>`, { label: 'Link' });
}

/* =========================================================
   MUTATIONS
   ========================================================= */
function ensureLink(url, cat, title) {
  const u = safeUrl(url);
  if (!u || S.links.some((l) => urlKey(l.url) === urlKey(u))) return;
  S.links.push({ id: uid('l'), url: u, title: title || hostOf(u), site: hostOf(u), category: cat || 'research', tags: [], note: '', origins: [] });
}
function setZ(i, v) {
  const z = v === '' || v == null ? null : round2(Number(v));
  if (z !== null && !isNum(z)) return;
  i.z = z;
  i.updatedAt = today();
  save();
}
function setActive(i, on) {
  i.active = on;
  if (on) i.order = Math.max(-1, ...S.indicators.filter((x) => x.active && x !== i).map((x) => x.order)) + 1;
  save();
}

/* =========================================================
   EVENTS
   ========================================================= */
const ACTIONS = {
  view(el) { ui.view = el.dataset.v; history.replaceState(null, '', '#' + ui.view); render(); scrollTo(0, 0); },
  lock() { lock(); },
  'pw-toggle'(el) { const i = $('input[name=password]'); i.type = i.type === 'password' ? 'text' : 'password'; el.setAttribute('aria-label', i.type === 'password' ? 'Pokaż hasło' : 'Ukryj hasło'); },
  backdrop(el, e) { if (e.target === el) closeModal(); },
  'close-modal'() { closeModal(); },
  'open-ind'(el) { openIndicator(el.dataset.id); },
  'edit-ind'(el) { openEditor(el.dataset.id); },
  'ind-new'(el) { openEditor(null, { category: el.dataset.cat || (ui.libCat !== 'all' ? ui.libCat : 'fundamental'), active: ui.view === 'sdca' || !!el.dataset.cat }); },
  'add-ind'(el) { openAddIndicator(el.dataset.cat || ''); },
  'toggle-desc'(el) { const id = el.dataset.id; ui.expanded.has(id) ? ui.expanded.delete(id) : ui.expanded.add(id); render(); },
  'expand-all'() { if (ui.expanded.size) ui.expanded.clear(); else active().forEach((i) => ui.expanded.add(i.id)); render(); },
  'z-step'(el) {
    const i = indById(el.dataset.id);
    setZ(i, round2((isNum(i.z) ? i.z : 0) + Number(el.dataset.d)));
    render();
  },
  move(el) {
    const i = indById(el.dataset.id);
    const list = activeBy(i.category);
    const k = list.indexOf(i), j = k + Number(el.dataset.d);
    if (j < 0 || j >= list.length) return;
    [list[k].order, list[j].order] = [list[j].order, list[k].order];
    save();
    render();
  },
  deactivate(el) {
    const i = indById(el.dataset.id);
    setActive(i, false);
    if (modalOpts.label === i.name) closeModal();
    render();
    toast(`„${esc(i.name)}” usunięto z SDCA (zostaje w bazie wskaźników).`, { action: 'Cofnij', onAction: () => { setActive(i, true); render(); } });
  },
  activate(el) {
    const i = indById(el.dataset.id);
    setActive(i, true);
    if (el.dataset.keep && modalOpts.renderPick) {
      el.closest('li')?.remove();
    } else if (modalOpts.label === i.name) closeModal();
    render();
    toast(`„${esc(i.name)}” dodano do SDCA (${CAT_LABEL[i.category]}).`);
  },
  'ind-del'(el) {
    const i = indById(el.dataset.id);
    if (!confirm(`Usunąć „${i.name}” na stałe z bazy wskaźników?`)) return;
    const idx = S.indicators.indexOf(i);
    S.indicators.splice(idx, 1);
    save();
    render();
    toast(`Usunięto „${esc(i.name)}”.`, { action: 'Cofnij', onAction: () => { S.indicators.splice(idx, 0, i); save(); render(); } });
  },
  'date-today'() { S.dateUpdated = today(); save(); render(); },
  snapshot() { openSnapshot(); },
  'update-new'() { openUpdateEditor(null); },
  'update-edit'(el) { openUpdateEditor(el.dataset.id); },
  'update-view'(el) { openUpdateView(el.dataset.id); },
  'update-del'(el) {
    const u = S.updates.find((x) => x.id === el.dataset.id);
    if (!u || !confirm(`Usunąć aktualizację z ${niceDate(u.date)}?`)) return;
    S.updates = S.updates.filter((x) => x !== u);
    save();
    render();
    toast('Usunięto aktualizację.', { action: 'Cofnij', onAction: () => { S.updates.push(u); save(); render(); } });
  },
  series(el) { ui.chartSeries = el.dataset.s; render(); },
  'link-cat'(el) { ui.linkCat = el.dataset.c; render(); },
  'link-new'() { openLinkEditor(null); },
  'link-edit'(el) { openLinkEditor(el.dataset.id); },
  'link-del'(el) {
    const l = S.links.find((x) => x.id === el.dataset.id);
    const users = usedBy(l.url);
    if (!confirm(`Usunąć link „${l.title}”?${users.length ? `\nJest źródłem dla: ${users.map((i) => i.name).join(', ')} (wskaźniki zachowają adres).` : ''}`)) return;
    const idx = S.links.indexOf(l);
    S.links.splice(idx, 1);
    save();
    render();
    toast('Usunięto link.', { action: 'Cofnij', onAction: () => { S.links.splice(idx, 0, l); save(); render(); } });
  },
  async 'link-copy'(el) {
    const l = S.links.find((x) => x.id === el.dataset.id);
    try { await navigator.clipboard.writeText(l.url); toast('Skopiowano link.'); } catch { prompt('Skopiuj link:', l.url); }
  },
  'lib-cat'(el) { ui.libCat = el.dataset.c; render(); },
  'lib-show'(el) { ui.libShow = el.dataset.s; render(); },
  theme(el) {
    try { localStorage.setItem(THEME_KEY, el.dataset.t); } catch { /* ignore */ }
    applyTheme();
    render();
  },
  csv() { exportCSV(); },
  'export-json'() {
    if (!confirm('Plik eksportu NIE będzie zaszyfrowany. Kontynuować?')) return;
    download(`sdca-backup-${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
  },
  reset() {
    if (!confirm('Przywrócić dane z pliku Excel? Twoje zmiany (Z-score, wskaźniki, linki, aktualizacje, checklista) zostaną zastąpione.')) return;
    S = fromSeed(SEED);
    save();
    render();
    toast('Przywrócono dane z Excela.');
  },
};

const FORMS = {
  async login(form) {
    const btn = $('button[type=submit]', form);
    const pw = new FormData(form).get('password') || '';
    if (Date.now() < lockedUntil) {
      $('.login-err').textContent = `Zbyt wiele prób. Spróbuj za ${Math.ceil((lockedUntil - Date.now()) / 1000)} s.`;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sprawdzanie…';
    try {
      await login(String(pw));
      failCount = 0;
      ui.view = VIEWS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'sdca';
      render();
      pendingToasts.splice(0).forEach((t) => toast(t, { ms: 7000 }));
    } catch (e) {
      failCount++;
      if (failCount >= 5) { lockedUntil = Date.now() + 30000; failCount = 0; }
      const msg = e.message === 'bad-password' ? 'Nieprawidłowe hasło.' : (!window.crypto?.subtle ? 'Przeglądarka nie obsługuje szyfrowania (wymagane HTTPS).' : 'Błąd: ' + e.message);
      renderLogin(msg);
    }
  },
  ind(form) {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const srcRaw = String(fd.get('source') || '').trim();
    const src = safeUrl(srcRaw);
    if (srcRaw && !src) { toast('Link źródła musi zaczynać się od http:// lub https://'); return; }
    const zRaw = String(fd.get('z') ?? '').trim();
    const z = zRaw === '' ? null : round2(Number(zRaw));
    const alt = String(fd.get('alt') || '').split('\n').map((s) => safeUrl(s.trim())).filter(Boolean);
    const id = fd.get('id');
    let i = id ? indById(id) : null;
    const wasActive = i?.active;
    if (!i) {
      i = { id: uid('i'), aliases: [], history: [], order: 0, updatedAt: null, sourceText: '', descFrom: null };
      S.indicators.push(i);
    }
    if (i.z !== z) i.updatedAt = today();
    Object.assign(i, {
      name, category: fd.get('category'), z, providedBy: fd.get('providedBy'),
      source: src, altLinks: alt, why: String(fd.get('why') || '').trim(), how: String(fd.get('how') || '').trim(),
      score: String(fd.get('score') || '').trim(), tv: !!fd.get('tv'),
    });
    if (src) i.sourceText = '';
    const act = !!fd.get('active');
    if (act !== !!wasActive || !id) setActive(i, act);
    ensureLink(src, i.category, `${name} — ${hostOf(src)}`);
    alt.forEach((u) => ensureLink(u, i.category, `${name} — ${hostOf(u)}`));
    save();
    closeModal();
    render();
    toast(`Zapisano „${esc(name)}”.`);
  },
  snapshot(form) {
    const fd = new FormData(form);
    const date = fd.get('date') || today();
    const list = active().filter((i) => isNum(i.z));
    const a = avgZ(list);
    const existing = S.updates.find((u) => u.date === date);
    if (existing && !confirm(`Aktualizacja z ${niceDate(date)} już istnieje. Zastąpić ją?`)) return;
    if (existing) S.updates = S.updates.filter((u) => u !== existing);
    S.updates.push({ id: uid('u'), date, avgZ: Math.round(a * 1e6) / 1e6, count: list.length, values: Object.fromEntries(list.map((i) => [i.id, i.z])), note: String(fd.get('note') || '').trim() });
    S.dateUpdated = date;
    save();
    closeModal();
    render();
    toast(`💾 Zapisano aktualizację ${niceDate(date)} · Market Value Z ${fmtZ(-a)}.`);
  },
  update(form) {
    const fd = new FormData(form);
    const avg = Number(fd.get('avgZ'));
    if (!isNum(avg)) return;
    const id = fd.get('id');
    const countRaw = String(fd.get('count') || '').trim();
    const data = { date: fd.get('date'), avgZ: avg, note: String(fd.get('note') || '').trim(), count: countRaw === '' ? null : Number(countRaw) };
    if (id) Object.assign(S.updates.find((u) => u.id === id), data);
    else S.updates.push({ id: uid('u'), ...data, values: null });
    save();
    closeModal();
    render();
  },
  link(form) {
    const fd = new FormData(form);
    const url = safeUrl(fd.get('url'));
    if (!url) { toast('Podaj poprawny adres (http/https).'); return; }
    const id = fd.get('id');
    const dup = S.links.find((l) => urlKey(l.url) === urlKey(url) && l.id !== id);
    if (dup) { toast(`Ten link już jest w bazie: „${esc(dup.title)}”.`); return; }
    const data = {
      url, title: String(fd.get('title') || '').trim() || hostOf(url), site: hostOf(url), category: fd.get('category'),
      tags: String(fd.get('tags') || '').split(',').map((s) => s.trim()).filter(Boolean), note: String(fd.get('note') || '').trim(),
    };
    if (id) Object.assign(S.links.find((l) => l.id === id), data);
    else S.links.push({ id: uid('l'), origins: [], ...data });
    save();
    closeModal();
    render();
  },
};

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['SDCA', 'DATE UPDATED:', S.dateUpdated || ''], [], ['Category', 'Indicator', 'Result', 'Why did you choose this indicator?', 'How does the indicator work?', 'What is Positive and Negative Score?', 'Provided by', 'Z Score', 'Source']];
  for (const c of CATS) {
    for (const i of activeBy(c)) rows.push([S.categories[c]?.name || CAT_LABEL[c], i.name, valuation(i.z) || '', i.why, i.how, i.score, i.providedBy, isNum(i.z) ? i.z : '', i.source || i.sourceText]);
  }
  const a = avgZ();
  rows.push([], ['', 'Avg Z Score', valuation(a) || '', '', '', '', '', isNum(a) ? round2(a * 10000) / 10000 : ''], ['', 'Avg Z Score multiplied by -1', valuation(isNum(a) ? -a : null) || '', '', '', '', '', isNum(a) ? round2(-a * 10000) / 10000 : '']);
  rows.push([], ['Date', 'Avg Z Score', 'Market Value Z-score', 'Note']);
  for (const u of sortedUpdates()) rows.push([u.date, u.avgZ, isNum(u.avgZ) ? -u.avgZ : '', u.note || '']);
  download(`sdca-${today()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  FORMS[f.dataset.form]?.(f);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#modal-root .backdrop')) closeModal();
});
document.addEventListener('input', (e) => {
  const el = e.target, k = el.dataset.input;
  if (k === 'linkq') { ui.linkQ = el.value; $('#link-grid').innerHTML = linkCards(); }
  if (k === 'libq') { ui.libQ = el.value; $('#lib-grid').innerHTML = libCards(); }
  if (k === 'addq' && modalOpts.renderPick) $('#picklist').innerHTML = modalOpts.renderPick($('#add-cat').value, el.value);
  if (k === 'avg-link') { const m = $('input[name=marketZ]'); if (m) m.value = el.value === '' ? '' : String(-Number(el.value)); }
  if (k === 'market-link') { const a = $('input[name=avgZ]'); if (a) a.value = el.value === '' ? '' : String(-Number(el.value)); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.z) { setZ(indById(el.dataset.z), el.value); render(); return; }
  if (el.dataset.pb) { const i = indById(el.dataset.pb); i.providedBy = el.value; save(); render(); return; }
  if (el.dataset.check) { const c = S.checklist.find((x) => x.id === el.dataset.check); c.status = el.value; save(); render(); return; }
  const k = el.dataset.change;
  if (k === 'date-updated') { S.dateUpdated = el.value; save(); render(); }
  if (k === 'link-used') { ui.linkUsed = el.checked; $('#link-grid').innerHTML = linkCards(); }
  if (k === 'pick-src' && el.value) { $('input[name=source]').value = el.value; }
  if (k === 'add-cat' && modalOpts.renderPick) $('#picklist').innerHTML = modalOpts.renderPick(el.value, $('#add-q').value);
  if (k === 'quick-open' && el.value) {
    const l = S.links.find((x) => x.id === el.value);
    const u = l && safeUrl(l.url);
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
    el.value = '';
  }
  if (k === 'import') {
    const file = el.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!Array.isArray(data.indicators) || !Array.isArray(data.links)) throw new Error('format');
        if (!confirm('Zastąpić obecne dane danymi z pliku?')) return;
        S = migrate(data);
        save();
        render();
        toast('Zaimportowano dane.');
      } catch {
        toast('To nie wygląda na kopię danych SDCA.');
      }
    };
    rd.readAsText(file);
    el.value = '';
  }
});
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (S && ui.view === 'chart') drawChart(); }, 150); });
document.addEventListener('visibilitychange', () => { if (document.hidden && KEY) flushSave(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) lock(); });

/* ---------- boot ---------- */
applyTheme();
renderLogin();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
