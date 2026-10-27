// ★ Phaser 3.90 是 **UMD**，不是 ES 模块：原版靠 `index.html` 里一条普通
//   `<script src>` 把它挂到 `window.Phaser`。插件里没有那条 script，
//   所以要把它拉进包 —— 但**不能**用副作用 import。
//
//   ★★ 为什么不能副作用 import（2026-10-27 真踩）：Phaser 的 `device` 模块在
//   **求值那一刻**就读 `window.cordova`，而宿主 `scripts/check-plugin.mjs` 会在
//   Node 里真 `import()` 一次插件包（硬闸门）⇒ 报 `window is not defined`，
//   看着像插件坏了。其它十一款用的都是 ES 模块引擎（pixi / three / rapier），
//   顶层不碰 window，所以只有这一款会红。
//
//   `engines/phaser-lazy.js`（由 `scripts/make-phaser-lazy.mjs` 从
//   `engines/phaser.min.js` 生成）把整段 UMD 包进一个函数，`ensurePhaser()`
//   调用时才求值 ⇒ Node 里 import 安全，浏览器里行为不变。
//   `engines/phaser.min.js` 只改了一处：UMD 的 `this` → `globalThis`
//   （ES 模块顶层 `this` 是 `undefined`，不改会在 `t.Phaser=e()` 那行抛）。
import { ensurePhaser } from './engines/phaser-lazy.js';
import { loadSoundSystem } from '@makeplay/sound';
import { I18N, LANGS } from './i18n.js';
import { setAssetRoot, assetUrl, assetRoot } from './src/asset.js';
import { installGp, makeLocalStore } from './src/host.js';

/* ============ 插件注入项（独立网页全是默认值） ============ */
// 容器尺寸。null = 用 window（网页形态）。插件里按 `mount(container)` 那个盒子量，
// 否则 canvas 会按整屏算比例、再被 FIT 缩进容器 ⇒ 平板下上下各留一大条黑边。
let VIEW = null;
// 插件里不碰宿主的 `document.title` / `<html lang>`。
let IS_PLUGIN = false;
// `loadSoundSystem()` 的参数。null = 用默认的 `./sound.manifest.json`（网页形态）。
let SOUND_OPTS = null;
// 背景模糊层（原版在 index.html 里；插件里由 start() 现建）。
let BGFILL = null;
// 挂到 window/document 上的监听。原版全是匿名函数 ⇒ 卸载摘不掉 ⇒ 二次挂载会叠加。
let UNBINDS = [];
// 当前场景。`unmount` 要靠它做最后一次存档 —— `game.scene.getScene('Main')`
// 在销毁竞态里可能拿到已销毁的实例，直接持有引用更稳。
let SCENE = null;
// 世代号：`onCore()` 里有 await，卸载后那次续跑必须自己认出来并退出。
let GEN = 0;
function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  UNBINDS.push(() => { try { target.removeEventListener(type, fn, opts); } catch (e) { /* */ } });
}

/* ============ 常量与数据 ============ */
let W = 720;
const LAY = {"body": {"x": 52, "y": 18, "w": 408, "h": 427}, "cheekL": {"x": 68, "y": 219, "w": 189, "h": 224}, "cheekR": {"x": 257, "y": 220, "w": 187, "h": 223}, "tail": {"x": 192, "y": 105, "w": 135, "h": 127}, "heart": {"x": 195, "y": 220, "w": 127, "h": 97}, "legL": {"x": 89, "y": 416, "w": 117, "h": 71}, "legR": {"x": 310, "y": 416, "w": 113, "h": 71}};
const FLAY = {"body": {"x": 81, "y": 326, "w": 470, "h": 296}, "bodyH": {"x": 81, "y": 326, "w": 470, "h": 296}, "head": {"x": 89, "y": 78, "w": 455, "h": 363}, "headH": {"x": 89, "y": 78, "w": 455, "h": 363}, "headW": {"x": 89, "y": 78, "w": 455, "h": 363}, "headB": {"x": 89, "y": 78, "w": 455, "h": 363}, "earL": {"x": 89, "y": 9, "w": 172, "h": 208}, "earR": {"x": 374, "y": 9, "w": 169, "h": 207}, "pawL": {"x": 184, "y": 520, "w": 141, "h": 99}, "pawR": {"x": 319, "y": 520, "w": 128, "h": 98}, "headT": {"x": 89, "y": 78, "w": 455, "h": 363}, "headTH": {"x": 89, "y": 78, "w": 455, "h": 363}, "_S": 0.62, "_W": 635, "_H": 635};
const FRONT_PARTS = ['body', 'pawL', 'pawR', 'earL', 'earR', 'bodyH', 'head', 'headH', 'headW', 'headB', 'headT', 'headTH'];
function calcSize() {
  const vw = VIEW ? VIEW.w : window.innerWidth, vh = VIEW ? VIEW.h : window.innerHeight;
  const asp = vw / Math.max(1, vh);
  if (asp <= 720 / 1180) return [720, Math.round(Math.min(1560, Math.max(1180, 720 / asp)))];
  return [Math.round(Math.max(720, Math.min(2400, 1300 * asp))), 1300];
}
const FONT = 'MpFontDisplay, "Noto Sans CJK SC", "Noto Sans CJK JP", "Droid Sans Fallback", "PingFang SC", "Hiragino Sans", sans-serif';
const FONT_ID = 'smiley-sans/SmileySans-Oblique.woff2';
const NAVY = 0x1f2b5e, BERRY = 0xe0457b, CREAM = 0xfbf1dc, SAGE = 0x8fb48a, LAV = 0xb9a7e6;
const NAVY_S = '#1f2b5e';
const SAVE_KEY = 'duang_save_v1', SET_KEY = 'duang_settings_v1';
const OFFLINE_CAP = 6 * 3600, OFFLINE_RATE = 0.3, OFFLINE_MAXH = 2; // 最多算6小时、效率30%、单次不超过当前每秒产出×2小时
// 在线陪伴产出：只在玩家在线（页面可见、游戏中）时生效，不计入离线结算与离线上限
// rate = 基础10/秒 × 进阶档 × (1 + 0.2×(柯基数-1)) + 自动产出的 10%；再乘饱饱度（吃饱=满额）
const COMP = { base: 10, stage: [1, 1.5, 2.5, 4], perPet: 0.2, share: 0.1, rate: (st, n) => 10 * [1, 1.5, 2.5, 4][st] * (1 + 0.2 * (n - 1)) };
const OFF_HUNGER = [1, 0.8, 0.5]; // 离线时饿了额外降效（饱/有点饿/很饿）
const SAT_DRAIN = 100 / (9 * 3600), SAT_SNACK = 10, SAT_FEED = 55; // 饱饱度：约9小时从满到空；买点心+10；一顿饭+55
// 三档：饱饱(>=60) / 有点饿(25~60) / 好饿(<25)。饿了只降低产出，不惩罚
const satTier = (v) => (v >= 60 ? 0 : v >= 25 ? 1 : 2);
const satMul = (v) => [1.2, 1, 0.75][satTier(v)];
// 三餐时段（本地时间，[开始时, 结束时)）：早 6-10 / 午 11-14 / 晚 17-21
const MEALS = [[6, 10], [11, 14], [17, 21]];
const mealNow = (d = new Date()) => { const h = d.getHours(); return MEALS.findIndex(([a, b]) => h >= a && h < b); };
// 连续照顾里程碑：第 3/7/14/30 天；w=专属装扮 id，coat=随机稀有毛色（全有则换大把爱心）
const CARE_MS = [3, 7, 14, 30], CARE_REW = [{ w: 14 }, { w: 13 }, { coat: 1, k: 1 }, { coat: 1, k: 3 }];

const SNACKS = [
  { ic: 'sn0', base: 500, g: 1.3, add: 1 },
  { ic: 'sn1', base: 6000, g: 1.28, add: 6 },
  { ic: 'sn2', base: 1.2e5, g: 1.26, add: 36 },
  { ic: 'sn3', base: 1.6e6, g: 1.25, add: 220 },
  { ic: 'sn4', base: 2e7, g: 1.24, add: 1300 },
  { ic: 'sn5', base: 3e8, g: 1.23, add: 8000 },
];
// 零食等级里程碑：达到 10/25/50 级时该零食的点击加成翻倍提升
const SNACK_MS = [10, 25, 50], SNACK_MSM = [1.25, 1.5, 2];
function msTier(lv) { let n = 0; SNACK_MS.forEach((m) => { if (lv >= m) n++; }); return n; }
function msMul(lv) { const n = msTier(lv); return n ? SNACK_MSM[n - 1] : 1; }
// 毛色：kind start 初始 / common 用爱心领养 / rare 条件或随机事件获得；home 为花园常驻位置
const COATS = [
  { kind: 'start', rate: 6, home: [0.17, 0.30] },
  { kind: 'common', adopt: 8000, rate: 30, home: [0.84, 0.33] },
  { kind: 'common', adopt: 1.2e6, rate: 250, home: [0.17, 0.50] },
  { kind: 'rare', rate: 1500, home: [0.85, 0.50], hint: 'hint3' },
  { kind: 'rare', rate: 6000, home: [0.40, 0.14], hint: 'hint4' },
  { kind: 'rare', rate: 20000, home: [0.72, 0.16], hint: 'hint5' },
  { kind: 'rare', rate: 60000, home: [0.15, 0.72], hint: 'hint6' },
];
const LEGACY_STAGE_AT = [0, 45, 150, 340], STAGE_MUL = [1, 1.8, 3.2, 6];
// 进阶需同时满足：零食总数 sn、指定档零食等级 hi=[档位,等级]、亲密档位 bond、喂食次数 fed
const STAGE_REQ = [null,
  { sn: 25, hi: [1, 4], bond: 2, fed: 0 },
  { sn: 55, hi: [2, 4], bond: 3, fed: 2 },
  { sn: 100, hi: [3, 5], bond: 4, fed: 8 }];
const BOND_AT = [300, 2500, 6500, 22000], BOND_REWARD = [-1, 10, -1, 2]; // 档位2、4奖励的装扮 id
const PG_BASE = 1.1e10, PG_STEP = 10, TROPHY_PCT = 30;
const PEEK = { w: 387, h: 420 };
// pos: 横向比例, 纵向深度 v(0=远 1=近), w: 基础宽度
const DECOR = [
  { ic: 'de0', cost: 1500, pct: 8, pos: [0.84, 0.17], w: 150 },
  { ic: 'de1', cost: 15000, pct: 10, pos: [0.13, 0.20], w: 130 },
  { ic: 'de2', cost: 2e5, pct: 12, pos: [0.09, 0.42], w: 150 },
  { ic: 'de3', cost: 2.5e6, pct: 15, pos: [0.90, 0.47], w: 170 },
  { ic: 'de4', cost: 3e7, pct: 18, pos: [0.14, 0.76], w: 190 },
  { ic: 'de5', cost: 4e8, pct: 22, pos: [0.60, 0.09], w: 80 },
  { ic: 'de6', cost: 5e9, pct: 26, pos: [0.30, 0.06], w: 100 },
  { ic: 'de7', cost: 6e10, pct: 35, pos: [0.50, 0.03], w: 230 },
];
// slot: 0头饰 1上衣(已下架) 2颈部 3尾部
const WEAR = [
  { slot: 0, ic: 'cs0', cost: 300, st: { l: 'head', x: 130, y: 100, w: 90, r: -0.4 } },
  { slot: 0, ic: 'cs1', icB: 'cs1b', cost: 2500, st: { l: 'head', x: 256, y: 84, w: 150, r: 0 } },
  { slot: 0, ic: 'cs4', cost: 300000, st: { l: 'head', x: 256, y: 80, w: 100, r: 0 } },
  { slot: 0, ic: 'cs3', cost: 20000, st: { l: 'head', x: 256, y: 62, w: 165, r: 0 } },
  // 4-7 原「上衣」分类已下架：保留占位以保持 id 稳定（老存档自动退款）
  { slot: 1, gone: true, cost: 6000 }, { slot: 1, gone: true, cost: 50000 }, { slot: 1, gone: true, cost: 400000 }, { slot: 1, gone: true, cost: 3000000 },
  { slot: 2, ic: 'cs2', icB: 'cs2b', cost: 1500, st: { l: 'neck', x: 256, y: 150, w: 200, r: 0 } },
  { slot: 2, ic: 'cx4', cost: 12000, st: { l: 'neck', x: 256, y: 118, w: 150, r: 0 } },
  { slot: 2, ic: 'cs7', cost: 150000, st: { l: 'neck', x: 256, y: 116, w: 90, r: 0 } },
  { slot: 3, ic: 'cx5', cost: 30000, wing: true },
  { slot: 3, ic: 'cx6', cost: 900, st: { l: 'tail', x: 258, y: 205, w: 80, r: 0 } },
  // 13/14 连续照顾专属头饰（只在头上，背面不遮屁屁）
  { slot: 0, ic: 'cs8', cost: 0, st: { l: 'head', x: 256, y: 70, w: 150, r: 0 } },
  { slot: 0, ic: 'cs9', cost: 0, st: { l: 'head', x: 374, y: 98, w: 86, r: 0.38 } },
];
// 正面穿搭:head=头层锚定(缩放);body/pants/neck=已按身体轮廓裁好的整图(左上角坐标,身体层内);hide=正面隐藏
const FWEAR = {"8": {"l": "neck", "x": 207, "y": 431}, "9": {"l": "neck", "x": 192, "y": 432}, "10": {"l": "neck", "x": 267, "y": 423}, "11": {"l": "wing"}, "0": {"l": "head", "x": 176, "y": 132, "w": 104, "r": -0.45}, "1": {"l": "head", "x": 317, "y": 88, "w": 240, "r": 0}, "2": {"l": "head", "x": 317, "y": 96, "w": 200, "r": 0}, "3": {"l": "head", "x": 317, "y": 98, "w": 240, "r": 0}, "12": {"l": "hide"}, "13": {"l": "head", "x": 317, "y": 70, "w": 210, "r": 0}, "14": {"l": "head", "x": 452, "y": 132, "w": 100, "r": 0.42}};
const SETS = [[1, 8, 12], [2, 10, 11], [3, 9, 12]]; // 头饰+颈部+尾部
const WEAR_SLOTS = [0, 2, 3];
const SET_PCT = 20, WEAR_PCT = 3;

/* ============ 工具 ============ */
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
function fmt(n, dec) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) {
    if (dec && n < 10 && Math.abs(n - Math.round(n)) > 0.05) return n.toFixed(1);
    return String(Math.floor(n + 1e-9));
  }
  let i = 0;
  while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
  let s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s + SUF[i];
}
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function shade(c, f) {
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round(lerp(r, t, p)); g = Math.round(lerp(g, t, p)); b = Math.round(lerp(b, t, p));
  return (r << 16) | (g << 8) | b;
}
class Sp { // 弹簧
  constructor(k = 260, c = 8) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; }
    this.x = clamp(this.x, -2, 2.4);
  }
}

/* ============ 设置 / 语言 ============ */
const settings = { lang: null, music: true, sfx: true };
// 设置存在 __sys 存档位（不进自动存档、不用 localStorage）
const SET_SLOT = '__sys_settings';
let setSlotId = null, setT = 0;
async function loadSettings() {
  const S = window.gp?.player?.saves; if (!S) return;
  try {
    const row = (await S.list(100)).find((r) => r.kind === 'manual' && r.name === SET_SLOT); if (!row) return;
    setSlotId = row.id; const f = await S.get(row.id); const d = f && (typeof f.data === 'string' ? JSON.parse(f.data) : f.data);
    if (d && typeof d === 'object') { if (['zh', 'en', 'ja'].includes(d.lang)) settings.lang = d.lang; if (typeof d.music === 'boolean') settings.music = d.music; if (typeof d.sfx === 'boolean') settings.sfx = d.sfx; }
  } catch (e) { /* */ }
}
function saveSettings() {
  clearTimeout(setT);
  setT = setTimeout(async () => {
    const S = window.gp?.player?.saves; if (!S) return;
    const d = { lang: settings.lang, music: settings.music, sfx: settings.sfx };
    try { if (setSlotId) { if (await S.update(setSlotId, d)) return; } const r = await S.create(d, SET_SLOT); if (r) setSlotId = r.id; } catch (e) { /* */ }
  }, 800);
}
function detectLang() {
  const pick = (s) => { s = String(s || '').toLowerCase(); if (s.startsWith('zh')) return 'zh'; if (s.startsWith('ja')) return 'ja'; if (s.startsWith('en')) return 'en'; return null; };
  // ★★ 这个函数在**模块顶层**就会被调用（`let lang = … detectLang()`），而宿主
  //    `scripts/check-plugin.mjs` 会在 **Node** 里真 `import()` 一次插件包 ——
  //    直接读 `window.gp` 会抛 `window is not defined`（2026-10-27 真踩）。
  //    浏览器里两者都在，行为不变；插件形态的语言由 `start()` 的 `ctx.locale` 决定。
  const gpLocale = typeof window !== 'undefined' ? window.gp?.player?.user?.locale : null;
  const navLocale = typeof navigator !== 'undefined' ? navigator.language : null;
  return pick(gpLocale) || pick(navLocale) || 'zh';
}
let lang = settings.lang || detectLang();
const tr = (k, p) => {
  let s = (I18N[lang] && I18N[lang][k]) ?? I18N.zh[k] ?? k;
  if (p) for (const key in p) s = s.replace('{' + key + '}', p[key]);
  return s;
};

/* ============ 存档 ============ */
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const BOND_ONLY = new Set(BOND_REWARD.filter((x) => x >= 0));
const CARE_ONLY = new Set(CARE_REW.filter((r) => r.w != null).map((r) => r.w));
function newPet(coat, nm) { return { coat, nm, sn: SNACKS.map(() => 0), stg: 0, bond: 0, bt: 0, fed: 0, sat: 80, worn: [-1, -1, -1, -1] }; }
function freshTasks() { return { day: '', ids: [0, 1, 2], p: [0, 0, 0, 0, 0], got: [0, 0, 0] }; }
function freshState() {
  return { v: 4, hearts: 0, total: 0, run: 0, pets: [newPet(0, 0)], main: 0, de: DECOR.map(() => 0), own: WEAR.map(() => 0), pg: 0, tro: 0, tk: freshTasks(), ck: { last: '', streak: 0 }, meal: { day: '', got: [0, 0, 0] }, care: { last: '', streak: 0, mu: 0, best: 0, ms: [0, 0, 0, 0] }, last: Date.now() };
}
function migrate(d) {
  if (!d || typeof d !== 'object' || typeof d.hearts !== 'number') return null;
  const fit = (a, n) => Array.from({ length: n }, (_, i) => (Number.isFinite(a?.[i]) ? a[i] : 0));
  const f = freshState();
  f.hearts = d.hearts; f.total = Number.isFinite(d.total) ? d.total : d.hearts; f.run = Number.isFinite(d.run) ? d.run : f.total;
  f.de = fit(d.de, DECOR.length); f.own = fit(d.own, WEAR.length);
  f.last = Number.isFinite(d.last) ? d.last : Date.now();
  const sat0 = Number.isFinite(d.sat) ? clamp(d.sat, 0, 100) : 80; // v3 及以前是全局饱饱度 → 迁移到每只柯基
  f.pets[0].sat = sat0;
  { let rf = 0; WEAR.forEach((w, i) => { if (w.gone && f.own[i]) { rf += w.cost; f.own[i] = 0; } }); if (rf > 0) { f.hearts += rf; f.total += rf; f.rf = rf; } }
  const okWorn = (w, own) => (Array.isArray(w) && w.length === 4 ? w.map((x, s) => (Number.isInteger(x) && WEAR[x] && WEAR[x].slot === s && own[x] ? x : -1)) : [-1, -1, -1, -1]);
  if (d.v === 1) {
    if (!Array.isArray(d.sn)) return null;
    const p0 = f.pets[0]; p0.sn = fit(d.sn, SNACKS.length); p0.worn = okWorn(d.worn, f.own);
    const map = [1, 3, 4, 2, 5]; // 旧五种小柯基 → 新毛色
    fit(d.co, 5).forEach((n, i) => { if (n > 0) { const p = newPet(map[i], f.pets.length); p.bond = Math.min(300, n * 12); f.pets.push(p); } });
    f.pets.forEach((p) => { const c = p.sn.reduce((a, b) => a + b, 0); let st = 0; LEGACY_STAGE_AT.forEach((t, k) => { if (c >= t) st = k; }); p.stg = st; });
  } else if (d.v === 2 || d.v === 3 || d.v === 4) {
    if (!Array.isArray(d.pets) || !d.pets.length) return null;
    f.pets = d.pets.filter((p) => p && Number.isInteger(p.coat) && COATS[p.coat]).map((p, i) => ({ coat: p.coat, nm: Number.isInteger(p.nm) ? p.nm : i, sn: fit(p.sn, SNACKS.length), stg: clamp(p.stg | 0, 0, 3), bond: Math.max(0, +p.bond || 0), bt: clamp(p.bt | 0, 0, 4), fed: Math.max(0, p.fed | 0), sat: Number.isFinite(p.sat) ? clamp(p.sat, 0, 100) : sat0, worn: okWorn(p.worn, f.own) }));
    if (!f.pets.length) return null;
    // 老存档迁移：已得阶段不回退；喂食次数补到已得阶段的要求，避免下一阶被新条件卡住
    if (d.v === 2) {
      const OLD_BOND = [120, 450, 1300, 3200];
      f.pets.forEach((q) => {
        const r = STAGE_REQ[q.stg]; if (r) q.fed = Math.max(q.fed, r.fed);
        let t = 0; OLD_BOND.forEach((x, k) => { if (q.bond >= x) t = k + 1; });
        if (t) q.bond = Math.max(q.bond, BOND_AT[t - 1]); // 旧亲密档位不回退
      });
    }
    f.main = Number.isInteger(d.main) && f.pets[d.main] ? d.main : 0;
    f.pg = Math.max(0, d.pg | 0); f.tro = Math.max(0, d.tro | 0);
    if (d.tk && Array.isArray(d.tk.ids)) f.tk = { day: String(d.tk.day || ''), ids: d.tk.ids.slice(0, 3).map((x) => clamp(x | 0, 0, 4)), p: fit(d.tk.p, 5), got: fit(d.tk.got, 3) };
    if (d.ck) f.ck = { last: String(d.ck.last || ''), streak: Math.max(0, d.ck.streak | 0) };
    if (d.meal) f.meal = { day: String(d.meal.day || ''), got: fit(d.meal.got, 3) };
    if (d.care) f.care = { last: String(d.care.last || ''), streak: Math.max(0, d.care.streak | 0), mu: d.care.mu ? 1 : 0, best: Math.max(0, d.care.best | 0), ms: fit(d.care.ms, 4) };
  } else return null;
  return f;
}

/* ============ 音频 ============ */
let sound = null, soundReady = false;
let soundP = null;
function startSound() { if (!soundP) soundP = loadSoundSystem(SOUND_OPTS || undefined).then((s) => { sound = s; applyVolumes(); }).catch(() => {}); return soundP; }
function applyVolumes() {
  try { sound?.settings.setVolumes({ master: 1, music: settings.music ? 1 : 0, sfx: settings.sfx ? 1 : 0 }); } catch (e) { /* */ }
}
async function unlockAudio() {
  if (soundReady) return;
  try {
    await startSound(); if (!sound) return;
    await sound.unlock(); soundReady = true; applyVolumes();
    await sound.setMusicState('main');
  } catch (e) { /* */ }
}
let eid = 0;
function sfx(id, o) { if (!soundReady || !settings.sfx) return; try { sound.playCue(id, Object.assign({ eventId: id + (eid++) }, o)).catch(() => {}); } catch (e) { /* */ } }

/* ============ 场景 ============ */
const PARTS = ['body', 'cheekL', 'cheekR', 'tail', 'heart', 'legL', 'legR'];
const SCENE_BG = ['bg-garden', 'bg-sea', 'bg-sakura', 'bg-snow'];
/* ★ 场景类必须是「用的时候才建」：`extends Phaser.Scene` 的基类在**类定义那一刻**
   就要取值，而 Phaser 现在要到 `start()` 里 `ensurePhaser()` 之后才存在
   （原因见文件顶部）。所以整个类体 + 后面那段 `Object.assign(Main.prototype, …)`
   一起包进 `defineMain()` —— 只多一层作用域，缩进和类体一个字没动。 */
