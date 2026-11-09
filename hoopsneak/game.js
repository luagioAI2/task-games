// Sneaky Hoops in Class — hold to charge, release to shoot. 10 notebook worlds × 5 levels.
import * as PIXI from 'pixi.js';
import { mountDisplay } from '@makeplay/display';
import { loadSoundSystem } from '@makeplay/sound';
                                                                  
import { LEVELS, WORLDS, NLEVELS, WORLD_ELEMENT } from './levels.js';
import { Sim, DT, BALL_R, RIM_HALF, MAG_R, PAINT_COLS, launchPoint } from './physics.js';
                                                                                    
import { THEMES, Boil, boilTick, jrect, jcircle, jpath, stroke, hatchRect, hatchCircle, drawPaper, coffeeStain, mulberry } from './doodle.js';
                                            
import { t, setLang, getLang, pickLang, LANGS, elName, elDesc } from './i18n.js';
                                      
import { keepBestStars, totalStars, syncStars, closeLeaderboard, leaderboardOpen } from './leaderboard.js';
import { createPixiFx } from '@makeplay/fx';
import { AB } from './base.js';

/**
 * 宿主入口。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，
 * 差别全部通过 `opts` 注入 —— 这里没有 `if (isPlugin)` 分支。
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container  挂载容器（宿主给的那一格）
 * @param {{getLatest:()=>Promise<any>, putLatest:(d:any)=>Promise<any>}} [opts.store] 存档适配层
 * @param {()=>Promise<boolean>} [opts.chargePlay] 开局收费；返回 false 表示余额不足、不要开
 * @returns {Promise<() => Promise<void>|void>} 卸载函数
 */
export async function start(opts = {}) {
const { container: mountContainer, store, chargePlay } = opts;

/** 注册 window 监听并记下卸载函数（原版是裸 addEventListener，卸载时全留在全局）。 */
const offs = [];
const winOn = (type, fn, o) => {
  window.addEventListener(type, fn, o);
  offs.push(() => window.removeEventListener(type, fn, o));
};
/** 插件在 `plugin.js` 里已经 await 过 host.storage.get；独立网页没有 store ⇒ 全新档。 */
let initialSave = null;

const C = 40, W = 1280, H = 720;
// 中文名（商城名同）：加载页与标题页都用它
const TITLE = '偷偷投篮';
let FONT = '"MpFontDisplay", "SmileySans", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif';

// ───────────────────────── save ─────────────────────────
                                                                                                     
function freshSave()       { return { v: 1, unlocked: 0, stars: new Array(NLEVELS).fill(0), sound: true, seen: [] }; }
let save       = freshSave();
function loadSave() {
  // 原版读的是 `gp.player.saves.latestSync`（MakePlay 平台），插件里没有 gp
  const s = initialSave;
  if (s && s.v === 1 && Array.isArray(s.stars)) {
    save = { ...freshSave(), ...s };
    while (save.stars.length < NLEVELS) save.stars.push(0);
    // players who cleared the old last level (1-50) get notebook 11 unlocked
    if (save.unlocked === 49 && save.stars[49] > 0) save.unlocked = 50;
    if (save.unlocked === 99 && save.stars[99] > 0) save.unlocked = 100; // old last level cleared → notebook 21 opens
  }
}
function persist() {
  // ★ 适配层的 putLatest 必须真的返回 Promise：调用处有 `.then()`
  try { void store?.putLatest?.(save); } catch { /* offline */ }
}

// ───────────────────────── sound ─────────────────────────
let sound                          = null;
let audioUnlocked = false;
let chargeVoice                = null;
async function initSound() {
  try {
    sound = (await loadSoundSystem({ manifestUrl: AB + 'sound.manifest.json' }))                    ;
    sound.settings.setMuted(!save.sound);
  } catch { sound = null; }
}
function onGesture() {
  if (audioUnlocked || !sound) return;
  audioUnlocked = true;
  sound.unlock().then(() => {
    if (sound && save.sound) void sound.setMusicState('main', { eventId: 'boot' });
  }).catch(() => { audioUnlocked = false; });
}
winOn('pointerdown', onGesture);
winOn('keydown', onGesture);
let sfxN = 0;
function sfx(id       , pitch = 0) {
  if (!sound || !audioUnlocked) return;
  const eventId = id + ':' + (sfxN++);
  void sound.playCue(id, { eventId, seed: eventId, pitchSemitones: pitch }).catch(() => {});
}
function startChargeSfx() {
  if (!sound || !audioUnlocked) return;
  const eventId = 'charge:' + (sfxN++);
  sound.playCue('sfx.charge', { eventId }).then((r     ) => { chargeVoice = r?.instanceId ?? null; if (phase !== 'charge') stopChargeSfx(); }).catch(() => {});
}
function stopChargeSfx() {
  if (sound && chargeVoice) { try { void sound.stop(chargeVoice); } catch { /* ignore */ } }
  chargeVoice = null;
}
winOn('pagehide', () => { if (sound) void sound.dispose(); }, { once: true });

// ───────────────────────── app / display ─────────────────────────
// 挂载根：宿主容器里再套一层，根节点是定位上下文（canvas 铺满它，纸面背景画在 canvas 里）
const mountRoot = document.createElement('div');
mountRoot.className = 'hs';
mountRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden;touch-action:none;';
mountContainer.appendChild(mountRoot);
const app = new PIXI.Application();
await app.init({ resizeTo: mountRoot, autoDensity: true, antialias: true, background: 0xf6f0e1 });
mountRoot.appendChild(app.canvas);
const root = new PIXI.Container();
app.stage.addChild(root);
const paperG = new PIXI.Graphics();
const sceneLayer = new PIXI.Container();
const fxLayer = new PIXI.Container();
const hudLayer = new PIXI.Container();
const overlayLayer = new PIXI.Container();
root.addChild(paperG, sceneLayer, fxLayer, hudLayer, overlayLayer);
let viewW = W, viewH = H, scaleS = 1, offX = 0, offY = 0;
let paperTheme        = THEMES[0];
let paperStain = true;
function relayout(w        , h        ) {
  viewW = w; viewH = h;
  scaleS = Math.min(w / W, h / H) || 1;
  offX = (w - W * scaleS) / 2; offY = (h - H * scaleS) / 2;
  root.scale.set(scaleS);
  root.position.set(offX, offY);
  drawPaperBg();
}
function drawPaperBg() {
  paperG.clear();
  const x = -offX / scaleS - 2, y = -offY / scaleS - 2, w = viewW / scaleS + 4, h = viewH / scaleS + 4;
  drawPaper(paperG, paperTheme, x, y, w, h, 7, 60);
  if (paperStain) coffeeStain(paperG, 40, 50, 46);
}
// ★ orientation 必须 'both'：本作设计空间是 1280×720（横屏），而宿主容器是竖的。
//   写 'landscape' 会让 mountDisplay 在竖屏插一张 fixed 全屏提示（挂到 document.body 上，
//   连宿主顶栏底栏一起盖住）。这里让它按容器实测尺寸走，游戏自己 letterbox 居中。
const display = mountDisplay({ host: mountRoot, orientation: 'both', lang: 'zh', onResize: ({ width, height }) => relayout(width, height) });
display.attachPixi(app);
app.renderer.on('resize', (w        , h        ) => relayout(w, h));
relayout(app.screen.width, app.screen.height);
const rankingFxScreen = new PIXI.Container();
const rankingFxWorld = new PIXI.Container();
root.addChild(rankingFxWorld);
app.stage.addChild(rankingFxScreen);
const fx = await createPixiFx({ PIXI, app, world: rankingFxWorld, screen: rankingFxScreen });
winOn('pagehide', () => fx.dispose(), { once: true });

function setPaper(th       , stain         ) {
  paperTheme = th; paperStain = stain;
  app.renderer.background.color = th.bg;
  drawPaperBg();
}

// ───────────────────────── small utils ─────────────────────────
;                                                                                
let tweens          = [];
function tween(d        , f                     , done             ) { const tw = { t: 0, d, f, done }; tweens.push(tw); f(0); return tw; }
const easeOut = (k        ) => 1 - Math.pow(1 - k, 3);
const easeBack = (k        ) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
let timers                                 = [];
function after(s        , f            ) { timers.push({ t: s, f }); }

function txt(s        , size        , color        , opts                                 = {}) {
  const tx = new PIXI.Text({ text: s, style: { fontFamily: FONT, fontSize: size, fill: color, align: 'center', ...opts } });
  tx.anchor.set(0.5);
  return tx;
}
function fitText(tx           , maxW        ) { if (tx.width > maxW) tx.scale.set(maxW / tx.width); }

let seedCounter = 1;
function doodleButton(label        , w        , h        , onTap            , fill = 0xffffff, ink = 0x1f2a44, size = 34) {
  const c = new PIXI.Container();
  const sd = seedCounter++;
  c.addChild(new Boil((g, r) => {
    g.roundRect(-w / 2 + 4, -h / 2 + 6, w, h, 14).fill({ color: 0x000000, alpha: 0.12 });
    g.roundRect(-w / 2, -h / 2, w, h, 14).fill(fill);
    jpath(g, [-w / 2 + 8, -h / 2, w / 2 - 8, -h / 2, w / 2, -h / 2 + 8, w / 2, h / 2 - 8, w / 2 - 8, h / 2, -w / 2 + 8, h / 2, -w / 2, h / 2 - 8, -w / 2, -h / 2 + 8], r, 1.4, 18, true);
    stroke(g, ink, 3.2);
  }, sd));
  const tx = txt(label, size, ink);
  fitText(tx, w - 24);
  c.addChild(tx);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.hitArea = new PIXI.Rectangle(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
  c.on('pointerdown', (e) => { e.stopPropagation(); c.scale.set(0.94); });
  c.on('pointerupoutside', () => { if (!c.destroyed) c.scale.set(1); });
  c.on('pointerup', (e) => { e.stopPropagation(); c.scale.set(1); sfx('sfx.click'); onTap(); });
  return c;
}

;                                                                                          
function drawIcon(g               , kind          , r   , ink        ) {
  const s = 1;
  if (kind === 'restart') {
    const pts           = [];
    for (let i = 0; i <= 14; i++) { const a = -0.3 + (i / 14) * 5.2; pts.push(Math.cos(a) * 15 * s, Math.sin(a) * 15 * s); }
    jpath(g, pts, r, 0.8, 8); stroke(g, ink, 4);
    const ex = Math.cos(-0.3) * 15, ey = Math.sin(-0.3) * 15;
    jpath(g, [ex - 9, ey - 6, ex + 1, ey + 1, ex + 7, ey - 9], r, 0.7, 8); stroke(g, ink, 4);
  } else if (kind === 'sound' || kind === 'mute') {
    jpath(g, [-16, -6, -8, -6, 2, -15, 2, 15, -8, 6, -16, 6], r, 0.8, 8, true); stroke(g, ink, 3.5);
    if (kind === 'sound') {
      for (const rr of [8, 15]) { const pts           = []; for (let i = 0; i <= 6; i++) { const a = -0.8 + (i / 6) * 1.6; pts.push(6 + Math.cos(a) * rr, Math.sin(a) * rr); } jpath(g, pts, r, 0.6, 6); stroke(g, ink, 3.5); }
    } else {
      jpath(g, [8, -8, 20, 6], r, 0.8); jpath(g, [20, -8, 8, 6], r, 0.8); stroke(g, ink, 3.5);
    }
  } else if (kind === 'grid') {
    for (const [x, y] of [[-15, -15], [2, -15], [-15, 2], [2, 2]]) jrect(g, x, y, 13, 13, r, ink, 3.5, 0.8);
  } else if (kind === 'home') {
    jpath(g, [-17, 0, 0, -16, 17, 0], r, 0.8); stroke(g, ink, 3.5);
    jpath(g, [-12, -3, -12, 15, 12, 15, 12, -3], r, 0.8); stroke(g, ink, 3.5);
    jpath(g, [-4, 15, -4, 5, 4, 5, 4, 15], r, 0.6); stroke(g, ink, 3);
  } else if (kind === 'left' || kind === 'right') {
    const d = kind === 'left' ? -1 : 1;
    jpath(g, [-8 * d, -18, 10 * d, 0, -8 * d, 18], r, 1); stroke(g, ink, 5);
  } else if (kind === 'lang') {
    jcircle(g, 0, 0, 15, r, ink, 3);
    jpath(g, [-15, 0, 15, 0], r, 0.6); jpath(g, [0, -15, 0, 15], r, 0.6); stroke(g, ink, 2.5);
    const pts           = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; pts.push(Math.cos(a) * 7, Math.sin(a) * 15); } jpath(g, pts, r, 0.5, 6); stroke(g, ink, 2.5);
  }
}
function iconButton(kind          , onTap            , ink        ) {
  const c = new PIXI.Container();
  const sd = seedCounter++;
  c.addChild(new Boil((g, r) => drawIcon(g, kind, r, ink), sd));
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.hitArea = new PIXI.Circle(0, 0, 30);
  c.on('pointerdown', (e) => { e.stopPropagation(); c.scale.set(0.88); });
  c.on('pointerupoutside', () => { if (!c.destroyed) c.scale.set(1); });
  c.on('pointerup', (e) => { e.stopPropagation(); c.scale.set(1); sfx('sfx.click'); onTap(); });
  return c;
}

// ───────────────────────── particles & fx ─────────────────────────
;                                                                                                             
let parts         = [];
const CONFETTI = [0xe84a5f, 0xffb400, 0x3bb4e5, 0x3fa34d, 0x9b59d0, 0xf08a24];
function burst(x        , y        , n        , colors          , speed = 260, grav = 500, size = 10) {
  for (let i = 0; i < n; i++) {
    const g = new PIXI.Graphics();
    const col = colors[i % colors.length];
    const l = size * (0.5 + Math.random());
    g.moveTo(-l / 2, 0).quadraticCurveTo(0, (Math.random() - 0.5) * l, l / 2, 0).stroke({ color: col, width: 3, cap: 'round' });
    g.position.set(x, y);
    g.rotation = Math.random() * 6.28;
    const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.8);
    parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.3, life: 0, max: 0.7 + Math.random() * 0.6, vr: (Math.random() - 0.5) * 14, grav });
    fxLayer.addChild(g);
  }
}
function puff(x        , y        , n        , color        , speed = 160) {
  for (let i = 0; i < n; i++) {
    const g = new PIXI.Graphics();
    const r = mulberry(i * 31 + n);
    jcircle(g, 0, 0, 6 + Math.random() * 10, r, color, 2.5, 1.5);
    g.position.set(x, y);
    const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random());
    parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + Math.random() * 0.4, vr: (Math.random() - 0.5) * 4, grav: -60 });
    fxLayer.addChild(g);
  }
}
let shake = 0;
function stamp(text        , x        , y        , color        ) {
  const tx = txt(text, 84, color, { fontWeight: 'bold', stroke: { color: 0xffffff, width: 10 } });
  tx.position.set(x, y);
  tx.rotation = -0.12;
  fxLayer.addChild(tx);
  tween(0.35, k => { const e = easeBack(k); tx.scale.set(2.2 - 1.2 * e); tx.alpha = Math.min(1, k * 3); });
  after(1.3, () => tween(0.3, k => { tx.alpha = 1 - k; }, () => tx.destroy()));
}

// ───────────────────────── game state ─────────────────────────
;                                                             
let scene        = 'boot';
                                                                               
let phase        = 'aim';
let time = 0;

let cur = 0; // level index
let lv           = LEVELS[0];
let sim      = new Sim(lv);
let th        = THEMES[0];
let shots = 0;
let power = 0, chargeT = 0;
let restartBtn                        = null;
let restartNag = false;
let acc = 0, flyT = 0, endT = 0;
let ballRot = 0;
let levelLayer = new PIXI.Container();
const boxViews = new Map                        ();
const circViews = new Map                        ();
let ballView                        = null;
let blob                                                                                           = null;
// knocked-out shooter: flies with its own copy of the level physics, then lies dizzy
let koSim             = null;
let koStars                        = null;
let koSpin = 0, koDone = false, koAge = 0, koDoneT = 0, koSlow = 0;
function knockBlob(ivx        , ivy        ) {
  if (!blob || koSim) return;
  const s = new Sim(lv);
  for (const c of s.circs) if (c.kind === 'blob') c.alive = false;
  s.t = sim.t;
  s.bx = lv.p[0]; s.by = lv.p[1] - 0.65;
  s.vx = ivx * 0.7 + lv.f * -0.5; s.vy = Math.min(-5, ivy * 0.4 - 6);
  s.state = 'fly'; s.blobArmed = true; s.ax = s.bx; s.ay = s.by; s.stall = 0;
  koSim = s; koSpin = s.vx * 0.9; koDone = false; koAge = 0; koDoneT = 0; koSlow = 0;
  const root = blob.root;
  root.pivot.set(0, -26); root.position.set(s.bx * C, s.by * C);
  setMood('ouch');
  sfx('sfx.bonk');
  burst(s.bx * C, s.by * C - 20, 10, [0xffd166, 0xffffff, 0xf7b03a], 260, 300, 10);
  shockMark(s.bx * C, s.by * C - 90);
  shake = Math.max(shake, 8);
  koStars = new PIXI.Container();
  for (let i = 0; i < 3; i++) koStars.addChild(makeStar(9, true, 1500 + i));
  koStars.visible = false;
  levelLayer.addChild(koStars);
}
function tickKo(dt        ) {
  if (!koSim || !blob || blob.root.destroyed) return;
  const s = koSim, root = blob.root;
  koAge += dt;
  if (koDone) koDoneT += dt;
  // the hit already counted as a miss: show the dizzy pose briefly, then reset the level
  if (phase === 'miss' && scene === 'play' && ((koDone && koDoneT > 0.75) || koAge > 2.2)) { buildLevel(); return; }
  if (!koDone) {
    let n = Math.round(dt / DT);
    let touch = false;
    while (n-- > 0 && s.state === 'fly') { s.events.length = 0; s.step(); if (s.hitThisStep) touch = true; }
    s.events.length = 0;
    root.position.set(s.bx * C, s.by * C);
    root.rotation += koSpin * dt;
    koSpin *= Math.exp(-0.8 * dt);
    koSlow = touch && Math.hypot(s.vx, s.vy) < 2 ? koSlow + dt : 0;
    if (s.state !== 'fly' || koSlow > 0.12 || koAge > 1.3) {
      koDone = true;
      setMood('ko');
      sfx('sfx.bounce', -4);
      // flop over onto a side
      const r0 = root.rotation, side = Math.sign(Math.sin(r0) || lv.f);
      const target = Math.round((r0 - side * Math.PI / 2) / (Math.PI * 2)) * Math.PI * 2 + side * Math.PI / 2;
      tween(0.35, k => { if (!root.destroyed) root.rotation = r0 + (target - r0) * easeBack(k); });
    }
  }
  if (koStars && !koStars.destroyed) {
    const g = koStars;
    g.visible = koDone;
    if (koDone) {
      const cx = root.x, cy = root.y - 30;
      g.children.forEach((s, i) => {
        const a = time * 4 + (i * Math.PI * 2) / 3;
        s.position.set(cx + Math.cos(a) * 30, cy + Math.sin(a) * 9);
        s.rotation = time * 3 + i;
      });
    }
  }
}
let hoopBack                        = null, hoopFront                        = null, netG                       = null;
let aimG                       = null, barG                       = null;
let beltG                       = null; // belt direction chevrons (above belt bodies)
let zoneViews                   = [];
let cannonViews                   = [];
let starViews                   = [];
let hudStars                        = null;
function refreshStarHud() {
  if (!hudStars || hudStars.destroyed) return;
  hudStars.removeChildren().forEach(c => c.destroy({ children: true }));
  const dk = th.kind === 'dark' || th.kind === 'blueprint';
  for (let k = 0; k < sim.stars.length; k++) {
    const s = makeStar(15, sim.stars[k].got, 1400 + k, dk ? 0xf4f1e8 : 0x1f2a44, dk ? 0x8a97bd : 0x9aa3b5);
    s.position.set(k * 36, 0);
    hudStars.addChild(s);
  }
  // hand-drawn hoop on the right = the star you get for scoring (faint until the ball goes in)
  const scored = sim.state === 'score';
  const ball = new Boil((g, r) => {
    const ink = dk ? 0xf4f1e8 : 0x1f2a44;
    // backboard
    g.rect(-4, -20, 26, 18).fill(0xffffff);
    jrect(g, -4, -20, 26, 18, r, ink, 2.2, 0.8);
    jrect(g, 4, -14, 10, 8, r, 0xe8322a, 1.8, 0.6);
    // net
    jpath(g, [-6, 2, -2, 16, 3, 2, 9, 16, 14, 2, 18, 16, 22, 2], r, 0.7, 6); stroke(g, ink, 1.6, 0.9);
    jpath(g, [-1, 12, 19, 12], r, 0.7, 8); stroke(g, ink, 1.4, 0.8);
    // red rim
    jpath(g, [-9, 1, 25, 1], r, 0.9, 8); stroke(g, 0xe8322a, 4);
  }, 1450);
  ball.position.set(sim.stars.length * 36 - 4, 2);
  ball.scale.set(0.95);
  ball.alpha = scored ? 1 : 0.35;
  hudStars.addChild(ball);
}
/** hand-drawn "!?" shock mark with a spiky pow behind it (line boil, no font) */
function shockMark(x        , y        ) {
  const c = new PIXI.Container();
  c.position.set(x, y);
  c.addChild(new Boil((g, r) => {
    const pts           = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, q = i % 2 ? 30 : 46 + r() * 8; pts.push(Math.cos(a) * q * 1.15, Math.sin(a) * q); }
    g.poly(pts).fill(0xffd166);
    jpath(g, pts, r, 1.6, 12, true); stroke(g, 0x1f2a44, 3.2);
    // "!"
    jpath(g, [-12, -24, -10, 6], r, 1.2, 8); stroke(g, 0xe8322a, 8);
    g.circle(-9 + (r() - 0.5) * 2, 17, 4.5).fill(0xe8322a);
    // "?"
    const q           = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 1.1 - (i / 10) * Math.PI * 1.45; q.push(14 + Math.cos(a) * 10, -14 + Math.sin(a) * 10); }
    q.push(15, 0, 14, 6);
    jpath(g, q, r, 1, 6); stroke(g, 0xe8322a, 6.5);
    g.circle(14 + (r() - 0.5) * 2, 17, 4).fill(0xe8322a);
  }, 4242));
  c.rotation = -0.12;
  fxLayer.addChild(c);
  tween(0.35, k => { const e = easeBack(k); c.scale.set(1.8 - 0.8 * e); c.alpha = Math.min(1, k * 3); });
  after(1.1, () => tween(0.3, k => { if (!c.destroyed) c.alpha = 1 - k; }, () => c.destroy({ children: true })));
}
let bubbleOnBall                        = null;
let paintOnBall                       = null, paintCoat = -1;
let dynG                       = null; // per-frame animated bits (belts, wind, stars)
let hudShots                   = null;
let lastBounceSfx = 0;

