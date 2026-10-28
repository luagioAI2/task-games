import * as PIXI from 'pixi.js';
import { mountDisplay } from '@makeplay/display';
import { t, tIn, pickLang, setLangRaw, getLang, itemName } from './i18n.js';
                                      
                                                
import { fmt, fmt2 } from './fmt.js';
import {
  newState, parseSave, derive, GENS, UPS, SKILLS, SPECIES, GRADES, GRADE_COLORS,
  upCost, genCost, lvl, sk, pickWeighted, CHEST_GRADE_W, CHEST_ITEM_P, CHEST_ITEMS, CHEST_XP,
  addCoins, spend, addItem, mergeAll, doRebirth, bestGrade, setOf, sanitize, fin,
} from './core.js';
import { Decimal, ZERO, num } from './decimal.js';
import { BOTS, PERKS, SKINS, bot, perk, botCost, perkCost, skinStat } from './core.js';
import {
  ACHS, achStat, achGems, WHEEL, WHEEL_PER, WHEEL_MAX, WHEEL_FREE_MS, BANK_MAX, bankUpCost, CROPS, cropCost, cropCoins, cropReward,
  plotCount, PLOT_MAX, plotCost, SHROOM_MAX, EXPS, expTeam, LABS, labLv, labCost, accrue, fxUnlocked,
} from './features.js';
import { fxIcon } from './fxui.js';
import { SHOP_ITEMS, SHOP_PRICE, shopOwned } from './ui.js';
import { Ui, itemStyle, iconStyle, chestStyle, skinCss, wealthScore } from './ui.js';
import { snd, initSound, applyVolumes } from './audio.js';
import { setName, GAME_TITLE } from './i18n.js';
import { AB } from './base.js';

/**
 * 插件入口（原版是模块体自执行 —— 那种写法第二次挂载会拿到上一次的模块状态）。
 *
 * `opts.container` 由宿主给；`opts.store` 是存档适配层（`latestSync` / `putLatest`）。
 * 返回的 `destroy()` 必须把 ticker / 监听 / 样式 / 调试钩子全部摘掉。
 */
export async function start(opts = {}) {
  /*
   * ★ 名字不能叫 `host`：原版模块体里本来就有一句 `const host = document.getElementById('app')`，
   *   整段包进 start() 之后两处同域 ⇒ `SyntaxError: Identifier 'host' has already been declared`
   *   （而且报在源码第 99 行，看着像「原版代码坏了」）。
   */
  const mountContainer = opts.container ?? document.getElementById('app');
  /** 存档适配层（`latestSync` / `putLatest`）；模块顶层不能声明，每次挂载重设 */
  let saveApi = opts.store ?? null;
  /** 收费回调：由 plugin 侧注入（读存档 paidAt + 扣积分）；独立网页跑时恒放行 */
  let chargePlayFn = opts.chargePlay ?? (async () => true);
  /** 要摘掉的 window/document 监听（卸载时统一摘，别留 `onkeydown` 在宿主上） */
  const offWin = [];
  const listen = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); offWin.push(() => t.removeEventListener(type, fn, opt)); };

  /*
   * ★ 挂载根：宿主容器里再套一层 `#rb-root`，canvas 与 `#ui` 都挂它。
   *   样式表用 `scopeCss(css, '#rb-root')` 收进来 —— 原版那套 CSS 里全是
   *   `.hud` / `.pill` / `.tabs` 这种通用类名，不收会把宿主的顶栏底栏一起改样。
   */
  const hostRoot = document.createElement('div');
  hostRoot.id = 'rb-root';
  hostRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden';
  mountContainer.appendChild(hostRoot);

// ---------------- state ----------------
let S        = newState();
let D         ;
let prefs = { music: true, sfx: true };
// Autosave is written as one JSON text blob (nested arrays/objects survive intact).
// decodeSave also accepts older "kv"-shaped writes (object, possibly with stringified values).
function decodeSave(raw     )               {
  try {
    if (raw == null) return null;
    if (typeof raw === 'string') return raw ? parseSave(JSON.parse(raw)) : null;
    if (typeof raw === 'object') {
      if (typeof raw.state === 'string') return parseSave(JSON.parse(raw.state));
      const o      = {};
      for (const k of Object.keys(raw)) { const v = raw[k]; if (typeof v === 'string' && /^[\[{]/.test(v)) { try { o[k] = JSON.parse(v); } catch { o[k] = v; } } else o[k] = v; }
      return parseSave(o);
    }
  } catch (e) { console.warn('save decode failed', e); }
  return null;
}
const boot = decodeSave(saveApi?.latestSync);
let hadSave = !!boot;
// writes stay off until we are sure no cloud save is still arriving (never overwrite a real save with a fresh state)
let saveReady = !!boot;
if (boot) S = boot;
if ((S       ).prefs) prefs = { ...prefs, ...(S       ).prefs };
D = derive(S);
const savedLang = (S       ).lang                    ;
setLangRaw(savedLang || 'zh'); // ★ 宿主是中文儿童 App ⇒ 默认中文；设置里仍可切 en / ja

function loadFont(lang      ) {
  try {
  } catch { /* fall through */ }
  // 平台字体：宿主没有 gp.fonts，源站那份 woff2 也 404 ⇒ 直接用 FONT 栈里的系统字体
}
loadFont(getLang());

let saveT = 0;
let shopOn = false; // 内购（gp.pay）在宿主里没有通道，整块拆掉
let shopBusy = '';
let ui     = null                 ;
function save() {
  (S       ).prefs = prefs;
  S.lastSeen = Date.now();
  if (!saveReady) return;
  sanitize(S); // never let Infinity/NaN become null in the cloud save
  const sv = saveApi;
  if (!sv?.putLatest) return;
  void sv.putLatest(JSON.stringify(S), 'text').then((ok) => { if (!ok) console.warn('autosave failed'); });
}

// ---------------- pixi ----------------
const host = hostRoot; // 原版是 document.getElementById('app')
const app = new PIXI.Application();
await app.init({ resizeTo: host, autoDensity: true, antialias: true, background: '#DDF3E6', resolution: Math.min(window.devicePixelRatio || 1, 2) });
host.appendChild(app.canvas);
const FONT = 'MpFontDisplay, SmileySans, "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif';

const bg = new PIXI.Graphics();
const world = new PIXI.Container();
const robotLayer = new PIXI.Container();
const btnC = new PIXI.Container();
const chestLayer = new PIXI.Container();
const petLayer = new PIXI.Container();
const fxLayer = new PIXI.Container();
const textLayer = new PIXI.Container();
app.stage.addChild(bg, world);
const haloG = new PIXI.Graphics();
world.addChild(robotLayer, petLayer, haloG, btnC, chestLayer, fxLayer, textLayer);

// loading screen
const loadC = new PIXI.Container();
const loadBar = new PIXI.Graphics();
const spinner = new PIXI.Graphics();
loadC.addChild(loadBar, spinner);
app.stage.addChild(loadC);
let loadP = 0;
function drawLoad() {
  const w = app.screen.width, h = app.screen.height;
  loadBar.clear();
  loadBar.roundRect(w / 2 - 110, h / 2 + 70, 220, 16, 8).fill('#ffffff');
  loadBar.roundRect(w / 2 - 110, h / 2 + 70, 220 * loadP, 16, 8).fill('#FF3B47');
  spinner.clear();
  spinner.circle(0, 0, 46).fill('#C21F2C');
  spinner.circle(0, -8, 46).fill('#EF3340');
  spinner.position.set(w / 2, h / 2);
}

let col = { left: 0, width: 400, height: 700 };

function drawBg(w        , h        ) {
  bg.clear();
  bg.rect(0, 0, w, h).fill('#DDF3E6');
  // side dressing for wide windows
  if (col.left > 8) {
    bg.rect(0, 0, col.left, h).fill('#CBEBDA');
    bg.rect(col.left + col.width, 0, w - col.left - col.width, h).fill('#CBEBDA');
    for (let i = 0; i < 14; i++) {
      const side = i % 2; const x = side ? col.left + col.width + ((i * 97) % Math.max(40, col.left)) : (i * 131) % Math.max(40, col.left);
      bg.circle(x, (i * 173) % h, 30 + (i * 37) % 60).fill({ color: ['#FFC928', '#FF3B47', '#2F8BFF', '#8B5CF6'][i % 4], alpha: 0.12 });
    }
  }
  for (let y = 20; y < h; y += 44) for (let x = col.left + ((y / 44) % 2) * 22 + 10; x < col.left + col.width; x += 44) bg.circle(x, y, 2.2).fill({ color: '#ffffff', alpha: 0.7 });
}

// ---------------- textures ----------------
let tex                               = {};
const chestTex                 = [];
const chestOpenTex                 = [];
const itemTex                 = [];
let coinTex              , robotTex              , gemTex              ;

function sub(t0              , x        , y        , w        , h        ) {
  const k = t0.source.width / 1024;
  return new PIXI.Texture({ source: t0.source, frame: new PIXI.Rectangle(x * k, y * k, w * k, h * k) });
}

// ---------------- button ----------------
const btnBase = new PIXI.Graphics();
const btnTop = new PIXI.Container();
const btnTopG = new PIXI.Graphics();
let hand                     = null;
btnTop.addChild(btnTopG);
btnC.addChild(btnBase, btnTop);
let R = 100; let press = 0; let pressV = 0;
function star(g               , x        , y        , r        , color        , alpha = 1) {
  const pts           = [];
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = -Math.PI / 2 + i * Math.PI / 5; pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.poly(pts).fill({ color, alpha });
}
function drawButton() {
  const k = SKINS[S.skin] || SKINS[0];
  btnBase.clear();
  btnBase.ellipse(0, R * 0.32, R * 1.08, R * 0.98).fill({ color: '#17264A', alpha: 0.12 });
  btnBase.circle(0, R * 0.16, R).fill(k.base);
  btnTopG.clear();
  if (k.pat === 'rainbow') {
    const cols = ['#FF5A5A', '#FF9A3D', '#FFC928', '#2FC48D', '#2F8BFF', '#8B5CF6'];
    cols.forEach((c, i) => btnTopG.circle(0, 0, R * (1 - i * 0.14)).fill(c));
    btnTopG.circle(0, 0, R * 0.2).fill('#ffffff');
  } else {
    btnTopG.circle(0, 0, R).fill(k.top);
    btnTopG.circle(-R * 0.05, -R * 0.06, R * 0.86).fill(k.top2);
  }
  // skin patterns (kept inside the cap circle)
  const spots = [[-0.45, 0.3], [0.5, -0.35], [0.35, 0.5], [-0.15, -0.6], [-0.6, -0.15], [0.62, 0.15], [0.05, 0.68], [-0.38, 0.62]];
  if (k.pat === 'dots') spots.forEach(([x, y], i) => btnTopG.circle(x * R, y * R, R * (0.09 + (i % 3) * 0.02)).fill(k.acc));
  if (k.pat === 'chips') spots.forEach(([x, y], i) => btnTopG.ellipse(x * R, y * R, R * 0.09, R * (0.06 + (i % 2) * 0.03)).fill(k.acc));
  if (k.pat === 'seeds') { btnTopG.circle(0, 0, R).stroke({ color: '#ffffff', width: R * 0.07 }); spots.forEach(([x, y]) => btnTopG.ellipse(x * R * 0.85, y * R * 0.85, R * 0.04, R * 0.07).fill(k.acc)); }
  if (k.pat === 'ring') btnTopG.circle(0, 0, R * 0.62).stroke({ color: k.acc, width: R * 0.08, alpha: 0.7 });
  if (k.pat === 'rings') { btnTopG.circle(0, 0, R * 0.72).stroke({ color: k.acc, width: R * 0.07, alpha: 0.6 }); btnTopG.circle(0, 0, R * 0.42).stroke({ color: k.acc, width: R * 0.07, alpha: 0.6 }); }
  if (k.pat === 'stars' || k.pat === 'cosmic') spots.forEach(([x, y], i) => star(btnTopG, x * R, y * R, R * (0.07 + (i % 3) * 0.035), k.acc, 0.9));
  if (k.pat === 'cosmic') btnTopG.ellipse(0, 0, R * 0.95, R * 0.3).stroke({ color: '#FF7AD9', width: R * 0.05, alpha: 0.6 });
  if (k.pat === 'shine') { btnTopG.circle(0, 0, R * 0.9).stroke({ color: k.acc, width: R * 0.05, alpha: 0.8 }); star(btnTopG, R * 0.5, -R * 0.45, R * 0.12, '#ffffff'); }
  if (k.pat === 'gem') { const p           = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; p.push(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66); } btnTopG.poly(p).stroke({ color: k.acc, width: R * 0.05 }); }
  if (k.pat === 'neon') { btnTopG.circle(0, 0, R * 0.78).stroke({ color: k.acc, width: R * 0.06 }); btnTopG.circle(0, 0, R * 0.94).stroke({ color: '#FF9AB5', width: R * 0.03, alpha: 0.8 }); star(btnTopG, -R * 0.5, R * 0.42, R * 0.1, k.acc); star(btnTopG, R * 0.55, R * 0.3, R * 0.07, '#ffffff'); }
  btnTopG.ellipse(-R * 0.38, -R * 0.5, R * 0.28, R * 0.14).fill({ color: '#ffffff', alpha: 0.35 });
  if (hand) { hand.height = R * 0.95; hand.scale.x = hand.scale.y; hand.position.set(R * 0.04, R * 0.02); }
}
btnC.eventMode = 'static';
btnC.cursor = 'pointer';
btnC.hitArea = { contains: (x        , y        ) => x * x + y * y < (R * 1.08) * (R * 1.08) };

// ---------------- chests on screen ----------------
                                                                                                                            
const chestViews           = [];
let slots                             = [];
let chestSize = 70;

function computeSlots() {
  const pr = ui ? ui.playRect() : { top: 112, bottom: col.height - 90 };
  const cx = col.width / 2, cy = (pr.top + pr.bottom) / 2 + 6;
  const cap = D.cap;
  chestSize = Math.min(R * 0.7, 84);
  const rx = Math.min(col.width / 2 - chestSize * 0.6, R * 2.0);
  const ry = Math.min((pr.bottom - pr.top) / 2 - chestSize * 0.55, R * 1.75);
  slots = [];
  for (let i = 0; i < 12; i++) {
    const n = Math.max(cap, 3);
    const a = -Math.PI / 2 + Math.PI / n + (i % n) * (Math.PI * 2 / n);
    slots.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * Math.max(ry, R * 1.2) + chestSize * 0.4 });
  }
}

