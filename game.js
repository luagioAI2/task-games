import * as PIXI from 'pixi.js';
import { mountDisplay } from '@makeplay/display';
import { loadSoundSystem } from '@makeplay/sound';
                                                           
import { LEVELS } from './levels.js';
import { t, setLang, getLang, pickLang, LANG_ORDER, LANG_NAMES, GAME_TITLE, displayTitle } from './i18n.js';
                                            
document.title = displayTitle();
                                      

// ---------- palette ----------
const C = {
  ground: 0xecd98a,
  pit: 0x3f6f9c,
  pitDark: 0x2b5079,
  card: 0xc99d5e,
  cardDark: 0x9c7440,
  cardLight: 0xe0bd85,
  yellow: 0xf6d63a,
  yellowLight: 0xfde777,
  yellowDark: 0xd9a91c,
  yellowDeep: 0xb98a12,
  cream: 0xf8f1df,
  creamDark: 0xd9ccaa,
  ink: 0x2d4566,
  red: 0xe0473a,
  green: 0x5f9a4c,
};

const DIRS                     = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // right,left,down,up

// ---------- save ----------
// tickets = paid-for 3-star passes not yet used; paid = delivered purchase ids (dedupe); bought = levels cleared by a pass
                                                                                                                                                                                
const save           = { v: 2, unlocked: 1, stars: new Array(LEVELS.length).fill(0), music: true, sfx: true, last: 0, tickets: 0, paid: [], bought: [] };
try {
  const s = window.gp?.player?.saves?.latestSync;
  if (s && typeof s === 'object' && !window.gp.player.saves.latestInfo?.legacy) {
    if (typeof s.unlocked === 'number') save.unlocked = Math.max(1, Math.min(LEVELS.length, s.unlocked));
    if (Array.isArray(s.stars)) for (let i = 0; i < LEVELS.length; i++) save.stars[i] = +s.stars[i] || 0;
    // v2: levels 10+ were redesigned (harder, 50 total) — their old stars belong to different boards
    if ((s.v ?? 1) < 2) for (let i = 9; i < LEVELS.length; i++) save.stars[i] = 0;
    if (typeof s.music === 'boolean') save.music = s.music;
    if (typeof s.sfx === 'boolean') save.sfx = s.sfx;
    if (s.lang === 'zh' || s.lang === 'en' || s.lang === 'ja') save.lang = s.lang;
    if (typeof s.last === 'number') save.last = s.last;
    if (typeof s.tickets === 'number' && s.tickets > 0) save.tickets = Math.floor(s.tickets);
    if (Array.isArray(s.paid)) save.paid = s.paid.filter((x     ) => typeof x === 'string').slice(-60);
    if (Array.isArray(s.bought)) {
      save.bought = s.bought.filter((x     ) => Number.isInteger(x) && x >= 0 && x < LEVELS.length);
      for (const i of save.bought) save.stars[i] = 3; // a paid pass survives level redesigns
    }
  }
} catch (e) { /* ignore */ }
function persist() { try { void window.gp?.player?.saves?.putLatest({ ...save }); } catch (e) { /* ignore */ } }

setLang(save.lang ?? pickLang(window.gp?.player?.user?.locale || navigator.language));

// ---------- sound ----------
let sound                          = null;
let audioUnlocked = false;
function applyVolumes() {
  if (!sound) return;
  try { sound.settings.setVolumes({ music: save.music ? 1 : 0, sfx: save.sfx ? 1 : 0 }); } catch (e) { /* ignore */ }
}
let sfxCounter = 0;
let lastBump = -1;
const BUMP_CUES = ['move.bump.0', 'move.bump.1', 'move.bump.2', 'move.bump.3', 'move.bump.4', 'move.bump.5', 'move.bump.6', 'move.bump.7', 'move.bump.8', 'move.bump.9']         ;
function sfx(id                                                                                                      , pitch = 0) {
  if (!sound || !audioUnlocked) return;
  const eventId = id + ':' + (sfxCounter++);
  try {
    if (id === 'move.slide') void sound.playCue('move.slide', { eventId, pitchSemitones: pitch });
    else if (id === 'move.bump') {
      let k = Math.floor(Math.random() * 10);
      if (k === lastBump) k = (k + 1 + Math.floor(Math.random() * 9)) % 10;
      lastBump = k;
      void sound.playCue(BUMP_CUES[k], { eventId, pitchSemitones: pitch * 0.3 });
    }
    else if (id === 'chicken.squawk') void sound.playCue('chicken.squawk', { eventId, pitchSemitones: pitch });
    else if (id === 'snack.eat') void sound.playCue('snack.eat', { eventId, pitchSemitones: pitch });
    else if (id === 'level.win') void sound.playCue('level.win', { eventId });
    else if (id === 'ui.click') void sound.playCue('ui.click', { eventId });
    else if (id === 'move.undo') void sound.playCue('move.undo', { eventId });
  } catch (e) { /* ignore */ }
}
function onFirstGesture() {
  if (!sound || audioUnlocked) return;
  audioUnlocked = true;
  void sound.unlock().then(() => {
    applyVolumes();
    void sound .setMusicState('main', { eventId: 'session' });
  }).catch(() => { audioUnlocked = false; });
}
window.addEventListener('pointerdown', onFirstGesture);
window.addEventListener('keydown', onFirstGesture);

// ---------- app ----------
const host = document.getElementById('app') ;
let SW = host.clientWidth || window.innerWidth;
let SH = host.clientHeight || window.innerHeight;
const app = new PIXI.Application();
await app.init({ resizeTo: host, autoDensity: true, antialias: true, background: C.ground });
host.appendChild(app.canvas);
let sceneReady = false;
const display      = mountDisplay({ orientation: 'portrait', onResize: ({ width, height }     ) => { SW = width; SH = height; if (sceneReady) relayout(); } });
display.attachPixi(app);
SW = app.screen.width; SH = app.screen.height;

let FONT = '"OpenHuninn", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

// loading screen
const loadLayer = new PIXI.Container();
app.stage.addChild(loadLayer);
const loadBg = new PIXI.Graphics();
const loadSpin = new PIXI.Graphics();
const loadBar = new PIXI.Graphics();
loadLayer.addChild(loadBg, loadSpin, loadBar);
let loadProgress = 0;
function drawLoading() {
  loadBg.clear().rect(0, 0, SW, SH).fill(C.ground);
  loadSpin.clear();
  loadSpin.roundRect(-26, -26, 52, 52, 8).fill(C.yellow).stroke({ width: 3, color: C.yellowDeep });
  loadSpin.circle(-9, -6, 7).fill(0xffffff); loadSpin.circle(9, -6, 7).fill(0xffffff);
  loadSpin.circle(-8, -5, 3).fill(0x222222); loadSpin.circle(10, -5, 3).fill(0x222222);
  loadSpin.ellipse(0, 12, 6, 8).fill(0xe98a2a);
  loadSpin.position.set(SW / 2, SH / 2 - 30);
  const bw = Math.min(260, SW - 80);
  loadBar.clear();
  loadBar.roundRect(SW / 2 - bw / 2, SH / 2 + 40, bw, 16, 8).fill(C.creamDark);
  loadBar.roundRect(SW / 2 - bw / 2 + 2, SH / 2 + 42, Math.max(12, (bw - 4) * loadProgress), 12, 6).fill(C.ink);
}
drawLoading();
const loadTick = (tk             ) => { loadSpin.rotation += 0.004 * tk.deltaMS; loadSpin.scale.set(1 + 0.06 * Math.sin(performance.now() / 180)); };
app.ticker.add(loadTick);
window.__gpReady = true;

// font (never blocks)
try {
  if (window.gp?.fonts?.use) {
    void window.gp.fonts.use({ display: 'open-huninn/OpenHuninn.woff2', lang: getLang() }).then((r     ) => {
      if (r?.display) FONT = `"${r.display}", ` + FONT;
      document.fonts?.ready?.then(() => { if (sceneReady) relayout(); });
      setTimeout(() => { if (sceneReady) relayout(); }, 400);
    });
  } else {
    const f = new FontFace('OpenHuninn', 'url("https://static.makeplay.ai/fonts/v1/open-huninn/OpenHuninn.woff2")');
    void f.load().then(() => { document.fonts.add(f); if (sceneReady) relayout(); }).catch(() => {});
  }
} catch (e) { /* ignore */ }

// sound system in parallel
void loadSoundSystem({ manifestUrl: './sound.manifest.json' }).then((s     ) => { sound = s                    ; applyVolumes(); }).catch(() => {});
window.addEventListener('pagehide', () => { if (sound) void sound.dispose(); }, { once: true });

const TEX_URLS = {
  head: 'assets/sprites/head.png', headHappy: 'assets/sprites/head-happy.png',
  coin: 'assets/sprites/coin.png', // official platform coin icon (rasterized from the supplied SVG)
  popcorn: 'assets/sprites/popcorn.png', pretzel: 'assets/sprites/pretzel.png', donut: 'assets/sprites/donut.png',
  flower: 'assets/sprites/flower.png', flagRed: 'assets/sprites/flag-red.png', flagBlue: 'assets/sprites/flag-blue.png',
  bush: 'assets/sprites/bush.png', grass: 'assets/sprites/grass.png', star: 'assets/sprites/star.png',
  ground: 'assets/tiles/ground.png', pit: 'assets/tiles/pit.png',
  painDizzy: 'assets/sprites/pain-dizzy.png', painSquish: 'assets/sprites/pain-squish.png',
  painShock: 'assets/sprites/pain-shock.png', painFlat: 'assets/sprites/pain-flat.png',
};
const PAIN = ['painDizzy', 'painSquish', 'painShock', 'painFlat'];
const TX                               = {};
{
  const keys = Object.keys(TEX_URLS)                             ;
  const loaded      = await PIXI.Assets.load(keys.map(k => TEX_URLS[k]), (p        ) => { loadProgress = p; drawLoading(); });
  for (const k of keys) TX[k] = loaded[TEX_URLS[k]];
  TX.ground.source.addressMode = 'repeat';
  TX.pit.source.addressMode = 'repeat';
}
// Face variants: 4 single pained heads now; 48 pained + 32 happy faces stream in from atlases after boot.
const FACE_META = new Map                                         ();
const PAIN_TEX                 = PAIN.map(k => TX[k]);
const JOY_TEX                 = [TX.headHappy];
function faceMeta(tex              ) { return FACE_META.get(tex) ?? { ay: 0.88, h: tex.height }; }
function pickFace(list                , recent                ) {
  let tex = list[0];
  for (let i = 0; i < 12; i++) { tex = list[Math.floor(Math.random() * list.length)]; if (!recent.includes(tex)) break; }
  recent.push(tex); if (recent.length > Math.min(8, list.length - 1)) recent.shift();
  return tex;
}
const recentPain                 = [];
const recentJoy                 = [];
function loadFaceAtlases() {
  const atlases                             = [
    ['assets/sheets/pain-a.png', PAIN_TEX], ['assets/sheets/pain-b.png', PAIN_TEX], ['assets/sheets/pain-c.png', PAIN_TEX],
    ['assets/sheets/joy-a.png', JOY_TEX], ['assets/sheets/joy-b.png', JOY_TEX],
  ];
  for (const [url, list] of atlases) {
    PIXI.Assets.load(url).then((sheet              ) => {
      const cw = sheet.width / 4, ch = sheet.height / 4;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const tex = new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(c * cw, r * ch, cw, ch) });
        FACE_META.set(tex, { ay: 0.93, h: ch * 0.86 });
        list.push(tex);
      }
    }).catch(() => { /* keep the faces we have */ });
  }
}
let winTex               = TX.headHappy;
app.ticker.remove(loadTick);
loadLayer.destroy({ children: true });

// ---------- scene graph ----------
const root = new PIXI.Container();
app.stage.addChild(root);
const shakeLayer = new PIXI.Container();
root.addChild(shakeLayer);
const groundSprite = new PIXI.TilingSprite({ texture: TX.ground, width: 100, height: 100 });
groundSprite.tileScale.set(0.7);
shakeLayer.addChild(groundSprite);
const decoBack = new PIXI.Container();
shakeLayer.addChild(decoBack);
const board = new PIXI.Container();
shakeLayer.addChild(board);
const pitFloor = new PIXI.TilingSprite({ texture: TX.pit, width: 100, height: 100 });
pitFloor.tileScale.set(0.5);
const pitMask = new PIXI.Graphics();
const pitDeco = new PIXI.Graphics();
const islandDeco = new PIXI.Container();
const snackLayer = new PIXI.Container();
const bodyG = new PIXI.Graphics();
const headSprite = new PIXI.Sprite(TX.head);
headSprite.anchor.set(0.5, 0.88);
const fxLayer = new PIXI.Container();
board.addChild(pitFloor, pitMask, pitDeco, islandDeco, snackLayer, bodyG, headSprite, fxLayer);
pitFloor.mask = pitMask;
const decoFront = new PIXI.Container();
shakeLayer.addChild(decoFront);
const ambientLayer = new PIXI.Container();
shakeLayer.addChild(ambientLayer);
const hud = new PIXI.Container();
root.addChild(hud);
const overlay = new PIXI.Container();
root.addChild(overlay);
const toastLayer = new PIXI.Container(); // toasts that must sit above panels (shop messages)
root.addChild(toastLayer);

// ---------- tweens ----------
                                                                                                     
let tweens          = [];
function tween(dur        , fn                     , done             , delay = 0) { const tw = { t: 0, dur, fn, done, delay }; tweens.push(tw); return tw; }
const easeOutBack = (k        ) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const easeOut = (k        ) => 1 - Math.pow(1 - k, 3);

// ---------- game state ----------
                                          
let screen         = 'title';
let levelIdx = 0;
let GW = 0, GH = 0;
let floor            = [];
let totalFloor = 0;
let path           = []; // cell indices, path[0]=start
let occupied             = new Uint8Array(0);
let slides = 0;
let retries = 0; // restarts on this level (third star = clear with none)
let painTex                      = null;
let painTime = 0;
let lastPain = -1;
const dizzyG = new PIXI.Graphics();
board.addChild(dizzyG);
let won = false;
let winTime = 0;
                                                                                                                                                                                                                    
let snacks          = [];
                                                                     