function worldOf(i        ) { return Math.floor(i / 5); }
function wallColor(id        , big         )         {
  if (th.kind === 'sketch') return [0x3b6fd8, 0xe0527a, 0x3fa34d, 0x9b59d0, 0xf08a24][id % 5];
  return big ? th.hatch : (id % 2 ? th.hatch2 : th.hatch);
}

// ───────────────────────── object views ─────────────────────────
function drawBlobBody(g               , r   , ink        ) {
  // feet
  for (const fx of [-11, 10]) { g.ellipse(fx, -3, 8, 4.5).fill(0xf5a623); jcircle(g, fx, -3, 5.5, r, ink, 2.4, 0.6); }
  const pts           = [];
  for (let i = 0; i <= 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rx = 28, ry = a > 0 && a < Math.PI ? 20 : 26;
    pts.push(Math.cos(a) * rx, -26 + Math.sin(a) * ry);
  }
  g.poly(pts).fill(0xf7b03a);
  hatchCircle(g, 0, -26, 25, r, 0xe07b00, 6, 2.2, 0.7);
  jpath(g, pts, r, 1.2, 14, true); stroke(g, ink, 3);
}
function drawFace(g               , mood        , ink        ) {
  g.clear();
  if (mood === 'cheer') {
    g.moveTo(1, -31).lineTo(5, -35).lineTo(9, -31);
    g.moveTo(14, -31).lineTo(18, -35).lineTo(22, -31);
    g.stroke({ color: ink, width: 2.6, cap: 'round', join: 'round' });
    g.moveTo(6, -22).quadraticCurveTo(12, -12, 19, -22).closePath().fill(0x7a2a18);
  } else if (mood === 'focus') {
    g.moveTo(1, -32).lineTo(9, -30); g.moveTo(14, -30).lineTo(22, -32); g.stroke({ color: ink, width: 2.6, cap: 'round' });
    g.circle(5, -27, 2.6).circle(18, -27, 2.6).fill(ink);
    g.moveTo(8, -19).lineTo(16, -19).stroke({ color: ink, width: 2.4, cap: 'round' });
  } else if (mood === 'ko') {
    // X eyes, wobbly mouth, dizzy blush
    for (const ex of [5, 18]) g.moveTo(ex - 3.5, -33).lineTo(ex + 3.5, -26).moveTo(ex + 3.5, -33).lineTo(ex - 3.5, -26);
    g.stroke({ color: ink, width: 2.6, cap: 'round' });
    g.moveTo(5, -19).quadraticCurveTo(8, -23, 11, -19).quadraticCurveTo(14, -15, 17, -19).stroke({ color: ink, width: 2.4, cap: 'round' });
    g.circle(0, -22, 3).circle(23, -22, 3).fill({ color: 0xff6b6b, alpha: 0.55 });
  } else if (mood === 'ouch') {
    g.moveTo(1, -33).lineTo(8, -30).lineTo(1, -27); g.moveTo(22, -33).lineTo(15, -30).lineTo(22, -27);
    g.stroke({ color: ink, width: 2.6, cap: 'round', join: 'round' });
    g.ellipse(12, -19, 4, 5).fill(0x7a2a18);
  } else if (mood === 'sad') {
    g.circle(5, -29, 2.6).circle(18, -29, 2.6).fill(ink);
    g.moveTo(7, -18).quadraticCurveTo(12, -23, 17, -18).stroke({ color: ink, width: 2.4, cap: 'round' });
  } else {
    g.circle(5, -30, 2.8).circle(18, -30, 2.8).fill(ink);
    g.moveTo(6, -21).quadraticCurveTo(12, -15, 18, -21).stroke({ color: ink, width: 2.4, cap: 'round' });
    g.circle(0, -22, 3).circle(23, -22, 3).fill({ color: 0xff6b6b, alpha: 0.45 });
  }
}
function setMood(m        ) { if (blob && blob.mood !== m) { blob.mood = m; drawFace(blob.face, m, th.kind === 'dark' || th.kind === 'blueprint' ? 0x1f2a44 : th.ink); } }

function drawBall(g               , r   , ink        ) {
  const rad = BALL_R * C;
  g.circle(0, 0, rad).fill(0x2f6fe0);
  hatchCircle(g, 0, 0, rad - 1, r, 0x1b4fb5, 5, 2, 0.8);
  jcircle(g, 0, 0, rad, r, ink, 2.6, 0.7);
  jpath(g, [0, -rad, 0, rad], r, 0.6, 8); jpath(g, [-rad, 0, rad, 0], r, 0.6, 8);
  const c1           = [], c2           = [];
  for (let i = 0; i <= 8; i++) { const a = -1.1 + (i / 8) * 2.2; c1.push(-rad * 1.25 + Math.cos(a) * rad * 0.95, Math.sin(a) * rad * 0.95); c2.push(rad * 1.25 - Math.cos(a) * rad * 0.95, Math.sin(a) * rad * 0.95); }
  jpath(g, c1, r, 0.5, 6); jpath(g, c2, r, 0.5, 6);
  stroke(g, ink, 1.8);
}

function drawStar(g               , x        , y        , rr        , color        , fill = true, ink = 0x1f2a44) {
  const pts           = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const q = i % 2 ? rr * 0.45 : rr; pts.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  if (fill) g.poly(pts).fill(color);
  g.poly(pts).stroke({ color: ink, width: 2.5, join: 'round' });
}

// hand-drawn dashed outlines (line-boiled like every other stroke): range rings and "switched-off" ghosts
function dashedRing(R0        , color        , alpha        , seed        , width = 2.4)       {
  return new Boil((g, r) => {
    const n = Math.max(12, Math.round((R0 * Math.PI * 2) / 26));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.05, a1 = a0 + (Math.PI * 2 / n) * 0.55;
      const pts           = [];
      for (let k = 0; k <= 3; k++) { const a = a0 + (a1 - a0) * (k / 3), q = R0 + (r() - 0.5) * 2.2; pts.push(Math.cos(a) * q, Math.sin(a) * q); }
      jpath(g, pts, r, 0.7, 8);
    }
    stroke(g, color, width, alpha);
  }, seed);
}
function dashedRect(w        , h        , color        , alpha        , seed        , width = 2.6)       {
  return new Boil((g, r) => {
    const edges = [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
    for (const [x1, y1, x2, y2] of edges) {
      const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 16));
      for (let i = 0; i < n; i++) {
        const d = (i / n) * len + (r() - 0.5) * 2, e = Math.min(len, d + (len / n) * 0.55);
        jpath(g, [x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len], r, 1, 20);
      }
    }
    stroke(g, color, width, alpha);
  }, seed);
}
// hand-drawn crack scribbles on a hard block (redrawn after each hit, boiled)
function crackDoodle(w        , h        , n        , seed        )       {
  return new Boil((g, r) => {
    for (let k = 0; k < n; k++) {
      const rr = mulberry(seed * 31 + k * 7);
      const sx = (rr() - 0.5) * w * 0.75, sy = (rr() - 0.5) * h * 0.75;
      const pts = [sx, sy]; let x = sx, y = sy, a = rr() * Math.PI * 2;
      for (let s = 0; s < 3; s++) { a += (rr() - 0.5) * 1.6; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push(x, y); }
      jpath(g, pts, r, 0.6, 6);
      if (rr() < 0.6) jpath(g, [pts[2], pts[3], pts[2] + Math.cos(a + 1.2) * 7, pts[3] + Math.sin(a + 1.2) * 7], r, 0.5, 6);
    }
    stroke(g, 0x1f2a44, 2.2);
  }, seed);
}

function boxView(b     )                 {
  const w = b.hw * 2 * C, h = b.hh * 2 * C;
  const c = new PIXI.Container();
  c.position.set(b.cx * C, b.cy * C);
  c.rotation = (b.ang * Math.PI) / 180;
  const ink = th.ink;
  const sd = b.id * 13 + cur * 101;
  if (b.kind === 'wall') {
    const big = w * h > 20 * C * C || w > 10 * C;
    const col = wallColor(b.id, big);
    c.addChild(new Boil((g, r) => { hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, col, 7.5, 2.4, 0.85); jrect(g, -w / 2, -h / 2, w, h, r, ink, 3); }, sd));
  } else if (b.kind === 'board') {
    c.addChild(new Boil((g, r) => { g.rect(-w / 2, -h / 2, w, h).fill(0xffffff); jrect(g, -w / 2, -h / 2, w, h, r, ink, 2.6, 0.8); }, sd));
  } else if (b.kind === 'brick') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xe0874f, alpha: 0.35 });
      for (let y = -h / 2 + 14, row = 0; y < h / 2; y += 14, row++) { g.moveTo(-w / 2, y).lineTo(w / 2, y); }
      for (let y = -h / 2, row = 0; y < h / 2; y += 14, row++) for (let x = -w / 2 + (row % 2 ? 10 : 20); x < w / 2; x += 20) g.moveTo(x, y).lineTo(x, Math.min(h / 2, y + 14));
      g.stroke({ color: 0xb5552f, width: 1.8, alpha: 0.8 });
      // dashed outline
      const edges = [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
      for (const [x1, y1, x2, y2] of edges) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d < len; d += 12) { const e = Math.min(len, d + 7); jpath(g, [x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len], r, 0.8, 20); }
      }
      stroke(g, 0x8a3b1d, 2.8);
    }, sd));
  } else if (b.kind === 'crate') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill(0xd9a066);
      hatchRect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r, 0x9a6330, 6, 2, 0.6);
      jpath(g, [-w / 2 + 4, -h / 2 + 4, w / 2 - 4, h / 2 - 4], r, 1); jpath(g, [w / 2 - 4, -h / 2 + 4, -w / 2 + 4, h / 2 - 4], r, 1);
      stroke(g, 0x6b4220, 2.6);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3);
    }, sd));
  } else if (b.kind === 'spring') {
    const inner = new PIXI.Container();
    inner.addChild(new Boil((g, r) => {
      g.rect(-24, 5, 48, 5).fill(0x888888); jrect(g, -24, 5, 48, 5, r, ink, 2.2, 0.5);
      const pts           = [];
      for (let i = 0; i <= 8; i++) pts.push(i % 2 ? 14 : -14, 5 - i * 1.6);
      jpath(g, pts, r, 0.6, 6); stroke(g, 0x555555, 3.2);
      g.roundRect(-27, -12, 54, 7, 3).fill(0xe84a5f); jrect(g, -27, -12, 54, 7, r, ink, 2.4, 0.6);
    }, sd));
    inner.pivot.set(0, -10); inner.y = -10 + 0; // compress around the base
    inner.position.set(0, 10);
    inner.pivot.set(0, 10);
    c.addChild(inner);
    (c       ).inner = inner;
  } else if (b.kind === 'belt') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(th.kind === 'dark' || th.kind === 'blueprint' ? 0x3a4a6a : 0xd9d9d9);
      jpath(g, [-w / 2 + h / 2, -h / 2, w / 2 - h / 2, -h / 2], r, 0.9); jpath(g, [-w / 2 + h / 2, h / 2, w / 2 - h / 2, h / 2], r, 0.9); stroke(g, ink, 3);
      jcircle(g, -w / 2 + h / 2, 0, h / 2, r, ink, 3, 0.8); jcircle(g, w / 2 - h / 2, 0, h / 2, r, ink, 3, 0.8);
      g.circle(-w / 2 + h / 2, 0, 3).circle(w / 2 - h / 2, 0, 3).fill(ink);
    }, sd));
  } else if (b.kind === 'fanbody') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill(0xf0f0f0);
      hatchRect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r, 0x8899aa, 6, 1.8, 0.6);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3, 0.8);
      g.circle(w / 2, 0, 4).fill(ink);
    }, sd));
    const blades = new PIXI.Graphics();
    blades.ellipse(0, 0, 5, h / 2 + 4).fill({ color: 0x9fd0ff, alpha: 0.9 }).stroke({ color: ink, width: 2.4 });
    blades.position.set(w / 2 + 4, 0);
    c.addChild(blades);
    (c       ).blades = blades;
  } else if (b.kind === 'rubber') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2).fill(0xff6fb5);
      hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, 0xd6337f, 7, 2.2, 0.7);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3.2);
      // squiggle = bouncy
      const long = w >= h, L = (long ? w : h) - 16, pts           = [];
      for (let i = 0; i <= 16; i++) { const t = -L / 2 + (L * i) / 16, o = (i % 2 ? 1 : -1) * Math.min(4, (long ? h : w) / 5); pts.push(long ? t : o, long ? o : t); }
      jpath(g, pts, r, 0.5, 8); stroke(g, 0xffffff, 2.2, 0.9);
    }, sd));
  } else if (b.kind === 'door') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill(0xc98a4b);
      const long = w >= h;
      for (let k = -1; k <= 1; k += 2) { if (long) g.moveTo(-w / 2, k * h / 5).lineTo(w / 2, k * h / 5); else g.moveTo(k * w / 5, -h / 2).lineTo(k * w / 5, h / 2); }
      g.stroke({ color: 0x8a5a2b, width: 1.6, alpha: 0.8 });
      hatchRect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r, 0x8a5a2b, 9, 1.6, 0.5);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3);
      // lock icon in the middle
      g.roundRect(-7, -3, 14, 11, 2).fill(0xffd166); jrect(g, -7, -3, 14, 11, r, ink, 2, 0.5);
      const arc           = []; for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; arc.push(Math.cos(a) * 5, -3 + Math.sin(a) * 6); }
      jpath(g, arc, r, 0.4, 6); stroke(g, ink, 2.2);
    }, sd));
  } else if (b.kind === 'button') {
    const cap = new PIXI.Container();
    cap.addChild(new Boil((g, r) => { g.roundRect(-w / 2 + 8, -14, w - 16, 12, 5).fill(0xe84a5f); jrect(g, -w / 2 + 8, -14, w - 16, 12, r, ink, 2.4, 0.6); }, sd + 1));
    c.addChild(cap);
    c.addChild(new Boil((g, r) => { g.rect(-w / 2, -2, w, h / 2 + 2).fill(0x9a9a9a); jrect(g, -w / 2, -2, w, h / 2 + 2, r, ink, 2.6, 0.6); }, sd));
    (c       ).cap = cap;
  } else if (b.kind === 'glass') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xbdefff, alpha: 0.55 });
      jrect(g, -w / 2, -h / 2, w, h, r, 0x3aa6c9, 2.6, 0.7);
      // glints
      const long = h > w;
      for (let k = 0; k < 3; k++) {
        const t = (k - 1) * (long ? h : w) / 3.5;
        if (long) { jpath(g, [-w / 2 + 3, t, w / 2 - 3, t - 10], r, 0.5, 6); } else { jpath(g, [t, h / 2 - 3, t + 10, -h / 2 + 3], r, 0.5, 6); }
      }
      stroke(g, 0xffffff, 2.4, 0.95);
    }, sd));
  } else if (b.kind === 'oneway') {
    c.addChild(new Boil((g, r) => {
      // dashed plank: solid top edge, arrows show it lets the ball up through
      g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xffd166, alpha: 0.35 });
      jpath(g, [-w / 2, -h / 2, w / 2, -h / 2], r, 0.8); stroke(g, ink, 3.4);
      for (let x = -w / 2; x < w / 2; x += 14) { jpath(g, [x, h / 2, Math.min(w / 2, x + 7), h / 2], r, 0.5, 10); }
      stroke(g, ink, 2);
      for (let x = -w / 2 + 20; x < w / 2 - 10; x += 44) {
        jpath(g, [x, h / 2 + 2, x, -h / 2 + 4], r, 0.4, 8); jpath(g, [x - 5, -h / 2 + 9, x, -h / 2 + 3, x + 5, -h / 2 + 9], r, 0.4, 6);
      }
      stroke(g, 0xe07a1f, 2.4);
    }, sd));
  } else if (b.kind === 'paddle') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(0x5fbf7a);
      hatchRect(g, -w / 2 + 4, -h / 2 + 2, w - 8, h - 4, r, 0x2f8a4a, 6, 2, 0.7);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3);
      g.circle(0, 0, 7).fill(0xffd166); jcircle(g, 0, 0, 7, r, ink, 2.4, 0.5);
    }, sd));
  } else if (b.kind === 'ice') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill({ color: 0xcdefff, alpha: 0.95 });
      hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, 0x7cc8ec, 12, 1.6, 0.5);
      jrect(g, -w / 2, -h / 2, w, h, r, 0x2a76a8, 2.8);
      for (let x = -w / 2 + 12; x < w / 2 - 14; x += 34) jpath(g, [x, -h / 2 + 4, x + 10, -h / 2 + 4], r, 0.4, 8);
      stroke(g, 0xffffff, 3, 0.95);
    }, sd));
  } else if (b.kind === 'sponge') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, 6).fill(0xffe066);
      const cols = Math.max(1, Math.floor(w / 16)), rows = Math.max(1, Math.floor(h / 16));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3) % 4 === 0) continue;
        g.ellipse(-w / 2 + (i + 0.5) * (w / cols) + J2(r) * 2, -h / 2 + (j + 0.5) * (h / rows) + J2(r) * 2, 3 + r() * 2.5, 2.5 + r() * 2).fill({ color: 0xd4a017, alpha: 0.85 });
      }
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3, 1.6);
    }, sd));
  } else if (b.kind === 'glue') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2).fill(0x8fdc5a);
      hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, 0x4f9a2e, 8, 2, 0.6);
      jrect(g, -w / 2, -h / 2, w, h, r, 0x2f6a1a, 3);
      if (w >= h) for (let x = -w / 2 + 10; x < w / 2 - 6; x += 22) { const l = 5 + r() * 9; g.roundRect(x - 3, h / 2 - 3, 6, l, 3).fill(0x8fdc5a); g.circle(x, h / 2 + l, 4).fill(0x8fdc5a); }
      else for (let y = -h / 2 + 12; y < h / 2 - 6; y += 26) { const l = 4 + r() * 6; g.roundRect(-w / 2 - l, y - 3, l + 3, 6, 3).fill(0x8fdc5a); g.circle(-w / 2 - l, y + 3, 4).fill(0x8fdc5a); }
      g.circle(-w / 4, -h / 4, 3).fill({ color: 0xffffff, alpha: 0.8 });
    }, sd));
  } else if (b.kind === 'laser') {
    const long = w >= h, L = long ? w : h;
    const beam = new PIXI.Container();
    beam.addChild(new Boil((g, r) => {
      const pts           = []; for (let s = -L / 2 + 8; s <= L / 2 - 8; s += 16) pts.push(long ? s : J2(r) * 1.3, long ? J2(r) * 1.3 : s);
      jpath(g, pts, r, 0.3, 10); stroke(g, 0xff4d6d, 11, 0.3);
      jpath(g, pts, r, 0.6, 10); stroke(g, 0xff2442, 4);
      jpath(g, pts, r, 0.3, 10); stroke(g, 0xfff0f3, 1.6);
    }, sd));
    c.addChild(beam);
    c.addChild(new Boil((g, r) => {
      for (const s of [-1, 1]) { const ex = long ? s * (L / 2 - 2) : 0, ey = long ? 0 : s * (L / 2 - 2); g.roundRect(ex - 8, ey - 8, 16, 16, 3).fill(0x6b7280); jrect(g, ex - 8, ey - 8, 16, 16, r, ink, 2.2, 0.5); g.circle(ex, ey, 3).fill(0xff2442); }
    }, sd + 1));
  } else if (b.kind === 'crumble') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill(0xd8c3a5);
      hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, 0xa58b68, 6, 1.6, 0.6);
      const long = w >= h, L = long ? w : h, T = long ? h : w;
      for (let s = -L / 2 + 12; s < L / 2 - 8; s += 24) {
        const q = [s, -0.5, s + 5, 0.1, s + 1, 0.3, s + 8, 0.5];
        const pts           = []; for (let k = 0; k < q.length; k += 2) pts.push(long ? q[k] : q[k + 1] * T, long ? q[k + 1] * T : q[k]);
        jpath(g, pts, r, 0.5, 6);
      }
      stroke(g, 0x6b4f2e, 2);
      const edges = [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
      for (const [x1, y1, x2, y2] of edges) { const len = Math.hypot(x2 - x1, y2 - y1); for (let d = 0; d < len; d += 10) { const e = Math.min(len, d + 6); jpath(g, [x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len], r, 0.7, 20); } }
      stroke(g, ink, 2.6);
    }, sd));
  } else if (b.kind === 'hpblock') {
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill(0xb8bcc6);
      hatchRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r, 0x6b7280, 7, 2, 0.6);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3.2);
    }, sd));
    const cracks = new PIXI.Container();
    c.addChild(cracks);
    const num = txt(String(b.hp || 1), 26, 0x1f2a44, { fontWeight: 'bold', stroke: { color: 0xffffff, width: 5 } });
    num.rotation = -c.rotation;
    c.addChild(num);
    (c       ).hpText = num; (c       ).cracks = cracks;
  } else if (b.kind === 'gate') {
    // colour gate: crayon-hatched in its paint colour with door slats; fades when the ball wears that colour
    const col = PAINT_COLS[b.col || 0];
    c.addChild(new Boil((g, r) => {
      g.rect(-w / 2, -h / 2, w, h).fill({ color: col, alpha: 0.3 });
      hatchRect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r, col, 8, 2.4, 0.85);
      const long = h >= w, L = long ? h : w;
      for (let s = -L / 2 + 22; s < L / 2 - 10; s += 30) jpath(g, long ? [-w / 2, s, w / 2, s] : [s, -h / 2, s, h / 2], r, 0.6, 8);
      stroke(g, ink, 2.2, 0.7);
      jrect(g, -w / 2, -h / 2, w, h, r, ink, 3);
    }, sd));
  }
  if (b.bl) {
    // blinking: a hand-drawn dashed ghost outline stays while the wall/laser is switched off
    const ghost = dashedRect(w, h, b.kind === 'laser' ? 0xff2442 : ink, 0.6, sd + 7);
    (c       ).solid = c.children.slice();
    c.addChildAt(ghost, 0);
  }
  return c;
}