function spawnChestView(tier        , slot        , drop         ) {
  const spr = new PIXI.Sprite(chestTex[tier]);
  spr.anchor.set(0.5, 0.9);
  const sc = chestSize / spr.texture.width * 1.15;
  spr.scale.set(sc);
  const p = slots[slot] || { x: col.width / 2, y: 300 };
  spr.position.set(p.x, drop ? p.y - 220 : p.y);
  spr.eventMode = 'static'; spr.cursor = 'pointer';
  const v         = { spr, tier, slot, y0: p.y, vy: 0, landed: !drop, opening: 0 };
  spr.on('pointerdown', (e                            ) => { e.stopPropagation(); openChest(v); });
  chestLayer.addChild(spr);
  chestViews.push(v);
  if (tier === 3) {
    const glow = new PIXI.Graphics();
    glow.circle(0, -spr.texture.height * 0.4, spr.texture.width * 0.62).fill({ color: '#FFE36E', alpha: 0.35 });
    spr.addChildAt(glow, 0);
  }
}

function freeSlot() {
  for (let i = 0; i < D.cap; i++) if (!chestViews.some(c => c.slot === i && c.opening === 0)) return i;
  return -1;
}

function rebuildChests() {
  for (const c of chestViews) c.spr.destroy({ children: true });
  chestViews.length = 0;
  computeSlots();
  S.chests.forEach((tier, i) => spawnChestView(tier, i, false));
}

function dropChest(tier        ) {
  if (S.chests.length >= D.cap) return false;
  const slot = freeSlot(); if (slot < 0) return false;
  S.chests.push(tier);
  // keep S.chests ordered by slot index: store as array aligned to slot
  spawnChestView(tier, slot, true);
  syncChestArray();
  return true;
}
function syncChestArray() {
  const live = chestViews.filter(c => c.opening === 0).sort((a, b) => a.slot - b.slot);
  S.chests = live.map(c => c.tier);
}

let itemSeq = 0;
function openChest(v        ) {
  if (v.opening) return;
  v.opening = 0.001;
  v.spr.texture = chestOpenTex[v.tier];
  v.spr.scale.set(chestSize / v.spr.texture.width * 1.15);
  syncChestArray();
  S.opened++;
  const tier = v.tier;
  const rnd = 0.8 + Math.random() * 0.4;
  const coinM = [15, 60, 250, 1200][tier], cpsM = [10, 40, 150, 600][tier];
  const coins = Decimal.max(D.clickValue.mul(coinM), D.cps.mul(cpsM)).mul((1 + D.bonus.chestCoins / 100) * rnd);
  addCoins(S, coins);
  S.xp += CHEST_XP[tier];
  const gp0 = [Math.random() < 0.25 ? 1 : 0, 1 + (Math.random() < 0.5 ? 1 : 0), 3 + Math.floor(Math.random() * 3), 10 + Math.floor(Math.random() * 10)][tier];
  const gemsGot = Math.round(gp0 * D.gemMult);
  S.gems += gemsGot;
  const p = v.spr.position;
  burstCoins(p.x, p.y - chestSize * 0.5, 6 + tier * 4);
  const cy0 = p.y - chestSize * 0.55;
  flash(p.x, cy0, chestSize * (1.2 + tier * 0.35), TIER_FX[tier][0], 0.4, 0.75);
  sparkBurst(p.x, cy0, 8 + tier * 8, TIER_FX[tier], { speed: 300 + tier * 90, up: 160, grav: 650, size: 0.9 + tier * 0.12 });
  if (tier >= 2) rays(p.x, cy0, chestSize * (1.6 + tier * 0.4), tier === 3 ? '#FFFFFF' : '#FFE36E', 1.1);
  if (tier === 3) { shake(8, 0.35); sparkBurst(p.x, cy0, 20, RAINBOW, { speed: 520, up: 200, grav: 500, size: 1.2, tex: 0 }); }
  floatText(p.x, p.y - chestSize * 1.1, '+' + fmt(coins), '#FFC928', 26);
  void snd?.playCue('sfx.chest_open', { eventId: 'open:' + S.opened, pitchSemitones: tier });
  let items = 0;
  if (Math.random() < CHEST_ITEM_P[tier]) items = CHEST_ITEMS[tier];
  if (items && Math.random() < 0.05 * sk(S, 'l4')) items++;
  for (let i = 0; i < items; i++) {
    const g = pickWeighted(CHEST_GRADE_W[tier]);
    const sp = Math.floor(Math.random() * SPECIES);
    gainItem(sp, g, p.x + (i - (items - 1) / 2) * 50, p.y - chestSize * 0.6);
  }
  onEconomyChange();
}

function gainItem(sp        , g        , x        , y        ) {
  const prevBond = D.bonds[setOf(sp)];
  const isNew = addItem(S, sp, g);
  itemSeq++;
  if (x >= 0) itemPop(sp, g, x, y);
  if (g >= 2 || isNew) {
    ui.toast(itemStyle(sp), `${isNew ? t('newItem') + ' ' : t('got') + ' '}${t('grade' + g)} · ${itemName(sp)}`, GRADE_COLORS[g]);
  }
  if (g >= 2) void snd?.playCue('sfx.rare', { eventId: 'rare:' + itemSeq });
  D = derive(S);
  const nb = D.bonds[setOf(sp)];
  if (nb > prevBond) {
    ui.toast(itemStyle(sp), t('setDone', { v: setName(setOf(sp)) }) + ` ×${nb}`, '#FFB800');
    confetti(36); rays(btnC.x, btnC.y, R * 2.6, '#FFE36E', 1.4);
    void snd?.playCue('sfx.levelup', { eventId: 'bond:' + itemSeq });
  }
  return isNew;
}

// ---------------- FX ----------------
;                                                                                                                           
const parts      = [];
function burstCoins(x        , y        , n        ) {
  n = Math.min(n, 24);
  for (let i = 0; i < n; i++) {
    if (parts.length > 160) break;
    const s = new PIXI.Sprite(coinTex); s.anchor.set(0.5);
    const sz = 18 + Math.random() * 10; s.scale.set(sz / coinTex.width);
    s.position.set(x, y);
    fxLayer.addChild(s);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const sp = 260 + Math.random() * 320;
    parts.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.1 + Math.random() * 0.3, kind: 0 });
  }
}
// shared white textures, tinted per particle (cheap: one sprite each, no per-particle Graphics)
let sparkTex              , dotTex              , shardTex              , raysTex              , softTex              ;
function makeFxTextures() {
  const s = new PIXI.Graphics();
  s.poly([0, -32, 7, -7, 32, 0, 7, 7, 0, 32, -7, 7, -32, 0, -7, -7]).fill('#ffffff');
  sparkTex = app.renderer.generateTexture({ target: s, resolution: 1 });
  const d = new PIXI.Graphics(); d.circle(0, 0, 16).fill('#ffffff'); dotTex = app.renderer.generateTexture({ target: d, resolution: 1 });
  const r = new PIXI.Graphics(); r.roundRect(-10, -5, 20, 10, 3).fill('#ffffff'); shardTex = app.renderer.generateTexture({ target: r, resolution: 1 });
  const ry = new PIXI.Graphics();
  for (let i = 0; i < 12; i++) { const a0 = i * Math.PI / 6, a1 = a0 + Math.PI / 14; ry.poly([0, 0, Math.cos(a0) * 128, Math.sin(a0) * 128, Math.cos(a1) * 128, Math.sin(a1) * 128]).fill({ color: '#ffffff', alpha: 0.85 }); }
  raysTex = app.renderer.generateTexture({ target: ry, resolution: 1 });
  const so = new PIXI.Graphics();
  for (let i = 10; i >= 1; i--) so.circle(0, 0, i * 6.4).fill({ color: '#ffffff', alpha: 0.1 });
  softTex = app.renderer.generateTexture({ target: so, resolution: 1 });
}
const RAINBOW = ['#FF5A5A', '#FF9A3D', '#FFC928', '#2FC48D', '#2F8BFF', '#8B5CF6', '#FF6FA8'];
const TIER_FX = [['#C7834A', '#FFC928', '#ffffff'], ['#BFD3E6', '#ffffff', '#7FD8F0'], ['#FFC928', '#FFE36E', '#FF9A3D', '#ffffff'], RAINBOW];
                                                                                                                        
