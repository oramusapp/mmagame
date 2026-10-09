'use strict';

/* =========================================================
   FIGHT CAMP — plan treningowy MMA jako gra
   Wszystkie dane zapisywane lokalnie w przeglądarce (localStorage).
   ========================================================= */

const STORE_KEY = 'fightcamp.v1';

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const today = () => dkey();
const yesterday = () => dkey(addDays(new Date(), -1));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const DAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function niceDate(k) {
  if (!k) return '';
  if (k === today()) return 'dziś';
  if (k === yesterday()) return 'wczoraj';
  if (k === dkey(addDays(new Date(), 1))) return 'jutro';
  const d = parseKey(k);
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}.${pad(d.getMonth() + 1)}`;
}
function timeAgo(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'teraz';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} d`;
}

/* ---------- static game data ---------- */
const STATS = {
  sila: { name: 'Siła', icon: '💪' },
  kondycja: { name: 'Kondycja', icon: '🫀' },
  technika: { name: 'Technika', icon: '🥋' },
  dyscyplina: { name: 'Dyscyplina', icon: '🧠' },
};

const WARMUP_STEPS = [
  'Przeskoki dostawne',
  'Stepy + rotacja bioder (zmiana pozycji)',
  'Naprzemiennie nogi',
  'Walka z cieniem',
  'Drabinka',
  'Beterbiev pushups',
];

const DEFAULT_WORKOUTS = {
  mma: { name: 'Trening MMA', icon: '🥊', xp: 60, stats: { technika: 1, kondycja: 0.6 }, exercises: [] },
  strA: {
    name: 'Siła A', icon: '🏋️', xp: 50, stats: { sila: 1, kondycja: 0.3 },
    exercises: [
      '1a B Incline Press', '1b Rzut jednorącz', '2a Pull Up', '2b Ball slam', '2c Cuban press',
      '3a Zercher Squat', '3b Skoki z kolan', '4 Nordic Ham', '5 Skos landmine', '6 Rotacje z piłką',
      '7 Alternating DB curl', '8 Incline DB Y-raise', '9 Brzuch wznosy',
    ],
  },
  strB: {
    name: 'Siła B', icon: '🏋️', xp: 50, stats: { sila: 1, kondycja: 0.3 },
    exercises: [
      '1a RDL', '1b Leg extension', '1c BB row', '2a Hip thrust (plecy na ziemi)', '2b Bulgarian split squat',
      '3a Dip', '3b Lat pulldown', '4a Landmine krok dostawny', '4b Guma skosy', '5 EZ bar preacher curl',
      '6 Machine lateral raise', '7 Dragon flag',
    ],
  },
  sprint: { name: 'Sprinty + Kickboxing', icon: '⚡', xp: 50, stats: { kondycja: 1, technika: 0.5 }, exercises: [] },
  mobility: { name: 'Mobility', icon: '🧘', xp: 20, stats: { kondycja: 0.5, dyscyplina: 0.5 }, exercises: [] },
  other: { name: 'Inny trening', icon: '💪', xp: 30, stats: { kondycja: 0.7, sila: 0.3 }, exercises: [] },
};

const KINDS = {
  work: { icon: '💻', xp: 30, stats: { dyscyplina: 1 } },
  warmup: { icon: '🔥', xp: 20, stats: { kondycja: 0.5, dyscyplina: 0.5 } },
  mobility: { icon: '🧘', xp: 10, stats: { kondycja: 0.5, dyscyplina: 0.5 } },
  training: { icon: '🥊', xp: 0, stats: {} },
  rest: { icon: '😌', xp: 15, stats: { dyscyplina: 1 } },
  church: { icon: '⛪', xp: 15, stats: { dyscyplina: 1 } },
  other: { icon: '📌', xp: 15, stats: { dyscyplina: 1 } },
};
const itemXp = (it) => (KINDS[it.kind]?.xp ?? 15) + (it.prio ? 10 : 0);
const kindCounter = (k) => (k === 'work' ? { work: 1 } : k === 'warmup' ? { warmups: 1 } : {});

function inferKind(text) {
  const s = text.toLowerCase();
  if (/rozgrzew|warm/.test(s)) return 'warmup';
  if (/mobil|stretch|rozciąg/.test(s)) return 'mobility';
  if (/praca|trw|robot/.test(s)) return 'work';
  if (/trening|mma|siła|sila|sprint|kickbox|sparing|siłown/.test(s)) return 'training';
  if (/odpocz|regener|rest/.test(s)) return 'rest';
  if (/kości|church|msza/.test(s)) return 'church';
  return 'other';
}

const mk = (kind, text, prio = false, extra = {}) => ({ id: uid(), kind, text, prio, ...extra });
function defaultPlan() {
  const mmaDay = () => ({
    focus: 'Dzień MMA – PRIORYTET',
    workout: 'mma',
    items: [
      mk('work', 'Po robocie: praca w domu (TRW) do 19:00', true),
      mk('warmup', 'Warm-up Protocol'),
      mk('mobility', 'Mobility przed treningiem'),
      mk('training', 'Trening MMA', true, { workout: 'mma' }),
      mk('mobility', 'Mobility po treningu'),
    ],
  });
  const strDay = (w, name) => ({
    focus: `Siłownia – ${name}`,
    workout: w,
    items: [
      mk('warmup', 'Warm-up Protocol'),
      mk('mobility', 'Mobility przed treningiem'),
      mk('training', `Trening: ${name}`, true, { workout: w }),
      mk('mobility', 'Mobility po treningu'),
    ],
  });
  return {
    workouts: clone(DEFAULT_WORKOUTS),
    days: {
      1: mmaDay(),
      2: strDay('strA', 'Siła A'),
      3: mmaDay(),
      4: strDay('strB', 'Siła B'),
      5: mmaDay(),
      6: {
        focus: 'Sprinty + kickboxing',
        workout: 'sprint',
        items: [
          mk('warmup', 'Warm-up Protocol'),
          mk('training', 'Sprinty + kickboxing', true, { workout: 'sprint' }),
          mk('mobility', 'Mobility po treningu'),
        ],
      },
      0: {
        focus: 'Odpoczynek i kościół',
        workout: '',
        items: [mk('rest', 'Odpoczynek / regeneracja'), mk('church', 'Kościół')],
      },
    },
  };
}

const DEFAULT_RULES = [
  'Pon / Śr / Pt – trening MMA to PRIORYTET.',
  'Po robocie, czekając na trening – do 19:00 praca w domu (TRW). PRIORYTET.',
  'Przed każdym treningiem: Warm-up Protocol.',
  'Mobility przed i po treningu.',
  'Wt / Czw – siłownia (Siła A / Siła B).',
  'Sobota – sprinty + kickboxing.',
  'Niedziela – odpoczynek i kościół.',
];

const COACH = [
  'Nie musisz mieć ochoty. Musisz się pojawić.',
  'Rozgrzewka to nie opcja – to pierwsza runda.',
  'Mistrzów robi się w dni, w które nikt nie patrzy.',
  'Jedna runda więcej niż wczoraj.',
  'Dyscyplina bije motywację na punkty i przez KO.',
  'Zmęczenie mija. Rekord zostaje.',
  'Najpierw technika, potem siła, ego nigdy.',
  'Priorytety to nie lista życzeń. To plan walki.',
  'Odpoczynek też jest treningiem. Szanuj niedzielę.',
];

const BOSSES = [
  { name: 'Kanapa Kowalski', emoji: '🛋️', taunts: ['Usiądź na chwilkę… tylko 5 minut.', 'Trening? Jutro też jest dzień.', 'Moje poduszki są takie miękkie…'] },
  { name: 'Scrollator 3000', emoji: '📱', taunts: ['Jeszcze jeden filmik i idziesz.', 'Nieskończony feed czeka!', 'Kto potrzebuje rund, gdy są rolki?'] },
  { name: 'Pizza Pete', emoji: '🍕', taunts: ['Dodatkowy ser? Zasłużyłeś.', 'Waga? Jaka waga?', 'Cheat meal to stan umysłu.'] },
  { name: 'Pan Drzemka', emoji: '😴', taunts: ['Drzemka 20 minut… albo 3 godziny.', 'Budzik to tylko sugestia.', 'Zzz… rozgrzewka? Zzz…'] },
  { name: 'Sir Wymówka', emoji: '🤥', taunts: ['Dziś pada, to się nie liczy.', 'Bolało cię wczoraj, odpuść.', 'Zaczniesz od poniedziałku.'] },
  { name: 'Prokrastynator', emoji: '⏰', taunts: ['Zrobisz to później. Obiecuję.', 'Najpierw kawa. Potem druga kawa.', 'Deadline to problem przyszłego ciebie.'] },
  { name: 'Donut Dariusz', emoji: '🍩', taunts: ['Słodki cios w twój plan.', 'Cukier to też energia, nie?', 'Jeden pączek nikomu nie zaszkodził…'] },
  { name: 'Serialowy Szogun', emoji: '📺', taunts: ['Następny odcinek za 5… 4… 3…', 'Tylko jeden sezon.', 'Klatka? Wolę kanapę i pilota.'] },
];

const RANKS = [
  { lvl: 1, name: 'Świeżak', belt: '#f2f2f2' },
  { lvl: 3, name: 'Amator', belt: '#3a86ff' },
  { lvl: 6, name: 'Zawodnik', belt: '#9b5de5' },
  { lvl: 10, name: 'Prospekt', belt: '#a0522d' },
  { lvl: 15, name: 'Pretendent', belt: '#1b1b1b' },
  { lvl: 20, name: 'Mistrz', belt: '#f4c430' },
  { lvl: 30, name: 'Legenda', belt: '#e63946' },
  { lvl: 40, name: 'GOAT', belt: '#2ec4b6' },
];

const AVATARS = [
  { e: '🥊', cost: 0 }, { e: '👊', cost: 0 }, { e: '😤', cost: 0 },
  { e: '🦊', cost: 120 }, { e: '🐺', cost: 200 }, { e: '🦁', cost: 300 }, { e: '🐻', cost: 300 },
  { e: '🦍', cost: 450 }, { e: '🐯', cost: 450 }, { e: '🦈', cost: 600 }, { e: '🐉', cost: 900 }, { e: '👑', cost: 1500 },
];
const RARE_AVATARS = ['🥷', '🤖', '👹', '🦅'];
const TITLES = [
  { t: 'Młot', cost: 150 }, { t: 'Bestia z klatki', cost: 250 }, { t: 'Cichy Zabójca', cost: 300 },
  { t: 'Maszyna', cost: 400 }, { t: 'Beterbiev Jr.', cost: 600 }, { t: 'Król Parteru', cost: 800 }, { t: 'Niezniszczalny', cost: 1200 },
];

const CATS = {
  praca: { name: 'Praca', icon: '💼', stat: 'dyscyplina' },
  trening: { name: 'Trening', icon: '🥊', stat: 'kondycja' },
  dom: { name: 'Dom', icon: '🏠', stat: 'dyscyplina' },
  nauka: { name: 'Nauka', icon: '📚', stat: 'technika' },
  inne: { name: 'Inne', icon: '📌', stat: 'dyscyplina' },
};

const MOODS = ['😫', '😕', '😐', '🙂', '💪', '🔥'];

const TIMER_PRESETS = [
  { n: 'MMA 3×5', rounds: 3, work: 300, rest: 60 },
  { n: 'Boks 3×3', rounds: 3, work: 180, rest: 60 },
  { n: 'Shadow 5×3', rounds: 5, work: 180, rest: 60 },
  { n: 'Sparing 6×3', rounds: 6, work: 180, rest: 60 },
  { n: 'Tabata', rounds: 8, work: 20, rest: 10 },
];