let history         = [];
let anim                                                                                                   = null;
let arrowAt            = new Int8Array(0);
let portalAt             = new Int32Array(0);
let lastDirs           = [];
const FIRST_ARROW = LEVELS.findIndex(l => l.arrows.length > 0);
const FIRST_PORTAL = LEVELS.findIndex(l => l.portals.length > 0);
function setupGrid(L          ) {
  GH = L.map.length; GW = L.map[0].length;
  floor = []; totalFloor = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const f = L.map[y][x] === '.'; floor.push(f); if (f) totalFloor++; }
  arrowAt = new Int8Array(GW * GH).fill(-1);
  portalAt = new Int32Array(GW * GH).fill(-1);
  for (const [ax, ay, d] of L.arrows) arrowAt[ay * GW + ax] = d;
  for (const [ax, ay, bx, by] of L.portals) { portalAt[ay * GW + ax] = by * GW + bx; portalAt[by * GW + bx] = ay * GW + ax; }
}
let queuedDir = -1;
let facing = 1;
let headSquash = 0; // 0..1 decay
let headBumpDir = -1;
let bumpTime = 0;
let shake = 0;
let stuckShown = false;
let paused = false;

// layout
let CS = 60, OX = 0, OY = 0, ELEV = 12;

function cellXY(i        ) { return [i % GW, Math.floor(i / GW)]; }

function loadLevel(i        ) {
  if (i !== levelIdx || screen !== 'game' || won) retries = 0;
  levelIdx = i;
  save.last = i; persist();
  painTime = 0;
  setupGrid(LEVELS[i]);
  resetRun();
  screen = 'game';
  layoutBoard();
  buildHud();
  clearOverlay();
  board.alpha = 0; board.scale.set(0.92);
  tween(0.4, k => { board.alpha = k; const s = 0.92 + 0.08 * easeOutBack(k); board.scale.set(s); });
  if (i === 0) showToast(t('swipeHint'), 3.2);
  else if (i === 1) showToast(t('fillHint'), 3.2);
  else if (i === 2) showToast(t('snackHint'), 3.6);
  else if (i === FIRST_ARROW) showToast(t('arrowHint'), 3.6);
  else if (i === FIRST_PORTAL) showToast(t('portalHint'), 3.6);
}

function resetRun() {
  // settle running tweens before their sprites are rebuilt
  for (const tw of tweens.splice(0)) if (tw.delay <= 0) { tw.fn(1); tw.done?.(); }
  const L = LEVELS[levelIdx];
  occupied = new Uint8Array(GW * GH);
  const s = L.start[1] * GW + L.start[0];
  path = [s]; occupied[s] = 1;
  hideStuck();
  slides = 0; won = false; anim = null; queuedDir = -1; history = []; stuckShown = false; facing = 1;
  for (const sn of snacks) sn.sprite.destroy({ children: true });
  snacks = [];
  L.snacks.forEach((d, k) => {
    const c = new PIXI.Container();
    const sTex = [TX.popcorn, TX.pretzel, TX.donut][(k + levelIdx) % 3];
    const spr = new PIXI.Sprite(sTex);
    spr.anchor.set(0.5, 0.75);
    c.addChild(spr);
    const tag = new PIXI.Container();
    const tg = new PIXI.Graphics();
    tg.circle(0, 0, 13).fill(C.cream).stroke({ width: 2.5, color: C.ink });
    const tt = new PIXI.Text({ text: '', style: { fontFamily: FONT, fontSize: 16, fontWeight: '700', fill: C.ink } });
    tt.anchor.set(0.5);
    tag.addChild(tg, tt);
    c.addChild(tag);
    snackLayer.addChild(c);
    snacks.push({ x: d[0], y: d[1], deadline: d[2], state: 'fresh', sprite: c, tag, tagText: tt, kind: k, spriteTex: sTex });
  });
  layoutSnacks();
  updateHudStars();
}

function layoutBoard() {
  const top = HUD_M + 58 + 58, bottom = 40;
  const availW = SW - 36, availH = SH - top - bottom;
  CS = Math.floor(Math.min(availW / GW, availH / (GH + 0.3), 86));
  CS = Math.max(CS, 22);
  ELEV = CS * 0.2;
  const bw = GW * CS, bh = GH * CS;
  OX = Math.round((SW - bw) / 2);
  OY = Math.round(top + (availH - bh) / 2 + CS * 0.15);
  board.pivot.set(bw / 2, bh / 2);
  board.position.set(OX + bw / 2, OY + bh / 2);
  drawPit();
  layoutSnacks();
  buildDecor();
}

function isFloor(x        , y        ) { return x >= 0 && y >= 0 && x < GW && y < GH && floor[y * GW + x]; }

let rng = 1;
function srand(s        ) { rng = s >>> 0 || 1; }
function rand() { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; }

function drawPit() {
  pitMask.clear();
  pitDeco.clear();
  islandDeco.removeChildren().forEach(c => c.destroy());
  pitFloor.width = GW * CS; pitFloor.height = GH * CS;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (isFloor(x, y)) pitMask.rect(x * CS - 0.5, y * CS - 0.5, CS + 1, CS + 1);
  pitMask.fill(0xffffff);
  srand(levelIdx * 977 + 31);
  const wallH = CS * 0.3;
  // tile tint + grout
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (!isFloor(x, y)) continue;
    const px = x * CS, py = y * CS;
    const v = rand();
    pitDeco.rect(px, py, CS, CS).fill({ color: v < 0.5 ? 0x000000 : 0xffffff, alpha: 0.03 + 0.04 * Math.abs(v - 0.5) });
    pitDeco.rect(px + 2, py + 2, CS - 4, CS - 4).stroke({ width: 1.5, color: C.pitDark, alpha: 0.35 });
  }
  // special tiles: arrows and portals
  for (let i = 0; i < GW * GH; i++) {
    const cx = (i % GW) * CS + CS / 2, cy = Math.floor(i / GW) * CS + CS / 2;
    if (arrowAt[i] >= 0) {
      const [dx, dy] = DIRS[arrowAt[i]]; const px = -dy, py = dx; const a = CS * 0.28;
      const pts = (ox        , oy        ) => [
        cx + dx * a + ox, cy + dy * a + oy,
        cx - dx * a * 0.7 + px * a + ox, cy - dy * a * 0.7 + py * a + oy,
        cx - dx * a * 0.15 + ox, cy - dy * a * 0.15 + oy,
        cx - dx * a * 0.7 - px * a + ox, cy - dy * a * 0.7 - py * a + oy,
      ];
      pitDeco.poly(pts(1.5, 3)).fill({ color: 0x0d2340, alpha: 0.35 });
      pitDeco.poly(pts(0, 0)).fill(C.cream).stroke({ width: 2, color: C.creamDark });
    }
    if (portalAt[i] >= 0) {
      const pairIdx = LEVELS[levelIdx].portals.findIndex(p => p[1] * GW + p[0] === i || p[3] * GW + p[2] === i);
      const col = pairIdx === 0 ? 0xb267d6 : 0xf08a3c;
      pitDeco.circle(cx + 1.5, cy + 3, CS * 0.36).fill({ color: 0x0d2340, alpha: 0.3 });
      pitDeco.circle(cx, cy, CS * 0.36).fill(col);
      pitDeco.circle(cx, cy, CS * 0.26).fill(0x1c2f4d);
      pitDeco.circle(cx, cy, CS * 0.15).fill({ color: col, alpha: 0.75 });
      pitDeco.circle(cx, cy, CS * 0.06).fill(0x1c2f4d);
    }
  }
  // shadows & cardboard walls
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (!isFloor(x, y)) continue;
    const px = x * CS, py = y * CS;
    if (!isFloor(x - 1, y)) { for (let k = 0; k < 4; k++) pitDeco.rect(px, py, CS * 0.05 * (k + 1), CS).fill({ color: 0x0d2340, alpha: 0.07 }); }
    if (!isFloor(x + 1, y)) { for (let k = 0; k < 3; k++) pitDeco.rect(px + CS - CS * 0.035 * (k + 1), py, CS * 0.035 * (k + 1), CS).fill({ color: 0x0d2340, alpha: 0.06 }); }
    if (!isFloor(x, y - 1)) {
      for (let k = 0; k < 4; k++) pitDeco.rect(px, py + wallH, CS, CS * 0.06 * (k + 1)).fill({ color: 0x0d2340, alpha: 0.08 });
      // cardboard face
      pitDeco.rect(px, py, CS, wallH).fill(C.card);
      pitDeco.rect(px, py, CS, wallH * 0.22).fill({ color: C.cardDark, alpha: 0.55 });
      pitDeco.rect(px, py + wallH - 2, CS, 2).fill({ color: C.cardDark, alpha: 0.6 });
      const n = 5;
      for (let k = 0; k < n; k++) {
        const lx = px + (k + 0.5) * CS / n;
        pitDeco.moveTo(lx, py + wallH * 0.25).lineTo(lx, py + wallH - 2).stroke({ width: 1, color: C.cardDark, alpha: 0.35 });
      }
      // side caps where wall continues sideways
      if (!isFloor(x - 1, y)) pitDeco.poly([px, py, px + CS * 0.06, py + wallH * 0.2, px + CS * 0.06, py + wallH, px, py + wallH]).fill({ color: C.cardDark, alpha: 0.45 });
      if (!isFloor(x + 1, y)) pitDeco.poly([px + CS, py, px + CS - CS * 0.06, py + wallH * 0.2, px + CS - CS * 0.06, py + wallH, px + CS, py + wallH]).fill({ color: C.cardDark, alpha: 0.35 });
    }
  }
  // paper cut edge outline around the hole (on ground side)
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (!isFloor(x, y)) continue;
    const px = x * CS, py = y * CS;
    const lw = Math.max(2, CS * 0.045);
    if (!isFloor(x, y - 1)) pitDeco.rect(px - 1, py - lw, CS + 2, lw).fill({ color: C.cardLight });
    if (!isFloor(x, y + 1)) { pitDeco.rect(px - 1, py + CS - 1, CS + 2, lw).fill({ color: 0xfff3c2 }); pitDeco.rect(px, py + CS - 3, CS, 3).fill({ color: 0x0d2340, alpha: 0.25 }); }
    if (!isFloor(x - 1, y)) pitDeco.rect(px - lw, py, lw, CS).fill({ color: 0xfff3c2, alpha: 0.9 });
    if (!isFloor(x + 1, y)) pitDeco.rect(px + CS, py, lw, CS).fill({ color: C.cardLight, alpha: 0.9 });
  }
  // grass tufts on interior islands
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (isFloor(x, y)) continue;
    let n = 0; for (const [dx, dy] of DIRS) if (isFloor(x + dx, y + dy)) n++;
    if (n >= 3 && rand() < 0.5) {
      const g = new PIXI.Sprite(TX.grass); g.anchor.set(0.5, 0.85);
      g.width = CS * 0.45; g.scale.y = g.scale.x; g.position.set(x * CS + CS * (0.35 + rand() * 0.3), y * CS + CS * 0.6);
      islandDeco.addChild(g);
    }
  }
}

function layoutSnacks() {
  for (const s of snacks) {
    s.sprite.position.set(s.x * CS + CS / 2, s.y * CS + CS * 0.72);
    const spr = s.sprite.children[0]               ;
    const sz = CS * 0.66;
    const tw = spr.texture.width, th = spr.texture.height;
    spr.scale.set(sz / Math.max(tw, th));
    s.tag.position.set(CS * 0.3, -CS * 0.5);
    s.tag.scale.set(Math.max(0.65, Math.min(1, CS / 64)));
    s.tagText.style.fontFamily = FONT;
    s.tagText.text = String(Math.max(0, s.deadline - slides));
    s.tag.visible = s.state === 'fresh';
  }
}

function buildDecor() {
  decoBack.removeChildren().forEach(c => c.destroy());
  decoFront.removeChildren().forEach(c => c.destroy());
  srand(levelIdx * 131 + 7);
  const bx0 = OX - 16, by0 = OY - 24, bx1 = OX + GW * CS + 16, by1 = OY + GH * CS + 16;
  const place = (tex              , h        , x        , y        , front = false, flip = false) => {
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5, 0.9);
    const sc = h / tex.height; s.scale.set(flip ? -sc : sc, sc); s.position.set(x, y);
    (front ? decoFront : decoBack).addChild(s);
    const kind           = tex === TX.bush ? 'bush' : tex === TX.grass ? 'grass' : (tex === TX.flagRed || tex === TX.flagBlue) ? 'flag' : 'flower';
    decos.push({ s, kind, sx: s.scale.x, sy: sc, phase: rand() * 6.28, ang: 0, vel: 0, pop: 0, h });
    return s;
  };
  decos = [];
  // bushes in corners
  const bushH = Math.min(150, Math.max(70, SW * 0.22));
  place(TX.bush, bushH, bushH * 0.55, SH + bushH * 0.35, true);
  place(TX.bush, bushH * 0.85, SW - bushH * 0.2, bushH * 0.55, true, true);
  // scatter
  const items = [TX.flower, TX.grass, TX.flower, TX.grass, TX.flagRed, TX.flagBlue, TX.grass, TX.flower];
  const occupiedSpots                     = [];
  let tries = 0, placed = 0;
  const target = Math.round(Math.max(8, (SW * SH) / 26000));
  while (placed < target && tries < 400) {
    tries++;
    const x = 20 + rand() * (SW - 40), y = 120 + rand() * (SH - 150);
    if (x > bx0 - 10 && x < bx1 + 10 && y > by0 && y < by1 + 40) continue;
    if (y > SH - 120 && Math.abs(x - SW / 2) < 140) continue;
    if (occupiedSpots.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 70)) continue;
    occupiedSpots.push([x, y]);
    const tex = items[placed % items.length];
    const h = tex === TX.grass ? 26 : tex === TX.flower ? 48 : 64;
    place(tex, h * (0.85 + rand() * 0.3), x, y, false, rand() < 0.3 && tex !== TX.flagRed && tex !== TX.flagBlue);
    placed++;
  }
  // little grass tufts hugging the board edge so the pit feels planted in the meadow
  const edgeN = Math.min(10, GW + GH);
  for (let i = 0; i < edgeN; i++) {
    const side = i % 4;
    const tt = rand();
    let x = 0, y = 0;
    if (side === 0) { x = bx0 + tt * (bx1 - bx0); y = by0 + 6; }
    else if (side === 1) { x = bx0 + tt * (bx1 - bx0); y = by1 + 18; }
    else if (side === 2) { x = bx0 - 4; y = by0 + 30 + tt * (by1 - by0 - 30); }
    else { x = bx1 + 4; y = by0 + 30 + tt * (by1 - by0 - 30); }
    if (y < 110 || y > SH - 10) continue;
    place(TX.grass, 22 * (0.8 + rand() * 0.4), x, y, side === 1, rand() < 0.5);
  }
  buildAmbient();
}