const sparks          = [];
function sparkBurst(x        , y        , n        , colors          , o                                                                                               = {}) {
  if (!sparkTex) return;
  const speed = o.speed ?? 320, grav = o.grav ?? 700, size = o.size ?? 1, spread = o.spread ?? Math.PI * 2, up = o.up ?? 0;
  for (let i = 0; i < n; i++) {
    if (sparks.length > 240) { const old = sparks.shift() ; old.s.destroy(); }
    const kind = o.tex ?? (i % 3);
    const tx = kind === 0 ? sparkTex : kind === 1 ? shardTex : dotTex;
    const s = new PIXI.Sprite(tx); s.anchor.set(0.5); s.tint = colors[i % colors.length];
    const s0 = (kind === 0 ? 0.32 : kind === 1 ? 0.6 : 0.3) * size * (0.6 + Math.random() * 0.7);
    s.scale.set(s0); s.position.set(x, y); s.rotation = Math.random() * 6.28;
    fxLayer.addChild(s);
    const a = (spread >= 6.28 ? Math.random() * 6.28 : -Math.PI / 2 + (Math.random() - 0.5) * spread);
    const sp = speed * (0.45 + Math.random() * 0.75);
    sparks.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up, vr: (Math.random() - 0.5) * 14, g: grav, life: 0, max: 0.6 + Math.random() * 0.6, s0 });
  }
}
;                                                                                                                       
const glows         = [];
function flash(x        , y        , radius        , color        , dur = 0.35, alpha = 0.9) {
  if (!softTex) return;
  const s = new PIXI.Sprite(softTex); s.anchor.set(0.5); s.tint = color; s.blendMode = 'add'; s.position.set(x, y); s.alpha = alpha;
  fxLayer.addChildAt(s, 0);
  glows.push({ s, life: 0, max: dur, s0: radius / 64 * 0.4, s1: radius / 64, a0: alpha, vr: 0, vy: 0 });
}
function rays(x        , y        , radius        , color        , dur = 1.1, vy = 0) {
  if (!raysTex) return;
  const s = new PIXI.Sprite(raysTex); s.anchor.set(0.5); s.tint = color; s.position.set(x, y); s.alpha = 0;
  fxLayer.addChildAt(s, 0);
  glows.push({ s, life: 0, max: dur, s0: radius / 128 * 0.3, s1: radius / 128, a0: 0.75, vr: 1.6, vy });
}
let shakeT = 0, shakeA = 0;
function shake(amp        , dur = 0.3) { if (amp > shakeA * (shakeT > 0 ? 1 : 0)) { shakeA = amp; } shakeT = Math.max(shakeT, dur); }
function confetti(n        ) {
  const pr = ui.playRect();
  for (let k = 0; k < 3; k++) sparkBurst(col.width * (0.2 + k * 0.3), pr.top + 10, Math.ceil(n / 3), RAINBOW, { speed: 360, up: 120, grav: 520, spread: 2.4, size: 1.1, tex: 1 });
}
let lastBump = 0;
function bumpCoins() {
  const now = performance.now(); if (now - lastBump < 120) return; lastBump = now;
  const el = document.getElementById('coinTxt')?.parentElement;
  el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
}
function updateFx(dt        ) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]; p.life += dt;
    p.vy += p.g * dt; p.vx *= 0.985; p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.rotation += p.vr * dt;
    const k = p.life / p.max;
    p.s.scale.set(p.s0 * (k < 0.1 ? 0.5 + k * 5 : 1 - Math.max(0, k - 0.5)));
    p.s.alpha = k > 0.6 ? (1 - k) / 0.4 : 1;
    if (k >= 1) { p.s.destroy(); sparks.splice(i, 1); }
  }
  for (let i = glows.length - 1; i >= 0; i--) {
    const q = glows[i]; q.life += dt;
    const k = Math.min(1, q.life / q.max), e = 1 - Math.pow(1 - k, 3);
    q.s.scale.set(q.s0 + (q.s1 - q.s0) * e);
    if (q.vr) { q.s.rotation += q.vr * dt; q.s.alpha = q.a0 * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8); q.vy *= 0.93; q.s.y += q.vy * dt; }
    else q.s.alpha = q.a0 * (1 - k);
    if (k >= 1) { q.s.destroy(); glows.splice(i, 1); }
  }
  // screen shake (world container only; HUD stays steady)
  if (shakeT > 0) {
    shakeT -= dt; const a = shakeA * Math.max(0, shakeT) / 0.3;
    world.position.set(col.left + (Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a);
    if (shakeT <= 0) { shakeA = 0; world.position.set(col.left, 0); }
  }
}
function drawHalo(now        ) {
  const heat = Math.min(1, combo / 60);
  const fz = frenzyT > 0 ? 1 : 0;
  const a = Math.max(heat * 0.55, fz * 0.6);
  haloG.clear();
  if (a < 0.02) return;
  const pulse = 1 + Math.sin(now / (fz ? 90 : 160)) * 0.04;
  const c = fz ? '#FF8A3D' : heat > 0.66 ? '#FF3B47' : heat > 0.33 ? '#FF9A3D' : '#FFC928';
  for (let i = 0; i < 4; i++) haloG.circle(0, R * 0.08, R * (1.12 + i * 0.12) * pulse).fill({ color: c, alpha: a * (0.32 - i * 0.07) });
  haloG.position.set(btnC.x, btnC.y);
}
function itemPop(sp        , g        , x        , y        ) {
  if (g >= 2) { rays(x, y, g === 3 ? 130 : 95, GRADE_COLORS[g], 1.4, -170); sparkBurst(x, y, g === 3 ? 22 : 12, g === 3 ? ['#FFE36E', '#FFB800', '#ffffff'] : ['#C8A2FF', '#A35BF0', '#ffffff'], { speed: 300, grav: 300 }); flash(x, y, 90, GRADE_COLORS[g], 0.5, 0.8); }
  const c = new PIXI.Container();
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, 40).fill({ color: GRADE_COLORS[g], alpha: 0.35 });
  ring.circle(0, 0, 30).fill({ color: '#ffffff', alpha: 0.85 });
  const s = new PIXI.Sprite(itemTex[sp]); s.anchor.set(0.5); s.scale.set(58 / s.texture.width);
  c.addChild(ring, s);
  c.position.set(x, y);
  fxLayer.addChild(c);
  parts.push({ s: c, vx: 0, vy: -170, life: 0, max: 1.4, kind: 2 });
}
function ripple(x        , y        ) {
  const g = new PIXI.Graphics();
  g.circle(0, 0, R).stroke({ color: '#FF3B47', width: 6, alpha: 0.5 });
  g.position.set(x, y);
  fxLayer.addChild(g);
  parts.push({ s: g, vx: 0, vy: 0, life: 0, max: 0.45, kind: 3 });
}
const floats      = [];
function floatText(x        , y        , txt        , color        , size        , burst         ) {
  if (floats.length > 26) { const f = floats.shift() ; f.s.destroy({ children: true }); }
  const c = new PIXI.Container();
  if (burst) {
    const g = new PIXI.Graphics();
    const pts           = []; const n = 14;
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? size * 1.4 : size * 2.4; const a = i / (n * 2) * Math.PI * 2; pts.push(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.75); }
    g.poly(pts).fill(burst);
    c.addChild(g);
  }
  const tx = new PIXI.Text({ text: txt, style: { fontFamily: FONT, fontSize: size, fontWeight: '900', fill: color, stroke: { color: '#17264A', width: Math.max(4, size / 6) }, align: 'center' } });
  tx.anchor.set(0.5);
  c.addChild(tx);
  c.position.set(x, y);
  c.rotation = (Math.random() - 0.5) * 0.2;
  textLayer.addChild(c);
  floats.push({ s: c, vx: (Math.random() - 0.5) * 30, vy: -110, life: 0, max: burst ? 1.1 : 0.9, kind: 1 });
}

function critText(x        , y        , label        , value        , mega         ) {
  if (floats.length > 26) { const f = floats.shift() ; f.s.destroy({ children: true }); }
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const pts           = []; const n = 12, ro = mega ? 92 : 78, ri = mega ? 62 : 54;
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro; const a = i / (n * 2) * Math.PI * 2; pts.push(Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.78); }
  g.poly(pts).fill('#17264A');
  const inner = pts.map(v => v * 0.9);
  g.poly(inner).fill(mega ? '#8B5CF6' : '#FF3B47');
  g.poly(inner.map(v => v * 0.72)).fill({ color: '#ffffff', alpha: 0.16 });
  c.addChild(g);
  const lt = new PIXI.Text({ text: label, style: { fontFamily: FONT, fontSize: mega ? 30 : 26, fontWeight: '900', fill: '#FFE600', stroke: { color: '#17264A', width: 6 }, align: 'center' } });
  lt.anchor.set(0.5); lt.y = -14;
  const vt = new PIXI.Text({ text: value, style: { fontFamily: FONT, fontSize: mega ? 30 : 26, fontWeight: '900', fill: '#ffffff', stroke: { color: '#17264A', width: 6 }, align: 'center' } });
  vt.anchor.set(0.5); vt.y = 18;
  const maxW = (mega ? 92 : 78) * 2.2;
  for (const tx of [lt, vt]) if (tx.width > maxW) tx.scale.set(maxW / tx.width);
  c.addChild(lt, vt);
  c.position.set(Math.max(100, Math.min(col.width - 100, x)), y);
  c.rotation = (Math.random() - 0.5) * 0.25;
  textLayer.addChild(c);
  floats.push({ s: c, vx: (Math.random() - 0.5) * 20, vy: -80, life: 0, max: mega ? 1.3 : 1.05, kind: 1 });
}