const cnt = (k) => state.counters[k] || 0;
const ACH = [
  { id: 't1', icon: '🩸', name: 'Pierwsza krew', desc: 'Ukończ pierwsze zadanie', ok: () => cnt('tasks') >= 1 },
  { id: 't50', icon: '⚙️', name: 'Maszyna do zadań', desc: 'Ukończ 50 zadań', ok: () => cnt('tasks') >= 50 },
  { id: 's1', icon: '🔔', name: 'Pierwszy gong', desc: 'Zapisz pierwszy trening', ok: () => cnt('sessions') >= 1 },
  { id: 'mma10', icon: '🥊', name: 'Klatka to mój dom', desc: '10 treningów MMA', ok: () => cnt('mma') >= 10 },
  { id: 's50', icon: '🏟️', name: 'Weteran obozu', desc: '50 treningów w dzienniku', ok: () => cnt('sessions') >= 50 },
  { id: 'w10', icon: '🔥', name: 'Rozgrzany', desc: '10× Warm-up Protocol', ok: () => cnt('warmups') >= 10 },
  { id: 'trw', icon: '💻', name: 'Etat bojownika', desc: '10× praca TRW do 19:00', ok: () => cnt('work') >= 10 },
  { id: 'pr1', icon: '🏆', name: 'Nowy rekord', desc: 'Pobij pierwszy rekord (PR)', ok: () => cnt('prs') >= 1 },
  { id: 'pr10', icon: '📈', name: 'Progres to styl życia', desc: 'Pobij 10 rekordów', ok: () => cnt('prs') >= 10 },
  { id: 'st3', icon: '✨', name: 'Rozpęd', desc: 'Seria 3 dni', ok: () => state.streak.best >= 3 },
  { id: 'st7', icon: '🔥', name: 'Tydzień ognia', desc: 'Seria 7 dni', ok: () => state.streak.best >= 7 },
  { id: 'st30', icon: '☄️', name: 'Nie do zatrzymania', desc: 'Seria 30 dni', ok: () => state.streak.best >= 30 },
  { id: 'ko1', icon: '💥', name: 'Nokaut!', desc: 'Znokautuj pierwszego rywala', ok: () => state.record.w >= 1 },
  { id: 'ko5', icon: '🥇', name: 'Seryjny nokauter', desc: '5 nokautów', ok: () => state.record.w >= 5 },
  { id: 'fd1', icon: '💯', name: 'Perfekcyjny dzień', desc: 'Zalicz wszystkie Main Eventy dnia', ok: () => cnt('fullDays') >= 1 },
  { id: 'fd20', icon: '🧱', name: 'Żelazna dyscyplina', desc: '20 perfekcyjnych dni', ok: () => cnt('fullDays') >= 20 },
  { id: 'sun', icon: '⛪', name: 'Dzień święty', desc: 'Niedziela: odpoczynek i kościół', ok: () => cnt('sundays') >= 1 },
  { id: 'r12', icon: '⏱️', name: 'Dystans mistrzowski', desc: '12 rund na zegarze', ok: () => cnt('rounds') >= 12 },
  { id: 'bag', icon: '🎒', name: 'Kolekcjoner', desc: 'Otwórz 10 Toreb Trenera', ok: () => cnt('bags') >= 10 },
  { id: 'l5', icon: '⭐', name: 'Poziom 5', desc: 'Osiągnij 5. poziom', ok: () => levelOf(state.xp) >= 5 },
  { id: 'l10', icon: '🌟', name: 'Prospekt', desc: 'Osiągnij 10. poziom', ok: () => levelOf(state.xp) >= 10 },
  { id: 'shop', icon: '🛍️', name: 'Zasłużona nagroda', desc: 'Kup coś w sklepie', ok: () => cnt('buys') >= 1 },
  { id: 'wt', icon: '⚖️', name: 'Ważenie', desc: 'Zapisz swoją wagę', ok: () => state.weights.length >= 1 },
];

/* ---------- levels ---------- */
const levelStart = (L) => 50 * (L - 1) * L;
function levelOf(xp) { let L = 1; while (xp >= levelStart(L + 1)) L++; return L; }
const rankOf = (L) => [...RANKS].reverse().find((r) => L >= r.lvl);
const nextRank = (L) => RANKS.find((r) => r.lvl > L);
const statVal = (x) => Math.min(99, 40 + Math.floor(Math.sqrt(x || 0) * 1.2));

/* ---------- state ---------- */
function freshState() {
  return {
    v: 1,
    created: Date.now(),
    onboarded: false,
    profile: { name: '', nick: '', avatar: '🥊', title: '' },
    xp: 0,
    coins: 0,
    stats: { sila: 0, kondycja: 0, technika: 0, dyscyplina: 0 },
    tasks: [],
    sessions: [],
    prs: {},
    daily: {},
    weights: [],
    streak: { count: 0, best: 0, last: null },
    boss: null,
    bossSeq: 0,
    record: { w: 0, l: 0 },
    fights: [],
    achievements: {},
    counters: {},
    owned: ['🥊', '👊', '😤'],
    ownedTitles: [],
    rewards: [
      { id: uid(), name: 'Odcinek serialu bez wyrzutów 📺', cost: 80 },
      { id: uid(), name: 'Cheat meal 🍔', cost: 300 },
      { id: uid(), name: 'Nowy sprzęt (rękawice / bandaże) 🥊', cost: 1500 },
    ],
    claimed: [],
    rules: [...DEFAULT_RULES],
    plan: defaultPlan(),
    feed: [],
    settings: { sound: true, timer: { rounds: 3, work: 300, rest: 60, prep: 10 } },
  };
}

function migrate(s) {
  const base = freshState();
  s.settings = Object.assign(base.settings, s.settings);
  s.settings.timer = Object.assign({ rounds: 3, work: 300, rest: 60, prep: 10 }, s.settings.timer);
  s.stats = Object.assign(base.stats, s.stats);
  s.profile = Object.assign(base.profile, s.profile);
  s.record = Object.assign(base.record, s.record);
  s.streak = Object.assign(base.streak, s.streak);
  s.counters ||= {};
  if (!s.plan?.days || !s.plan?.workouts) s.plan = base.plan;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshState();
    return migrate(Object.assign(freshState(), JSON.parse(raw)));
  } catch (e) {
    console.warn('Nie udało się wczytać danych', e);
    return freshState();
  }
}

let saveWarned = false;
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    if (!saveWarned) { saveWarned = true; toast('⚠️ Nie udało się zapisać danych w przeglądarce'); }
  }
}

let state = load();
const ui = {
  tab: location.hash.slice(1) || 'arena',
  taskFilter: 'all',
  profTab: 'card',
  exSel: '',
  doneOpen: false,
  histLimit: 20,
  dayModal: null,
};
if (!['arena', 'tasks', 'journal', 'timer', 'profile'].includes(ui.tab)) ui.tab = 'arena';
let pendingHit = 0;
let draft = null;

/* ---------- sound ---------- */
const sfx = (() => {
  let ac = null;
  const ctx = () => {
    if (!state.settings.sound) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, when = 0, freq = 1000, ftype = 'lowpass') {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + when;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
  return {
    unlock: () => ctx(),
    punch() { noise(0.12, 0.6, 0, 900); tone(150, 0.16, 'sine', 0.45, 0, 45); },
    coin() { tone(988, 0.08, 'square', 0.07); tone(1319, 0.22, 'square', 0.07, 0.07); },
    tick() { tone(1400, 0.04, 'square', 0.04); },
    beep() { tone(880, 0.14, 'square', 0.09); },
    clack() { noise(0.04, 0.7, 0, 3000, 'highpass'); noise(0.04, 0.7, 0.16, 3000, 'highpass'); },
    bell(times = 1) {
      for (let i = 0; i < times; i++) {
        const w = i * 0.42;
        [[1, 0.35, 1.8], [2.76, 0.12, 1.2], [5.4, 0.06, 0.8], [8.93, 0.03, 0.5]].forEach(([m, v, d]) => tone(830 * m, d, 'sine', v, w));
      }
    },
    levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.07, i * 0.1)); },
    win() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.08)); },
  };
})();

/* ---------- visual fx ---------- */
const fx = (() => {
  const cv = $('#fx');
  const g = cv.getContext('2d');
  let parts = [], running = false, W = 0, H = 0;
  const colors = ['#e63946', '#f4c430', '#2ecc71', '#3a86ff', '#ffffff', '#9b5de5'];
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function loop() {
    running = true;
    g.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.y < H + 30 && p.life < 240);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      g.restore();
    }
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; g.clearRect(0, 0, W, H); }
  }
  return {
    confetti(n = 140) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      resize();
      for (let i = 0; i < n; i++) {
        parts.push({ x: W / 2 + rand(-60, 60), y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4, r: rand(6, 11), c: pick(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 0 });
      }
      if (!running) loop();
    },
  };
})();