// ---------- living scenery ----------
;                                                    
;                                                                                                                                         
let decos         = [];
                                                                   
let kicks         = [];
let wind = 0, windTarget = 0, windTimer = 2;
                                                                                                                                                                
let flies        = [];
                                                                                                                                       
let petals          = [];
let petalTimer = 0;
                                                                                 
let clouds          = [];
const cloudLayer = new PIXI.Container();

function buildAmbient() {
  for (const f of flies) f.g.destroy({ children: true });
  for (const p of petals) p.g.destroy();
  for (const c of clouds) c.g.destroy();
  flies = []; petals = []; clouds = [];
  if (cloudLayer.parent !== ambientLayer) ambientLayer.addChild(cloudLayer);
  // soft drifting cloud shadows over the paper meadow
  for (let i = 0; i < 2; i++) {
    const g = new PIXI.Graphics();
    const w = Math.max(SW, 360) * (0.55 + i * 0.2);
    g.ellipse(0, 0, w * 0.5, w * 0.16).fill({ color: 0x4a3a10, alpha: 0.05 });
    g.ellipse(w * 0.18, -w * 0.05, w * 0.3, w * 0.12).fill({ color: 0x4a3a10, alpha: 0.04 });
    g.ellipse(-w * 0.22, w * 0.03, w * 0.26, w * 0.1).fill({ color: 0x4a3a10, alpha: 0.04 });
    cloudLayer.addChild(g);
    clouds.push({ g, x: rand() * SW, y: SH * (0.25 + i * 0.45), sp: 9 + i * 5, w });
  }
  // paper butterflies
  const colors = [[0xf28ab2, 0xd8547f], [0x7ec8f0, 0x3f8fd6], [0xffd25a, 0xe0a12a]];
  const n = SW * SH > 500000 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const [c1, c2] = colors[i % colors.length];
    const g = new PIXI.Container();
    const sz = 11;
    const mk = (side        ) => {
      const w = new PIXI.Graphics();
      w.ellipse(side * sz * 0.55, -sz * 0.25, sz * 0.6, sz * 0.48).fill(c1).stroke({ width: 1.2, color: c2 });
      w.ellipse(side * sz * 0.42, sz * 0.38, sz * 0.4, sz * 0.32).fill(c2);
      w.circle(side * sz * 0.6, -sz * 0.3, sz * 0.14).fill({ color: 0xffffff, alpha: 0.8 });
      return w;
    };
    const wl = mk(-1), wr = mk(1);
    const bodyB = new PIXI.Graphics();
    bodyB.roundRect(-1.6, -sz * 0.55, 3.2, sz * 1.15, 1.6).fill(0x3a2a1a);
    bodyB.moveTo(0, -sz * 0.5).lineTo(-3, -sz * 0.95).moveTo(0, -sz * 0.5).lineTo(3, -sz * 0.95).stroke({ width: 1, color: 0x3a2a1a });
    g.addChild(wl, wr, bodyB);
    const shadow = new PIXI.Graphics(); shadow.ellipse(0, 26, 7, 2.5).fill({ color: 0x000000, alpha: 0.12 });
    g.addChildAt(shadow, 0);
    ambientLayer.addChild(g);
    const x = rand() * SW, y = 130 + rand() * (SH - 200);
    flies.push({ g, wl, wr, x, y, tx: x, ty: y, sp: 45 + rand() * 25, phase: rand() * 6, rest: 0 });
  }
}

// a ripple of wind spreading from a world point: plants lean away, then spring back
function gustFrom(gx        , gy        , strength        , popAmt = 0) {
  for (const d of decos) {
    const dx = d.s.x - gx, dy = d.s.y - gy;
    const dist = Math.hypot(dx, dy);
    const fall = Math.max(0, 1 - dist / (Math.max(SW, SH) * 0.9));
    if (fall <= 0) continue;
    const dirSign = dx >= 0 ? 1 : -1;
    kicks.push({ at: time + dist / 700, deco: d, amt: dirSign * strength * (0.4 + 0.6 * fall), pop: popAmt * fall });
  }
  // butterflies get spooked
  for (const f of flies) {
    const dist = Math.hypot(f.x - gx, f.y - gy);
    if (dist < 220 * (0.5 + strength)) { f.rest = 0; const a = Math.atan2(f.y - gy, f.x - gx); f.tx = clampX(f.x + Math.cos(a) * 160); f.ty = clampY(f.y + Math.sin(a) * 160); f.sp = 140; }
  }
}
function clampX(x        ) { return Math.max(20, Math.min(SW - 20, x)); }
function clampY(y        ) { return Math.max(110, Math.min(SH - 30, y)); }
function boardToWorld(x        , y        ) { const p = board.toGlobal(new PIXI.Point(x, y)); return shakeLayer.toLocal(p); }

function spawnPetal(x        , y        , burst = false) {
  const g = new PIXI.Graphics();
  const col = [0xffffff, 0xfff3c4, 0xf7b6c8, 0xffe08a][Math.floor(Math.random() * 4)];
  g.ellipse(0, 0, 5, 2.6).fill(col).stroke({ width: 0.8, color: 0xd9c08a, alpha: 0.6 });
  g.position.set(x, y);
  ambientLayer.addChild(g);
  const a = burst ? Math.random() * Math.PI * 2 : 0;
  const sp = burst ? 60 + Math.random() * 90 : 0;
  petals.push({ g, x, y, vx: burst ? Math.cos(a) * sp : 12 + Math.random() * 14, vy: burst ? Math.sin(a) * sp - 60 : 14 + Math.random() * 10, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4, flip: Math.random() * 6, life: burst ? 1.6 : 9 });
}

function stepScenery(dt        ) {
  // shifting breeze
  windTimer -= dt;
  if (windTimer <= 0) { windTimer = 2.5 + Math.random() * 4; windTarget = (Math.random() - 0.35) * 0.9; }
  wind += (windTarget - wind) * Math.min(1, dt * 0.8);
  // delayed gust kicks
  if (kicks.length) {
    kicks = kicks.filter(k => {
      if (time < k.at) return true;
      if (!k.deco.s.destroyed) { k.deco.vel += k.amt * 9; k.deco.pop = Math.max(k.deco.pop, k.pop); }
      return false;
    });
  }
  for (const d of decos) {
    if (d.s.destroyed) continue;
    // spring toward rest
    d.vel += (-d.ang * 60 - d.vel * 7) * dt;
    d.ang += d.vel * dt;
    d.pop = Math.max(0, d.pop - dt * 2.2);
    const ph = time + d.phase;
    const popS = 1 + Math.sin(d.pop * Math.PI) * 0.18 * Math.min(1, d.pop * 3);
    if (d.kind === 'flower') {
      d.s.rotation = Math.sin(ph * 1.7) * 0.07 + wind * 0.12 + d.ang;
      d.s.scale.set(d.sx * popS, d.sy * popS * (1 + Math.sin(ph * 2.3) * 0.02));
    } else if (d.kind === 'grass') {
      d.s.rotation = 0;
      d.s.skew.x = Math.sin(ph * 2.4) * 0.12 + wind * 0.25 + d.ang * 1.4;
      d.s.scale.set(d.sx * popS, d.sy * popS * (1 + Math.sin(ph * 3.1) * 0.04));
    } else if (d.kind === 'flag') {
      // fabric flutter: horizontal squash travelling on the pennant + slight lean
      const f = Math.sin(ph * 7) * 0.06 + Math.sin(ph * 11.3) * 0.03;
      d.s.skew.y = Math.sin(ph * 6.2) * 0.06 + wind * 0.05;
      d.s.scale.set(d.sx * (1 + f + Math.abs(wind) * 0.04) * popS, d.sy * popS);
      d.s.rotation = d.ang * 0.6 + wind * 0.03;
    } else {
      d.s.rotation = d.ang * 0.25;
      const b = Math.sin(ph * 1.3) * 0.025;
      d.s.scale.set(d.sx * (1 + b) * popS, d.sy * (1 - b * 0.6) * popS);
    }
  }
  // clouds
  for (const c of clouds) {
    c.x += c.sp * dt;
    if (c.x - c.w * 0.6 > SW) c.x = -c.w * 0.6;
    c.g.position.set(c.x, c.y);
  }
  // butterflies: wander, sometimes land on a flower and slowly fan their wings
  for (const f of flies) {
    const dx = f.tx - f.x, dy = f.ty - f.y;
    const dist = Math.hypot(dx, dy);
    let flap        ;
    if (f.rest > 0) {
      f.rest -= dt;
      flap = 0.55 + 0.35 * Math.sin(time * 2.5 + f.phase);
      if (f.rest <= 0) { f.tx = clampX(f.x + (Math.random() - 0.5) * 300); f.ty = clampY(f.y + (Math.random() - 0.5) * 260); f.sp = 45 + Math.random() * 25; }
    } else if (dist < 6) {
      const flowers = decos.filter(d => d.kind === 'flower' && !d.s.destroyed);
      if (flowers.length && Math.random() < 0.45) {
        const fl = flowers[Math.floor(Math.random() * flowers.length)];
        f.tx = fl.s.x; f.ty = fl.s.y - fl.h * 0.7;
        if (Math.hypot(f.tx - f.x, f.ty - f.y) < 8) f.rest = 2 + Math.random() * 3;
      } else { f.tx = clampX(f.x + (Math.random() - 0.5) * 320); f.ty = clampY(f.y + (Math.random() - 0.5) * 260); }
      f.sp = 45 + Math.random() * 25;
      flap = Math.abs(Math.sin(time * 18 + f.phase));
    } else {
      const step = Math.min(dist, f.sp * dt);
      f.x += dx / dist * step; f.y += dy / dist * step + Math.sin(time * 6 + f.phase) * 18 * dt;
      f.g.rotation = Math.max(-0.5, Math.min(0.5, dx / dist * 0.4));
      flap = Math.abs(Math.sin(time * (f.sp > 100 ? 30 : 18) + f.phase));
      f.sp += (55 - f.sp) * dt;
    }
    f.wl.scale.x = 0.25 + 0.75 * flap; f.wr.scale.x = 0.25 + 0.75 * flap;
    const bob = f.rest > 0 ? 0 : Math.sin(time * 9 + f.phase) * 2;
    f.g.position.set(f.x, f.y + bob);
    (f.g.children[0]                 ).y = f.rest > 0 ? -18 : -bob;
  }
  // drifting petals
  petalTimer -= dt;
  if (petalTimer <= 0 && petals.length < 10) {
    petalTimer = 1.2 + Math.random() * 1.8;
    const flowers = decos.filter(d => d.kind === 'flower' && !d.s.destroyed);
    if (flowers.length) { const fl = flowers[Math.floor(Math.random() * flowers.length)]; spawnPetal(fl.s.x, fl.s.y - fl.h * 0.6); }
  }
  petals = petals.filter(p => {
    p.life -= dt;
    p.vx += (wind * 40 + 10 - p.vx) * dt * 0.8;
    p.vy += (16 - p.vy) * dt * 1.5;
    p.x += (p.vx + Math.sin(time * 2 + p.rot) * 14) * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.flip += dt * 5;
    p.g.position.set(p.x, p.y); p.g.rotation = p.rot; p.g.scale.y = Math.abs(Math.sin(p.flip)) * 0.8 + 0.2;
    p.g.alpha = Math.min(1, p.life * 1.5);
    if (p.life <= 0 || p.x > SW + 20 || p.y > SH + 20) { p.g.destroy(); return false; }
    return true;
  });
}

// tapping a flower/flag/bush makes it boing (petals fly from flowers)
function tapScenery(x        , y        ) {
  const pt = shakeLayer.toLocal(new PIXI.Point(x, y));
  let best              = null, bd = 1e9;
  for (const d of decos) {
    if (d.s.destroyed) continue;
    const cx = d.s.x, cy = d.s.y - d.h * 0.45;
    const dd = Math.hypot(pt.x - cx, pt.y - cy);
    if (dd < Math.max(32, d.h * 0.6) && dd < bd) { bd = dd; best = d; }
  }
  for (const f of flies) if (Math.hypot(pt.x - f.x, pt.y - f.y) < 40) { f.rest = 0; f.tx = clampX(f.x + (Math.random() - 0.5) * 360); f.ty = clampY(f.y - 120); f.sp = 160; return true; }
  if (!best) return false;
  best.vel += (pt.x < best.s.x ? 1 : -1) * 7;
  best.pop = 1;
  if (best.kind === 'flower') for (let i = 0; i < 6; i++) spawnPetal(best.s.x, best.s.y - best.h * 0.6, true);
  sfx('ui.click', 6 + Math.random() * 4);
  return true;
}

// ---------- gameplay ----------
function slideCells(dir        )           {
  // Same rules as the level solver: arrows turn the slide, portals jump to the partner and keep going.
  const head = path[path.length - 1];
  let [x, y] = cellXY(head);
  let d = dir;
  const cells           = [];
  const dirs           = [];
  const seen = new Set        ();
  while (true) {
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    const i = ny * GW + nx;
    if (!isFloor(nx, ny) || occupied[i] || seen.has(i)) break;
    x = nx; y = ny; cells.push(i); dirs.push(d); seen.add(i);
    const p = portalAt[i];
    if (p >= 0 && !occupied[p] && !seen.has(p)) { cells.push(p); dirs.push(-1); seen.add(p); x = p % GW; y = Math.floor(p / GW); }
    else if (arrowAt[i] >= 0) d = arrowAt[i];
  }
  lastDirs = dirs;
  return cells;
}

function hasMoves() { for (let d = 0; d < 4; d++) if (slideCells(d).length) return true; return false; }