// ---------------- frenzy visuals: sunburst behind button, edge glow, banner with draining bar ----------------
const frenzyRays = new PIXI.Graphics();
const frenzyEdge = new PIXI.Graphics();
const frenzyMask = new PIXI.Graphics();
frenzyRays.mask = frenzyMask;
world.addChildAt(frenzyEdge, 0); world.addChildAt(frenzyRays, 0); world.addChildAt(frenzyMask, 0);
const frenzyBanner = new PIXI.Container();
const fbBg = new PIXI.Graphics();
const fbBar = new PIXI.Graphics();
const fbText = new PIXI.Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fontWeight: '900', fill: '#FFE600', stroke: { color: '#17264A', width: 5 } } });
fbText.anchor.set(0.5, 0.5);
const fbTime = new PIXI.Text({ text: '', style: { fontFamily: FONT, fontSize: 16, fontWeight: '900', fill: '#ffffff' } });
fbTime.anchor.set(1, 0.5);
frenzyBanner.addChild(fbBg, fbBar, fbText, fbTime);
frenzyBanner.visible = false; frenzyRays.visible = false; frenzyEdge.visible = false;
const FRENZY_DUR = 20;
let frenzyA = 0;
function drawFrenzyRays() {
  frenzyRays.clear();
  const n = 16, r0 = R * 1.05, r1 = Math.max(col.width, col.height) * 0.75;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n * 0.9;
    frenzyRays.poly([Math.cos(a0) * r0, Math.sin(a0) * r0, Math.cos(a0) * r1, Math.sin(a0) * r1, Math.cos(a1) * r1, Math.sin(a1) * r1, Math.cos(a1) * r0, Math.sin(a1) * r0])
      .fill({ color: i % 2 ? '#FFC928' : '#FF8A3D', alpha: 0.35 });
  }
  frenzyRays.circle(0, 0, R * 1.18).fill({ color: '#FFC928', alpha: 0.45 });
}
function drawFrenzyEdge() {
  frenzyEdge.clear();
  const w = col.width, h = col.height;
  for (let i = 0; i < 6; i++) frenzyEdge.rect(i * 4, i * 4, w - i * 8, h - i * 8).stroke({ color: '#FF8A3D', width: 4, alpha: 0.5 - i * 0.08 });
}
function updateFrenzyUi(dt        , now        ) {
  const on = frenzyT > 0;
  frenzyA += ((on ? 1 : 0) - frenzyA) * Math.min(1, dt * 6);
  const vis = frenzyA > 0.02;
  frenzyRays.visible = frenzyEdge.visible = frenzyBanner.visible = vis;
  if (!vis) return;
  frenzyRays.position.set(btnC.x, btnC.y);
  frenzyRays.rotation = now / 2600;
  frenzyRays.alpha = frenzyA * (0.8 + Math.sin(now / 160) * 0.2);
  frenzyEdge.alpha = frenzyA * (0.55 + Math.sin(now / 120) * 0.45);
  const bw = Math.min(col.width - 40, 300), bh = 50;
  fbBg.clear();
  fbBg.roundRect(-bw / 2, -bh / 2 + 4, bw, bh, 25).fill('#17264A');
  fbBg.roundRect(-bw / 2, -bh / 2, bw, bh, 25).fill('#FF8A3D');
  fbBg.roundRect(-bw / 2 + 6, bh / 2 - 14, bw - 12, 8, 4).fill({ color: '#17264A', alpha: 0.35 });
  const k = Math.max(0, Math.min(1, frenzyT / frenzyMax));
  fbBar.clear();
  if (k > 0) fbBar.roundRect(-bw / 2 + 6, bh / 2 - 14, (bw - 12) * k, 8, 4).fill(k < 0.25 && Math.sin(now / 80) > 0 ? '#ffffff' : '#FFE600');
  fbText.text = frenzyX >= 10 ? t('frenzy_super') : t('lucky_frenzy');
  fbText.scale.set(1);
  if (fbText.width > bw - 70) fbText.scale.set((bw - 70) / fbText.width);
  fbText.position.set(-14, -5);
  { const sec = Math.ceil(Math.max(0, frenzyT)); fbTime.text = sec >= 60 ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : sec + 's'; }
  fbTime.position.set(bw / 2 - 14, -5);
  const by = Math.max(ui.playRect().top + 34, btnC.y - R * 1.42);
  frenzyBanner.position.set(col.width / 2, by);
  const pulse = 1 + Math.sin(now / 140) * 0.04;
  frenzyBanner.scale.set(pulse * (0.6 + frenzyA * 0.4));
  frenzyBanner.alpha = frenzyA;
}

// combo + hints
const comboText = new PIXI.Text({ text: '', style: { fontFamily: FONT, fontSize: 22, fontWeight: '900', fill: '#17264A' } });
comboText.anchor.set(0.5);
const hintText = new PIXI.Text({ text: '', style: { fontFamily: FONT, fontSize: 20, fontWeight: '900', fill: '#5B6B8C' } });
hintText.anchor.set(0.5);
const titleText = new PIXI.Text({ text: GAME_TITLE, style: { fontFamily: FONT, fontSize: 30, fontWeight: '900', fill: '#17264A', align: 'center', wordWrap: true, wordWrapWidth: 300 } });
titleText.anchor.set(0.5);
// ★ 不写 document.title —— 那是宿主的标题栏
textLayer.addChild(comboText, hintText, titleText, frenzyBanner);

// robots orbiting
const robots                = [];
let autoHand                     = null;
let autoHandT = 0;

// ---------------- clicking ----------------
let combo = 0, comboT = 0;
/*
 * 收费点：**这一档的第一次真实按键**。
 *
 * 本作是放置点击器，没有「开始一局」这个动作 —— 进来的核心操作就是按那颗红按钮，
 * 所以把「一局」定义成「一次进场的第一下」。收过就不再收；切走再切回来时，
 * plugin 侧用**存档里的 paidAt** 判 10 分钟宽限，不会重复扣。
 *
 * ★ 必须 await 扣款再按键：放行之前按下去就是白玩。
 * ★ 被挡时**不卸载界面**，只是这一下不算 —— 孩子还能看见游戏、看见提示。
 */
let paidThisMount = false;
async function pressManual(px, py) {
  if (!paidThisMount) {
    if (!(await chargePlayFn())) return;
    paidThisMount = true;
  }
  pressButton(px, py, true);
}

function pressButton(px        , py        , manual         ) {
  const r = Math.random();
  let mult = 1, kind = 0;
  if (r < D.megaChance) { mult = 50; kind = 2; }
  else if (Math.random() < D.critChance) { mult = D.critMult; kind = 1; }
  let comboB = 1;
  if (manual && S.fx.wheelTok < WHEEL_MAX) { if (++S.fx.wheelProg >= WHEEL_PER) { S.fx.wheelProg = 0; S.fx.wheelTok++; } }
  if (manual) { combo = Math.min(combo + 1, 99999); comboT = 1.2; comboB = 1 + Math.min(combo, D.comboCap) * 0.01; }
  const v = D.clickValue.mul(mult * comboB * (frenzyT > 0 ? frenzyX : 1));
  addCoins(S, v);
  S.clicks++;
  S.xp += manual ? 1 : 0.25;
  press = 1; pressV = 0;
  ripple(btnC.x, btnC.y);
  // per-press sparkle; a hot combo throws more and changes colour
  const heat = Math.min(1, combo / 60);
  sparkBurst(px, py, manual ? 3 + Math.round(heat * 5) : 1, heat > 0.66 ? ['#FF3B47', '#FFC928', '#ffffff'] : heat > 0.33 ? ['#FF9A3D', '#FFE36E'] : ['#ffffff', '#FFE36E'], { speed: 260 + heat * 160, up: 80, grav: 900, size: 0.8 });
  if (frenzyT > 0 && manual) sparkBurst(px, py, 3, ['#FF8A3D', '#FFC928', '#FF5A5A'], { speed: 420, up: 120, size: 0.9, tex: 0 });
  if (kind === 2) {
    flash(btnC.x, btnC.y, R * 2.6, '#A35BF0', 0.5); rays(btnC.x, btnC.y, R * 2.4, '#C8A2FF', 1.0);
    sparkBurst(px, py, 34, ['#A35BF0', '#FF6FA8', '#FFE36E', '#ffffff'], { speed: 560, up: 100, size: 1.3 });
    shake(11, 0.4);
    critText(px, py - 60, t('mega') + ' ×50', '+' + fmt(v), true);
    void snd?.playCue('sfx.crit', { eventId: 'mega:' + S.clicks, pitchSemitones: -5 });
    burstCoins(px, py, 18);
  } else if (kind === 1) {
    flash(px, py, R * 1.6, '#FF8A3D', 0.32); sparkBurst(px, py, 16, ['#FF3B47', '#FFC928', '#ffffff'], { speed: 440, up: 80, size: 1.1 });
    shake(4, 0.2);
    critText(px, py - 60, `${t('crit')} ×${fmt(mult)}`, '+' + fmt(v), false);
    void snd?.playCue('sfx.crit', { eventId: 'crit:' + S.clicks });
    burstCoins(px, py, 8);
  } else {
    floatText(px, py - 30, '+' + fmt(v), '#ffffff', 26);
    burstCoins(px, py, manual ? 2 : 1);
  }
  void snd?.playCue('sfx.press', { eventId: 'press:' + S.clicks, pitchSemitones: (Math.random() - 0.5) * 2 + Math.min(combo, 60) * 0.06 });
  // chest roll
  let chance = D.chestChance * (manual ? 1 : 0.5);
  if (!S.firstChest && S.clicks >= 8) { chance = 1; S.firstChest = true; }
  if (Math.random() < chance) {
    const tier = S.opened < 1 ? 0 : pickWeighted(D.tierW);
    if (dropChest(tier)) void snd?.playCue('sfx.chest_drop', { eventId: 'drop:' + S.clicks });
    else if (manual && Math.random() < 0.3) chestFullT = 1.6;
  }
}
let chestFullT = 0;
let frenzyT = 0;
let frenzyX = 7, frenzyMax = FRENZY_DUR;   // multiplier and full length of the running frenzy (shop: ×10 for 10 min)
function startFrenzy(sec        , x = 7) {
  if (frenzyT <= 0) frenzyX = x; else frenzyX = Math.max(frenzyX, x);
  frenzyT = Math.max(frenzyT, sec); frenzyMax = Math.max(frenzyT, FRENZY_DUR);
}

btnC.on('pointerdown', (e                            ) => {
  const p = world.toLocal(e.global);
  void pressManual(p.x, p.y);
});
listen(window, 'keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && ready) {
    e.preventDefault();
    void pressManual(btnC.x + (Math.random() - 0.5) * R, btnC.y - R * 0.3, true);
  }
});

// ---------------- economy actions ----------------
let lastLevelCheck = 0;
function onEconomyChange() { D = derive(S); }
function checkLevel() {
  while (S.xp >= D.xpNeed) {
    S.xp -= D.xpNeed; S.level++;
    const gain = 1 + (S.level % 5 === 0 ? 1 : 0);
    S.sp += gain;
    D = derive(S);
    ui.toast(iconStyle(1), t('levelUp', { v: gain }), '#2FC48D');
    confetti(24); flash(btnC.x, btnC.y, R * 2.2, '#2FC48D', 0.5, 0.6);
    void snd?.playCue('sfx.levelup', { eventId: 'lv:' + S.level });
    save();
  }
}