function circView(o      )                        {
  const c = new PIXI.Container();
  c.position.set(o.x * C, o.y * C);
  const ink = th.ink;
  const sd = o.id * 17 + cur * 7;
  if (o.kind === 'balloon') {
    const col = [0xe84a5f, 0xffb400, 0x3bb4e5, 0x8f5bd6][o.id % 4];
    const strLen = o.crate !== undefined ? 1.35 * C - 24 : 34;
    c.addChild(new Boil((g, r) => {
      const pts           = [];
      for (let i = 0; i <= 12; i++) pts.push(Math.sin(i * 1.3) * 3 + J2(r), 26 + (i / 12) * strLen);
      jpath(g, pts, r, 0.6, 8); stroke(g, ink, 1.6);
      g.ellipse(0, 0, 21, 25).fill(col);
      hatchCircle(g, 0, 0, 21, r, 0xffffff, 7, 2, 0.35);
      jpath(g, [-5, 30, 0, 24, 5, 30], r, 0.5, 6, true); stroke(g, ink, 2.4);
      const e           = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2.05; e.push(Math.cos(a) * 21, Math.sin(a) * 25); }
      jpath(g, e, r, 1, 10); stroke(g, ink, 2.8);
      g.moveTo(-12, -12).quadraticCurveTo(-10, -18, -4, -20).stroke({ color: 0xffffff, width: 3.5, cap: 'round', alpha: 0.9 });
    }, sd));
    return c;
  }
  if (o.kind === 'bomb') {
    c.addChild(new Boil((g, r) => {
      g.circle(0, 0, 22).fill(0x2a2a30);
      hatchCircle(g, 0, 0, 21, r, 0x55556a, 5, 2, 0.8);
      jcircle(g, 0, 0, 22, r, 0x111111, 3, 0.8);
      g.rect(8, -24, 10, 8).fill(0x444444);
      jpath(g, [13, -24, 16, -32, 23, -34, 26, -40], r, 0.8, 5); stroke(g, 0x8a6a48, 2.6);
      g.moveTo(-11, -9).quadraticCurveTo(-8, -15, -2, -16).stroke({ color: 0xffffff, width: 3, alpha: 0.7, cap: 'round' });
      // spark
      const sx = 26, sy = -41;
      for (let i = 0; i < 6; i++) { const a = r() * 6.28; const l = 5 + r() * 6; g.moveTo(sx, sy).lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); }
      g.stroke({ color: 0xffb400, width: 2.4, cap: 'round' });
      g.circle(sx, sy, 3).fill(0xe84a5f);
    }, sd));
    return c;
  }
  if (o.kind === 'magnet') {
    const ring = dashedRing(MAG_R * C, 0xe84a5f, 0.5, sd + 5);
    c.addChild(ring);
    (c       ).ring = ring;
    c.addChild(new Boil((g, r) => {
      const arc = (col        , wd        , a0        , a1        ) => { const pts           = []; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * (i / 10); pts.push(Math.cos(a) * 13, 2 + Math.sin(a) * 13); } jpath(g, pts, r, 0.5, 6); stroke(g, col, wd); };
      arc(ink, 16, 0, Math.PI);
      jpath(g, [-13, 2, -13, -16], r, 0.4); jpath(g, [13, 2, 13, -16], r, 0.4); stroke(g, ink, 16);
      arc(0xbbbbbb, 10, 0, Math.PI);
      jpath(g, [-13, 3, -13, -6], r, 0.3); jpath(g, [13, 3, 13, -6], r, 0.3); stroke(g, 0xbbbbbb, 10);
      jpath(g, [-13, -7, -13, -16], r, 0.3); stroke(g, 0xe84a5f, 10);
      jpath(g, [13, -7, 13, -16], r, 0.3); stroke(g, 0x3b6fd8, 10);
    }, sd));
    return c;
  }
  if (o.kind === 'bumper') {
    const inner = new PIXI.Container();
    inner.addChild(new Boil((g, r) => {
      g.circle(0, 0, 24).fill(0xffd166);
      hatchCircle(g, 0, 0, 23, r, 0xf08a24, 6, 2, 0.7);
      jcircle(g, 0, 0, 24, r, ink, 3.2, 0.8);
      g.circle(0, 0, 11).fill(0xe84a5f); jcircle(g, 0, 0, 11, r, ink, 2.4, 0.6);
      g.circle(-3, -3, 3).fill(0xffffff);
    }, sd));
    c.addChild(inner);
    (c       ).inner = inner;
    return c;
  }
  if (o.kind === 'paint') {
    const col = PAINT_COLS[o.a || 0];
    const inner = new PIXI.Container();
    inner.addChild(new Boil((g, r) => {
      // a paint splat: wobbly blob with drips and a highlight
      const pts           = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, q = 21 + (i % 3 === 0 ? 6 : 0) + (r() - 0.5) * 4; pts.push(Math.cos(a) * q, Math.sin(a) * q); }
      g.poly(pts).fill(col);
      jpath(g, pts, r, 1, 8, true); stroke(g, ink, 2.8);
      g.circle(-6, -7, 4.5).fill({ color: 0xffffff, alpha: 0.75 });
      g.circle(15, 22, 3.5).fill(col); g.circle(-19, 18, 2.5).fill(col);
    }, sd));
    c.addChild(inner);
    (c       ).pulse = inner; (c       ).pulseK = 0.6;
    return c;
  }
  if (o.kind === 'vortex') {
    c.addChild(dashedRing(o.pr  * C, 0x2fb39a, 0.5, sd + 5));
    const swirl = new PIXI.Container();
    const dir = o.a || 1;
    swirl.addChild(new Boil((g, r) => {
      const R0 = o.pr  * C * 0.8;
      for (let k = 0; k < 3; k++) {
        const pts           = [];
        for (let i = 0; i <= 18; i++) { const t = i / 18, a = k * 2.09 - dir * t * 5, rr = R0 * (1 - t * 0.8); pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
        jpath(g, pts, r, 1, 8);
      }
      stroke(g, 0x2fb39a, 3.2);
      for (let k = 0; k < 3; k++) { const a = k * 2.09, x = Math.cos(a) * R0, y = Math.sin(a) * R0, tx = Math.sin(a) * dir, ty = -Math.cos(a) * dir; jpath(g, [x + tx * 10 - Math.cos(a) * 6, y + ty * 10 - Math.sin(a) * 6, x, y, x + tx * 10 + Math.cos(a) * 6, y + ty * 10 + Math.sin(a) * 6], r, 0.5, 6); }
      stroke(g, 0x1f8a76, 3);
      g.circle(0, 0, 5).fill(0x1f8a76);
    }, sd));
    c.addChild(swirl);
    (c       ).swirl = swirl; (c       ).swirlDir = -dir * 2.6;
    return c;
  }
  if (o.kind === 'hole' || o.kind === 'white') {
    const hole = o.kind === 'hole';
    const R0 = o.pr  * C;
    const ring = dashedRing(R0, hole ? 0x5b3fa0 : 0xf0a020, 0.5, sd + 5);
    c.addChild(ring);
    const swirl = new PIXI.Container();
    swirl.addChild(new Boil((g, r) => {
      if (hole) {
        g.circle(0, 0, 34).fill({ color: 0x5b3fa0, alpha: 0.22 });
        for (let k = 0; k < 3; k++) { const pts           = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = k * 2.09 + t * 4.2, rr = 32 - t * 24; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); } jpath(g, pts, r, 0.8, 8); }
        stroke(g, 0x8f5bd6, 3);
        g.circle(0, 0, 13).fill(0x0d0d14); jcircle(g, 0, 0, 13, r, 0x0d0d14, 3, 1);
      } else {
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + J2(r) * 0.1; jpath(g, [Math.cos(a) * 25, Math.sin(a) * 25, Math.cos(a) * 37, Math.sin(a) * 37], r, 0.6, 8); }
        stroke(g, 0xf0a020, 3);
        g.circle(0, 0, 20).fill(0xfff6d6); hatchCircle(g, 0, 0, 19, r, 0xffd166, 6, 2, 0.8); jcircle(g, 0, 0, 20, r, ink, 3, 1);
      }
    }, sd));
    c.addChild(swirl);
    (c       ).swirl = swirl; (c       ).swirlDir = hole ? -2.4 : 0.8;
    return c;
  }
  if (o.kind === 'ring') {
    const boost = o.k  > 1, col = boost ? 0xf08a24 : 0x3b9ad9;
    const inner = new PIXI.Container();
    inner.addChild(new Boil((g, r) => {
      jcircle(g, 0, 0, 30, r, col, 7, 1.6); jcircle(g, 0, 0, 30, r, ink, 2, 1.6);
      const s = boost ? 1 : -1;
      if (o.a !== undefined) {
        // directional boost ring: a fat arrow shows exactly where it kicks the ball
        const ra = (o.a * Math.PI) / 180, ca = Math.cos(ra), sa = Math.sin(ra);
        const P = (x        , y        ) => [x * ca - y * sa, x * sa + y * ca];
        g.circle(0, 0, 26).fill({ color: 0xffe2b8, alpha: 0.55 });
        jpath(g, [...P(-15, 0), ...P(13, 0)], r, 0.6, 8); jpath(g, [...P(2, -11), ...P(15, 0), ...P(2, 11)], r, 0.6, 8);
        stroke(g, col, 5);
        jpath(g, [...P(-15, 0), ...P(13, 0)], r, 0.6, 8); jpath(g, [...P(2, -11), ...P(15, 0), ...P(2, 11)], r, 0.6, 8);
        stroke(g, ink, 1.6, 0.8);
      } else {
        for (const dx of [-7, 5]) jpath(g, [dx - 5 * s, -9, dx + 5 * s, 0, dx - 5 * s, 9], r, 0.6, 6);
        stroke(g, col, 3.4);
      }
    }, sd));
    c.addChild(inner);
    (c       ).pulse = inner; (c       ).pulseK = boost ? 1 : 0.5;
    return c;
  }
  if (o.kind === 'arrow') {
    c.addChild(new Boil((g, r) => {
      g.circle(0, 0, 28).fill(0xfff1c4); jcircle(g, 0, 0, 28, r, ink, 3, 1.2);
      const a = (o.a  * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const P = (x        , y        ) => [x * ca - y * sa, x * sa + y * ca];
      jpath(g, [...P(-16, 0), ...P(14, 0)], r, 0.6, 8); jpath(g, [...P(4, -10), ...P(15, 0), ...P(4, 10)], r, 0.6, 8);
      stroke(g, 0xe8322a, 4.4);
    }, sd));
    return c;
  }
  if (o.kind === 'flip') {
    const inner = new PIXI.Container();
    inner.addChild(new Boil((g, r) => {
      g.circle(0, 0, 26).fill(0xd9c3ff); hatchCircle(g, 0, 0, 25, r, 0x8f5bd6, 6, 2, 0.6); jcircle(g, 0, 0, 26, r, ink, 3, 1.2);
      jpath(g, [-7, 12, -7, -12], r, 0.5); jpath(g, [-13, -5, -7, -13, -1, -5], r, 0.5);
      jpath(g, [7, -12, 7, 12], r, 0.5); jpath(g, [1, 5, 7, 13, 13, 5], r, 0.5);
      stroke(g, 0x3a1f70, 3.2);
    }, sd));
    c.addChild(inner);
    (c       ).pulse = inner; (c       ).pulseK = 0.7;
    return c;
  }
  if (o.kind === 'pend') {
    c.position.set(o.px  * C, o.py  * C);
    const rope = new PIXI.Graphics();
    c.addChild(rope);
    c.addChild(new Boil((g, r) => { g.circle(0, 0, 8).fill(0x6b7280); jcircle(g, 0, 0, 8, r, ink, 2.4, 0.5); }, sd + 2));
    const bob = new PIXI.Container();
    bob.addChild(new Boil((g, r) => {
      g.circle(0, 0, 28).fill(0x4a4f5c); hatchCircle(g, 0, 0, 27, r, 0x2d3140, 6, 2, 0.8); jcircle(g, 0, 0, 28, r, ink, 3.2, 1);
      jpath(g, [-12, -10, -9, -18, -1, -20], r, 0.4, 6); stroke(g, 0xffffff, 3, 0.6);
    }, sd));
    c.addChild(bob);
    (c       ).rope = rope; (c       ).bob = bob;
    return c;
  }
  if (o.kind === 'bubble') {
    c.addChild(new Boil((g, r) => {
      g.circle(0, 0, 24).fill({ color: 0xbfe9ff, alpha: 0.35 });
      jcircle(g, 0, 0, 24, r, 0x3aa6d9, 2.6, 1);
      g.moveTo(-14, -6).quadraticCurveTo(-12, -14, -4, -16).stroke({ color: 0xffffff, width: 3.5, cap: 'round' });
      g.circle(10, 10, 2.5).fill({ color: 0xffffff, alpha: 0.9 });
    }, sd));
    return c;
  }
  return null;
}
function cannonView(cn        )                 {
  const c = new PIXI.Container();
  c.position.set(cn.x * C, cn.y * C);
  const ink = th.ink;
  const barrel = new PIXI.Container();
  barrel.rotation = (cn.ang * Math.PI) / 180;
  barrel.addChild(new Boil((g, r) => {
    g.roundRect(-18, -17, 62, 34, 8).fill(0x4a5568);
    hatchRect(g, -16, -15, 58, 30, r, 0x2d3748, 6, 2, 0.7);
    jrect(g, -18, -17, 62, 34, r, ink, 3.2);
    g.rect(40, -20, 8, 40).fill(0xe84a5f); jrect(g, 40, -20, 8, 40, r, ink, 2.6, 0.6);
  }, cn.id * 11 + 3));
  c.addChild(barrel);
  c.addChild(new Boil((g, r) => {
    g.circle(0, 0, 20).fill(0xd9a066); jcircle(g, 0, 0, 20, r, ink, 3, 0.8);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; jpath(g, [0, 0, Math.cos(a) * 18, Math.sin(a) * 18], r, 0.5, 8); }
    stroke(g, 0x6b4220, 2.2);
    g.circle(0, 0, 5).fill(ink);
  }, cn.id * 11 + 4));
  (c       ).barrel = barrel;
  return c;
}
function J2(r   ) { return (r() - 0.5) * 2; }