let Main = null;
function defineMain() {
  if (Main) return Main;
  Main = class Main extends Phaser.Scene {
  constructor() { super('Main'); }

  create() {
    this.H = this.scale.height;
    this.mode = 'loading';
    this.texts = [];
    this.state = freshState();
    this.canSave = true;
    this.t = 0;
    SCENE = this;
    this.cameras.main.setBackgroundColor('#cdbcf0');
    this.makeTextures();
    if (!IS_PLUGIN) document.title = tr('title');
    this.buildTitle('loading');
    window.__gpReady = true;
    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('wheel', (p, o, dx, dy) => { if (this.mode === 'play' && p.y > this.panelTop) this.scrollTo(this.scrollX - (dy + dx) * 0.8); });
    on(window, 'keydown', () => unlockAudio());
    on(window, 'pointerdown', () => unlockAudio(), { capture: true });
    on(document, 'visibilitychange', () => this.onVis());
    on(window, 'pagehide', () => this.saveNow());
    if (new URLSearchParams(location.search).has('playtest')) this.installBridge();
    this.startFonts();
    this.loadCore();
  }
  preload() {
    this.H = this.scale.height;
    const L = this.load; L.setPath(assetUrl('assets/'));
    L.image('bgT', `bg-title-${W < this.H ? 'p' : 'l'}.jpg`);
    for (const k of FRONT_PARTS) L.image(`fc0_${k}`, `front/c0/${k}.webp`);
    L.image('mi0', 'misc/0.webp'); L.image('mi5', 'misc/5.webp'); L.image('mi2', 'misc/2.webp');
  }

  startFonts() {
    const run = () => {
      try { window.gp?.fonts?.use({ display: FONT_ID, body: 'system', lang }); } catch (e) { /* */ }
      try { document.fonts.load('24px MpFontDisplay', '中あA').then(() => this.refreshTexts()).catch(() => {}); } catch (e) { /* */ }
    };
    run();
    this.runFonts = run;
  }

  /* ---- 柯基分层装配（加载页与主角共用） ---- */
  makeRig(coat) {
    const GX = 256, GY = 480;
    const rig = this.add.container(0, 0);
    const mk = (px, py) => { const c = this.add.container(px - GX, py - GY); c.px = px; c.py = py; return c; };
    const put = (c, key) => { const l = LAY[key]; const im = this.add.image(l.x - c.px, l.y - c.py, `cc${coat}_${key}`).setOrigin(0, 0); c.add(im); return im; };
    const R = { rig, ims: {} };
    R.legLC = mk(147, 420); R.ims.legL = put(R.legLC, 'legL');
    R.legRC = mk(366, 420); R.ims.legR = put(R.legRC, 'legR');
    R.headC = this.add.container(184, -215); R.headIm = this.add.image(0, 0, `cc${coat}_peek`); R.headIm.setScale(300 / PEEK.h); R.headC.add(R.headIm); R.headC.setVisible(false);
    R.bodyC = mk(256, 445); R.ims.body = put(R.bodyC, 'body');
    R.cheekL = mk(225, 380); R.ims.cheekL = put(R.cheekL, 'cheekL');
    R.cheekR = mk(287, 380); R.ims.cheekR = put(R.cheekR, 'cheekR');
    R.heartC = mk(258, 262); R.ims.heart = put(R.heartC, 'heart');
    R.tailC = mk(258, 228); R.ims.tail = put(R.tailC, 'tail');
    R.accC = mk(256, 445);
    rig.add([R.legLC, R.legRC, R.headC, R.bodyC, R.cheekL, R.cheekR, R.heartC, R.tailC, R.accC]);
    R.coat = coat;
    return R;
  }
  setRigCoat(R, coat) {
    if (!this.textures.exists(`cc${coat}_body`)) return;
    R.coat = coat;
    for (const k in R.ims) R.ims[k].setTexture(`cc${coat}_${k}`);
    R.headIm.setTexture(`cc${coat}_peek`);
  }

  /* 启动读档：getLatest 是权威结果；读不到（已登录但出错）时不覆盖云端 */
  async bootRead() {
    const S = window.gp?.player?.saves; if (!S) return null;
    let latest = null, timedOut = false;
    try { latest = await Promise.race([S.getLatest(), new Promise((r) => setTimeout(() => { timedOut = true; r(null); }, 8000))]); } catch (e) { latest = null; }
    if (latest) {
      let d = latest.data;
      if (latest.legacy && d && typeof d === 'object') d = d[SAVE_KEY]; // 旧版本 localStorage 影子存档
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      const st = migrate(d);
      if (!st) { this.canSave = false; return null; } // 有数据但读不懂：不覆盖
      if (latest.legacy) this.migratedLegacy = true;
      return st;
    }
    if ((timedOut || S.lastError) && window.gp?.player?.user) this.canSave = false;
    return null;
  }
  loadSave(s) {
    this.state = s || freshState();
    this.offlineGain = 0; this.offlineSec = 0;
    if (this.state.rf) { this.topRefund = this.state.rf; delete this.state.rf; this.dirty = true; }
    const away = Math.max(0, (Date.now() - this.state.last) / 1000);
    this.state.hearts = Math.max(0, this.state.hearts);
    this.pets().forEach((p) => this.stageOf(p));
    if (s && away >= 30) this.applyOffline(away); else if (s && away > 0) this.drainSat(away);
    this.state.last = Date.now();
    if (this.migratedLegacy) { this.migratedLegacy = false; this.dirty = true; }
  }
  /* 离线收益：按饱饱度随时间下降逐段积分；最多算 6 小时、效率 30%、单次封顶 = 离开时每秒产出 × 2 小时 */
  offlineCalc(away) {
    const sec = Math.min(OFFLINE_CAP, away), N = 72, h = sec / N, cap = this.hps(true) * 3600 * OFFLINE_MAXH;
    const keep = this.pets().map((p) => p.sat); let g = 0, hungryT = 0;
    for (let k = 0; k < N; k++) {
      this.drainSat(h / 2); // 取每段中点的饱饱度
      const tier = satTier(this.pet().sat); if (tier >= 1) hungryT += h;
      g += this.hps(true) * OFF_HUNGER[tier] * h * OFFLINE_RATE;
      this.drainSat(h / 2);
    }
    this.pets().forEach((p, i) => { p.sat = keep[i]; });
    return { gain: Math.min(g, cap), raw: g, capped: g > cap, sec, hungryT };
  }
  applyOffline(away) {
    const r = this.offlineCalc(away);
    this.drainSat(away); // 饱饱度按真实离开时长下降
    if (r.gain > 0) { this.offlineGain = r.gain; this.offlineSec = away; this.offlineInfo = r; }
    return r;
  }
  drainSat(sec) { this.pets().forEach((p) => { p.sat = Math.max(0, p.sat - SAT_DRAIN * sec); }); }
  saveNow() {
    if (this.mode === 'loading') return;
    const s = this.state; s.last = Date.now();
    if (this.canSave) { try { window.gp?.player?.saves?.putLatest(s); } catch (e) { /* */ } }
    this.dirty = false;
  }
  onVis() {
    if (this.mode === 'loading') return;
    if (document.hidden) { this.hiddenAt = Date.now(); this.saveNow(); return; }
    if (this.hiddenAt) {
      const away = Math.max(0, (Date.now() - this.hiddenAt) / 1000); this.hiddenAt = 0;
      // 后台时 Phaser 主循环暂停（rAF 停止，回来后单帧 dt 被限制在 0.05s），这段时间只在这里结算一次
      if (away >= 60 && this.mode === 'play' && !this.modal) { this.applyOffline(away); if (this.offlineGain > 0) this.showOffline(); }
      else this.drainSat(away);
      this.saveNow(); // 已结算到现在（saveNow 写入 last），，重开页面不会重复计算
    }
  }

  /* ---- 纹理 ---- */
  makeTextures() {
    const mk = (key, w, h, fn) => { const c = this.textures.createCanvas(key, w, h); fn(c.getContext(), w, h); c.refresh(); };
    mk('hl', 64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    mk('shadow', 128, 64, (x) => { const g = x.createRadialGradient(64, 32, 0, 64, 32, 62); g.addColorStop(0, 'rgba(58,42,90,.55)'); g.addColorStop(0.6, 'rgba(58,42,90,.25)'); g.addColorStop(1, 'rgba(58,42,90,0)'); x.save(); x.scale(1, 0.5); x.translate(0, 32); x.fillStyle = g; x.fillRect(0, -32, 128, 128); x.restore(); });
    mk('cloud', 320, 150, (x) => {
      const puff = [[70, 100, 52], [135, 78, 62], [205, 92, 56], [255, 108, 42], [160, 108, 60], [100, 112, 44]];
      x.shadowColor = 'rgba(150,120,200,.35)'; x.shadowBlur = 14; x.shadowOffsetY = 6; x.fillStyle = '#fffaf2';
      puff.forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
      x.shadowColor = 'transparent'; const g = x.createLinearGradient(0, 20, 0, 140); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(226,214,248,.55)');
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, 320, 150);
    });
    mk('petal', 28, 36, (x) => { const g = x.createLinearGradient(0, 0, 0, 36); g.addColorStop(0, '#ffd3e4'); g.addColorStop(1, '#f48fb6'); x.fillStyle = g; x.beginPath(); x.moveTo(14, 35); x.bezierCurveTo(-6, 22, 0, 4, 14, 2); x.bezierCurveTo(28, 4, 34, 22, 14, 35); x.fill(); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(14, 8); x.lineTo(14, 28); x.stroke(); });
    mk('conf', 12, 18, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(0, 0, 12, 18, 3) : x.rect(0, 0, 12, 18); x.fill(); });
    mk('dot', 16, 16, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(8, 8, 8, 0, 7); x.fill(); });
    mk('star', 48, 48, (x) => { x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 22, a = i * Math.PI / 4 - Math.PI / 2; x.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } x.closePath(); x.fill(); });
    mk('hp', 128, 116, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 108); x.bezierCurveTo(-30, 50, 20, -10, 64, 34); x.bezierCurveTo(108, -10, 158, 50, 64, 108); x.fill(); });
    // 肉垫（4 个趾 + 掌垫）
    mk('paw', 96, 96, (x) => {
      x.fillStyle = '#fff';
      const ell = (cx, cy, rx, ry, r) => { x.save(); x.translate(cx, cy); x.rotate(r); x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); x.restore(); };
      ell(20, 38, 10, 14, -0.4); ell(37, 20, 10, 15, -0.12); ell(59, 20, 10, 15, 0.12); ell(76, 38, 10, 14, 0.4);
      x.beginPath(); x.moveTo(48, 44); x.bezierCurveTo(70, 44, 84, 66, 80, 76); x.bezierCurveTo(76, 90, 60, 82, 48, 82); x.bezierCurveTo(36, 82, 20, 90, 16, 76); x.bezierCurveTo(12, 66, 26, 44, 48, 44); x.fill();
    });
    // 指向的小手（指尖在左上）
    mk('hand', 120, 150, (x) => {
      x.lineJoin = 'round'; x.lineWidth = 7; x.strokeStyle = '#1f2b5e'; x.fillStyle = '#fffaf0';
      x.beginPath(); x.moveTo(30, 8); x.quadraticCurveTo(42, 2, 48, 14); x.lineTo(54, 66); x.quadraticCurveTo(70, 52, 80, 62); x.quadraticCurveTo(100, 56, 104, 74); x.quadraticCurveTo(116, 86, 108, 116); x.quadraticCurveTo(98, 144, 66, 144); x.quadraticCurveTo(34, 142, 30, 108); x.lineTo(26, 70); x.quadraticCurveTo(14, 40, 26, 16); x.closePath();
      x.fill(); x.stroke();
      x.lineWidth = 4; x.beginPath(); x.moveTo(80, 64); x.lineTo(80, 86); x.moveTo(100, 76); x.lineTo(100, 92); x.stroke();
    });
  }

  /* ---- 文字 ---- */
  txt(x, y, fn, size, color, o = {}) {
    const t = this.add.text(x, y, '', { fontFamily: FONT, fontSize: size + 'px', color, align: o.align || 'center', stroke: o.stroke, strokeThickness: o.sw || 0, wordWrap: o.wrap ? { width: o.wrap } : undefined });
    t.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
    const r = { o: t, fn, fit: o.fit };
    (o.title ? this.ttlTexts : this.texts).push(r); this.applyText(r);
    return t;
  }
  applyText(r) {
    if (!r.o.scene) return;
    r.o.setScale(1);
    r.o.setText(typeof r.fn === 'function' ? r.fn() : r.fn);
    if (r.fit && r.o.width > r.fit) r.o.setScale(r.fit / r.o.width);
  }
  refreshTexts() {
    this.texts = this.texts.filter((r) => r.o.scene);
    for (const r of this.texts) this.applyText(r);
    if (this.ttlTexts) { this.ttlTexts = this.ttlTexts.filter((r) => r.o.scene); for (const r of this.ttlTexts) this.applyText(r); }
    this.updateTitleTex && this.updateTitleTex();
  }
  setLang(l, fromSave) {
    lang = l; if (!fromSave) { settings.lang = l; this.langPicked = true; saveSettings(); }
    if (!IS_PLUGIN) document.documentElement.lang = LANGS.find((x) => x.id === l).htmlLang;
    if (!IS_PLUGIN) document.title = tr('title');
    this.runFonts && this.runFonts();
    this.refreshTexts();
    if (this.cardsC) this.renderCards();
    this.langRefresh && this.langRefresh.forEach((f) => f());
    this.ttlRefresh && this.ttlRefresh.forEach((f) => f());
  }
  langBtns(parent, y, pw = 720, title = false) {
    const items = LANGS.map((L) => L);
    const bw = 176, gap = 14, total = bw * 3 + gap * 2, x0 = (pw - total) / 2;
    const refresh = [];
    items.forEach((L, i) => {
      const c = this.add.container(x0 + i * (bw + gap) + bw / 2, y);
      const g = this.add.graphics(); c.add(g);
      const draw = () => {
        g.clear(); const on = lang === L.id, fill = on ? BERRY : 0xfff3d9;
        // 布标：缝线 + 挂绳孔
        this.paper(g, -bw / 2, -30, bw, 60, 18, fill, { sh: 5, edge: on ? 0xb02e5f : 0xe6cf9f });
        g.lineStyle(2.5, on ? 0xffd3e2 : 0xd9a86f, 0.9);
        const x1 = -bw / 2 + 8, x2 = bw / 2 - 8, y1 = -30 + 8, y2 = 30 - 11;
        for (let x = x1 + 6; x < x2 - 4; x += 12) { g.lineBetween(x, y1, x + 6, y1); g.lineBetween(x, y2, x + 6, y2); }
        for (let yy = y1 + 6; yy < y2 - 4; yy += 12) { g.lineBetween(x1, yy, x1, yy + 6); g.lineBetween(x2, yy, x2, yy + 6); }
        g.fillStyle(on ? 0xffffff : 0xcdbcf0, 1); g.fillCircle(-bw / 2 + 4, -30 + 4, 0.1);
      };
      const t = this.txt(0, -3, L.name, 27, '#1f2b5e', { fit: bw - 30, title }); c.add(t);
      const upd = () => { draw(); t.setColor(lang === L.id ? '#ffffff' : NAVY_S); };
      upd(); refresh.push(upd);
      const z = this.add.zone(0, 0, bw, 60).setInteractive({ useHandCursor: true }); c.add(z);
      z.on('pointerdown', () => { this.setLang(L.id); this.pop(c); });
      parent.add(c);
    });
    const fns = refresh.map((f) => () => { try { f(); } catch (e) { /* */ } });
    if (title) this.ttlRefresh = (this.ttlRefresh || []).concat(fns); else this.langRefresh = (this.langRefresh || []).concat(fns);
  }
  pop(o) { this.tweens.add({ targets: o, scale: { from: 0.92, to: 1 }, duration: 160, ease: 'Back.Out' }); }

  paper(g, x, y, w, h, r, fill, o = {}) {
    const sh = o.sh ?? 6;
    g.fillStyle(0x3a2a5a, 0.2); g.fillRoundedRect(x + 2, y + sh + 3, w, h, r);
    g.fillStyle(o.edge ?? shade(fill, -0.2), 1); g.fillRoundedRect(x, y + sh * 0.7, w, h - sh * 0.7 + 0.5, r);
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h - sh * 0.7, r);
    g.fillStyle(0xffffff, o.hl ?? 0.28); g.fillRoundedRect(x + 4, y + 3, w - 8, Math.max(8, (h - sh) * 0.4), { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
    if (o.line) { g.lineStyle(2, o.line, 0.8); g.strokeRoundedRect(x, y, w, h - sh * 0.7, r); }
  }
  btn(x, y, w, h, fill, labelFn, cb, o = {}) {
    const c = this.add.container(x, y);
    const g = this.add.graphics(); this.paper(g, -w / 2, -h / 2, w, h, o.r ?? 20, fill, { sh: 5 }); c.add(g);
    const t = this.txt(0, -2, labelFn, o.size || 28, o.color || '#ffffff', { fit: w - 24, title: o.title }); c.add(t);
    const z = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true }); c.add(z);
    z.on('pointerdown', () => { this.tweens.add({ targets: c, scale: { from: 0.93, to: 1 }, duration: 150, ease: 'Back.Out' }); cb(); });
    return c;
  }

  /* ---- 数值 ---- */
  pets() { return this.state.pets; }
  pet() { return this.state.pets[this.state.main]; }
  petSn(p) { return p.sn.reduce((a, b) => a + b, 0); }
  stageReq(p, k) {
    const r = STAGE_REQ[k]; if (!r) return [];
    return [
      { k: 'sn', a: this.petSn(p), b: r.sn },
      { k: 'hi', i: r.hi[0], a: p.sn[r.hi[0]], b: r.hi[1] },
      { k: 'bond', a: this.bondTier(p), b: r.bond },
      { k: 'fed', a: p.fed || 0, b: r.fed },
    ].filter((x) => x.b > 0);
  }
  stageOf(p) {
    let st = p.stg;
    while (st < 3 && this.stageReq(p, st + 1).every((x) => x.a >= x.b)) st++;
    p.stg = st; return st;
  }
  stageFrac(p) { const st = p.stg; if (st >= 3) return 0; const it = this.stageReq(p, st + 1); return it.reduce((a, x) => a + Math.min(1, x.a / x.b), 0) / Math.max(1, it.length); }
  bondTier(p) { let n = 0; BOND_AT.forEach((t) => { if (p.bond >= t) n++; }); return n; }
  sizeFor(p) {
    const st = this.stageOf(p); let fr = 0;
    if (st < 3) fr = clamp(this.stageFrac(p), 0, 1);
    return 1 + 0.2 * st + 0.08 * fr + Math.min(0.22, 0.004 * this.petSn(p)); // 每吃一份零食屁屁永久长大一点
  }
  petRate(p) { return COATS[p.coat].rate * (1 + 0.1 * this.petSn(p)) * STAGE_MUL[this.stageOf(p)] * (1 + 0.15 * this.bondTier(p)); }
  decorPct() { let p = 0; DECOR.forEach((d, i) => { if (this.state.de[i]) p += d.pct; }); return p; }
  wornSets() { const w = this.pet().worn; return SETS.map((s) => s.every((id) => w[WEAR[id].slot] === id && this.state.own[id])); }
  wearPct() {
    let p = 0; this.pet().worn.forEach((id) => { if (id >= 0 && this.state.own[id]) p += WEAR_PCT; });
    this.wornSets().forEach((o) => { if (o) p += SET_PCT; });
    return p;
  }
  gardenPct() { let p = 0; this.pets().forEach((q, i) => { if (i !== this.state.main) p += 5 * this.stageOf(q); }); return p; }
  trophyPct() { return this.state.tro * TROPHY_PCT; }
  mult() { return 1 + (this.decorPct() + this.wearPct() + this.gardenPct() + this.trophyPct()) / 100; }
  frenzyMul() { return this.frenzy > 0 ? 3 : 1; }
  tapBase() { let b = 1; this.pets().forEach((p, pi) => { const k = pi === this.state.main ? 1 : 0.35; SNACKS.forEach((s, i) => { b += s.add * p.sn[i] * msMul(p.sn[i]) * k; }); }); return b; }
  tapVal(raw) { const p = this.pet(); return this.tapBase() * STAGE_MUL[this.stageOf(p)] * (1 + 0.08 * this.bondTier(p)) * this.mult() * satMul(p.sat) * (raw ? 1 : this.frenzyMul()); }
  hps(raw) {
    let r = 0; this.pets().forEach((p, i) => { if (i !== this.state.main) r += this.petRate(p) * satMul(p.sat); });
    r += this.tapBase() * STAGE_MUL[this.stageOf(this.pet())] * 0.15 * satMul(this.pet().sat);
    return r * this.mult() * (raw ? 1 : this.frenzyMul());
  }
  // 在线陪伴产出（只在线：不进离线结算/离线上限/喂饭与任务奖励的计算）；饿了一起降低
  compRate() { const p = this.pet(); return (COMP.rate(this.stageOf(p), this.pets().length) + COMP.share * this.hps(true)) * satMul(p.sat) / satMul(100); }
  onlineRate() { return this.hps() + this.compRate(); }
  snackCost(i) { return Math.ceil(SNACKS[i].base * Math.pow(SNACKS[i].g, this.pet().sn[i])); }
  pgNeed() { return PG_BASE * Math.pow(PG_STEP, this.state.pg); }
  sceneIdx() { return Math.min(3, this.state.pg); }
  hasCoat(c) { return this.pets().findIndex((p) => p.coat === c); }

  /* ---- 构建 ---- */
  buildAll() {
    this.H = this.scale.height;
    const H = this.H;
    this.tweens.killAll();
    const keep = this.ttl; this.children.list.slice().forEach((o) => { if (o !== keep) o.destroy(); });
    this.texts = []; this.langRefresh = [];
    this.hearts = []; this.confetti = []; this.pups = []; this.evs = []; this.decorSp = []; this.sparks = [];
    this.modal = null; this.cards = []; this.popC = null; this.sw = null; this.idle = { cur: null, u: 0, gap: 2, last: -1 }; this.hint = null; this.bubbleC = null;
    this.panelTop = H - 410;
    this.yTop = Math.max(210, H * 0.26); this.yBot = this.panelTop - 10;
    this.tab = this.tab ?? 0; this.slotSel = this.slotSel ?? 0; this.preview = {}; this.scrollX = 0;
    this.frenzy = this.frenzy || 0; this.bar = this.bar || 0; this.lastTap = 0; this.lastTouch = this.t;
    this.evTimer = this.evTimer ?? 22;
    this.size = this.sizeFor(this.pet()); this.sizeTarget = this.size;
    this.shownStage = this.stageOf(this.pet());

    this.buildBg();
    this.buildDecor();
    this.buildMain();
    this.syncPups();
    this.buildHUD();
    this.buildPanel();
    this.applyWear(true);
    this.ensureDay();
    this.updateHUD(true);
  }

  buildBg() {
    const H = this.H, key = 'bg' + this.sceneIdx();
    const bg = this.add.image(W / 2, 0, key).setOrigin(0.5, 0).setDepth(-10000);
    const s = Math.max(720 / bg.width, H / bg.height); bg.setScale(s);
    bg.y = Math.min(0, (H - bg.height * s) / 2 * 0.4);
    this.bgImg = bg;
    for (let k = 1; k * bg.width * s * 0.5 < W / 2 + bg.width * s; k++) for (const d of [-1, 1]) {
      this.add.image(W / 2 + d * k * bg.width * s, bg.y, key).setOrigin(0.5, 0).setScale(s).setFlipX(k % 2 === 1).setDepth(-10000);
    }
    const f = BGFILL || document.getElementById('bgfill');
    if (f) f.style.backgroundImage = `url(${assetUrl(`assets/${SCENE_BG[this.sceneIdx()]}.jpg`)})`;
  }

  gy(v) { return lerp(this.yTop, this.yBot, v); }
  depthScale(v) { return 0.55 + 0.6 * v; }

  buildDecor() {
    DECOR.forEach((d, i) => {
      const x = W / 2 + (d.pos[0] - 0.5) * Math.min(W, 1100), y = this.gy(d.pos[1]), sc = this.depthScale(d.pos[1]);
      const c = this.add.container(x, y).setDepth(y * 0.5);
      const sh = this.add.image(0, -4, 'shadow').setDisplaySize(d.w * sc * 1.1, d.w * sc * 0.35).setAlpha(0.8);
      const im = this.add.image(0, 0, d.ic).setOrigin(0.5, 0.92);
      im.setScale((d.w * sc) / im.width);
      c.add([sh, im]);
      c.setVisible(!!this.state.de[i]);
      c.im = im; c.baseY = y; c.dw = d.w * sc;
      this.decorSp[i] = c;
    });
  }

  buildMain() {
    const ps = this.panelTop;
    this.mcx = W / 2; this.mgy = ps - 40;
    this.k0 = Math.min(1.25, (ps - 40 - this.yTop - 30) / 470);
    this.mshadow = this.add.image(this.mcx, this.mgy + 6, 'shadow').setDepth(this.mgy * 0.5 - 1);
    const R = this.makeRig(this.pet().coat);
    this.R = R; this.rig = R.rig; this.rig.setPosition(this.mcx, this.mgy).setDepth(this.mgy * 0.5);
    this.legLC = R.legLC; this.legRC = R.legRC; this.bodyC = R.bodyC; this.cheekL = R.cheekL; this.cheekR = R.cheekR; this.heartC = R.heartC; this.tailC = R.tailC; this.accC = R.accC; this.headC = R.headC;
    this.spr = { u: new Sp(230, 7.5), l: new Sp(250, 7), r: new Sp(215, 6.6), rot: new Sp(120, 5), tail: new Sp(90, 3.2), pop: new Sp(180, 7), puff: new Sp(150, 5.5), leg: new Sp(420, 9), ear: new Sp(300, 6) };
    this.shake = { l: 0, r: 0 };
    this.wearKey = '';
    this.peek = { a: 0, side: 1, hold: 0 };
    this.face = { front: false, turn: null, timed: false, manual: false, until: 0, nextT: rnd(30, 60) };
    this.ff = { act: null, u: 0, dur: 1, next: 1, blink: 0, blinkT: 2, react: null, last: '' };
    const F = this.makeFront(this.pet().coat, 'fc'); this.F = F; F.rig.setVisible(false);
    this.frig = F.rig; this.frig.setDepth(this.mgy * 0.5);
  }

  mainScale() { return this.k0 * (this.tab === 2 && this.mode === 'play' ? 1.04 : 1); }

  /* ---- 穿戴 ---- */
  visualWear() {
    const w = this.pet().worn.slice();
    if (this.tab === 2) for (const s in this.preview) w[s] = this.preview[s];
    return w;
  }
  applyWear(force) {
    const w = this.visualWear(); const key = w.join(',');
    if (!force && key === this.wearKey) return;
    this.wearKey = key;
    this.applyWearFront(w);
    this.accC.removeAll(true);
    if (this.topSp) { this.topSp.destroy(); this.topSp = null; }
    if (this.tailExtra) { this.tailExtra.destroy(); this.tailExtra = null; }
    if (this.wingSp) { this.wingSp.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); }); this.wingSp = null; }
    const layers = { neck: [], head: [] };
    w.forEach((id) => {
      if (id < 0) return; const it = WEAR[id];
      if (it.ov) {
        const l = LAY.body; const im = this.add.image(l.x - this.bodyC.px, l.y - this.bodyC.py, it.ov).setOrigin(0, 0);
        this.bodyC.add(im); this.topSp = im;
      } else if (it.wing) {
        /* 设计约束:任何服装在背面都不得遮挡两瓣屁股和中间爱心毛斑;天使翅膀只长在屁股上方的背上,画在身体层(臀层之下) */
        this.wingSp = [];
        [[-1, 256 - 34], [1, 256 + 34]].forEach(([d, bx]) => {
          const im = this.add.image(bx - this.bodyC.px, 226 - this.bodyC.py, 'wing').setOrigin(0.08, 0.9);
          im.setScale(0.36 * (d > 0 ? 1 : -1), 0.36); im.setRotation(d * 0.1); this.bodyC.add(im); this.wingSp.push(im);
          this.tweens.add({ targets: im, rotation: d * 0.32, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
      } else if (it.st.l === 'tail') {
        const im = this.add.image(it.st.x - this.tailC.px, it.st.y - this.tailC.py, it.ic); im.setScale(it.st.w / im.width); this.tailC.add(im); this.tailExtra = im;
      } else {
        const im = this.add.image(it.st.x - this.accC.px, it.st.y - this.accC.py, it.icB || it.ic).setRotation(it.st.r); im.setScale(it.st.w / im.width);
        layers[it.st.l].push(im);
      }
    });
    [...layers.neck, ...layers.head].forEach((im) => this.accC.add(im));
    if (!force) this.spr.pop.v += 9;
  }

  /* ---- 小柯基（花园里的其他柯基） ---- */
  syncPups() {
    this.pets().forEach((p, i) => {
      if (i !== this.state.main && !this.pups[i]) this.pups[i] = this.makePup(i);
    });
    this.pups.forEach((q, i) => { if (q && (i === this.state.main || !this.pets()[i])) { this.killPup(q); this.pups[i] = null; } });
  }
  killPup(q) { q.sp.destroy(); q.sh.destroy(); q.zz.destroy(); q.hb.destroy(); q.bw.destroy(); }
  makePup(i) {
    const pet = this.pets()[i], c = COATS[pet.coat];
    const hx = W / 2 + (c.home[0] - 0.5) * Math.min(W, 1100), hy = this.gy(c.home[1]);
    const sh = this.add.image(hx, hy, 'shadow');
    const sp = this.add.image(hx, hy, 'pw' + pet.coat).setOrigin(0.5, 1);
    const zz = this.txt(hx, hy, () => 'Z z', 26, '#1f2b5e', { stroke: '#ffffff', sw: 5 }); zz.setVisible(false);
    const hb = this.add.graphics(), bw = this.add.image(hx, hy, 'sn4').setOrigin(0.5, 1).setVisible(false);
    const p = { i, coat: pet.coat, sh, sp, zz, hb, bw, bowlT: 0, x: hx, y: hy, hx, hy, tx: hx, ty: hy, state: 'idle', t: rnd(0.5, 2), face: 1, sq: new Sp(280, 8), ph: rnd(0, 6), tex: 'pw', hop: null };
    this.placePup(p); return p;
  }
  pupV(p) { return clamp((p.y - this.yTop) / (this.yBot - this.yTop), 0, 1); }
  placePup(p, bob = 0) {
    const v = this.pupV(p), w0 = (120 + 120 * v) * (this.H < 1350 ? 0.8 : 1), tex = p.state === 'sleep' ? 'ps' : 'pw';
    const w = p.hop ? lerp(p.hop.fw, w0, p.hop.e) : w0;
    if (p.tex !== tex) { p.tex = tex; p.sp.setTexture(tex + p.coat); }
    const base = p.sp.width ? w / p.sp.width : 1;
    const q = p.sq.x;
    p.sp.setPosition(p.x, p.y - bob).setScale(base * (1 + 0.18 * q) * p.face, base * (1 - 0.16 * q));
    p.sp.setDepth(p.hop ? 3200 : p.y * 0.5);
    p.sh.setPosition(p.x, p.y - 2).setDisplaySize(w * 1.1, w * 0.3).setDepth(p.y * 0.5 - 1);
    p.zz.setPosition(p.x + 30 * p.face, p.y - p.sp.displayHeight - 8 - bob).setDepth(p.y * 0.5 + 1);
    p.w = w;
    // 饱饱度小条（饿了才显示，好饿时带一个空碗图标）
    const pet = this.pets()[p.i], g = p.hb; g.clear();
    if (pet && !p.hop && this.mode === 'play') {
      const tier = satTier(pet.sat), bw = Math.max(56, w * 0.5), bx = p.x - bw / 2, by = p.y - p.sp.displayHeight - 22 - bob;
      if (tier > 0 || p.bowlT > 0) {
        g.fillStyle(0xffffff, 0.92); g.fillRoundedRect(bx - 4, by - 4, bw + 8, 16, 8);
        g.fillStyle(0xf2e3c2, 1); g.fillRoundedRect(bx, by, bw, 8, 4);
        g.fillStyle([0x7cc47a, 0xf3b94e, 0xe0457b][tier], 1); g.fillRoundedRect(bx, by, Math.max(8, bw * pet.sat / 100), 8, 4);
        g.setDepth(p.y * 0.5 + 2);
      }
    }
    if (p.bowlT > 0) { p.bw.setVisible(true).setTexture(p.bowlT < 1 ? 'sn4e' : 'sn4').setPosition(p.x + w * 0.42 * p.face, p.y + 4).setDisplaySize(w * 0.42, w * 0.33).setDepth(p.y * 0.5 + 1); } else p.bw.setVisible(false);
  }
  updatePups(dt) {
    for (const p of this.pups) {
      if (!p) continue;
      p.sq.step(dt); p.t -= dt; let bob = 0;
      if (p.bowlT > 0) { p.bowlT -= dt; p.state = 'idle'; p.t = Math.max(p.t, 0.4); p.ph += dt * 12; p.sq.v += Math.sin(p.ph) * dt * 30; }
      const pet = this.pets()[p.i], hungry = pet && satTier(pet.sat) === 2;
      if (p.hop) {
        const h = p.hop; h.t += dt; const k = Math.min(1, h.t / 0.95); h.e = k * k * (3 - 2 * k);
        p.x = lerp(h.fx, p.hx, h.e); p.y = lerp(h.fy, p.hy, h.e); bob = Math.sin(Math.PI * k) * 170 + Math.abs(Math.sin(k * 12)) * 14;
        p.face = p.hx > h.fx ? 1 : -1;
        if (k >= 1) { p.hop = null; p.sq.v = 12; p.state = 'idle'; p.t = 1.5; this.burstHearts(p.x, p.y - p.w * 0.6, 3); }
        this.placePup(p, bob); continue;
      }
      if (p.state === 'walk') {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        const sp = 46 * this.depthScale(this.pupV(p)) * (hungry ? 0.55 : 1);
        if (d < 4 || p.t <= 0) { p.state = Math.random() < 0.45 ? 'sleep' : 'idle'; p.t = p.state === 'sleep' ? rnd(6, 11) : rnd(1.5, 3.5); }
        else { p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; if (Math.abs(dx) > 2) p.face = dx > 0 ? 1 : -1; p.ph += dt * 11; bob = Math.abs(Math.sin(p.ph)) * 7; }
      } else {
        p.ph += dt * 2;
        if (p.t <= 0) { p.state = 'walk'; p.tx = clamp(p.hx + rnd(-60, 60), W / 2 - 560, W / 2 + 560); p.ty = clamp(p.hy + rnd(-30, 40), this.yTop + 10, this.yBot - 20); p.t = 6; }
      }
      p.zz.setVisible(p.state === 'sleep');
      if (p.state === 'sleep') { p.zz.setAlpha(0.6 + 0.4 * Math.sin(this.t * 3)); }
      p.hbt = (p.hbt || rnd(2, 5)) - dt;
      if (p.hbt <= 0) { p.hbt = rnd(3, 6) * (hungry ? 2 : 1); this.spawnHeart(p.x, p.y - p.w * 0.5, 0.45, 0.6); }
      this.placePup(p, bob + (p.state === 'idle' ? Math.sin(p.ph) * 1.5 : 0));
    }
  }

  /* ---- 换柯基上场 ---- */
  switchTo(i) {
    const s = this.state;
    if (this.sw || i === s.main || !this.pets()[i]) return;
    this.closePetPop();
    const old = s.main, sc = this.mainScale(), q = this.pups[i];
    const from = q ? { x: q.x, y: q.y, w: q.w } : { x: this.mcx, y: this.mgy - 120, w: 150 };
    if (q) { this.killPup(q); this.pups[i] = null; }
    s.main = i;
    const np = this.makePup(old); np.hop = { t: 0, fx: this.mcx, fy: this.mgy, fw: 400 * sc, e: 0 }; this.pups[old] = np;
    this.setRigCoat(this.R, this.pet().coat); this.wearKey = ''; this.applyWear(true);
    this.size = this.sizeTarget = this.sizeFor(this.pet()); this.shownStage = this.stageOf(this.pet());
    this.sw = { t: 0, fx: from.x, fy: from.y, fs: Math.max(0.2, from.w / (400 * sc)) };
    this.idleCancel(); this.lastTouch = this.t; this.peek.a = 0;
    this.addProg(4);
    sfx('buy', { pitchSemitones: 4 }); this.later(450, () => sfx('duang', { pitchSemitones: 3 }));
    this.renderCards(); this.updateHUD(true); this.markDirty(true);
  }
  cycleMain(dir) {
    const n = this.pets().length; if (n < 2) return;
    this.switchTo((this.state.main + dir + n) % n);
  }
  openPetPop(q) {
    this.closePetPop();
    const pet = this.pets()[q.i], w = 340, h = 232;
    const x = clamp(q.x, w / 2 + 10, W - w / 2 - 10), y = clamp(q.y - q.w - h - 10, 160, this.panelTop - h - 10);
    const c = this.add.container((W - 720) / 2 * 0 + x - w / 2, y).setDepth(3600); this.popC = c;
    const g = this.add.graphics(); this.paper(g, 0, 0, w, h, 28, CREAM, { sh: 8, line: 0xd9c9a3 }); c.add(g);
    c.add(this.txt(w / 2, 32, () => `${tr('n_p' + pet.nm)} · ${tr('coat' + pet.coat)}`, 26, NAVY_S, { fit: w - 30 }));
    c.add(this.txt(w / 2, 70, () => `${tr('stg' + this.stageOf(pet))} · ${tr('bondLv', { n: this.bondTier(pet) })}`, 22, '#7a6f9b', { fit: w - 30 }));
    const bg = this.add.graphics(); c.add(bg); this.drawBond(bg, 30, 92, w - 60, pet);
    c.add(this.btn(w / 2, 168, w - 60, 64, SAGE, () => tr('goStage'), () => this.switchTo(q.i), { size: 28 }));
    c.setScale(0.8).setAlpha(0); this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
  }
  closePetPop() { if (this.popC) { this.popC.destroy(true); this.popC = null; } }
  drawBond(g, x, y, w, pet) {
    const t = this.bondTier(pet), a = t ? BOND_AT[t - 1] : 0, b = BOND_AT[Math.min(3, t)];
    const v = t >= 4 ? 1 : (pet.bond - a) / (b - a);
    g.fillStyle(0x3a2a5a, 0.2); g.fillRoundedRect(x + 1, y + 3, w, 16, 8);
    g.fillStyle(0xf2e3c2, 1); g.fillRoundedRect(x, y, w, 16, 8);
    if (v > 0.01) { g.fillStyle(BERRY, 1); g.fillRoundedRect(x + 2, y + 2, Math.max(12, (w - 4) * v), 12, 6); g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(x + 5, y + 3, Math.max(8, (w - 10) * v), 4, 2); }
  }

  /* ---- HUD ---- */
  buildHUD() {
    const hud = this.add.container((W - 720) / 2, 0).setDepth(3000); this.hudC = hud;
    const g = this.add.graphics(); hud.add(g);
    this.paper(g, 150, 14, 420, 92, 26, CREAM, { sh: 7 });
    this.paper(g, 235, 98, 250, 44, 18, 0xf2e3c2, { sh: 5 });
    g.fillStyle(0xcdbcf0, 1);
    [[150, 60], [570, 60]].forEach(([x, y]) => g.fillCircle(x, y, 11));
    this.heartIcon = this.add.image(212, 62, 'mi0').setDisplaySize(64, 56); hud.add(this.heartIcon);
    this.heartTxt = this.txt(262, 58, '0', 50, NAVY_S, { ox: 0, fit: 290 }); hud.add(this.heartTxt);
    this.rateTxt = this.txt(360, 120, () => '+0 ' + tr('perSec'), 26, '#e0457b', { fit: 230 }); hud.add(this.rateTxt);
    this.compIc = this.add.image(262, 120, 'mi0').setDisplaySize(26, 23); hud.add(this.compIc); // 在线陪伴小心心（轻轻跳动）
    this.tweens.add({ targets: this.compIc, scale: this.compIc.scale * 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const rz = this.add.zone(360, 120, 250, 56).setInteractive({ useHandCursor: true }); hud.add(rz);
    rz.on('pointerdown', () => { sfx('buy', { pitchSemitones: 10 }); this.toast(tr('compInfo', { c: fmt(this.compRate(), true), a: fmt(this.hps(), true) })); });
    // 当前上场柯基名牌
    const chip = this.add.container(10, 14); hud.add(chip); this.chip = chip;
    const cg = this.add.graphics(); this.paper(cg, 0, 0, 132, 112, 22, CREAM, { sh: 6 }); chip.add(cg);
    this.chipName = this.txt(66, 22, () => tr('n_p' + this.pet().nm), 24, NAVY_S, { fit: 116 }); chip.add(this.chipName);
    this.chipStg = this.txt(66, 50, () => tr('stg' + this.stageOf(this.pet())), 20, '#e0457b', { fit: 116 }); chip.add(this.chipStg);
    this.chipBond = this.txt(66, 74, () => tr('bondLv', { n: this.bondTier(this.pet()) }), 18, '#7a6f9b', { fit: 116 }); chip.add(this.chipBond);
    this.chipBar = this.add.graphics(); chip.add(this.chipBar);
    const cz = this.add.zone(66, 56, 136, 116).setInteractive({ useHandCursor: true }); chip.add(cz);
    cz.on('pointerdown', () => { this.pop(chip); this.setTab(1); });
    // 设置
    const gb = this.add.container(W - 74 - (W - 720) / 2, 62); const g2 = this.add.graphics(); this.paper(g2, -38, -38, 76, 76, 38, CREAM, { sh: 6 }); gb.add(g2);
    gb.add(this.add.image(0, -2, 'mi3').setDisplaySize(44, 44));
    const z = this.add.zone(0, 0, 80, 80).setInteractive({ useHandCursor: true }); gb.add(z);
    z.on('pointerdown', () => { this.pop(gb); this.showSettings(); });
    hud.add(gb);
    // 衣柜按钮
    const cb = this.add.container(70, this.panelTop - 76); const g3 = this.add.graphics(); this.paper(g3, -40, -40, 80, 80, 40, 0xf7d6e4, { sh: 6 }); cb.add(g3);
    cb.add(this.add.image(0, -4, 'cs0').setDisplaySize(52, 48));
    cb.add(this.txt(0, 50, () => tr('closet'), 20, NAVY_S, { fit: 110, stroke: '#fff7e6', sw: 5 }));
    const z2 = this.add.zone(0, 8, 90, 110).setInteractive({ useHandCursor: true }); cb.add(z2);
    z2.on('pointerdown', () => { this.pop(cb); this.setTab(2); });
    hud.add(cb); this.closetBtn = cb;
    this.buildSatHud(hud);
    // 转身按钮（正面/背面）
    const tb = this.add.container(W < 800 ? 720 - 70 : 720 - 70, this.panelTop - 76); const g4 = this.add.graphics(); this.paper(g4, -40, -40, 80, 80, 40, 0xcfe6ff, { sh: 6 }); tb.add(g4);
    tb.add(this.add.image(0, -4, 'mi2').setDisplaySize(56, 50));
    tb.add(this.txt(0, 50, () => tr('turn'), 20, NAVY_S, { fit: 110, stroke: '#fff7e6', sw: 5 }));
    const z3 = this.add.zone(0, 8, 90, 110).setInteractive({ useHandCursor: true }); tb.add(z3);
    z3.on('pointerdown', () => { this.pop(tb); this.manualTurn(); });
    hud.add(tb); this.turnBtn = tb;
    // 连击条
    this.barG = this.add.graphics(); hud.add(this.barG);
    this.barTxt = this.txt(360, 176, () => tr('combo'), 22, NAVY_S, { fit: 300, stroke: '#fff7e6', sw: 5 }); hud.add(this.barTxt);
    this.setTxt = this.txt(360, 236, () => this.infoLine(), 24, NAVY_S, { fit: 660, stroke: '#fff7e6', sw: 6 }); hud.add(this.setTxt);
    this.setTxt.setVisible(false);
    this.toastT = this.txt(360, 320, '', 40, '#ffffff', { fit: 660, stroke: '#e0457b', sw: 9 }); this.toastT.setDepth(4000).setAlpha(0); hud.add(this.toastT);
    this.chipKey = '';
  }
  infoLine() {
    if (this.tab === 0) {
      const p = this.pet(), st = this.stageOf(p);
      if (st >= 3) return tr('maxStage');
      const lack = this.stageReq(p, st + 1).filter((x) => x.a < x.b).map((x) => tr('rq_' + x.k, { a: x.a, b: x.b, n: x.k === 'hi' ? tr('n_s' + x.i) : '' }));
      return tr('nextStage2', { s: tr('stg' + (st + 1)), r: lack.join(' · ') });
    }
    if (this.tab === 1) return `${tr('collected', { a: this.pets().length, b: COATS.length })} · ${tr('swipeHint')}`;
    if (this.tab === 3) return tr('pgNote');
    if (this.tab === 4) return '';
    const worn = this.pet().worn; let best = 0, bp = -1;
    SETS.forEach((s, i) => { const n = s.filter((id) => worn[WEAR[id].slot] === id && this.state.own[id]).length; if (n > bp) { bp = n; best = i; } });
    const n = bp, done = n === SETS[best].length;
    return `${tr('setLabel')}·${tr('set' + best)} ${n}/${SETS[best].length}  ${done ? tr('setDone') + ' +' + SET_PCT + '%' : tr('setBonus', { p: SET_PCT })}`;
  }
  toast(msg) {
    this.toastT.setText(msg); this.toastT.setScale(1); if (this.toastT.width > 660) this.toastT.setScale(660 / this.toastT.width);
    const sc = this.toastT.scale;
    this.tweens.killTweensOf(this.toastT);
    this.toastT.setAlpha(1).y = 320;
    this.tweens.add({ targets: this.toastT, y: 270, alpha: { from: 1, to: 0 }, duration: 1900, ease: 'Sine.In', delay: 500 });
    this.tweens.add({ targets: this.toastT, scale: { from: sc * 0.6, to: sc }, duration: 260, ease: 'Back.Out' });
  }
  updateHUD(force) {
    const s = this.state;
    const h = fmt(Math.floor(Math.max(0, s.hearts - (this.pendShow || 0))));
    if (force || this.lastH !== h) { this.lastH = h; this.heartTxt.setText(h); this.heartTxt.setScale(1); if (this.heartTxt.width > 290) this.heartTxt.setScale(290 / this.heartTxt.width); }
    const r = '+' + fmt(this.onlineRate(), true) + ' ' + tr('perSec');
    if (force || this.lastR !== r) { this.lastR = r; this.rateTxt.setText(r); this.rateTxt.setScale(1); if (this.rateTxt.width > 230) this.rateTxt.setScale(230 / this.rateTxt.width); }
    const p = this.pet(), key = `${p.nm}|${this.stageOf(p)}|${this.bondTier(p)}|${Math.floor(p.bond)}|${this.tab}|${s.pets.length}|${lang}`;
    if (force || key !== this.chipKey) {
      this.chipKey = key;
      [this.chipName, this.chipStg, this.chipBond, this.setTxt].forEach((t) => { const r2 = this.texts.find((x) => x.o === t); if (r2) this.applyText(r2); });
      this.chipBar.clear(); this.drawBond(this.chipBar, 14, 92, 104, p);
    }
    this.setTxt.setVisible(this.mode === 'play');
  }
  drawBar() {
    const g = this.barG; g.clear();
    const w = 380, x = (720 - w) / 2, y = 150, fr = this.frenzy > 0;
    const v = fr ? this.frenzy / 10 : this.bar / 100;
    g.fillStyle(0x3a2a5a, 0.2); g.fillRoundedRect(x + 2, y + 4, w, 22, 11);
    g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(x, y, w, 22, 11);
    if (v > 0.01) { g.fillStyle(fr ? 0xf6b72a : BERRY, 1); g.fillRoundedRect(x + 3, y + 3, Math.max(16, (w - 6) * v), 16, 8); g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(x + 6, y + 5, Math.max(10, (w - 12) * v), 5, 3); }
    const lab = fr ? tr('frenzyLeft') : tr('combo');
    if (this.barLab !== lab) { this.barLab = lab; this.barTxt.setText(lab); this.barTxt.setScale(1); if (this.barTxt.width > 360) this.barTxt.setScale(360 / this.barTxt.width); }
    this.barTxt.y = 190;
    this.barTxt.setColor(fr ? '#c2452a' : NAVY_S);
  }

  /* ---- 面板 ---- */
  buildPanel() {
    const H = this.H, y0 = this.panelTop;
    const root = this.add.container(0, 0).setDepth(2500); this.panelRoot = root;
    const g = this.add.graphics(); root.add(g);
    g.fillStyle(0x3a2a5a, 0.18); g.fillRoundedRect(-10, y0 - 6, W + 20, H - y0 + 20, 34);
    g.fillStyle(0xe4ead0, 1); g.fillRoundedRect(-10, y0 - 12, W + 20, H - y0 + 30, 34);
    g.fillStyle(0xf4f1dd, 1); g.fillRoundedRect(-10, y0 - 12, W + 20, 18, 12);
    this.chipsC = this.add.container(0, 0); root.add(this.chipsC);
    this.cardsC = this.add.container(0, 0); root.add(this.cardsC);
    const tabs = [['tab0', 'sn0'], ['tab1', 'mi2'], ['tab2', 'cs0'], ['tab3', 'mi8'], ['tab4', 'mi7']];
    this.tabG = this.add.graphics(); root.add(this.tabG);
    this.tabItems = [];
    const tw = 136, gap = 6, x0 = (W - (tw * 5 + gap * 4)) / 2, ty = H - 100;
    tabs.forEach((t, i) => {
      const cx = x0 + i * (tw + gap) + tw / 2;
      const icon = this.add.image(cx, ty + 30, t[1]); const sc = 44 / Math.max(icon.width, icon.height); icon.setScale(sc);
      const lab = this.txt(cx, ty + 68, () => tr(t[0]), 22, NAVY_S, { fit: tw - 14 });
      root.add([icon, lab]);
      this.tabItems.push({ icon, lab, cx, base: sc });
    });
    this.tabDot = this.add.circle(0, 0, 9, 0xe0457b).setStrokeStyle(3, 0xffffff); root.add(this.tabDot); this.tabDot.setVisible(false);
    this.tabGeom = { x0, tw, gap, ty };
    this.drawTabs();
    this.panelZone = this.add.zone(W / 2, (y0 + H - 100) / 2 - 6, W, H - 100 - y0).setInteractive(); root.add(this.panelZone);
    root.sendToBack(this.panelZone); root.sendToBack(g);
    this.panelZone.on('pointerdown', (p) => { this.pd = { x: p.x, y: p.y, sx: this.scrollX, drag: false }; if (this.mode === 'play' && !this.modal) this.pressCard(this.cardAt(p)); });
    tabs.forEach((t, i) => {
      const z = this.add.zone(x0 + i * (tw + gap) + tw / 2, ty + 44, tw, 90).setInteractive({ useHandCursor: true }); root.add(z);
      z.on('pointerdown', () => { this.setTab(i); const ti = this.tabItems[i]; if (ti) this.tweens.add({ targets: ti.icon, scale: { from: ti.icon.scale * 1.3, to: ti.icon.scale }, angle: { from: -12, to: 0 }, duration: 320, ease: 'Back.Out' }); });
    });
    this.renderCards();
  }
  drawTabs() {
    const { x0, tw, gap, ty } = this.tabGeom, g = this.tabG; g.clear();
    for (let i = 0; i < 5; i++) {
      const on = this.tab === i;
      this.paper(g, x0 + i * (tw + gap), ty + (on ? -4 : 0), tw, 88, 22, on ? 0xf6b1c8 : CREAM, { sh: on ? 8 : 5 });
    }
    this.tabItems.forEach((t, i) => { t.icon.y = ty + (this.tab === i ? 24 : 30); t.lab.y = ty + (this.tab === i ? 62 : 68); t.icon.setScale(t.base * (this.tab === i ? 1.12 : 1)); });
  }
  setTab(i) {
    if (this.tab === i && i !== 2) return;
    const was = this.tab;
    this.tab = i; if (was === 2 && i !== 2) { this.preview = {}; }
    this.scrollX = 0; this.drawTabs(); this.renderCards();
    this.applyWear(); this.updateHUD(true);
    this.tweens.add({ targets: this.cardsC, alpha: { from: 0.2, to: 1 }, duration: 200 });
    sfx('buy', { pitchSemitones: 6 });
    this.wardrobeFace(i === 2);
  }

  /* ---- 卡片数据 ---- */
  taskTarget(id) { return [200, 3, 1, 1, 1][id]; }
  taskReward() { return Math.max(500, this.hps(true) * 240 + this.tapVal(true) * 150); }
  ckReward(day) { return Math.max(800, this.hps(true) * 500 + this.tapVal(true) * 300) * (1 + 0.3 * (day - 1)); }
  ckInfo() {
    const ck = this.state.ck, today = localDay(), y = localDay(new Date(Date.now() - 864e5));
    const can = ck.last !== today, streak = can ? (ck.last === y ? ck.streak + 1 : 1) : ck.streak;
    return { can, day: ((Math.max(1, streak) - 1) % 7) + 1, streak };
  }
  items() {
    const s = this.state, out = [], m = this.pet();
    if (this.tab === 0) {
      SNACKS.forEach((d, i) => out.push({ kind: 'sn', i, ic: d.ic, name: () => tr('n_s' + i), sub: (() => { const nx = SNACK_MS.find((q) => q > m.sn[i]); return nx ? () => tr('msNext', { n: nx, m: SNACK_MSM[SNACK_MS.indexOf(nx)] }) : null; })(), l1: () => `${tr('lv')} ${m.sn[i]}`, l2: () => tr('tap', { r: fmt(d.add * msMul(m.sn[i] + 1) * this.mult(), true) }), price: this.snackCost(i) }));
    } else if (this.tab === 1) {
      COATS.forEach((c, i) => {
        const pi = this.hasCoat(i);
        if (pi >= 0) {
          const p = s.pets[pi], isMain = pi === s.main, t = this.bondTier(p), a = t ? BOND_AT[t - 1] : 0, b = BOND_AT[Math.min(3, t)];
          out.push({ kind: 'pet', i: pi, ic: 'pw' + i, iconMax: 138, name: () => tr('n_p' + p.nm), sub: () => tr('coat' + i), l1: () => tr('stg' + this.stageOf(p)), l2: () => tr('bondLv', { n: this.bondTier(p) }), bar: t >= 4 ? 1 : (p.bond - a) / (b - a), pill: { label: () => (isMain ? tr('onStage') : tr('goStage')), col: isMain ? 0x6f9bd1 : SAGE, dis: isMain } });
        } else if (c.kind === 'common') {
          out.push({ kind: 'adopt', i, ic: 'pw' + i, iconMax: 138, name: () => tr('coat' + i), l1: () => tr('rate', { r: fmt(c.rate * this.mult(), true) }), price: c.adopt });
        } else {
          out.push({ kind: 'lock', i, ic: 'pw' + i, iconMax: 138, dark: true, name: () => tr('unknown'), l1: () => tr(c.hint), l2: () => tr('hintEv'), wrap: true, pill: { label: () => tr('unknown'), col: 0xa59fb5, dis: true } });
        }
      });
    } else if (this.tab === 2) {
      WEAR.forEach((d, i) => {
        if (d.gone || d.slot !== this.slotSel) return;
        const own = !!s.own[i], worn = this.visualWear()[d.slot] === i, realWorn = m.worn[d.slot] === i, bo = BOND_ONLY.has(i), co = CARE_ONLY.has(i);
        out.push({ kind: 'we', i, ic: d.ic, name: () => tr('n_w' + i), l2: () => tr('bonusWear'), price: d.cost, own, worn, realWorn, bo, co });
      });
    } else if (this.tab === 3) {
      const need = this.pgNeed(), ok = s.run >= need;
      out.push({ kind: 'pg', ic: 'mi8', name: () => tr('pgTitle'), l1: () => tr('pgTro', { t: s.tro, p: this.trophyPct() }), l2: () => tr('pgNeed', { n: `${fmt(s.run)}/${fmt(need)}` }), wrap: true, bar: clamp(s.run / need, 0, 1), pill: { label: () => tr('pgGo'), col: ok ? BERRY : 0xa59fb5, dis: !ok } });
      DECOR.forEach((d, i) => out.push({ kind: 'de', i, ic: d.ic, name: () => tr('n_d' + i), l2: () => tr('bonusGlobal', { p: d.pct }), price: d.cost, own: !!s.de[i] }));
    } else {
      this.ensureDay();
      const tk = s.tk;
      tk.ids.forEach((id, k) => {
        const tg = this.taskTarget(id), pr = Math.min(tg, tk.p[id]), done = pr >= tg, got = !!tk.got[k];
        out.push({ kind: 'tk', k, ic: ['mi0', 'sn0', 'cs0', 'sn7', 'mi2'][id], name: () => tr('tk' + id, { n: tg }), nameWrap: true, l1: () => `${pr}/${tg}`, l2: () => '+' + fmt(this.taskReward()), bar: pr / tg, pill: { label: () => (got ? tr('claimed') : done ? tr('claim') : tr('reward')), col: got ? SAGE : done ? BERRY : 0xa59fb5, dis: got || !done } });
      });
      const ci = this.ckInfo();
      const cs = this.careInfo();
      out.unshift({ kind: 'cr', ic: 'sn4', name: () => tr('careTitle'), l1: () => tr('careDays', { n: cs.streak }), l2: () => (cs.next ? tr('careNext', { d: cs.next.d, r: cs.next.r() }) : tr('careAll')), wrap: true, bar: cs.next ? clamp(cs.streak / cs.next.d, 0, 1) : 1, pill: { label: () => (cs.today ? tr('careToday') : tr('goFeed')), col: cs.today ? SAGE : 0xf39a3c, dis: cs.today } });
      out.push({ kind: 'ck', ic: 'mi5', name: () => tr('ckTitle'), l1: () => tr('ckDay', { d: ci.day }), l2: () => (ci.day === 7 ? tr('ckRare') : '+' + fmt(this.ckReward(ci.day))), wrap: true, pill: { label: () => (ci.can ? tr('ckClaim') : tr('ckDone')), col: ci.can ? BERRY : SAGE, dis: !ci.can } });
    }
    return out;
  }

  renderCards() {
    this.cardsC.removeAll(true); this.chipsC.removeAll(true); this.cards = [];
    const y0 = this.panelTop;
    const wardrobe = this.tab === 2;
    const cardH = wardrobe ? 246 : 296, cy = y0 + (wardrobe ? 64 : 4);
    this.cardW = 214; this.cardGap = 12; this.cardPad = 16; this.cardY = cy; this.cardH = cardH;
    if (wardrobe) {
      const cw = 200, gap = 12, x0 = (W - (cw * 3 + gap * 2)) / 2;
      WEAR_SLOTS.forEach((i, n) => {
        const on = this.slotSel === i, c = this.add.container(x0 + n * (cw + gap) + cw / 2, y0 + 30);
        const g = this.add.graphics(); this.paper(g, -cw / 2, -22, cw, 44, 16, on ? BERRY : CREAM, { sh: 4 }); c.add(g);
        const t = this.txt(0, -3, () => tr('slot' + i), 22, on ? '#ffffff' : NAVY_S, { fit: cw - 16 }); c.add(t);
        const z = this.add.zone(0, 0, cw, 48).setInteractive({ useHandCursor: true }); c.add(z);
        z.on('pointerdown', () => { this.slotSel = i; this.scrollX = 0; this.renderCards(); sfx('buy', { pitchSemitones: 8 }); });
        this.chipsC.add(c);
      });
    }
    const its = this.items();
    { const tot = its.length * (this.cardW + this.cardGap) - this.cardGap; this.cardPad = tot + 32 < W ? (W - tot) / 2 : 16; }
    its.forEach((it, n) => {
      const x = this.cardPad + n * (this.cardW + this.cardGap), cw = this.cardW;
      const c0 = this.add.container(x + cw / 2, cy + cardH / 2), c = this.add.container(-cw / 2, -cardH / 2); c0.add(c);
      const g = this.add.graphics();
      const msn = it.kind === 'sn' ? msTier(this.pet().sn[it.i]) : 0;
      this.paper(g, 0, 0, cw, cardH, 20, it.kind === 'pg' ? 0xfbe3ec : msn ? 0xfff4d2 : CREAM, { sh: 8, line: msn ? 0xe8a91c : 0xd9c9a3 });
      if (msn) { g.lineStyle(4 + msn, 0xf2b52c, 1); g.strokeRoundedRect(2, 2, cw - 4, cardH - 10, 19); }
      c.add(g);
      const iconMax = it.iconMax ? 100 : (wardrobe ? 96 : 112);
      const icon = this.add.image(cw / 2, wardrobe ? 86 : (it.sub ? 114 : 108), it.ic); icon.setScale(iconMax / Math.max(icon.width, icon.height)); c.add(icon);
      if (msn) { // 金色徽章：★ + 当前倍率
        const bd = this.add.container(cw - 30, 30); const bg2 = this.add.graphics(); bg2.fillStyle(0xc77f00, 1); bg2.fillCircle(0, 3, 26); bg2.fillStyle(0xffc93c, 1); bg2.fillCircle(0, 0, 26); bg2.lineStyle(3, 0xffffff, 0.9); bg2.strokeCircle(0, 0, 22);
        bd.add(bg2); bd.add(this.txt(0, -8, '★', 22, '#ffffff', {})); bd.add(this.txt(0, 12, '×' + SNACK_MSM[msn - 1], 15, '#7a3d00', { fit: 44 })); c.add(bd);
      }
      if (it.dark) icon.setTintFill(0x5b4a82).setAlpha(0.75);
      c.add(this.txt(cw / 2, it.sub ? 24 : 26, it.name, it.sub ? 24 : 25, NAVY_S, { fit: cw - 22 }));
      if (it.sub) c.add(this.txt(cw / 2, 50, it.sub, 18, '#9a8fbb', { fit: cw - 22 }));
      let l1T = null, l2T = null, prT = null;
      if (it.l1) { l1T = this.txt(cw / 2, it.wrap ? 172 : 178, it.l1, it.wrap ? 19 : 22, '#7a6f9b', { fit: cw - 18 }); c.add(l1T); }
      if (it.l2) { l2T = this.txt(cw / 2, wardrobe ? 150 : (it.l1 ? (it.wrap ? 196 : 204) : 190), it.l2, it.wrap ? 19 : 21, '#2f7a52', { fit: cw - 16 }); c.add(l2T); }
      if (it.bar != null) { const bg = this.add.graphics(); this.drawBond(bg, 24, cardH - 76, cw - 48, { bond: 0 }); bg.clear(); this.barDraw(bg, 24, cardH - 74, cw - 48, it.bar); c.add(bg); }
      if (it.kind === 'we' && it.worn && !it.realWorn) {
        const gg = this.add.graphics(); this.paper(gg, 30, 40, cw - 60, 26, 13, LAV, { sh: 2 }); c.add(gg); c.add(this.txt(cw / 2, 52, () => tr('tryon'), 20, '#ffffff', { fit: cw - 40 }));
      }
      // 胶囊
      let spec = it.pill, price = it.price;
      if (!spec) {
        if (it.kind === 'we') {
          if (it.own) spec = { label: () => (it.worn ? tr('tapTake') : tr('tapWear')), col: it.worn ? 0x6f9bd1 : SAGE };
          else if (it.bo) { spec = { label: () => tr('bondLock'), col: 0xa59fb5, dis: true }; price = null; }
          else if (it.co) { const d = CARE_MS[CARE_REW.findIndex((r) => r.w === it.i)]; spec = { label: () => tr('careLock', { d }), col: 0xa59fb5, dis: true }; price = null; }
        } else if (it.kind === 'de' && it.own) spec = { label: () => tr('owned'), col: SAGE };
      }
      if (spec) price = null;
      const py = cardH - 42;
      const pill = this.add.graphics(); c.add(pill);
      const card = { c: c0, inner: c, it, pill, py, cw, ch: cardH, price, spec, icon, n };
      if (price != null) {
        c.add(this.add.image(26, py + 17, 'mi0').setDisplaySize(26, 23));
        prT = this.txt(cw / 2 + 10, py + 15, () => fmt(price), 26, '#ffffff', { fit: cw - 80 }); c.add(prT);
        const gl = this.add.graphics(); gl.fillStyle(0xffffff, 1); gl.fillRoundedRect(26, py - 2, cw - 52, 9, 4.5); gl.setAlpha(0); c.add(gl); card.glow = gl;
      } else c.add(this.txt(cw / 2, py + 15, spec.label, 22, '#ffffff', { fit: cw - 28 }));
      card.l1T = l1T; card.l2T = l2T; card.prT = prT;
      this.cardsC.add(c0); this.cards.push(card); this.drawPill(card);
    });
    this.maxScroll = Math.min(0, W - (this.cardPad * 2 + its.length * (this.cardW + this.cardGap) - this.cardGap));
    this.scrollX = clamp(this.scrollX, this.maxScroll, 0);
    this.cardsC.x = this.scrollX;
    this.updateAfford();
  }
  barDraw(g, x, y, w, v) {
    g.fillStyle(0x3a2a5a, 0.2); g.fillRoundedRect(x + 1, y + 3, w, 14, 7);
    g.fillStyle(0xf2e3c2, 1); g.fillRoundedRect(x, y, w, 14, 7);
    if (v > 0.01) { g.fillStyle(BERRY, 1); g.fillRoundedRect(x + 2, y + 2, Math.max(10, (w - 4) * v), 10, 5); }
  }
  drawPill(card) {
    const { pill, py, cw, price, spec } = card; pill.clear();
    let col = BERRY;
    if (price != null) { card.afford = this.state.hearts >= price; col = card.afford ? BERRY : 0xa59fb5; }
    else { col = spec.col; card.afford = true; }
    if (card.redT && this.t < card.redT) col = 0xe0455b;
    this.paper(pill, 14, py - 6, cw - 28, 44, 20, col, { sh: 4 });
  }
  updateAfford() {
    for (const card of this.cards) {
      if (card.price != null) { const was = card.afford; this.drawPill(card); card.c.setAlpha(card.afford ? 1 : 0.7); }
      else card.c.setAlpha(card.spec && card.spec.dis && card.it.kind === 'lock' ? 0.85 : 1);
    }
  }
  scrollTo(x) { this.scrollX = clamp(x, this.maxScroll || 0, 0); this.cardsC.x = this.scrollX; }

  cardAt(p) {
    const lx = p.x - this.scrollX - this.cardPad;
    const n = Math.floor(lx / (this.cardW + this.cardGap));
    const inX = lx - n * (this.cardW + this.cardGap) <= this.cardW;
    if (n < 0 || n >= this.cards.length || !inX) return null;
    if (p.y < this.cardY || p.y > this.cardY + this.cardH) return null;
    return this.cards[n];
  }
  tapCard(card, p) {
    const it = card.it, s = this.state;
    const inPill = p.y > this.cardY + card.py - 10;
    if (it.kind === 'sn') return this.buySnack(it.i, card);
    if (it.kind === 'adopt') return this.adoptCoat(it.i, card);
    if (it.kind === 'de') return this.buyDecor(it.i, card);
    if (it.kind === 'pet') { if (it.i !== s.main) this.switchTo(it.i); else { this.shakeCard(card, 4); sfx('duang', { pitchSemitones: 9 }); } return; }
    if (it.kind === 'pg') return this.askPageant(card);
    if (it.kind === 'tk') return this.claimTask(it.k);
    if (it.kind === 'ck') return this.claimCheckin();
    if (it.kind === 'cr') { if (!this.careInfo().today) this.feed(); else { this.shakeCard(card, 4); sfx('buy', { pitchSemitones: 10 }); } return; }
    if (it.kind === 'lock') { this.shakeCard(card); sfx('nope'); return; }
    if (it.kind === 'we') {
      const d = WEAR[it.i], m = this.pet();
      if (it.own) {
        m.worn[d.slot] = m.worn[d.slot] === it.i ? -1 : it.i; delete this.preview[d.slot]; this.addProg(2);
        sfx('duang', { pitchSemitones: 5 }); this.afterWearChange(); return;
      }
      if (inPill && !it.bo && !it.co) return this.buyWear(it.i, card);
      if (this.preview[d.slot] === it.i) delete this.preview[d.slot]; else this.preview[d.slot] = it.i;
      sfx('duang', { pitchSemitones: 8 }); this.afterWearChange();
    }
  }
  afterWearChange() {
    this.applyWear(); this.renderCards(); this.updateHUD(true); this.markDirty(true);
    this.burstHearts(this.mcx, this.mgy - 200 * this.mainScale(), 4);
  }
  spend(price, card) {
    if (this.state.hearts < price) { this.denyFx(card, price); return false; }
    this.state.hearts -= price; return true;
  }
  buySnack(i, card) {
    const price = this.snackCost(i);
    if (!this.spend(price, card)) return;
    const m = this.pet(), before = this.tapVal(true), lv0 = m.sn[i];
    m.sn[i]++; m.sat = Math.min(100, m.sat + SAT_SNACK); this.addProg(1);
    const gainTap = Math.max(0, this.tapVal(true) - before), ms = msTier(m.sn[i]) > msTier(lv0) ? msTier(m.sn[i]) : 0;
    this.sizeTarget = this.sizeFor(m);
    const st = this.stageOf(m);
    if (st > this.shownStage) { this.shownStage = st; this.stageUpFx(m); }
    this.afterBuy(card, { price, snack: i, gainTap, ms, lv: m.sn[i] });
  }
  stageUpFx(m) {
    this.spr.pop.v += 16; this.spr.l.v += 12; this.spr.r.v += 12;
    this.toast(tr('stageUp', { n: tr('n_p' + m.nm), s: tr('stg' + m.stg) }));
    this.burstHearts(this.mcx, this.mgy - 150 * this.mainScale(), 12);
    for (let i = 0; i < 40; i++) this.spawnConfetti(rnd(0, W), rnd(-60, 200));
    this.ring(this.mcx, this.mgy - 170 * this.mainScale(), 3);
    sfx('frenzy'); this.flash = 1; this.checkRare(); this.renderCards();
  }
  adoptCoat(i, card) {
    const c = COATS[i]; if (this.hasCoat(i) >= 0) return;
    if (!this.spend(c.adopt, card)) return;
    this.addPet(i, false, true); this.afterBuy(card, { price: c.adopt });
  }
  nextName() { const used = new Set(this.pets().map((p) => p.nm)); for (let i = 0; i < 8; i++) if (!used.has(i)) return i; return this.pets().length % 8; }
  addPet(coat, rare, hopIn) {
    const p = newPet(coat, this.nextName()); this.pets().push(p);
    this.syncPups();
    const q = this.pups[this.pets().length - 1];
    this.toast(tr(rare ? 'rareGot' : hopIn ? 'newPup' : 'adopted', { n: tr('n_p' + p.nm) }));
    if (q) {
      // 从花园边的栅栏门口蹦进来
      const fromL = q.hx < W / 2;
      q.hop = { t: 0, fx: fromL ? -90 : W + 90, fy: this.yTop + 30, fw: q.w * 0.7, e: 0 };
      q.x = q.hop.fx; q.y = q.hop.fy;
      this.later(980, () => { sfx('duang', { pitchSemitones: 4 }); this.burstHearts(q.x, q.y - 60, 10); this.ring(q.x, q.y - q.w * 0.4, 1); });
      sfx('whoosh');
    }
    if (rare) { sfx('gold'); for (let i = 0; i < 30; i++) this.spawnConfetti(rnd(0, W), rnd(-60, 200)); }
    this.renderCards(); this.markDirty(true);
  }
  grantRare(coat) {
    const left = COATS.map((c, i) => i).filter((i) => COATS[i].kind === 'rare' && this.hasCoat(i) < 0);
    if (coat == null) coat = left.length ? left[(Math.random() * left.length) | 0] : -1;
    if (coat < 0 || this.hasCoat(coat) >= 0) return false;
    this.addPet(coat, true); return true;
  }
  checkRare() {
    const s = this.state, ps = this.pets();
    const want = [[3, ps.some((p) => p.stg >= 1)], [4, s.pg >= 1], [5, ps.some((p) => this.bondTier(p) >= 2)], [6, s.pg >= 2]];
    for (const [c, ok] of want) if (ok && this.hasCoat(c) < 0) { this.addPet(c, true); return; }
  }
  addBond(p, n) {
    p.bond += n; const t = this.bondTier(p);
    if (t > p.bt) {
      p.bt = t;
      this.toast(tr('bondUp', { n: tr('n_p' + p.nm) }));
      const w = BOND_REWARD[t - 1];
      if (w >= 0 && !this.state.own[w]) { this.state.own[w] = 1; this.later(1300, () => { this.toast(tr('bondRew', { w: tr('n_w' + w) })); }); }
      else if (t === 1) this.later(1300, () => this.toast(tr('unlockPeek')));
      this.burstHearts(this.mcx, this.mgy - 220 * this.mainScale(), 10); sfx('gold');
      this.checkRare(); this.renderCards(); this.markDirty(true);
    }
  }
  buyDecor(i, card) {
    if (this.state.de[i]) return;
    if (!this.spend(DECOR[i].cost, card)) return;
    this.state.de[i] = 1; this.afterBuy(card, { price: DECOR[i].cost });
    this.dropDecor(i);
  }
  buyWear(i, card) {
    const d = WEAR[i], m = this.pet();
    if (!this.spend(d.cost, card)) return;
    this.state.own[i] = 1; m.worn[d.slot] = i; delete this.preview[d.slot]; this.addProg(2);
    this.applyWear(); this.afterBuy(card, { price: d.cost });
    this.burstHearts(this.mcx, this.mgy - 420 * this.mainScale(), 10); this.spr.pop.v += 10; this.later(200, () => sfx('gold'));
    if (this.wornSets().some(Boolean)) this.toast(tr('setLabel') + '! +' + SET_PCT + '%');
  }
  afterBuy(card, o = {}) {
    if (o.snack == null) sfx('buy', { pitchSemitones: rnd(-1, 2) });
    const n = card ? card.n : -1;
    const from = card ? this.cardWorld(card) : null;
    this.renderCards(); this.updateHUD(true); this.markDirty(true);
    const nc = n >= 0 ? this.cards[n] : null;
    this.buyFx(nc, from, o);
  }
  markDirty(now) { this.dirty = true; if (now) this.saveNow(); }

  /* ---- 每日任务 / 签到 ---- */
  ensureDay() {
    const tk = this.state.tk, d = localDay();
    if (tk.day !== d) { const st = dayNum() % 5; this.state.tk = { day: d, ids: [st, (st + 1) % 5, (st + 2) % 5], p: [0, 0, 0, 0, 0], got: [0, 0, 0] }; if (this.cardsC && this.tab === 4) this.renderCards(); }
  }
  addProg(id, n = 1) {
    this.ensureDay(); this.state.tk.p[id] += n;
    if (this.tab === 4 && this.cardsC && (this.state.tk.p[id] <= this.taskTarget(id) + 1)) { this.tkDirty = true; }
  }
  claimTask(k) {
    const tk = this.state.tk, id = tk.ids[k];
    if (tk.got[k] || tk.p[id] < this.taskTarget(id)) return;
    tk.got[k] = 1; const v = this.taskReward();
    const card = this.cards.find((c) => c.it.kind === 'tk' && c.it.k === k), from = card ? this.cardWorld(card) : { x: W / 2, y: this.panelTop + 100 };
    this.floatText(from.x, from.y - 60, '+' + fmt(v), 50, '#ffffff', '#e0457b', 2800); sfx('gold');
    this.flyRewards(from.x, from.y, v, 10);
    this.renderCards(); this.markDirty(true);
    const nc = card ? this.cards[card.n] : null; if (nc) this.cardPop(nc);
  }
  claimCheckin() {
    const ci = this.ckInfo(); if (!ci.can) return;
    const ck = this.state.ck; ck.last = localDay(); ck.streak = ci.streak;
    let v = this.ckReward(ci.day);
    if (ci.day === 7) { if (!this.grantRare()) v *= 3; }
    this.toast(tr('ckGot'));
    const card = this.cards.find((c) => c.it.kind === 'ck'), from = card ? this.cardWorld(card) : { x: W / 2, y: this.panelTop + 100 };
    this.floatText(from.x, from.y - 60, '+' + fmt(v), 50, '#ffffff', '#e0457b', 2800); sfx('gold');
    this.flyRewards(from.x, from.y, v, 12);
    this.renderCards(); this.markDirty(true);
    const nc = card ? this.cards[card.n] : null; if (nc) this.cardPop(nc);
  }
  taskReady() {
    const tk = this.state.tk;
    return tk.ids.some((id, k) => !tk.got[k] && tk.p[id] >= this.taskTarget(id)) || this.ckInfo().can;
  }

  /* ---- 屁屁选美大赛（转生） ---- */
  askPageant(card) {
    const s = this.state;
    if (s.run < this.pgNeed()) { this.shakeCard(card); sfx('nope'); this.toast(tr('pgNeed', { n: `${fmt(s.run)}/${fmt(this.pgNeed())}` })); return; }
    this.openModal((m, H) => {
      const y = H * 0.5 - 210, W7 = 720;
      const g = this.add.graphics(); m.add(g); this.paper(g, 50, y, W7 - 100, 420, 36, CREAM, { sh: 10 });
      m.add(this.add.image(W7 / 2, y + 30, 'cs2').setDisplaySize(110, 100));
      m.add(this.txt(W7 / 2, y + 110, () => tr('pgAsk'), 38, NAVY_S, { fit: W7 - 160 }));
      const d = this.txt(W7 / 2, y + 210, () => tr('pgAskD'), 24, '#5a4f7d', { fit: W7 - 160, wrap: W7 - 170 });
      m.add(d);
      m.add(this.btn(W7 / 2 - 140, y + 350, 240, 72, BERRY, () => tr('pgYes'), () => { this.closeModal(); this.doPageant(); }, { size: 32 }));
      m.add(this.btn(W7 / 2 + 140, y + 350, 240, 72, 0x6f9bd1, () => tr('pgNo'), () => this.closeModal(), { size: 30 }));
    });
  }
  doPageant() {
    const s = this.state, before = this.sceneIdx();
    s.pg++; s.tro++; s.hearts = 0; s.run = 0;
    s.pets.forEach((p) => { p.sn = SNACKS.map(() => 0); });
    this.frenzy = 0; this.bar = 0;
    const after = this.sceneIdx();
    this.checkRareSilent();
    this.tab = 3; this.buildAll(); this.mode = 'play';
  }
  checkRareSilent() {
    const s = this.state;
    [[4, s.pg >= 1], [6, s.pg >= 2]].forEach(([c, ok]) => { if (ok && this.hasCoat(c) < 0) { const p = newPet(c, this.nextName()); s.pets.push(p); } });
  }
  showPgResult(sceneNew) {
    for (let i = 0; i < 70; i++) this.spawnConfetti(rnd(0, W), rnd(-80, 300));
    this.openModal((m, H) => {
      const y = H * 0.5 - 220, W7 = 720;
      const g = this.add.graphics(); m.add(g); this.paper(g, 50, y, W7 - 100, 440, 36, CREAM, { sh: 10 });
      const ic = this.add.image(W7 / 2, y + 40, 'cs2').setDisplaySize(130, 120); m.add(ic);
      this.tweens.add({ targets: ic, scale: ic.scale * 1.1, duration: 500, yoyo: true, repeat: -1 });
      m.add(this.txt(W7 / 2, y + 130, () => tr('pgWin'), 56, '#e0457b', { fit: W7 - 160, stroke: '#ffffff', sw: 8 }));
      m.add(this.txt(W7 / 2, y + 202, () => tr('pgGot') + ` (${this.state.tro})`, 30, NAVY_S, { fit: W7 - 160 }));
      m.add(this.txt(W7 / 2, y + 248, () => tr('pgTro', { t: this.state.tro, p: this.trophyPct() }), 24, '#2f7a52', { fit: W7 - 160 }));
      if (sceneNew >= 0) m.add(this.txt(W7 / 2, y + 298, () => tr('pgNew', { s: tr('sc' + sceneNew) }), 28, '#7a4a9a', { fit: W7 - 160 }));
      m.add(this.btn(W7 / 2, y + 380, 280, 76, BERRY, () => tr('pgOk'), () => this.closeModal(), { size: 34 }));
    });
  }

  /* ---- 输入 ---- */
  hitMain(x, y) {
    const sc = this.mainScale(), cx = this.mcx, cy = this.mgy - 180 * sc;
    const rx = (215 + (this.size - 1) * 90) * sc, ry = 200 * sc;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  }
  onDown(p, over) {
    if (this.mode !== 'play' || this.modal) return;
    if (this.popC && !(over && over.length)) { this.closePetPop(); }
    if (p.y >= this.panelTop - 6) return;
    if (over && over.length) return;
    if (this.sw) return;
    for (let i = this.evs.length - 1; i >= 0; i--) {
      const e = this.evs[i];
      if (Math.hypot(p.x - e.x, p.y - e.y) < 72) { this.catchEvent(e, i); return; }
    }
    for (let i = this.pups.length - 1; i >= 0; i--) {
      const q = this.pups[i];
      if (q && !q.hop && Math.abs(p.x - q.x) < q.w * 0.5 && p.y < q.y + 8 && p.y > q.y - q.w * 0.95) { this.tapPup(q, p); return; }
    }
    if (this.hitMain(p.x, p.y) && this.face.turn) return;
    if (this.hitMain(p.x, p.y) && this.face.front) { this.tapFront(p.x, p.y); return; }
    if (this.hitMain(p.x, p.y)) {
      this.down = { x: p.x, y: p.y, lx: p.x, ly: p.y, acc: 0, rub: false, rt: 0, t0: this.t, swiped: false };
      this.tapMain(p.x, p.y);
    }
  }
  onMove(p) {
    if (this.pd && p.isDown) {
      const dx = p.x - this.pd.x;
      if (Math.abs(dx) > 10) { if (!this.pd.drag) this.releasePress(); this.pd.drag = true; }
      if (this.pd.drag) this.scrollTo(this.pd.sx + dx);
    }
    const d = this.down;
    if (d && p.isDown && this.mode === 'play') {
      const dx = p.x - d.lx, dy = p.y - d.ly; d.lx = p.x; d.ly = p.y;
      d.acc += Math.hypot(dx, dy);
      if (!d.swiped && Math.abs(p.x - d.x) > 120 && Math.abs(p.y - d.y) < 90 && this.t - d.t0 < 0.8 && this.pets().length > 1) { d.swiped = true; this.cycleMain(p.x < d.x ? 1 : -1); return; }
      if (!d.rub && Math.hypot(p.x - d.x, p.y - d.y) > 14) d.rub = true;
      if (d.rub && !d.swiped && this.hitMain(p.x, p.y)) {
        if (d.acc > 38) { d.acc = 0; this.rubPulse(p.x, dx >= 0 ? 1 : -1); }
      }
    }
  }
  onUp(p) {
    this.releasePress();
    if (this.pd) {
      const pd = this.pd; this.pd = null;
      if (!pd.drag && this.mode === 'play' && !this.modal) {
        const card = this.cardAt(p); if (card) this.tapCard(card, p);
      }
    }
    this.down = null;
  }

  /* ---- 点击屁股：核心手感 ---- */
  tapMain(x, y) {
    const now = this.t;
    const left = x < this.mcx;
    const m = this.pet(), stg = this.stageOf(m);
    this.touched();
    const v = this.tapVal();
    this.gain(v);
    this.addProg(0); this.addBond(m, 1);
    this.bar = Math.min(100, this.bar + (this.frenzy > 0 ? 0 : 4.5)); this.lastTap = now;
    if (this.frenzy <= 0 && this.bar >= 100) this.startFrenzy();
    const near = left ? this.spr.l : this.spr.r, far = left ? this.spr.r : this.spr.l;
    const hb = [1.12, 1, 0.62][satTier(m.sat)]; // 饿了 Q 弹变弱，吃饱更弹
    near.v += rnd(15, 18) * (1 + stg * 0.06) * hb;
    this.spr.u.v += 9; this.spr.leg.v += 6; this.spr.rot.v += (left ? -1 : 1) * 5.5; this.spr.tail.v += (left ? 1 : -1) * 14;
    this.later(70, () => { far.v += 9 * hb; });
    this.later(140, () => { near.v += 4 * hb; });
    this.shake.l = left ? 1 : 0.5; this.shake.r = left ? 0.5 : 1;
    this.spawnShakeLines();
    const nh = (this.frenzy > 0 ? 5 : 3) + (stg >= 2 ? 2 : 0);
    for (let i = 0; i < nh; i++) this.spawnHeart(x + rnd(-24, 24), y - 20, 1, 1);
    this.floatText(x + rnd(-20, 20), y - 40, '+' + fmt(v, true));
    if (Math.random() < 0.45) this.floatText(x + rnd(-80, 80), y - 100, tr('boing'), 30 + stg * 4, '#fff3a8', '#7a4a9a');
    this.stageFx(x, y, stg);
    const pitch = (this.bar / 100) * 5 - stg * 1.1 + rnd(-0.6, 0.6) + (this.frenzy > 0 ? 3 : 0);
    sfx('duang', { pitchSemitones: pitch });
    if (stg >= 1 && Math.random() < 0.6) sfx('buy', { pitchSemitones: 12 + stg * 2 });
    if (stg >= 3) this.later(60, () => sfx('duang', { pitchSemitones: pitch - 9 }));
    this.markDirty();
  }
  stageFx(x, y, stg) {
    if (stg >= 1) this.spark(x, y - 30, 5 + stg * 2, stg);
    if (stg >= 2) this.ring(x, y - 20, stg);
    if (stg >= 3) { this.cameras.main.shake(110, 0.004); }
  }
  spark(x, y, n, stg) {
    if (this.sparks.length > 80) return;
    const cols = [0xffe28a, 0xffffff, 0xffb3cf, 0xfff3a8];
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.28), v = rnd(180, 380);
      const im = this.add.image(x, y, 'star').setDepth(1550).setTint(cols[(Math.random() * 4) | 0]).setScale(rnd(0.5, 0.9));
      this.sparks.push({ type: 's', im, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0, max: rnd(0.45, 0.8) });
    }
  }
  ring(x, y, stg) {
    const g = this.add.graphics().setDepth(1450);
    this.sparks.push({ type: 'r', g, x, y, life: 0, max: stg >= 3 ? 0.7 : 0.5, R: stg >= 3 ? 330 : 190, col: stg >= 3 ? 0xffd45a : 0xff9fc0 });
  }
  rubPulse(x, dir) {
    const sp = dir > 0 ? this.spr.r : this.spr.l, o = dir > 0 ? this.spr.l : this.spr.r;
    sp.v += 7; o.v -= 4; this.spr.u.v += 3; this.spr.rot.v += dir * 2;
    this.touched();
    if (this.t - (this.lastRub || 0) > 0.28) {
      this.lastRub = this.t; this.gain(this.tapVal() * 0.35); this.addBond(this.pet(), 0.4);
      this.spawnHeart(x + rnd(-30, 30), this.mgy - 190 * this.mainScale(), 0.8, 0.8);
      sfx('duang', { pitchSemitones: -3 + rnd(-1, 1) });
      this.bar = Math.min(100, this.bar + 1.2); this.lastTap = this.t;
      if (this.frenzy <= 0 && this.bar >= 100) this.startFrenzy();
      if (Math.random() < 0.4) this.floatText(x, this.mgy - 200 * this.mainScale(), '+' + fmt(this.tapVal() * 0.35, true), 30);
    }
  }
  tapPup(q, p) {
    q.sq.v = 14; if (q.state === 'sleep') { q.state = 'idle'; q.t = 2; }
    const v = this.tapVal() * 2; this.gain(v);
    this.addBond(this.pets()[q.i], 1);
    this.spawnHeart(q.x, q.y - q.w * 0.6, 1, 1); this.spawnHeart(q.x + 20, q.y - q.w * 0.6, 1, 1);
    this.floatText(q.x, q.y - q.w * 0.8, '+' + fmt(v, true), 34);
    sfx('duang', { pitchSemitones: 5 + rnd(0, 3) }); this.markDirty();
    this.openPetPop(q);
  }
  gain(v) { this.state.hearts += v; this.state.total += v; this.state.run += v; }

  startFrenzy() {
    this.frenzy = 10; this.bar = 100; sfx('frenzy');
    this.toast(tr('frenzy'));
    this.flash = 1;
    for (let i = 0; i < 60; i++) this.spawnConfetti(rnd(0, W), rnd(-80, 300));
  }

  /* ---- 待机撒娇 ---- */
  touched() {
    const q = this.t - this.lastTouch;
    this.lastTouch = this.t;
    this.idleCancel();
    if (q > 4 && this.mode === 'play') this.react = { u: 0, dur: 1.4, peek: this.bondTier(this.pet()) >= 1, bub: false };
  }
  idleCancel() { this.idle.cur = null; this.idle.gap = rnd(1, 2); }
  idleStart() {
    const types = ['twerk', 'tail', 'bounce', 'stretch', 'sway'];
    if (this.bondTier(this.pet()) >= 1) types.push('peek', 'peek');
    let type; do { type = types[(Math.random() * types.length) | 0]; } while (type === this.idle.last && types.length > 1);
    const dur = { twerk: 2.4, tail: 2.2, bounce: 2.4, stretch: 2.8, sway: 3.0, peek: 3.6 }[type];
    this.idle.cur = type; this.idle.u = 0; this.idle.dur = dur; this.idle.last = type; this.idle.flag = false;
    if (type === 'peek') { this.peek.side = Math.random() < 0.5 ? 1 : -1; }
  }
  idleFx(dt) {
    const o = { rot: 0, cl: 0, cr: 0, tr: 0, tsx: 1, tsy: 1, hy: 0, sx: 1, sy: 1, str: 0, head: 0, blink: 0, ear: 0 };
    const id = this.idle;
    const quiet = this.mode !== 'play' || this.modal || this.sw || this.down || this.face.front || this.face.turn;
    if (!quiet) {
      const q = this.t - this.lastTouch;
      if (id.cur) {
        id.u += dt;
        if (id.u >= id.dur) { id.cur = null; id.gap = rnd(1.2, 2.6); }
      } else if (q > 4) { id.gap -= dt; if (id.gap <= 0) this.idleStart(); }
    }
    if (id.cur) {
      const u = id.u, dur = id.dur, E = Math.max(0, Math.min(1, u / 0.25, (dur - u) / 0.3));
      const twerk = (E2) => { const w = Math.sin(u * 15); o.rot += w * 0.045 * E2; o.cl += w * 0.9 * E2; o.cr -= w * 0.9 * E2; o.hy -= Math.abs(Math.sin(u * 7.5)) * 6 * E2; };
      switch (id.cur) {
        case 'twerk': twerk(E); o.tr = Math.sin(u * 15 + 1) * 0.3 * E; break;
        case 'tail': o.tr = Math.sin(u * 22) * 0.95 * E; o.tsx = 1 + 0.28 * Math.cos(u * 22) * E; o.tsy = 1 + 0.18 * Math.sin(u * 11) * E; break;
        case 'bounce': { const h = Math.abs(Math.sin(u * Math.PI / 0.8)); o.hy -= h * 28 * E; o.sy -= 0.07 * Math.pow(1 - h, 5) * E; o.sx += 0.05 * Math.pow(1 - h, 5) * E; break; }
        case 'stretch': { const k = Math.max(0, Math.min(1, u / 0.9, (dur - u) / 0.7)); o.str = k * k * (3 - 2 * k); o.tr = -0.25 * o.str + Math.sin(u * 9) * 0.1 * o.str; if (!id.flag && u > dur - 0.7) { id.flag = true; this.spr.pop.v += 7; } break; }
        case 'sway': { // 左右轻晃 + 耳朵抖（不翻转）
          const w = Math.sin(u * 5.2); o.rot += w * 0.07 * E; o.hy -= Math.abs(w) * 10 * E; o.ear = Math.sin(u * 30) * 0.02 * E;
          o.tr = Math.sin(u * 18) * 0.7 * E; o.cl += w * 0.4 * E; o.cr += w * 0.4 * E;
          break;
        }
        case 'peek': {
          const a = Math.max(0, Math.min(1, u / 0.5, (dur - u) / 0.5)); o.head = a * a * (3 - 2 * a);
          o.blink = (u > 1.5 && u < 1.68) || (u > 2.3 && u < 2.45) ? 1 : 0;
          if (!id.flag && u > 0.7) { id.flag = true; this.peekBubble(); }
          break;
        }
      }
    }
    const r = this.react;
    if (r) {
      r.u += dt;
      if (r.u >= r.dur) this.react = null;
      else {
        const E = Math.max(0, Math.min(1, r.u / 0.1, (r.dur - r.u) / 0.3));
        o.ear = Math.sin(r.u * 36) * 0.035 * E; o.hy -= Math.abs(Math.sin(r.u * 9)) * 8 * E;
        if (r.peek) { const a = Math.max(0, Math.min(1, r.u / 0.25, (r.dur - r.u) / 0.3)); o.head = Math.max(o.head, a * a * (3 - 2 * a)); if (!r.bub && r.u > 0.3) { r.bub = true; this.peekBubble(); } }
      }
    }
    return o;
  }
  peekBubble() {
    const sc = this.mainScale(), s = this.peek.side;
    const x = this.mcx + s * 230 * sc, y = this.mgy - 400 * sc;
    const c = this.add.container(x, y).setDepth(1960);
    if (Math.random() < 0.6) { c.add(this.add.image(0, 0, 'hp').setScale(0.42).setTint(0xf06c9b)); }
    else { const g = this.add.graphics(); this.paper(g, -34, -34, 68, 68, 34, 0xffffff, { sh: 4 }); c.add(g); c.add(this.txt(0, -4, '?', 46, '#e0457b', {})); }
    c.setScale(0.1); this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: c, y: y - 40, alpha: { from: 1, to: 0 }, duration: 800, delay: 1300, onComplete: () => c.destroy(true) });
  }
  hintUpdate(dt) {
    const q = this.t - this.lastTouch;
    const want = this.mode === 'play' && !this.modal && !this.sw && q > 10 && !this.face.front && !this.face.turn;
    if (want && !this.hint) {
      const sc = this.mainScale();
      const bub = this.add.container(0, 0).setDepth(1970);
      const g = this.add.graphics(); this.paper(g, -125, -36, 250, 72, 30, 0xffffff, { sh: 5 }); g.fillStyle(0xffffff, 1); g.fillTriangle(-20, 34, 22, 34, -6, 58); bub.add(g);
      bub.add(this.txt(0, -4, () => tr('patMe'), 30, '#e0457b', { fit: 226 }));
      const hand = this.add.image(0, 0, 'hand').setOrigin(0.22, 0.04).setDepth(1980).setScale(0.8);
      this.hint = { bub, hand, a: 0 };
    }
    const h = this.hint; if (!h) return;
    h.a += ((want ? 1 : 0) - h.a) * Math.min(1, dt * 6);
    if (!want && h.a < 0.02) { h.bub.destroy(true); h.hand.destroy(); this.hint = null; return; }
    const sc = this.mainScale(), T = this.t;
    h.bub.setPosition(clamp(this.mcx + 150 * sc, 140, W - 140), this.mgy - 500 * sc + Math.sin(T * 3) * 6).setAlpha(h.a).setScale(0.8 + 0.2 * h.a);
    const k = (T * 1.1) % 1, press = k < 0.5 ? Math.sin(k / 0.5 * Math.PI) : 0;
    const tx = this.mcx + 30 * sc, ty = this.mgy - 190 * sc;
    h.hand.setPosition(tx + 70 * (1 - press) + 10, ty + 90 * (1 - press) + 10).setAlpha(h.a).setScale(0.8 * (1 - 0.08 * press)).setRotation(-0.1);
  }

  /* ---- 粒子 ---- */
  spawnHeart(x, y, sc = 1, up = 1) {
    if (this.hearts.length > 70) return;
    const im = this.add.image(x, y, 'mi0').setDepth(1500);
    const tints = [0xffffff, 0xffc4d4, 0xffa9c2, 0xffd9e6];
    im.setTint(tints[(Math.random() * tints.length) | 0]);
    const s = rnd(0.12, 0.2) * sc * 1.1;
    im.setScale(0.01);
    this.hearts.push({ im, vx: rnd(-90, 90), vy: -rnd(190, 330) * up, life: 0, max: rnd(0.9, 1.4), rot: rnd(-3, 3), s });
  }
  burstHearts(x, y, n) { for (let i = 0; i < n; i++) this.spawnHeart(x + rnd(-40, 40), y + rnd(-20, 20), 1.2, 1.2); }
  spawnConfetti(x, y) {
    if (this.confetti.length > 110) return;
    const cols = [0xe0457b, 0xf6b72a, 0x8fb48a, 0xb9a7e6, 0xffffff, 0xff9fb8];
    const im = this.add.image(x, y, 'conf').setDepth(1600).setTint(cols[(Math.random() * cols.length) | 0]).setScale(rnd(0.7, 1.3));
    this.confetti.push({ im, vx: rnd(-40, 40), vy: rnd(60, 160), rot: rnd(-6, 6), ph: rnd(0, 6) });
  }
  floatText(x, y, str, size = 44, col = '#ffffff', stroke = '#e0457b', depth = 1700, rise = 120) {
    const t = this.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: col, stroke, strokeThickness: Math.round(size / 5) }).setOrigin(0.5).setDepth(depth);
    this.tweens.add({ targets: t, y: y - rise, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Sine.Out', onComplete: () => t.destroy() });
    this.tweens.add({ targets: t, scale: { from: 0.4, to: 1 }, duration: 220, ease: 'Back.Out' });
    return t;
  }
  spawnShakeLines() {
    const sc = this.mainScale();
    [-1, 1].forEach((d) => {
      const g = this.add.graphics().setDepth(1400);
      const x = this.mcx + d * 235 * sc, y = this.mgy - 160 * sc;
      g.lineStyle(7, 0xfff3d6, 1);
      for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(x + d * i * 22, y, 60 + i * 26, d > 0 ? -0.6 : Math.PI - 0.6, d > 0 ? 0.6 : Math.PI + 0.6); g.strokePath(); }
      this.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, x: d * 22, duration: 420, onComplete: () => g.destroy() });
    });
  }

  /* ---- 随机事件 ---- */
  spawnEvent() {
    const gold = Math.random() < 0.4;
    const e = { gold, t: 0, life: gold ? 7 : 9 };
    if (gold) { e.x = rnd(120, W - 120); e.y = -40; e.sx = e.x; e.im = this.add.image(e.x, e.y, 'sn7').setDisplaySize(110, 80); }
    else { const dir = Math.random() < 0.5 ? 1 : -1; e.dir = dir; e.x = dir > 0 ? -60 : W + 60; e.y = rnd(this.yTop + 20, this.yTop + 200); e.base = e.y; e.im = this.add.image(e.x, e.y, 'mi5').setDisplaySize(110, 90); }
    e.im.setDepth(1800); e.glow = this.add.image(e.x, e.y, 'hl').setScale(3).setAlpha(0.5).setDepth(1799).setBlendMode(Phaser.BlendModes.ADD);
    this.evs.push(e);
  }
  updateEvents(dt) {
    for (let i = this.evs.length - 1; i >= 0; i--) {
      const e = this.evs[i]; e.t += dt;
      if (e.gold) { e.y = -40 + (this.yBot - 160 + 40) * Math.min(1, e.t / 5); e.x = e.sx + Math.sin(e.t * 2.4) * 40; e.im.setRotation(Math.sin(e.t * 3) * 0.25); e.im.setScale(0.5 + Math.sin(e.t * 6) * 0.04); }
      else { e.x += e.dir * 120 * dt; e.y = e.base + Math.sin(e.t * 2.2) * 60; e.im.scaleX = 0.4 * (0.5 + Math.abs(Math.sin(e.t * 14)) * 0.6) * e.dir; e.im.scaleY = 0.4; }
      e.im.setPosition(e.x, e.y); e.glow.setPosition(e.x, e.y);
      if (e.t > e.life || e.x < -100 || e.x > W + 100) { e.im.destroy(); e.glow.destroy(); this.evs.splice(i, 1); }
    }
  }
  catchEvent(e, idx) {
    const mult = e.gold ? 60 : 25;
    const v = Math.max(this.hps() * mult + this.tapVal() * (e.gold ? 100 : 40), 25);
    this.gain(v); this.addProg(3);
    this.burstHearts(e.x, e.y, 10); this.floatText(e.x, e.y - 30, '+' + fmt(v, true), 56);
    this.toast(e.gold ? tr('gold') : tr('butterfly'));
    sfx('gold'); this.spr.u.v += 6;
    e.im.destroy(); e.glow.destroy(); this.evs.splice(idx, 1);
    if (Math.random() < 0.08) this.grantRare();
    this.markDirty();
  }

  /* ---- 弹窗 ---- */
  openModal(build) {
    this.closeModal(); this.closePetPop();
    const m = this.add.container(0, 0).setDepth(6000); this.modal = m;
    const inner = this.add.container((W - 720) / 2, 0);
    const H = this.H;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x2a1f4a, 0.55).setInteractive(); m.add(dim); m.add(inner);
    build(inner, H);
    m.setAlpha(0); this.tweens.add({ targets: m, alpha: 1, duration: 160 });
    return m;
  }
  closeModal() { if (this.modal) { this.modal.destroy(true); this.modal = null; } }
  showTitle() {
    this.openModal((m, H) => {
      const W7 = 720;
      const g = this.add.graphics(); m.add(g);
      this.paper(g, 50, H * 0.2, W7 - 100, 250, 40, CREAM, { sh: 10 });
      g.fillStyle(BERRY, 1); g.fillRoundedRect(70, H * 0.2 + 18, W7 - 140, 10, 5);
      m.add(this.add.image(W7 / 2, H * 0.2 - 8, 'mi0').setDisplaySize(96, 84));
      const nm = this.txt(W7 / 2, H * 0.2 + 135, () => tr('title'), 62, NAVY_S, { fit: W7 - 150 }); m.add(nm);
      m.add(this.txt(W7 / 2, H * 0.2 + 300, () => tr('tapStart'), 28, '#ffffff', { fit: W7 - 80, stroke: '#7a4a9a', sw: 6 }));
      this.langBtns(m, H * 0.5 + 10);
      const b = this.btn(W7 / 2, H * 0.5 + 130, 320, 90, BERRY, () => tr('start'), () => {
        unlockAudio(); this.closeModal(); this.mode = 'play'; this.lastTouch = this.t; this.updateHUD(true);
        if (this.offlineGain > 0) this.showOffline();
        this.later(this.offlineGain > 0 ? 4000 : 1600, () => { if (!this.modal) this.toast(tr('compIntro', { c: fmt(this.compRate(), true) })); });
      }, { size: 40 });
      m.add(b);
      this.tweens.add({ targets: b, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1 });
    });
  }
  offSim() { // 测试用：离线收益对照（不改状态）
    const keep = this.pets().map((q) => q.sat), out = { hps: Math.round(this.hps(true) * 100) / 100 };
    [100, 20].forEach((sv) => { this.pets().forEach((q) => { q.sat = sv; }); out['on30m_' + sv] = Math.round(this.hps(true) * 1800); [1, 6, 24].forEach((hh) => { const r = this.offlineCalc(hh * 3600); out[sv + '_' + hh + 'h'] = Math.round(r.gain) + (r.capped ? '*' : ''); }); });
    this.pets().forEach((q, i) => { q.sat = keep[i]; }); return out;
  }
  showOffline() {
    this.mode = 'play';
    const gain = this.offlineGain, sec = this.offlineSec, info = this.offlineInfo || {}; this.offlineGain = 0; this.offlineInfo = null;
    this.openModal((m, H) => {
      const hungry = this.pets().filter((p) => satTier(p.sat) >= 1).length, ms = this.mealState(), ex = hungry || ms.open ? 62 : 0;
      const drop = (info.hungryT || 0) > 60, dx = drop ? 44 : 0;
      const W7 = 720, y = H * 0.5 - 200 - (ex + dx) / 2;
      const g = this.add.graphics(); m.add(g);
      this.paper(g, 60, y, W7 - 120, 400 + ex + dx, 36, CREAM, { sh: 10 });
      if (drop) m.add(this.txt(W7 / 2, y + 318, () => tr('offDrop'), 22, '#c2185b', { fit: W7 - 180 }));
      if (ex) {
        const yy = y + 304 + dx;
        const gg = this.add.graphics(); m.add(gg); this.paper(gg, 96, yy, W7 - 192, 52, 22, 0xfde7ef, { sh: 0 });
        m.add(this.add.image(130, yy + 26, 'sn4e').setDisplaySize(48, 38));
        m.add(this.txt(W7 / 2 + 22, yy + 26, () => (hungry ? tr('offHungry', { n: hungry }) : '') + (hungry && ms.open ? ' · ' : '') + (ms.open ? tr('offMeal', { m: tr('meal' + ms.m) }) : ''), 20, '#c2185b', { fit: W7 - 260 }));
      }
      m.add(this.add.image(W7 / 2, y + 20, 'mi0').setDisplaySize(110, 96));
      m.add(this.txt(W7 / 2, y + 100, () => tr('welcome'), 44, NAVY_S, { fit: W7 - 180 }));
      m.add(this.txt(W7 / 2, y + 160, () => tr('offlineGot'), 25, '#5a4f7d', { fit: W7 - 170 }));
      m.add(this.txt(W7 / 2, y + 225, () => '+' + fmt(Math.floor(gain)), 64, '#e0457b', { fit: W7 - 190, stroke: '#ffffff', sw: 8 }));
      const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = Math.floor(sec % 60);
      const ts = () => (hh ? hh + tr('h') + ' ' : '') + (mm || hh ? mm + tr('m') : ss + tr('s'));
      m.add(this.txt(W7 / 2, y + 278, () => tr('offlineFor', { t: ts() }) + '  ' + tr(info.capped ? 'offCapHit' : 'offCap'), 21, '#7a6f9b', { fit: W7 - 170 }));
      m.add(this.btn(W7 / 2, y + 350 + ex + dx, 300, 76, BERRY, () => tr('claim'), () => {
        this.gain(gain); sfx('gold'); this.burstHearts(W / 2, y + 100, 12); this.closeModal(); this.markDirty(true);
      }, { size: 34 }));
    });
  }
  showSettings() {
    this.resetArm = false;
    this.openModal((m, H) => {
      const W7 = 720, y = H * 0.5 - 300;
      const g = this.add.graphics(); m.add(g);
      this.paper(g, 50, y, W7 - 100, 600, 36, CREAM, { sh: 10 });
      m.add(this.txt(W7 / 2, y + 52, () => tr('settings'), 44, NAVY_S, { fit: W7 - 220 }));
      m.add(this.txt(W7 / 2, y + 120, () => tr('language'), 26, '#7a6f9b', { fit: 300 }));
      this.langBtns(m, y + 180);
      const toggle = (yy, key, labelKey) => {
        m.add(this.txt(130, yy, () => tr(labelKey), 30, NAVY_S, { ox: 0, fit: 250 }));
        const c = this.btn(W7 - 160, yy, 170, 64, SAGE, () => (settings[key] ? tr('on') : tr('off')), () => {
          settings[key] = !settings[key]; saveSettings(); applyVolumes(); draw(); sfx('buy');
        }, { size: 28 });
        const draw = () => { const gg = c.list[0]; gg.clear(); this.paper(gg, -85, -32, 170, 64, 20, settings[key] ? SAGE : 0xa59fb5, { sh: 5 }); this.applyText(this.texts.find((r) => r.o === c.list[1])); };
        draw(); m.add(c);
      };
      toggle(y + 270, 'music', 'music'); toggle(y + 360, 'sfx', 'sfx');
      m.add(this.btn(W7 / 2, y + 460, 400, 70, 0xc86b8a, () => (this.resetArm ? tr('resetConfirm') : tr('reset')), () => {
        if (!this.resetArm) { this.resetArm = true; this.refreshTexts(); return; }
        this.resetAll();
      }, { size: 26 }));
      m.add(this.btn(W7 / 2, y + 548, 240, 64, 0x6f9bd1, () => tr('close'), () => this.closeModal(), { size: 28 }));
    });
  }
  resetAll() {
    this.canSave = true; this.state = freshState();
    try { window.gp?.player?.saves?.putLatest(this.state); } catch (e) { /* */ }
    this.bar = 0; this.frenzy = 0; this.tab = 0; this.slotSel = 0; this.react = null;
    this.buildAll(); this.mode = 'play';
  }
  onResize() {
    if (this.mode === 'loading') return;
    const [nw, nh] = calcSize();
    if (Math.abs(nh - this.scale.height) > 2 || nw !== W) {
      this.saveNow(); W = nw; this.scale.setGameSize(W, nh);
      const wasTitle = this.mode === 'title';
      this.buildAll();
      if (wasTitle) { if (this.ttl) this.ttl.destroy(true); this.buildTitle('ready'); } else this.mode = 'play';
    }
  }

  /* ---- 主循环 ---- */
  later(ms, fn) { (this.lq = this.lq || []).push({ t: ms / 1000, fn }); }
  update(time, delta) {
    const SL = (globalThis.__MAKEPLAY_PLAYTEST__ && globalThis.__slow) || 1; this.tweens.timeScale = SL;
    const dt = Math.min(0.05, delta / 1000) * SL;
    this.t += dt;
    if (this.mode === 'loading') { this.updateLoading(dt); return; }
    if (this.ttlS) this.updateTitleFx(dt);
    if (this.lq && this.lq.length) { for (let i = this.lq.length - 1; i >= 0; i--) { const q = this.lq[i]; q.t -= dt; if (q.t <= 0) { this.lq.splice(i, 1); try { q.fn(); } catch (e) { console.error(e); } } } }
    const s = this.state;
    if (this.mode === 'play') {
      const inc = (this.hps() + (document.hidden ? 0 : this.compRate())) * dt; s.hearts += inc; s.total += inc; s.run += inc;
      if (this.frenzy > 0) {
        this.frenzy -= dt; this.bar = this.frenzy > 0 ? 100 : 0;
        if (this.frenzy <= 0) { this.frenzy = 0; this.bar = 0; }
        this.fz = (this.fz || 0) - dt;
        if (this.fz <= 0) { this.fz = 0.42; this.spr.l.v += 7; this.spr.r.v += 7; this.spr.u.v += 5; this.spawnHeart(this.mcx + rnd(-140, 140), this.mgy - 190 * this.mainScale(), 1, 1); }
        for (let i = 0; i < 2; i++) this.spawnConfetti(rnd(0, W), -20);
      } else if (this.t - this.lastTap > 0.75) this.bar = Math.max(0, this.bar - 16 * dt);
      this.evTimer -= dt;
      this.stT = (this.stT || 0) - dt;
      if (this.stT <= 0) { this.stT = 0.5; const mp = this.pet(), ns = this.stageOf(mp); if (ns > this.shownStage) { this.shownStage = ns; this.sizeTarget = this.sizeFor(mp); this.stageUpFx(mp); } this.pets().forEach((q) => this.stageOf(q)); }
      if (this.evTimer <= 0 && this.evs.length < 2 && !this.modal) { this.evTimer = rnd(25, 50); this.spawnEvent(); }
      this.autoT = (this.autoT || 0) + dt;
      if (this.autoT > 12 && this.dirty) { this.autoT = 0; this.saveNow(); }
      this.drainSat(dt); this.hungerTick(dt);
      this.dayT = (this.dayT || 0) - dt;
      if (this.dayT <= 0) { this.dayT = 20; this.ensureDay(); }
    }
    this.size += (this.sizeTarget - this.size) * Math.min(1, dt * 4);
    if (this.sw) { this.sw.t += dt; if (this.sw.t >= 0.95) { this.sw = null; this.spr.pop.v += 10; this.spr.l.v += 10; this.spr.r.v += 10; this.burstHearts(this.mcx, this.mgy - 200 * this.mainScale(), 6); } }
    if (this.mode === 'play') this.faceUpdate(dt);
    if (this.topRefund && this.mode === 'play' && !this.modal) { const v = this.topRefund; this.topRefund = 0; this.toast(tr('topRefund', { v: fmt(v) })); }
    this.eatUpdate(dt);
    this.updateRig(dt);
    this.updatePups(dt);
    this.updateEvents(dt);
    this.updateParticles(dt);
    this.hintUpdate(dt);
    this.drawBar(); this.drawSat();
    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT <= 0) {
      this.hudT = 0.12; this.updateHUD();
      this.tabDot.setVisible(this.taskReady());
      if (this.tkDirty && this.tab === 4) { this.tkDirty = false; this.renderCards(); }
    }
    const tg = this.tabGeom; if (tg) this.tabDot.setPosition(tg.x0 + 4 * (tg.tw + tg.gap) + tg.tw - 18, tg.ty + 12);
    if (this.mode === 'play') this.cardTick(dt);
    this.afT = (this.afT || 0) - dt;
    if (this.afT <= 0) { this.afT = 0.3; if (this.cards) this.updateAfford(); }
    if (this.closetBtn) this.closetBtn.setScale(1 + Math.sin(this.t * 3) * 0.025);
    for (let i = 0; i < DECOR.length; i++) { const c = this.decorSp[i]; if (c && c.visible && c.im) c.im.rotation = Math.sin(this.t * 1.5 + i) * 0.015; }
    if (this.flash > 0) this.flash -= dt * 2;
  }
  updateRig(dt) {
    const S = this.spr; for (const k in S) S[k].step(dt);
    const fx = this.idleFx(dt), R = this.R;
    const sc = this.mainScale(), T = this.t;
    const u = S.u.x, pop = S.pop.x, g = this.size - 1;
    const br = Math.sin(T * 2.1) * 0.006;
    let px = this.mcx, py = this.mgy + fx.hy, sm = 1, wob = 0;
    if (this.sw) {
      const k = Math.min(1, this.sw.t / 0.95), e = k * k * (3 - 2 * k);
      px = lerp(this.sw.fx, this.mcx, e); py = lerp(this.sw.fy, this.mgy, e) - Math.sin(Math.PI * k) * 150 - Math.abs(Math.sin(k * 14)) * 22 * (1 - k);
      sm = lerp(this.sw.fs, 1, e); wob = Math.sin(k * 26) * 0.12 * (1 - k);
    }
    // 饿：趴低一点、尾巴耷拉；饱：尾巴摇得更欢
    const tier = satTier(this.pet().sat); this.hg = (this.hg || 0) + ((tier === 2 ? 1 : tier === 1 ? 0.35 : 0) - (this.hg || 0)) * Math.min(1, dt * 3);
    const hg = this.eat ? 0 : this.hg;
    if (!this.face.front && !this.face.turn) { this.minSx = Math.min(this.minSx == null ? 9 : this.minSx, fx.sx); (this.idleSeen = this.idleSeen || {})[this.idle.cur || '-'] = 1; }
    this.rig.setScale(sc * sm * fx.sx * (1 + 0.02 * pop) * (1 + 0.05 * hg), sc * sm * (1 - 0.06 * u + br * (1 - 0.6 * hg) + 0.02 * pop) * fx.sy * (1 - 0.09 * hg));
    this.rig.rotation = 0.04 * S.rot.x + fx.rot + wob + fx.ear;
    this.rig.setPosition(px, py);
    const bs = 1 + g * 0.12;
    this.bodyC.setScale(bs * (1 + 0.05 * u), bs * (1 - 0.05 * u - 0.05 * fx.str));
    this.accC.setScale(this.bodyC.scaleX, this.bodyC.scaleY);
    const cg = 1 + g * 0.75;
    [[this.cheekL, S.l.x + fx.cl, -1], [this.cheekR, S.r.x + fx.cr, 1]].forEach(([c, x, d]) => {
      const pf = 1 + 0.12 * Math.min(1.2, S.puff.x); c.setScale(cg * (1 + 0.2 * x) * pf, cg * (1 - 0.18 * x) * pf);
      c.x = c.px - 256 + d * (x * 7 + g * 12);
      c.y = c.py - 480 + x * 5 + g * 4 - 26 * fx.str;
      c.rotation = d * 0.035 * x + d * 0.02 * S.rot.x;
    });
    const avg = (S.l.x + S.r.x) / 2;
    this.heartC.setScale(cg * (1 + 0.1 * avg) * (1 + 0.12 * Math.min(1.2, S.puff.x)), cg * (1 - 0.1 * avg) * (1 + 0.12 * Math.min(1.2, S.puff.x)));
    this.heartC.y = this.heartC.py - 480 + avg * 3 - 22 * fx.str;
    const tk = R.coat === 5 ? 1.18 : 1;
    this.tailC.rotation = Math.sin(T * (5 + (tier === 0 ? 2.5 : 0) - 2 * hg) + 1) * (0.1 + (this.frenzy > 0 ? 0.25 : 0.04) + (tier === 0 ? 0.06 : 0)) * (1 - 0.65 * hg) + S.tail.x * 0.35 + fx.tr + 0.12 * hg;
    this.tailC.setScale(tk * (1 + S.u.x * 0.06) * fx.tsx, tk * fx.tsy);
    [[this.legLC, -1], [this.legRC, 1]].forEach(([c, d]) => {
      const lv = S.leg.x;
      c.rotation = d * (0.05 * lv + Math.sin(T * 40) * 0.01 * Math.min(1, Math.abs(S.l.x) * 3));
      c.setScale(1 - 0.05 * lv, (1 + 0.12 * lv - 0.1 * Math.abs(S.u.x) + 0.2 * fx.str) * (1 - 0.4 * hg));
    });
    // 回头偷看
    const hd = this.headC, side = this.peek.side;
    const a = Math.max(fx.head, 0);
    if (a > 0.01 && this.bondTier(this.pet()) >= 1 || a > 0.01 && this.react) {
      hd.setVisible(true).setAlpha(Math.min(1, a * 1.5));
      R.headIm.setFlipX(side < 0);
      hd.x = side * lerp(70, 188, a); hd.y = -215 + lerp(30, 0, a) + Math.sin(T * 6) * 3 * a;
      hd.rotation = side * (0.3 - 0.32 * a) + Math.sin(T * 3) * 0.03;
      const ch = this.chompT > 0 ? Math.abs(Math.sin(this.chompT * 26)) * 0.09 : 0;
      R.headIm.setScale((300 / PEEK.h) * (1 + 0.04 * u + ch), (300 / PEEK.h) * (1 - 0.04 * u - ch) * (1 - 0.85 * fx.blink));
    } else hd.setVisible(false);
    this.renderFront(dt, px, py, sc * sm, g, u, pop);
    this.mshadow.setPosition(px, this.mgy + 8).setDisplaySize(470 * sc * sm * (1 + g * 0.35), 110 * sc * sm).setAlpha(0.9);
  }
  updateParticles(dt) {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i]; h.life += dt; const k = h.life / h.max;
      h.vy += 380 * dt; h.vx *= 0.99;
      h.im.x += h.vx * dt; h.im.y += h.vy * dt; h.im.rotation += h.rot * dt * 0.4;
      h.im.setScale(h.s * Math.min(1, h.life * 9) * (1 - Math.max(0, k - 0.6) * 0.8)); h.im.setAlpha(1 - Math.max(0, k - 0.65) / 0.35);
      if (k >= 1) { h.im.destroy(); this.hearts.splice(i, 1); }
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i]; c.ph += dt * 5;
      c.im.x += (c.vx + Math.sin(c.ph) * 40) * dt; c.im.y += c.vy * dt; c.im.rotation += c.rot * dt; c.im.scaleX = Math.cos(c.ph * 1.3);
      if (c.im.y > this.H + 30) { c.im.destroy(); this.confetti.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]; p.life += dt; const k = p.life / p.max;
      if (p.type === 's') { p.vy += 500 * dt; p.im.x += p.vx * dt; p.im.y += p.vy * dt; p.im.setAlpha(1 - k).setScale(p.im.scale * (1 - dt * 1.5)); p.im.rotation += dt * 6; if (k >= 1) { p.im.destroy(); this.sparks.splice(i, 1); } }
      else { p.g.clear(); p.g.lineStyle(10 * (1 - k) + 2, p.col, 1 - k); p.g.strokeCircle(p.x, p.y, p.R * (1 - Math.pow(1 - k, 3)) + 10); if (k >= 1) { p.g.destroy(); this.sparks.splice(i, 1); } }
    }
  }

  /* 试衣间总表(仅 playtest):k<14 → 毛色 k>>1 正/背;k=100 → 组合穿搭总表 */
  async fitSheet(k) {
    const cells = [];
    if (k >= 100) {
      const C = [[0, 3, 5, 9, 12], [3, 1, 6, 8, 12], [4, 2, 7, 10, 12], [0, 0, 4, 9, 11], [3, 2, 5, 10, 11], [5, 3, 7, 8, 12]];
      C.forEach(([co, h, t, n, tl]) => [1, 0].forEach((fr) => cells.push({ coat: co, front: !!fr, worn: [h, t, n, tl], lb: 'c' + co })));
    } else {
      const coat = k >> 1, front = !!(k & 1);
      cells.push({ coat, front, worn: [-1, -1, -1, -1], lb: 'none' });
      for (let id = 0; id < 13; id++) { if (WEAR[id].gone) continue; const w = [-1, -1, -1, -1]; w[WEAR[id].slot] = id; cells.push({ coat, front, worn: w, lb: '' + id }); }
    }
    const defs = this.assetDefs().filter(([k2]) => /^(cc|fc|cs|cx|wf|top|wing|pw|ps)/.test(k2));
    await this.runLoad(defs);
    this.fit = { front: true }; this.ff.next = 9999; this.ff.blinkT = 9999; this.ff.act = null; this.ff.react = null; this.lastTouch = this.t + 99999;
    this.idleCancel(); this.idle.gap = 99999; this.face.turn = null; this.face.manual = true; this.face.until = this.t + 99999; this.face.nextT = 9999;
    const cols = 5, cw = 250, ch = 300, rows = Math.ceil(cells.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch; const x = cv.getContext('2d');
    x.fillStyle = '#334'; x.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i], m = this.pet(); m.coat = c.coat; m.worn = c.worn.slice(); c.worn.forEach((id) => { if (id >= 0) this.state.own[id] = 1; });
      this.setRigCoat(this.R, c.coat); if (this.F) this.setFrontCoat(this.F, c.coat);
      this.face.front = c.front; this.wearKey = ''; this.applyWear(true);
      await new Promise((r) => setTimeout(r, 450));
      const img = await new Promise((res) => this.game.renderer.snapshotArea(300, 300, 500, 600, res));
      await new Promise((r) => { if (img.complete) r(); else img.onload = r; });
      x.drawImage(img, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch);
      x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText(c.lb + (c.front ? ' F' : ' B'), (i % cols) * cw + 6, ((i / cols) | 0) * ch + 24);
    }
    const d = document.createElement('img'); d.src = cv.toDataURL('image/png'); d.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:99999';
    d.onclick = () => d.remove(); document.body.appendChild(d);
  }

  installBridge() {
    globalThis.__MAKEPLAY_PLAYTEST__ = {
      snapshot: () => { const p = this.pets && this.state ? this.pet() : null; return { comp: this.state ? Math.round(this.compRate() * 100) / 100 : null, offSim: this.state ? this.offSim() : null, turnN: this.turnN || 0, minSx: this.minSx, idleSeen: Object.keys(this.idleSeen || {}).join(','), front: !!(this.face && this.face.front), turning: !!(this.face && this.face.turn), nextT: this.face && +this.face.nextT.toFixed(1), modal: !!this.modal, mode: this.mode, hearts: Math.floor(this.state.hearts), run: Math.floor(this.state.run), tapVal: this.tapVal && this.mode !== 'loading' ? this.tapVal() : 0, hps: this.mode !== 'loading' ? this.hps() : 0, tab: this.tab, main: this.state.main, pets: this.state.pets.map((q) => ({ c: q.coat, st: q.stg, b: Math.floor(q.bond), sn: q.sn.join('/') })), pg: this.state.pg, tro: this.state.tro, idle: this.idle && this.idle.cur, hint: !!this.hint, frenzy: this.frenzy, loadPct: this.loadPct, lang, H: this.H, ph: p && this.R ? { x: +this.panelTop } : null, sat: this.state.pets.map((q) => Math.round(q.sat)), meal: this.state.meal, care: this.state.care, fd: { fh: this.fh, fl: this.flying, ch: !!this.ffChew, pat: !!this.ffPat, t: +(this.t||0).toFixed(2), man: this.face && this.face.manual, tm: this.face && this.face.timed }, eat: !!this.eat }; },
      reset: () => { this.resetAll(); },
      // 测试入口：点标题屏的「开始玩」（canvas 画的，坐标算起来脆，直接调方法更稳）
      start: () => { this.startPlay(); return this.mode; },
      // 切底栏 tab（0 升级 / 1 图鉴 / 2 衣橱 / 3 转生 / 4 任务）
      tab: (i) => { this.setTab(i); return this.tab; },
      // 当前尺寸（断言「canvas == 容器」时要用）
      size: () => ({ W: this.scale.width, H: this.scale.height, vw: VIEW ? VIEW.w : window.innerWidth, vh: VIEW ? VIEW.h : window.innerHeight }),
      // 存档诊断：卸载时到底写没写、被什么挡住
      save: () => {
        let rows = -1, err = null;
        try { this.saveNow(); rows = window.gp?.player?.saves?.list(10)?.length ?? -1; } catch (e) { err = String(e); }
        return { mode: this.mode, canSave: this.canSave, dirty: this.dirty, rows, err, hasGp: !!window.gp };
      },
      setSeed: (v) => {
        if (v <= -2e6) { this.fitSheet(-v - 2e6); return; }
        if (v <= -1e6) { /* 试衣间: n = ((((coat*2+front)*14+h)*14+t)*14+n)*14+tail, 各槽 id+1(0=无) */
          let n = -v - 1e6; const sl = []; for (let i = 0; i < 4; i++) { sl.unshift((n % 16) - 1); n = Math.floor(n / 16); }
          const front = n % 2 === 1, coat = Math.floor(n / 2);
          const defs = this.assetDefs().filter(([k]) => k.startsWith('cc' + coat + '_') || k.startsWith('fc' + coat + '_') || /^(cs|cx|wf|top|wing)/.test(k) || k === 'pw' + coat || k === 'ps' + coat);
          this.fit = { front }; this.ff.next = 9999; this.ff.blinkT = 9999; this.ff.act = null; this.ff.react = null; this.lastTouch = this.t + 99999;
          this.idleCancel(); this.idle.gap = 99999; this.face.turn = null; this.face.front = front; this.face.manual = true; this.face.until = this.t + 99999; this.face.nextT = 9999;
          this.runLoad(defs).then(() => {
            const m = this.pet(); m.coat = coat; m.worn = sl.slice(); sl.forEach((id) => { if (id >= 0) this.state.own[id] = 1; });
            this.setRigCoat(this.R, coat); if (this.F) this.setFrontCoat(this.F, coat); this.wearKey = ''; this.applyWear(true);
          });
          return;
        }
        if (v <= -10 && v > -30) { const id = -10 - v, m = this.pet(); this.state.own[id] = 1; m.worn[WEAR[id].slot] = id; this.face.front = true; this.face.turn = null; this.face.manual = true; this.face.until = this.t + 999; this.ff.act = null; this.ff.next = 99; this.applyWear(true); return; }
        if (v <= -60 && v > -80) { const id = -60 - v, m = this.pet(); this.state.own[id] = 1; m.worn[WEAR[id].slot] = id; this.face.front = false; this.face.turn = null; this.face.manual = true; this.face.nextT = 9999; this.face.until = this.t + 999; this.applyWear(true); return; }
        if (v <= -100 && v >= -200) { const n = -100 - v; this.pets().forEach((q) => { q.sat = n; }); return; }
        if (v === -201) { this.gain(1e7); return; }
        if (v <= -520 && v >= -599) { globalThis.__freezeTurn = (-500 - v) / 100; return; }
        if (v === -500) { globalThis.__freezeCatch = 1; return; }
        if (v <= -400 && v >= -499) { globalThis.__slow = (-400 - v) / 100 || 1; return; }
        if (v === -202) { this.offlineGain = 1234; this.offlineSec = 7200; this.showOffline(); return; }
        if (v <= -700 && v >= -799) { this.applyOffline((-700 - v) * 3600); if (this.offlineGain > 0) this.showOffline(); return; } // 模拟离开 n 小时
        if (v <= -210 && v >= -213) { this.fakeMeal = -210 - v === 3 ? -1 : -210 - v; this.state.meal.got = [0, 0, 0]; return; }
        if (v <= -300 && v >= -340) { const c = this.state.care; c.last = localDay(new Date(Date.now() - 864e5)); c.streak = -300 - v; return; }
        if (v === -90) { const m = this.pet(); m.worn = m.worn.map(() => -1); this.applyWear(true); return; }
        if (v <= -40 && v > -50) { const a = ['wink', 'tilt', 'tongue', 'wave', 'jump', 'blink'][-40 - v]; if (a === 'blink') { this.ff.blink = 5; return; } this.ff.act = a; this.ff.u = 0.5; this.ff.dur = 99; return; }
        if (v === -30) { this.face.nextT = Math.min(this.face.nextT, 25); return; }
        if (v === -1) { this.startFrenzy(); return; }
        if (v === -2) { this.lastTouch -= 20; return; }
        if (v === -3) { this.state.run += this.pgNeed(); return; }
        if (v === -4) { [3, 4, 5, 6].forEach((c) => this.grantRare(c)); return; }
        if (v === -5) { this.pet().sn[0] += 120; this.sizeTarget = this.sizeFor(this.pet()); this.shownStage = this.stageOf(this.pet()); return; }
        if (v === -6) { this.pet().bond += 500; this.addBond(this.pet(), 0); return; }
        if (v === -7) { this.showPgResult(1); return; }
        this.state.hearts += v; this.state.total += v; this.state.run += v;
      },
      step: (ms) => { for (let t = 0; t < ms; t += 50) this.update(0, 50); },
    };
  }

  /* ======== 正面柯基（2D 分层）======== */
  makeFront(coat, pre = 'fc') {
    const OX = 317, OY = 623;
    const rig = this.add.container(0, 0);
    const F = { rig, ims: {}, coat, pre, wear: [] };
    const mk = (px, py, par) => { const c = this.add.container(px - (par ? par.px : OX), py - (par ? par.py : OY)); c.px = px; c.py = py; return c; };
    const put = (c, key) => { const l = FLAY[key]; const im = this.add.image(l.x - c.px, l.y - c.py, `${pre}${coat}_${key}`).setOrigin(0, 0); c.add(im); F.ims[key] = im; return im; };
    F.bodyC = mk(317, 540); put(F.bodyC, 'bodyH'); put(F.bodyC, 'body');
    F.headC = mk(317, 440); for (const k of ['head', 'headH', 'headW', 'headB', 'headT', 'headTH']) put(F.headC, k);
    F.earLC = mk(167, 205, F.headC); put(F.earLC, 'earL'); F.headC.add(F.earLC);
    F.earRC = mk(467, 205, F.headC); put(F.earRC, 'earR'); F.headC.add(F.earRC);
    F.headAcc = this.add.container(0, 0); F.headC.add(F.headAcc);
    F.neckC = this.add.container(-OX, -OY);
    F.pawLC = mk(262, 520); put(F.pawLC, 'pawL');
    F.pawRC = mk(372, 520); put(F.pawRC, 'pawR');
    rig.add([F.bodyC, F.headC, F.neckC, F.pawLC, F.pawRC]);
    return F;
  }
  setFrontCoat(F, coat) {
    if (!this.textures.exists(`${F.pre}${coat}_body`)) return;
    F.coat = coat;
    for (const k in F.ims) F.ims[k].setTexture(`${F.pre}${coat}_${k}`);
  }
  poseFront(F, o) {
    F.headC.rotation = o.hr; F.headC.y = 440 - 623 + (o.hhy || 0); F.headC.scaleX = 1 + (o.hsx || 0); F.headC.scaleY = 1 - (o.hsx || 0) * 0.5;
    const eL = o.eL > 0.5, eR = o.eR > 0.5, bl = o.bl > 0, tg = o.tg || 0;
    // 整头表情切换:同一底图烘焙的变体,像素对齐
    const hk = tg > 0.4 ? (eL && eR ? 'headTH' : 'headT') : (eL && eR ? 'headH' : eR ? 'headW' : bl ? 'headB' : 'head');
    for (const k of ['head', 'headH', 'headW', 'headB', 'headT', 'headTH']) F.ims[k].setVisible(k === hk);
    o.pwL = o.pwR = { r: 0, x: 0, y: 0 }; const moved = 0; // 前爪始终保持原位
    const sh = !!moved || !!F.clothes;
    F.ims.body.setVisible(!sh); F.ims.bodyH.setVisible(sh);
    F.pawLC.setVisible(sh); F.pawRC.setVisible(sh);
    F.earLC.rotation = o.earL || 0; F.earRC.rotation = o.earR || 0;
    F.pawLC.rotation = o.pwL.r; F.pawLC.x = 262 - 317 + o.pwL.x; F.pawLC.y = 520 - 623 + o.pwL.y;
    F.pawRC.rotation = o.pwR.r; F.pawRC.x = 372 - 317 + o.pwR.x; F.pawRC.y = 520 - 623 + o.pwR.y;
  }
  frontBase() { return { hr: 0, hhy: 0, hy: 0, eL: 0, eR: 0, bl: 0, tg: 0, earL: 0, earR: 0, pwL: { r: 0, x: 0, y: 0 }, pwR: { r: 0, x: 0, y: 0 } }; }
  frontAct() {
    const f = this.ff, acts = ['wink', 'tilt', 'tongue', 'wave', 'jump'];
    let a; do { a = acts[(Math.random() * acts.length) | 0]; } while (a === f.last);
    f.last = a; f.act = a; f.u = 0; f.dur = { wink: 1.0, tilt: 1.7, tongue: 1.6, wave: 2.0, jump: 1.2 }[a];
  }
  frontFx(dt) {
    const f = this.ff, o = this.frontBase();
    f.blinkT -= dt; if (f.blinkT <= 0) { f.blink = 0.14; f.blinkT = rnd(2.2, 4.4); }
    if (f.blink > 0) { f.blink -= dt; o.bl = 1; }
    const live = this.face.front && !this.face.turn;
    if (live && !f.react && !this.eat) {
      if (f.act) { f.u += dt; if (f.u >= f.dur) { f.act = null; f.next = rnd(1.0, 2.2); } }
      else { f.next -= dt; if (f.next <= 0) this.frontAct(); }
    }
    const T = this.t, u = f.u, d = f.dur, E = f.act ? clamp(Math.min(u / 0.2, (d - u) / 0.25), 0, 1) : 0;
    o.earL = Math.sin(T * 1.7) * 0.012; o.earR = Math.sin(T * 1.7 + 2) * 0.012;
    switch (f.act) {
      case 'wink': o.eR = E > 0.3 ? 1 : 0; o.hr = 0.07 * E; o.earR = -0.1 * E; break;
      case 'tilt': o.hr = 0.17 * E + Math.sin(u * 6) * 0.012 * E; o.earL = Math.sin(u * 9) * 0.07 * E; o.earR = -0.05 * E; break;
      case 'tongue': o.tg = E; o.eL = o.eR = E > 0.35 ? 1 : 0; o.hhy = -Math.abs(Math.sin(u * 8)) * 5 * E; break;
      case 'wave': o.eL = o.eR = 1; o.tg = E; o.rot = Math.sin(u * 7) * 0.05 * E; o.hr = -Math.sin(u * 7) * 0.06 * E; o.earL = Math.sin(u * 9) * 0.05 * E; o.earR = -o.earL; break;
      case 'jump': { const h = Math.abs(Math.sin(u * Math.PI / 0.6)); o.hy = -h * 55 * E; o.eL = o.eR = 1; o.tg = E; o.earL = -0.12 * h; o.earR = 0.12 * h; break; }
    }
    const r = f.react;
    if (r) {
      r.u += dt; const k = r.u / r.dur;
      if (k >= 1) f.react = null;
      else { const e = clamp(Math.min(r.u / 0.08, (r.dur - r.u) / 0.3), 0, 1); o.eL = o.eR = 1; o.tg = r.u > 0.12 ? e : 0; o.hy = -Math.abs(Math.sin(r.u * 11)) * 14 * e; o.hr = Math.sin(r.u * 15) * 0.035 * e; o.earL = Math.sin(r.u * 30) * 0.06 * e; o.earR = -o.earL; o.pwL.r = 0.2 * e; o.pwR.r = -0.2 * e; }
    }
    return this.eatPose(this.feedPose(dt, o));
  }
  tapFront(x, y) {
    const m = this.pet(); this.touched();
    const v = this.tapVal() * 0.3; this.gain(v); this.addBond(m, 0.6); this.addProg(0);
    this.ff.react = { u: 0, dur: 1.3 }; this.ff.act = null;
    if (this.face.timed) this.face.until = Math.max(this.face.until, this.t + 3);
    this.spr.u.v += 8; this.spr.pop.v += 6;
    for (let i = 0; i < 4; i++) this.spawnHeart(x + rnd(-30, 30), y - 20, 0.8, 0.9);
    this.floatText(x + rnd(-20, 20), y - 50, '+' + fmt(v, true), 30);
    sfx('duang', { pitchSemitones: 7 + rnd(0, 2) }); this.markDirty();
  }
  startTurn(to) {
    this.face.turn = { t: 0, dur: 0.8, to, sw: 0 }; this.turnN = (this.turnN || 0) + 1;
    sfx('buy', { pitchSemitones: to ? 5 : 2 });
  }
  manualTurn() {
    const f = this.face; if (f.turn || this.eat || this.fh) return;
    if (this.tab === 2) { this.ff.next = 0; this.ff.act = null; this.frontAct(); return; }
    if (f.front) { f.timed = false; f.manual = true; f.until = 0; } else { f.manual = true; f.until = this.t + 9; f.timed = false; }
  }
  wardrobeFace(on) {
    if (on && this.face.front && !this.face.turn) { this.ff.act = null; this.ff.next = 0; }
    if (!on) this.face.nextT = rnd(60, 120);
  }
  faceUpdate(dt) {
    const f = this.face; if (f.turn || this.fit) return;
    if (this.fh) { // 投食中：保持正面，吃完约 1 秒再转回
      const fd = this.fh;
      if ((this.flying || 0) > 0 || this.t < fd.until || this.ffChew || this.ffPat || this.eat) { if (!f.front) this.startTurn(true); return; }
      this.fh = null;
      if (fd.back && !(this.tab === 2 && this.mode === 'play')) { f.manual = false; f.timed = false; f.nextT = rnd(60, 120); this.fbDuang = 1; this.lastFeedN = fd.puff || 1; this.startTurn(false); }
      return;
    }
    const quiet = this.modal || this.sw || this.down || this.mode !== 'play';
    let want = f.front;
    if (this.tab === 2 && this.mode === 'play') want = true;
    else if (f.manual) { want = this.t < f.until; if (!want) { f.manual = false; f.nextT = rnd(60, 120); } }
    else if (f.timed) { want = this.t < f.until; if (!want) { f.timed = false; f.nextT = rnd(60, 120); } }
    else {
      want = false;
      if (!quiet && this.t - (f.lastEnd || -99) > 30) { f.nextT -= dt; if (f.nextT <= 0) { f.timed = true; f.until = this.t + rnd(4.5, 6.5); want = true; } }
    }
    if (want !== f.front) this.startTurn(want);
  }
  renderFront(dt, px, py, ssm, g, u, pop) {
    const f = this.face, F = this.F, rig = this.rig, fr = this.frig;
    if (!F) return;
    { const s0 = ssm * 0.8 * (1 + g * 0.1); this.mouthEst = { x: px + 2 * s0, y: py - 300 * s0 }; }
    if (F.coat !== this.R.coat) this.setFrontCoat(F, this.R.coat);
    let showFront = f.front, ax = 1, hop = 0, aB = 1, aF = 1, tilt = 0, both = false;
    if (f.turn) { // 真转身：小跳到最高点时交叉淡入淡出 + 轻压缩/身体微转，不再压成一条线
      const tn = f.turn; tn.t += dt; const k = Math.min(1, tn.t / tn.dur);
      hop = Math.sin(Math.PI * Math.min(1, k * 1.1)) * 110 * this.mainScale();
      const m = clamp((k - 0.36) / 0.28, 0, 1), mix = m * m * (3 - 2 * m); // 0=旧朝向 1=新朝向
      const toF = tn.to ? mix : 1 - mix; both = mix > 0 && mix < 1;
      const aIn = Math.min(1, mix * 2), aOut = Math.min(1, (1 - mix) * 2); aF = tn.to ? aIn : aOut; aB = tn.to ? aOut : aIn;
      const dz = this.mgy * 0.5; (tn.to ? fr : rig).setDepth(dz + 0.1); (tn.to ? rig : fr).setDepth(dz);
      showFront = toF >= 0.5; ax = 1 - 0.1 * Math.sin(Math.PI * k);
      tilt = Math.sin(Math.PI * k) * 0.09 * (tn.to ? 1 : -1);
      if (globalThis.__freezeTurn && k >= globalThis.__freezeTurn && globalThis.__MAKEPLAY_PLAYTEST__) { globalThis.__slow = 0.0005; globalThis.__freezeTurn = 0; }
      if (k >= 1) { f.turn = null; f.front = tn.to; f.lastEnd = this.t; this.spr.pop.v += 10; this.spr.u.v += 10; ax = 1; hop = 0; tilt = 0; aB = aF = 1; both = false; showFront = f.front; if (f.front) { this.ff.next = 0.5; this.ff.act = null; } else if (this.fbDuang) { this.fbDuang = 0; this.later(60, () => this.backDuang()); } }
    }
    rig.setVisible(both || !showFront); fr.setVisible(both || showFront);
    rig.setAlpha(both ? aB : 1); fr.setAlpha(both ? aF : 1);
    if (f.turn || f.front) { rig.scaleX *= ax; rig.y = py - hop; rig.rotation = f.turn ? tilt : rig.rotation; }
    if (showFront || both) {
      const o = this.frontFx(dt), bs = 0.8 * (1 + g * 0.1);
      const sy = 1 - 0.06 * u + 0.02 * pop - 0.02 * (hop > 0 ? 1 : 0) + Math.sin(this.t * 2.1) * 0.006;
      const hg = this.eat ? 0 : (this.hg || 0);
      fr.setScale(ssm * bs * (1 + 0.05 * u + 0.04 * hg) * ax, ssm * bs * sy * (1 - 0.07 * hg));
      fr.setPosition(px, py - hop + o.hy * ssm); fr.rotation = (o.rot || 0) + tilt;
      this.poseFront(F, o);
    }
  }
  /* 正面穿搭 */
  applyWearFront(w) {
    const F = this.F; if (!F) return;
    F.wear.forEach((o) => o.destroy()); F.wear = []; F.clothes = false;
    const pants = [], tops = [], neck = [], head = [];
    w.forEach((id) => {
      if (id < 0) return; const sp = FWEAR[id]; if (!sp || sp.l === 'hide') return;
      if (sp.l === 'head') {
        const key = WEAR[id].ic; if (!this.textures.exists(key)) return;
        const im = this.add.image(sp.x - F.headC.px, sp.y - F.headC.py, key).setRotation(sp.r || 0); im.setScale(sp.w / im.width); F.wear.push(im); head.push(im); return;
      }
      if (sp.l === 'wing') { // 天使翅膀:正面只在肩后露出翅膀尖(画在身体图之后)
        if (!this.textures.exists('wing')) return;
        [[-1, 150], [1, 470]].forEach(([d, bx]) => {
          const im = this.add.image(bx - F.bodyC.px, 408 - F.bodyC.py, 'wing').setOrigin(0.08, 0.9);
          im.setScale(0.27 * (d > 0 ? 1 : -1), 0.27); im.setRotation(d * 0.05); F.bodyC.add(im); F.bodyC.sendToBack(im); F.wear.push(im);
          this.tweens.add({ targets: im, rotation: d * 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        return;
      }
      const key = 'wf' + id; if (!this.textures.exists(key)) return;
      const im = this.add.image(sp.x - F.bodyC.px, sp.y - F.bodyC.py, key).setOrigin(0, 0); F.wear.push(im);
      (sp.l === 'pants' ? pants : sp.l === 'body' ? tops : neck).push(im);
      if (sp.l !== 'neck') F.clothes = true;
    });
    // 层级:身体底 → 裤子 → 上衣 → 颈饰(都在身体层内,随身体动) → 头 → 头饰(随头转) ;前爪最上
    [...pants, ...tops, ...neck].forEach((im) => F.bodyC.add(im));
    head.forEach((im) => F.headAcc.add(im));
    F.ims.body.setVisible(!F.clothes); F.ims.bodyH.setVisible(F.clothes);
    F.pawLC.setVisible(F.clothes); F.pawRC.setVisible(F.clothes);
  }

  /* ======== 标题 / 加载页 ======== */
  /* 标题字体：圆体（粉圆，含中日）+ Luckiest Guy（英文副标），手动 FontFace 供 canvas 使用 */
  loadTitleFonts() {
    if (this.ttlFontP) return;
    const F = [['TtlRound', 'open-huninn/OpenHuninn.woff2'], ['TtlPop', 'google-fonts-apache/luckiest-guy/LuckiestGuy-Regular.ttf']];
    this.ttlFontP = Promise.all(F.map(([fam, id]) => {
      let u = null; try { u = window.gp?.fonts?.url(id); } catch (e) { /* */ }
      if (!u || typeof FontFace === 'undefined') return null;
      return new FontFace(fam, `url(${u})`).load().then((f) => { document.fonts.add(f); }).catch(() => {});
    })).then(() => { this.ttlFontsOk = true; this.updateTitleTex(); });
  }
  updateTitleTex() {
    if (!this.titleImg || !this.titleImg.scene) return;
    const T = this.ttlS, dpr = 2, por = T.por;
    const SC = por ? 1 : Math.min(1.4, Math.max(1, this.H / 900));
    const TW = por ? Math.min(W, 720) - 40 : Math.min(W - 160, 1100);
    const MF = `"TtlRound", ${FONT}`, SF = `"TtlPop", "TtlRound", ${FONT}`;
    const main = tr('titleB'), sub = tr('titleA');
    const meas = document.createElement('canvas').getContext('2d');
    const fit = (txt, fs, font, maxW, wt) => { meas.font = `${wt} ${fs}px ${font}`; const w = meas.measureText(txt).width; return Math.min(fs, fs * maxW / Math.max(1, w)); };
    // 主标题
    const fs = fit(main, 168 * SC, MF, TW - 60, 'bold');
    const DEP = Math.round(fs * 0.085), OUT = fs * 0.2;
    meas.font = `bold ${fs}px ${MF}`;
    const mw = Math.ceil(meas.measureText(main).width + OUT * 2 + 40), mh = Math.ceil(fs * 1.25 + DEP + OUT * 2);
    const key = 'ttl' + (this.ttlN = (this.ttlN || 0) + 1);
    const cv = this.textures.createCanvas(key, Math.round(mw * dpr), Math.round(mh * dpr));
    const x = cv.getContext(); x.scale(dpr, dpr);
    const cx = mw / 2, cy = OUT + fs * 0.62;
    x.font = `bold ${fs}px ${MF}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineCap = 'round';
    this.titleGlyph(x, main, cx, cy, fs, DEP, OUT, { face: ['#e3337a', '#c2185b', '#a3134c'], ext: '#2b1f5c', rim: '#fff8ec', hi: true });
    cv.refresh();
    const old = this.titleKey;
    this.titleImg.setTexture(key); this.titleImg.setScale(1 / dpr); this.titleKey = key; this.titleImg.th = mh;
    if (old && this.textures.exists(old)) this.textures.remove(old);
    // 副标题：逐字母贴图，依次弹跳
    if (this.ttlSub) { this.ttlSub.list.slice().forEach((im) => { const k = im.texture && im.texture.key; im.destroy(); if (k && k.startsWith('tsl') && this.textures.exists(k)) this.textures.remove(k); }); this.ttlSub.removeAll(true); }
    const sfs = fit(sub, 74 * SC, SF, Math.min(TW - 80, mw * 0.9), 'normal');
    const SD = Math.round(sfs * 0.09), SO = sfs * 0.2;
    meas.font = `${sfs}px ${SF}`;
    const chars = [...sub], widths = chars.map((c) => meas.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) + (chars.length - 1) * sfs * 0.07;
    let px = -total / 2; this.ttlLetters = [];
    chars.forEach((c, i) => {
      const w = widths[i];
      if (c.trim()) {
        const lw = Math.ceil(w + SO * 2 + 12), lh = Math.ceil(sfs * 1.3 + SD + SO * 2), k2 = `tsl${this.ttlN}_${i}`;
        const lc = this.textures.createCanvas(k2, Math.round(lw * dpr), Math.round(lh * dpr)); const g = lc.getContext(); g.scale(dpr, dpr);
        g.font = `${sfs}px ${SF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        this.titleGlyph(g, c, lw / 2, SO + sfs * 0.62, sfs, SD, SO, { face: ['#fffaf0', '#fff4d6', '#ffe6a8'], ext: '#2b1f5c', rim: '#c2185b' });
        lc.refresh();
        const im = this.add.image(px + w / 2, 0, k2).setScale(1 / dpr).setOrigin(0.5, 0.62); im.bx = im.x; im.i = this.ttlLetters.length;
        this.ttlSub.add(im); this.ttlLetters.push(im);
      }
      px += w + sfs * 0.07;
    });
    this.ttlSubH = sfs * 1.1;
    this.layoutTitle();
  }
  titleGlyph(x, t, cx, cy, fs, DEP, OUT, o) {
    // 1 柔和投影（深色，不是白雾）
    x.save(); x.shadowColor = 'rgba(43,31,92,.35)'; x.shadowBlur = fs * 0.12; x.shadowOffsetY = DEP + fs * 0.05;
    x.strokeStyle = o.ext; x.lineWidth = OUT * 2; x.strokeText(t, cx, cy + DEP); x.restore();
    // 2 3D 厚度：深藏青挤出
    x.strokeStyle = o.ext; x.fillStyle = o.ext; x.lineWidth = OUT * 2;
    for (let d = DEP; d >= 1; d--) { x.strokeText(t, cx, cy + d); }
    // 3 奶白粗描边
    x.strokeStyle = o.rim; x.lineWidth = OUT * 2; x.strokeText(t, cx, cy);
    // 4 字面：浓莓果色实心（轻微上亮下暗）
    x.strokeStyle = o.face[2]; x.lineWidth = fs * 0.035; x.strokeText(t, cx, cy + fs * 0.03);
    const g = x.createLinearGradient(0, cy - fs * 0.45, 0, cy + fs * 0.45); g.addColorStop(0, o.face[0]); g.addColorStop(0.55, o.face[1]); g.addColorStop(1, o.face[2]);
    x.fillStyle = g; x.fillText(t, cx, cy);
    if (o.hi) { // 小块高光（只在字形内的上缘，不形成白雾）
      x.save(); x.globalCompositeOperation = 'source-atop';
      const h = x.createLinearGradient(0, cy - fs * 0.5, 0, cy - fs * 0.1); h.addColorStop(0, 'rgba(255,255,255,.32)'); h.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = h; x.fillRect(cx - fs * 4, cy - fs * 0.5, fs * 8, fs * 0.4); x.restore();
    }
  }
  layoutTitle() {
    const T = this.ttlS; if (!T || !this.titleImg) return;
    const H = this.H, por = T.por, mh = this.titleImg.th || 200;
    T.ty = H * (por ? 0.085 : 0.07) + (this.ttlSubH || 80) + mh * 0.42;
    T.sy = T.ty - mh * 0.5 + 8;
  }
  buildTitle(phase) {
    const H = this.H, por = W < H;
    this.ttlTexts = []; this.ttlRefresh = [];
    const c = this.add.container(0, 0).setDepth(5000); this.ttl = c;
    const T = this.ttlS = { phase, t: 0, por, hearts: [], hp: 0, lit: 0, ready: false, bump: 0, hT: 0 };
    c.add(this.add.zone(W / 2, H / 2, W, H).setInteractive());
    const bg = this.add.image(W / 2, H / 2, 'bgT'); bg.setScale(Math.max(W / bg.width, H / bg.height)); c.add(bg);
    T.clouds = [];
    for (let i = 0; i < 5; i++) { const im = this.add.image(rnd(0, W), H * (0.04 + i * 0.045 + rnd(0, 0.03)), 'cloud').setScale(rnd(0.45, 0.9)).setAlpha(0.92); im.sp = rnd(7, 18); T.clouds.push(im); c.add(im); }
    T.bf = [];
    for (let i = 0; i < 3; i++) { const im = this.add.image(0, 0, 'mi5').setScale(0.2); im.cx = W * (0.2 + i * 0.3); im.cy = H * (0.33 + (i % 2) * 0.1 + i * 0.03); im.ph = i * 2.1; im.sx = 0.2 - i * 0.025; T.bf.push(im); c.add(im); }
    T.gy = H * (por ? 0.665 : 0.72);
    T.k = Math.min(0.7, H * 0.3 / 560, (por ? W * 0.55 : W * 0.4) / 470);
    T.sh = this.add.image(W / 2, T.gy + 4, 'shadow'); c.add(T.sh);
    T.F = this.makeFront(0, 'fc'); c.add(T.F.rig);
    T.petals = [];
    for (let i = 0; i < 16; i++) { const im = this.add.image(rnd(0, W), rnd(0, H), 'petal').setScale(rnd(0.5, 0.9)).setAlpha(0.85); im.vy = rnd(30, 70); im.ph = rnd(0, 6); im.rs = rnd(-1.5, 1.5); T.petals.push(im); c.add(im); }
    this.titleImg = this.add.image(W / 2, H * (por ? 0.155 : 0.17), 'cloud').setOrigin(0.5, 0.5); c.add(this.titleImg);
    this.ttlSub = this.add.container(W / 2, 0); c.add(this.ttlSub);
    this.updateTitleTex(); this.loadTitleFonts();
    // 肉垫进度条
    const pg = this.add.container(0, 0); c.add(pg); T.prog = pg;
    T.py = H * (por ? 0.795 : 0.815);
    T.paws = [];
    const n = 10, gap = por ? 58 : 60, x0 = W / 2 - gap * (n - 1) / 2;
    for (let i = 0; i < n; i++) { const im = this.add.image(x0 + i * gap, T.py + (i % 2 ? 12 : -12), 'paw').setScale(0.66).setTint(0xcdb9e6).setAlpha(0.7); im.lit = false; im.bx = im.x; T.paws.push(im); pg.add(im); }
    T.pct = this.txt(W / 2, T.py + 62, () => `${tr('loading')} ${T.lastPc ?? 0}%`, 28, '#ffffff', { stroke: '#7a4a9a', sw: 7, title: true });
    pg.add(T.pct);
    // 开始按钮组
    const st = this.add.container(0, 0).setAlpha(0).setVisible(false); c.add(st); T.start = st;
    T.btn = this.btn(W / 2, T.py + 6, 330, 92, BERRY, () => tr('start'), () => this.startPlay(), { size: 42, title: true });
    st.add(T.btn);
    T.tip = this.txt(W / 2, T.py + 74, () => tr('tapStart'), 27, '#ffffff', { fit: Math.min(W, 720) - 60, stroke: '#7a4a9a', sw: 7, title: true }); st.add(T.tip);
    this.langBtns(c, H * (por ? 0.925 : 0.935), W, true);
    this.loadShown = this.loadShown || 0; this.loadPct = this.loadPct || 0;
    if (phase === 'ready') this.titleReady(true);
  }
  titleReady(instant) {
    const T = this.ttlS; if (!T) return; T.ready = true; T.phase = 'ready';
    T.start.setVisible(true);
    if (instant) { T.start.setAlpha(1); T.prog.setVisible(false); }
    else { this.tweens.add({ targets: T.prog, alpha: 0, duration: 260, onComplete: () => T.prog.setVisible(false) }); this.tweens.add({ targets: T.start, alpha: 1, duration: 360, delay: 180 }); }
    T.cheer = 2.2;
    for (let i = 0; i < 14; i++) this.later(i * 60, () => this.titleHeart(rnd(-150, 150)));
  }
  titleHeart(dx) {
    const T = this.ttlS; if (!T || !this.ttl || !this.ttl.scene) return;
    const h = this.add.image(W / 2 + dx, T.gy - 140 * T.k * 2, 'hp').setScale(0.12).setTint(0xf06c9b); this.ttl.add(h);
    T.hearts.push({ im: h, vx: rnd(-20, 20), vy: rnd(-150, -90), life: 0, max: rnd(0.9, 1.4), s: rnd(0.28, 0.5) });
  }
  startPlay() {
    if (this.mode !== 'title') return;
    unlockAudio(); sfx('gold');
    this.mode = 'play'; this.lastTouch = this.t; this.updateHUD(true);
    const c = this.ttl, T = this.ttlS;
    this.tweens.add({ targets: c, alpha: 0, duration: 380, onComplete: () => { c.destroy(true); if (this.ttl === c) { this.ttl = null; this.ttlS = null; this.titleImg = null; } } });
    if (this.offlineGain > 0) this.later(450, () => this.showOffline());
    this.face.nextT = rnd(30, 60);
  }
  updateLoading(dt) { this.updateTitleFx(dt); }
  updateTitleFx(dt) {
    const T = this.ttlS; if (!T || !this.ttl || !this.ttl.scene) return;
    T.t += dt; const t = T.t, H = this.H;
    this.loadShown += (this.loadPct - this.loadShown) * Math.min(1, dt * 10); if (Math.abs(this.loadPct - this.loadShown) < 0.004) this.loadShown = this.loadPct;
    T.clouds.forEach((im) => { im.x += im.sp * dt; if (im.x > W + 180) im.x = -180; });
    T.bf.forEach((im) => {
      const p = im.ph + t;
      im.x = im.cx + Math.sin(p * 0.6) * 150 + Math.sin(p * 1.9) * 20; im.y = im.cy + Math.sin(p * 1.1) * 50 + Math.sin(p * 3.1) * 10;
      im.scaleX = im.sx * (0.3 + 0.7 * Math.abs(Math.sin(t * 13 + im.ph))); im.scaleY = im.sx; im.rotation = Math.cos(p * 0.6) * 0.3;
    });
    T.petals.forEach((im) => { im.y += im.vy * dt; im.x += (Math.sin(t * 0.9 + im.ph) * 26 + 8) * dt; im.rotation += im.rs * dt; im.scaleX = Math.abs(Math.cos(t * 1.4 + im.ph)) * 0.7 + 0.3; if (im.y > H + 30) { im.y = -30; im.x = rnd(0, W); } if (im.x > W + 30) im.x = -30; });
    // 标题呼吸
    const br = Math.sin(t * 2.3);
    this.titleImg.setScale(0.5 * (1 - 0.01 * br), 0.5 * (1 + 0.018 * br)); this.titleImg.rotation = Math.sin(t * 1.1) * 0.008;
    this.titleImg.y = T.ty + Math.sin(t * 2.3 - 0.6) * 3;
    // 副标题字母依次 Duang 起
    this.ttlSub.y = T.sy;
    const L = this.ttlLetters || [], per = 1.9;
    L.forEach((im) => {
      const k = ((t - im.i * 0.11) % per + per) % per, up = k < 0.42 ? Math.sin(k / 0.42 * Math.PI) : 0, land = k >= 0.42 && k < 0.56 ? Math.sin((k - 0.42) / 0.14 * Math.PI) : 0;
      im.y = -up * 22; im.setScale(0.5 * (1 - 0.06 * up + 0.12 * land), 0.5 * (1 + 0.1 * up - 0.14 * land)); im.rotation = Math.sin(t * 2 + im.i) * 0.04;
    });
    // 柯基弹跳
    const P = T.ready ? 1.1 : 1.3, ph = (t % P) / P, hop = 4 * ph * (1 - ph);
    const sqn = Math.max(0, 1 - Math.min(ph, 1 - ph) / 0.1), grow = 0.7 + 0.3 * (T.ready ? 1 : this.loadShown);
    const k = T.k * grow;
    const sx = 1 + 0.12 * sqn - 0.05 * hop, sy = 1 - 0.14 * sqn + 0.06 * hop;
    T.F.rig.setPosition(W / 2, T.gy - hop * 70 * T.k * 1.6).setScale(k * sx, k * sy);
    const o = this.frontBase();
    o.earL = -0.14 * hop + 0.05 * sqn; o.earR = 0.14 * hop - 0.05 * sqn;
    o.hr = Math.sin(t * 2.4) * 0.025; o.hhy = 5 * sqn;
    const bl = (t % 3.2) > 3.05; o.bl = bl ? 1 : 0;
    if (T.ready) { o.eL = o.eR = hop > 0.35 ? 1 : 0; o.tg = hop > 0.35 ? 1 : 0; o.hr += Math.sin(t * 5) * 0.04; }
    else { o.eL = o.eR = (ph > 0.3 && ph < 0.7) ? 1 : 0; }
    this.poseFront(T.F, o);
    T.sh.setPosition(W / 2, T.gy + 6).setDisplaySize(470 * k * (1 - 0.35 * hop) * (1 + 0.1 * sqn), 120 * k * (1 - 0.3 * hop)).setAlpha(0.85 - 0.3 * hop);
    // 肉垫进度
    // 文字百分比与肉垫共用同一个真实进度（loader 已完成文件数/总数）
    const pc = T.ready ? 100 : Math.min(100, Math.floor(this.loadShown * 100 + 0.5));
    if (pc !== T.lastPc) { T.lastPc = pc; T.pct.setText(`${tr('loading')} ${pc}%`); }
    const lit = Math.floor(pc * T.paws.length / 100);
    T.paws.forEach((p, i) => {
      if (i < lit && !p.lit) { p.lit = true; p.setTint(0xf06c9b).setAlpha(1); this.tweens.add({ targets: p, scale: { from: 1.0, to: 0.74 }, duration: 300, ease: 'Back.Out' }); T.bump = 1; }
      if (!p.lit) p.setScale(0.66 + Math.sin(t * 5 + i) * 0.02);
      else if (i === lit - 1) p.rotation = Math.sin(t * 8) * 0.12; else p.rotation = 0;
    });
    T.hT -= dt;
    if (T.hT <= 0 && !T.ready) { T.hT = 0.28; const lp = T.paws[Math.max(0, lit - 1)]; const h = this.add.image(lp.x + rnd(-10, 10), lp.y - 26, 'hp').setScale(0.1).setTint(0xf06c9b); this.ttl.add(h); T.hearts.push({ im: h, vx: rnd(-14, 14), vy: -80, life: 0, max: 1.1, s: rnd(0.2, 0.34) }); }
    for (let i = T.hearts.length - 1; i >= 0; i--) {
      const h = T.hearts[i]; h.life += dt; const q = h.life / h.max; h.im.x += h.vx * dt; h.im.y += h.vy * dt; h.vy += 120 * dt;
      h.im.setScale(h.s * Math.min(1, h.life * 8)).setAlpha(1 - Math.max(0, q - 0.5) * 2);
      if (q >= 1) { h.im.destroy(); T.hearts.splice(i, 1); }
    }
    if (T.ready) T.btn.setScale(1 + Math.sin(t * 5) * 0.035);
  }

  /* ======== 分阶段加载 ======== */
  assetDefs() {
    const d = [], add = (k, p, tier) => d.push([k, p, tier]);
    for (let c = 0; c < 7; c++) {
      const t = c === 0 ? 0 : 1;
      for (const k of [...PARTS, 'peek']) add(`cc${c}_${k}`, `corgi/c${c}/${k}.webp`, t);
      for (const k of FRONT_PARTS) add(`fc${c}_${k}`, `front/c${c}/${k}.webp`, t);
      add('pw' + c, `pup/pw/${c}.webp`, t); add('ps' + c, `pup/ps/${c}.webp`, t);
    }
    SCENE_BG.forEach((n, i) => add('bg' + i, n + '.jpg', i === 0 ? 0 : 1));
    add('cs1b','costume/1b.webp',0); add('cs2b','costume/2b.webp',0);
    for (let i = 0; i < 8; i++) { add('sn' + i, `snacks/${i}.webp`, 0); add('mi' + i, `misc/${i}.webp`, 0); add('cs' + i, `costume/${i}.webp`, 0); add('de' + i, `decor/${i}.webp`, 1); }
    add('mi8', 'misc/8.webp', 0); add('sn4e', 'snacks/4e.webp', 0); add('cs8', 'costume/8.webp', 0); add('cs9', 'costume/9.webp', 0);
    for (let i = 4; i < 7; i++) add('cx' + i, `cos2/${i}.webp`, 1);
    for (let i = 8; i < 11; i++) add('wf' + i, `wearf/${i}.webp`, 1);
    add('wing', 'costume/wing.webp', 0);
    return d;
  }
  runLoad(list, onProgress) {
    return new Promise((res) => {
      const L = this.load, todo = list.filter(([k]) => !this.textures.exists(k));
      if (!todo.length) { res(); return; }
      L.setPath(assetUrl('assets/'));
      todo.forEach(([k, p]) => L.image(k, p));
      const pr = (v) => onProgress && onProgress(v);
      L.on('progress', pr);
      L.once('complete', () => { L.off('progress', pr); res(); });
      L.once('loaderror', () => { /* 单个文件失败不阻塞 */ });
      L.start();
    });
  }
  loadCore() {
    const defs = this.assetDefs();
    this.runLoad(defs.filter((x) => x[2] === 0), (v) => { this.loadPct = v * 0.85; }).then(() => this.onCore(defs));
  }
  extraKeys(defs) {
    const s = this.state, need = new Set();
    s.pets.forEach((p) => { ['pw', 'ps'].forEach((a) => need.add(a + p.coat)); defs.forEach(([k]) => { if (k.startsWith(`cc${p.coat}_`) || k.startsWith(`fc${p.coat}_`)) need.add(k); }); p.worn.forEach((id) => { if (id < 0) return; const it = WEAR[id]; need.add(it.ic); if (it.ov) need.add(it.ov); if (it.wing) need.add('wing'); }); });
    need.add('bg' + this.sceneIdx());
    s.de.forEach((v, i) => { if (v) need.add('de' + i); });
    return defs.filter(([k]) => need.has(k));
  }
  async onCore(defs) {
    // ★ 世代号：这个函数里有三处 await，中间宿主完全可能已经把这一份挂载卸载掉了。
    //   不加守卫的症状是「上一次挂载的 onCore 在场景销毁后继续跑」，走到
    //   `buildAll()` 时对着已销毁的场景 `this.add.add(...)` ⇒
    //   `Cannot read properties of null (reading 'add')` —— 看着像插件崩了，
    //   而且只在「快速切走再回来」时出现。
    const g = ++GEN;
    const stale = () => g !== GEN;
    if (new URLSearchParams(location.search).has('hold')) { this.loadPct = 0.55; return; }
    startSound();
    try { await Promise.race([window.gp?.player?.ready, new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* */ }
    const [st] = await Promise.all([this.bootRead(), Promise.race([loadSettings(), new Promise((r) => setTimeout(r, 3000))])]);
    if (stale()) return;
    if (this.langPicked) settings.lang = lang; else if (settings.lang && settings.lang !== lang) this.setLang(settings.lang, true);
    applyVolumes();
    this.loadSave(st);
    await this.runLoad(this.extraKeys(defs), (v) => { this.loadPct = 0.85 + 0.15 * v; });
    if (stale()) return;
    this.loadPct = 1;
    await new Promise((r) => setTimeout(r, 400));
    if (stale()) return;
    this.buildAll();
    this.mode = 'title';
    this.titleReady();
    window.__gpPlayable = true;
    on(window, 'resize', () => { clearTimeout(this.rt); this.rt = setTimeout(() => { if (!stale()) this.onResize(); }, 200); });
    // 后台懒加载其余资源
    this.later(600, () => {
      if (stale()) return;
      this.runLoad(defs, null).then(() => { if (stale()) return; this.lazyDone = true; try { this.applyWear(true); } catch (e) {} if (this.cardsC) this.renderCards(); if (this.decorSp) this.decorSp.forEach((d, i) => { if (d && this.textures.exists('de' + i)) { d.im.setTexture('de' + i); d.im.setScale(d.dw / d.im.width); } }); });
    });
  }

  /* ======== 饱饱度 / 三餐 / 连续照顾 ======== */
  // 设计：饿了只会降低产出、看起来委屈；不掉级、不离家、不扣亲密
  buildSatHud(hud) {
    const y = this.panelTop - 236;
    // 主柯基饭碗卡（左侧）
    const c = this.add.container(60, y); hud.add(c); this.satC = c;
    const g = this.add.graphics(); this.paper(g, -52, -92, 104, 184, 26, CREAM, { sh: 7, line: 0xd9c9a3 }); c.add(g);
    this.satG = this.add.graphics(); c.add(this.satG);
    this.satBowl = this.add.image(0, -40, 'sn4').setDisplaySize(76, 60); c.add(this.satBowl);
    this.satState = this.txt(0, 12, '', 24, '#2f7a52', { fit: 94 }); c.add(this.satState);
    this.satBtn = this.add.graphics(); c.add(this.satBtn);
    this.satBtnT = this.txt(0, 64, () => tr('feedBtn'), 22, '#ffffff', { fit: 80 }); c.add(this.satBtnT);
    this.mealTag = this.add.container(0, -98); c.add(this.mealTag);
    const tg = this.add.graphics(); this.paper(tg, -58, -18, 116, 36, 18, 0xffd36b, { sh: 4 }); this.mealTag.add(tg);
    this.mealTagT = this.txt(0, -1, '', 19, '#7a3a12', { fit: 106 }); this.mealTag.add(this.mealTagT);
    const z = this.add.zone(0, -6, 108, 212).setInteractive({ useHandCursor: true }); c.add(z);
    z.on('pointerdown', () => { this.pop(c); this.feed(); });
    // 一键全喂（右侧，花园里有柯基时出现）
    const fa = this.add.container(660, y); hud.add(fa); this.feedAllC = fa;
    const g2 = this.add.graphics(); this.paper(g2, -52, -70, 104, 140, 26, 0xfde7ef, { sh: 7, line: 0xe9b8c9 }); fa.add(g2);
    const b1 = this.add.image(-18, -30, 'sn4').setDisplaySize(52, 41), b2 = this.add.image(18, -24, 'sn4').setDisplaySize(52, 41); fa.add([b1, b2]);
    fa.add(this.txt(0, 14, () => tr('feedAll'), 21, NAVY_S, { fit: 94, wrap: 94 }));
    this.feedAllT = this.txt(0, 46, '', 19, '#e0457b', { fit: 94 }); fa.add(this.feedAllT);
    const z2 = this.add.zone(0, 0, 108, 144).setInteractive({ useHandCursor: true }); fa.add(z2);
    z2.on('pointerdown', () => { this.pop(fa); this.feedAll(); });
    // 主柯基头顶的饭碗气泡（饿了才出现）
    this.hBub = this.add.container(0, 0).setDepth(1965).setVisible(false);
    const bg = this.add.graphics(); this.paper(bg, -46, -42, 92, 80, 34, 0xffffff, { sh: 4 });
    bg.fillStyle(0xffffff, 1); bg.fillCircle(-22, 50, 9); bg.fillCircle(-34, 66, 5); this.hBub.add(bg);
    this.hBubIm = this.add.image(0, -2, 'sn4e').setDisplaySize(64, 50); this.hBub.add(this.hBubIm);
    this.satKey = '';
  }
  satTierOf(p) { return satTier(p.sat); }
  mealState() {
    const s = this.state, d = localDay();
    if (s.meal.day !== d) s.meal = { day: d, got: [0, 0, 0] };
    const m = this.fakeMeal ?? mealNow(); return { m, open: m >= 0 && !s.meal.got[m] };
  }
  drawSat() {
    if (!this.satG || !this.satC.scene) return;
    const p = this.pet(), v = clamp(p.sat / 100, 0, 1), tier = satTier(p.sat), ms = this.mealState();
    const g = this.satG; g.clear();
    g.fillStyle(0x3a2a5a, 0.18); g.fillRoundedRect(-41, 33, 84, 14, 7);
    g.fillStyle(0xf2e3c2, 1); g.fillRoundedRect(-42, 31, 84, 14, 7);
    const col = [0x7cc47a, 0xf3b94e, 0xe0457b][tier];
    if (v > 0.01) { g.fillStyle(col, 1); g.fillRoundedRect(-40, 33, Math.max(10, 80 * v), 10, 5); g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(-37, 34, Math.max(6, 74 * v), 3, 2); }
    const want = tier > 0 || ms.open, bc = ms.open ? 0xf39a3c : tier ? BERRY : SAGE;
    this.satBtn.clear(); this.paper(this.satBtn, -44, 48, 88, 34, 17, bc, { sh: 3 });
    const key = `${tier}|${ms.m}|${ms.open}|${lang}|${this.eat ? 1 : 0}`;
    if (key !== this.satKey) {
      this.satKey = key;
      this.satState.setText(tr('sat' + tier)); this.satState.setColor(['#2f7a52', '#b86a00', '#d0306b'][tier]); this.satState.setScale(1); if (this.satState.width > 94) this.satState.setScale(94 / this.satState.width);
      if (!this.eat) this.satBowl.setTexture(tier === 2 ? 'sn4e' : 'sn4');
      this.mealTag.setVisible(ms.m >= 0);
      this.mealTagT.setText(ms.m >= 0 ? (ms.open ? tr('mealTime', { m: tr('meal' + ms.m) }) : tr('mealDone', { m: tr('meal' + ms.m) })) : ''); this.mealTagT.setScale(1); if (this.mealTagT.width > 106) this.mealTagT.setScale(106 / this.mealTagT.width);
    }
    this.mealTag.y = -98 + (ms.open ? Math.sin(this.t * 6) * 3 : 0);
    this.satBowl.setRotation(tier === 2 ? Math.sin(this.t * 9) * 0.08 : 0);
    this.satC.setScale(want && !this.eat ? 1 + Math.max(0, Math.sin(this.t * 4)) * 0.035 : 1);
    // 一键全喂
    const n = this.hungryPups().length, show = this.pets().length > 1 && this.mode === 'play';
    this.feedAllC.setVisible(show);
    if (show) {
      const lbl = n ? fmt(this.feedAllCost()) : tr('allFull');
      if (lbl !== this.feedAllLbl) { this.feedAllLbl = lbl; this.feedAllT.setText(n ? '♥ ' + lbl : lbl); this.feedAllT.setScale(1); if (this.feedAllT.width > 94) this.feedAllT.setScale(94 / this.feedAllT.width); }
      this.feedAllC.setAlpha(n ? 1 : 0.75);
    }
    // 头顶饭碗气泡
    const hb = this.hBub, showB = tier >= 1 && !this.eat && this.mode === 'play' && !this.sw && !this.face.turn && (tier === 2 || (this.t % 9) < 3.5);
    hb.setVisible(showB);
    if (showB) { const sc = this.mainScale(); hb.setPosition(this.mcx + 120 * sc, this.mgy - (this.face.front ? 560 : 470) * sc + Math.sin(this.t * 2.4) * 6); hb.setScale(0.9 + 0.06 * Math.sin(this.t * 3)); }
  }
  hungryPups() { return this.pets().filter((p, i) => i !== this.state.main && p.sat < 90); }
  feedCost() { return Math.max(300, Math.ceil(this.hps(true) * 30 + this.tapVal(true) * 10)); }
  feedAllCost() { return Math.ceil(this.feedCost() * 0.6 * this.hungryPups().length); }
  mealBonus() { return Math.max(1500, Math.ceil(this.hps(true) * 150 + this.tapVal(true) * 60)); }
  // 一顿饭：返回是否触发准时开饭
  takeMeal(list) {
    const ms = this.mealState(), s = this.state;
    list.forEach((p) => { p.sat = Math.min(100, p.sat + SAT_FEED); p.fed = (p.fed || 0) + 1; });
    let onTime = false;
    if (ms.open) { onTime = true; s.meal.got[ms.m] = 1; list.forEach((p) => this.addBond(p, 60 + 0.04 * p.bond)); }
    this.careTick();
    return onTime ? ms.m : -1;
  }
  feed() {
    if (this.mode !== 'play' || this.modal || this.eat) return;
    const s = this.state, c = this.feedCost(), p = this.pet();
    if (p.sat >= 92) { this.toast(tr('satFull')); this.ff.react = { u: 0, dur: 1.0 }; return; }
    if (s.hearts < c) { this.toast(tr('feedNeed', { n: fmt(c) })); sfx('duang', { pitchSemitones: -6 }); return; }
    s.hearts -= c;
    const m = this.takeMeal([p]);
    this.startEat(m);
    this.markDirty(true); this.updateHUD(true);
  }
  feedAll() {
    if (this.mode !== 'play' || this.modal) return;
    const list = this.hungryPups(), s = this.state;
    if (!list.length) { this.toast(tr('allFull')); return; }
    const c = this.feedAllCost();
    if (s.hearts < c) { this.toast(tr('feedNeed', { n: fmt(c) })); sfx('duang', { pitchSemitones: -6 }); return; }
    s.hearts -= c;
    const m = this.takeMeal(list);
    sfx('munch'); this.later(250, () => sfx('buy', { pitchSemitones: 4 }));
    this.pups.forEach((q) => {
      if (!q || !list.includes(this.pets()[q.i])) return;
      q.state = 'idle'; q.t = 2.2; q.sq.v = 12; q.bowlT = 2.2;
      this.burstHearts(q.x, q.y - q.w * 0.6, 4);
    });
    if (m >= 0) this.onTimeFx(m, list.length); else this.toast(tr('fedAll', { n: list.length }));
    this.markDirty(true); this.updateHUD(true);
  }
  onTimeFx(m, n) {
    const v = this.mealBonus() * Math.max(1, n * 0.5); this.gain(v);
    this.later(300, () => { this.toast(tr('onTime', { m: tr('meal' + m) })); sfx('gold'); });
    this.floatText(this.mcx, this.mgy - 520 * this.mainScale(), '+' + fmt(v), 48, '#fff3a8', '#c2185b');
    for (let i = 0; i < 26; i++) this.spawnConfetti(rnd(0, W), rnd(-60, 160));
  }
  // 喂饭动画：转到正面 → 饭碗出现 → 吧唧吧唧（嘴动、碗变空）→ 拍拍肚子冒爱心
  startEat(onTimeMeal) {
    this.closePetPop();
    this.eat = { u: 0, dur: 3.4, m: onTimeMeal, stage: 0 };
    this.feedFront(1);
    const sc = this.mainScale();
    const b = this.add.image(this.mcx, this.mgy + 14, 'sn4').setOrigin(0.5, 1).setDepth(this.mgy * 0.5 + 2);
    b.setScale((190 * sc) / b.width * 0.2); this.eatBowl = b;
    this.tweens.add({ targets: b, scale: (190 * sc) / b.width, duration: 380, ease: 'Back.Out' });
    sfx('buy', { pitchSemitones: 3 });
    this.satBowl.setTexture('sn4');
  }
  eatUpdate(dt) {
    const e = this.eat; if (!e) return;
    if (!this.face.front || this.face.turn) return; // 等转过来
    e.u += dt; const u = e.u;
    if (e.stage === 0 && u > 0.2) { e.stage = 1; sfx('munch'); }
    if (e.stage === 1 && u > 1.0) { e.stage = 2; sfx('munch', { pitchSemitones: 2 }); }
    if (e.stage >= 1 && e.stage < 3 && Math.random() < dt * 10 && this.eatBowl) { const b = this.eatBowl; this.spark(b.x + rnd(-40, 40), b.y - b.displayHeight * 0.8, 1, 0); }
    if (e.stage === 2 && u > 1.7) { e.stage = 3; if (this.eatBowl) this.eatBowl.setTexture('sn4e'); this.satBowl.setTexture('sn4e'); }
    if (e.stage === 3 && u > 2.0) {
      e.stage = 4; sfx('gold'); this.spr.u.v += 8; this.spr.pop.v += 8;
      if (this.eatBowl) { const b = this.eatBowl; this.tweens.add({ targets: b, x: b.x + 190 * this.mainScale(), scale: b.scale * 0.72, duration: 300, ease: 'Quad.Out' }); }
      const sc = this.mainScale();
      for (let i = 0; i < 8; i++) this.later(i * 90, () => this.spawnHeart(this.mcx + rnd(-90, 90), this.mgy - 300 * sc, 1, 1));
      if (e.m >= 0) this.onTimeFx(e.m, 1); else this.toast(tr('fedSnack'));
    }
    if (u >= e.dur) {
      this.eat = null; this.satBowl.setTexture('sn4'); this.satKey = '';
      const b = this.eatBowl; this.eatBowl = null;
      if (b) this.tweens.add({ targets: b, alpha: 0, scale: b.scale * 0.6, duration: 260, onComplete: () => b.destroy() });
      if (this.fh) { this.fh.until = this.t + 1.0; this.fh.puff = (this.fh.puff || 0) + 8; }
    }
  }
  // 正面表情覆盖：吃饭/饿了
  eatPose(o) {
    const e = this.eat;
    if (e && this.face.front && !this.face.turn) {
      const u = e.u;
      if (u < 2.0) { // 低头吃
        const k = clamp(Math.min(u / 0.25, (2.0 - u) / 0.2), 0, 1), chew = Math.sin(u * 22);
        o.hhy = 34 * k + Math.abs(chew) * 6 * k; o.hr = Math.sin(u * 5) * 0.04 * k;
        o.eL = o.eR = 1; o.tg = chew > 0.1 ? 1 : 0; o.bl = 0;
        o.earL = 0.06 * k * chew; o.earR = -o.earL; o.hy = 0;
        o.pwL = { r: 0, x: 0, y: 0 }; o.pwR = { r: 0, x: 0, y: 0 };
      } else { // 拍肚子
        const k = clamp(Math.min((u - 2.0) / 0.2, (e.dur - u) / 0.3), 0, 1), pat = Math.sin((u - 2.0) * 16);
        o.eL = o.eR = 1; o.tg = 1; o.hhy = 0; o.hr = Math.sin(u * 4) * 0.05 * k;
        o.rot = Math.sin((u - 2.0) * 6) * 0.045 * k; o.hr = -o.rot * 1.2; void pat;
        o.hy = -Math.abs(Math.sin((u - 2.0) * 5)) * 16 * k; o.earL = 0.05 * Math.sin(u * 10) * k; o.earR = -o.earL;
      }
      return o;
    }
    const tier = satTier(this.pet().sat);
    if (tier >= 1 && !(this.ff.react) && this.mode === 'play') { // 饿：耳朵耷拉、低头
      const k = tier === 2 ? 1 : 0.45;
      o.earL += 0.32 * k; o.earR -= 0.32 * k; o.hhy += 10 * k; o.tg = 0;
      if (tier === 2) { o.hy *= 0.3; o.pwR = { r: 0, x: 0, y: 0 }; }
    }
    return o;
  }
  dayDiff(a, b) { if (!a || !b) return 99; return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  // 连续照顾：每天至少喂一顿。断一天可自动补签 1 次；断更久只会从头开始，没有惩罚
  careInfo() {
    const c = this.state.care, d = localDay(), gap = this.dayDiff(c.last, d);
    const alive = gap <= 1 || (gap === 2 && !c.mu);
    const streak = alive ? c.streak : 0, today = gap === 0;
    const k = CARE_MS.findIndex((m, i) => !c.ms[i]);
    const next = k < 0 ? null : { d: CARE_MS[k], r: () => this.careRewName(k) };
    return { streak, today, next, canMu: gap === 2 && !c.mu };
  }
  careRewName(k) { const r = CARE_REW[k]; return r.w != null ? tr('n_w' + r.w) : tr('rareCoat'); }
  careTick() {
    const c = this.state.care, d = localDay(), gap = this.dayDiff(c.last, d);
    if (gap === 0) return;
    if (gap === 1) c.streak += 1;
    else if (gap === 2 && !c.mu) { c.streak += 1; c.mu = 1; this.later(1800, () => this.toast(tr('careMu'))); }
    else { c.streak = 1; c.mu = 0; }
    c.last = d; c.best = Math.max(c.best, c.streak);
    CARE_MS.forEach((m, k) => { if (!c.ms[k] && c.streak >= m) { c.ms[k] = 1; this.later(2600 + k * 900, () => this.careReward(k)); } });
    if (this.tab === 1 && this.cardsC) this.renderCards();
  }
  careReward(k) {
    const r = CARE_REW[k], s = this.state;
    if (r.w != null) { s.own[r.w] = 1; this.toast(tr('careGotW', { d: CARE_MS[k], w: tr('n_w' + r.w) })); }
    else if (!this.grantRare()) { const v = this.ckReward(7) * r.k * 2; this.gain(v); this.toast(tr('careGotH', { d: CARE_MS[k] })); }
    sfx('gold'); this.burstHearts(W / 2, this.panelTop - 120, 14);
    for (let i = 0; i < 20; i++) this.spawnConfetti(rnd(0, W), rnd(-60, 160));
    if (this.cardsC) this.renderCards(); this.markDirty(true);
  }
  hungerTick(dt) {
    const tier = satTier(this.pet().sat);
    if (this.lastTier != null && tier > this.lastTier && tier === 2) this.toast(tr('hungryNow', { n: tr('n_p' + this.pet().nm) }));
    this.lastTier = tier;
    this.sighT = (this.sighT ?? 8) - dt;
    if (this.sighT <= 0) {
      this.sighT = rnd(22, 34);
      if (tier === 2 && !this.eat && !this.modal) { sfx('sigh'); this.ff.react = null; this.spr.u.v -= 3; }
    }
  }
}

/* ============ 购买反馈 / 零食投喂演出 ============ */
Object.assign(Main.prototype, {
  // 卡片中心的世界坐标
  cardWorld(card) { return { x: card.c.x + this.cardsC.x, y: card.c.y + this.cardsC.y }; },
  // 卡内某点（相对卡片左上角）的世界坐标
  cardPt(card, lx, ly) { const w = this.cardWorld(card); return { x: w.x - card.cw / 2 + lx, y: w.y - card.ch / 2 + ly }; },

  /* ---- 按压：Q 弹缩放 ---- */
  pressCard(card) {
    this.releasePress(true);
    if (!card || !card.c.scene) return;
    this.pressed = card;
    this.tweens.killTweensOf(card.c);
    card.c.x = card.bx ?? card.c.x; card.bx = card.c.x;
    this.tweens.add({ targets: card.c, scaleX: 0.93, scaleY: 0.9, duration: 70, ease: 'Quad.Out' });
  },
  releasePress(silent) {
    const card = this.pressed; this.pressed = null;
    if (!card || !card.c.scene) return;
    this.tweens.add({ targets: card.c, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.Out' });
  },
  cardPop(card, k = 1) {
    if (!card || !card.c.scene) return;
    card.c.setScale(0.9);
    this.tweens.add({ targets: card.c, scaleX: { from: 1 + 0.1 * k, to: 1 }, scaleY: { from: 0.86, to: 1 }, duration: 420, ease: 'Elastic.Out', easeParams: [1.1, 0.5] });
  },
  shakeCard(card, amp = 9) {
    if (!card || !card.c.scene) return;
    const c = card.c; if (card.bx == null) card.bx = c.x;
    this.tweens.killTweensOf(c); c.setScale(1); c.x = card.bx; c.rotation = 0;
    this.tweens.add({ targets: c, x: { from: card.bx - amp, to: card.bx + amp }, rotation: { from: -0.03, to: 0.03 }, duration: 55, yoyo: true, repeat: 3, ease: 'Sine.InOut', onComplete: () => { c.x = card.bx; c.rotation = 0; } });
  },

  /* ---- 卡片上方的小粒子（在面板之上） ---- */
  cardBurst(x, y, n, tex = 'mi0', big = 1) {
    for (let i = 0; i < n; i++) {
      const im = this.add.image(x + rnd(-30, 30), y + rnd(-14, 14), tex).setDepth(2900);
      const tints = [0xffffff, 0xffc4d4, 0xff8fb2, 0xffe08a];
      if (tex === 'mi0') im.setTint(tints[(Math.random() * tints.length) | 0]);
      const s = rnd(0.07, 0.13) * big; im.setScale(0.01);
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), d = rnd(70, 150) * big;
      this.tweens.add({ targets: im, scale: s, duration: 120 });
      this.tweens.add({ targets: im, x: im.x + Math.cos(a) * d, y: im.y + Math.sin(a) * d + 40, angle: rnd(-120, 120), alpha: { from: 1, to: 0 }, duration: rnd(520, 760), ease: 'Quad.Out', onComplete: () => im.destroy() });
    }
  },
  starBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics().setDepth(2950); g.x = x; g.y = y;
      g.fillStyle([0xffd23f, 0xfff3a8, 0xffffff, 0xff9fb8][i % 4], 1);
      const r = rnd(9, 16), pts = [];
      for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + k * Math.PI / 5; pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); }
      g.fillPoints(pts, true);
      const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(90, 190);
      this.tweens.add({ targets: g, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: rnd(-200, 200), scale: { from: 1.3, to: 0.2 }, alpha: { from: 1, to: 0 }, duration: rnd(650, 950), ease: 'Cubic.Out', onComplete: () => g.destroy() });
    }
  },

  /* ---- 买不起 ---- */
  denyFx(card, price) {
    sfx('nope');
    if (!card || !card.c.scene) return;
    this.shakeCard(card);
    card.redT = this.t + 0.7; this.drawPill(card);
    if (card.prT) {
      card.prT.setColor('#ffe0e0');
      this.tweens.add({ targets: card.prT, alpha: { from: 0.35, to: 1 }, duration: 110, yoyo: false, repeat: 3 });
    }
    const pp = this.cardPt(card, card.cw / 2, -6);
    this.floatText(pp.x, pp.y, tr('needMore', { n: fmt(Math.ceil(price - this.state.hearts)) }), 26, '#ffffff', '#b0304f', 2900, 60);
    this.later(720, () => { if (card.c.scene) { card.redT = 0; this.drawPill(card); if (card.prT) card.prT.setColor('#ffffff'); } });
    // 柯基委屈地看一眼（节流）
    if (this.t - (this.sadT || -9) > 3 && !this.eat && !this.sw) {
      this.sadT = this.t;
      if (this.face.front && !this.face.turn) { this.ff.act = null; this.ff.react = null; this.sadFace = 1.1; }
      else if (!this.face.turn && !(this.react && this.react.peek)) { this.peek.side = card.c.x + this.cardsC.x < this.mcx ? -1 : 1; this.react = { u: 0, dur: 1.3, peek: true, bub: true }; this.idleCancel(); }
      this.spr.u.v -= 4;
      this.sadDrop();
    }
  },
  sadDrop() {
    const sc = this.mainScale(), front = this.face.front;
    const x = this.mcx + (front ? 120 : this.peek.side * 290) * sc, y = this.mgy - (front ? 470 : 420) * sc;
    const g = this.add.graphics().setDepth(1960); g.x = x; g.y = y;
    g.fillStyle(0xffffff, 0.95); g.fillCircle(0, 0, 40); g.fillCircle(-30, 34, 9); g.fillCircle(-42, 48, 5);
    g.fillStyle(0x7fc4f2, 1); g.fillCircle(0, 8, 13); g.fillTriangle(-11, 2, 11, 2, 0, -20);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(-4, 6, 4);
    g.setScale(0.1);
    this.tweens.add({ targets: g, scale: 1, duration: 240, ease: 'Back.Out' });
    this.tweens.add({ targets: g, y: y - 30, alpha: 0, duration: 500, delay: 900, onComplete: () => g.destroy() });
  },

  /* ---- 购买成功的统一反馈 ---- */
  buyFx(card, from, o) {
    const ok = card && card.c.scene;
    if (ok) this.cardPop(card, o.snack != null ? 1.2 : 1);
    const c = ok ? card : null;
    // 价格处飘出 -价格
    if (o.price && from) {
      const pp = c ? this.cardPt(c, c.cw / 2, c.py - 14) : { x: from.x, y: from.y + 100 };
      this.floatText(pp.x, pp.y, '-' + fmt(o.price), 30, '#ffffff', '#c2185b', 2900, 80);
      this.cardBurst(pp.x, pp.y + 10, 8);
    }
    this.pumpCounter(-1);
    if (o.snack == null || !c) return;
    // 等级 +1 跳动、+N/点击 高亮
    if (c.l1T) {
      c.l1T.setColor('#e0457b');
      this.tweens.add({ targets: c.l1T, scale: { from: c.l1T.scale * 1.7, to: c.l1T.scale }, duration: 420, ease: 'Back.Out' });
      const p1 = this.cardPt(c, c.cw - 34, 172);
      this.floatText(p1.x, p1.y, '+1', 26, '#ffffff', '#e0457b', 2900, 50);
      this.later(600, () => { if (c.l1T.scene) c.l1T.setColor('#7a6f9b'); });
    }
    if (c.l2T) {
      c.l2T.setColor('#f08a00');
      this.tweens.add({ targets: c.l2T, scale: { from: c.l2T.scale * 1.35, to: c.l2T.scale }, duration: 360, ease: 'Back.Out', delay: 80 });
      this.later(650, () => { if (c.l2T.scene) c.l2T.setColor('#2f7a52'); });
    }
    // 连买连击
    const cb = this.buyCombo = (this.buyCombo && this.t - this.buyCombo.t < 1.3) ? { n: this.buyCombo.n + 1, t: this.t } : { n: 1, t: this.t };
    // 不同零食不同音高，连击越高越亮
    sfx('buy', { pitchSemitones: [-3, -1, 1, 3, 5, 7][o.snack] + Math.min(6, (cb.n - 1) * 0.7) });
    // 里程碑
    if (o.ms) this.later(120, () => this.snackMilestone(c, o.snack, o.lv, o.ms));
    // 零食飞向柯基
    const ip = this.cardPt(c, c.cw / 2, c.icon.y);
    this.flySnack(o.snack, ip.x, ip.y, c.icon.displayWidth, o.gainTap, cb.n);
  },
  snackMilestone(c, i, lv, ms) {
    const p = c && c.c.scene ? this.cardWorld(c) : { x: W / 2, y: this.panelTop + 140 };
    this.starBurst(p.x, p.y - 40, 16);
    for (let k = 0; k < 36; k++) this.spawnConfetti(rnd(0, W), rnd(-60, 200));
    sfx('gold'); this.later(180, () => sfx('frenzy'));
    this.toast(tr('msUp', { s: tr('n_s' + i), n: lv, m: SNACK_MSM[ms - 1] }));
    if (c && c.c.scene) this.tweens.add({ targets: c.c, angle: { from: -6, to: 0 }, duration: 600, ease: 'Elastic.Out' });
  },

  // 正面嘴巴位置（headT 图上的嘴心，headC 局部坐标 (2,-117)）；不在正面时用静止正面的估算位置
  snackTarget() {
    const F = this.F;
    if (F && this.face.front && !this.face.turn && this.frig && this.frig.visible) {
      const p = F.headC.getWorldTransformMatrix().transformPoint(2, -112); return { x: p.x, y: p.y, front: true };
    }
    const e = this.mouthEst || { x: this.mcx, y: this.mgy - 300 * this.mainScale() };
    return { x: e.x, y: e.y, front: false };
  },
  // 投食：确保柯基转到正面并保持；返回还需多少秒才能正面接食
  feedFront(hold) {
    const f = this.face;
    if (!this.fh) this.fh = { back: !f.front || !!(f.turn && !f.turn.to) || !!f.timed, until: 0, puff: 0 };
    this.fh.until = Math.max(this.fh.until, this.t + hold);
    if (this.react && this.react.peek) this.react = null;
    this.idleCancel(); this.lastTouch = this.t;
    if (f.turn) return f.turn.to ? Math.max(0, f.turn.dur - f.turn.t) : Math.max(0, f.turn.dur - f.turn.t) + 0.8;
    if (!f.front) { if (!this.fit) this.startTurn(true); return 0.8; }
    return 0;
  },
  flySnack(i, x0, y0, w0, gainTap, combo) {
    this.flying = (this.flying || 0) + 1;
    const busy = this.flying > 2;
    const side = x0 < this.mcx - 20 ? -1 : x0 > this.mcx + 20 ? 1 : 1;
    const ready = this.sw ? 0 : this.feedFront(1.2);
    const dur = Math.max(0.55, ready + 0.18);
    if (this.face.front && !this.face.turn) { this.ff.act = null; this.ff.react = null; this.sadFace = 0; }
    const im = this.add.image(x0, y0, SNACKS[i].ic).setDepth(3400);
    const s0 = w0 / im.width; im.setScale(s0);
    if (!busy) sfx('whoosh');
    // 用游戏时间驱动（与转身同一时钟，保证落嘴时已转到正面）
    (this.flights = this.flights || []).push({ im, x0, y0, s0, side, u: 0, dur, i, gainTap, combo, busy, wait: 0 });
    if (!busy) for (let k = 1; k <= 4; k++) this.later(k * 80, () => { if (im.scene) this.cardBurst(im.x, im.y, 1, 'mi0', 0.7); });
  },
  flightTick(dt) {
    for (const fl of this.flights.slice()) {
      fl.u += dt; let k = Math.min(1, fl.u / fl.dur);
      k = 1 - Math.cos(k * Math.PI / 2); // Sine.In
      const im = fl.im, tg = this.snackTarget();
      const cx = (fl.x0 + tg.x) / 2 + fl.side * 30, cy = Math.min(fl.y0, tg.y) - 220 - 120 * Math.max(0, fl.dur - 0.55);
      im.x = (1 - k) * (1 - k) * fl.x0 + 2 * (1 - k) * k * cx + k * k * tg.x;
      im.y = (1 - k) * (1 - k) * fl.y0 + 2 * (1 - k) * k * cy + k * k * tg.y;
      im.setScale(fl.s0 * (1 - 0.6 * k) * (1 + 0.15 * Math.sin(k * Math.PI)));
      im.rotation = k * 6 * fl.side;
      if (globalThis.__freezeCatch && k > 0.97 && globalThis.__MAKEPLAY_PLAYTEST__) { globalThis.__slow = 0.0005; globalThis.__freezeCatch = 0; }
      if (fl.u < fl.dur) continue;
      if (this.face.turn && (fl.wait += dt) < 0.6) continue; // 还在转身：在嘴前稍等
      this.flights.splice(this.flights.indexOf(fl), 1);
      im.destroy(); this.flying--; this.catchSnack(fl.i, fl.gainTap, fl.combo, fl.busy);
    }
  },
  catchSnack(i, gainTap, combo, busy) {
    const sc = this.mainScale(), tg = this.snackTarget();
    this.ffChew = { u: 0, dur: busy ? 0.6 : 0.85 }; this.ffPat = null;
    this.ff.react = null; this.ff.act = null;
    if (this.fh) { this.fh.until = Math.max(this.fh.until, this.t + this.ffChew.dur + 1.0); this.fh.puff = (this.fh.puff || 0) + 1; }
    if (!busy || Math.random() < 0.5) sfx('munch', { pitchSemitones: rnd(1, 4) });
    for (let k = 0; k < (busy ? 2 : 5); k++) this.spark(tg.x + rnd(-24, 24), tg.y + 6, 1, 0);
    this.spr.u.v += 4; this.spr.pop.v += 3;
    const cb = Math.min(8, combo);
    this.spr.puff.v += 2 + cb * 0.4; // 永久增长；转回背面时再大 duang 一下展示
    this.floatText(tg.x + rnd(-30, 30), tg.y - 150 * sc, tr('tap', { r: fmt(gainTap, true) }), 38, '#fff3a8', '#2f7a52', 1800, 120);
    const nh = busy ? 1 : 3; for (let k = 0; k < nh; k++) this.spawnHeart(tg.x + rnd(-80, 80), tg.y - 40 * sc, 0.9, 1);
    if (combo >= 2) this.comboText(combo);
  },
  // 正面吃零食表情：张嘴等 → 嚼嚼（眯眼、腮帮鼓） → 吃完拍肚子满足
  feedPose(dt, o) {
    const live = this.face.front && !this.face.turn;
    const c = this.ffChew;
    if (c) {
      c.u += dt;
      if (c.u >= c.dur) {
        this.ffChew = null;
        if (!((this.flying || 0) > 0)) {
          this.ffPat = { u: 0, dur: 1.0 };
          const sc = this.mainScale();
          sfx('duang', { pitchSemitones: 9 }); this.spr.u.v += 6;
          for (let k = 0; k < 6; k++) this.later(k * 90, () => this.spawnHeart(this.mcx + rnd(-90, 90), this.mgy - 330 * sc, 1, 1));
        }
      } else if (live) {
        const ch = Math.sin(c.u * 26), e = clamp(Math.min(c.u / 0.06, (c.dur - c.u) / 0.12), 0, 1);
        o.eL = o.eR = 1; o.bl = 0; o.tg = ch > 0.3 && c.u < 0.2 ? 1 : 0;
        o.hsx = (0.035 + 0.025 * Math.abs(ch)) * e; o.hhy = Math.abs(ch) * 7 * e; o.hr = Math.sin(c.u * 9) * 0.04 * e;
        o.earL = 0.05 * ch * e; o.earR = -o.earL;
        return o;
      }
    }
    const p = this.ffPat;
    if (p) {
      p.u += dt;
      if (p.u >= p.dur) this.ffPat = null;
      else if (live) {
        const u = p.u, k = clamp(Math.min(u / 0.15, (p.dur - u) / 0.25), 0, 1), pat = Math.sin(u * 16);
        o.eL = o.eR = 1; o.tg = 1; o.hhy = 0; o.hr = Math.sin(u * 4) * 0.05 * k;
        o.rot = Math.sin(u * 7) * 0.05 * k; o.hr = -o.rot * 1.2; void pat;
        o.hy = -Math.abs(Math.sin(u * 5.5)) * 16 * k; o.earL = 0.06 * Math.sin(u * 11) * k; o.earR = -o.earL;
        return o;
      }
    }
    if (live && (this.flying || 0) > 0) { // 张大嘴等零食
      o.eL = o.eR = 0; o.bl = 0; o.tg = 1; o.hhy = -8; o.earL = -0.08; o.earR = 0.08; o.hy = -Math.abs(Math.sin(this.t * 10)) * 6;
    }
    return o;
  },
  // 转回背面后：屁屁 duang 一下展示变大
  backDuang() {
    const sc = this.mainScale(), n = this.lastFeedN || 1;
    this.spr.puff.v += 12 + Math.min(14, n * 2); this.spr.l.v += 10; this.spr.r.v += 10; this.spr.pop.v += 8; this.spr.u.v -= 6;
    sfx('duang', { pitchSemitones: 1 - Math.min(5, n * 0.5) });
    const bx = this.mcx, by = this.mgy - 230 * sc;
    this.ring(bx, by, 1.1);
    for (let k = 0; k < 6; k++) this.spawnHeart(bx + rnd(-110, 110), by, 1, 1);
    this.floatText(bx, by - 120 * sc, tr('buttGrow'), 34, '#ffffff', '#e0457b', 1800, 120);
  },
  comboText(n) {
    const sc = this.mainScale(), x = this.mcx + 170 * sc, y = this.mgy - 420 * sc;
    if (this.comboT && this.comboT.scene) this.comboT.destroy();
    const t = this.add.text(x, y, tr('comboX', { n }), { fontFamily: FONT, fontSize: Math.min(68, 46 + n * 3) + 'px', color: '#fff3a8', stroke: '#e0457b', strokeThickness: 12 }).setOrigin(0.5).setDepth(1900).setAngle(-8);
    this.comboT = t;
    this.tweens.add({ targets: t, scale: { from: 1.9, to: 1 }, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 500, delay: 700, onComplete: () => t.destroy() });
    if (n % 5 === 0) { sfx('gold'); for (let k = 0; k < 14; k++) this.spawnConfetti(rnd(0, W), rnd(-40, 120)); }
  },

  /* ---- 顶部爱心计数器跳动 ---- */
  pumpCounter(dir = 1) {
    const ic = this.heartIcon, t = this.heartTxt; if (!ic) return;
    if (ic.bsx == null) { ic.bsx = ic.scaleX; ic.bsy = ic.scaleY; }
    this.tweens.killTweensOf(ic);
    const k = dir > 0 ? 1.4 : 0.8; ic.setScale(ic.bsx * k, ic.bsy * k);
    this.tweens.add({ targets: ic, scaleX: ic.bsx, scaleY: ic.bsy, duration: 380, ease: 'Elastic.Out', easeParams: [1.2, 0.45] });
    if (dir > 0) { t.setColor('#e0457b'); this.later(260, () => t.setColor(NAVY_S)); }
  },
  // 奖励爱心从卡片飞到顶部计数器；先入账，显示上逐个到达
  flyRewards(x0, y0, v, n) {
    this.gain(v); this.pendShow = (this.pendShow || 0) + v; this.markDirty(true);
    const hx = (W - 720) / 2 + 212, hy = 62, per = v / n;
    for (let k = 0; k < n; k++) {
      const im = this.add.image(x0 + rnd(-40, 40), y0 + rnd(-30, 30), 'mi0').setDepth(3500).setScale(0.01);
      const sx = im.x, sy = im.y, cx = (sx + hx) / 2 + rnd(-160, 160), cy = Math.min(sy, hy) + rnd(80, 260);
      const st = { k: 0 };
      this.tweens.add({ targets: im, scale: 0.22, duration: 180, delay: k * 45, ease: 'Back.Out' });
      this.tweens.add({
        targets: st, k: 1, duration: 650, delay: 180 + k * 55, ease: 'Cubic.In',
        onUpdate: () => { const q = st.k; im.x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * cx + q * q * hx; im.y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * cy + q * q * hy; im.setScale(0.22 * (1 - 0.4 * q)); },
        onComplete: () => {
          im.destroy(); this.pendShow = Math.max(0, (this.pendShow || 0) - per); if (k === n - 1) this.pendShow = Math.max(0, this.pendShow - 1e-6 * v);
          this.pumpCounter(1); this.updateHUD(true);
          if (k % 3 === 0) sfx('buy', { pitchSemitones: 8 + k * 0.5 });
        },
      });
    }
    this.later(180 + n * 55 + 900, () => { this.pendShow = 0; this.updateHUD(true); });
  },

  /* ---- 装饰从天而降 ---- */
  dropDecor(i) {
    const c = this.decorSp[i]; c.setVisible(true);
    const im = c.im, s1 = c.dw / im.width;
    this.tweens.killTweensOf(im);
    im.y = -c.y - 200; im.setScale(s1 * 0.9, s1 * 1.15);
    sfx('whoosh');
    this.tweens.add({
      targets: im, y: 0, duration: 520, ease: 'Quad.In',
      onComplete: () => {
        sfx('thud'); this.cameras.main.shake(160, 0.006);
        im.setScale(s1 * 1.3, s1 * 0.7);
        this.tweens.add({ targets: im, scaleX: s1, scaleY: s1, duration: 520, ease: 'Elastic.Out', easeParams: [1.2, 0.4] });
        this.ring(c.x, c.y - 20, 1); this.burstHearts(c.x, c.y - 60, 10);
        for (let k = 0; k < 10; k++) this.spark(c.x + rnd(-60, 60), c.y - 10, 1, 0);
        this.toast(tr('decorLand', { n: tr('n_d' + i) }));
        this.spr.pop.v += 6;
      },
    });
  },

  /* ---- 每帧：可买卡片呼吸闪光 ---- */
  cardTick(dt) {
    if (this.flights && this.flights.length) this.flightTick(dt);
    if (!this.cards) return;
    const t = this.t;
    for (const card of this.cards) {
      if (!card.glow || !card.c.scene) continue;
      const can = card.price != null && this.state.hearts >= card.price;
      const ph = (t * 1.6 + card.n * 0.7) % 3;
      card.glow.setAlpha(can ? Math.max(0, Math.sin(Math.min(1, ph) * Math.PI)) * 0.35 : 0);
      if (can && this.pressed !== card && !this.tweens.isTweening(card.c)) card.c.setScale(1 + Math.sin(t * 3.2 + card.n) * 0.012);
      else if (!can && !this.tweens.isTweening(card.c) && this.pressed !== card) card.c.setScale(1);
    }
    if (this.chompT > 0) this.chompT -= dt;
    if (this.sadFace > 0) this.sadFace -= dt;
  },
});

  return Main;
}