function checkTabs(announce         ) {
  const want                          = {
    up: S.lifeCoins.gte(10),
    col: S.seen.some(x => x > 0),
    sk: S.level >= 2,
    bot: S.lifeCoins.gte(600),
    gacha: S.gems >= 5 || S.pulls > 0 || S.opened >= 6,
    reb: S.lifeCoins.gte(1e6) || S.rebirths > 0,
  };
  for (const k of ['up', 'sk', 'bot', 'col', 'gacha', 'reb']) {
    if (want[k] && !S.tabs.includes(k)) {
      S.tabs.push(k); ui.unlockTab(k, announce);
      if (announce) void snd?.playCue('sfx.levelup', { eventId: 'tab:' + k });
      if (k === 'gacha' && announce) { S.gems += 20; setTimeout(() => ui.toast(iconStyle(3), t('gacha_gift', { v: 20 }), '#A35BF0'), 900); }
      save();
    }
  }
  // button skins (achievement-style unlocks)
  for (let i = 1; i < SKINS.length; i++) {
    if (S.skins & (1 << i)) continue;
    if (skinStat(S, D, SKINS[i].req) >= SKINS[i].v) {
      S.skins |= 1 << i; D = derive(S);
      if (announce) {
        ui.newSkin = true;
        ui.toast(skinCss(i), t('skin_new', { v: t('s' + i) }), '#FF6FA8');
        void snd?.playCue('sfx.rare', { eventId: 'skin:' + i });
      }
      save();
    }
  }
}

// ---------------- six top-row systems ----------------
function grantChest(tier        ) {
  if (dropChest(tier)) return;
  const g = Math.round([3, 5, 10, 25][tier] * D.gemMult);
  S.gems += g;
  ui.toast(iconStyle(5), t('chestToGems', { v: g }), '#8B5CF6');
}
function fxReward(coins         , gems        , fxIconIdx        , label        ) {
  const has = coins.gt(0);
  if (has) { addCoins(S, coins); burstCoins(btnC.x, btnC.y, 16); }
  if (gems > 0) S.gems += gems;
  ui.toast(fxIcon(fxIconIdx), label + (has ? ' +' + fmt(coins) : '') + (gems > 0 ? ' · +' + gems : ''), '#2FC48D');
}
function fxAction(verb        , arg        )         {
  const f = S.fx, now = Date.now();
  let ok = -1;
  switch (verb) {
    case 'claim': {
      const i = +arg, a = ACHS[i];
      if (!a || f.ach.includes(i) || achStat(S, D, a.stat) < a.v) break;
      f.ach.push(i); S.gems += achGems(a); D = derive(S); ok = 0;
      void snd?.playCue('sfx.levelup', { eventId: 'ach:' + i });
      break;
    }
    case 'spin': {
      // ★ 「每 4 小时 1 次免费」已拆：那是「不上线就亏」的钩子。
      //   保留「每按 100 次得 1 张券」，券是本作唯一的转盘来源。
      if (f.wheelTok <= 0) break;
      f.wheelTok--;
      const p = pickWeighted(WHEEL.map(x => x.w)); const w = WHEEL[p];
      f.spins++;
      void snd?.playCue('sfx.gacha', { eventId: 'spin:' + f.spins });
      // reward applied now (safe even if the modal is closed early)
      if (w.k === 'coins') addCoins(S, Decimal.max(D.cps.mul(w.v), D.clickValue.mul(w.v / 2)));
      else if (w.k === 'gems') S.gems += Math.round(w.v * D.gemMult);
      else if (w.k === 'chest') grantChest(w.v);
      else if (w.k === 'frenzy') startFrenzy(FRENZY_DUR);
      else { addCoins(S, Decimal.max(D.cps.mul(w.v), D.clickValue.mul(w.v / 2))); S.gems += Math.round(50 * D.gemMult); }
      ok = p;
      break;
    }
    case 'dep': {
      const amt = S.coins.mul(Math.min(100, Math.max(0, +arg || 0)) / 100).floor();
      if (amt.lte(0) || !spend(S, amt)) break;
      f.bank = f.bank.add(amt); f.bankP = f.bankP.add(amt); f.bankT = now; ok = 0;
      void snd?.playCue('sfx.coin', { eventId: 'dep:' + now });
      break;
    }
    case 'wd': {
      if (f.bank.lte(0)) break;
      const interest = Decimal.max(0, f.bank.sub(f.bankP));
      S.coins = S.coins.add(f.bank.sub(interest)); addCoins(S, interest);
      burstCoins(btnC.x, btnC.y, 20);
      f.bank = ZERO; f.bankP = ZERO; ok = 0;
      void snd?.playCue('sfx.buy', { eventId: 'wd:' + now });
      break;
    }
    case 'bankup': {
      const c = bankUpCost(f);
      if (f.bankLv >= BANK_MAX || S.gems < c) break;
      S.gems -= c; f.bankLv++; ok = 0;
      void snd?.playCue('sfx.levelup', { eventId: 'bankup:' + f.bankLv });
      break;
    }
    case 'plant': {
      const [ps, cs] = arg.split(':'); const pi = +ps, ci = +cs;
      if (pi < 0 || pi >= plotCount(f) || f.garden[pi] || !CROPS[ci]) break;
      const cost = cropCost(ci, D);
      if (CROPS[ci].costKind === 'coins') { if (!spend(S, cost)) break; } else { const g = num(cost); if (S.gems < g) break; S.gems -= g; }
      while (f.garden.length <= pi) f.garden.push(null);
      f.garden[pi] = { c: ci, t: now }; ok = 0;
      void snd?.playCue('sfx.chest_drop', { eventId: 'plant:' + now });
      break;
    }
    case 'harvest': case 'harvestAll': {
      const list = verb === 'harvest' ? [+arg] : Array.from({ length: plotCount(f) }, (_, i) => i);
      for (const i of list) {
        const p = f.garden[i];
        if (!p || now < p.t + CROPS[p.c].min * 60e3) continue;
        f.garden[i] = null; f.harvests++; ok = 0;
        if (p.c === 0) fxReward(cropCoins(D), 0, 1, t('crop0'));
        else if (p.c === 1) { const g = cropReward(1, D); S.gems += g; ui.toast(iconStyle(5), t('crop1') + ' +' + g, '#8B5CF6'); }
        else if (p.c === 2) grantChest(Math.random() < 0.25 ? 3 : 2);
        else { f.shroom = Math.min(SHROOM_MAX, f.shroom + 1); D = derive(S); ui.toast(fxIcon(1), t('crop3') + ' · ' + t('crop3_d'), '#FF6FA8'); }
      }
      if (ok === 0) void snd?.playCue('sfx.merge', { eventId: 'harvest:' + f.harvests });
      break;
    }
    case 'plot': {
      const c = plotCost(f);
      if (plotCount(f) >= PLOT_MAX || S.gems < c) break;
      S.gems -= c; f.plots++; ok = 0;
      void snd?.playCue('sfx.buy', { eventId: 'plot:' + f.plots });
      break;
    }
    case 'send': {
      const i = +arg, e = EXPS[i];
      if (!e || f.exp[i] || D.collected < e.need) break;
      f.exp[i] = now; ok = 0;
      void snd?.playCue('sfx.ui', { eventId: 'send:' + i + ':' + now });
      break;
    }
    case 'back': {
      const i = +arg, e = EXPS[i];
      if (!e || !f.exp[i] || now < f.exp[i] + e.min * 60e3) break;
      f.exp[i] = 0; f.expDone++; ok = 0;
      const team = expTeam(D);
      if (i === 0) { fxReward(Decimal.max(D.cps.mul(300), D.clickValue.mul(150)).mul(team), 0, 4, t('ex0')); grantChest(1); }
      else if (i === 1) { const g = Math.round(12 * team * D.gemMult); S.gems += g; ui.toast(fxIcon(4), t('ex1') + ' +' + g, '#8B5CF6'); grantChest(2); }
      else { const g = Math.round(40 * team * D.gemMult); S.gems += g; S.sp += 1; ui.toast(fxIcon(4), t('ex2') + ' +' + g + ' · +1 SP', '#8B5CF6'); grantChest(3); }
      void snd?.playCue('sfx.rare', { eventId: 'exp:' + f.expDone });
      break;
    }
    case 'lab': {
      const l = LABS.find(x => x.id === arg);
      if (!l || labLv(f, l.id) >= l.max) break;
      const c = labCost(f, l);
      if (l.gems) { if (S.gems < c) break; S.gems -= c; } else { if (f.rp < c) break; f.rp -= c; }
      f.lab[l.id] = labLv(f, l.id) + 1; D = derive(S); ok = 0;
      void snd?.playCue('sfx.buy', { eventId: 'lab:' + l.id + ':' + f.lab[l.id] });
      break;
    }
  }
  if (ok >= 0) { ui.hud(); save(); }
  return ok;
}