function zoneView(z      )                 {
  const c = new PIXI.Container();
  c.position.set(z.cx * C, z.cy * C);
  c.rotation = Math.atan2(z.sin, z.cos);
  const w = z.hw * 2 * C, h = z.hh * 2 * C;
  if (z.kind === 'vac') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, 16).fill(0x14161c);
      hatchRect(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, r, 0x3a3f52, 5, 2.4, 0.9);
      jpath(g, [-w / 2 + 10, -h / 2, w / 2 - 10, -h / 2, w / 2, -h / 2 + 10, w / 2, h / 2 - 10, w / 2 - 10, h / 2, -w / 2 + 10, h / 2, -w / 2, h / 2 - 10, -w / 2, -h / 2 + 10], r, 1.6, 20, true);
      stroke(g, th.kind === 'dark' ? 0xf4f1e8 : 0x14161c, 3.5);
    }, z.id * 3 + 5));
    const stars = new PIXI.Container();
    const rr = mulberry(z.id + 9);
    const n = Math.max(3, Math.round((w * h) / 9000));
    for (let i = 0; i < n; i++) {
      const s = new PIXI.Graphics();
      const col = i % 3 ? 0xffffff : 0xffd166;
      s.moveTo(-6, 0).lineTo(6, 0).moveTo(0, -6).lineTo(0, 6).stroke({ color: col, width: 2.2, cap: 'round' });
      s.moveTo(-3, -3).lineTo(3, 3).moveTo(3, -3).lineTo(-3, 3).stroke({ color: col, width: 1.4, cap: 'round' });
      s.position.set((rr() - 0.5) * (w - 24), (rr() - 0.5) * (h - 24));
      (s       ).ph = rr() * 6;
      stars.addChild(s);
    }
    c.addChild(stars);
    (c       ).stars = stars;
  } else if (z.kind === 'water') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: 0x7ad3ff, alpha: 0.42 });
      hatchRect(g, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, r, 0x3aa6d9, 9, 2, 0.35);
      jrect(g, -w / 2, -h / 2, w, h, r, 0x2a86b8, 2.6, 1.2);
    }, z.id * 3 + 5));
    const waves = new PIXI.Graphics();
    c.addChild(waves);
    (c       ).waves = waves; (c       ).ww = w; (c       ).wh = h;
  } else if (z.kind === 'anti') {
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: 0xc9a2ff, alpha: 0.28 });
      const edges = [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
      for (const [x1, y1, x2, y2] of edges) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d < len; d += 16) { const e = Math.min(len, d + 9); jpath(g, [x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len], r, 0.8, 20); }
      }
      stroke(g, 0x8f5bd6, 2.8);
    }, z.id * 3 + 5));
    const ups = new PIXI.Graphics();
    c.addChild(ups);
    (c       ).ups = ups; (c       ).ww = w; (c       ).wh = h;
  } else if (z.kind === 'gz') {
    const m = z.m || 1, moon = m < 0.6, heavy = m > 1.5;
    const col = moon ? 0xf2d16b : heavy ? 0x4a4f5c : 0x2fb39a, edge = moon ? 0xc9a227 : heavy ? 0x2d3140 : 0x1f8a76;
    c.addChild(new Boil((g, r) => {
      g.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: col, alpha: moon ? 0.22 : heavy ? 0.22 : 0.16 });
      if (moon) for (let i = 0; i < 6; i++) jcircle(g, J2(r) * (w / 2 - 20), J2(r) * (h / 2 - 20), 5 + r() * 7, r, 0xd9b44a, 2, 0.6);
      if (heavy) hatchRect(g, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, r, 0x4a4f5c, 10, 2, 0.3);
      const edges = [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
      for (const [x1, y1, x2, y2] of edges) { const len = Math.hypot(x2 - x1, y2 - y1); for (let d = 0; d < len; d += 16) { const e = Math.min(len, d + 9); jpath(g, [x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, x1 + (x2 - x1) * e / len, y1 + (y2 - y1) * e / len], r, 0.8, 20); } }
      stroke(g, edge, 2.8);
    }, z.id * 3 + 5));
    const arrows = new PIXI.Graphics();
    c.addChild(arrows);
    (c       ).gzArrows = arrows; (c       ).ww = w; (c       ).wh = h; (c       ).ga = ((z.ga ?? 90) * Math.PI) / 180; (c       ).gm = m; (c       ).gcol = edge;
  }
  return c;
}

// a warp pair: two matching "paper tear" planes in the same colour; crossing one puts the ball at the twin with its velocity untouched
function warpView(wp      )                 {
  const c = new PIXI.Container();
  const col = [0x14b8a6, 0xe84a9a, 0x3b6fd8][wp.id % 3];
  const L = wp.len * C, ink = th.ink;
  for (const [x, y, k] of [[wp.ax, wp.ay, 0], [wp.bx, wp.by, 1]]) {
    const p = new PIXI.Container();
    p.position.set(x * C, y * C);
    p.rotation = (wp.ang * Math.PI) / 180;
    p.addChild(new Boil((g, r) => {
      g.roundRect(-L / 2, -8, L, 16, 8).fill({ color: col, alpha: 0.2 });
      const pts           = []; for (let s = -L / 2; s <= L / 2 + 0.1; s += 10) pts.push(s, Math.sin(s * 0.25 + k) * 3 + J2(r) * 0.8);
      jpath(g, pts, r, 0.4, 10); stroke(g, col, 5);
      jpath(g, pts, r, 0.4, 10); stroke(g, 0xffffff, 1.6, 0.9);
      for (const s of [-1, 1]) jpath(g, [s * L / 2, -12, s * L / 2, 12], r, 0.6, 8);
      stroke(g, ink, 3.2);
      jcircle(g, 0, 0, 6, r, col, 2.6, 0.5);
    }, wp.id * 7 + k + 900));
    c.addChild(p);
  }
  return c;
}

function portalView(p        )                 {
  const c = new PIXI.Container();
  c.position.set(p.x * C, p.y * C);
  const col = p.c ? 0xf08a24 : 0x9b59d0;
  const spin = new PIXI.Container();
  spin.addChild(new Boil((g, r) => {
    g.circle(0, 0, 26).fill({ color: col, alpha: 0.18 });
    const pts           = [];
    for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 4.2; const rr = 2 + a * 1.75; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
    jpath(g, pts, r, 0.8, 6); stroke(g, col, 3.4);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.moveTo(Math.cos(a) * 27, Math.sin(a) * 27).lineTo(Math.cos(a + 0.2) * 27, Math.sin(a + 0.2) * 27); }
    g.stroke({ color: th.ink, width: 2.4, cap: 'round' });
  }, p.id * 5 + 3));
  c.addChild(spin);
  (c       ).spin = spin;
  const arr = new PIXI.Graphics();
  const a = (p.ang * Math.PI) / 180;
  const ax = Math.cos(a), ay = Math.sin(a);
  const tipx = ax * 42, tipy = ay * 42;
  arr.moveTo(ax * 30, ay * 30).lineTo(tipx, tipy)
    .moveTo(tipx - ax * 8 - ay * 6, tipy - ay * 8 + ax * 6).lineTo(tipx, tipy).lineTo(tipx - ax * 8 + ay * 6, tipy - ay * 8 - ax * 6)
    .stroke({ color: col, width: 3.4, cap: 'round', join: 'round' });
  c.addChild(arr);
  return c;
}

function hoopViews() {
  const back = new PIXI.Container();
  const front = new PIXI.Container();
  const rx = RIM_HALF * C + 5, ry = 7;
  const hb = lv.hb === undefined ? lv.f : lv.hb;
  back.addChild(new Boil((g, r) => {
    const pts           = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push(Math.cos(a) * rx, Math.sin(a) * ry); }
    jpath(g, pts, r, 0.6, 8); stroke(g, 0xb82020, 5);
  }, 77 + cur));
  const net = new PIXI.Graphics();
  front.addChild(net);
  front.addChild(new Boil((g, r) => {
    if (hb) { jpath(g, [hb * rx, -1, hb * (RIM_HALF + 0.14) * C, -5], r, 0.6); stroke(g, 0x777777, 4); }
    const pts           = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push(Math.cos(a) * rx, Math.sin(a) * ry); }
    jpath(g, pts, r, 0.6, 8); stroke(g, th.ink, 8); jpath(g, pts, r, 0.4, 8); stroke(g, 0xe8322a, 5);
  }, 78 + cur));
  return { back, front, net };
}
// ── verlet rope net (visual only; world px coords) ──
;                                                                                                     
let netN            = [];
let netL                             = [];
const NC = 7, NR = 6;
function initNet(hx        , hy        ) {
  netN = []; netL = [];
  const top = RIM_HALF * C - 2, bot = 20, HH = 52;
  for (let j = 0; j < NR; j++) {
    const k = j / (NR - 1), half = top + (bot - top) * k, y = 4 + HH * k;
    for (let i = 0; i < NC; i++) {
      const x = -half + (2 * half * i) / (NC - 1) + (j % 2 ? half / (NC - 1) * 0 : 0);
      netN.push({ x: hx + x, y: hy + y, px: hx + x, py: hy + y, pin: j === 0, ox: x, oy: y });
    }
  }
  const id = (i        , j        ) => j * NC + i;
  const link = (a        , b        ) => netL.push([a, b, Math.hypot(netN[a].x - netN[b].x, netN[a].y - netN[b].y)]);
  for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC - 1; i++) { link(id(i, j), id(i + 1, j + 1)); link(id(i + 1, j), id(i, j + 1)); }
  for (let i = 0; i < NC - 1; i++) link(id(i, NR - 1), id(i + 1, NR - 1));
  for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC; i++) link(id(i, j), id(i, j + 1));
}
function kickNet(x        , y        , s        ) {
  for (const n of netN) if (!n.pin) { const d = Math.hypot(n.x - x, n.y - y); if (d < 70) { n.px -= (Math.random() - 0.5) * s; n.py -= Math.random() * s * 0.6; } }
}
// net gravity follows the level gravity (gravity-flip orbs make it float up); eased so it swings over
let netGrav = 1, netGravTarget = 1;
function stepNet(dt        , hx        , hy        , ball                                 ) {
  const h = dt / 2;
  netGrav += (netGravTarget - netGrav) * Math.min(1, dt * 5);
  for (let sub = 0; sub < 2; sub++) {
    for (const n of netN) {
      if (n.pin) { n.x = n.px = hx + n.ox; n.y = n.py = hy + n.oy; continue; }
      const vx = (n.x - n.px) * 0.975, vy = (n.y - n.py) * 0.975;
      n.px = n.x; n.py = n.y;
      n.x += vx; n.y += vy + 1400 * h * h * netGrav;
      // soft pull toward rest shape (mirrored upward when gravity is flipped) so the net never tangles
      n.x += (hx + n.ox - n.x) * 0.012; n.y += (hy + n.oy * Math.sign(netGrav || 1) - n.y) * 0.006 * Math.abs(netGrav);
    }
    for (let it = 0; it < 6; it++) {
      for (const [a, b, rest] of netL) {
        const A = netN[a], B = netN[b];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-4;
        let diff = (d - rest) / d;
        if (diff < 0) diff *= 0.25; // ropes go slack under compression
        const wa = A.pin ? 0 : B.pin ? 1 : 0.5, wb = B.pin ? 0 : A.pin ? 1 : 0.5;
        A.x += dx * diff * wa; A.y += dy * diff * wa;
        B.x -= dx * diff * wb; B.y -= dy * diff * wb;
      }
      if (ball) {
        const [bx, by, br] = ball;
        for (const n of netN) {
          if (n.pin) continue;
          const dx = n.x - bx, dy = n.y - by, d = Math.hypot(dx, dy);
          if (d < br && d > 1e-4) { n.x = bx + (dx / d) * br; n.y = by + (dy / d) * br; }
        }
      }
    }
  }
}
function drawNet(g               , hx        , hy        ) {
  g.clear();
  if (!netN.length) return;
  const ink = th.ink;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC - 1; i++) {
      const a = netN[j * NC + i], b = netN[(j + 1) * NC + i + 1], c = netN[j * NC + i + 1], d = netN[(j + 1) * NC + i];
      g.moveTo(a.x - hx, a.y - hy).lineTo(b.x - hx, b.y - hy);
      g.moveTo(c.x - hx, c.y - hy).lineTo(d.x - hx, d.y - hy);
    }
    const last = (NR - 1) * NC;
    g.moveTo(netN[last].x - hx, netN[last].y - hy);
    for (let i = 1; i < NC; i++) g.lineTo(netN[last + i].x - hx, netN[last + i].y - hy);
    g.stroke(pass === 0 ? { color: th.kind === 'dark' || th.kind === 'blueprint' ? 0x1d2b4f : 0xffffff, width: 5, alpha: 0.9, cap: 'round' } : { color: ink, width: 2, cap: 'round' });
  }
}

// ── hand-drawn boiling stars ──
const wobblers                                                   = [];
function makeStar(rr        , filled         , seed        , ink = 0x1f2a44, emptyCol = 0x9aa3b5) {
  const c = new PIXI.Container();
  c.addChild(new Boil((g, r) => {
    const pts           = [];
    const rot = (r() - 0.5) * 0.12;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
      const q = (i % 2 ? rr * 0.47 : rr) * (1 + (r() - 0.5) * 0.08);
      pts.push(Math.cos(a) * q, Math.sin(a) * q);
    }
    if (filled) {
      g.poly(pts).fill(0xffc53d);
      // crayon scribble inside
      const s           = [];
      for (let k = 0; k < 7; k++) { const a = r() * 6.28, q = rr * (0.15 + r() * 0.3); s.push(Math.cos(a) * q, Math.sin(a) * q); }
      jpath(g, s, r, rr * 0.05, 10); stroke(g, 0xf08a24, Math.max(2, rr * 0.12), 0.55);
      g.moveTo(-rr * 0.35, -rr * 0.2).quadraticCurveTo(-rr * 0.3, -rr * 0.45, -rr * 0.1, -rr * 0.5).stroke({ color: 0xffffff, width: Math.max(2, rr * 0.1), alpha: 0.8, cap: 'round' });
      jpath(g, pts, r, Math.max(0.8, rr * 0.05), Math.max(6, rr * 0.5), true); stroke(g, ink, Math.max(2.2, rr * 0.1));
    } else {
      g.poly(pts).fill({ color: 0xffffff, alpha: 0.35 });
      jpath(g, pts, r, Math.max(0.8, rr * 0.05), Math.max(6, rr * 0.5), true); stroke(g, emptyCol, Math.max(2, rr * 0.08));
    }
  }, seed));
  if (filled) wobblers.push({ c, ph: seed * 1.7, amp: 1 });
  return c;
}
function tickWobblers() {
  for (let i = wobblers.length - 1; i >= 0; i--) {
    const w = wobblers[i];
    if (w.c.destroyed) { wobblers.splice(i, 1); continue; }
    w.c.rotation = Math.sin(time * 3 + w.ph) * 0.1 * w.amp;
    const s = 1 + Math.sin(time * 5 + w.ph) * 0.05 * w.amp;
    w.c.children[0]?.scale.set(s);
  }
}

// ───────────────────────── level build ─────────────────────────
function clearScene() {
  fx.clear();
  closeLeaderboard();
  sceneLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  hudLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  overlayLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  fxLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  parts = []; tweens = []; timers = [];
  titleTick = null;
  boxViews.clear(); circViews.clear();
  ballView = null; blob = null; hoopBack = hoopFront = null; netG = null; aimG = barG = dynG = beltG = null; hudShots = null; hudStars = null;
}

function buildLevel() {
  // (re)build only the level layer; HUD stays
  if (levelLayer.parent) { levelLayer.parent.removeChild(levelLayer); }
  levelLayer.destroy({ children: true });
  levelLayer = new PIXI.Container();
  sceneLayer.addChildAt(levelLayer, 0);
  boxViews.clear(); circViews.clear(); zoneViews = []; cannonViews = []; starViews = [];
  sim = new Sim(lv);
  const under = new PIXI.Graphics();
  levelLayer.addChild(under);
  // moving wall tracks
  for (const b of sim.boxes) if (b.m && b.kind !== 'board') {
    const x1 = b.bx * C, y1 = b.by * C, x2 = (b.bx + b.m[0]) * C, y2 = (b.by + b.m[1]) * C;
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += 14) under.circle(x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, 2.4);
    under.fill({ color: th.soft, alpha: 0.8 });
  }
  if (lv.hm) {
    const x1 = lv.h[0] * C, y1 = lv.h[1] * C, x2 = (lv.h[0] + lv.hm[0]) * C, y2 = (lv.h[1] + lv.hm[1]) * C;
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += 14) under.circle(x1 + (x2 - x1) * d / len, y1 + (y2 - y1) * d / len, 2.4);
    under.fill({ color: 0xe84a5f, alpha: 0.6 });
  }
  for (const z of sim.zones) if (z.kind !== 'fan') { const v = zoneView(z); zoneViews.push(v); levelLayer.addChild(v); }
  dynG = new PIXI.Graphics();
  levelLayer.addChild(dynG);
  beltG = new PIXI.Graphics();
  for (const p of sim.portals) levelLayer.addChild(portalView(p));
  for (const wp of sim.warps) levelLayer.addChild(warpView(wp));
  const hv = hoopViews();
  hoopBack = hv.back; hoopFront = hv.front; netG = hv.net;
  levelLayer.addChild(hoopBack);
  for (const b of sim.boxes) { const v = boxView(b); boxViews.set(b.id, v); levelLayer.addChild(v); }
  levelLayer.addChild(beltG); // direction arrows must sit on top of the belt body
  for (const o of sim.circs) { const v = circView(o); if (v) { circViews.set(o.id, v); levelLayer.addChild(v); } }
  cannonViews = sim.cannons.map(cn => { const v = cannonView(cn); levelLayer.addChild(v); return v; });
  // trajectory stars (hand-drawn, boiling, bobbing)
  starViews = sim.stars.map((s, k) => {
    const v = new PIXI.Container();
    const glow = new Boil((g, r) => { jcircle(g, 0, 0, 27, r, 0xffd166, 3, 2.2); }, 1300 + cur * 7 + k);
    glow.alpha = 0.6;
    v.addChild(glow, makeStar(19, true, 1200 + cur * 7 + k, th.kind === 'dark' || th.kind === 'blueprint' ? 0x1f2a44 : th.ink));
    v.position.set(s.x * C, s.y * C);
    levelLayer.addChild(v);
    return v;
  });
  refreshStarHud();
  // blob
  const broot = new PIXI.Container();
  broot.position.set(lv.p[0] * C, lv.p[1] * C);
  broot.scale.x = lv.f;
  const body = new PIXI.Container();
  body.addChild(new Boil((g, r) => drawBlobBody(g, r, th.kind === 'dark' || th.kind === 'blueprint' ? 0x1f2a44 : th.ink), 555));
  const face = new PIXI.Graphics();
  body.addChild(face);
  broot.addChild(body);
  levelLayer.addChild(broot);
  blob = { root: broot, body, face, mood: '' };
  koSim = null; koStars = null; koSpin = 0; koDone = false;
  setMood('happy');
  barG = new PIXI.Graphics(); levelLayer.addChild(barG);
  aimG = new PIXI.Graphics(); levelLayer.addChild(aimG);
  ballView = new PIXI.Container();
  ballView.addChild(new Boil((g, r) => drawBall(g, r, th.kind === 'dark' || th.kind === 'blueprint' ? 0x0d1a3a : th.ink), 99));
  bubbleOnBall = new Boil((g, r) => {
    g.circle(0, 0, 26).fill({ color: 0xbfe9ff, alpha: 0.35 });
    jcircle(g, 0, 0, 26, r, 0x3aa6d9, 2.6, 1);
    jpath(g, [-15, -6, -12, -14, -4, -18], r, 0.6, 6); stroke(g, 0xffffff, 3.5);
  }, 98);
  bubbleOnBall.visible = false;
  // paint coat: a colour splotch drawn over the ball once it rolls through a paint blob
  paintOnBall = new PIXI.Graphics();
  paintOnBall.visible = false;
  ballView.addChild(paintOnBall);
  paintCoat = -1;
  ballView.addChild(bubbleOnBall);
  levelLayer.addChild(ballView);
  levelLayer.addChild(hoopFront);
  const [lx, ly] = launchPoint(lv);
  ballView.position.set(lx * C, ly * C);
  ballView.alpha = 0;
  tween(0.25, k => { if (ballView) { ballView.alpha = k; ballView.scale.set(0.5 + 0.5 * easeBack(k)); } });
  initNet(sim.hoop.x * C, sim.hoop.y * C);
  phase = 'aim'; power = 0; acc = 0; flyT = 0; endT = 0;
  syncViews();
}