function tryMove(dir        ) {
  if (screen !== 'game' || won || paused || overlayOpen) return;
  if (anim) { queuedDir = dir; return; }
  const cells = slideCells(dir);
  if (dir === 0) facing = 1; else if (dir === 1) facing = -1;
  if (!cells.length) {
    headSquash = 1; headBumpDir = dir; bumpTime = 0;
    sfx('move.bump', -2);
    ouch(dir, 0.3);
    return;
  }
  painTime = 0;
  history.push({ len: path.length, slides, snackStates: snacks.map(s => s.state) });
  anim = { cells, dirs: lastDirs.slice(), jump: false, t: 0, dir, speed: Math.max(14, Math.min(26, 10 + cells.length * 2)) };
  sfx('move.slide', Math.min(5, cells.length * 0.5));
}

function finishSlide() {
  if (!anim) return;
  const a = anim; anim = null;
  slides++;
  headSquash = 1; headBumpDir = a.dir; bumpTime = 0;
  shake = Math.min(6, 2 + a.cells.length * 0.6);
  sfx('move.bump');
  ouch(a.dir, Math.min(1, a.cells.length / 5));
  for (const s of snacks) if (s.state === 'fresh' && slides >= s.deadline) spoilSnack(s);
  layoutSnacks();
  updateHudStars();
  if (path.length === totalFloor) { win(); return; }
  if (!hasMoves()) {
    stuckShown = true;
    showStuck();
  }
  if (queuedDir >= 0) { const d = queuedDir; queuedDir = -1; tryMove(d); }
}

function stepAnim(dt        ) {
  if (!anim) return;
  anim.t += dt * anim.speed;
  while (anim && path.length - (history[history.length - 1].len) < Math.floor(anim.t) && path.length - history[history.length - 1].len < anim.cells.length) {
    const idx = path.length - history[history.length - 1].len;
    const c = anim.cells[idx];
    path.push(c); occupied[c] = 1;
    // snacks
    const [cx, cy] = cellXY(c);
    for (const s of snacks) if (s.state === 'fresh' && s.x === cx && s.y === cy) eatSnack(s);
    if (anim.dirs[idx] < 0) { puff(cx * CS + CS / 2, cy * CS + CS / 2, 8, [0xb267d6, 0xf08a3c, 0xffffff]); sfx('move.slide', 8); }
    if (idx + 1 < anim.cells.length) {
      const nd = anim.dirs[idx + 1];
      anim.jump = nd < 0;
      if (nd >= 0) { anim.dir = nd; if (nd === 0) facing = 1; else if (nd === 1) facing = -1; }
    } else anim.jump = false;
  }
  if (anim && anim.t >= anim.cells.length) { anim.t = anim.cells.length; finishSlide(); }
}

function eatSnack(s       ) {
  s.state = 'eaten';
  sfx('snack.eat', 2 + s.kind);
  s.tag.visible = false;
  const spr = s.sprite;
  puff(s.x * CS + CS / 2, s.y * CS + CS / 2, 10, [0xffffff, 0xf2c14e, C.red, 0xb5651d]);
  s.tw = tween(0.35, k => { spr.scale.set(1 + k * 0.6); spr.alpha = 1 - k; spr.y = s.y * CS + CS * 0.72 - k * CS * 0.6; });
  updateHudStars();
}
function spoilSnack(s       ) {
  s.state = 'spoiled';
  s.tag.visible = false;
  const spr = s.sprite;
  const sx = spr.x, sy = spr.y;
  s.tw = tween(0.6, k => { spr.alpha = 1 - k; spr.rotation = k * 1.2; spr.x = sx + k * CS * 0.8; spr.y = sy - k * CS * 1.4; spr.scale.set(1 - k * 0.5); });
}

// Wall impact: random pained face (never the same twice in a row), spark burst, dizzy stars.
function ouch(dir        , strength        ) {
  painTex = pickFace(PAIN_TEX, recentPain);
  painTime = 0.6 + 0.5 * strength;
  const [hx, hy] = cellXY(path[path.length - 1]);
  const ix = hx * CS + CS / 2 + DIRS[dir][0] * CS * 0.55, iy = hy * CS + CS / 2 + DIRS[dir][1] * CS * 0.55 - ELEV;
  puff(ix, iy, 5 + Math.round(strength * 5), [C.cardLight, C.yellowLight, 0xffffff]);
  { const w = boardToWorld(ix, iy); gustFrom(w.x, w.y, 0.35 + strength * 0.65); }
  // comic impact spikes
  const spike = new PIXI.Graphics();
  const n = 9, r0 = CS * 0.18, r1 = CS * (0.45 + 0.25 * strength);
  const pts           = [];
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; const r = i % 2 ? r0 : r1; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
  spike.poly(pts).fill(0xfff3a0).stroke({ width: 3, color: C.red });
  spike.position.set(ix, iy); spike.rotation = Math.random();
  fxLayer.addChild(spike);
  tween(0.35, kk => { spike.scale.set(0.4 + kk * 0.9); spike.alpha = 1 - kk; }, () => spike.destroy());
}

function restart() {
  if (screen !== 'game') return;
  retries++;
  painTime = 0;
  resetRun();
  sfx('move.undo', -3);
  board.scale.set(0.96);
  tween(0.25, k => board.scale.set(0.96 + 0.04 * easeOutBack(k)));
}

function starsNow() {
  const snackOk = snacks.every(s => s.state === 'eaten');
  return { clear: won, snack: snackOk, perfect: retries === 0 };
}

function win() {
  won = true; winTime = 0;
  sfx('level.win');
  sfx('chicken.squawk', 5);
  winTex = pickFace(JOY_TEX, recentJoy);
  headSprite.texture = winTex;
  const st = starsNow();
  const n = 1 + (st.snack ? 1 : 0) + (st.perfect ? 1 : 0);
  save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, n);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
  persist();
  updateHudStars();
  // confetti
  painTime = 0;
  hideStuck();
  for (let i = 0; i < 4; i++) setTimeout(() => puff(Math.random() * GW * CS, Math.random() * GH * CS, 12, [C.red, 0x3f8fd6, C.yellow, 0xffffff, C.green]), i * 150);
  setTimeout(() => confettiBurst(70), 900);
  setTimeout(() => { const w = boardToWorld(GW * CS / 2, GH * CS / 2); gustFrom(w.x, w.y, 1.1, 1); for (const d of decos) if (d.kind === 'flower' && !d.s.destroyed) for (let i = 0; i < 3; i++) spawnPetal(d.s.x, d.s.y - d.h * 0.6, true); }, 950);
  setTimeout(() => showWinPanel(st), 1100);
}

// ---------- particles ----------
;                                                                                                 
let parts         = [];
function puff(x        , y        , n        , colors          ) {
  for (let i = 0; i < n; i++) {
    const g = new PIXI.Graphics();
    const s = CS * (0.06 + Math.random() * 0.08);
    g.rect(-s, -s * 0.6, s * 2, s * 1.2).fill(colors[i % colors.length]);
    g.position.set(x, y);
    g.rotation = Math.random() * 6;
    fxLayer.addChild(g);
    const a = Math.random() * Math.PI * 2, sp = CS * (1.5 + Math.random() * 3);
    parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - CS * 2, life: 0, max: 0.6 + Math.random() * 0.4, vr: (Math.random() - 0.5) * 12 });
  }
}
function stepParts(dt        ) {
  parts = parts.filter(p => {
    p.life += dt;
    if (p.life >= p.max) { p.g.destroy(); return false; }
    p.vy += CS * 9 * dt;
    p.vx *= 0.97;
    p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.g.rotation += p.vr * dt;
    p.g.alpha = 1 - p.life / p.max;
    return true;
  });
}

// ---------- body rendering ----------
function drawBody(time        ) {
  bodyG.clear();
  const n = path.length;
  // head float position
  let hx        , hy        ;
  const [lx, ly] = cellXY(path[n - 1]);
  hx = lx; hy = ly;
  let partial = 0;
  if (anim) {
    const done = n - history[history.length - 1].len;
    partial = anim.jump ? 0 : Math.max(0, Math.min(1, anim.t - done));
    hx = lx + DIRS[anim.dir][0] * partial; hy = ly + DIRS[anim.dir][1] * partial;
  }
  // per-cell connection info
  ;                                                                 
  const segs        = [];
  const pos = new Map                ();
  path.forEach((c, i) => pos.set(c, i));
  for (let i = 0; i < n; i++) {
    const [x, y] = cellXY(path[i]);
    const conn = [false, false, false, false];
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= n) continue;
      const [x2, y2] = cellXY(path[j]);
      for (let d = 0; d < 4; d++) if (x + DIRS[d][0] === x2 && y + DIRS[d][1] === y2) conn[d] = true;
    }
    if (i === n - 1 && anim && partial > 0) conn[anim.dir] = true;
    segs.push({ x, y, conn, idx: i });
  }
  const order = segs.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const pad = CS * 0.07;
  for (const s of order) {
    let lift = 0;
    if (won) { const w = winTime * 14 - s.idx * 0.6; if (w > 0 && w < Math.PI) lift = Math.sin(w) * CS * 0.18; }
    let x0 = s.x * CS + pad, x1 = (s.x + 1) * CS - pad, y0 = s.y * CS + pad, y1 = (s.y + 1) * CS - pad;
    if (s.conn[1]) x0 = s.x * CS; if (s.conn[0]) x1 = (s.x + 1) * CS;
    if (s.conn[3]) y0 = s.y * CS; if (s.conn[2]) y1 = (s.y + 1) * CS;
    if (s.idx === n - 1 && anim && partial > 0) {
      const d = DIRS[anim.dir];
      if (d[0] > 0) x1 = (s.x + 1) * CS + partial * CS - pad; if (d[0] < 0) x0 = s.x * CS - partial * CS + pad;
      if (d[1] > 0) y1 = (s.y + 1) * CS + partial * CS - pad; if (d[1] < 0) y0 = s.y * CS - partial * CS + pad;
    }
    drawBlock(x0, y0 - ELEV - lift, x1, y1 - ELEV - lift, s, lift);
  }
  // head
  const headLift = won ? Math.abs(Math.sin(winTime * 8)) * CS * 0.25 : 0;
  headSprite.position.set(hx * CS + CS / 2, (hy + 1) * CS - pad - ELEV * 0.4 - headLift);
  let sq = headSquash;
  const fm = faceMeta(headSprite.texture);
  headSprite.anchor.set(0.5, fm.ay);
  const baseS = (CS * (won ? 1.42 : 1.53)) / fm.h;
  // dizzy stars orbiting while in pain
  dizzyG.clear();
  if (painTime > 0 && !won) {
    const ox = headSprite.x, oy = headSprite.y - CS * 1.45;
    const a = Math.min(1, painTime * 3);
    for (let i = 0; i < 3; i++) {
      const ang = time * 7 + i * Math.PI * 2 / 3;
      const sx2 = ox + Math.cos(ang) * CS * 0.42, sy2 = oy + Math.sin(ang) * CS * 0.14;
      const r = CS * 0.09 * (0.8 + 0.3 * Math.sin(ang));
      const p           = [];
      for (let k = 0; k < 10; k++) { const aa = k / 10 * Math.PI * 2 - Math.PI / 2; const rr = k % 2 ? r * 0.45 : r; p.push(sx2 + Math.cos(aa) * rr, sy2 + Math.sin(aa) * rr); }
      dizzyG.poly(p).fill({ color: C.yellow, alpha: a }).stroke({ width: 1.5, color: C.yellowDeep, alpha: a });
    }
  }
  let sx = 1, sy = 1;
  if (sq > 0) {
    const wob = Math.sin(bumpTime * 30) * sq;
    if (headBumpDir === 0 || headBumpDir === 1) { sx = 1 - 0.18 * wob; sy = 1 + 0.12 * wob; }
    else { sy = 1 - 0.18 * wob; sx = 1 + 0.12 * wob; }
  }
  if (anim) { const st = 0.08; if (anim.dir <= 1) { sx *= 1 + st; sy *= 1 - st; } else { sy *= 1 + st; sx *= 1 - st; } }
  const idle = won ? 0 : Math.sin(time * 3) * 0.02;
  headSprite.scale.set(baseS * sx * facing, baseS * sy * (1 + idle));
  // shadow under head handled by block
}

function drawBlock(x0        , y0        , x1        , y1        , s                                                        , lift        ) {
  const g = bodyG;
  const w = x1 - x0, h = y1 - y0;
  const r = Math.min(CS * 0.1, w / 3, h / 3);
  // drop shadow on floor
  g.rect(x0 + 2, y1 + ELEV + lift - 2, w, CS * 0.08).fill({ color: 0x0d2340, alpha: 0.25 });
  // front (south) face
  g.roundRect(x0, y0 + ELEV * 0.3, w, h + ELEV * 0.7 + lift, r).fill(C.yellowDark);
  g.rect(x0, y1 + ELEV * 0.4 + lift, w, ELEV * 0.6 - 1).fill({ color: C.yellowDeep, alpha: 0.5 });
  // top face
  g.roundRect(x0, y0, w, h, r).fill(C.yellow);
  // accordion folds
  const horiz = (s.conn[0] || s.conn[1]) && !(s.conn[2] || s.conn[3]);
  const vert = (s.conn[2] || s.conn[3]) && !(s.conn[0] || s.conn[1]);
  const k = 3;
  if (horiz) {
    const step = w / k;
    for (let i = 0; i < k; i++) {
      const fx = x0 + i * step;
      g.poly([fx, y0, fx + step * 0.5, y0 + h * 0.5, fx, y1]).fill({ color: C.yellowLight, alpha: 0.75 });
      g.poly([fx + step * 0.5, y0 + h * 0.5, fx + step, y0, fx + step, y1]).fill({ color: C.yellowDark, alpha: 0.35 });
      g.moveTo(fx + step, y1).lineTo(fx + step, y1 + ELEV * 0.7 + lift).stroke({ width: 1.2, color: C.yellowDeep, alpha: 0.6 });
    }
  } else if (vert) {
    const step = h / k;
    for (let i = 0; i < k; i++) {
      const fy = y0 + i * step;
      g.poly([x0, fy, x0 + w * 0.5, fy + step * 0.5, x1, fy]).fill({ color: C.yellowLight, alpha: 0.75 });
      g.poly([x0, fy + step, x0 + w * 0.5, fy + step * 0.5, x1, fy + step]).fill({ color: C.yellowDark, alpha: 0.3 });
    }
  } else {
    // corner / single: faceted pyramid folds
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    g.poly([x0, y0, x1, y0, cx, cy]).fill({ color: C.yellowLight, alpha: 0.7 });
    g.poly([x0, y0, x0, y1, cx, cy]).fill({ color: C.yellowLight, alpha: 0.35 });
    g.poly([x1, y0, x1, y1, cx, cy]).fill({ color: C.yellowDark, alpha: 0.25 });
    g.poly([x0, y1, x1, y1, cx, cy]).fill({ color: C.yellowDark, alpha: 0.35 });
  }
  // top edge highlight
  g.rect(x0 + r * 0.5, y0, w - r, 2).fill({ color: 0xffffff, alpha: 0.35 });
}