const api = {
  fx: (verb        , arg        ) => fxAction(verb, arg),
  st: () => S, dv: () => D,
  buyUp(id        , n        ) {
    const u = UPS.find(x => x.id === id) ;
    n = Math.min(n, u.max - lvl(S, id)); if (n <= 0) return;
    const c = upCost(S, u, n);
    if (!spend(S, c)) return;
    S.ups[id] = lvl(S, id) + n;
    D = derive(S);
    if (id === 'cap') computeSlots();
    void snd?.playCue('sfx.buy', { eventId: 'up:' + id + ':' + S.ups[id] });
    save();
  },
  buyGen(id        , n        ) {
    const g = GENS.find(x => x.id === id) ;
    const c = genCost(S, g, n);
    if (!(n > 0) || !spend(S, c)) return;
    S.gens[id] = (S.gens[id] || 0) + n;
    D = derive(S);
    void snd?.playCue('sfx.buy', { eventId: 'gen:' + id + ':' + S.gens[id] });
    syncRobots();
    save();
  },
  learn(id        ) {
    const k = SKILLS.find(x => x.id === id) ;
    if (ui.skillState(id) !== 'can') return;
    S.sp -= k.cost; S.skills[id] = sk(S, id) + 1;
    D = derive(S);
    void snd?.playCue('sfx.buy', { eventId: 'sk:' + id + ':' + S.skills[id], pitchSemitones: 3 });
    syncRobots();
    save();
  },
  mergeAll() {
    const before = D.bonds.slice();
    const r = mergeAll(S);
    if (!r.merges && !r.gems) return;
    D = derive(S);
    void snd?.playCue('sfx.merge', { eventId: 'merge:' + S.opened + ':' + r.merges });
    ui.toast(iconStyle(2), `${t('merge')} ×${r.merges}${r.gems ? ` · +${r.gems} ${t('gems')}` : ''}`, '#A35BF0');
    D.bonds.forEach((b, i) => { if (b > before[i]) ui.toast(itemStyle(i * 4), t('setDone', { v: setName(i) }) + ` ×${b}`, '#FFB800'); });
    save();
  },
  pull(n        ) {
    const cost = D.gachaCost * n;
    if (S.gems < cost) return null;
    S.gems -= cost;
    const res                                              = [];
    for (let i = 0; i < n; i++) {
      S.pulls++; S.pity++;
      let g = pickWeighted([45, 38, 14, 3]);
      if (S.pity >= 40) g = 3;
      if (g === 3) S.pity = 0;
      const sp = Math.floor(Math.random() * SPECIES);
      const isNew = gainItem(sp, g, -1, -1);
      res.push({ sp, g, isNew });
    }
    void snd?.playCue('sfx.gacha', { eventId: 'gacha:' + S.pulls });
    save();
    return res;
  },
  submitBest: () => submitBest(),
  buyBot(id        ) {
    const b = BOTS.find(x => x.id === id) ;
    if (bot(S, id) >= b.max) return;
    const c = botCost(S, b);
    if (!spend(S, c)) return;
    S.bots[id] = bot(S, id) + 1;
    D = derive(S);
    void snd?.playCue('sfx.buy', { eventId: 'bot:' + id + ':' + S.bots[id], pitchSemitones: 2 });
    syncRobots();
    save();
  },
  buyPerk(id        ) {
    const p = PERKS.find(x => x.id === id) ;
    if (perk(S, id) >= p.max) return;
    if (perk(S, id) === 0 && p.req && perk(S, p.req) === 0) return;
    const c = perkCost(S, p);
    if (S.dp.lt(c)) return;
    S.dp = S.dp.sub(c); S.perks[id] = perk(S, id) + 1;
    D = derive(S);
    if (id === 'magnet') computeSlots();
    void snd?.playCue('sfx.levelup', { eventId: 'perk:' + id + ':' + S.perks[id] });
    save();
  },
  shopOn: () => false,
  shopBusy: () => '',
  buyShop() { /* 内购已拆 */ },
  equipSkin(i        ) {
    if (!(S.skins & (1 << i)) || S.skin === i) return;
    S.skin = i; drawButton();
    press = 1; pressV = 0; ripple(btnC.x, btnC.y);
    flash(btnC.x, btnC.y, R * 2, (SKINS[i] || SKINS[0]).top, 0.45, 0.8); sparkBurst(btnC.x, btnC.y - R * 0.2, 20, [(SKINS[i] || SKINS[0]).top, (SKINS[i] || SKINS[0]).acc, '#ffffff'], { speed: 380, up: 120 });
    void snd?.playCue('sfx.merge', { eventId: 'equip:' + i + ':' + Date.now() });
    save();
  },
  rebirth() {
    const g = doRebirth(S);
    if (g.lte(0)) return;
    D = derive(S);
    rebuildChests(); syncRobots(); openerTarget = null;
    void submitBest();
    void snd?.playCue('sfx.rebirth', { eventId: 'reb:' + S.rebirths });
    flash(col.width / 2, col.height / 2, Math.max(col.width, col.height), '#BFE0FF', 1.0, 1); rays(btnC.x, btnC.y, R * 3.2, '#2F8BFF', 1.8);
    confetti(60); shake(9, 0.5);
    ui.toast(iconStyle(4), `${t('reb_dp')} +${fmt(g)}`, '#2F8BFF');
    ui.open(null);
    save();
  },
  setLang(l      ) { setLang(l, true); },
  setPrefs(m         , s         ) { prefs = { music: m, sfx: s }; applyVolumes(m, s); save(); },
  prefs: () => prefs,
  onLayout: () => { layoutScene(); },
};

function setLang(l      , persist         ) {
  setLangRaw(l); loadFont(l);
  if (persist) { (S       ).lang = l; save(); }
  if (ui) ui.relabel();
}

ui = new Ui(hostRoot, api);

// ---------------- layout ----------------
function relayout(w        , h        ) {
  const cw = Math.min(w, Math.max(320, h * 0.62));
  col = { left: Math.round((w - cw) / 2), width: Math.round(cw), height: h };
  ui.layout(col.left, col.width, col.height);
  drawBg(w, h);
  if (!ready) drawLoad();
  layoutScene();
}
function layoutScene() {
  world.position.set(col.left, 0);
  const pr = ui.playRect();
  const ph = pr.bottom - pr.top;
  R = Math.max(42, Math.min(col.width * 0.27, ph * 0.24, 150));
  btnC.position.set(col.width / 2, pr.top + ph / 2 - R * 0.05);
  drawButton();
  computeSlots();
  for (const c of chestViews) {
    const p = slots[c.slot]; if (!p) continue;
    c.y0 = p.y; c.spr.x = p.x; if (c.landed) c.spr.y = p.y;
    c.spr.scale.set(chestSize / c.spr.texture.width * 1.15);
  }
  comboText.position.set(col.width / 2, btnC.y + R * 1.3);
  hintText.position.set(col.width / 2, btnC.y + R * 1.3 + 30);
  titleText.style.wordWrapWidth = col.width - 40;
  titleText.style.fontSize = Math.min(34, col.width / 12);
  titleText.position.set(col.width / 2, Math.max(ui.playRect().top + 30, btnC.y - R * 1.45));
  syncRobots();
  for (const p of pets) p.g = -1;
  syncPets(true);
  drawFrenzyRays(); drawFrenzyEdge();
  frenzyMask.clear(); frenzyMask.rect(0, 0, col.width, col.height).fill('#ffffff');
}

// ---------------- pets: owned collectibles roaming the play area ----------------
;                                                                                                                                                                          
const pets        = [];
let petSig = '';
const MAX_PETS = 14;
function petSize() { return Math.max(30, Math.min(R * 0.42, 50)); }
function syncPets(force = false) {
  if (!itemTex.length) return;
  const owned                              = [];
  for (let sp = 0; sp < SPECIES; sp++) { const g = bestGrade(S, sp); if (g >= 0) owned.push({ sp, g }); }
  // animals first, then higher grade
  owned.sort((a, b) => (Number(b.sp < 16) - Number(a.sp < 16)) || (b.g - a.g) || (a.sp - b.sp));
  const pick = owned.slice(0, MAX_PETS);
  const sig = pick.map(p => p.sp + ':' + p.g).join(',');
  if (sig === petSig && !force) return;
  petSig = sig;
  const want = new Set(pick.map(p => p.sp));
  for (let i = pets.length - 1; i >= 0; i--) if (!want.has(pets[i].sp)) { pets[i].c.destroy({ children: true }); pets.splice(i, 1); }
  const sz = petSize();
  pick.forEach((p, idx) => {
    let pet = pets.find(x => x.sp === p.sp);
    if (!pet) {
      const c = new PIXI.Container();
      const sh = new PIXI.Graphics();
      const body = new PIXI.Sprite(itemTex[p.sp]); body.anchor.set(0.5, 0.92);
      c.addChild(sh, body);
      c.eventMode = 'static'; c.cursor = 'pointer';
      pet = { c, body, sp: p.sp, g: -1, x: 20 + Math.random() * (col.width - 40), dir: Math.random() < 0.5 ? -1 : 1, speed: 18 + Math.random() * 22, hop: Math.random() * 6, pause: Math.random() * 2, jump: 0.6, row: 0 };
      const pp = pet;
      c.on('pointerdown', (e                            ) => { e.stopPropagation(); petTap(pp); });
      petLayer.addChild(c);
      pets.push(pet);
    }
    pet.row = idx % 2;
    if (pet.g !== p.g) {
      pet.g = p.g;
      const sh = pet.c.children[0]                 ;
      sh.clear();
      sh.ellipse(0, 0, sz * 0.42, sz * 0.13).fill({ color: '#17264A', alpha: 0.13 });
      if (p.g >= 1) sh.ellipse(0, 0, sz * 0.5, sz * 0.16).stroke({ color: GRADE_COLORS[p.g], width: 3, alpha: 0.8 });
    }
    pet.body.scale.set(sz / pet.body.texture.width * 1.15);
    pet.c.hitArea = new PIXI.Rectangle(-sz * 0.55, -sz * 1.1, sz * 1.1, sz * 1.2);
  });
}
let petTaps = 0;
function petTap(p     ) {
  if (p.jump > 0) return;
  p.jump = 0.001; petTaps++;
  const v = D.clickValue;
  addCoins(S, v);
  floatText(p.c.x, p.c.y - petSize() * 1.3, '♥ +' + fmt(v), '#FF8AB0', 20);
  void snd?.playCue('sfx.ui', { eventId: 'pet:' + petTaps, pitchSemitones: 5 + Math.random() * 3 });
}
function updatePets(dt        , now        ) {
  const pr = ui.playRect();
  const sz = petSize();
  const ground = [pr.bottom - 10, pr.bottom - 10 - sz * 0.55];
  const minX = sz * 0.6, maxX = col.width - sz * 0.6;
  for (const p of pets) {
    if (p.pause > 0) p.pause -= dt;
    else {
      p.x += p.dir * p.speed * dt;
      p.hop += dt * p.speed * 0.22;
      if (p.x < minX) { p.x = minX; p.dir = 1; }
      if (p.x > maxX) { p.x = maxX; p.dir = -1; }
      if (Math.random() < dt * 0.25) { p.pause = 0.8 + Math.random() * 2.5; if (Math.random() < 0.5) p.dir *= -1; }
    }
    let lift = p.pause > 0 ? 0 : Math.abs(Math.sin(p.hop)) * sz * 0.12;
    if (p.jump > 0) { p.jump += dt; const k = p.jump / 0.5; lift += Math.sin(Math.min(1, k) * Math.PI) * sz * 0.9; if (k >= 1) p.jump = 0; }
    p.c.position.set(p.x, ground[p.row]);
    p.body.y = -lift;
    p.body.scale.x = Math.abs(p.body.scale.x) * p.dir;
    const squash = p.pause > 0 ? 1 + Math.sin(now / 400 + p.sp) * 0.03 : 1;
    p.body.scale.y = Math.abs(p.body.scale.x) * squash;
    p.c.zIndex = p.row ? 0 : 1;
  }
  petLayer.sortableChildren = true;
}

function syncRobots() {
  if (!robotTex) return;
  const want = Math.min(GENS.reduce((a, g) => a + (S.gens[g.id] ? 1 : 0), 0) + Math.min(3, Math.floor((S.gens.robot || 0) / 10)), 8);
  while (robots.length < want) { const s = new PIXI.Sprite(robotTex); s.anchor.set(0.5); robotLayer.addChild(s); robots.push(s); }
  while (robots.length > want) robots.pop() .destroy();
  for (const r of robots) r.scale.set(R * 0.36 / robotTex.width);
  if (D.autoRate > 0 && !autoHand && tex.hand) { autoHand = new PIXI.Sprite(tex.hand); autoHand.anchor.set(0.5, 0.1); textLayer.addChild(autoHand); }
  if (autoHand) { autoHand.visible = D.autoRate > 0; autoHand.scale.set(R * 0.5 / tex.hand.height); }
}

// ---------------- leaderboard (wealth score = floor(log10(lifetime coins)*100)) ----------------
let lastSubmitted = -1;
let submitting = false;
async function submitBest() {
  // 宿主没有排行榜后端（原版走 gp.player.submitScore）
}
// submit once per 100-point milestone (each 10x of lifetime coins) — never spams
let nextMilestone = (Math.floor(wealthScore(S.lifeCoins) / 100) + 1) * 100;
function checkScoreMilestone() {
  if (wealthScore(S.lifeCoins) >= nextMilestone) { nextMilestone += 100; void submitBest(); }
}