function startLevel(i        , fresh = true, intro = true) {
  cur = Math.max(0, Math.min(NLEVELS - 1, i));
  lv = LEVELS[cur];
  th = THEMES[worldOf(cur)];
  clearScene();
  scene = 'play';
  setPaper(th, worldOf(cur) === 0);
  if (fresh) shots = 0;
  levelLayer = new PIXI.Container();
  // input catcher
  const catcher = new PIXI.Graphics();
  catcher.rect(-2000, -2000, 5280, 4720).fill({ color: 0xffffff, alpha: 0.001 });
  catcher.eventMode = 'static';
  catcher.on('pointerdown', () => beginCharge());
  sceneLayer.addChild(catcher);
  buildLevel();
  buildHud();
  const w = worldOf(cur);
  // every time the player enters a notebook's first level, show its intro card (not on restart/replay)
  if (cur % 5 === 0 && intro) showTutorial(w);
}

/**
 * 进一关。**收费点就在这**（原版所有入口最后都落到 `startLevel`）。
 *
 * | 入口 | 收不收 | 为什么 |
 * | --- | --- | --- |
 * | 标题页「开始 / 继续」 | 收 | 新的一关 |
 * | 选关页点某一关 | 收 | 新的一关 |
 * | 结算页「下一关」 | 收 | 新的一关 |
 * | 结算页「重玩」/ HUD 重试 / 按 R | **不收** | 同一关，已经付过 |
 *
 * ★ 不能把收费写进 `startLevel` 本身：重试和重玩走的也是它，那样每按一次重试都扣 10。
 */
function enterLevel(i, intro = true) {
  const go = () => startLevel(i, true, intro);
  if (typeof chargePlay !== 'function') { go(); return; }
  // 扣分是宿主事务（异步）。余额不够时 chargePlay 自己弹 toast 并返回 false ⇒ 不进关。
  Promise.resolve(chargePlay()).then((ok) => { if (ok) go(); }).catch((e) => console.error('[hoopsneak] 开局扣分失败', e));
}

function buildHud() {
  hudLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  const ink = th.ink;
  const w = worldOf(cur);
  const title = txt(t('world', { n: w + 1 }), 40, ink, { fontWeight: 'bold', letterSpacing: 2 });
  title.position.set(W / 2, 40);
  hudLayer.addChild(title);
  const dots = new PIXI.Container();
  for (let k = 0; k < 5; k++) {
    const idx = w * 5 + k;
    const done = save.stars[idx] > 0;
    dots.addChild(new Boil((g, r) => {
      if (done) g.circle(0, 0, 11).fill(ink);
      jcircle(g, 0, 0, 12, r, ink, 3, 0.8);
      if (idx === cur) jcircle(g, 0, 0, 18, r, th.hatch, 2.5, 1.2);
    }, 300 + k));
    dots.children[k].position.set((k - 2) * 38, 0);
  }
  dots.position.set(W / 2, 88);
  hudLayer.addChild(dots);
  hudShots = txt(t('shots', { n: shots }), 30, ink);
  hudShots.anchor.set(0, 0.5);
  hudShots.position.set(110, 42);
  hudLayer.addChild(hudShots);
  hudStars = new PIXI.Container();
  hudStars.position.set(128, 84);
  hudLayer.addChild(hudStars);
  refreshStarHud();
  const icons                           = [
    ['restart', () => { if (phase === 'tutorial') return; stopChargeSfx(); startLevel(cur, true, false); }],
    [save.sound ? 'sound' : 'mute', () => { toggleSound(); buildHud(); }],
    ['grid', () => { stopChargeSfx(); showLevels(worldOf(cur)); }],
    ['home', () => { stopChargeSfx(); showTitle(); }],
  ];
  icons.forEach(([k, f], n) => {
    const b = iconButton(k, f, ink); b.position.set(W - 250 + n * 66, 44); hudLayer.addChild(b);
    if (k === 'restart') restartBtn = b;
  });
}
function updateShotsHud() { if (hudShots) hudShots.text = t('shots', { n: shots }); }

function toggleSound() {
  save.sound = !save.sound;
  if (sound) {
    sound.settings.setMuted(!save.sound);
    if (save.sound && audioUnlocked) void sound.setMusicState('main', { eventId: 'toggle' + sfxN++ });
  }
  persist();
}

// ───────────────────────── play loop ─────────────────────────
function beginCharge() {
  if (scene !== 'play' || phase !== 'aim') return;
  phase = 'charge';
  chargeT = 0; power = 0;
  setMood('focus');
  startChargeSfx();
}
function release() {
  if (phase !== 'charge') return;
  stopChargeSfx();
  sim.launch(power);
  shots++;
  updateShotsHud();
  phase = 'fly';
  flyT = 0; acc = 0;
  sfx('sfx.throw');
  setMood('happy');
  if (blob) {
    const body = blob.body;
    tween(0.3, k => { const e = easeOut(k); body.scale.set(1 - 0.15 * Math.sin(e * Math.PI), 1 + 0.25 * Math.sin(e * Math.PI)); }, () => body.scale.set(1));
  }
  if (aimG) aimG.clear();
}
winOn('pointerup', () => release());
winOn('pointercancel', () => release());
winOn('keydown', (e) => {
  if (leaderboardOpen()) { if (e.code === 'Escape') closeLeaderboard(); return; }
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (scene === 'play') {
      if (phase === 'tutorial') { closeOverlay(); return; }
      beginCharge();
    }
  } else if (e.code === 'KeyR' && scene === 'play') { stopChargeSfx(); startLevel(cur, true, false); }
  else if (e.code === 'Escape' && scene === 'play') { stopChargeSfx(); showLevels(worldOf(cur)); }
});
winOn('keyup', (e) => { if (e.code === 'Space') release(); });

function handleEvents() {
  for (const ev of sim.events) {
    const x = ev.x * C, y = ev.y * C;
    switch (ev.type) {
      case 'bounce':
        { const bk = ev.id !== undefined ? sim.boxes.find(q => q.id === ev.id)?.kind : undefined;
          if (bk === 'sponge') { if (time - lastBounceSfx > 0.06) { lastBounceSfx = time; sfx('sfx.sponge'); } }
          else if (bk === 'ice') { if (time - lastBounceSfx > 0.06 && (ev.s || 0) > 2.5) { lastBounceSfx = time; sfx('sfx.ice'); sfx('sfx.bounce', Math.min(4, (ev.s || 0) / 5) - 1); } }
          else if (time - lastBounceSfx > 0.06 && (ev.s || 0) > 2.5) { lastBounceSfx = time; sfx('sfx.bounce', Math.min(4, (ev.s || 0) / 5) - 2); } }
        if ((ev.s || 0) > 6) puff(x, y, 3, th.soft, 80);
        if (Math.hypot(ev.x - sim.hoop.x, ev.y - sim.hoop.y) < 1.6) kickNet(x, y + 10, Math.min(8, (ev.s || 0) * 0.6));
        break;
      case 'spring': {
        sfx('sfx.spring');
        const v = boxViews.get(ev.id );
        const inner = v && (v       ).inner                  ;
        if (inner) tween(0.35, k => { inner.scale.y = k < 0.25 ? 1 - k * 2 : 0.5 + 0.9 * easeBack((k - 0.25) / 0.75) * 0.555; }, () => inner.scale.y = 1);
        break;
      }
      case 'pop': {
        sfx('sfx.pop', (Math.random() - 0.5) * 3);
        const v = circViews.get(ev.id );
        if (v) v.visible = false;
        burst(x, y, 10, [0xe84a5f, 0xffb400, 0xffffff], 220, 300, 12);
        break;
      }
      case 'bomb': {
        sfx('sfx.bomb');
        const v = circViews.get(ev.id );
        if (v) v.visible = false;
        puff(x, y, 12, 0x555555, 260);
        burst(x, y, 16, [0xffb400, 0xe84a5f, 0xf08a24], 380, 400, 14);
        shake = 12;
        break;
      }
      case 'crate': {
        const v = boxViews.get(ev.id );
        if (v) { const vv = v; tween(0.25, k => { vv.alpha = 1 - k; vv.scale.set(1 + 0.3 * k); }, () => { vv.visible = false; }); }
        burst(x, y, 12, [0xe0874f, 0xb5552f, 0x8a6a48], 300, 600, 12);
        break;
      }
      case 'eaten':
        sfx('sfx.slurp');
        burst(x, y, 16, [0x8f5bd6, 0x0d0d14, 0xffffff], 180, -120, 9);
        if (ballView) { const bv = ballView; tween(0.35, k => { if (!bv.destroyed) { bv.scale.set(Math.max(0.01, 1 - k)); bv.rotation = k * 8; } }); }
        break;
      case 'warp':
        sfx('sfx.warp');
        burst(x, y, 8, [0x14b8a6, 0xffffff], 140, 0, 8);
        burst(ev.x2  * C, ev.y2  * C, 8, [0x14b8a6, 0xffffff], 140, 0, 8);
        break;
      case 'ring': {
        const boost = (sim.circs.find(q => q.id === ev.id)?.k || 1) > 1;
        sfx(boost ? 'sfx.boost' : 'sfx.slow');
        burst(x, y, 10, boost ? [0xf08a24, 0xffd166] : [0x3b9ad9, 0xbfe9ff], boost ? 260 : 120, 0, 8);
        const v = circViews.get(ev.id ); const inner = v && (v       ).pulse                  ;
        if (inner) tween(0.3, k => { if (!inner.destroyed) inner.scale.set(1 + 0.4 * Math.sin(k * Math.PI)); });
        break;
      }
      case 'arrow':
        sfx('sfx.arrow');
        burst(x, y, 8, [0xe8322a, 0xfff1c4], 160, 0, 8);
        break;
      case 'flip':
        sfx('sfx.flip');
        burst(x, y, 14, [0x8f5bd6, 0xd9c3ff, 0xffffff], 240, 0, 9);
        shake = Math.max(shake, 5);
        break;
      case 'zap':
        sfx('sfx.zap');
        burst(x, y, 14, [0xff2442, 0xffd166, 0xffffff], 260, 0, 8);
        shake = Math.max(shake, 6);
        break;
      case 'glue':
        sfx('sfx.glue');
        burst(x, y, 7, [0x8fdc5a, 0x4f9a2e], 90, 200, 8);
        break;
      case 'crumble': {
        sfx('sfx.crumble');
        const v = boxViews.get(ev.id );
        if (v) { const vv = v; tween(0.22, k => { vv.alpha = 1 - k; vv.scale.set(1 + 0.25 * k); }, () => { vv.visible = false; }); }
        burst(x, y, 16, [0xd8c3a5, 0xa58b68, 0x6b4f2e], 240, 700, 10);
        shake = Math.max(shake, 4);
        break;
      }
      case 'hit': {
        sfx('sfx.clank', (Math.random() - 0.5) * 2);
        const b = sim.boxes.find(q => q.id === ev.id), v = boxViews.get(ev.id );
        if (b && v) {
          const tx = (v       ).hpText                         ; if (tx) tx.text = String(b.hp);
          const cr = (v       ).cracks                              ;
          if (cr) { const n = ((b.hp0 || 2) - (b.hp || 0)) * 3; cr.removeChildren().forEach(ch => ch.destroy({ children: true })); cr.addChild(crackDoodle(b.hw * 2 * C, b.hh * 2 * C, n, b.id * 17 + n)); }
          const v0 = v; tween(0.2, k => { if (!v0.destroyed) v0.scale.set(1 + 0.05 * Math.sin(k * Math.PI)); });
        }
        burst(x, y, 6, [0xb8bcc6, 0x6b7280], 160, 400, 7);
        break;
      }
      case 'paint': {
        sfx('sfx.splash', 4);
        const col = PAINT_COLS[ev.s || 0];
        burst(x, y, 14, [col, col, 0xffffff], 220, 300, 9);
        if (ballView) { const bv = ballView; tween(0.25, k => { if (!bv.destroyed) bv.scale.set(1 + 0.3 * Math.sin(k * Math.PI)); }); }
        break;
      }
      case 'white':
        if (time - lastBounceSfx > 0.06) { lastBounceSfx = time; sfx('sfx.repel'); }
        burst(x, y, 6, [0xffd166, 0xffffff], 160, 0, 7);
        break;
      case 'portal':
        sfx('sfx.portal');
        burst(x, y, 8, [0x9b59d0, 0xf08a24, 0xffffff], 150, 0, 10);
        burst(ev.x2  * C, ev.y2  * C, 8, [0x9b59d0, 0xf08a24, 0xffffff], 150, 0, 10);
        break;
      case 'glass':
        sfx('sfx.glass', (Math.random() - 0.5) * 2);
        burst(x, y, 18, [0xbdefff, 0xffffff, 0x3aa6c9], 320, 700, 10);
        shake = Math.max(shake, 5);
        break;
      case 'button': {
        sfx('sfx.button');
        const v = boxViews.get(ev.id );
        const cap = v && (v       ).cap                  ;
        if (cap) tween(0.15, k => { cap.y = 8 * k; cap.scale.y = 1 - 0.4 * k; });
        burst(x, y - 10, 8, [0xe84a5f, 0xffd166], 160, 200, 9);
        break;
      }
      case 'bumper': {
        if (time - lastBounceSfx > 0.05) { lastBounceSfx = time; sfx('sfx.bumper', (Math.random() - 0.5) * 2); }
        const v = circViews.get(ev.id );
        const inner = v && (v       ).inner                  ;
        if (inner) tween(0.3, k => inner.scale.set(1 + 0.35 * Math.sin(k * Math.PI)));
        else { const bv = boxViews.get(ev.id ); if (bv) { const b0 = bv; tween(0.25, k => b0.scale.set(1 + 0.08 * Math.sin(k * Math.PI), 1 - 0.12 * Math.sin(k * Math.PI))); } }
        burst(x, y, 6, [0xffd166, 0xff6fb5, 0xffffff], 180, 100, 8);
        break;
      }
      case 'load': {
        const cv = cannonViews[sim.cannons.findIndex(c => c.id === ev.id)];
        if (cv) tween(0.3, k => cv.scale.set(1 + 0.12 * Math.sin(k * Math.PI)));
        if (ballView) ballView.visible = false;
        break;
      }
      case 'cannon': {
        sfx('sfx.cannon');
        const cn = sim.cannons.find(c => c.id === ev.id);
        const cv = cannonViews[sim.cannons.findIndex(c => c.id === ev.id)];
        if (ballView) ballView.visible = true;
        if (cn) puff(x + cn.dx * 50, y + cn.dy * 50, 7, 0x999999, 160);
        if (cv) tween(0.25, k => cv.scale.set(1 + 0.25 * (1 - k)));
        shake = Math.max(shake, 6);
        break;
      }
      case 'splash':
        sfx('sfx.splash', (Math.random() - 0.5) * 2);
        burst(x, y, 10, [0x7ad3ff, 0x3aa6d9, 0xffffff], 200, 500, 8);
        break;
      case 'bubble': {
        sfx('sfx.pop', 5);
        const v = circViews.get(ev.id );
        if (v) v.visible = false;
        if (bubbleOnBall) { const bb = bubbleOnBall; bb.visible = true; tween(0.2, k => bb.scale.set(0.6 + 0.4 * easeBack(k))); }
        break;
      }
      case 'bubblepop':
        sfx('sfx.pop', 3);
        if (bubbleOnBall) bubbleOnBall.visible = false;
        burst(x, y, 10, [0xbfe9ff, 0xffffff, 0x3aa6d9], 200, 100, 8);
        break;
      case 'score':
        onScore();
        refreshStarHud();
        break;
      case 'star': {
        const v = starViews[(ev.id || 1000) - 1000];
        sfx('sfx.pop', 7 + ((ev.id || 1000) - 1000) * 2); // user prefers the balloon-pop for stars
        burst(x, y, 14, [0xffd166, 0xffffff, 0xf08a24], 260, 200, 10);
        if (v && !v.destroyed) { const vv = v; tween(0.3, k => { vv.scale.set(1 + 0.8 * k); vv.alpha = 1 - k; vv.rotation = k * 2; }, () => { vv.visible = false; }); }
        refreshStarHud();
        break;
      }
      case 'blobbump':
        if (blob && !koSim) {
          const body = blob.body, b0 = blob;
          sfx('sfx.bonk', 4);
          setMood('ouch');
          tween(0.3, k => { const q = Math.sin(k * Math.PI); body.scale.set(1 + 0.12 * q, 1 - 0.14 * q); });
          after(0.5, () => { if (blob === b0 && !koSim && phase === 'fly') setMood('happy'); });
        }
        break;
      case 'blobhit':
        knockBlob(ev.x2 || 0, ev.y2 || 0);
        break;
      case 'miss':
        onMiss();
        break;
    }
  }
}

function onScore() {
  phase = 'score';
  endT = 0;
  sfx('sfx.score');
  kickNet(sim.hoop.x * C, sim.hoop.y * C + 20, 5);
  const hx = sim.hoop.x * C, hy = sim.hoop.y * C;
  burst(hx, hy + 20, 26, CONFETTI, 360, 500, 14);
  stamp(t('nice'), W / 2, H / 2 - 40, 0xe8322a);
  setMood(koSim ? 'ko' : 'cheer');
  if (blob && !koSim) { const b = blob.body; tween(0.5, k => { b.y = -Math.sin(k * Math.PI) * 22; }, () => { b.y = 0; }); after(0.55, () => tween(0.4, k => { b.y = -Math.sin(k * Math.PI) * 14; })); }
  const stars = 1 + Math.min(2, sim.starsGot);
  const prevDone = save.stars[cur] > 0;
  keepBestStars(save.stars, cur, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(NLEVELS - 1, cur + 1));
  persist();
  if (!prevDone) after(0.3, () => buildHud());
  after(1.5, () => showResult(stars));
}

function onMiss() {
  phase = 'miss';
  sfx('sfx.miss');
  if (!koSim) setMood('sad');
  const bv = ballView;
  if (bv) {
    const x0 = bv.x, y0 = bv.y;
    tween(0.45, k => { bv.alpha = 1 - k; bv.x = x0 + Math.sin(k * 30) * 6 * (1 - k); bv.scale.set(1 - 0.4 * k); });
    puff(Math.max(20, Math.min(W - 20, x0)), Math.max(20, Math.min(H - 20, y0)), 5, th.soft, 60);
  }
  if (!koSim) after(0.6, () => { if (scene === 'play' && phase === 'miss') buildLevel(); });
}