/* ============ 启动 ============ */
/**
 * 游戏入口。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，
 * 差别全部通过 `opts` 注入 —— 所以玩法代码里没有 `if (isPlugin)` 分支
 * （那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `index.html` | `plugin.js` |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl('')` |
 * | 音频 | 不传（默认 `./sound.manifest.json`） | `manifestUrl` + `baseUrl`（清单在**包根**） |
 * | 存档 | 不传（localStorage） | `host.storage` → `makeHostStore()` |
 * | 容器 | 不传（`#game`） | `mount(container)` 给的那个 |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * 返回值是**卸载函数**。宿主会 `await` 它，而且它必须能在「刚建好就被调用」时安全执行
 * （孩子秒切 tab）。
 */
export async function start(opts = {}) {
  const container = opts.container || null;
  const store = opts.store || null;
  IS_PLUGIN = !!container;

  // ---- 资源根 ----
  // 插件里是 `<包根>/`；网页里空串 = 相对文档，和原版一模一样。
  // ★ 漏了这一句的症状：205 张图全 404，报一堆 `Texture key not found`，
  //   看着像打包坏了。
  setAssetRoot(typeof opts.assetBase === 'string' ? opts.assetBase : '');

  // ---- 音频 ----
  // 清单在**包根**（`sound.manifest.json`），不在 `assets/` 里；
  // 清单里的 `assets/audio/bgm.m4a` 与 `sound.pack` 都相对它解析。
  // `loadSoundSystem()` 的默认值是 `./sound.manifest.json` —— 相对**文档**，
  // 在 blob 模块里必然拿不到（症状：整局没音乐，且 0 个 404）。
  SOUND_OPTS = assetRoot() ? { manifestUrl: assetUrl('sound.manifest.json'), baseUrl: assetRoot() } : null;

  // ---- 存档 ----
  let st = store;
  if (!st) {
    st = makeLocalStore();
    try { await st.preload(); } catch (e) { console.warn('[corgi] 读本地存档失败', e); }
  }
  installGp(st, { locale: opts.locale });

  // ---- 语言 ----
  // 宿主只有中文。`lang` 在模块导入时已按 navigator 猜过一次（Android WebView
  // 会跟着系统走，孩子可能看到日文/英文），这里按宿主给的 locale 覆盖。
  if (opts.locale && !settings.lang) {
    const p = String(opts.locale).toLowerCase();
    lang = p.startsWith('ja') ? 'ja' : p.startsWith('en') ? 'en' : 'zh';
  }

  // ---- 开局收费（只有插件形态会传）----
  const paid = opts.chargePlay ? await opts.chargePlay() : true;
  if (!paid) {
    const gate = document.createElement('div');
    gate.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      + 'gap:10px;padding:24px;text-align:center;background:#f6e9f7;color:#4a3550;'
      + "font:900 16px/1.5 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    gate.innerHTML = '<div style="font-size:20px">积分不够啦</div>'
      + '<div style="font-weight:800;color:#7a6070">去做个任务攒点积分，再回来撸柯基</div>';
    (container || document.body).appendChild(gate);
    return function unmountGate() {
      try { gate.remove(); } catch (e) { /* */ }
      IS_PLUGIN = false;
      VIEW = null;
      SOUND_OPTS = null;
    };
  }

  // ---- 尺寸 ----
  const measure = () => {
    if (!container) { VIEW = null; return; }
    const r = container.getBoundingClientRect();
    VIEW = {
      w: Math.max(1, Math.round(r.width || container.clientWidth || 1)),
      h: Math.max(1, Math.round(r.height || container.clientHeight || 1)),
    };
  };
  measure();

  // ---- 挂载点 ----
  // Phaser 的 `parent` 要一个占满容器的元素。**自己建一个**，卸载时只删自己这个
  // （绝不 `container.innerHTML = ''` —— 那是宿主的 DOM）。
  let parentEl = 'game';
  let own = null;
  if (container) {
    own = document.createElement('div');
    own.style.cssText = 'position:absolute;inset:0;overflow:hidden;isolation:isolate';
    container.appendChild(own);
    parentEl = own;

    // 背景模糊层：原版写在 index.html 的 CSS 里，插件里没有这段 CSS。
    // 不建的话 FIT 留下的黑边是纯色，观感差一截。
    //
    // ★★ `z-index:-1` **必须有**，而且 `own` 必须是 `isolation:isolate` 的层叠上下文。
    //    原因：`#bgfill` 是 `position:absolute`，而 Phaser 插进来的 canvas 是
    //    **非定位元素** —— 同一个层叠上下文里，定位元素画在非定位元素**之上**
    //    ⇒ 整块画面被这张模糊背景盖住。症状：截图里只有一片模糊的草地，
    //    没有柯基也没有按钮，而 canvas 明明在 DOM 里、尺寸也对、0 报错。
    //    （独立网页里不会出现：那边 `#bgfill` 和 `#game` 都是 `position:fixed`，
    //      靠 DOM 顺序决定先后。）
    if (!document.getElementById('bgfill')) {
      const f = document.createElement('div');
      f.id = 'bgfill';
      f.style.cssText =
        'position:absolute;inset:-30px;pointer-events:none;z-index:-1;'
        + `background:url(${assetUrl('assets/bg-garden.jpg')}) center/cover;`
        + 'filter:blur(7px) saturate(1.05);transform:scale(1.05)';
      own.appendChild(f);
    }
  }
  BGFILL = document.getElementById('bgfill');

  const [W0, H0] = calcSize(); W = W0;
  const q = new URLSearchParams(location.search);
  const prevLangAttr = document.documentElement.lang;
  if (!IS_PLUGIN) document.documentElement.lang = LANGS.find((x) => x.id === lang).htmlLang;

  // ★ 上一次挂载留下的调试钩子必须清掉：留着 `__gpReady` 会让下面的等待条件
  //   立刻为真 ⇒ 宿主以为「已就绪」，其实 canvas 还没建。
  try { window.__gpReady = false; } catch (e) { /* */ }

  // ★ 引擎与场景类都在**这里**才建：模块顶层建会让 Node 里 import 插件包时炸
  //   （Phaser 的 device 模块求值就读 `window`）。见文件顶部注释。
  ensurePhaser();
  const MainScene = defineMain();

  const game = new Phaser.Game({
    type: q.get('playtest') && q.get('canvas') === '1' ? Phaser.CANVAS : Phaser.AUTO,
    parent: parentEl, width: W0, height: H0, transparent: false,
    backgroundColor: '#cdbcf0',
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    scene: [MainScene],
  });

  // 容器尺寸变化（转屏 / 平板分栏 / 宿主改布局）
  let ro = null;
  let rt = 0;
  let alive = true;
  if (container && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        // ★ 卸载后必须立刻返回：这个 200ms 定时器很可能在 `destroy()` 之后才到，
        //   那时 `onResize()` 里的 `buildAll()` 会对着已销毁的场景 `this.add.add(...)`
        //   ⇒ `Cannot read properties of null (reading 'add')`，看着像插件崩了。
        if (!alive) return;
        measure();
        if (SCENE && SCENE.onResize) SCENE.onResize();
      }, 200);
    });
    ro.observe(container);
  }

  // 等场景真的建起来再返回：宿主可能立刻切走，`game.destroy()` 撞上半初始化的
  // 渲染器会抛在宿主那边（看着像「插件崩了」）。
  //
  // ★ 判据只能是 `__gpReady`（`create()` 里置位）。别写 `|| game.isBooted === false`
  //   —— 那个条件在**第一帧之前**就成立，循环会立刻返回，等于没等。
  await new Promise((res) => {
    const t = setInterval(() => {
      if (window.__gpReady) { clearInterval(t); res(); }
    }, 50);
    setTimeout(() => { clearInterval(t); res(); }, 15000);
  });

  return async function unmount() {
    alive = false;
    GEN++;              // 让还在 await 里的 onCore 立刻变成「过期」
    clearTimeout(rt);
    // ★ 先存档再销毁。游戏自己的自动存档是「每 12 秒且 dirty 才写」，
    //   直接 destroy 会把最多 12 秒的进度丢掉 —— 而「切个 tab 再回来」正是最常见
    //   的卸载场景，孩子刚喂的一口饭就没了，而且不报错。
    //
    // ★ 用 `SCENE`（`create()` 里记下的实例），不用 `game.scene.getScene('Main')`：
    //   后者在销毁竞态里会返回**已销毁**的场景，`saveNow()` 静默失败、进度全丢。
    try {
      if (SCENE && typeof SCENE.saveNow === 'function') SCENE.saveNow();
    } catch (e) { console.warn('[corgi] 卸载前存档失败', e); }
    try { if (ro) ro.disconnect(); } catch (e) { /* */ }
    try { game.destroy(true); } catch (e) { console.warn('[corgi] 销毁失败', e); }
    // 摘掉所有 window/document 监听（原版全是匿名函数，不摘就会在下次挂载时叠加）
    for (const fn of UNBINDS) { try { fn(); } catch (e) { /* */ } }
    UNBINDS = [];
    // 调试钩子一起摘
    try { delete window.__gpReady; } catch (e) { window.__gpReady = undefined; }
    try { delete window.__gpPlayable; } catch (e) { window.__gpPlayable = undefined; }
    // `?playtest` 桥也要摘：它持有整个 scene，留着等于把上一次挂载的对象树钉在内存里
    try { delete globalThis.__MAKEPLAY_PLAYTEST__; } catch (e) { /* */ }
    // 音频系统是模块级的：只把引用放下，**不要** destroy（下次挂载还要用）
    sound = null; soundReady = false; soundP = null;
    if (!IS_PLUGIN) document.documentElement.lang = prevLangAttr;
    // 只删自己建的那个节点
    try { if (own && own.parentNode) own.parentNode.removeChild(own); } catch (e) { /* */ }
    own = null; BGFILL = null; VIEW = null; IS_PLUGIN = false; SOUND_OPTS = null;
    SCENE = null;
  };
}