function floatText(txt, anchor, cls = '') {
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = txt;
  let x = innerWidth / 2, y = innerHeight / 2;
  if (anchor && anchor.getBoundingClientRect && anchor.isConnected) {
    const r = anchor.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + 6;
  }
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function toast(html, ms = 2800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

/* ---------- modal ---------- */
const modalQueue = [];
let modalOpen = false;
let modalOpts = {};
function showModal(html, opt = {}) {
  if (modalOpen && !opt.replace) { modalQueue.push([html, opt]); return; }
  modalOpen = true;
  modalOpts = opt;
  const root = $('#modal-root');
  root.innerHTML = `<div class="backdrop" data-act="backdrop"><div class="modal ${opt.cls || ''}" role="dialog" aria-modal="true">${opt.noClose ? '' : '<button class="x" data-act="close-modal" aria-label="Zamknij">✕</button>'}${html}</div></div>`;
  requestAnimationFrame(() => root.firstElementChild?.classList.add('in'));
  document.body.classList.add('modal-open');
}
function closeModal() {
  const cb = modalOpts.onClose;
  $('#modal-root').innerHTML = '';
  modalOpen = false;
  modalOpts = {};
  document.body.classList.remove('modal-open');
  cb?.();
  if (modalQueue.length) {
    const [h, o] = modalQueue.shift();
    setTimeout(() => showModal(h, o), 160);
  }
}

/* ---------- core game logic ---------- */
function pushFeed(h) {
  state.feed.unshift({ t: Date.now(), h });
  if (state.feed.length > 40) state.feed.length = 40;
}

function markActive() {
  const t = today(), s = state.streak;
  if (s.last === t) return;
  s.count = s.last === yesterday() ? s.count + 1 : 1;
  s.last = t;
  s.best = Math.max(s.best, s.count);
}
const streakNow = () => (state.streak.last === today() || state.streak.last === yesterday() ? state.streak.count : 0);
const comboMult = () => 1 + Math.min(streakNow(), 10) * 0.05;

function ensureBoss() {
  const wk = dkey(weekStart());
  const b = state.boss;
  if (b && b.week === wk) return b;
  if (b && !b.defeated) {
    state.record.l++;
    state.fights.unshift({ week: b.week, idx: b.idx, res: 'L' });
  }
  const L = levelOf(state.xp);
  const idx = state.bossSeq % BOSSES.length;
  state.bossSeq++;
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
  const maxHp = Math.max(150, Math.round((Math.min(1600, 500 + 30 * (L - 1)) * daysLeft) / 7));
  state.boss = { week: wk, idx, hp: maxHp, maxHp, defeated: false };
  save();
  return state.boss;
}

function award(base, stats, reason, opt = {}) {
  const b = ensureBoss();
  const mult = opt.noMult ? 1 : comboMult();
  const xp = Math.max(1, Math.round(base * mult));
  const coins = Math.max(1, Math.round(xp / 5));
  const lvlBefore = levelOf(state.xp);
  state.xp += xp;
  state.coins += coins;
  const st = {};
  for (const [k, w] of Object.entries(stats || {})) {
    st[k] = Math.round(xp * w);
    state.stats[k] = (state.stats[k] || 0) + st[k];
  }
  let dmg = 0;
  if (!b.defeated) { dmg = Math.min(xp, b.hp); b.hp -= dmg; }
  const ctr = opt.counters || {};
  for (const [k, v] of Object.entries(ctr)) state.counters[k] = (state.counters[k] || 0) + v;
  if (!opt.noStreak) markActive();
  pushFeed(`${esc(reason)} <b>+${xp} XP</b>${mult > 1 ? ` <span class="muted">(combo x${mult.toFixed(2)})</span>` : ''}`);
  sfx.punch();
  floatText(`+${xp} XP`, opt.anchor);
  pendingHit += dmg;
  if (!b.defeated && b.hp <= 0) knockout();
  const lvlAfter = levelOf(state.xp);
  if (lvlAfter > lvlBefore) levelUp(lvlBefore, lvlAfter);
  checkAch();
  save();
  return { xp, coins, st, dmg, week: b.week, ctr };
}

function revoke(rec) {
  if (!rec) return;
  state.xp = Math.max(0, state.xp - rec.xp);
  state.coins = Math.max(0, state.coins - rec.coins);
  for (const [k, v] of Object.entries(rec.st || {})) state.stats[k] = Math.max(0, (state.stats[k] || 0) - v);
  for (const [k, v] of Object.entries(rec.ctr || {})) state.counters[k] = Math.max(0, (state.counters[k] || 0) - v);
  const b = state.boss;
  if (b && !b.defeated && rec.week === b.week) b.hp = Math.min(b.maxHp, b.hp + (rec.dmg || 0));
  pushFeed(`Cofnięto <b>−${rec.xp} XP</b>`);
  save();
}

function knockout() {
  const b = state.boss, B = BOSSES[b.idx];
  b.defeated = true;
  b.hp = 0;
  state.record.w++;
  state.fights.unshift({ week: b.week, idx: b.idx, res: 'W' });
  state.xp += 150;
  state.coins += 100;
  pushFeed(`💥 <b>K.O.!</b> ${esc(B.name)} na deskach! +150 XP, +100 🪙`);
  setTimeout(() => {
    sfx.bell(3);
    fx.confetti(220);
    showModal(`<div class="center ko-modal">
      <div class="ko-text">K.O.!</div>
      <div class="big-emoji fallen">${B.emoji}</div>
      <p><b>${esc(B.name)}</b> nie wstaje! Sędzia przerywa walkę.</p>
      <p class="muted">+150 XP · +100 🪙 · rekord ${state.record.w}-${state.record.l}</p>
      <button class="btn primary block" data-act="close-modal">Dalej 💪</button></div>`);
  }, 450);
}

function levelUp(from, to) {
  const gain = 50 * (to - from);
  state.coins += gain;
  const rOld = rankOf(from), rNew = rankOf(to);
  pushFeed(`⬆️ <b>Poziom ${to}!</b>${rNew !== rOld ? ` Nowy pas: ${rNew.name}` : ''}`);
  setTimeout(() => {
    sfx.levelUp();
    fx.confetti();
    showModal(`<div class="center lvl-modal">
      <div class="lvl-burst">LEVEL UP!</div>
      <div class="lvl-num">${to}</div>
      ${rNew !== rOld ? `<p>Nowy pas:</p><div class="belt-big" style="--belt:${rNew.belt}"><span>${rNew.name}</span></div>` : `<p>${rNew.name}</p>`}
      <p class="muted">+${gain} 🪙 bonusu</p>
      <button class="btn primary block" data-act="close-modal">Dawaj dalej!</button></div>`);
  }, 650);
}

function checkAch() {
  for (const a of ACH) {
    if (!state.achievements[a.id] && a.ok()) {
      state.achievements[a.id] = Date.now();
      state.coins += 25;
      pushFeed(`🏅 Odznaka: <b>${a.name}</b> (+25 🪙)`);
      setTimeout(() => { toast(`<span class="t-icon">${a.icon}</span><div><b>Nowa odznaka!</b><br>${a.name}</div>`, 3400); sfx.coin(); }, 900);
    }
  }
}

/* ---------- daily plan ---------- */
const dayPlan = (dk) => state.plan.days[parseKey(dk).getDay()] || { focus: '', workout: '', items: [] };
function dayData(dk) {
  state.daily[dk] ||= { done: {} };
  state.daily[dk].done ||= {};
  return state.daily[dk];
}
function itemDone(dk, it) {
  if (it.kind === 'training') return state.sessions.some((s) => s.date === dk && (!it.workout || s.type === it.workout));
  return !!state.daily[dk]?.done?.[it.id];
}
function dayComplete(dk) {
  const items = dayPlan(dk).items;
  const prio = items.filter((i) => i.prio);
  const req = prio.length ? prio : items;
  return req.length > 0 && req.every((i) => itemDone(dk, i));
}
function checkDayComplete(dk) {
  if (dk > today()) return;
  const d = dayData(dk);
  if (d.complete || !dayComplete(dk)) return;
  d.complete = true;
  state.counters.fullDays = cnt('fullDays') + 1;
  if (parseKey(dk).getDay() === 0) state.counters.sundays = cnt('sundays') + 1;
  pushFeed(`💯 <b>Perfekcyjny dzień</b> (${niceDate(dk)})`);
  if (dk === today()) {
    setTimeout(() => { toast('<span class="t-icon">💯</span><div><b>Perfekcyjny dzień!</b><br>Torba Trenera czeka 🎒</div>'); fx.confetti(); sfx.win(); }, 500);
  }
  checkAch();
  save();
}

function toggleItem(dk, it, anchor) {
  const d = dayData(dk);
  if (d.done[it.id]) {
    revoke(d.done[it.id]);
    delete d.done[it.id];
    if (it.kind === 'warmup') d.wu = null;
  } else {
    const k = KINDS[it.kind] || KINDS.other;
    d.done[it.id] = award(itemXp(it), k.stats, it.text, { anchor, counters: kindCounter(it.kind) });
  }
  checkDayComplete(dk);
  save();
  rerender();
}

function completeWarmup(dk, anchor) {
  const d = dayData(dk);
  const it = dayPlan(dk).items.find((i) => i.kind === 'warmup');
  const id = it?.id || '__wu';
  if (d.done[id]) return;
  d.wu = WARMUP_STEPS.map(() => true);
  d.done[id] = award(KINDS.warmup.xp + (it?.prio ? 10 : 0), KINDS.warmup.stats, 'Warm-up Protocol', { anchor, counters: { warmups: 1 } });
}

function openWarmup(dk = today()) {
  const d = dayData(dk);
  if (!Array.isArray(d.wu)) d.wu = WARMUP_STEPS.map(() => false);
  const it = dayPlan(dk).items.find((i) => i.kind === 'warmup');
  const done = it ? itemDone(dk, it) : !!d.done.__wu;
  showModal(`<h2>🔥 Warm-up Protocol</h2>
    <p class="muted small">${niceDate(dk)} · odhaczaj kolejne ćwiczenia. Komplet = +${KINDS.warmup.xp} XP.</p>
    <ol class="wu">${WARMUP_STEPS.map((s, i) => `<li class="${d.wu[i] ? 'done' : ''}" data-act="wu" data-i="${i}" data-day="${dk}" role="button" tabindex="0"><span class="check">${d.wu[i] ? '✓' : ''}</span><span>${i + 1}. ${esc(s)}</span></li>`).join('')}</ol>
    <p class="muted small">➕ Mobility przed i po treningu.</p>
    ${done ? '<p class="center"><b>Rozgrzewka zaliczona ✔</b></p>' : ''}`, { replace: modalOpen && !!ui.dayModal });
  ui.dayModal = null;
}

/* ---------- tasks ---------- */
const openTasks = () => state.tasks.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.created - b.created);
const taskXp = (t) => (t.prio ? 30 : 15);

/* ---------- journal helpers ---------- */
const normEx = (n) => String(n || '').toLowerCase().replace(/^\s*\d+[a-z]?[\s.)-]+/i, '').trim();
const displayEx = (n) => String(n || '').replace(/^\s*\d+[a-z]?[\s.)-]+/i, '').trim();
function topSet(ex) {
  let best = null;
  for (const s of ex.sets || []) {
    const kg = +s.kg || 0, reps = +s.reps || 0;
    if (!kg && !reps) continue;
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { kg, reps };
  }
  return best;
}
const better = (a, b) => !b || a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);
const prLabel = (p) => (p.kg ? `${p.kg} kg × ${p.reps || '?'}` : `${p.reps} powt.`);
const setsSummary = (sets) => (sets || []).map((s) => (s.kg !== '' && +s.kg ? `${s.reps || '?'}×${s.kg}` : `${s.reps}`)).join(', ');
const sortedSessions = () => [...state.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);