// ---------- UI helpers (papercraft kit) ----------
function darken(c        , f        ) {
  const r = Math.round(((c >> 16) & 255) * f), g = Math.round(((c >> 8) & 255) * f), b = Math.round((c & 255) * f);
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
}
function txt(s        , size        , color = C.ink, weight      = '700', stroke                                   ) {
  const style      = { fontFamily: FONT, fontSize: size, fontWeight: weight, fill: color, align: 'center' };
  if (stroke) style.stroke = { color: stroke.color, width: stroke.width, join: 'round' };
  const tx = new PIXI.Text({ text: s, style });
  tx.anchor.set(0.5);
  return tx;
}
function fitText(tx           , maxW        ) { if (tx.width > maxW) tx.scale.set(maxW / tx.width * tx.scale.x); }

// dashed "stitch" outline along a rect (corners skipped)
function stitch(g               , x        , y        , w        , h        , r        , color        , alpha        , width = 2) {
  const dash = 7, gap = 6;
  const line = (x0        , y0        , x1        , y1        ) => {
    const len = Math.hypot(x1 - x0, y1 - y0); const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    for (let d = 0; d < len; d += dash + gap) { const e = Math.min(len, d + dash); g.moveTo(x0 + ux * d, y0 + uy * d).lineTo(x0 + ux * e, y0 + uy * e); }
  };
  line(x + r, y, x + w - r, y); line(x + r, y + h, x + w - r, y + h);
  line(x, y + r, x, y + h - r); line(x + w, y + r, x + w, y + h - r);
  g.stroke({ width, color, alpha, cap: 'round' });
}
function tape(parent                , x        , y        , w        , rot        ) {
  const g = new PIXI.Graphics();
  const h = 20, z = 4;
  const pts           = [];
  for (let i = 0; i <= 4; i++) pts.push(-w / 2 + (i % 2 ? z : 0), -h / 2 + i * h / 4);
  for (let i = 4; i >= 0; i--) pts.push(w / 2 - (i % 2 ? z : 0), -h / 2 + i * h / 4);
  g.poly(pts).fill({ color: 0xf3e6c0, alpha: 0.82 });
  g.rect(-w / 2 + 4, -h / 2 + 3, w - 8, 3).fill({ color: 0xffffff, alpha: 0.35 });
  g.position.set(x, y); g.rotation = rot;
  parent.addChild(g);
}

;                                                                
;                                                                                                                                                                                                         
function makeButton(w        , h        , opts         , onTap            ) {
  const c = new PIXI.Container();
  const fill = opts.fill ?? C.cream;
  const depth = opts.depth ?? Math.max(5, Math.min(9, h * 0.1));
  const r = opts.radius ?? Math.min(18, Math.min(w, h) * 0.3);
  const base = new PIXI.Graphics();
  base.roundRect(-w / 2 + 2, -h / 2 + depth + 4, w, h, r).fill({ color: 0x4a3a18, alpha: 0.22 });
  base.roundRect(-w / 2, -h / 2 + depth, w, h, r).fill(darken(fill, 0.72));
  c.addChild(base);
  const face = new PIXI.Container();
  const fg = new PIXI.Graphics();
  fg.roundRect(-w / 2, -h / 2, w, h, r).fill(fill);
  fg.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.32, r * 0.7).fill({ color: 0xffffff, alpha: 0.22 });
  stitch(fg, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.max(4, r - 4), darken(fill, 0.6), 0.45, 1.6);
  face.addChild(fg);
  const col = opts.iconColor ?? C.ink;
  const s = Math.min(w, h);
  const mkIcon = (size        )                 => {
    if (opts.iconTex) { const sp = new PIXI.Sprite(opts.iconTex); sp.anchor.set(0.5); sp.scale.set(size * 0.52 / opts.iconTex.height); return sp; }
    const g = new PIXI.Graphics(); opts.icon (g, size, col); return g;
  };
  if ((opts.icon || opts.iconTex) && opts.label) {
    const tx = txt(opts.label, opts.fontSize ?? 24, opts.textColor ?? C.ink, '800');
    const ig = mkIcon(s * 0.8);
    const iw = s * 0.42;
    fitText(tx, w - iw - 36);
    const total = iw + 8 + tx.width;
    ig.x = -total / 2 + iw / 2; tx.x = -total / 2 + iw + 8 + tx.width / 2;
    face.addChild(ig, tx);
  } else if (opts.icon || opts.iconTex) {
    face.addChild(mkIcon(s));
  } else if (opts.label) {
    const tx = txt(opts.label, opts.fontSize ?? 24, opts.textColor ?? C.ink, '800'); fitText(tx, w - 22); face.addChild(tx);
  }
  c.addChild(face);
  (c       ).face = face;
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h + depth);
  const up = () => { face.y = 0; };
  c.on('pointerdown', () => { face.y = depth * 0.75; });
  c.on('pointerupoutside', up);
  c.on('pointerleave', up);
  c.on('pointerup', () => { up(); sfx('ui.click'); onTap(); });
  return c;
}

// icons: drawn centred, s = button size
const iconPause         = (g, s, col) => { g.roundRect(-s * 0.15, -s * 0.18, s * 0.11, s * 0.36, 3).fill(col); g.roundRect(s * 0.04, -s * 0.18, s * 0.11, s * 0.36, 3).fill(col); };
const iconGear         = (g, s, col) => {
  const r = s * 0.15, r2 = s * 0.22, w = s * 0.05;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    g.poly([c * r * 0.7 - sn * w, sn * r * 0.7 + c * w, c * r2 - sn * w * 0.75, sn * r2 + c * w * 0.75, c * r2 + sn * w * 0.75, sn * r2 - c * w * 0.75, c * r * 0.7 + sn * w, sn * r * 0.7 - c * w]).fill(col);
  }
  g.circle(0, 0, r).fill(col);
  g.circle(0, 0, r * 0.45).fill(C.cream);
};
const iconRestart         = (g, s, col) => {
  const r = s * 0.18;
  g.arc(0, 0, r, -Math.PI * 0.3, Math.PI * 1.45).stroke({ width: s * 0.085, color: col, cap: 'round' });
  const a = -Math.PI * 0.3; const ex = Math.cos(a) * r, ey = Math.sin(a) * r;
  g.poly([ex - s * 0.03, ey - s * 0.13, ex + s * 0.13, ey + s * 0.02, ex - s * 0.08, ey + s * 0.07]).fill(col);
};
// the platform coin, d = diameter in px
function coinSprite(d        ) { const sp = new PIXI.Sprite(TX.coin); sp.anchor.set(0.5); sp.scale.set(d / TX.coin.height); return sp; }
// purchase feedback: a coin pops up, flips twice and fades
function coinPop() {
  const d = 84, base = d / TX.coin.height, y0 = SH * 0.42;
  const c = coinSprite(d); c.position.set(SW / 2, y0); toastLayer.addChild(c);
  tween(1.0, k => {
    const e = easeOutBack(Math.min(1, k * 2.4));
    c.scale.set(base * e * Math.cos(k * Math.PI * 4), base * e);
    c.y = y0 - k * 70; c.alpha = k < 0.7 ? 1 : (1 - k) / 0.3;
  }, () => c.destroy());
}
const SHOP_FILL = 0xffe9a8;
const iconPlay         = (g, s, col) => { g.poly([-s * 0.1, -s * 0.18, s * 0.18, 0, -s * 0.1, s * 0.18]).fill(col); };
const iconGrid         = (g, s, col) => { const k = s * 0.1, gp = s * 0.035; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.roundRect(-k - gp / 2 + i * (k + gp), -k - gp / 2 + j * (k + gp), k, k, 2).fill(col); };
const iconHome         = (g, s, col) => {
  g.poly([0, -s * 0.2, s * 0.2, -s * 0.02, -s * 0.2, -s * 0.02]).fill(col);
  g.rect(-s * 0.14, -s * 0.03, s * 0.28, s * 0.2).fill(col);
  g.rect(-s * 0.04, s * 0.06, s * 0.08, s * 0.11).fill(0xffffff);
};
const iconMusic = (on         )         => (g, s, col) => {
  g.rect(-s * 0.02, -s * 0.18, s * 0.05, s * 0.28).fill(col);
  g.poly([s * 0.03, -s * 0.18, s * 0.16, -s * 0.12, s * 0.16, -s * 0.05, s * 0.03, -s * 0.1]).fill(col);
  g.ellipse(-s * 0.07, s * 0.11, s * 0.09, s * 0.07).fill(col);
  if (!on) g.moveTo(-s * 0.2, -s * 0.2).lineTo(s * 0.2, s * 0.2).stroke({ width: s * 0.06, color: C.red, cap: 'round' });
};
const iconSpeaker = (on         )         => (g, s, col) => {
  g.poly([-s * 0.18, -s * 0.07, -s * 0.08, -s * 0.07, s * 0.04, -s * 0.18, s * 0.04, s * 0.18, -s * 0.08, s * 0.07, -s * 0.18, s * 0.07]).fill(col);
  if (on) { g.arc(s * 0.06, 0, s * 0.1, -0.9, 0.9).stroke({ width: s * 0.045, color: col, cap: 'round' }); g.arc(s * 0.06, 0, s * 0.18, -0.9, 0.9).stroke({ width: s * 0.045, color: col, cap: 'round' }); }
  else g.moveTo(-s * 0.2, -s * 0.2).lineTo(s * 0.2, s * 0.2).stroke({ width: s * 0.06, color: C.red, cap: 'round' });
};
const iconGlobe         = (g, s, col) => {
  const r = s * 0.17;
  g.circle(0, 0, r).stroke({ width: s * 0.045, color: col });
  g.ellipse(0, 0, r * 0.45, r).stroke({ width: s * 0.035, color: col });
  g.moveTo(-r, 0).lineTo(r, 0).stroke({ width: s * 0.035, color: col });
};
const iconBack         = (g, s, col) => {
  g.moveTo(s * 0.14, 0).lineTo(-s * 0.1, 0).stroke({ width: s * 0.08, color: col, cap: 'round' });
  g.poly([-s * 0.2, 0, -s * 0.04, -s * 0.14, -s * 0.04, s * 0.14]).fill(col);
};

// red paper ribbon banner with folded tails
function ribbon(parent                , text        , cx        , cy        , w        , color = C.red, size = 30) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const h = size * 1.75, tail = h * 0.75, drop = h * 0.28;
  const dark = darken(color, 0.62);
  // tails
  g.poly([-w / 2 - tail, drop, -w / 2 + 6, drop, -w / 2 + 6, h + drop, -w / 2 - tail, h + drop, -w / 2 - tail + h * 0.32, drop + h / 2]).fill(darken(color, 0.82));
  g.poly([w / 2 + tail, drop, w / 2 - 6, drop, w / 2 - 6, h + drop, w / 2 + tail, h + drop, w / 2 + tail - h * 0.32, drop + h / 2]).fill(darken(color, 0.82));
  g.poly([-w / 2 + 6, h, -w / 2 + 6 + tail * 0.45, h + drop, -w / 2 + 6, h + drop]).fill(dark);
  g.poly([w / 2 - 6, h, w / 2 - 6 - tail * 0.45, h + drop, w / 2 - 6, h + drop]).fill(dark);
  // body
  g.rect(-w / 2 + 3, 5, w, h).fill({ color: 0x3a2a10, alpha: 0.2 });
  g.rect(-w / 2, 0, w, h).fill(color);
  g.rect(-w / 2, 0, w, h * 0.3).fill({ color: 0xffffff, alpha: 0.14 });
  stitch(g, -w / 2 + 6, 6, w - 12, h - 12, 0, 0xffffff, 0.55, 1.6);
  c.addChild(g);
  const tx = txt(text, size, 0xffffff, '900', { color: dark, width: 5 });
  fitText(tx, w - 30);
  tx.position.set(0, h / 2);
  c.addChild(tx);
  c.position.set(cx, cy - h / 2);
  parent.addChild(c);
  return c;
}

function panel(parent                , w        , h        , cx        , cy        ) {
  const g = new PIXI.Graphics();
  // kraft cardboard back, slightly rotated
  const back = new PIXI.Graphics();
  back.roundRect(-w / 2, -h / 2, w, h, 24).fill(C.card);
  back.position.set(cx + 6, cy + 9); back.rotation = -0.02;
  parent.addChild(back);
  g.roundRect(cx - w / 2 + 3, cy - h / 2 + 7, w, h, 24).fill({ color: 0x4a3a18, alpha: 0.18 });
  g.roundRect(cx - w / 2, cy - h / 2, w, h, 24).fill(C.cream);
  // paper grain lines
  srand(Math.round(w * 7 + h));
  for (let i = 0; i < 26; i++) {
    const y = cy - h / 2 + 20 + rand() * (h - 40), x = cx - w / 2 + 20 + rand() * (w - 80);
    g.moveTo(x, y).lineTo(x + 20 + rand() * 40, y + (rand() - 0.5) * 2);
  }
  g.stroke({ width: 1, color: C.creamDark, alpha: 0.35 });
  stitch(g, cx - w / 2 + 12, cy - h / 2 + 12, w - 24, h - 24, 16, C.creamDark, 0.9, 2);
  parent.addChild(g);
  tape(parent, cx - w / 2 + 26, cy - h / 2 + 6, 70, -0.6);
  tape(parent, cx + w / 2 - 26, cy - h / 2 + 6, 70, 0.6);
  return g;
}