function syncViews() {
  if (paintOnBall && !paintOnBall.destroyed && sim.ballCol !== paintCoat) {
    paintCoat = sim.ballCol;
    paintOnBall.clear();
    if (paintCoat >= 0) {
      const col = PAINT_COLS[paintCoat];
      paintOnBall.circle(0, 0, BALL_R * C - 1).fill({ color: col, alpha: 0.55 });
      paintOnBall.circle(-5, -6, 4).fill({ color: 0xffffff, alpha: 0.5 });
      paintOnBall.circle(0, 0, BALL_R * C).stroke({ color: col, width: 3 });
    }
    paintOnBall.visible = paintCoat >= 0;
  }
  for (const b of sim.boxes) {
    const v = boxViews.get(b.id);
    if (!v) continue;
    if (b.kind === 'gate') v.alpha = b.col === sim.ballCol ? 0.3 : 1;
    if (b.m || b.kind === 'crate') v.position.set(b.cx * C, b.cy * C);
    if (b.rot) v.rotation = (b.ang * Math.PI) / 180;
    if (!b.alive && v.visible && b.kind !== 'brick' && b.kind !== 'crate' && b.kind !== 'door') v.visible = false;
    if (b.bl) { const on = sim.blinkOn(b); for (const ch of ((v       ).solid                    ) || []) ch.alpha = on ? 1 : 0.12; }
  }
  for (const o of sim.circs) {
    const v = circViews.get(o.id);
    if (!v) continue;
    if (o.kind === 'pend') {
      const bx = (o.x - o.px ) * C, by = (o.y - o.py ) * C;
      ((v       ).bob                  ).position.set(bx, by);
      ((v       ).rope                 ).clear().moveTo(0, 0).quadraticCurveTo(bx * 0.5 + 2, by * 0.5, bx, by).stroke({ color: th.ink, width: 3, cap: 'round' });
    }
    if ((v       ).swirl) (v       ).swirl.rotation = time * (v       ).swirlDir;
    if ((v       ).pulse) (v       ).pulse.scale.set(1 + Math.sin(time * 5 * (v       ).pulseK) * 0.06);
    if (o.kind === 'flip' && !o.alive && v.visible) v.visible = false;
    if (v && o.kind === 'balloon' && o.alive) v.y = o.y * C + Math.sin(time * 2 + o.id) * 2.5;
    if (v && o.kind === 'bubble' && o.alive) v.y = o.y * C + Math.sin(time * 2.4 + o.id) * 3;
  }
  for (let k = 0; k < starViews.length; k++) {
    const sv = starViews[k], s = sim.stars[k];
    if (!sv || sv.destroyed || !s || s.got) continue;
    sv.y = s.y * C + Math.sin(time * 3 + k * 2) * 3;
    sv.rotation = Math.sin(time * 2 + k) * 0.18;
  }
  if (zoneViews.some(z => z.destroyed)) zoneViews = zoneViews.filter(z => !z.destroyed);
  for (const zv of zoneViews) {
    const wv = (zv       ).waves                             , uv = (zv       ).ups                             ;
    const w = (zv       ).ww          , h = (zv       ).wh          ;
    if (wv) {
      wv.clear();
      for (let row = 0; row < 3; row++) {
        const yy = -h / 2 + 10 + row * Math.max(18, (h - 20) / 3);
        for (let x = -w / 2 + 8; x < w / 2 - 8; x += 6) { const y2 = yy + Math.sin(x * 0.08 + time * 3 + row) * 3; if (x === -w / 2 + 8) wv.moveTo(x, y2); else wv.lineTo(x, y2); }
      }
      wv.stroke({ color: 0xffffff, width: 2.2, alpha: 0.8 });
    }
    if (uv) {
      uv.clear();
      const cols = Math.max(2, Math.floor(w / 46));
      for (let i = 0; i < cols; i++) {
        const x = -w / 2 + (i + 0.5) * (w / cols);
        const y = h / 2 - (((time * 50 + i * 37) % (h - 20)) + 10);
        uv.moveTo(x, y + 12).lineTo(x, y - 6).moveTo(x - 6, y).lineTo(x, y - 7).lineTo(x + 6, y);
      }
      uv.stroke({ color: 0x8f5bd6, width: 2.6, cap: 'round', join: 'round', alpha: 0.75 });
    }
    const gv = (zv       ).gzArrows                             ;
    if (gv) {
      // arrows drift in the zone's gravity direction; speed and weight follow its strength
      const a = (zv       ).ga          , m = (zv       ).gm          , dx = Math.cos(a), dy = Math.sin(a);
      gv.clear();
      const n = Math.max(2, Math.round((w * h) / 9000));
      for (let i = 0; i < n; i++) {
        const ph = ((time * (20 + 45 * m) + i * 71) % 120) / 120;
        const ox = (((i * 97) % 100) / 100 - 0.5) * (w - 50), oy = (((i * 53) % 100) / 100 - 0.5) * (h - 50);
        const x = ox + dx * (ph - 0.5) * 40, y = oy + dy * (ph - 0.5) * 40, L = 9 + 6 * Math.min(2, m);
        gv.moveTo(x - dx * L, y - dy * L).lineTo(x + dx * L, y + dy * L)
          .moveTo(x + dx * L - dx * 7 - dy * 6, y + dy * L - dy * 7 + dx * 6).lineTo(x + dx * L, y + dy * L).lineTo(x + dx * L - dx * 7 + dy * 6, y + dy * L - dy * 7 - dx * 6);
      }
      gv.stroke({ color: (zv       ).gcol, width: m > 1.5 ? 3.6 : 2.6, cap: 'round', join: 'round', alpha: 0.7 });
    }
  }
  const hx = sim.hoop.x * C, hy = sim.hoop.y * C;
  hoopBack?.position.set(hx, hy);
  hoopFront?.position.set(hx, hy);
  if (ballView && (phase === 'fly' || phase === 'score')) ballView.position.set(sim.bx * C, sim.by * C);
}

function drawAim() {
  if (!aimG || !barG) return;
  aimG.clear(); barG.clear();
  if (phase !== 'aim' && phase !== 'charge' && phase !== 'tutorial') return;
  const [lx, ly] = launchPoint(lv);
  const a = (lv.a * Math.PI) / 180;
  const dx = Math.cos(a) * lv.f, dy = -Math.sin(a);
  const x0 = lx * C + dx * 26, y0 = ly * C + dy * 26;
  const len = 34 + 110 * power;
  const r = mulberry(Math.floor(time * 8) % 3 + 11);
  const ink = th.ink;
  for (let d = 0; d < len - 8; d += 16) {
    const e = Math.min(len - 8, d + 9);
    aimG.moveTo(x0 + dx * d + J2(r), y0 + dy * d + J2(r)).lineTo(x0 + dx * e + J2(r), y0 + dy * e + J2(r));
  }
  const tx = x0 + dx * len, ty = y0 + dy * len;
  aimG.moveTo(tx - dx * 13 - dy * 8, ty - dy * 13 + dx * 8).lineTo(tx, ty).lineTo(tx - dx * 13 + dy * 8, ty - dy * 13 - dx * 8);
  aimG.stroke({ color: ink, width: 3.6, cap: 'round', join: 'round' });
  for (let k = 1; k <= 3; k++) aimG.circle(tx + dx * (12 + k * 16), ty + dy * (12 + k * 16), 3.4 - k * 0.6);
  aimG.fill({ color: ink, alpha: 0.7 });
  // power bar (behind the blob)
  const bx = lv.p[0] * C - lv.f * 46 - 8, by = lv.p[1] * C - 86, bw = 16, bh = 78;
  barG.roundRect(bx, by, bw, bh, 6).fill({ color: 0xffffff, alpha: 0.9 });
  const fh = bh * power;
  if (fh > 1) {
    const col = power < 0.5 ? 0x3fa34d : power < 0.8 ? 0xffb400 : 0xe8322a;
    barG.rect(bx + 2, by + bh - fh, bw - 4, fh).fill({ color: col, alpha: 0.35 });
    for (let yy = by + bh - 3; yy > by + bh - fh; yy -= 5) barG.moveTo(bx + 2, yy).lineTo(bx + bw - 2, yy - 6);
    barG.stroke({ color: col, width: 2.4, cap: 'round' });
  }
  jrect(barG, bx, by, bw, bh, r, ink, 2.8, 0.8);
  for (let k = 1; k < 4; k++) barG.moveTo(bx - 3, by + (bh * k) / 4).lineTo(bx + 4, by + (bh * k) / 4);
  barG.stroke({ color: ink, width: 2 });
}

function drawDyn() {
  if (!dynG) return;
  const g = dynG;
  g.clear();
  const ink = th.ink;
  // belts: moving chevrons, drawn on beltG which sits above the belt bodies
  if (beltG) {
    const bg = beltG;
    bg.clear();
    for (let pass = 0; pass < 2; pass++) {
      for (const b of sim.boxes) {
        if (b.kind !== 'belt' || !b.alive) continue;
        const w = b.hw * 2 * C;
        const off = ((time * 50 * b.dir ) % 24 + 24) % 24;
        const cx = b.cx * C, cy = b.cy * C, cs = b.cos, sn = b.sin;
        const d = b.dir ;
        const p = (lx        , ly        )                   => [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs];
        for (let s = -w / 2 + 16 + off; s < w / 2 - 16; s += 24) {
          const [a1, a2] = p(s - 5 * d, -6), [b1, b2] = p(s + 4 * d, 0), [c1, c2] = p(s - 5 * d, 6);
          bg.moveTo(a1, a2).lineTo(b1, b2).lineTo(c1, c2);
        }
      }
      bg.stroke(pass === 0
        ? { color: ink, width: 6, cap: 'round', join: 'round' }
        : { color: th.hatch2 === 0xffffff ? 0xffd166 : th.hatch, width: 3, cap: 'round', join: 'round' });
    }
  }
  // wind
  for (const z of sim.zones) {
    if (z.kind !== 'fan') continue;
    const L = z.hw * 2 * C, Wd = z.hh * 2 * C;
    const cx = z.cx * C, cy = z.cy * C;
    const n = Math.max(3, Math.round(Wd / 18));
    for (let i = 0; i < n; i++) {
      const ly = -Wd / 2 + (i + 0.5) * (Wd / n);
      const ph = ((time * 220 + i * 97) % (L + 60)) - 30;
      const s0 = Math.max(-L / 2, -L / 2 + ph - 30), s1 = Math.min(L / 2, -L / 2 + ph + 10);
      if (s1 <= s0) continue;
      const wig = Math.sin(time * 6 + i) * 3;
      const p = (lx        , lyy        )                   => [cx + lx * z.cos - lyy * z.sin, cy + lx * z.sin + lyy * z.cos];
      const [x1, y1] = p(s0, ly + wig), [x2, y2] = p((s0 + s1) / 2, ly - wig), [x3, y3] = p(s1, ly + wig);
      g.moveTo(x1, y1).quadraticCurveTo(x2, y2, x3, y3);
    }
    g.stroke({ color: 0x4ba3e3, width: 2.4, alpha: 0.55, cap: 'round' });
    // faint zone edge
    const corners = [[-L / 2, -Wd / 2], [L / 2, -Wd / 2], [L / 2, Wd / 2], [-L / 2, Wd / 2]].map(([lx, lyy]) => [cx + lx * z.cos - lyy * z.sin, cy + lx * z.sin + lyy * z.cos]);
    g.poly(corners.flat()).fill({ color: 0x9fd0ff, alpha: 0.12 });
  }
  void ink;
}

function animateObjects(dt        ) {
  for (const [, v] of boxViews) { const bl = (v       ).blades                             ; if (bl) bl.scale.y = Math.sin(time * 30); }
  for (const [, v] of circViews) { const ring = (v       ).ring                             ; if (ring) ring.rotation += dt * 0.3; }
  for (const c of levelLayer.children) {
    const sp = (c       ).spin                              ;
    if (sp) sp.rotation -= dt * 3;
    const st = (c       ).stars                              ;
    if (st) for (const s of st.children) { const ph = (s       ).ph; s.scale.set(0.6 + 0.4 * Math.abs(Math.sin(time * 2 + ph))); s.rotation = Math.sin(time + ph) * 0.4; }
  }
}

function tickPlay(dt        ) {
  if (phase === 'charge') {
    chargeT += dt;
    const k = (chargeT / 1.4) % 2;
    power = k < 1 ? k : 2 - k;
  }
  tickKo(dt);
  if (blob && !koSim) {
    const q = phase === 'charge' ? power : 0;
    if (phase === 'charge') { blob.body.scale.set(1 + 0.16 * q, 1 - 0.2 * q); blob.body.x = (Math.random() - 0.5) * 2.4 * q; }
    else if (phase === 'aim') { blob.body.scale.set(1 + Math.sin(time * 3) * 0.02, 1 - Math.sin(time * 3) * 0.02); blob.body.x = 0; }
  }
  if (ballView && (phase === 'aim' || phase === 'charge')) {
    const [lx, ly] = launchPoint(lv);
    const q = phase === 'charge' ? power : 0;
    ballView.position.set(lx * C - lv.f * 3 * q, ly * C + 9 * q + Math.sin(time * 3) * 1.5);
  }
  if (phase === 'fly' || phase === 'score') {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 10) {
      acc -= DT; n++;
      sim.step();
      handleEvents();
      if (phase !== 'fly' && phase !== 'score') break;
    }
    if (acc > DT * 4) acc = 0;
    flyT += dt;
    if (ballView) {
      ballRot += (sim.vx * dt) / BALL_R;
      ballView.rotation = ballRot;
    }
    if (phase === 'score') endT += dt;
  }
  // a shot that has been flying for over 5 s: the restart button hops up and down to hint at it
  if (restartBtn && !restartBtn.destroyed) {
    const nag = phase === 'fly' && flyT > 5;
    if (nag) {
      const k = (flyT - 5) * 2.2;
      restartBtn.y = 44 - Math.abs(Math.sin(k * Math.PI)) * 12;
      restartBtn.scale.set(1 + 0.12 * Math.abs(Math.sin(k * Math.PI)));
      restartNag = true;
    } else if (restartNag) {
      restartBtn.y = 44; restartBtn.scale.set(1); restartNag = false;
    }
  }
  const hx = sim.hoop.x * C, hy = sim.hoop.y * C;
  const ballOn = (phase === 'fly' || phase === 'score') && ballView && ballView.alpha > 0.5;
  netGravTarget = sim.gsign;
  stepNet(dt, hx, hy, ballOn ? [sim.bx * C, sim.by * C, BALL_R * C + 3] : null);
  if (netG) drawNet(netG, hx, hy);
  syncViews();
  drawAim();
  drawDyn();
  animateObjects(dt);
}

// ───────────────────────── overlays ─────────────────────────
function card(w        , h        , tilt = -0.02) {
  const c = new PIXI.Container();
  const dim = new PIXI.Graphics();
  dim.rect(-3000, -3000, 7000, 7000).fill({ color: 0x000000, alpha: 0.28 });
  dim.eventMode = 'static';
  overlayLayer.addChild(dim);
  c.addChild(new Boil((g, r) => {
    g.roundRect(-w / 2 + 8, -h / 2 + 10, w, h, 10).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(-w / 2, -h / 2, w, h, 10).fill(0xfffdf6);
    for (let y = -h / 2 + 50; y < h / 2 - 10; y += 30) g.moveTo(-w / 2 + 10, y).lineTo(w / 2 - 10, y);
    g.stroke({ color: 0xaac4e4, width: 1.4, alpha: 0.7 });
    jrect(g, -w / 2, -h / 2, w, h, r, 0x1f2a44, 3.4, 1.4);
    // tape
    g.rect(-50, -h / 2 - 16, 100, 30).fill({ color: 0xf5e6a8, alpha: 0.85 });
  }, seedCounter++));
  c.rotation = tilt;
  c.position.set(W / 2, H / 2);
  overlayLayer.addChild(c);
  tween(0.3, k => { const e = easeBack(k); c.scale.set(0.6 + 0.4 * e); c.alpha = Math.min(1, k * 2.5); });
  return { c, dim };
}
let overlayClose                      = null;
function closeOverlay() {
  const f = overlayClose; overlayClose = null;
  overlayLayer.removeChildren().forEach(c => c.destroy({ children: true }));
  if (f) f();
}