function recomputePRs() {
  state.prs = {};
  const asc = [...state.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
  for (const s of asc) for (const e of s.exercises) {
    const t = topSet(e); const k = normEx(e.name);
    if (t && better(t, state.prs[k])) state.prs[k] = t;
  }
}
function lastFor(name) {
  const k = normEx(name);
  for (const s of sortedSessions()) {
    const e = s.exercises.find((x) => normEx(x.name) === k);
    if (e && topSet(e)) return e.sets;
  }
  return null;
}
function exerciseIndex() {
  const m = new Map();
  for (const s of state.sessions) for (const e of s.exercises) {
    if (!topSet(e)) continue;
    const k = normEx(e.name);
    if (!m.has(k)) m.set(k, displayEx(e.name));
  }
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}
const exFromPlan = (type) => (state.plan.workouts[type]?.exercises || []).map((n) => ({ name: n, sets: [{ reps: '', kg: '' }] }));

function spark(vals, w = 300, h = 70, unit = '') {
  if (vals.length < 2) return '<p class="muted small">Zapisz to min. 2 razy, żeby zobaczyć wykres progresu.</p>';
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => [6 + (i * (w - 12)) / (vals.length - 1), h - 8 - ((v - min) / span) * (h - 16)]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Wykres progresu">
    <polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" />
    ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"><title>${vals[i]}${unit}</title></circle>`).join('')}
  </svg><div class="spark-lbl"><span>min ${min}${unit}</span><span>max ${max}${unit}</span></div>`;
}

/* =========================================================
   VIEWS
   ========================================================= */
function renderHud() {
  const L = levelOf(state.xp), start = levelStart(L), next = levelStart(L + 1);
  const pct = ((state.xp - start) / (next - start)) * 100;
  const r = rankOf(L);
  const mult = comboMult();
  const p = state.profile;
  $('#hud').innerHTML = `
    <button class="hud-left" data-act="tab" data-tab="profile" aria-label="Profil zawodnika">
      <span class="avatar">${esc(p.avatar)}</span>
      <span class="hud-id">
        <span class="hud-name">${esc(p.nick || p.name || 'Zawodnik')}</span>
        <span class="hud-rank"><i class="belt" style="--belt:${r.belt}"></i>LVL ${L} · ${r.name}</span>
        <span class="xpbar"><i style="width:${pct.toFixed(1)}%"></i></span>
        <span class="xptext">${state.xp - start} / ${next - start} XP</span>
      </span>
    </button>
    <div class="hud-right">
      ${T.phase !== 'idle' ? `<button class="pill timer-pill" data-act="tab" data-tab="timer" id="hud-timer">⏱</button>` : ''}
      <span class="pill ${mult > 1 ? 'combo' : ''}" title="Seria dni z rzędu · mnożnik XP">🔥 ${streakNow()}${mult > 1 ? ` · x${mult.toFixed(2)}` : ''}</span>
      <span class="pill" title="Monety">🪙 ${state.coins}</span>
    </div>`;
}

function render() {
  ensureBoss();
  renderHud();
  const views = { arena: viewArena, tasks: viewTasks, journal: viewJournal, timer: viewTimer, profile: viewProfile };
  $('#view').innerHTML = views[ui.tab]();
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  if (ui.tab === 'timer' || T.phase !== 'idle') updateTimerDisplay();
  if (pendingHit) {
    const el = $('#boss');
    if (el) {
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
      floatText(`−${pendingHit} HP`, el, 'dmg');
    }
    pendingHit = 0;
  }
}
function rerender() {
  render();
  if (ui.dayModal && modalOpen) {
    const body = $('.day-modal-body');
    if (body) body.innerHTML = dayModalBody(ui.dayModal);
  }
}

/* ---------- Arena ---------- */
function viewArena() {
  const b = state.boss, B = BOSSES[b.idx];
  const hpPct = Math.round((b.hp / b.maxHp) * 100);
  const dow = new Date().getDay();
  const daysLeft = 7 - ((dow + 6) % 7);
  const t = today();
  const day = dayPlan(t);
  const doneN = day.items.filter((i) => itemDone(t, i)).length;
  const prioTasks = openTasks().filter((x) => x.prio).slice(0, 4);
  return `
  <section class="card boss ${b.defeated ? 'ko' : ''}">
    <div class="card-head"><span class="label">🥊 Rywal tygodnia</span><span class="muted small">Rekord ${state.record.w}-${state.record.l} · ${b.defeated ? 'pokonany!' : daysLeft === 1 ? 'ostatni dzień!' : `${daysLeft} dni do gongu`}</span></div>
    <div class="boss-body">
      <button class="boss-emoji" id="boss" data-act="taunt" aria-label="Zaczep rywala">${B.emoji}</button>
      <div class="boss-info">
        <div class="boss-name">${esc(B.name)}</div>
        <div class="bubble" id="taunt">${b.defeated ? 'Leży na deskach. 💫' : esc(pick(B.taunts))}</div>
      </div>
    </div>
    <div class="hp ${hpPct < 30 ? 'low' : ''}"><i style="width:${hpPct}%"></i><span>${b.hp} / ${b.maxHp} HP</span></div>
    <p class="muted small center">${b.defeated ? 'Nowy rywal w poniedziałek. XP i monety lecą normalnie.' : 'Każdy zdobyty punkt XP to cios. Znokautuj go do niedzieli!'}</p>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">📋 Karta walki · ${DAY_NAMES[dow]}</span><span class="muted small">${doneN}/${day.items.length}</span></div>
    ${day.focus ? `<div class="focus">${esc(day.focus)}</div>` : ''}
    ${dayList(t)}
    ${bagButton(t)}
  </section>

  ${coachCard()}

  <section class="card">
    <div class="card-head"><span class="label">🗓️ Ten tydzień</span><span class="muted small">kliknij dzień</span></div>
    ${weekStrip()}
  </section>

  <section class="card">
    <div class="card-head"><span class="label">⭐ Main Event – zadania</span><button class="link" data-act="tab" data-tab="tasks">wszystkie →</button></div>
    ${prioTasks.length ? `<ul class="list">${prioTasks.map(taskRow).join('')}</ul>` : `<p class="muted small">Brak priorytetowych zadań. <button class="link" data-act="tab" data-tab="tasks">Dodaj →</button></p>`}
  </section>

  <section class="card">
    <div class="card-head"><span class="label">📣 Komentator</span></div>
    <ul class="feed">${state.feed.slice(0, 6).map((f) => `<li><span class="muted small">${timeAgo(f.t)}</span> ${f.h}</li>`).join('') || '<li class="muted small">Cisza przed burzą… zrób pierwszy ruch!</li>'}</ul>
  </section>`;
}

function dayList(dk) {
  const day = dayPlan(dk);
  const future = dk > today();
  if (!day.items.length) return '<p class="muted small">Brak planu na ten dzień. Ustaw go w: Zawodnik → Ustawienia.</p>';
  return `<ul class="list">${day.items.map((it) => {
    const done = itemDone(dk, it);
    const k = KINDS[it.kind] || KINDS.other;
    const wo = it.kind === 'training' ? state.plan.workouts[it.workout] : null;
    const xp = wo ? `+${wo.xp}+` : `+${itemXp(it)}`;
    let sub = '';
    if (it.kind === 'training') sub = done ? 'zapisane w dzienniku ✔' : 'kliknij → zapisz trening';
    else if (it.kind === 'warmup') sub = done ? 'rozgrzany ✔' : `${WARMUP_STEPS.length} ćwiczeń – kliknij`;
    const attrs = future ? '' : `data-act="item" data-id="${it.id}" data-day="${dk}" role="button" tabindex="0"`;
    return `<li class="item ${done ? 'done' : ''} ${it.prio ? 'prio' : ''} ${future ? 'future' : ''}" ${attrs}>
      <span class="check">${done ? '✓' : ''}</span>
      <span class="item-icon">${wo ? wo.icon : k.icon}</span>
      <span class="item-text">${esc(it.text)}${it.prio ? ' <b class="badge">MAIN EVENT</b>' : ''}${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="xp-tag">${xp}</span>
    </li>`;
  }).join('')}</ul>`;
}

function bagButton(dk) {
  const ready = dayComplete(dk);
  const opened = !!state.daily[dk]?.bag;
  const label = opened ? '🎒 Torba otwarta – wróć jutro' : ready ? '🎒 Otwórz Torbę Trenera!' : '🎒 Torba Trenera – zalicz Main Eventy dnia';
  return `<button class="bag ${ready && !opened ? 'ready' : ''}" data-act="bag" ${!ready || opened ? 'disabled' : ''}>${label}</button>`;
}

function coachCard() {
  const n = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
  const rule = state.rules.length ? state.rules[n % state.rules.length] : null;
  return `<section class="card coach">
    <div class="label">🗣️ Słowo trenera</div>
    <p class="quote">„${esc(COACH[n % COACH.length])}”</p>
    ${rule ? `<p class="rule"><b>Kodeks:</b> ${esc(rule)}</p>` : ''}
  </section>`;
}

function weekStrip() {
  const ws = weekStart(), t = today(), born = dkey(new Date(state.created));
  return `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(ws, i), k = dkey(d), day = state.plan.days[d.getDay()];
    const wo = state.plan.workouts[day?.workout];
    const st = k > t ? 'future' : dayComplete(k) ? 'win' : k === t ? 'today' : k < born ? 'pre' : 'miss';
    const icon = wo ? wo.icon : d.getDay() === 0 ? '⛪' : '😌';
    return `<button class="wd ${st} ${k === t ? 'is-today' : ''}" data-act="day" data-day="${k}">
      <span class="wd-name">${DAY_SHORT[d.getDay()]}</span><span class="wd-icon">${icon}</span>
      <span class="wd-st">${st === 'win' ? '✓' : st === 'miss' ? '✗' : st === 'today' ? '●' : '·'}</span></button>`;
  }).join('')}</div>`;
}

function dayModalBody(dk) {
  const d = parseKey(dk), day = dayPlan(dk);
  return `<h2>${DAY_NAMES[d.getDay()]} <span class="muted">${niceDate(dk)}</span></h2>
    ${day.focus ? `<div class="focus">${esc(day.focus)}</div>` : ''}
    ${dk > today() ? '<p class="muted small">To przyszłość – na razie tylko podgląd planu.</p>' : ''}
    ${dayList(dk)}`;
}
function openDayModal(dk) {
  ui.dayModal = dk;
  showModal(`<div class="day-modal-body">${dayModalBody(dk)}</div>`, { onClose: () => { ui.dayModal = null; } });
}

/* ---------- Tasks ---------- */
function taskRow(t) {
  const c = CATS[t.cat] || CATS.inne;
  const overdue = !t.done && t.due && t.due < today();
  return `<li class="task ${t.done ? 'done' : ''} ${t.prio ? 'prio' : ''}">
    <button class="check" data-act="task" data-id="${t.id}" aria-label="${t.done ? 'Odznacz zadanie' : 'Ukończ zadanie'}">${t.done ? '✓' : ''}</button>
    <div class="task-main" data-act="edit-task" data-id="${t.id}" role="button" tabindex="0">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${c.icon} ${c.name}${t.due ? ` · <span class="${overdue ? 'overdue' : ''}">${overdue ? '⚠️ ' : '📅 '}${niceDate(t.due)}</span>` : ''}${t.prio ? ' · ⭐' : ''}</div>
    </div>
    <span class="xp-tag">+${taskXp(t)}</span>
  </li>`;
}

function viewTasks() {
  const f = ui.taskFilter;
  const flt = (t) => f === 'all' || t.cat === f;
  const open = openTasks().filter(flt);
  const main = open.filter((t) => t.prio), under = open.filter((t) => !t.prio);
  const done = state.tasks.filter((t) => t.done && flt(t)).sort((a, b) => b.doneAt - a.doneAt).slice(0, 40);
  const doneToday = state.tasks.filter((t) => t.done && dkey(new Date(t.doneAt)) === today()).length;
  return `
  <section class="card">
    <div class="card-head"><span class="label">➕ Nowe zadanie</span><span class="muted small">dziś ukończone: ${doneToday}</span></div>
    <form data-form="task" class="task-form" autocomplete="off">
      <input name="title" placeholder="Co do zrobienia? np. raport TRW" maxlength="140" required aria-label="Treść zadania">
      <div class="chips">${Object.entries(CATS).map(([k, c], i) => `<label class="chip"><input type="radio" name="cat" value="${k}" ${i === 0 ? 'checked' : ''}><span>${c.icon} ${c.name}</span></label>`).join('')}</div>
      <div class="row wrap">
        <label class="toggle"><input type="checkbox" name="prio"><span>⭐ Main Event</span></label>
        <input type="date" name="due" aria-label="Termin">
        <button class="btn primary grow">Dodaj</button>
      </div>
    </form>
  </section>
  <div class="filters">${[['all', 'Wszystkie'], ...Object.entries(CATS).map(([k, c]) => [k, `${c.icon} ${c.name}`])].map(([k, n]) => `<button class="fchip ${f === k ? 'on' : ''}" data-act="tfilter" data-f="${k}">${n}</button>`).join('')}</div>
  <section class="card">
    <div class="card-head"><span class="label">⭐ Main Event</span><span class="muted small">+30 XP / zadanie</span></div>
    ${main.length ? `<ul class="list">${main.map(taskRow).join('')}</ul>` : '<p class="muted small">Pusto. Najważniejsze rzeczy oznaczaj jako Main Event.</p>'}
  </section>
  <section class="card">
    <div class="card-head"><span class="label">🎫 Karta wstępna</span><span class="muted small">+15 XP / zadanie</span></div>
    ${under.length ? `<ul class="list">${under.map(taskRow).join('')}</ul>` : '<p class="muted small">Brak zadań.</p>'}
  </section>
  ${done.length ? `<details class="card done-box" id="done-box" ${ui.doneOpen ? 'open' : ''}><summary class="label">✅ Ukończone (${done.length})</summary><ul class="list">${done.map(taskRow).join('')}</ul></details>` : ''}`;
}

function openTaskEdit(t) {
  showModal(`<h2>✏️ Edytuj zadanie</h2>
    <form data-form="edit-task" class="sform" autocomplete="off">
      <input type="hidden" name="id" value="${t.id}">
      <label>Treść<input name="title" value="${esc(t.title)}" maxlength="140" required></label>
      <label>Kategoria<select name="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${t.cat === k ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select></label>
      <label>Termin<input type="date" name="due" value="${esc(t.due || '')}"></label>
      <label class="toggle"><input type="checkbox" name="prio" ${t.prio ? 'checked' : ''} ${t.done ? 'disabled' : ''}><span>⭐ Main Event (priorytet)</span></label>
      <div class="row">
        <button type="button" class="btn ghost danger" data-act="del-task" data-id="${t.id}">🗑 Usuń</button>
        <button class="btn primary grow">Zapisz</button>
      </div>
    </form>`);
}

/* ---------- Journal ---------- */
function viewJournal() {
  const ws = dkey(weekStart());
  const thisWeek = state.sessions.filter((s) => s.date >= ws).length;
  const minutes = state.sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const list = sortedSessions();
  const names = exerciseIndex();
  return `
  <button class="btn primary big block" data-act="new-session">➕ Zapisz trening</button>
  <div class="stat-row">
    <div class="stat"><b>${thisWeek}</b><small>ten tydzień</small></div>
    <div class="stat"><b>${state.sessions.length}</b><small>treningów</small></div>
    <div class="stat"><b>${Math.round(minutes / 60)}</b><small>godzin</small></div>
    <div class="stat"><b>${Object.keys(state.prs).length}</b><small>ćwiczeń z PR</small></div>
  </div>
  <section class="card">
    <div class="card-head"><span class="label">🔥 Ostatnie 12 tygodni</span></div>
    ${heatmap()}
    <div class="legend"><span><i class="h0"></i>nic</span><span><i class="h1"></i>aktywność</span><span><i class="h2"></i>trening</span><span><i class="h3"></i>perfekcyjny dzień</span></div>
  </section>
  ${names.length ? progressCard(names) : ''}
  <section class="card">
    <div class="card-head"><span class="label">📓 Historia</span><span class="muted small">${list.length}</span></div>
    ${list.length ? list.slice(0, ui.histLimit).map(sessionCard).join('') : '<p class="muted small">Jeszcze nic. Pierwszy trening = odznaka „Pierwszy gong” 🔔</p>'}
    ${list.length > ui.histLimit ? '<button class="btn ghost block" data-act="more-hist">Pokaż więcej</button>' : ''}
  </section>
  ${planCard()}`;
}

function heatmap() {
  const start = addDays(weekStart(), -7 * 11), t = today();
  const taskDays = new Set(state.tasks.filter((x) => x.doneAt).map((x) => dkey(new Date(x.doneAt))));
  const sessDays = new Set(state.sessions.map((s) => s.date));
  let cols = '';
  for (let w = 0; w < 12; w++) {
    let cells = '';
    for (let d = 0; d < 7; d++) {
      const k = dkey(addDays(start, w * 7 + d));
      let lv = 0;
      if (k > t) lv = 'x';
      else {
        const dd = state.daily[k];
        if (dd?.complete) lv = 3;
        else if (sessDays.has(k)) lv = 2;
        else if (taskDays.has(k) || (dd && Object.keys(dd.done || {}).length)) lv = 1;
      }
      cells += `<i class="h${lv} ${k === t ? 'now' : ''}" title="${k}"></i>`;
    }
    cols += `<div class="hcol">${cells}</div>`;
  }
  return `<div class="heat"><div class="hcol hlbl">${['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((n) => `<span>${n}</span>`).join('')}</div>${cols}</div>`;
}

function progressCard(names) {
  const sel = names.some(([k]) => k === ui.exSel) ? ui.exSel : names[0][0];
  const asc = [...state.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
  const pts = asc.flatMap((s) => s.exercises.filter((e) => normEx(e.name) === sel).map((e) => topSet(e))).filter(Boolean);
  const useKg = pts.some((p) => p.kg > 0);
  const vals = pts.map((p) => (useKg ? p.kg : p.reps));
  const pr = state.prs[sel];
  return `<section class="card">
    <div class="card-head"><span class="label">📈 Progres</span>${pr ? `<span class="muted small">PR: <b>${prLabel(pr)}</b></span>` : ''}</div>
    <select data-change="exsel" aria-label="Wybierz ćwiczenie">${names.map(([k, n]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    ${spark(vals.slice(-20), 300, 70, useKg ? ' kg' : ' powt.')}
  </section>`;
}

function sessionCard(s) {
  const wo = state.plan.workouts[s.type] || { name: s.type, icon: '💪' };
  return `<details class="session">
    <summary><span class="s-icon">${wo.icon}</span><span class="s-main"><b>${esc(wo.name)}</b><small>${niceDate(s.date)} · ${s.duration || 0} min · RPE ${s.rpe} ${esc(s.mood || '')}${s.prs?.length ? ` · 🏆×${s.prs.length}` : ''}</small></span><span class="xp-tag">+${s.rec?.xp || 0}</span></summary>
    <div class="s-body">
      ${s.exercises.length ? `<ul class="ex-list">${s.exercises.map((e) => `<li><span>${s.prs?.includes(normEx(e.name)) ? '🏆 ' : ''}${esc(displayEx(e.name))}</span><span class="muted">${esc(setsSummary(e.sets))}</span></li>`).join('')}</ul>` : ''}
      ${s.notes ? `<p class="notes">${esc(s.notes)}</p>` : ''}
      <button class="btn ghost small danger" data-act="del-session" data-id="${s.id}">🗑 Usuń wpis</button>
    </div>
  </details>`;
}

function planCard() {
  return `<details class="card plan-card">
    <summary class="label">📋 Plan tygodnia</summary>
    <div class="plan-days">${WEEK_ORDER.map((dow) => {
      const d = state.plan.days[dow];
      const wo = state.plan.workouts[d.workout];
      return `<div class="pday"><b>${DAY_NAMES[dow]}</b> <span class="muted">${esc(d.focus)}</span>
        ${wo && wo.exercises.length ? `<ol>${wo.exercises.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>` : ''}</div>`;
    }).join('')}</div>
    <div class="pday"><b>🔥 Warm-up Protocol</b><ol>${WARMUP_STEPS.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><span class="muted small">+ mobility przed i po</span></div>
  </details>`;
}

function exEditor() {
  if (!draft.exercises.length) return '<p class="muted small">Brak ćwiczeń – przy MMA wystarczą notatki. Możesz dodać ćwiczenia przyciskiem niżej.</p>';
  return draft.exercises.map((e, i) => {
    const last = lastFor(e.name);
    const pr = state.prs[normEx(e.name)];
    return `<div class="ex">
      <div class="ex-head"><input class="ex-name" value="${esc(e.name)}" data-ex="${i}" data-field="name" placeholder="Nazwa ćwiczenia" aria-label="Nazwa ćwiczenia"><button type="button" class="icon-btn" data-act="del-ex" data-ex="${i}" aria-label="Usuń ćwiczenie">✕</button></div>
      ${last || pr ? `<div class="ex-hint">${last ? `Ostatnio: ${esc(setsSummary(last))}` : ''}${pr ? ` · PR: ${prLabel(pr)}` : ''}</div>` : ''}
      <div class="sets">${e.sets.map((s, j) => `<div class="set"><span class="set-n">${j + 1}</span>
        <input type="number" inputmode="numeric" min="0" placeholder="powt." value="${esc(s.reps)}" data-ex="${i}" data-set="${j}" data-field="reps" aria-label="Powtórzenia">
        <span class="muted">×</span>
        <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${esc(s.kg)}" data-ex="${i}" data-set="${j}" data-field="kg" aria-label="Ciężar kg">
        <button type="button" class="icon-btn" data-act="del-set" data-ex="${i}" data-set="${j}" aria-label="Usuń serię">−</button></div>`).join('')}</div>
      <button type="button" class="btn ghost tiny" data-act="add-set" data-ex="${i}">+ seria</button>
    </div>`;
  }).join('');
}

function openSessionForm({ date = today(), type } = {}) {
  const day = dayPlan(date);
  type = type || day.workout || 'mma';
  if (!state.plan.workouts[type]) type = 'other';
  draft = { exercises: exFromPlan(type) };
  const wuItem = day.items.find((i) => i.kind === 'warmup');
  const wuDone = wuItem ? itemDone(date, wuItem) : !!state.daily[date]?.done?.__wu;
  showModal(`<h2>📓 Zapisz trening</h2>
    <form data-form="session" class="sform" autocomplete="off">
      <div class="grid2">
        <label>Data<input type="date" name="date" value="${date}" max="${today()}" required></label>
        <label>Typ<select name="type" data-change="stype">${Object.entries(state.plan.workouts).map(([k, w]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}</select></label>
        <label>Czas (min)<input type="number" name="duration" min="0" max="600" value="${type === 'mma' ? 90 : 60}" inputmode="numeric"></label>
        <label>Intensywność RPE: <output id="rpe-out">7</output><input type="range" name="rpe" min="1" max="10" value="7" data-input="rpe"></label>
      </div>
      <div class="moods" role="radiogroup" aria-label="Samopoczucie">${MOODS.map((m, i) => `<label><input type="radio" name="mood" value="${m}" ${i === 4 ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div>
      ${wuDone ? '<p class="muted small">🔥 Rozgrzewka już zaliczona ✔</p>' : '<label class="toggle"><input type="checkbox" name="warm"><span>🔥 Zrobiłem Warm-up Protocol (+20 XP)</span></label>'}
      <div id="ex-list">${exEditor()}</div>
      <button type="button" class="btn ghost small" data-act="add-ex">+ ćwiczenie</button>
      <label>Notatki<textarea name="notes" rows="3" maxlength="2000" placeholder="Technika, sparingi, co poprawić, samopoczucie…"></textarea></label>
      <button class="btn primary big block">Zapisz i zgarnij XP 💥</button>
    </form>`, { sticky: true, cls: 'wide', onClose: () => { draft = null; } });
}

/* ---------- Timer ---------- */
const T = { phase: 'idle', round: 0, endsAt: 0, phaseLen: 0, paused: false, pausedLeft: 0, iv: null };
let wakeLock = null;
async function wakeOn() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* brak wsparcia */ } }
function wakeOff() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

function setPhase(p, secs, fromNow) {
  T.phase = p;
  T.phaseLen = secs;
  T.endsAt = (fromNow ? Date.now() : T.endsAt) + secs * 1000;
  T.lastBeep = -1;
}
function tStart() {
  const c = state.settings.timer;
  sfx.unlock();
  T.round = 1;
  T.paused = false;
  if (c.prep > 0) setPhase('prep', c.prep, true);
  else { setPhase('work', c.work, true); sfx.bell(); }
  clearInterval(T.iv);
  T.iv = setInterval(tTick, 100);
  wakeOn();
  render();
}
function tStop() {
  clearInterval(T.iv);
  T.phase = 'idle';
  T.paused = false;
  wakeOff();
  render();
}
function tTick() {
  if (T.paused) return;
  const ms = T.endsAt - Date.now();
  if (ms <= 0) { tNext(); return; }
  const left = Math.ceil(ms / 1000);
  if (T.phase === 'work' && left === 10 && T.lastBeep !== 10 && T.phaseLen > 20) { sfx.clack(); T.lastBeep = 10; }
  if ((T.phase === 'prep' || T.phase === 'rest') && left <= 3 && T.lastBeep !== left) { sfx.beep(); T.lastBeep = left; }
  updateTimerDisplay();
}
function tNext() {
  const c = state.settings.timer;
  if (T.phase === 'prep') { setPhase('work', c.work); sfx.bell(); }
  else if (T.phase === 'work') {
    const rx = Math.max(2, Math.round((c.work / 60) * 3));
    award(rx, { kondycja: 0.6, technika: 0.4 }, `Runda ${T.round} zaliczona`, { anchor: $('#t-time'), counters: { rounds: 1 } });
    renderHud();
    if (T.round >= c.rounds) {
      clearInterval(T.iv);
      T.phase = 'idle';
      wakeOff();
      sfx.bell(3);
      award(10, { dyscyplina: 1 }, `Zegar: ${c.rounds} rund ukończone`, { noMult: true });
      toast('<span class="t-icon">🔔</span><div><b>Koniec walki!</b><br>Wszystkie rundy zaliczone.</div>');
      fx.confetti();
      if (!modalOpen) render(); else renderHud();
      return;
    }
    if (c.rest > 0) { setPhase('rest', c.rest); sfx.bell(); }
    else { T.round++; setPhase('work', c.work); sfx.bell(); }
  } else if (T.phase === 'rest') { T.round++; setPhase('work', c.work); sfx.bell(); }
  updateTimerDisplay();
}
function updateTimerDisplay() {
  const c = state.settings.timer;
  let left, total, label;
  if (T.phase === 'idle') { left = c.work; total = 0; label = 'Gotowy?'; }
  else {
    left = Math.max(0, Math.ceil((T.paused ? T.pausedLeft : T.endsAt - Date.now()) / 1000));
    total = T.phaseLen;
    label = { prep: 'Przygotuj się', work: 'WALCZ!', rest: 'Przerwa' }[T.phase] + (T.paused ? ' (pauza)' : '');
  }
  const el = $('#t-time');
  if (el) {
    el.textContent = fmtTime(left);
    $('#t-phase').textContent = label;
    $('#t-round').textContent = T.phase === 'idle' ? `${c.rounds} × ${fmtTime(c.work)} · przerwa ${fmtTime(c.rest)}` : `Runda ${T.round} / ${c.rounds}`;
    $('#t-bar').style.width = (total ? (1 - left / total) * 100 : 0) + '%';
    $('#timer-card').className = `card timer ${T.phase}${T.phase === 'work' && left <= 10 ? ' hurry' : ''}`;
  }
  const ht = $('#hud-timer');
  if (ht) ht.textContent = `⏱ ${fmtTime(left)}`;
}

function viewTimer() {
  const c = state.settings.timer;
  const running = T.phase !== 'idle';
  const step = (k, label, val, fmt) => `<div class="stepper"><span>${label}</span>
    <button class="icon-btn" data-act="t-adj" data-k="${k}" data-d="-1" ${running ? 'disabled' : ''} aria-label="${label} mniej">−</button>
    <b>${fmt(val)}</b>
    <button class="icon-btn" data-act="t-adj" data-k="${k}" data-d="1" ${running ? 'disabled' : ''} aria-label="${label} więcej">+</button></div>`;
  return `
  <section class="card timer ${T.phase}" id="timer-card">
    <div class="t-phase" id="t-phase"></div>
    <div class="t-time" id="t-time"></div>
    <div class="t-round" id="t-round"></div>
    <div class="t-bar"><i id="t-bar"></i></div>
    <div class="t-ctrl">
      ${!running ? '<button class="btn primary big grow" data-act="t-start">▶ Start</button>'
        : `<button class="btn big grow" data-act="t-pause">${T.paused ? '▶ Wznów' : '⏸ Pauza'}</button><button class="btn ghost big" data-act="t-stop">■ Stop</button>`}
    </div>
    <p class="muted small center">Każda ukończona runda = XP i cios w rywala. 🔔 gong · 🪵 10 s do końca rundy</p>
  </section>
  <section class="card">
    <div class="card-head"><span class="label">⚙️ Ustawienia rund</span></div>
    <div class="filters">${TIMER_PRESETS.map((p, i) => `<button class="fchip ${c.rounds === p.rounds && c.work === p.work && c.rest === p.rest ? 'on' : ''}" data-act="t-preset" data-i="${i}" ${running ? 'disabled' : ''}>${p.n}</button>`).join('')}</div>
    ${step('rounds', 'Rundy', c.rounds, (v) => v)}
    ${step('work', 'Runda', c.work, fmtTime)}
    ${step('rest', 'Przerwa', c.rest, fmtTime)}
    ${step('prep', 'Start za', c.prep, (v) => `${v} s`)}
  </section>
  <section class="card">
    <div class="card-head"><span class="label">🔥 Przed walką</span></div>
    <button class="btn block" data-act="warmup-open">Otwórz Warm-up Protocol</button>
  </section>`;
}

/* ---------- Profile ---------- */
function viewProfile() {
  const tabs = [['card', '🪪 Karta'], ['badges', '🏅 Odznaki'], ['shop', '🛍️ Sklep'], ['code', '📜 Kodeks'], ['settings', '⚙️']];
  const body = { card: profCard, badges: profBadges, shop: profShop, code: profCode, settings: profSettings }[ui.profTab]();
  return `<div class="filters subtabs">${tabs.map(([k, n]) => `<button class="fchip ${ui.profTab === k ? 'on' : ''}" data-act="ptab" data-t="${k}" ${k === 'settings' ? 'aria-label="Ustawienia"' : ''}>${n}</button>`).join('')}</div>${body}`;
}

function profCard() {
  const L = levelOf(state.xp), r = rankOf(L), nr = nextRank(L);
  const vals = Object.keys(STATS).map((k) => statVal(state.stats[k]));
  const ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const p = state.profile;
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const lastW = w[w.length - 1], prevW = w[w.length - 2];
  return `
  <section class="card fighter">
    <div class="fc-top">
      <div class="fc-num"><b>${ovr}</b><small>OVR</small></div>
      <div class="fc-avatar">${esc(p.avatar)}</div>
      <div class="fc-num"><b>${state.record.w}-${state.record.l}</b><small>REKORD</small></div>
    </div>
    <div class="fc-name">${esc(p.name || 'Zawodnik')}${p.nick ? ` <span>„${esc(p.nick)}”</span>` : ''}</div>
    ${p.title ? `<div class="fc-title">${esc(p.title)}</div>` : ''}
    <div class="belt-big" style="--belt:${r.belt}"><span>${r.name} · LVL ${L}</span></div>
    ${nr ? `<p class="muted small center">Następny pas: <b>${nr.name}</b> na poziomie ${nr.lvl}</p>` : ''}
    <div class="stats">${Object.entries(STATS).map(([k, s]) => { const v = statVal(state.stats[k]); return `<div class="srow"><span>${s.icon} ${s.name}</span><span class="sbar"><i style="width:${v}%"></i></span><b>${v}</b></div>`; }).join('')}</div>
  </section>
  <div class="stat-row">
    <div class="stat"><b>${state.sessions.length}</b><small>treningów</small></div>
    <div class="stat"><b>${cnt('tasks')}</b><small>zadań</small></div>
    <div class="stat"><b>${state.streak.best}</b><small>najdł. seria</small></div>
    <div class="stat"><b>${cnt('fullDays')}</b><small>perf. dni</small></div>
  </div>
  <section class="card">
    <div class="card-head"><span class="label">⚖️ Ważenie</span>${lastW ? `<span class="muted small">${lastW.kg} kg${prevW ? ` (${lastW.kg - prevW.kg >= 0 ? '+' : ''}${(lastW.kg - prevW.kg).toFixed(1)})` : ''}</span>` : ''}</div>
    <form data-form="weight" class="row">
      <input type="number" name="kg" step="0.1" min="30" max="250" inputmode="decimal" placeholder="Waga dziś (kg)" required aria-label="Waga w kg">
      <button class="btn">Zapisz</button>
    </form>
    ${w.length ? spark(w.slice(-30).map((x) => x.kg), 300, 60, ' kg') : ''}
  </section>
  <section class="card">
    <div class="card-head"><span class="label">🏆 Historia walk</span></div>
    ${state.fights.length ? `<ul class="list fights">${state.fights.slice(0, 10).map((f) => `<li><span class="res ${f.res}">${f.res === 'W' ? 'W' : 'L'}</span> ${BOSSES[f.idx].emoji} ${esc(BOSSES[f.idx].name)} <span class="muted small">tydz. ${niceDate(f.week)}</span></li>`).join('')}</ul>` : '<p class="muted small">Pierwsza walka trwa. Rywal czeka na Arenie.</p>'}
  </section>`;
}

function profBadges() {
  const n = ACH.filter((a) => state.achievements[a.id]).length;
  return `<section class="card">
    <div class="card-head"><span class="label">🏅 Odznaki</span><span class="muted small">${n} / ${ACH.length} · +25 🪙 za każdą</span></div>
    <div class="badges">${ACH.map((a) => { const got = state.achievements[a.id]; return `<div class="badge-card ${got ? 'got' : ''}"><div class="b-icon">${got ? a.icon : '🔒'}</div><b>${a.name}</b><small>${a.desc}</small></div>`; }).join('')}</div>
  </section>`;
}

function profShop() {
  const p = state.profile;
  return `
  <div class="coins-big">🪙 ${state.coins}</div>
  <section class="card">
    <div class="card-head"><span class="label">🎁 Twoje nagrody</span></div>
    <p class="muted small">Ustal nagrody z prawdziwego życia i kupuj je za monety z obozu. Zasłużone = smakują lepiej.</p>
    <ul class="list">${state.rewards.map((r) => `<li class="reward"><span class="grow">${esc(r.name)}</span>
      <button class="btn small ${state.coins >= r.cost ? 'primary' : ''}" data-act="buy-reward" data-id="${r.id}" ${state.coins < r.cost ? 'disabled' : ''}>🪙 ${r.cost}</button>
      <button class="icon-btn" data-act="del-reward" data-id="${r.id}" aria-label="Usuń nagrodę">✕</button></li>`).join('')}</ul>
    <form data-form="reward" class="row" autocomplete="off">
      <input name="name" placeholder="np. Pizza w sobotę 🍕" maxlength="60" required class="grow" aria-label="Nazwa nagrody">
      <input name="cost" type="number" min="10" max="99999" value="200" required class="num" aria-label="Cena">
      <button class="btn">Dodaj</button>
    </form>
    ${state.claimed.length ? `<p class="muted small">Ostatnio odebrane: ${state.claimed.slice(0, 5).map((c) => esc(c.name)).join(' · ')}</p>` : ''}
  </section>
  <section class="card">
    <div class="card-head"><span class="label">🐺 Awatary</span></div>
    <div class="avatars">${[...AVATARS, ...RARE_AVATARS.filter((e) => state.owned.includes(e)).map((e) => ({ e, cost: 0, rare: true }))].map((a) => {
      const own = state.owned.includes(a.e), on = p.avatar === a.e;
      return `<button class="av ${on ? 'on' : ''} ${own ? 'own' : ''}" data-act="avatar" data-e="${a.e}" ${!own && state.coins < a.cost ? 'disabled' : ''}>
        <span>${a.e}</span><small>${on ? 'założony' : own ? (a.rare ? 'rzadki!' : 'załóż') : `🪙 ${a.cost}`}</small></button>`;
    }).join('')}</div>
    <p class="muted small">Rzadkie awatary wypadają tylko z Torby Trenera 🎒</p>
  </section>
  <section class="card">
    <div class="card-head"><span class="label">🏷️ Tytuły</span></div>
    <div class="titles">${TITLES.map((t) => {
      const own = state.ownedTitles.includes(t.t), on = p.title === t.t;
      return `<button class="fchip ${on ? 'on' : ''}" data-act="title" data-t="${esc(t.t)}" ${!own && state.coins < t.cost ? 'disabled' : ''}>${esc(t.t)} ${on ? '✓' : own ? '' : `· 🪙 ${t.cost}`}</button>`;
    }).join('')}</div>
  </section>`;
}

function profCode() {
  return `<section class="card">
    <div class="card-head"><span class="label">📜 Kodeks zawodnika</span></div>
    <p class="muted small">Twoje zasady. Codziennie jedna z nich pojawia się na Arenie.</p>
    <ul class="list rules">${state.rules.map((r, i) => `<li><span class="grow">${esc(r)}</span><button class="icon-btn" data-act="del-rule" data-i="${i}" aria-label="Usuń zasadę">✕</button></li>`).join('')}</ul>
    <form data-form="rule" class="row" autocomplete="off"><input name="rule" placeholder="Nowa zasada…" maxlength="140" required class="grow" aria-label="Nowa zasada"><button class="btn">Dodaj</button></form>
  </section>
  ${planCard()}`;
}

function profSettings() {
  const p = state.profile;
  return `
  <section class="card">
    <div class="card-head"><span class="label">👤 Profil</span></div>
    <form data-form="profile" class="sform" autocomplete="off">
      <label>Imię<input name="name" value="${esc(p.name)}" maxlength="30"></label>
      <label>Ksywka<input name="nick" value="${esc(p.nick)}" maxlength="30"></label>
      <button class="btn primary">Zapisz</button>
    </form>
    <label class="toggle"><input type="checkbox" data-change="sound" ${state.settings.sound ? 'checked' : ''}><span>🔊 Dźwięki</span></label>
  </section>
  <details class="card">
    <summary class="label">🗓️ Edytuj plan tygodnia</summary>
    ${planEditor()}
  </details>
  <section class="card">
    <div class="card-head"><span class="label">💾 Kopia zapasowa</span></div>
    <p class="muted small">Dane są tylko w tej przeglądarce. Zrób eksport, żeby przenieść je na inne urządzenie.</p>
    <div class="row wrap">
      <button class="btn" data-act="export">⬇️ Eksportuj</button>
      <label class="btn">⬆️ Importuj<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <button class="btn ghost danger" data-act="reset">Reset gry</button>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><span class="label">❓ Jak grać</span></div>
    ${howTo()}
  </section>`;
}

function howTo() {
  return `<ul class="how">
    <li>📋 <b>Karta walki</b> – codzienny plan z Twojego arkusza. Odhaczaj punkty, zbieraj XP.</li>
    <li>⭐ <b>Main Event</b> – priorytety (MMA pn/śr/pt, praca TRW do 19:00) dają więcej XP.</li>
    <li>🥊 <b>Rywal tygodnia</b> – każdy XP to cios. Znokautuj go przed końcem niedzieli, inaczej porażka w rekordzie.</li>
    <li>🔥 <b>Seria</b> – aktywność dzień po dniu podbija mnożnik XP aż do x1.5.</li>
    <li>🎒 <b>Torba Trenera</b> – nagroda-niespodzianka za perfekcyjny dzień.</li>
    <li>🏆 <b>Rekordy</b> – pobity ciężar w dzienniku = bonus XP.</li>
    <li>🪙 <b>Monety</b> – na awatary, tytuły i Twoje własne nagrody (np. cheat meal).</li>
  </ul>`;
}

function planEditor() {
  const woOptions = (sel) => `<option value="">— brak —</option>${Object.entries(state.plan.workouts).map(([k, w]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}`;
  return `<form data-form="plan" class="plan-ed" autocomplete="off">
    <p class="muted small">Jedna pozycja w linii. Gwiazdka <b>*</b> na początku = MAIN EVENT. Słowa „rozgrzewka”, „mobility”, „trening”, „praca”, „odpoczynek”, „kościół” są rozpoznawane automatycznie.</p>
    ${WEEK_ORDER.map((dow) => {
      const d = state.plan.days[dow];
      return `<fieldset><legend>${DAY_NAMES[dow]}</legend>
        <label>Hasło dnia<input name="focus_${dow}" value="${esc(d.focus)}" maxlength="60"></label>
        <label>Trening dnia<select name="wo_${dow}">${woOptions(d.workout)}</select></label>
        <label>Punkty dnia<textarea name="items_${dow}" rows="${Math.max(3, d.items.length + 1)}">${esc(d.items.map((i) => (i.prio ? '* ' : '') + i.text).join('\n'))}</textarea></label>
      </fieldset>`;
    }).join('')}
    ${Object.entries(state.plan.workouts).filter(([k]) => k !== 'mma' && k !== 'mobility').map(([k, w]) => `<fieldset><legend>${w.icon} ${esc(w.name)} – ćwiczenia</legend>
      <textarea name="ex_${k}" rows="${Math.max(2, w.exercises.length + 1)}" placeholder="Jedno ćwiczenie w linii">${esc(w.exercises.join('\n'))}</textarea></fieldset>`).join('')}
    <div class="row wrap">
      <button class="btn primary grow">Zapisz plan</button>
      <button type="button" class="btn ghost" data-act="plan-reset">Przywróć plan domyślny</button>
    </div>
  </form>`;
}

/* ---------- onboarding & weekly intro ---------- */
function onboarding() {
  showModal(`<div class="onb">
    <div class="onb-logo">🥊</div>
    <h2>FIGHT CAMP</h2>
    <p>Twój plan treningowy jako gra. Zbieraj XP, nokautuj rywali tygodnia i zdobywaj kolejne pasy.</p>
    ${howTo()}
    <form data-form="onb" class="sform" autocomplete="off">
      <label>Imię<input name="name" maxlength="30" required placeholder="np. Kuba"></label>
      <label>Ksywka (opcjonalnie)<input name="nick" maxlength="30" placeholder="np. Młot"></label>
      <div class="avatars small">${['🥊', '👊', '😤'].map((e, i) => `<label class="av-pick"><input type="radio" name="avatar" value="${e}" ${i === 0 ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>
      <button class="btn primary big block">Wchodzę do klatki 🔔</button>
    </form>
  </div>`, { sticky: true, noClose: true });
}

function bossIntro(prev) {
  const P = BOSSES[prev.idx], N = BOSSES[state.boss.idx];
  showModal(`<div class="center">
    <h2>🔔 Nowy tydzień!</h2>
    <p>${prev.defeated ? `✅ Wygrałeś z <b>${esc(P.name)}</b> przez KO!` : `❌ ${esc(P.name)} przetrwał tydzień. Porażka na punkty – czas na rewanż z życiem.`}</p>
    <div class="big-emoji">${N.emoji}</div>
    <h3>${esc(N.name)}</h3>
    <p class="bubble">${esc(pick(N.taunts))}</p>
    <p class="muted small">HP rywala: ${state.boss.maxHp}. Rekord: ${state.record.w}-${state.record.l}</p>
    <button class="btn primary block" data-act="close-modal">Walczymy! 🥊</button>
  </div>`);
}

/* =========================================================
   ACTIONS
   ========================================================= */
const findItem = (dk, id) => dayPlan(dk).items.find((i) => i.id === id);

const ACTIONS = {
  tab(el) {
    if (modalOpen && ui.dayModal) closeModal();
    ui.tab = el.dataset.tab;
    history.replaceState(null, '', '#' + ui.tab);
    render();
    scrollTo(0, 0);
  },
  backdrop(el, e) {
    if (e.target === el && !modalOpts.sticky) closeModal();
  },
  'close-modal'() { closeModal(); },
  taunt(el) {
    const b = state.boss, B = BOSSES[b.idx];
    el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble');
    const t = $('#taunt');
    if (t) t.textContent = b.defeated ? pick(['…💫', 'Nie bij leżącego!', 'Ała. Wystarczy.']) : pick(B.taunts);
    sfx.tick();
  },
  item(el) {
    const dk = el.dataset.day, it = findItem(dk, el.dataset.id);
    if (!it) return;
    if (it.kind === 'training') {
      if (ui.dayModal) closeModal();
      if (itemDone(dk, it)) { ui.tab = 'journal'; history.replaceState(null, '', '#journal'); render(); }
      else openSessionForm({ date: dk, type: it.workout });
      return;
    }
    if (it.kind === 'warmup' && !itemDone(dk, it)) { openWarmup(dk); return; }
    toggleItem(dk, it, el);
  },
  wu(el) {
    const dk = el.dataset.day, i = +el.dataset.i, d = dayData(dk);
    if (!Array.isArray(d.wu)) d.wu = WARMUP_STEPS.map(() => false);
    d.wu[i] = !d.wu[i];
    el.classList.toggle('done', d.wu[i]);
    $('.check', el).textContent = d.wu[i] ? '✓' : '';
    sfx.tick();
    if (d.wu.every(Boolean)) {
      completeWarmup(dk, el);
      checkDayComplete(dk);
      save();
      setTimeout(() => { closeModal(); render(); }, 450);
    } else save();
  },
  'warmup-open'() { openWarmup(today()); },
  day(el) { openDayModal(el.dataset.day); },
  bag(el) {
    const t = today(), d = dayData(t);
    if (d.bag || !dayComplete(t)) return;
    d.bag = true;
    state.counters.bags = cnt('bags') + 1;
    const r = Math.random();
    const rare = RARE_AVATARS.filter((e) => !state.owned.includes(e));
    let prize;
    if (r < 0.06 && rare.length) {
      const e = pick(rare); state.owned.push(e);
      prize = `<div class="big-emoji">${e}</div><p><b>RZADKI AWATAR!</b> Załóż go w sklepie.</p>`;
    } else if (r < 0.16) {
      const c = rand(100, 180); state.coins += c;
      prize = `<div class="big-emoji">💰</div><p><b>JACKPOT!</b> +${c} 🪙</p>`;
    } else if (r < 0.46) {
      const x = rand(30, 80);
      award(x, { dyscyplina: 1 }, 'Torba Trenera', { noMult: true, noStreak: true });
      prize = `<div class="big-emoji">⚡</div><p><b>Zastrzyk energii!</b> +${x} XP</p>`;
    } else {
      const c = rand(20, 60); state.coins += c;
      prize = `<div class="big-emoji">🪙</div><p><b>Gaża za dzień:</b> +${c} 🪙</p>`;
    }
    pushFeed('🎒 Otwarto Torbę Trenera');
    checkAch();
    save();
    sfx.coin();
    showModal(`<div class="center bag-modal"><div class="bag-anim">🎒</div><div class="prize">${prize}<button class="btn primary block" data-act="close-modal">Biorę!</button></div></div>`);
    setTimeout(() => { sfx.win(); fx.confetti(90); }, 900);
    render();
  },
  task(el) {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    if (t.done) {
      revoke(t.rec);
      Object.assign(t, { done: false, rec: null, doneAt: null });
    } else {
      const c = CATS[t.cat] || CATS.inne;
      t.done = true;
      t.doneAt = Date.now();
      t.rec = award(taskXp(t), { [c.stat]: 1 }, `Zadanie: ${t.title}`, { anchor: el, counters: { tasks: 1 } });
    }
    save();
    render();
  },
  'edit-task'(el) {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (t) openTaskEdit(t);
  },
  'del-task'(el) {
    if (!confirm('Usunąć to zadanie?')) return;
    state.tasks = state.tasks.filter((x) => x.id !== el.dataset.id);
    save();
    closeModal();
    render();
  },
  tfilter(el) { ui.taskFilter = el.dataset.f; render(); },
  'new-session'() { openSessionForm(); },
  'add-ex'() {
    draft.exercises.push({ name: '', sets: [{ reps: '', kg: '' }] });
    $('#ex-list').innerHTML = exEditor();
    $$('#ex-list .ex-name').pop()?.focus();
  },
  'del-ex'(el) { draft.exercises.splice(+el.dataset.ex, 1); $('#ex-list').innerHTML = exEditor(); },
  'add-set'(el) {
    const e = draft.exercises[+el.dataset.ex];
    const last = e.sets[e.sets.length - 1] || { reps: '', kg: '' };
    e.sets.push({ ...last });
    $('#ex-list').innerHTML = exEditor();
  },
  'del-set'(el) {
    const e = draft.exercises[+el.dataset.ex];
    e.sets.splice(+el.dataset.set, 1);
    if (!e.sets.length) e.sets.push({ reps: '', kg: '' });
    $('#ex-list').innerHTML = exEditor();
  },
  'del-session'(el) {
    const s = state.sessions.find((x) => x.id === el.dataset.id);
    if (!s || !confirm('Usunąć ten trening? XP za niego zostanie odjęte.')) return;
    revoke(s.rec);
    state.sessions = state.sessions.filter((x) => x.id !== s.id);
    recomputePRs();
    save();
    render();
  },
  'more-hist'() { ui.histLimit += 20; render(); },
  't-start'() { tStart(); },
  't-pause'() {
    if (T.paused) { T.endsAt = Date.now() + T.pausedLeft; T.paused = false; }
    else { T.pausedLeft = T.endsAt - Date.now(); T.paused = true; }
    render();
  },
  't-stop'() { tStop(); },
  't-adj'(el) {
    const c = state.settings.timer, k = el.dataset.k, d = +el.dataset.d;
    if (k === 'rounds') c.rounds = clamp(c.rounds + d, 1, 15);
    if (k === 'work') c.work = clamp(c.work + d * (c.work < 60 || (c.work === 60 && d < 0) ? 10 : 30), 10, 600);
    if (k === 'rest') c.rest = clamp(c.rest + d * (c.rest < 30 || (c.rest === 30 && d < 0) ? 5 : 15), 0, 180);
    if (k === 'prep') c.prep = clamp(c.prep + d * 5, 0, 30);
    save();
    render();
  },
  't-preset'(el) {
    const p = TIMER_PRESETS[+el.dataset.i];
    Object.assign(state.settings.timer, { rounds: p.rounds, work: p.work, rest: p.rest });
    save();
    render();
  },
  ptab(el) { ui.profTab = el.dataset.t; render(); },
  avatar(el) {
    const e = el.dataset.e;
    if (!state.owned.includes(e)) {
      const a = AVATARS.find((x) => x.e === e);
      if (!a || state.coins < a.cost || !confirm(`Kupić awatar ${e} za ${a.cost} monet?`)) return;
      state.coins -= a.cost;
      state.owned.push(e);
      state.counters.buys = cnt('buys') + 1;
      sfx.coin();
      fx.confetti(60);
    }
    state.profile.avatar = e;
    checkAch();
    save();
    render();
  },
  title(el) {
    const name = el.dataset.t;
    if (!state.ownedTitles.includes(name)) {
      const t = TITLES.find((x) => x.t === name);
      if (!t || state.coins < t.cost || !confirm(`Kupić tytuł „${name}” za ${t.cost} monet?`)) return;
      state.coins -= t.cost;
      state.ownedTitles.push(name);
      state.counters.buys = cnt('buys') + 1;
      sfx.coin();
    }
    state.profile.title = state.profile.title === name ? '' : name;
    checkAch();
    save();
    render();
  },
  'buy-reward'(el) {
    const r = state.rewards.find((x) => x.id === el.dataset.id);
    if (!r || state.coins < r.cost || !confirm(`Kupić „${r.name}” za ${r.cost} monet?`)) return;
    state.coins -= r.cost;
    state.claimed.unshift({ name: r.name, cost: r.cost, t: Date.now() });
    state.counters.buys = cnt('buys') + 1;
    pushFeed(`🎁 Nagroda odebrana: <b>${esc(r.name)}</b>`);
    sfx.coin();
    fx.confetti();
    toast('<span class="t-icon">🎁</span><div><b>Nagroda odebrana!</b><br>Zasłużyłeś. Ciesz się bez wyrzutów.</div>');
    checkAch();
    save();
    render();
  },
  'del-reward'(el) {
    if (!confirm('Usunąć tę nagrodę z listy?')) return;
    state.rewards = state.rewards.filter((x) => x.id !== el.dataset.id);
    save();
    render();
  },
  'del-rule'(el) {
    state.rules.splice(+el.dataset.i, 1);
    save();
    render();
  },
  'plan-reset'() {
    if (!confirm('Przywrócić domyślny plan tygodnia? Twoje zmiany w planie zostaną nadpisane.')) return;
    state.plan = defaultPlan();
    save();
    render();
    toast('Plan przywrócony ✔');
  },
  export() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fightcamp-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  reset() {
    if (!confirm('Na pewno zresetować CAŁĄ grę? Stracisz XP, dziennik i zadania.')) return;
    if (!confirm('Ostatnie ostrzeżenie. Resetujemy?')) return;
    state = freshState();
    save();
    render();
    onboarding();
  },
};

const FORMS = {
  task(form) {
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    state.tasks.push({ id: uid(), title, cat: fd.get('cat') || 'inne', prio: !!fd.get('prio'), due: fd.get('due') || '', done: false, created: Date.now() });
    sfx.tick();
    save();
    render();
    $('input[name=title]')?.focus();
  },
  'edit-task'(form) {
    const fd = new FormData(form);
    const t = state.tasks.find((x) => x.id === fd.get('id'));
    if (!t) return;
    t.title = String(fd.get('title') || '').trim() || t.title;
    t.cat = fd.get('cat') || t.cat;
    t.due = fd.get('due') || '';
    if (!t.done) t.prio = !!fd.get('prio');
    save();
    closeModal();
    render();
  },
  session(form) {
    const fd = new FormData(form);
    const date = fd.get('date') || today();
    const type = state.plan.workouts[fd.get('type')] ? fd.get('type') : 'other';
    const wo = state.plan.workouts[type];
    const duration = clamp(parseInt(fd.get('duration'), 10) || 0, 0, 600);
    const rpe = clamp(parseInt(fd.get('rpe'), 10) || 7, 1, 10);
    const exercises = draft.exercises
      .map((e) => ({ name: e.name.trim(), sets: e.sets.filter((s) => s.reps !== '' || s.kg !== '').map((s) => ({ reps: s.reps === '' ? '' : +s.reps, kg: s.kg === '' ? '' : +s.kg })) }))
      .filter((e) => e.name && e.sets.length);
    const prs = [], prNames = [];
    for (const e of exercises) {
      const t = topSet(e); if (!t) continue;
      const k = normEx(e.name), prev = state.prs[k];
      if (prev && better(t, prev) && !prs.includes(k)) { prs.push(k); prNames.push(displayEx(e.name)); }
      if (better(t, prev)) state.prs[k] = t;
    }
    const xp = wo.xp + Math.min(30, Math.floor(duration / 10) * 3) + prs.length * 20 + (rpe >= 8 ? 10 : 0);
    const warm = !!fd.get('warm');
    closeModal();
    const s = { id: uid(), date, type, duration, rpe, mood: fd.get('mood') || '', notes: String(fd.get('notes') || '').trim().slice(0, 2000), exercises, prs, created: Date.now() };
    state.sessions.push(s);
    if (warm) completeWarmup(date);
    s.rec = award(xp, wo.stats, `Trening: ${wo.name}`, { counters: { sessions: 1, ...(type === 'mma' ? { mma: 1 } : {}), prs: prs.length } });
    if (prs.length) {
      setTimeout(() => { toast(`<span class="t-icon">🏆</span><div><b>NOWY REKORD!</b><br>${esc(prNames.join(', '))}</div>`, 3600); fx.confetti(); sfx.win(); }, 300);
    }
    checkDayComplete(date);
    save();
    render();
  },
  weight(form) {
    const kg = Math.round(parseFloat(new FormData(form).get('kg')) * 10) / 10;
    if (!(kg > 0)) return;
    const t = today();
    state.weights = state.weights.filter((w) => w.date !== t);
    state.weights.push({ date: t, kg });
    checkAch();
    save();
    render();
    toast(`⚖️ Zapisano: ${kg} kg`);
  },
  reward(form) {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const cost = clamp(parseInt(fd.get('cost'), 10) || 0, 10, 99999);
    if (!name) return;
    state.rewards.push({ id: uid(), name, cost });
    save();
    render();
  },
  rule(form) {
    const r = String(new FormData(form).get('rule') || '').trim();
    if (!r) return;
    state.rules.push(r);
    save();
    render();
  },
  profile(form) {
    const fd = new FormData(form);
    state.profile.name = String(fd.get('name') || '').trim();
    state.profile.nick = String(fd.get('nick') || '').trim();
    save();
    render();
    toast('Profil zapisany ✔');
  },
  plan(form) {
    const fd = new FormData(form);
    for (const dow of WEEK_ORDER) {
      const day = state.plan.days[dow];
      day.focus = String(fd.get(`focus_${dow}`) || '').trim();
      day.workout = state.plan.workouts[fd.get(`wo_${dow}`)] ? fd.get(`wo_${dow}`) : '';
      const lines = String(fd.get(`items_${dow}`) || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const old = day.items, used = new Set();
      day.items = lines.map((line) => {
        const prio = line.startsWith('*');
        const text = line.replace(/^\*\s*/, '').slice(0, 100);
        const ex = old.find((o) => o.text === text && !used.has(o.id));
        if (ex) used.add(ex.id);
        const kind = ex?.kind || inferKind(text);
        const it = { id: ex?.id || uid(), kind, text, prio };
        if (kind === 'training') it.workout = day.workout || 'other';
        return it;
      });
    }
    for (const k of Object.keys(state.plan.workouts)) {
      const v = fd.get(`ex_${k}`);
      if (v != null) state.plan.workouts[k].exercises = String(v).split('\n').map((s) => s.trim()).filter(Boolean);
    }
    save();
    render();
    toast('🗓️ Plan zapisany');
  },
  onb(form) {
    const fd = new FormData(form);
    state.profile.name = String(fd.get('name') || '').trim();
    state.profile.nick = String(fd.get('nick') || '').trim();
    state.profile.avatar = fd.get('avatar') || '🥊';
    state.onboarded = true;
    pushFeed(`🔔 ${esc(state.profile.nick || state.profile.name)} wchodzi do klatki!`);
    save();
    closeModal();
    sfx.bell();
    fx.confetti();
    render();
    toast(`<span class="t-icon">${BOSSES[state.boss.idx].emoji}</span><div><b>Pierwszy rywal już czeka:</b><br>${esc(BOSSES[state.boss.idx].name)}</div>`, 3600);
  },
};

/* ---------- event wiring ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][role=button]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && modalOpen && !modalOpts.noClose) closeModal();
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  FORMS[f.dataset.form]?.(f);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input === 'rpe') { const o = $('#rpe-out'); if (o) o.textContent = el.value; }
  if (draft && el.dataset.field && el.dataset.ex != null) {
    const ex = draft.exercises[+el.dataset.ex];
    if (!ex) return;
    if (el.dataset.field === 'name') ex.name = el.value;
    else ex.sets[+el.dataset.set][el.dataset.field] = el.value;
  }
});
document.addEventListener('change', (e) => {
  const el = e.target, k = el.dataset.change;
  if (!k) return;
  if (k === 'stype' && draft) {
    const filled = draft.exercises.some((x) => x.sets.some((s) => s.reps !== '' || s.kg !== ''));
    if (!filled || confirm('Zamienić listę ćwiczeń na tę z wybranego treningu?')) {
      draft.exercises = exFromPlan(el.value);
      $('#ex-list').innerHTML = exEditor();
    }
  }
  if (k === 'exsel') { ui.exSel = el.value; render(); }
  if (k === 'sound') { state.settings.sound = el.checked; save(); if (el.checked) sfx.coin(); }
  if (k === 'import') {
    const file = el.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (typeof data.xp !== 'number' || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) throw new Error('format');
        if (!confirm('Zastąpić obecne dane danymi z pliku?')) return;
        state = migrate(Object.assign(freshState(), data));
        save();
        render();
        toast('✔ Dane zaimportowane');
      } catch {
        toast('⚠️ To nie wygląda na kopię Fight Camp');
      }
    };
    rd.readAsText(file);
    el.value = '';
  }
});
document.addEventListener('toggle', (e) => { if (e.target.id === 'done-box') ui.doneOpen = e.target.open; }, true);
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1);
  if (t && t !== ui.tab && ['arena', 'tasks', 'journal', 'timer', 'profile'].includes(t)) { ui.tab = t; render(); }
});

// odśwież po północy / po powrocie do karty
let lastDay = today();
function dayRollover() {
  if (today() === lastDay) return;
  lastDay = today();
  const busy = modalOpen || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (!busy) render();
}
setInterval(dayRollover, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { dayRollover(); if (T.phase !== 'idle') updateTimerDisplay(); } });

/* ---------- boot ---------- */
(function boot() {
  const prevBoss = state.boss;
  ensureBoss();
  render();
  if (!state.onboarded) onboarding();
  else if (prevBoss && prevBoss.week !== state.boss.week) bossIntro(prevBoss);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