// pop-in group for overlay content
function popGroup(cx        , cy        ) {
  const c = new PIXI.Container();
  c.pivot.set(cx, cy); c.position.set(cx, cy);
  overlay.addChild(c);
  c.scale.set(0.8); c.alpha = 0;
  tween(0.32, k => { c.scale.set(0.8 + 0.2 * easeOutBack(k)); c.alpha = Math.min(1, k * 2.5); });
  return c;
}

// ---------- HUD ----------
let hudStars                = [];
let toast                        = null;
let toastLife = 0;
let overlayOpen = false;
let progFill                       = null;
let progText                   = null;
let progShown = 0;
let progW = 0;
let snackIcons                                                                 = [];
let stuckCard                        = null;
let restartBtn                        = null;
const HUD_M = 16;

function buildHud() {
  hud.removeChildren().forEach(c => c.destroy({ children: true }));
  if (toast && !toast.destroyed) toast.destroy({ children: true });
  hudStars = []; toast = null; progFill = null; progText = null; snackIcons = []; stuckCard = null; restartBtn = null;
  if (screen !== 'game') return;
  const m = HUD_M, bs = 58;
  const pause = makeButton(bs, bs, { icon: iconGear }, () => openPause());
  pause.position.set(m + bs / 2, m + bs / 2);
  const rs = makeButton(bs, bs, { icon: iconRestart }, () => restart());
  rs.position.set(SW - m - bs / 2, m + bs / 2);
  restartBtn = rs;
  hud.addChild(pause, rs);
  const ribW = Math.max(120, Math.min(230, SW - 2 * (m + bs) - 70));
  ribbon(hud, t('level', { n: levelIdx + 1 }), SW / 2, m + bs / 2 - 2, ribW, C.red, 24);
  // fill progress strip + snack tracker
  const nS = snacks.length;
  const iconS = 30;
  const rowW = Math.min(SW - 2 * m - 20, 300);
  progW = rowW - (nS ? nS * (iconS + 6) + 8 : 0);
  const rowX = SW / 2 - rowW / 2, rowY = m + bs + 30;
  const pg = new PIXI.Graphics();
  pg.roundRect(rowX + 2, rowY - 9 + 4, progW, 18, 9).fill({ color: 0x4a3a18, alpha: 0.2 });
  pg.roundRect(rowX, rowY - 9, progW, 18, 9).fill(C.cardDark);
  pg.roundRect(rowX + 2, rowY - 7, progW - 4, 14, 7).fill(C.card);
  hud.addChild(pg);
  progFill = new PIXI.Graphics(); progFill.position.set(rowX + 2, rowY - 7); hud.addChild(progFill);
  progText = txt('', 13, 0xffffff, '900', { color: C.ink, width: 3.5 }); progText.position.set(rowX + progW / 2, rowY); hud.addChild(progText);
  progShown = path.length / Math.max(1, totalFloor);
  snacks.forEach((s, i) => {
    const c = new PIXI.Container();
    const bg = new PIXI.Graphics(); bg.circle(0, 0, iconS / 2).fill(C.cream).stroke({ width: 2, color: C.creamDark });
    const spr = new PIXI.Sprite(s.spriteTex); spr.anchor.set(0.5); spr.scale.set(iconS * 0.78 / Math.max(spr.texture.width, spr.texture.height));
    const mark = new PIXI.Graphics();
    c.addChild(bg, spr, mark);
    c.position.set(rowX + progW + 8 + iconS / 2 + i * (iconS + 6), rowY);
    hud.addChild(c);
    snackIcons.push({ c, mark, spr });
  });
  updateHudStars();
}

function drawProgress(dt        ) {
  if (!progFill || !progText) return;
  const target = path.length / Math.max(1, totalFloor);
  progShown += (target - progShown) * Math.min(1, dt * 10);
  if (Math.abs(target - progShown) < 0.002) progShown = target;
  const w = Math.max(14, (progW - 4) * progShown);
  progFill.clear();
  progFill.roundRect(0, 0, w, 14, 7).fill(C.yellow);
  progFill.roundRect(2, 2, Math.max(0, w - 4), 4, 2).fill({ color: 0xffffff, alpha: 0.45 });
  for (let x = 10; x < w - 4; x += 12) progFill.moveTo(x, 3).lineTo(x - 4, 11);
  progFill.stroke({ width: 1.5, color: C.yellowDark, alpha: 0.5 });
  progText.text = Math.round(target * 100) + '%';
}

function updateHudStars() {
  snacks.forEach((s, i) => {
    const ic = snackIcons[i]; if (!ic) return;
    ic.mark.clear();
    if (s.state === 'eaten') {
      ic.spr.alpha = 0.45;
      ic.mark.circle(8, 8, 8).fill(C.green);
      ic.mark.moveTo(4, 8).lineTo(7, 11).lineTo(12, 5).stroke({ width: 2.5, color: 0xffffff, cap: 'round', join: 'round' });
    } else if (s.state === 'spoiled') {
      ic.spr.alpha = 0.25; ic.spr.tint = 0x888888;
      ic.mark.moveTo(-8, -8).lineTo(8, 8).moveTo(8, -8).lineTo(-8, 8).stroke({ width: 3.5, color: C.red, cap: 'round' });
    } else { ic.spr.alpha = 1; ic.spr.tint = 0xffffff; }
  });
}

function showToast(msg        , dur        , top = false) {
  if (toast) { toast.destroy({ children: true }); toast = null; }
  const c = new PIXI.Container();
  const tx = txt(msg, 19, C.ink, '700');
  const maxW = Math.min(SW - 48, 420);
  fitText(tx, maxW - 36);
  const w = Math.min(maxW, tx.width * tx.scale.x + 44), h = 52;
  const g = new PIXI.Graphics();
  g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 10).fill({ color: 0x4a3a18, alpha: 0.2 });
  g.roundRect(-w / 2, -h / 2, w, h, 10).fill(0xfffbe9);
  stitch(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 4, C.creamDark, 0.9, 1.5);
  c.addChild(g, tx);
  tape(c, 0, -h / 2, 54, (Math.random() - 0.5) * 0.2);
  c.rotation = (Math.random() - 0.5) * 0.04;
  c.position.set(SW / 2, top ? 56 : SH - 70);
  (top ? toastLayer : hud).addChild(c);
  toast = c; toastLife = dur;
}

function showStuck() {
  if (stuckCard || screen !== 'game') return;
  if (toast) { toast.destroy({ children: true }); toast = null; }
  const c = new PIXI.Container();
  const w = Math.min(SW - 40, 360), h = 132;
  const g = new PIXI.Graphics();
  g.roundRect(-w / 2 + 3, -h / 2 + 6, w, h, 18).fill({ color: 0x4a3a18, alpha: 0.22 });
  g.roundRect(-w / 2, -h / 2, w, h, 18).fill(0xfffbe9);
  stitch(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 12, C.creamDark, 0.9, 1.6);
  c.addChild(g);
  tape(c, -w / 2 + 30, -h / 2 + 2, 56, -0.5);
  tape(c, w / 2 - 30, -h / 2 + 2, 56, 0.5);
  const tx = txt(t('stuck'), 21, C.ink, '800'); fitText(tx, w - 40); tx.position.set(0, -h / 2 + 32); c.addChild(tx);
  const b = makeButton(Math.min(240, w - 60), 58, { label: t('retry'), icon: iconRestart, fill: C.yellow, fontSize: 24 }, () => restart());
  b.position.set(0, 18);
  c.addChild(b);
  c.position.set(SW / 2, SH + h);
  hud.addChild(c);
  stuckCard = c;
  const y1 = SH - h / 2 - 22;
  tween(0.4, k => { c.y = SH + h + (y1 - SH - h) * easeOutBack(k); }, undefined, 0.35);
}
function hideStuck() { if (stuckCard) { stuckCard.destroy({ children: true }); stuckCard = null; } }

// ---------- screen confetti ----------
;                                                                                                                        
let confetti         = [];
const confLayer = new PIXI.Container();
root.addChild(confLayer);
function confettiBurst(n        ) {
  const cols = [C.red, 0x3f8fd6, C.yellow, 0xffffff, C.green, 0xf08a3c, 0xb267d6];
  for (let i = 0; i < n; i++) {
    const g = new PIXI.Graphics();
    const w = 8 + Math.random() * 8, h = 5 + Math.random() * 6;
    g.rect(-w / 2, -h / 2, w, h).fill(cols[i % cols.length]);
    confLayer.addChild(g);
    confetti.push({ g, x: Math.random() * SW, y: -20 - Math.random() * SH * 0.4, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120, vr: (Math.random() - 0.5) * 8, life: 3 + Math.random() * 2, flip: Math.random() * 6 });
  }
}
function stepConfetti(dt        ) {
  confetti = confetti.filter(p => {
    p.life -= dt;
    if (p.life <= 0 || p.y > SH + 30) { p.g.destroy(); return false; }
    p.flip += dt * 7;
    p.x += (p.vx + Math.sin(p.flip) * 40) * dt; p.y += p.vy * dt;
    p.g.position.set(p.x, p.y); p.g.rotation += p.vr * dt; p.g.scale.y = Math.cos(p.flip);
    p.g.alpha = Math.min(1, p.life);
    return true;
  });
}

// ---------- overlays ----------
function clearOverlay() {
  overlay.removeChildren().forEach(c => c.destroy({ children: true }));
  overlayOpen = false;
  titleHead = null; titleLetters = []; titleRays = null;
}
function dim(alpha = 0.45) {
  const g = new PIXI.Graphics();
  g.rect(0, 0, SW, SH).fill({ color: 0x2a2010, alpha });
  g.eventMode = 'static';
  overlay.addChild(g);
  return g;
}
function totalStars() { return save.stars.reduce((a, b) => a + (b || 0), 0); }
function starCount(parent                , x        , y        , size = 22) {
  const s = new PIXI.Sprite(TX.star); s.anchor.set(0.5); s.scale.set(size * 1.3 / TX.star.height);
  const tx = txt(totalStars() + ' / ' + LEVELS.length * 3, size, C.ink, '800');
  const total = size * 1.3 + 8 + tx.width;
  s.position.set(x - total / 2 + size * 0.65, y); tx.position.set(x - total / 2 + size * 1.3 + 8 + tx.width / 2, y);
  parent.addChild(s, tx);
}

let titleHead                     = null;
let titleLetters                   = [];
let titleRays                       = null;
let titleFaceTime = 0;
let titleHeadH = 200;
function showTitle() {
  screen = 'title';
  clearOverlay(); buildHud();
  showDemoBoard();
  dim(0.22);
  const cx = SW / 2;
  const compact = SH < 640;
  // logo letters: each a cut-paper letter in its own colour; multi-word titles stack one word per line
  const words = displayTitle().split(' ');
  const cols = [C.red, 0xf08a3c, 0x3f8fd6, C.red, C.green, 0x3f8fd6];
  const maxLen = Math.max(...words.map(w => Array.from(w).length));
  const latin = /^[\x00-\x7f]+$/.test(displayTitle());
  const adv = latin ? 0.64 : 1.02; // per-glyph advance in em
  const ls = Math.min(latin ? 58 : 64, (SW - 40) / (maxLen * adv));
  // first logo line sits below the language row at the top
  const logoY0 = Math.max(HUD_M + 48 + 14 + ls * 0.5, SH * (compact ? 0.12 : 0.15) - (words.length - 1) * ls * 0.45);
  let gi = 0;
  words.forEach((word, wi) => {
    const chars = Array.from(word);
    const lineY = logoY0 + wi * ls * 0.95;
    chars.forEach((ch, i) => {
      const c = new PIXI.Container();
      const col = cols[gi % cols.length];
      const sh = txt(ch, ls, 0x3a2a10, '900', { color: 0x3a2a10, width: 12 }); sh.alpha = 0.3; sh.position.set(3, 6);
      const back = txt(ch, ls, 0xffffff, '900', { color: 0xfff8e6, width: 14 });
      const f = txt(ch, ls, col, '900', { color: darken(col, 0.6), width: 3 });
      c.addChild(sh, back, f);
      c.position.set(cx + (i - (chars.length - 1) / 2) * ls * adv, lineY);
      c.rotation = (gi % 2 ? 1 : -1) * 0.07;
      overlay.addChild(c);
      titleLetters.push(c);
      gi++;
    });
  });
  const logoY = logoY0 + (words.length - 1) * ls * 0.95;
  const hh = Math.min(SH * (compact ? 0.22 : 0.28), 270, SW * 0.6);
  titleHeadH = hh;
  const headY = logoY + ls * 0.7 + 20 + hh * 0.9;
  const rays = new PIXI.Graphics();
  for (let i = 0; i < 14; i++) { const a0 = i / 14 * Math.PI * 2, a1 = a0 + Math.PI / 14; const R = hh * 1.3; rays.poly([0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R]); }
  rays.fill({ color: 0xfff6d0, alpha: 0.35 });
  rays.position.set(cx, headY - hh * 0.45);
  overlay.addChild(rays); titleRays = rays;
  const head = new PIXI.Sprite(TX.head); head.anchor.set(0.5, 0.9);
  head.scale.set(hh / TX.head.height); head.position.set(cx, headY);
  head.eventMode = 'static'; head.cursor = 'pointer';
  head.on('pointertap', () => { head.texture = pickFace(PAIN_TEX, recentPain); const fm = faceMeta(head.texture); head.anchor.set(0.5, fm.ay); head.scale.set(hh / fm.h); titleFaceTime = 0.8; sfx('move.bump'); });
  overlay.addChild(head); titleHead = head;
  // tagline on a taped paper strip
  const tag = txt(t('tagline'), compact ? 22 : 26, C.ink, '800'); fitText(tag, SW - 80);
  const tagY = headY + 40;
  const tw = Math.min(SW - 30, tag.width * tag.scale.x + 56);
  const strip = new PIXI.Container();
  const sg = new PIXI.Graphics();
  sg.rect(-tw / 2 + 3, -24 + 5, tw, 48).fill({ color: 0x4a3a18, alpha: 0.18 });
  sg.rect(-tw / 2, -24, tw, 48).fill(0xfffbe9);
  stitch(sg, -tw / 2 + 6, -18, tw - 12, 36, 0, C.creamDark, 0.9, 1.5);
  strip.addChild(sg, tag);
  tape(strip, -tw / 2 + 8, -18, 44, -0.7); tape(strip, tw / 2 - 8, -18, 44, 0.7);
  strip.position.set(cx, tagY); strip.rotation = -0.025;
  overlay.addChild(strip);
  const bw = Math.min(270, SW - 80);
  const play = makeButton(bw, 76, { label: t('play'), icon: iconPlay, fill: C.yellow, fontSize: 32 }, () => {
    loadLevel(Math.min(save.unlocked - 1, LEVELS.length - 1));
  });
  play.position.set(cx, Math.min(SH - 150, tagY + 90));
  const shopOn = payOn();
  const lvW = shopOn ? (bw - 12) / 2 : bw * 0.82;
  const lv = makeButton(lvW, 58, { label: t('levels'), icon: iconGrid, fontSize: shopOn ? 19 : 22 }, () => { screenBeforeLevels = 'title'; showLevels(); });
  lv.position.set(shopOn ? cx - lvW / 2 - 6 : cx, play.y + 82);
  overlay.addChild(play, lv);
  if (shopOn) {
    const sb = makeButton(lvW, 58, { label: t('shop'), iconTex: TX.coin, fill: SHOP_FILL, fontSize: 19 }, () => openShop('title'));
    sb.position.set(cx + lvW / 2 + 6, play.y + 82);
    overlay.addChild(sb);
  }
  if (lv.y + 70 < SH - 10) starCount(overlay, cx, Math.min(SH - 28, lv.y + 66), 20);
  addLangButton();
  overlayOpen = true;
}