function elementIllustration(w        )                 {
  const c = new PIXI.Container();
  const ink = 0x1f2a44;
  const sd = 900 + w;
  if (w === 0) {
    c.addChild(new Boil((g, r) => { drawBlobBody(g, r, ink); }, sd));
    const f = new PIXI.Graphics(); drawFace(f, 'focus', ink); c.addChild(f);
    const hand = new Boil((g, r) => {
      jpath(g, [70, -40, 70, -10, 100, -10, 100, -40], r, 1); stroke(g, ink, 3);
      jcircle(g, 85, -60, 16, r, ink, 3); jpath(g, [85, -76, 85, -58], r, 0.5); stroke(g, ink, 2.5);
      for (const a of [-0.6, 0, 0.6]) { g.moveTo(85 + Math.sin(a) * 26, -60 - Math.cos(a) * 26).lineTo(85 + Math.sin(a) * 34, -60 - Math.cos(a) * 34); }
      g.stroke({ color: 0xe8322a, width: 3, cap: 'round' });
    }, sd + 1);
    c.addChild(hand);
    c.position.x = -30;
    return c;
  }
  const saveTh = th; th = { ...THEMES[0], ink };
  let v                        = null;
  const fake = (kind     , extra      = {}) => ({ id: 3, alive: true, vx: 0, vy: 0, ...extra, kind });
  if (w === 1) { const b = fake('spring', { cx: 0, cy: 0, hw: 0.65, hh: 0.25, ang: 0, cos: 1, sin: 0 }); v = boxView(b                  ); v.scale.set(2); v.position.set(0, 0); }
  else if (w === 2) { v = zoneView({ kind: 'vac', cx: 0, cy: 0, hw: 1.8, hh: 1.1, cos: 1, sin: 0, fx: 0, fy: 0, id: 1 }); }
  else if (w === 3) { v = circView(fake('balloon', { x: 0, y: -0.6, r: 0.6 })                   ); v .scale.set(1.6); }
  else if (w === 4) { v = circView(fake('bomb', { x: 0, y: 0, r: 0.55 })                   ); v .scale.set(1.8); }
  else if (w === 5) { v = circView(fake('magnet', { x: 0, y: 0, r: 0.55 })                   ); ((v       ).ring                 ).scale.set(0.3); v .scale.set(2); }
  else if (w === 6) { const b = fake('belt', { cx: 0, cy: 0, hw: 2, hh: 0.3, ang: 0, cos: 1, sin: 0, dir: 1 }); v = boxView(b                  ); const ar = new PIXI.Graphics(); for (let s = -50; s <= 50; s += 25) ar.moveTo(s - 4, -6).lineTo(s + 3, 0).lineTo(s - 4, 6); ar.stroke({ color: 0x4f9a3e, width: 3, cap: 'round' }); v.addChild(ar); v.scale.set(1.5); }
  else if (w === 7) { v = new PIXI.Container(); const a = portalView({ x: -1.6, y: 0, dx: 1, dy: 0, c: 0, id: 1, ang: 0 }); const b = portalView({ x: 1.6, y: 0, dx: 1, dy: 0, c: 0, id: 2, ang: -45 }); v.addChild(a, b); v.scale.set(1.3); }
  else if (w === 8) { const b = fake('fanbody', { cx: -1.5, cy: 0, hw: 0.35, hh: 0.75, ang: 0, cos: 1, sin: 0 }); v = new PIXI.Container(); v.addChild(boxView(b                  )); const wind = new PIXI.Graphics(); for (let i = -1; i <= 1; i++) wind.moveTo(-20, i * 18).quadraticCurveTo(20, i * 18 - 6, 70, i * 18); wind.stroke({ color: 0x4ba3e3, width: 3, cap: 'round' }); v.addChild(wind); v.scale.set(1.4); }
  else if (w === 9) { v = new PIXI.Container(); const b = fake('wall', { cx: 0, cy: 0, hw: 1.5, hh: 0.4, ang: 0, cos: 1, sin: 0 }); const wv = boxView(b                  ); v.addChild(wv); const arr = new PIXI.Graphics(); arr.moveTo(-80, 34).lineTo(80, 34).moveTo(66, 26).lineTo(80, 34).lineTo(66, 42).moveTo(-66, 26).lineTo(-80, 34).lineTo(-66, 42).stroke({ color: 0xe84a5f, width: 3, cap: 'round', join: 'round' }); v.addChild(arr); v.scale.set(1.2); }
  else if (w === 10) { v = boxView(fake('rubber', { cx: 0, cy: 0.4, hw: 1.8, hh: 0.3, ang: 0, cos: 1, sin: 0 })                  ); v.scale.set(1.3); }
  else if (w === 11 || w === 12) { v = zoneView({ kind: w === 11 ? 'water' : 'anti', cx: 0, cy: 0, hw: 1.8, hh: 1.1, cos: 1, sin: 0, fx: 0, fy: 0, id: 1 }); zoneViews.push(v); }
  else if (w === 13) { v = new PIXI.Container(); const bt = boxView(fake('button', { cx: -1.4, cy: 0.6, hw: 0.6, hh: 0.2, ang: 0, cos: 1, sin: 0 })                  ); const dv = boxView(fake('door', { cx: 1.2, cy: 0, hw: 0.3, hh: 1.2, ang: 0, cos: 1, sin: 0 })                  ); v.addChild(bt, dv); v.scale.set(1.4); }
  else if (w === 14) { v = circView(fake('bumper', { x: 0, y: 0, r: 0.55 })                   ); v .scale.set(2); }
  else if (w === 15) { v = cannonView({ x: 0, y: 0, dx: 1, dy: 0, v: 17, ang: -35, id: 1 }); v.scale.set(1.8); }
  else if (w === 16) { v = boxView(fake('glass', { cx: 0, cy: 0, hw: 0.2, hh: 1.4, ang: 0, cos: 1, sin: 0 })                  ); v.scale.set(1.3); }
  else if (w === 17) { v = boxView(fake('oneway', { cx: 0, cy: 0, hw: 2, hh: 0.25, ang: 0, cos: 1, sin: 0 })                  ); v.scale.set(1.4); }
  else if (w === 18) { v = boxView(fake('paddle', { cx: 0, cy: 0, hw: 1.8, hh: 0.3, ang: 20, cos: 1, sin: 0 })                  ); v.rotation = 0.35; v.scale.set(1.3); }
  else if (w === 19) { v = circView(fake('bubble', { x: 0, y: 0, r: 0.6 })                   ); v .scale.set(2.2); }
  else if (w >= 20) {
    // notebooks 21+: build the real views from a tiny one-gadget demo level
    const W1 = { x: -1.8, y: -0.3, w: 3.6, h: 0.6 };
    const demo                                                       = {
      hole: { o: [{ t: 'hole', x: 0, y: 0, r: 2 }], s: 1.5 }, warp: { o: [{ t: 'warp', x: -1.6, y: 0, x2: 1.6, y2: 0, len: 2.6, a: 90 }], s: 1.3 },
      ice: { w: [{ ...W1, ic: 1 }] }, boost: { o: [{ t: 'ring', x: 0, y: 0, k: 1.6, a: -45 }], s: 2 }, laser: { w: [{ x: -0.15, y: -1.5, w: 0.3, h: 3, lz: 1 }], s: 1.2 },
      glue: { w: [{ ...W1, gu: 1 }] }, crumble: { w: [{ ...W1, cr: 1 }] }, white: { o: [{ t: 'white', x: 0, y: 0, r: 2 }], s: 1.5 },
      gz: { o: [{ t: 'gz', x: -1.8, y: -1.2, w: 3.6, h: 2.4, a: 0, m: 1 }] }, blink: { w: [{ x: -0.4, y: -1.4, w: 0.8, h: 2.8, bl: [1.2, 0.5, 0] }], s: 1.2 },
      slow: { o: [{ t: 'ring', x: 0, y: 0, k: 0.5 }], s: 2 }, flip: { o: [{ t: 'flip', x: 0, y: 0 }], s: 2.2 }, sponge: { w: [{ ...W1, sg: 1 }] },
      pend: { o: [{ t: 'pend', x: 0, y: -1.6, len: 2.4, amp: 35, per: 2 }], s: 1.1 }, arrow: { o: [{ t: 'arrow', x: 0, y: 0, a: -35 }], s: 2.2 },
      blinklaser: { w: [{ x: -0.15, y: -1.5, w: 0.3, h: 3, lz: 1, bl: [1.2, 0.5, 0] }], s: 1.2 }, hp: { w: [{ x: -1.2, y: -0.6, w: 2.4, h: 1.2, hp: 3 }], s: 1.3 },
      moon: { o: [{ t: 'gz', x: -1.8, y: -1.2, w: 3.6, h: 2.4, a: 90, m: 0.3 }] },
      paint: { w: [{ x: 0.9, y: -1.5, w: 0.7, h: 3, cg: 0 }], o: [{ t: 'paint', x: -1.2, y: 0, c: 0 }], s: 1.5 },
      vortex: { o: [{ t: 'vortex', x: 0, y: 0, r: 2, d: -1 }], s: 1.5 },
      mix: { o: [{ t: 'hole', x: -1.8, y: 0, r: 1.2 }, { t: 'ring', x: 0.2, y: 0, k: 1.5 }, { t: 'flip', x: 2, y: 0 }], s: 1.3 },
    };
    const d = demo[WORLD_ELEMENT[w]] || demo.mix;
    const ds = new Sim({ a: 45, f: 1, p: [-90, -90], h: [-80, -80], hb: 0, w: d.w || [], o: d.o || [] }            );
    const box = new PIXI.Container();
    for (const z of ds.zones) { const zv = zoneView(z); zoneViews.push(zv); box.addChild(zv); }
    for (const wp of ds.warps) box.addChild(warpView(wp));
    for (const b of ds.boxes) box.addChild(boxView(b));
    for (const o of ds.circs) {
      if (o.kind === 'rim' || o.kind === 'blob') continue;
      const cv = circView(o); if (!cv) continue;
      if (o.kind === 'pend') { const bob = (cv       ).bob                  , rope = (cv       ).rope                 ; bob.position.set(34, o.len  * C - 8); rope.moveTo(0, 0).lineTo(34, o.len  * C - 8).stroke({ color: ink, width: 3 }); }
      if ((cv       ).swirl) (cv       ).swirl.rotation = 0.6;
      box.addChild(cv);
    }
    box.scale.set(d.s || 1.4);
    v = box;
  }
  th = saveTh;
  if (v) c.addChild(v);
  return c;
}

function showTutorial(w        ) {
  phase = 'tutorial';
  // mark as seen the moment it is shown, so leaving via any HUD button never re-triggers it
  if (!save.seen.includes(w)) { save.seen.push(w); persist(); }
  const { c, dim } = card(620, 440, -0.025);
  const head = txt(w === 0 ? t('holdTitle') : t('newEl', { e: elName(w) }), 40, 0x1f2a44, { fontWeight: 'bold' });
  fitText(head, 560);
  head.position.set(0, -160);
  c.addChild(head);
  const ill = elementIllustration(w);
  ill.position.set(0, -20);
  c.addChild(ill);
  const desc = txt(w === 0 ? t('holdDesc') : elDesc(w), 26, 0x1f2a44, { wordWrap: true, wordWrapWidth: 540, breakWords: true });
  desc.position.set(0, 110);
  fitText(desc, 560);
  c.addChild(desc);
  const tap = txt(t('tap') + (w === 0 ? '\n' + t('keysHint') : ''), 20, 0x7d8aa6);
  tap.position.set(0, 180);
  fitText(tap, 560);
  c.addChild(tap);
  const done = () => {
    if (!save.seen.includes(w)) { save.seen.push(w); persist(); }
    phase = 'aim';
  };
  overlayClose = done;
  dim.on('pointerdown', (e) => { e.stopPropagation(); closeOverlay(); });
  c.eventMode = 'static';
  c.on('pointerdown', (e) => { e.stopPropagation(); closeOverlay(); });
}

function showResult(stars        ) {
  if (scene !== 'play') return;
  phase = 'card';
  void syncStars(save.stars);
  const last = cur === NLEVELS - 1;
  const { c } = card(560, 420, 0.02);
  const head = txt(t('nice'), 60, 0xe8322a, { fontWeight: 'bold' });
  head.position.set(0, -140);
  c.addChild(head);
  const sg = new PIXI.Container();
  for (let k = 0; k < 3; k++) {
    const on = k < stars;
    const g = makeStar(k === 1 ? 46 : 36, on, 880 + k);
    g.position.set((k - 1) * 104, k === 1 ? -44 : -32);
    g.scale.set(0);
    sg.addChild(g);
    after(0.3 + k * 0.28, () => {
      if (g.destroyed) return;
      if (on) sfx('sfx.pop', 3 + k * 2);
      tween(0.45, q => { g.scale.set(easeBack(q)); g.rotation = (1 - easeOut(q)) * -2.2; });
      if (on) {
        const sp = new PIXI.Graphics();
        sp.position.copyFrom(g.position);
        sg.addChildAt(sp, 0);
        tween(0.55, q => {
          sp.clear();
          const r0 = 40 + q * 50, r1 = r0 + 18 * (1 - q);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; sp.moveTo(Math.cos(a) * r0, Math.sin(a) * r0).lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
          sp.stroke({ color: [0xffb400, 0xe84a5f, 0x3bb4e5][k], width: 4, alpha: 1 - q, cap: 'round' });
        }, () => sp.destroy());
      }
    });
  }
  c.addChild(sg);
  const sh = txt(t('starsGot', { n: Math.max(0, stars - 1) }), 28, 0x1f2a44);
  sh.position.set(0, 30);
  c.addChild(sh);
  const bRe = doodleButton(t('replay'), 150, 64, () => { closeOverlay(); startLevel(cur, true, false); }, 0xffffff, 0x1f2a44, 28);
  const bLv = doodleButton(t('levels'), 150, 64, () => { closeOverlay(); showLevels(worldOf(cur)); }, 0xffffff, 0x1f2a44, 28);
  const bNx = doodleButton(last ? t('levels') : t('next'), 170, 64, () => {
    closeOverlay();
    if (last) showAllClear(); else enterLevel(cur + 1);
  }, 0xffd166, 0x1f2a44, 30);
  bRe.position.set(-180, 164); bLv.position.set(0, 164); bNx.position.set(180, 164);
  c.addChild(bRe, bLv, bNx);
}

function showAllClear() {
  showLevels(WORLDS - 1);
  const { c, dim } = card(620, 360, -0.02);
  const h1 = txt(t('clearTitle'), 44, 0xe8322a, { fontWeight: 'bold' }); fitText(h1, 560); h1.position.set(0, -80); c.addChild(h1);
  const h2 = txt(t('clearDesc'), 28, 0x1f2a44); fitText(h2, 560); h2.position.set(0, 0); c.addChild(h2);
  const tp = txt(t('tap'), 20, 0x7d8aa6); tp.position.set(0, 120); c.addChild(tp);
  burst(W / 2, H / 2, 60, CONFETTI, 500, 500, 16);
  dim.on('pointerdown', () => closeOverlay());
  c.eventMode = 'static'; c.on('pointerdown', () => closeOverlay());
}

// ───────────────────────── title & level select ─────────────────────────
function firstUnbeaten() {
  for (let i = 0; i <= save.unlocked; i++) if (!save.stars[i]) return i;
  return Math.min(NLEVELS - 1, save.unlocked);
}

// ── title screen: the blob shoots forever at a hoop on the cover (cover-local px, stays inside the blue area) ──
let titleTick                                = null;
function setupTitleShooter(deco                , ink        ) {
  const L = -282, R = 322, T = -202, B = 204; // blue cover interior
  const HX = 222, HY = 92, RX = RIM_HALF * C, RR = 5; // rim
  const BR = BALL_R * C * 1.15; // ball radius on the cover
  const board = { x0: HX + RX + 8, x1: HX + RX + 17, y0: HY - 74, y1: HY + 12 };
  const SX = -150, SY = 120, ANG = (58 * Math.PI) / 180, GR = 1000;
  const dx0 = HX - SX, up0 = SY - HY;
  const V0 = Math.sqrt((GR * dx0 * dx0) / (2 * Math.cos(ANG) ** 2 * (dx0 * Math.tan(ANG) - up0)));
  // hoop back (rim back half + board), same look as the in-game hoop — no extra pole underneath
  const back = new Boil((g, r) => {
    g.rect(board.x0, board.y0, board.x1 - board.x0, board.y1 - board.y0).fill(0xffffff);
    jrect(g, board.x0, board.y0, board.x1 - board.x0, board.y1 - board.y0, r, ink, 2.6, 0.7);
    const pts           = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push(HX + Math.cos(a) * (RX + 5), HY + Math.sin(a) * 7); }
    jpath(g, pts, r, 0.6, 8); stroke(g, 0xb82020, 5);
  }, 1601);
  // blob
  const blobC = new PIXI.Container();
  const body = new PIXI.Container();
  body.addChild(new Boil((g, r) => drawBlobBody(g, r, ink), 12));
  const face = new PIXI.Graphics(); drawFace(face, 'happy', ink);
  body.addChild(face);
  blobC.addChild(body);
  blobC.position.set(-190, B - 2); blobC.scale.set(1.3);
  let mood = 'happy';
  const setFace = (m        ) => { if (m !== mood) { mood = m; drawFace(face, m, ink); } };
  // ball
  const ballC = new PIXI.Container();
  ballC.addChild(new Boil((g, r) => drawBall(g, r, ink), 13));
  ballC.scale.set(1.15);
  // net + front rim
  const netGr = new PIXI.Graphics();
  netGr.position.set(HX, HY); // drawNet draws relative to the rim centre
  const front = new Boil((g, r) => {
    jpath(g, [HX + RX + 5, HY - 1, board.x0, HY - 5], r, 0.6); stroke(g, 0x777777, 4);
    const pts           = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push(HX + Math.cos(a) * (RX + 5), HY + Math.sin(a) * 7); }
    jpath(g, pts, r, 0.6, 8); stroke(g, ink, 8); jpath(g, pts, r, 0.4, 8); stroke(g, 0xe8322a, 5);
  }, 1602);
  deco.addChild(back, blobC, ballC, netGr, front);
  initNet(HX, HY);
  // little hand-drawn power bar next to the blob: fills up to the randomly chosen power
  const PBX = -258, PBY = 100, PBW = 16, PBH = 96;
  const barFrame = new Boil((g, r) => { g.rect(PBX, PBY, PBW, PBH).fill({ color: 0xffffff, alpha: 0.85 }); jrect(g, PBX, PBY, PBW, PBH, r, ink, 2.6, 0.8); }, 1603);
  const barFill = new PIXI.Graphics();
  deco.addChild(barFrame, barFill);
  const F0 = 0.84, F1 = 1.14; // power band as a fraction of the clean-make speed
  let fPow = 1, chargeDur = 0.55;

  // shot state machine: charge → fly → fade → charge…
  let st                            = 'charge', t = 0, acc = 0;
  let bx = SX, by = SY, vx = 0, vy = 0, rest = 0, scored = false, flyT = 0, prevY = SY;
  const reset = () => {
    st = 'charge'; t = 0; bx = SX; by = SY; vx = vy = 0; rest = 0; scored = false; flyT = 0; ballC.alpha = 1; ballC.rotation = 0; setFace('focus');
    // random power each shot: about half land near a clean make, the rest anywhere in the band (short / long)
    fPow = Math.random() < 0.5 ? 0.97 + Math.random() * 0.06 : F0 + Math.random() * (F1 - F0);
    chargeDur = 0.3 + 0.7 * ((fPow - F0) / (F1 - F0));
  };
  reset();
  const hitCircle = (cx        , cy        , cr        , e        ) => {
    const ddx = bx - cx, ddy = by - cy, d = Math.hypot(ddx, ddy), rr = cr + BR;
    if (d >= rr || d < 1e-6) return false;
    const nx = ddx / d, ny = ddy / d;
    bx += nx * (rr - d); by += ny * (rr - d);
    const vn = vx * nx + vy * ny;
    if (vn < 0) { vx -= (1 + e) * vn * nx; vy -= (1 + e) * vn * ny; }
    return Math.abs(vn) > 120;
  };
  const step = (h        ) => {
    vy += GR * h; bx += vx * h; by += vy * h;
    // walls of the blue cover
    if (by > B - BR) { by = B - BR; if (vy > 0) vy = -vy * 0.45; vx *= 0.92; }
    if (by < T + BR) { by = T + BR; if (vy < 0) vy = -vy * 0.5; }
    if (bx < L + BR) { bx = L + BR; if (vx < 0) vx = -vx * 0.5; }
    if (bx > R - BR) { bx = R - BR; if (vx > 0) vx = -vx * 0.5; }
    // backboard (box)
    const qx = Math.max(board.x0, Math.min(board.x1, bx)), qy = Math.max(board.y0, Math.min(board.y1, by));
    if (Math.hypot(bx - qx, by - qy) < BR) { if (hitCircle(qx, qy, 0, 0.5)) kickNet(HX, HY + 20, 3); }
    // rim ends
    for (const sx of [-1, 1]) if (hitCircle(HX + sx * RX, HY, RR, 0.55)) kickNet(HX + sx * RX, HY + 10, 4);
    // score: passing down through the rim
    if (!scored && prevY < HY && by >= HY && Math.abs(bx - HX) < RX - RR && vy > 0) {
      scored = true; setFace('cheer'); kickNet(HX, HY + 20, 5);
    }
    prevY = by;
  };
  titleTick = (dt        ) => {
    t += dt;
    if (st === 'charge') {
      const q = Math.min(1, t / chargeDur);
      body.scale.set(1 + 0.14 * q, 1 - 0.18 * q); body.x = (Math.random() - 0.5) * 2 * q;
      bx = SX - 3 * q; by = SY + 8 * q;
      const fill = q * ((fPow - F0) / (F1 - F0));
      barFill.clear();
      if (fill > 0.01) barFill.rect(PBX + 3, PBY + PBH - 3 - (PBH - 6) * fill, PBW - 6, (PBH - 6) * fill).fill(fill > 0.75 ? 0xe8322a : fill > 0.4 ? 0xffc53d : 0x5fbf7a);
      if (t >= chargeDur) {
        // power band keeps the apex well below the cover top, and the cover edges bounce the ball back
        const v = V0 * fPow;
        vx = Math.cos(ANG) * v; vy = -Math.sin(ANG) * v;
        bx = SX; by = SY; prevY = by;
        st = 'fly'; t = 0; flyT = 0; setFace('happy');
        body.x = 0;
        tween(0.3, k => { if (!body.destroyed) { const s = Math.sin(k * Math.PI); body.scale.set(1 - 0.1 * s, 1 + 0.16 * s); } });
      }
    } else if (st === 'fly') {
      flyT += dt; acc += dt;
      while (acc >= 1 / 120) { acc -= 1 / 120; step(1 / 120); }
      ballC.rotation += (vx / (BR * 1.0)) * dt;
      rest = by >= B - BR - 0.5 && Math.hypot(vx, vy) < 90 ? rest + dt : 0;
      if (rest > 0.25 || flyT > 4 || (scored && flyT > 0.4 && by > HY + 60)) {
        if (!scored) setFace('sad');
        st = 'fade'; t = 0;
      }
    } else {
      acc += dt;
      while (acc >= 1 / 120) { acc -= 1 / 120; step(1 / 120); }
      ballC.alpha = Math.max(0, 1 - t / 0.3);
      if (t >= 0.75) reset();
    }
    ballC.position.set(bx, by);
    netGravTarget = 1;
    stepNet(dt, HX, HY, st !== 'charge' ? [bx, by, BR + 3] : null);
    drawNet(netGr, HX, HY);
  };
}