// ---------------- workshop helpers ----------------
let openerTarget                = null;
let opener                     = null;
let openerPos = { x: 0, y: 0 };
function updateOpener(dt        , now        ) {
  if (D.autoOpen <= 0) { if (opener) opener.visible = false; return; }
  if (!opener && robotTex) {
    opener = new PIXI.Sprite(robotTex); opener.anchor.set(0.5); opener.tint = '#8FF5C9';
    fxLayer.addChild(opener);
    openerPos = { x: btnC.x - R * 1.25, y: btnC.y - R * 1.1 };
  }
  if (!opener) return;
  opener.visible = true;
  opener.scale.set(R * 0.4 / robotTex.width);
  const home = { x: btnC.x - R * 1.15, y: btnC.y - R * 1.15 + Math.sin(now / 300) * 6 };
  let tx = home.x, ty = home.y;
  if (openerTarget) {
    if (openerTarget.opening > 0 || !openerTarget.spr.parent) openerTarget = null;
    else { tx = openerTarget.spr.x; ty = openerTarget.spr.y - chestSize * 1.0; }
  }
  const dx = tx - openerPos.x, dy = ty - openerPos.y; const d = Math.hypot(dx, dy);
  const sp = openerTarget ? 900 : 300;
  if (d > 1) { const m = Math.min(d, sp * dt); openerPos.x += dx / d * m; openerPos.y += dy / d * m; }
  if (openerTarget && d < 14) { openChest(openerTarget); openerTarget = null; }
  opener.position.set(openerPos.x, openerPos.y);
  opener.rotation = Math.max(-0.3, Math.min(0.3, dx * 0.004));
}
let mergeAcc = 0, mineAcc = 0;
function updateHelpers(dt        ) {
  if (D.mergeBot) {
    mergeAcc += dt;
    if (mergeAcc >= 20) { mergeAcc = 0; if (ui.mergeable()) api.mergeAll(); }
  }
  if (D.minerGems > 0) {
    mineAcc += dt;
    if (mineAcc >= 30) {
      mineAcc = 0;
      const g = Math.round(D.minerGems * D.gemMult);
      S.gems += g;
      const r = robots[0];
      floatText(r ? r.x : btnC.x, (r ? r.y : btnC.y) - 30, t('miner_got', { v: g }), '#C9A8FF', 20);
    }
  }
}

// ---------------- lucky star event ----------------
let lucky                        = null;
let luckyT = 0, luckyNext = 45, luckyN = 0;
let luckyPath = { x0: 0, x1: 0, y: 0, dur: 11 };
function updateLucky(dt        , now        ) {
  if (S.clicks < 60 || !itemTex.length) return;
  if (!lucky) {
    luckyNext -= dt;
    if (luckyNext <= 0) spawnLucky();
    return;
  }
  luckyT += dt;
  const k = luckyT / luckyPath.dur;
  if (k >= 1) { lucky.destroy({ children: true }); lucky = null; luckyNext = 70 + Math.random() * 80; return; }
  lucky.x = luckyPath.x0 + (luckyPath.x1 - luckyPath.x0) * k;
  lucky.y = luckyPath.y + Math.sin(luckyT * 2.2) * 40;
  lucky.rotation = Math.sin(now / 200) * 0.25;
  lucky.scale.set(1 + Math.sin(now / 120) * 0.06);
  lucky.alpha = Math.min(1, k * 8, (1 - k) * 8);
}
function spawnLucky() {
  const pr = ui.playRect();
  const c = new PIXI.Container();
  const glow = new PIXI.Graphics();
  glow.circle(0, 0, 44).fill({ color: '#FFE36E', alpha: 0.45 });
  glow.circle(0, 0, 32).fill({ color: '#FFF6C8', alpha: 0.7 });
  const s = new PIXI.Sprite(itemTex[33]); s.anchor.set(0.5); s.scale.set(64 / s.texture.width);
  c.addChild(glow, s);
  c.eventMode = 'static'; c.cursor = 'pointer';
  c.hitArea = new PIXI.Circle(0, 0, 48);
  c.on('pointerdown', (e                            ) => { e.stopPropagation(); catchLucky(); });
  const dir = Math.random() < 0.5 ? 1 : -1;
  luckyPath = { x0: dir > 0 ? -50 : col.width + 50, x1: dir > 0 ? col.width + 50 : -50, y: pr.top + 60 + Math.random() * Math.max(40, (pr.bottom - pr.top) * 0.3), dur: 11 };
  c.position.set(luckyPath.x0, luckyPath.y);
  textLayer.addChild(c);
  lucky = c; luckyT = 0;
}
function catchLucky() {
  if (!lucky) return;
  const x = lucky.x, y = lucky.y;
  lucky.destroy({ children: true }); lucky = null; luckyNext = 70 + Math.random() * 80; luckyN++;
  const r = Math.random();
  void snd?.playCue('sfx.rare', { eventId: 'lucky:' + luckyN });
  if (r < 0.35) {
    startFrenzy(FRENZY_DUR);
    floatText(x, y, t('lucky_frenzy'), '#ffffff', 30, '#FF8A3D');
  } else if (r < 0.65) {
    const v = Decimal.max(D.cps.mul(120), D.clickValue.mul(100));
    addCoins(S, v);
    burstCoins(x, y, 24);
    floatText(x, y - 40, t('lucky_coins') + ' +' + fmt(v), '#FFC928', 24);
  } else if (r < 0.85 && S.chests.length < D.cap) {
    dropChest(Math.random() < 0.3 ? 3 : 2);
    floatText(x, y, t('lucky_chest'), '#ffffff', 26, '#2FC48D');
  } else {
    const g = Math.round((5 + Math.floor(Math.random() * 11)) * D.gemMult);
    S.gems += g;
    floatText(x, y, t('lucky_gems', { v: g }), '#ffffff', 26, '#8B5CF6');
  }
  save();
}

// ---------------- main loop ----------------
let ready = false;
let lastNow = performance.now();
let autoAcc = 0, openAcc = 0, hudAcc = 0, orbit = 0;

function tick() {
  const now = performance.now();
  let dt = (now - lastNow) / 1000; lastNow = now;
  if (!ready) { spinner.rotation = Math.sin(now / 300) * 0.25; spinner.scale.set(1 + Math.sin(now / 160) * 0.04); return; }
  if (dt > 10) { // came back from a long background gap: offline rules
    const sec = Math.min(dt, D.offlineHours * 3600);
    addCoins(S, D.cps.mul(sec * D.offlineRate));
    dt = 0.016;
  } else if (dt > 0.25) { addCoins(S, D.cps.mul(dt - 0.25)); dt = 0.25; }
  // income
  addCoins(S, D.cps.mul(dt * (frenzyT > 0 ? frenzyX : 1)));
  if (frenzyT > 0) { frenzyT -= dt; if (frenzyT <= 0) { frenzyX = 7; frenzyMax = FRENZY_DUR; } }
  updateLucky(dt, now);
  updateHelpers(dt);
  checkScoreMilestone();
  // auto clicker
  if (D.autoRate > 0) {
    autoAcc += dt * D.autoRate;
    while (autoAcc >= 1) {
      autoAcc -= 1;
      pressButton(btnC.x + R * 0.3, btnC.y - R * 0.2, false);
      autoHandT = 0.15;
    }
  }
  if (D.autoOpen > 0 && !openerTarget && chestViews.some(c => c.opening === 0 && c.landed)) {
    openAcc += dt;
    if (openAcc >= D.autoOpen) { openAcc = 0; openerTarget = chestViews.find(c => c.opening === 0 && c.landed) || null; }
  }
  updateOpener(dt, now);
  // combo decay
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  comboText.text = combo >= 5 ? `${t('combo')} ×${combo}` : '';
  comboText.style.fill = frenzyT > 0 ? '#E8590C' : '#17264A';
  updateFrenzyUi(dt, now);
  comboText.scale.set(1 + Math.min(combo, 200) / 400);
  if (chestFullT > 0) chestFullT -= dt;
  hintText.text = S.clicks < 3 ? t('pressMe') : chestFullT > 0 ? t('chestFull') : '';
  titleText.alpha += ((S.clicks < 3 ? 1 : 0) - titleText.alpha) * Math.min(1, dt * 4);
  titleText.visible = titleText.alpha > 0.01;
  hintText.alpha = S.clicks < 3 ? 0.6 + Math.sin(now / 300) * 0.4 : 1;
  // button spring
  pressV += (-press * 260 - pressV * 18) * dt;
  press = Math.max(0, press + pressV * dt);
  if (press < 0.002 && Math.abs(pressV) < 0.05) press = 0;
  btnTop.y = Math.min(1, press) * R * 0.13;
  btnC.scale.set(1 + (S.clicks < 3 ? Math.sin(now / 250) * 0.02 : 0));
  drawHalo(now);
  updateFx(dt);
  // robots orbit
  orbit += dt * 0.6;
  robots.forEach((r, i) => {
    const a = orbit + i / robots.length * Math.PI * 2;
    r.position.set(btnC.x + Math.cos(a) * R * 1.32, btnC.y + Math.sin(a) * R * 1.32 * 0.9 + Math.sin(now / 200 + i) * 3);
  });
  if (autoHand && autoHand.visible) {
    autoHandT = Math.max(0, autoHandT - dt);
    autoHand.position.set(btnC.x + R * 0.55, btnC.y - R * 0.05 + (autoHandT > 0 ? -R * 0.02 : -R * 0.25));
    autoHand.rotation = -0.5;
  }
  // chests
  for (let i = chestViews.length - 1; i >= 0; i--) {
    const c = chestViews[i];
    if (!c.landed) {
      c.vy += 2400 * dt; c.spr.y += c.vy * dt;
      if (c.spr.y >= c.y0) { c.spr.y = c.y0; if (Math.abs(c.vy) > 300) { if (!c.landed && c.vy > 600) sparkBurst(c.spr.x, c.y0, 8, ['#C9D3DC', '#ffffff'], { speed: 160, up: 40, grav: 200, size: 0.7, spread: 2.6, tex: 2 }); c.vy = -c.vy * 0.35; } else { c.vy = 0; c.landed = true; } }
    } else if (c.opening === 0) {
      c.spr.rotation = c.tier >= 2 ? Math.sin(now / 140 + i) * 0.06 : Math.sin(now / 500 + i) * 0.02;
    }
    if (c.opening > 0) {
      c.opening += dt;
      const k = c.opening;
      c.spr.alpha = Math.max(0, 1 - Math.max(0, k - 0.45) / 0.35);
      if (c.spr.alpha <= 0) { c.spr.destroy({ children: true }); chestViews.splice(i, 1); }
    }
  }
  updatePets(dt, now);
  // particles
  const tgt = ui.coinTarget();
  const trect = app.canvas.getBoundingClientRect();
  const tx = tgt.x - trect.left - col.left, ty = tgt.y - trect.top;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt;
    if (p.kind === 0) {
      if (p.life < 0.45) { p.vy += 900 * dt; p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.vx *= 0.98; }
      else {
        const dx = tx - p.s.x, dy = ty - p.s.y; const d = Math.hypot(dx, dy);
        const sp = 400 + (p.life - 0.45) * 2600;
        if (d < sp * dt + 8) { p.s.destroy(); parts.splice(i, 1); bumpCoins(); void snd?.playCue('sfx.coin', { eventId: 'coin:' + now.toFixed(0) + i }); continue; }
        p.s.x += dx / d * sp * dt; p.s.y += dy / d * sp * dt;
      }
      p.s.rotation += dt * 6;
      if (p.life > 3) { p.s.destroy(); parts.splice(i, 1); }
    } else if (p.kind === 2) {
      p.vy *= 0.93; p.s.y += p.vy * dt;
      const k = p.life / p.max;
      p.s.scale.set(k < 0.15 ? k / 0.15 * 1.1 : 1);
      p.s.alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      if (p.life >= p.max) { p.s.destroy({ children: true }); parts.splice(i, 1); }
    } else if (p.kind === 3) {
      const k = p.life / p.max;
      p.s.scale.set(1 + k * 0.5); p.s.alpha = 1 - k;
      if (k >= 1) { p.s.destroy(); parts.splice(i, 1); }
    }
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life += dt;
    f.s.y += f.vy * dt; f.s.x += f.vx * dt; f.vy *= 0.96;
    const k = f.life / f.max;
    f.s.scale.set(k < 0.12 ? 0.6 + k / 0.12 * 0.5 : 1.1 - Math.min(0.1, (k - 0.12)));
    f.s.alpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    if (k >= 1) { f.s.destroy({ children: true }); floats.splice(i, 1); }
  }
  // periodic
  hudAcc += dt;
  if (hudAcc > 0.1) {
    hudAcc = 0;
    accrue(S, D, Date.now());
    D = derive(S);
    checkLevel();
    checkTabs(true);
    syncPets();
    ui.hud();
  }
  saveT += dt;
  if (saveT > 5) { saveT = 0; save(); }
}
app.ticker.add(tick);