function addLangButton() {
  // every language one tap away, each in its own name; the active one is yellow
  const gap = 8, h = 48;
  const w = Math.min(104, (SW - HUD_M * 2 - gap * (LANG_ORDER.length - 1)) / LANG_ORDER.length);
  const total = w * LANG_ORDER.length + gap * (LANG_ORDER.length - 1);
  LANG_ORDER.forEach((l, i) => {
    const active = l === getLang();
    const b = makeButton(w, h, { label: LANG_NAMES[l], fill: active ? C.yellow : 0xfffbe9, fontSize: 17, depth: 5 }, () => {
      if (l === getLang()) return;
      setLang(l); save.lang = l; persist();
      relayout();
    });
    if (!active) b.alpha = 0.9;
    b.position.set(SW / 2 - total / 2 + w / 2 + i * (w + gap), HUD_M + h / 2);
    overlay.addChild(b);
  });
}

function showDemoBoard() {
  // title background: the current level's board, dimmed
  if (!GW) {
    const L = LEVELS[Math.min(save.unlocked - 1, LEVELS.length - 1)];
    levelIdx = Math.min(save.unlocked - 1, LEVELS.length - 1);
    setupGrid(L);
    resetRun();
  }
  layoutBoard();
}

// ---------- shop: 1 platform coin = one level cleared with 3 stars ----------
const PASS_PRICE = 1;
let shopMode = false;
let shopReturn                     = 'title';
let buying = false;
let pendingAt = -1e9;
function payOn() { return !!window.gp?.pay?.available; }
function passItemId(i        ) { return 'pass3-lv' + (i + 1); }
function canPass(i        ) { return i >= 0 && i < LEVELS.length && i < save.unlocked && (save.stars[i] || 0) < 3; }
function grantPass(i        ) {
  if (!canPass(i)) return false;
  save.stars[i] = 3;
  if (!save.bought.includes(i)) save.bought.push(i);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
  return true;
}
// Deliver one paid purchase exactly once. Returns the level it cleared, -1 = kept as a spare pass, -2 = already delivered.
function deliverPurchase(purchaseId        , itemId        )         {
  const ack = () => { try { void window.gp.pay.ack(purchaseId); } catch (e) { /* host re-lists it in pending() */ } };
  if (save.paid.includes(purchaseId)) { ack(); return -2; }
  const m = /^pass3-lv(\d+)$/.exec(itemId);
  const i = m ? +m[1] - 1 : -1;
  const applied = grantPass(i);
  if (!applied) save.tickets++; // level already 3-star / not reachable on this save: the coin is not lost
  save.paid.push(purchaseId);
  if (save.paid.length > 60) save.paid.splice(0, save.paid.length - 60);
  persist();
  ack();
  return applied ? i : -1;
}
function refreshAfterGrant() {
  if (screen === 'levels') showLevels(levelPage, shopMode);
  else if (screen === 'title') showTitle();
}
function announcePass(lv        ) {
  refreshAfterGrant();
  sfx('level.win');
  coinPop();
  showToast(lv >= 0 ? t('passDone', { n: lv + 1 }) : t('ticketBanked'), 3, true);
}
async function buyPass(i        ) {
  if (buying || !canPass(i)) return;
  if (save.tickets > 0) { // a pass that was paid earlier but could not be applied
    save.tickets--; grantPass(i); persist();
    announcePass(i);
    return;
  }
  if (!payOn()) return;
  buying = true;
  let r                    ;
  try {
    r = await window.gp.pay.purchase({ itemId: passItemId(i), title: t('passTitle', { n: i + 1 }), desc: t('passDialogDesc'), price: PASS_PRICE });
  } catch (e) { buying = false; showToast(t('payFail'), 3, true); return; }
  buying = false;
  if (r.ok) {
    const got = deliverPurchase(r.purchaseId, passItemId(i));
    if (got === -2) refreshAfterGrant(); else announcePass(got);
    return;
  }
  // declined / insufficient / need_login: the platform dialog already told the player. busy: a purchase is still open.
  if (r.error === 'pending') showToast(t('payPending'), 3.5, true); // NOT delivered here; checkPending() delivers it once confirmed
  else if (r.error === 'self_purchase') showToast(t('paySelf'), 3.5, true);
  else if (r.error !== 'declined' && r.error !== 'insufficient' && r.error !== 'need_login' && r.error !== 'busy') showToast(t('payFail'), 3, true);
}
// Paid-but-undelivered purchases (closed tab, flaky network): deliver on startup and whenever the shop opens.
function checkPending() {
  if (!payOn() || time - pendingAt < 30) return;
  pendingAt = time;
  try {
    void window.gp.pay.pending().then(r => {
      if (!r.ok) return; // query failed: try again next time, never treat as empty
      let n = 0, lastLv = -1;
      for (const it of r.items) { const g = deliverPurchase(it.purchaseId, it.itemId); if (g !== -2) { n++; if (g >= 0) lastLv = g; } }
      if (n) announcePass(lastLv);
    }).catch(() => { /* ignore */ });
  } catch (e) { /* ignore */ }
}
function openShop(from                    , page         ) {
  shopReturn = from;
  checkPending();
  showLevels(page, true);
}

function showLevels(page         , shop = false) {
  shopMode = shop;
  screen = 'levels';
  clearOverlay(); buildHud();
  dim(0.38);
  overlayOpen = true;
  const PER = 25, pages = Math.ceil(LEVELS.length / PER);
  const current = Math.min(save.unlocked - 1, LEVELS.length - 1);
  if (page === undefined) page = Math.floor(current / PER);
  page = Math.max(0, Math.min(pages - 1, page));
  levelPage = page;
  const first = page * PER, last = Math.min(LEVELS.length, first + PER);
  const cols = 5, rows = Math.ceil(PER / cols);
  const pw = Math.min(SW - 28, 470);
  const gap = 10;
  // shop header = product card + hint line; short screens drop the description to keep tiles tappable
  const compactShop = shop && SH < 700;
  const cardH = compactShop ? 52 : 78;
  const headH = shop ? cardH + 106 : 96; // panel top -> first tile row
  const tileS = Math.floor(Math.min((pw - 48) / cols - gap, (SH - headH - 202) / rows - gap, 76));
  const ph = rows * (tileS + gap) + headH + 102;
  const cy = SH / 2 + 10;
  const top = cy - ph / 2;
  const grp = popGroup(SW / 2, cy);
  panel(grp, pw, ph, SW / 2, cy);
  ribbon(grp, shop ? t('shop') : t('levels'), SW / 2, top + 4, Math.min(240, pw - 120), shop ? 0xe0862e : C.red, 26);
  if (shop) {
    const free = save.tickets > 0;
    // product card: [3-star badge] name + what it does ............ [price]
    const cw = pw - 44;
    const card = new PIXI.Container(); card.position.set(SW / 2, top + 70 + cardH / 2);
    const cg = new PIXI.Graphics();
    cg.roundRect(-cw / 2 + 2, -cardH / 2 + 4, cw, cardH, 14).fill({ color: 0x4a3a18, alpha: 0.16 });
    cg.roundRect(-cw / 2, -cardH / 2, cw, cardH, 14).fill(0xfff3cf);
    stitch(cg, -cw / 2 + 5, -cardH / 2 + 5, cw - 10, cardH - 10, 10, C.cardDark, 0.5, 1.6);
    card.addChild(cg);
    const r = Math.min(24, cardH * 0.36);
    const badge = new PIXI.Container(); badge.position.set(-cw / 2 + 14 + r, 0);
    const bs = new PIXI.Sprite(TX.star); bs.anchor.set(0.5); bs.scale.set(r * 2.1 / TX.star.height); bs.rotation = -0.12;
    const b3 = txt('3', r * 0.95, 0x8a4b00, '900'); b3.y = r * 0.08;
    badge.addChild(bs, b3);
    card.addChild(badge);
    const pillW = 68, pillH = 36;
    const pill = new PIXI.Container(); pill.position.set(cw / 2 - 14 - pillW / 2, 0);
    const pg0 = new PIXI.Graphics();
    pg0.roundRect(-pillW / 2 + 1, -pillH / 2 + 3, pillW, pillH, pillH / 2).fill({ color: 0x4a3a18, alpha: 0.2 });
    pg0.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(free ? C.green : 0xffffff).stroke({ width: 2, color: free ? darken(C.green, 0.6) : 0xb17818 });
    const pcoin = coinSprite(28); pcoin.position.set(-pillW / 2 + 19, 0);
    const pnum = txt(free ? '0' : String(PASS_PRICE), 22, free ? 0xffffff : 0x5a3806, '900'); pnum.position.set(pillW / 2 - 21, 0);
    pill.addChild(pg0, pcoin, pnum);
    card.addChild(pill);
    const tx0 = -cw / 2 + 14 + r * 2 + 12, tw = cw / 2 - 14 - pillW - 10 - tx0;
    const name = txt(t('passName'), 18, C.ink, '900'); name.anchor.set(0, 0.5); fitText(name, tw);
    name.position.set(tx0, compactShop ? 0 : -19);
    card.addChild(name);
    if (!compactShop) {
      const desc = new PIXI.Text({ text: t('passDesc'), style: { fontFamily: FONT, fontSize: 12.5, fontWeight: '700', fill: 0x8a7550, wordWrap: true, wordWrapWidth: tw, breakWords: true, lineHeight: 16 } });
      desc.position.set(tx0, -6);
      if (desc.height > 36) desc.scale.set(36 / desc.height);
      card.addChild(desc);
    }
    grp.addChild(card);
    // one line telling the player what tapping a tile does right now
    let anyLeft = false; for (let i = 0; i < LEVELS.length; i++) if (canPass(i)) { anyLeft = true; break; }
    const hint = txt(!anyLeft ? t('shopEmpty') : free ? t('ticketsHave', { n: save.tickets }) : t('shopPick'), 14, free && anyLeft ? darken(C.green, 0.75) : 0x8a7550, '800'); fitText(hint, pw - 56);
    hint.position.set(SW / 2, top + 70 + cardH + 19);
    grp.addChild(hint);
  } else starCount(grp, SW / 2, top + 64, 18);
  const gridW = cols * (tileS + gap) - gap;
  const gx = SW / 2 - gridW / 2 + tileS / 2, gy = top + headH + tileS / 2;
  srand(99 + page);
  for (let i = first; i < last; i++) {
    const col = (i - first) % cols, row = Math.floor((i - first) / cols);
    const locked = i >= save.unlocked;
    const st = save.stars[i] || 0;
    const fill = locked ? 0xcdb48a : st >= 3 ? C.yellow : st > 0 ? 0xfde9a0 : 0xfffbe9;
    const b = makeButton(tileS, tileS, { label: locked ? '' : String(i + 1), fill, fontSize: tileS * 0.36, depth: 5, radius: 12 }, () => { if (shop) void buyPass(i); else if (!locked) loadLevel(i); });
    const face = (b       ).face                  ;
    if (locked) {
      const lg = new PIXI.Graphics();
      const s = tileS * 0.15;
      lg.roundRect(-s, -s * 0.2, s * 2, s * 1.6, 3).fill(0x8a7550);
      lg.arc(0, -s * 0.2, s * 0.62, Math.PI, 0).stroke({ width: s * 0.3, color: 0x8a7550 });
      face.addChild(lg);
      b.eventMode = 'none';
    } else {
      const buyable = shop && st < 3;
      const label = face.children[1]             ;
      if (label) label.y = -tileS * 0.1;
      // every tile shows its stars (the price lives once in the product card above)
      for (let k = 0; k < 3; k++) {
        const ss = new PIXI.Sprite(TX.star); ss.anchor.set(0.5);
        ss.scale.set(tileS * 0.22 / TX.star.height);
        ss.position.set((k - 1) * tileS * 0.23, tileS * 0.27 - (k === 1 ? 3 : 0));
        if (k >= st) { ss.tint = 0x777777; ss.alpha = 0.35; }
        face.addChild(ss);
      }
      // already 3-star tiles can't be bought: dimmed and inert
      if (shop && !buyable) { b.alpha = 0.55; b.eventMode = 'none'; }
      if (!shop && i === current && st === 0) {
        const mh = new PIXI.Sprite(TX.head); mh.anchor.set(0.5, 1);
        mh.scale.set(tileS * 0.55 / TX.head.height); mh.position.set(tileS * 0.36, -tileS * 0.22); mh.rotation = 0.25;
        b.addChild(mh);
        currentLevelBtn = b;
      }
    }
    b.rotation = (rand() - 0.5) * 0.08;
    b.position.set(gx + col * (tileS + gap), gy + row * (tileS + gap));
    grp.addChild(b);
  }
  // page switcher
  const pageY = gy + rows * (tileS + gap) - tileS / 2 + 22;
  const pg = txt(`${page + 1} / ${pages}`, 20, C.ink, '900'); pg.position.set(SW / 2, pageY); grp.addChild(pg);
  const pgBtn = (dir        ) => {
    const enabled = dir < 0 ? page  > 0 : page  < pages - 1;
    const b = makeButton(64, 48, { icon: (g, s, col) => { g.poly(dir > 0 ? [-s * 0.1, -s * 0.18, s * 0.16, 0, -s * 0.1, s * 0.18] : [s * 0.1, -s * 0.18, -s * 0.16, 0, s * 0.1, s * 0.18]).fill(col); }, label: '', fill: enabled ? C.yellow : 0xcdb48a, depth: 5 }, () => { if (enabled) showLevels(page  + dir, shop); });
    if (!enabled) { b.alpha = 0.5; b.eventMode = 'none'; }
    b.position.set(SW / 2 + dir * Math.min(110, gridW / 2 - 32), pageY);
    grp.addChild(b);
  };
  pgBtn(-1); pgBtn(1);
  if (shop) {
    const back = makeButton(150, 54, { icon: shopReturn === 'title' ? iconHome : iconBack, label: '', fontSize: 22 }, () => { if (shopReturn === 'title') showTitle(); else showLevels(levelPage, false); });
    back.position.set(SW / 2, cy + ph / 2 - 4);
    grp.addChild(back);
    return;
  }
  const shopOn = payOn();
  const backW = shopOn ? 132 : 150;
  const back = makeButton(backW, 54, { icon: screenBeforeLevels === 'game' ? iconBack : iconHome, label: '', fontSize: 22 }, () => { if (screenBeforeLevels === 'game') { clearOverlay(); screen = 'game'; buildHud(); } else showTitle(); });
  back.position.set(shopOn ? SW / 2 - backW / 2 - 6 : SW / 2, cy + ph / 2 - 4);
  grp.addChild(back);
  if (shopOn) {
    const sb = makeButton(backW, 54, { label: t('shop'), iconTex: TX.coin, fill: SHOP_FILL, fontSize: 19 }, () => openShop('levels', levelPage));
    sb.position.set(SW / 2 + backW / 2 + 6, cy + ph / 2 - 4);
    grp.addChild(sb);
  }
}
let screenBeforeLevels         = 'title';
let levelPage = -1;
let currentLevelBtn                        = null;