function showTitle() {
  clearScene();
  scene = 'title';
  th = THEMES[0];
  setPaper(THEMES[0], true);
  const ink = THEMES[0].ink;
  const layer = new PIXI.Container();
  sceneLayer.addChild(layer);
  // notebook cover
  const cover = new PIXI.Container();
  cover.addChild(new Boil((g, r) => {
    g.roundRect(-330 + 10, -210 + 12, 660, 420, 18).fill({ color: 0x000000, alpha: 0.15 });
    g.roundRect(-330, -210, 660, 420, 18).fill(0x3b6fd8);
    hatchRect(g, -320, -200, 640, 400, r, 0x2a55b0, 9, 2.6, 0.7);
    g.rect(-330, -210, 44, 420).fill(0x1f2a44);
    for (let y = -190; y < 200; y += 34) { jcircle(g, -308, y, 7, r, 0xdddddd, 3, 0.6); }
    jrect(g, -330, -210, 660, 420, r, ink, 4, 1.6);
    // label sticker
    g.roundRect(-230, -120, 480, 170, 14).fill(0xfffdf6);
    for (let y = -70; y < 40; y += 30) g.moveTo(-220, y).lineTo(240, y);
    g.stroke({ color: 0xaac4e4, width: 1.5 });
    jrect(g, -230, -120, 480, 170, r, ink, 3, 1.2);
  }, 4242));
  cover.rotation = -0.035;
  cover.position.set(W / 2, H / 2 - 50);
  layer.addChild(cover);
  const title = txt(t('title'), 58, ink, { fontWeight: 'bold', lineHeight: 60 });
  fitText(title, 440);
  if (title.height > 120) title.scale.set(Math.min(title.scale.x, 120 / (title.height / title.scale.y)));
  title.position.set(10, -58);
  cover.addChild(title);
  const subT = txt(t('sub'), 26, 0x3b6fd8);
  fitText(subT, 420);
  subT.position.set(10, 28);
  cover.addChild(subT);
  // doodles on the cover: the blob keeps shooting at a hoop (all inside the blue cover)
  const deco = new PIXI.Container();
  cover.addChild(deco);
  setupTitleShooter(deco, ink);
  // buttons
  const hasProgress = save.stars.some(s => s > 0);
  const startBtn = doodleButton(hasProgress ? t('cont') : t('start'), 250, 84, () => enterLevel(firstUnbeaten()), 0xffd166, ink, 44);
  startBtn.position.set(W / 2 - 280, H - 110);
  const lvBtn = doodleButton(t('levels'), 220, 84, () => showLevels(worldOf(firstUnbeaten())), 0xffffff, ink, 40);
  lvBtn.position.set(W / 2, H - 110);
  // 「星星排行榜」按钮删掉了（联网 + 要登录，插件里没有账号体系）
  startBtn.position.set(W / 2 - 140, H - 110);
  lvBtn.position.set(W / 2 + 150, H - 110);
  layer.addChild(startBtn, lvBtn);
  tween(0.8, k => { startBtn.rotation = Math.sin(k * Math.PI * 2) * 0.03; });
  // corner buttons: language + sound
  // 语言切换删掉了：这个 App 面向中文家庭，语言固定 zh（见 boot 里的 setLang('zh')）
  const snd = iconButton(save.sound ? 'sound' : 'mute', () => { toggleSound(); showTitle(); }, ink);
  snd.position.set(W - 60, 50);
  hudLayer.addChild(snd);
}

function cycleLang() {
  const i = LANGS.indexOf(getLang());
  const nl = LANGS[(i + 1) % LANGS.length];
  applyLang(nl);
  save.lang = nl; persist();
  refreshScene();
}
function refreshScene() {
  if (scene === 'title') showTitle();
  else if (scene === 'levels') showLevels(levelsWorld);
  else if (scene === 'play') { buildHud(); }
}

let levelsWorld = 0;
function showLevels(w        ) {
  clearScene();
  scene = 'levels';
  levelsWorld = w = Math.max(0, Math.min(WORLDS - 1, w));
  const tt = THEMES[w];
  th = tt;
  setPaper(tt, w === 0);
  const ink = tt.ink;
  const worldLocked = w * 5 > save.unlocked;
  const head = txt(t('world', { n: w + 1 }), 54, ink, { fontWeight: 'bold', letterSpacing: 2 });
  head.position.set(W / 2, 110);
  const sub = txt(worldLocked ? '？？？' : elName(w), 34, tt.hatch === 0xffffff ? ink : tt.hatch, { fontWeight: 'bold' });
  sub.position.set(W / 2, 172);
  hudLayer.addChild(head, sub);
  // underline scribble
  hudLayer.addChild(new Boil((g, r) => { jpath(g, [W / 2 - 130, 205, W / 2 + 130, 200], r, 2, 20); stroke(g, tt.hatch2, 4); }, 60 + w));
  for (let k = 0; k < 5; k++) {
    const idx = w * 5 + k;
    const locked = idx > save.unlocked;
    const c = new PIXI.Container();
    const st = save.stars[idx];
    c.addChild(new Boil((g, r) => {
      g.circle(4, 6, 62).fill({ color: 0x000000, alpha: 0.1 });
      g.circle(0, 0, 62).fill(locked ? (tt.kind === 'dark' || tt.kind === 'blueprint' ? 0x2c3d6a : 0xdddddd) : 0xfffdf6);
      if (!locked) hatchCircle(g, 0, 0, 58, r, st ? tt.hatch2 : tt.hatch, 9, 2.2, 0.35);
      else hatchCircle(g, 0, 0, 58, r, 0x888888, 5, 2, 0.5);
      jcircle(g, 0, 0, 62, r, (tt.kind === 'dark' || tt.kind === 'blueprint') ? 0x1f2a44 : ink, 3.4, 1.4);
      if (locked) { jrect(g, -16, -6, 32, 26, r, 0x1f2a44, 3.4, 0.8); const pts           = []; for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; pts.push(Math.cos(a) * 11, -6 + Math.sin(a) * 14); } jpath(g, pts, r, 0.5, 6); stroke(g, 0x1f2a44, 3.4); }
    }, 700 + idx));
    if (!locked) {
      const num = txt(String(k + 1), 56, 0x1f2a44, { fontWeight: 'bold' });
      num.position.set(0, -6);
      c.addChild(num);
      const sg = new PIXI.Container();
      const dk = (tt.kind === 'dark' || tt.kind === 'blueprint');
      for (let s = 0; s < 3; s++) { const sv = makeStar(15, s < st, 1000 + idx * 3 + s, dk ? 0xf4f1e8 : 0x1f2a44, dk ? 0x8a97bd : 0x9aa3b5); sv.position.set((s - 1) * 32, 92); sg.addChild(sv); }
      c.addChild(sg);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.hitArea = new PIXI.Circle(0, 0, 66);
      c.on('pointerdown', (e) => { e.stopPropagation(); c.scale.set(0.92); });
      c.on('pointerupoutside', () => { if (!c.destroyed) c.scale.set(1); });
      c.on('pointerup', (e) => { e.stopPropagation(); sfx('sfx.click'); enterLevel(idx); });
    }
    c.position.set(W / 2 + (k - 2) * 190, 370 + (k % 2 ? 20 : -10));
    sceneLayer.addChild(c);
  }
  if (worldLocked) {
    const lk = txt(t('locked'), 30, ink); lk.position.set(W / 2, 520); hudLayer.addChild(lk);
  }
  // page dots
  const dots = new PIXI.Graphics();
  const DSP = Math.min(26, 900 / WORLDS); // page dots shrink to fit 40 notebooks
  for (let i = 0; i < WORLDS; i++) { dots.circle(W / 2 + (i - (WORLDS - 1) / 2) * DSP, 620, i === w ? 7 : 4); }
  dots.fill({ color: ink, alpha: 0.35 });
  dots.circle(W / 2 + (w - (WORLDS - 1) / 2) * DSP, 620, 7).fill(ink);
  hudLayer.addChild(dots);
  if (w > 0) { const l = iconButton('left', () => showLevels(w - 1), ink); l.position.set(90, 380); l.scale.set(1.6); hudLayer.addChild(l); }
  if (w < WORLDS - 1) { const r = iconButton('right', () => showLevels(w + 1), ink); r.position.set(W - 90, 380); r.scale.set(1.6); hudLayer.addChild(r); }
  const home = iconButton('home', () => showTitle(), ink); home.position.set(70, 60); hudLayer.addChild(home);
  const snd = iconButton(save.sound ? 'sound' : 'mute', () => { toggleSound(); showLevels(w); }, ink); snd.position.set(W - 70, 60); hudLayer.addChild(snd);
  // swipe between pages
  const catcher = new PIXI.Graphics();
  catcher.rect(-2000, -2000, 5280, 4720).fill({ color: 0xffffff, alpha: 0.001 });
  catcher.eventMode = 'static';
  let sx = 0, down = false;
  catcher.on('pointerdown', (e) => { down = true; sx = e.global.x; });
  catcher.on('pointerup', (e) => { if (!down) return; down = false; const d = e.global.x - sx; if (d < -60 && w < WORLDS - 1) showLevels(w + 1); else if (d > 60 && w > 0) showLevels(w - 1); });
  sceneLayer.addChildAt(catcher, 0);
}

// ───────────────────────── language / fonts ─────────────────────────
function applyLang(l) {
  setLang(l);
  // 原版从 `https://static.makeplay.ai/fonts/v1/...` 拉字体（还要经过 gp.fonts），
  // 插件里是离线的 ⇒ 换成本地 woff2（随包发布，见 assets/fonts/）。
  // 原来那行 `document.title = TITLE` 删掉了：插件里 document 是宿主的，改了会改宿主标签页。
  const fam = 'SmileySans';
  const waitFace = () => (document.fonts?.load ? document.fonts.load(`32px "${fam}"`, t('start')).catch(() => {}) : Promise.resolve());
  try {
    const f = new FontFace(fam, `url("${AB}assets/fonts/SmileySans-Oblique.woff2")`);
    return f.load().then(async () => {
      document.fonts.add(f);
      FONT = `"${fam}", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", sans-serif`;
      await waitFace();
      refreshScene();
    }).catch(() => {});
  } catch { return Promise.resolve(); }
}

// ───────────────────────── main ticker ─────────────────────────
let boilClock = 0;
app.ticker.add((tk) => {
  const realDt = Math.min(0.05, tk.deltaMS / 1000);
  const dt = realDt * fx.update(realDt);
  time += dt;
  boilClock += dt;
  boilTick(Math.floor(boilClock * 8));
  tickWobblers();
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].f; timers.splice(i, 1); f(); } }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (!tw) continue;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.d);
    tw.f(k);
    if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.done?.(); }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    p.vy += p.grav * dt;
    p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.g.rotation += p.vr * dt;
    p.g.alpha = Math.max(0, 1 - p.life / p.max);
    if (p.life >= p.max) { p.g.destroy(); parts.splice(i, 1); }
  }
  if (scene === 'play' && !leaderboardOpen()) tickPlay(dt);
  if (scene === 'loading' && loadTick) loadTick(Math.min(dt, 1 / 30));
  if (scene === 'title' && titleTick) titleTick(Math.min(dt, 1 / 30));
  if (shake > 0.2) { root.position.set(offX + (Math.random() - 0.5) * shake * scaleS, offY + (Math.random() - 0.5) * shake * scaleS); shake *= Math.pow(0.02, dt); }
  else if (shake > 0) { shake = 0; root.position.set(offX, offY); }
});

// ───────────────────────── boot ─────────────────────────
// Own hand-drawn loading screen: notebook page, the blob dribbling a ball (moves every frame), and a crayon
// progress bar driven by real completed boot tasks (font face, sound system, player profile).
let loadTick                                = null;
function showLoading()                                                              {
  clearScene();
  scene = 'loading';
  setPaper(THEMES[0], true);
  const ink = 0x1f2a44;
  const title = txt(TITLE, 64, ink, { fontWeight: 'bold', stroke: { color: 0xfff6d6, width: 10 } });
  title.position.set(W / 2, 170); title.rotation = -0.03;
  fitText(title, 900);
  const under = new Boil((g, r) => { jpath(g, [W / 2 - 300, 214, W / 2 - 100, 220, W / 2 + 100, 212, W / 2 + 300, 218], r, 2, 30); stroke(g, 0xe8322a, 5); }, 4001);
  // blob + ball
  const bl = new PIXI.Container();
  const body = new PIXI.Container();
  body.addChild(new Boil((g, r) => drawBlobBody(g, r, ink), 4002));
  const face = new PIXI.Graphics(); drawFace(face, 'happy', ink); body.addChild(face);
  bl.addChild(body); bl.position.set(W / 2 - 40, 420); bl.scale.set(2);
  const ball = new Boil((g, r) => drawBall(g, r, ink), 4003);
  ball.scale.set(1.3);
  const shadow = new PIXI.Graphics();
  // crayon progress bar
  const BX = W / 2 - 260, BY = 500, BW = 520, BH = 34;
  const frame = new Boil((g, r) => { jrect(g, BX, BY, BW, BH, r, ink, 3.4, 1.6); }, 4004);
  const fill = new PIXI.Graphics();
  const pct = txt('0%', 26, ink, { fontWeight: 'bold' });
  pct.position.set(W / 2, BY + BH + 30);
  const cap = txt(t('loading'), 24, 0x7d8aa6);
  cap.position.set(W / 2, BY + BH + 64);
  hudLayer.addChild(under, title, shadow, bl, ball, fill, frame, pct, cap);
  let target = 0, shown = 0, clock = 0, mood = 'happy';
  let resolveDone                      = null;
  const done = new Promise      (res => { resolveDone = res; });
  loadTick = (dt) => {
    clock += dt;
    // dribble: ball bounces in front of the blob, blob squashes on each catch
    const per = 0.62, k = (clock % per) / per;
    const h = 4 * k * (1 - k);
    ball.position.set(W / 2 + 30, 428 - h * 95);
    ball.rotation += dt * 5;
    shadow.clear().ellipse(W / 2 + 30, 446, 18 - h * 8, 5).fill({ color: ink, alpha: 0.18 });
    const sq = Math.max(0, 1 - h * 4);
    body.scale.set(1 + 0.08 * sq, 1 - 0.1 * sq);
    bl.y = 420 - Math.max(0, Math.sin(clock * 5)) * 3;
    const m = shown > 0.98 ? 'cheer' : 'happy';
    if (m !== mood) { mood = m; drawFace(face, m, ink); }
    // bar eases toward the real progress, never past it
    shown += (target - shown) * Math.min(1, dt * 8);
    if (target - shown < 0.004) shown = target;
    fill.clear();
    const fw = Math.max(0, (BW - 10) * shown);
    if (fw > 1) {
      fill.rect(BX + 5, BY + 5, fw, BH - 10).fill({ color: 0xffc53d });
      for (let x = BX + 8 - ((clock * 40) % 12); x < BX + 5 + fw - 2; x += 12) {
        const x0 = Math.max(BX + 5, x), x1 = Math.min(BX + 5 + fw, x + 9);
        if (x1 > x0) fill.moveTo(x0, BY + BH - 6).lineTo(x1, BY + 6);
      }
      fill.stroke({ color: 0xf08a24, width: 3, cap: 'round', alpha: 0.8 });
    }
    pct.text = Math.round(shown * 100) + "%";
    if (title.style.fontFamily !== FONT) for (const tx of [title, pct, cap]) tx.style.fontFamily = FONT; // swap in the hand-lettered face once it lands
    if (target >= 1 && shown >= 1 && resolveDone) { const f = resolveDone; resolveDone = null; f(); }
  };
  return { set: (p        ) => { target = Math.max(target, Math.min(1, p)); }, finished: () => done };
}

// ───────────────────────── 启动 ─────────────────────────
// 存档：插件由 plugin.js 先读好再传进来（getLatest 返回 Promise）；独立网页没有 store ⇒ 全新档。
try { initialSave = (await store?.getLatest?.()) ?? null; } catch { initialSave = null; }
loadSave();

// 语言固定中文（原版的三语切换按钮已拆掉）
setLang('zh');

const loader = showLoading();
loadTick?.(0);
app.render();
window.__gpReady = true;

const bootTasks = [applyLang(getLang()), initSound()];
let bootDone = 0;
for (const p of bootTasks) p.then(() => { bootDone++; loader.set(bootDone / bootTasks.length); }, () => { bootDone++; loader.set(bootDone / bootTasks.length); });
// never strand the player: if a task hangs, finish after 10 s anyway
const bootCap = setTimeout(() => loader.set(1), 10000);
await loader.finished();
clearTimeout(bootCap);
loadTick = null;
showTitle();
window.__gpPlayable = true;

// ───────────────────────── 调试桥（e2e / 截图用）─────────────────────────
// 整屏都是 canvas 画的 ⇒ DOM 里找不到按钮。桥只读状态 + 少量动作，
// 卸载时必须删掉（留着会让下一次「已就绪」判断立刻为真）。
const bridge = {
  ready: true,
  get scene() { return scene; },
  get phase() { return phase; },
  get level() { return cur; },
  get shots() { return shots; },
  get power() { return power; },
  /** 球的设计坐标（1280×720）。截图/走查要「球真的在空中」只能靠它：
   *  headless 下游戏时钟慢约 7×，`sleep(900)` 只等于游戏内 0.13 秒，球还没离手。 */
  get ball() { return { x: sim.bx, y: sim.by }; },
  get stars() { return [...save.stars]; },
  get totalStars() { return totalStars(save.stars); },
  get unlocked() { return save.unlocked; },
  get soundOn() { return save.sound; },
  get levels() { return NLEVELS; },
  /** 设计坐标（1280×720）→ 容器内 CSS 坐标 */
  designToScreen: (x, y) => ({ x: offX + x * scaleS, y: offY + y * scaleS }),
  /** 当前画面上可点的按钮（label + 容器内 CSS 坐标），按 label 点，别写死像素 */
  buttons: () => {
    const out = [];
    const walk = (node) => {
      for (const ch of node.children) {
        if (ch.eventMode === 'static' && ch.visible && !ch.destroyed) {
          const label = ch.children.find((k) => k instanceof PIXI.Text)?.text;
          if (label) {
            const p = ch.getGlobalPosition();
            out.push({ label: String(label), x: p.x, y: p.y });
          }
        }
        walk(ch);
      }
    };
    walk(app.stage);
    return out;
  },
  startLevel: (i, intro = false) => startLevel(i, true, intro),
  // 声音开关：存档探针用它（点一下就能改、重挂载能读回，见 e2e 第 ⑦ 段）
  toggleSound: () => { toggleSound(); refreshScene(); },
  beginCharge,
  release,
  setPower: (p) => { power = p; },
};
window.__hoopsneak = bridge;

// ───────────────────────── 卸载 ─────────────────────────
async function destroy() {
  for (const off of offs) { try { off(); } catch { /* ignore */ } }
  offs.length = 0;
  try { loadTick = null; } catch { /* ignore */ }
  try { sound?.dispose?.(); } catch { /* ignore */ }
  try { display.dispose(); } catch { /* ignore */ }
  try { fx.dispose(); } catch { /* ignore */ }
  try {
    app.ticker?.stop?.();
    app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
  } catch (e) { console.warn('[hoopsneak] Pixi destroy 失败', e); }
  if (window.__hoopsneak === bridge) delete window.__hoopsneak;
  if (window.__gpPlayable) delete window.__gpPlayable;
  if (window.__gpReady) delete window.__gpReady;
  try { mountRoot.remove(); } catch { /* ignore */ }
  return undefined;
}
return destroy;
}