// ---------------- boot ----------------
const display = mountDisplay({ orientation: 'both', host: hostRoot, onResize: ({ width, height }                                   ) => relayout(width, height) });
display.attachPixi(app);
relayout(app.screen.width, app.screen.height);
drawLoad();
// 平台钩子 __gpReady 不留（会骗过下一次「已就绪」）

const urls = ['assets/sheets/chests-c.webp', 'assets/sheets/icons-c.webp', 'assets/sheets/items-animals-c.webp', 'assets/sheets/items-food-c.webp', 'assets/sheets/items-magic-c.webp', 'assets/sheets/hand.webp'].map((u) => AB + u);
const soundP = initSound();
const loaded = await PIXI.Assets.load(urls, (p        ) => { loadP = p; drawLoad(); });
await soundP;
applyVolumes(prefs.music, prefs.sfx);
tex = { chests: loaded[urls[0]], icons: loaded[urls[1]], hand: loaded[urls[5]] };
for (let i = 0; i < 4; i++) { chestTex.push(sub(tex.chests, i * 256, 0, 256, 256)); chestOpenTex.push(sub(tex.chests, i * 256, 256, 256, 256)); }
[urls[2], urls[3], urls[4]].forEach((u) => { const t0 = loaded[u]; for (let k = 0; k < 16; k++) itemTex.push(sub(t0, (k % 4) * 256, Math.floor(k / 4) * 256, 256, 256)); });
coinTex = sub(tex.icons, 768, 256, 256, 256);
makeFxTextures();
robotTex = sub(tex.icons, 512, 256, 256, 256);
gemTex = sub(tex.icons, 256, 256, 256, 256);
hand = new PIXI.Sprite(tex.hand); hand.anchor.set(0.5);
btnTop.addChild(hand);
loadC.destroy({ children: true });
ready = true;
for (const k of S.tabs) ui.unlockTab(k, false);
relayout(app.screen.width, app.screen.height);
rebuildChests();
syncRobots();
syncPets(true);
D = derive(S);
ui.hud();
// 平台钩子 __gpPlayable 不留

// ---------------- 内购商店：整块拆掉 ----------------
// 原版走 gp.pay（平台币商品 + 发货），宿主里没有支付通道，也不该有。
// 商店按钮（#shopBtn）与 shop 面板一起不渲染；SHOP_ITEMS 只剩死数据。

// late cloud save: the handshake may land after this module started
async function resolveLateSave() {
  // 宿主的存档是同步拿到的（saveApi.latestSync），没有「迟到的云存档」这回事
  saveReady = true;
  save();
}
function checkOffline() {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away > 60 && D.cps.gt(0)) {
    const sec = Math.min(away, D.offlineHours * 3600);
    const coins = D.cps.mul(sec * D.offlineRate);
    ui.offlineModal(away, coins, () => { addCoins(S, coins); burstCoins(btnC.x, btnC.y, 20); void snd?.playCue('sfx.buy', { eventId: 'offline:' + Date.now() }); save(); });
  }
}
void resolveLateSave();
// offline earnings
if (hadSave) {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away > 60 && D.cps.gt(0)) {
    const sec = Math.min(away, D.offlineHours * 3600);
    const coins = D.cps.mul(sec * D.offlineRate);
    ui.offlineModal(away, coins, () => { addCoins(S, coins); burstCoins(btnC.x, btnC.y, 20); void snd?.playCue('sfx.buy', { eventId: 'offline:' + Date.now() }); save(); });
  }
}
listen(window, 'pagehide', () => save());
listen(document, 'visibilitychange', () => { if (document.hidden) save(); });

// debug hooks for playtests
// ---------------- test-only cheats (only when the URL has playtest=1; normal play can never reach this) ----------------
const PLAYTEST = new URLSearchParams(location.search).has('playtest');
function applyTestState(next       ) {
  S = next; D = derive(S);
  computeSlots(); rebuildChests(); syncRobots(); drawButton();
  for (const p of pets) p.g = -1;
  syncPets(true);
  for (const k of S.tabs) ui.unlockTab(k, false);
  checkTabs(false);
  ui.hud();
}
// presets: late = 1e400 coins, Finger Power 9000, 11 rebirths, Lv20, 300 of every machine; huge = same with 1e5000;
// offline = keep the state but pretend the player was away 2 h (opens the offline-earnings dialog)
function cheat(preset        ) {
  if (!PLAYTEST) return false;
  if (preset === 'offline') { S.lastSeen = Date.now() - 2 * 3600e3; checkOffline(); return true; }
  const n = newState();
  const c = preset === 'huge' ? new Decimal('1e5000') : new Decimal('1e400');
  n.coins = c; n.runCoins = c; n.lifeCoins = c.mul(10);
  n.ups = { power: 9000, sniff: 20, cap: 6, quality: 15 };
  for (const g of GENS) n.gens[g.id] = 300;
  n.rebirths = 11; n.dp = new Decimal('1e150'); n.dpTotal = new Decimal('1e151'); n.momT = Date.now();
  n.level = 20; n.sp = 30; n.clicks = 50000; n.opened = 2000; n.gems = 500; n.pulls = 50;
  n.tabs = ['up', 'sk', 'bot', 'col', 'gacha', 'reb']; n.firstChest = true;
  for (let i = 0; i < SPECIES; i += 3) { n.inv[i * GRADES] = 1; n.seen[i] = 1; }
  n.fx.bank = c.div(100); n.fx.bankP = c.div(200);
  (n       ).prefs = prefs; (n       ).lang = (S       ).lang;
  applyTestState(n);
  return true;
}
if (PLAYTEST) {
  (globalThis       ).__MAKEPLAY_PLAYTEST__ = {
    snapshot: () => {
      let roundTrip = false;
      try { const r = parseSave(JSON.parse(JSON.stringify(S))); roundTrip = !!r && r.coins.eq(S.coins) && r.lifeCoins.eq(S.lifeCoins) && r.dp.eq(S.dp) && r.fx.bank.eq(S.fx.bank); } catch { /* false */ }
      return {
        coins: S.coins.toString(), life: S.lifeCoins.toString(), run: S.runCoins.toString(), dp: S.dp.toString(), dpTotal: S.dpTotal.toString(),
        cps: D.cps.toString(), click: D.clickValue.toString(), bank: S.fx.bank.toString(), power: lvl(S, 'power'), rebirths: S.rebirths, level: S.level,
        saveJsonOk: !/"(coins|runCoins|lifeCoins|dp|dpTotal|bank|bankP)":null/.test(JSON.stringify(S)), saveRoundTrip: roundTrip,
      };
    },
    reset: () => { applyTestState(newState()); },
    // advance income by ms of game time (cps only, like the frame loop without frenzy)
    step: (ms        ) => { addCoins(S, D.cps.mul(Math.max(0, ms) / 1000)); D = derive(S); ui.hud(); },
    // setSeed(n): grant 10^n coins
    setSeed: (n        ) => { addCoins(S, Decimal.pow(10, n)); D = derive(S); ui.hud(); },
  };
  (window       ).__cheat = cheat;
  const pre = new URLSearchParams(location.search).get('cheat');
  if (pre) setTimeout(() => { for (const x of pre.split(',')) cheat(x.trim()); }, 0);  // e.g. cheat=huge,offline
}
/*
 * 调试桥（e2e / 截图脚本用）：只读 state + 一个 press。
 * ★ 卸载时必须删：留着 ready: true 会骗过下一次「已就绪」判断。
 */
const bridge = {
  ready: true,
  state: () => ({
    coins: S.coins.toString(), life: S.lifeCoins.toString(), cps: D.cps.toString(),
    clicks: S.clicks, level: S.level, rebirths: S.rebirths, gems: S.gems, pulls: S.pulls,
    opened: S.opened, tab: ui.tab, sheet: !!ui.tab, ready,
  }),
  // ★ 走 pressManual：调试桥不许绕开收费点，否则 e2e 测的是一条假路径
  press: () => pressManual(btnC.x, btnC.y),
};
window.__redbutton = bridge;

void bestGrade; void GRADES; void chestStyle; void gemTex; void lastLevelCheck;

return async function destroy() {
  try { save(); } catch { /* 存档失败也要继续拆 */ }
  offWin.forEach((f) => f());
  try { app.ticker.remove(tick); } catch { /* 已经停了 */ }
  try { ui.destroy(); } catch { /* 已经拆过 */ }
  try { display.dispose(); } catch { /* 已经拆过 */ }
  // 卸载后别还在放音乐：静音比 dispose 安全（dispose 会把 @makeplay/sound 的上下文关掉，切回来就哑了）
  try { applyVolumes(false, false); } catch { /* 没声音系统 */ }
  try { app.destroy(true, { children: true, texture: false }); } catch { /* 已经拆过 */ }
  ready = false;
  if (window.__redbutton === bridge) delete window.__redbutton;
  if (window.__game) delete window.__game;
  if (window.__cheat) delete window.__cheat;
  if (globalThis.__MAKEPLAY_PLAYTEST__) delete globalThis.__MAKEPLAY_PLAYTEST__;
};
}