function openPause() {
  if (won) return;
  paused = true; overlayOpen = true;
  drawPause(true);
}
function drawPause(animate = false) {
  overlay.removeChildren().forEach(c => c.destroy({ children: true }));
  dim(0.45);
  // settings panel: resume / retry + home / levels (+ shop) / music + sound / language
  const pw = Math.min(SW - 40, 360), ph = 456;
  const cy = SH / 2 + 10;
  const grp = animate ? popGroup(SW / 2, cy) : overlay;
  panel(grp, pw, ph, SW / 2, cy);
  ribbon(grp, displayTitle(), SW / 2, cy - ph / 2 + 4, Math.min(250, pw - 110), C.red, 26);
  const sub = txt(t('settings'), 18, 0x8a7550, '800'); sub.position.set(SW / 2, cy - ph / 2 + 64); grp.addChild(sub);
  const bw = pw - 64;
  const half = (bw - 12) / 2;
  const xl = SW / 2 - half / 2 - 6, xr = SW / 2 + half / 2 + 6;
  const top = cy - ph / 2 + 116;
  const resume = makeButton(bw, 62, { label: t('resume'), icon: iconPlay, fill: C.yellow, fontSize: 24 }, () => { paused = false; clearOverlay(); });
  resume.position.set(SW / 2, top);
  const again = makeButton(half, 54, { label: t('retry'), icon: iconRestart, fontSize: 19 }, () => { paused = false; clearOverlay(); restart(); });
  again.position.set(xl, top + 74);
  // back to the title screen (the unfinished attempt is dropped, cleared levels and stars are already saved)
  const home = makeButton(half, 54, { label: t('home'), icon: iconHome, fontSize: 19 }, () => { paused = false; resetRun(); showTitle(); });
  home.position.set(xr, top + 74);
  const shopOn = payOn();
  const lv = makeButton(shopOn ? half : bw, 54, { label: t('menu'), icon: iconGrid, fontSize: shopOn ? 19 : 21 }, () => { paused = false; screenBeforeLevels = 'game'; showLevels(); });
  lv.position.set(shopOn ? xl : SW / 2, top + 142);
  grp.addChild(resume, again, home, lv);
  if (shopOn) {
    // straight to the shop page that holds the level being played
    const sb = makeButton(half, 54, { label: t('shop'), iconTex: TX.coin, fill: SHOP_FILL, fontSize: 19 }, () => { paused = false; screenBeforeLevels = 'game'; openShop('levels', Math.floor(levelIdx / 25)); });
    sb.position.set(xr, top + 142);
    grp.addChild(sb);
  }
  // music / sound switches (greyed = off)
  const mus = makeButton(half, 54, { label: t('music'), icon: iconMusic(save.music), fill: save.music ? 0xfffbe9 : 0xd8ceb4, fontSize: 18 }, () => { save.music = !save.music; applyVolumes(); persist(); drawPause(); });
  mus.position.set(xl, top + 210);
  const snd = makeButton(half, 54, { label: t('sound'), icon: iconSpeaker(save.sfx), fill: save.sfx ? 0xfffbe9 : 0xd8ceb4, fontSize: 18 }, () => { save.sfx = !save.sfx; applyVolumes(); persist(); drawPause(); });
  snd.position.set(xr, top + 210);
  grp.addChild(mus, snd);
  // language: every language is one tap away, shown in its own name; the active one is yellow
  const lw = (bw - 16) / LANG_ORDER.length;
  LANG_ORDER.forEach((l, i) => {
    const active = l === getLang();
    const b = makeButton(lw, 48, { label: LANG_NAMES[l], fill: active ? C.yellow : 0xfffbe9, fontSize: 16, depth: 5 }, () => {
      if (l === getLang()) return;
      setLang(l); save.lang = l; persist(); buildHud(); drawPause();
    });
    b.position.set(SW / 2 - bw / 2 + lw / 2 + i * (lw + 8), top + 278);
    grp.addChild(b);
  });
}

function showWinPanel(st                                                      , animate = true) {
  if (screen !== 'game') return;
  clearOverlay();
  hideStuck();
  overlayOpen = true;
  dim(0.4);
  const pw = Math.min(SW - 40, 380), ph = 360;
  const cy = SH / 2 + 50;
  const grp = animate ? popGroup(SW / 2, cy) : overlay;
  const head = new PIXI.Sprite(winTex); const wm = faceMeta(winTex); head.anchor.set(0.5, wm.ay); head.scale.set(150 / wm.h);
  head.position.set(SW / 2, cy - ph / 2 + 14);
  grp.addChild(head);
  panel(grp, pw, ph, SW / 2, cy);
  const last = levelIdx === LEVELS.length - 1;
  ribbon(grp, last ? t('allDone') : t('clear'), SW / 2, cy - ph / 2 + 10, Math.min(260, pw - 100), C.red, last ? 20 : 30);
  const got = [st.clear, st.snack, st.perfect];
  const labels = [t('starClear'), t('starSnack'), t('starPerfect')];
  for (let i = 0; i < 3; i++) {
    const s = new PIXI.Sprite(TX.star); s.anchor.set(0.5);
    const base = (i === 1 ? 74 : 60) / TX.star.height;
    s.position.set(SW / 2 + (i - 1) * (pw / 3.3), cy - 38 - (i === 1 ? 10 : 0));
    s.rotation = (i - 1) * 0.18;
    if (!got[i]) { s.tint = 0x777777; s.alpha = 0.4; }
    grp.addChild(s);
    if (animate) { s.scale.set(0); tween(0.4, k => s.scale.set(base * easeOutBack(k)), () => { if (got[i]) sfx('snack.eat', 4 + i * 2); }, 0.25 + i * 0.22); }
    else s.scale.set(base);
    const l = txt(labels[i], 14, got[i] ? C.ink : 0x9a8c6c, '700'); fitText(l, pw / 3.3 - 6);
    l.position.set(s.x, cy + 18); grp.addChild(l);
  }
  const bw = (pw - 76) / 2;
  const retry = makeButton(bw, 62, { label: t('retry'), icon: iconRestart, fontSize: 22 }, () => loadLevel(levelIdx));
  retry.position.set(SW / 2 - bw / 2 - 8, cy + ph / 2 - 76);
  const next = makeButton(bw, 62, { label: last ? t('menu') : t('next'), icon: last ? iconGrid : iconPlay, fill: C.yellow, fontSize: 22 }, () => { if (last) { screenBeforeLevels = 'title'; showLevels(); } else loadLevel(levelIdx + 1); });
  next.position.set(SW / 2 + bw / 2 + 8, cy + ph / 2 - 76);
  grp.addChild(retry, next);
}

// ---------- relayout ----------
function relayout() {
  SW = app.screen.width; SH = app.screen.height;
  groundSprite.width = SW; groundSprite.height = SH;
  if (!GW) return;
  layoutBoard();
  for (const s of snacks) { s.tagText.style.fontFamily = FONT; }
  if (screen === 'game') {
    buildHud();
    if (won && overlayOpen) showWinPanel(starsNow(), false);
    else if (paused) drawPause();
    else if (stuckShown && !won && !hasMoves()) showStuck();
  } else if (screen === 'title') showTitle();
  else if (screen === 'levels') showLevels(levelPage, shopMode);
}

// ---------- input ----------
let ptr                                                              = null;
app.canvas.addEventListener('pointerdown', (e              ) => {
  const r = app.canvas.getBoundingClientRect();
  ptr = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, fired: false };
});
window.addEventListener('pointermove', (e              ) => {
  if (!ptr || ptr.fired || e.pointerId !== ptr.id) return;
  const r = app.canvas.getBoundingClientRect();
  const dx = e.clientX - r.left - ptr.x, dy = e.clientY - r.top - ptr.y;
  if (Math.hypot(dx, dy) < 24) return;
  ptr.fired = true;
  if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 0 : 1); else tryMove(dy > 0 ? 2 : 3);
});
window.addEventListener('pointerup', (e              ) => {
  if (ptr && !ptr.fired && e.pointerId === ptr.id && (screen === 'game' || screen === 'title') && !overlayOpen) {
    const r = app.canvas.getBoundingClientRect();
    tapScenery(e.clientX - r.left, e.clientY - r.top);
  }
  ptr = null;
});
window.addEventListener('pointercancel', () => { ptr = null; });
window.addEventListener('keydown', (e               ) => {
  const k = e.key.toLowerCase();
  if (screen !== 'game') return;
  if (k === 'arrowright' || k === 'd') tryMove(0);
  else if (k === 'arrowleft' || k === 'a') tryMove(1);
  else if (k === 'arrowdown' || k === 's') tryMove(2);
  else if (k === 'arrowup' || k === 'w') tryMove(3);
  else if (k === 'r') restart();
  else if (k === 'escape' || k === 'p') { if (paused) { paused = false; clearOverlay(); } else openPause(); }
  else return;
  e.preventDefault();
});

// ---------- main loop ----------
let time = 0;
app.ticker.add((tk) => {
  const dt = Math.min(0.05, tk.deltaMS / 1000);
  time += dt;
  if (!paused) stepAnim(dt);
  for (const tw of tweens.slice()) {
    if (tw.delay > 0) { tw.delay -= dt; continue; }
    tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
    if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.done?.(); }
  }
  if (headSquash > 0) { bumpTime += dt; headSquash = Math.max(0, headSquash - dt * 3.2); }
  if (won) winTime += dt;
  if (painTime > 0) painTime = Math.max(0, painTime - dt);
  const wantTex = won ? winTex : (painTime > 0 && painTex ? painTex : TX.head);
  if (headSprite.texture !== wantTex) headSprite.texture = wantTex;
  drawProgress(dt);
  stepConfetti(dt);
  drawBody(time);
  stepParts(dt);
  stepScenery(dt);
  snacks.forEach((s, i) => { if (s.state === 'fresh') { const spr = s.sprite.children[0]               ; spr.y = Math.sin(time * 3 + i) * CS * 0.04; } });
  if (shake > 0) { shakeLayer.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake = Math.max(0, shake - dt * 40); } else shakeLayer.position.set(0, 0);
  if (toast) { toastLife -= dt; toast.alpha = Math.min(1, toastLife * 2); if (toastLife <= 0) { toast.destroy({ children: true }); toast = null; } }
  if (restartBtn && !restartBtn.destroyed) restartBtn.scale.set(stuckCard ? 1 + 0.07 * Math.max(0, Math.sin(time * 8)) : 1);
  if (titleHead && screen === 'title' && !titleHead.destroyed) {
    if (titleFaceTime > 0) { titleFaceTime -= dt; if (titleFaceTime <= 0) { titleHead.texture = TX.head; titleHead.anchor.set(0.5, 0.88); titleHead.scale.set(titleHeadH / TX.head.height); } }
    const base = titleHead.scale.x > 0 ? Math.abs(titleHead.scale.x) : 1;
    titleHead.rotation = Math.sin(time * 2.2) * 0.08 + (titleFaceTime > 0 ? Math.sin(time * 40) * 0.06 : 0);
    titleHead.scale.y = base * (1 + Math.sin(time * 5) * 0.03);
  }
  titleLetters.forEach((l, i) => { if (!l.destroyed) l.y = l.y + (Math.sin(time * 3 + i * 0.8) * 4 - ((l       ).bob ?? 0)); (l       ).bob = Math.sin(time * 3 + i * 0.8) * 4; });
  if (titleRays && !titleRays.destroyed) titleRays.rotation = time * 0.15;
  if (currentLevelBtn && !currentLevelBtn.destroyed && screen === 'levels') currentLevelBtn.scale.set(1 + 0.05 * Math.sin(time * 5)); else currentLevelBtn = null;
});
let movesCacheLen = -1, movesCacheVal = true;
function hasMovesCache() { if (movesCacheLen !== path.length) { movesCacheLen = path.length; movesCacheVal = hasMoves(); } return movesCacheVal; }

sceneReady = true;
relayout();
showTitle();
window.__gpPlayable = true;
loadFaceAtlases();
checkPending();

// debug hooks for automated testing
(window       ).__game = { tryMove, restart, loadLevel, state: () => ({ levelIdx, path: path.length, total: totalFloor, won, slides, screen }) };
