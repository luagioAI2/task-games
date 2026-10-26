// 跳绳羊群 — portrait 2D rhythm game (pixi.js v8 scene + DOM UI overlay)
import * as PIXI from "pixi.js";
import { mountDisplay } from "@makeplay/display";
import { loadSoundSystem } from "@makeplay/sound";
import { createPixiFx } from "@makeplay/fx";
import { t, LANGS, LANG_NAMES, setLangRaw, getLang, detectLang } from "./i18n.js";
                                      
import { P, saveProgress, flushProgress, reloadProgress, SHOP_ITEMS, UPGRADE_COST } from "./platform.js";
                                                                  

const W      = window;
const GP      = W.gp;

// ============================================================ asset base
/** Set once by start(); the host passes `ctx.assetBase` (or `ctx.assetUrl`). */
let ASSET_BASE = "";
/** The mount container. */
let host = null;
/** HostApi subset — mintGameCoin / pushToast / tone. Null when running standalone. */
let api = null;
let chargePlay = null;
/** Flip to false in destroy(); async continuations check it before touching the scene. */
let alive = false;
let destroyed = false;
/** True while a ticket purchase is in flight, so a double tap can't pay twice. */
let paying = false;

/** Resolve a package-relative asset path against `ASSET_BASE`. */
function asset(rel) {
  // Paths in the game source are written package-relative ("assets/x.webp").
  const p = rel.replace(/^assets\//, "");
  return /^assets\/$/.test(ASSET_BASE) ? "assets/" + p : ASSET_BASE + p;
}

// ============================================================ constants
const DW = 390, DH = 844; // design stage (portrait)
const GROUND = 598; // feet line in design units
const FLOCK_X = 195;
const ROPE_L = { x: 78, y: 512 };
const ROPE_R = { x: 318, y: 520 };
const RING_R = 46;
const MAX_SHEEP = 30;
                                                          
                                                    
const WEATHER_ROT            = ["breeze", "dusk", "rain", "sunny"];
const TUT_STEPS = ["intro", "learn-m1", "learn-m2", "learn-m3", "learn-m4"];

// ============================================================ language
let manualLang = false;
function applyLang(l      ) {
  setLangRaw(l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : l;
  document.title = t("title");
  loadFonts();
  renderUI();
  refreshHud(true);
}
const fontMap      = "zcool-kuaile/ZCOOLKuaiLe-Regular.ttf";
function loadFonts() {
  let used = false;
  try { if (GP?.fonts?.use) { used = true; void GP.fonts.use({ display: fontMap, body: "open-huninn/OpenHuninn.woff2", lang: getLang() }); } } catch { used = false; }
  // No CDN fallback: the bundled OpenHuninn woff2 lives under assets/_ext/, and the font
  // stack already ends in system CJK faces. A cross-origin URL would also break the
  // "0 external requests" rule the host enforces on plugins.
  if (!used) {
    try {
      const url = new URL("_ext/static.makeplay.ai/fonts/v1/open-huninn/OpenHuninn.woff2", new URL(asset(""), document.baseURI)).toString();
      const f = new FontFace("MpFontDisplay", `url(${url})`);
      f.load().then((ff) => { (document.fonts       ).add(ff); }, () => {});
    } catch { /* */ }
  }
}
setLangRaw(detectLang(GP?.player?.user?.locale || navigator.language));
document.documentElement.lang = getLang() === "zh" ? "zh-CN" : getLang();

// ============================================================ DOM shell
// Created in start() — the module must not touch the document at import time.
const css = document.createElement("style");
css.textContent = `
#ui{position:absolute;inset:0;pointer-events:none;font-family:MpFontDisplay,"ZCOOLKuaiLe","PingFang SC","Hiragino Maru Gothic ProN","Hiragino Sans","Microsoft YaHei","Noto Sans CJK SC",sans-serif;color:#4a3826;user-select:none;-webkit-user-select:none}
#ui *{box-sizing:border-box}
#col{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px}
.btn{pointer-events:auto;min-height:48px;min-width:48px;border:none;border-radius:14px;padding:10px 18px;font:inherit;font-size:18px;color:#4a3826;background:#fdf3dc;box-shadow:4px 4px 0 rgba(74,56,38,.28);cursor:pointer;touch-action:manipulation}
.btn:active{transform:translate(2px,2px);box-shadow:2px 2px 0 rgba(74,56,38,.28)}
.btn:focus-visible{outline:3px solid #2f7fd0;outline-offset:2px}
.btn.primary{background:#ffd65a;font-size:22px}
.btn.blue{background:#a9d8f5}
.btn.mint{background:#bfe8c4}
.btn.peach{background:#ffc9a8}
.btn[disabled]{opacity:.55;cursor:default}
.panel{pointer-events:auto;position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);max-height:calc(100% - 32px);overflow-y:auto;background:#fff8e8;border-radius:22px;padding:18px 18px 20px;box-shadow:6px 6px 0 rgba(74,56,38,.25);text-align:center}
.panel h2{margin:4px 0 10px;font-size:26px;font-weight:normal;color:#5a3e22}
.panel p{margin:6px 0;font-size:16px;line-height:1.45}
.row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.langs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0 10px}
.lang{pointer-events:auto;min-height:48px;min-width:64px;border-radius:24px;border:2px solid #c9b48e;background:#fff;font:inherit;font-size:16px;color:#4a3826;padding:6px 14px;cursor:pointer}
.lang[aria-pressed=true]{background:#4a3826;color:#fff8e8;border-color:#4a3826}
.lang:focus-visible{outline:3px solid #2f7fd0}
.tape{background:#f6e7c4;border-radius:6px;padding:4px 12px;box-shadow:3px 3px 0 rgba(74,56,38,.22);display:inline-block}
#hud{position:absolute;inset:0;pointer-events:none}
#hudTop{position:absolute;left:16px;right:16px;top:14px;display:flex;align-items:flex-start;gap:8px}
#score{font-size:30px;min-width:104px;text-align:center;background:#f6e7c4;padding:4px 14px;border-radius:6px;box-shadow:3px 3px 0 rgba(74,56,38,.22)}
#mult{font-size:22px;background:#a9d8f5;padding:6px 12px;border-radius:6px;box-shadow:3px 3px 0 rgba(74,56,38,.22);transition:transform .12s}
#bells{margin-left:auto;font-size:24px;background:#f6e7c4;padding:4px 10px;border-radius:6px;box-shadow:3px 3px 0 rgba(74,56,38,.22);white-space:nowrap}
.bell{display:inline-block;width:26px;height:28px;margin:0 2px;vertical-align:middle}
#meter{position:absolute;right:16px;top:118px;width:34px;height:250px;border-radius:17px;background:#f6e7c4;box-shadow:3px 3px 0 rgba(74,56,38,.22);padding:5px}
#meterIn{position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;background:linear-gradient(to top,#5fbf6a 0%,#8fd16a 35%,#ffd65a 60%,#ff9d4d 80%,#e5534b 100%)}
#meterCover{position:absolute;left:0;right:0;top:0;background:#e9dcc0;transition:height .2s}
#meterMark{position:absolute;left:-6px;right:-6px;height:4px;background:#4a3826;border-radius:2px;transition:bottom .2s}
#meterLbl{position:absolute;right:6px;top:372px;width:46px;text-align:center;font-size:13px;background:#fff8e8;border-radius:8px;padding:2px 0}
#pauseBtn{position:absolute;left:16px;top:70px;font-size:20px;padding:0;width:48px;height:48px}
#dogBtn{position:absolute;left:16px;bottom:24px;display:flex;align-items:center;gap:6px;padding:4px 12px 4px 4px;font-size:16px}
#dogBtn img{width:44px;height:44px;border-radius:50%;background:#fff}
#info{position:absolute;right:16px;bottom:24px;font-size:15px;text-align:right;background:rgba(255,248,232,.92);border-radius:10px;padding:6px 10px;max-width:60%}
#tut{position:absolute;left:16px;right:16px;top:132px;margin-right:56px;background:rgba(255,248,232,.96);border-radius:16px;padding:10px 12px;box-shadow:4px 4px 0 rgba(74,56,38,.22);font-size:16px;line-height:1.4;pointer-events:none}
#tut .tutTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:13px;color:#8a6d4a}
#tut .btn{font-size:14px;padding:4px 12px;min-height:48px}
#coach{position:absolute;pointer-events:auto;overflow-y:auto;background:#fff8e8;border:3px solid #ffb300;border-radius:18px;padding:12px 14px 14px;box-shadow:5px 5px 0 rgba(74,56,38,.28);text-align:left;z-index:5}
#coach .cdots{display:flex;gap:6px;justify-content:center;margin-bottom:4px}
#coach .cdots i{width:9px;height:9px;border-radius:50%;background:#e2d3b2}
#coach .cdots i.on{background:#d08a00}
#coach h3{margin:2px 0 8px;font-size:22px;font-weight:normal;color:#5a3e22;text-align:center}
#coach .cl{margin:0 0 8px;font-size:17px;line-height:1.45;opacity:0;animation:cin .35s ease-out forwards}
#coach .cl.step{background:#fff1c7;border-radius:10px;padding:6px 10px}
#coach .crow{display:flex;justify-content:center;margin-top:6px}
#coach .btn{min-width:150px}
@keyframes cin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#coach .cl{animation:none;opacity:1}}
@media (max-height:520px){#coach{padding:8px 12px 10px}#coach h3{font-size:18px;margin:0 0 4px}#coach .cl{font-size:15px;margin-bottom:5px}}
#toast{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);background:rgba(74,56,38,.92);color:#fff8e8;padding:10px 16px;border-radius:12px;font-size:16px;max-width:86%;text-align:center;opacity:0;transition:opacity .25s;pointer-events:none}
#loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#8fd0f0;pointer-events:auto}
#loading .bar{width:220px;height:16px;background:#fff8e8;border-radius:8px;overflow:hidden;margin-top:14px}
#loading .fill{height:100%;width:0;background:#ffd65a;transition:width .15s}
#loading .hop{width:54px;height:40px;border-radius:50%;background:#fff;box-shadow:3px 3px 0 rgba(74,56,38,.25);animation:hop .6s ease-in-out infinite alternate}
@keyframes hop{from{transform:translateY(0)}to{transform:translateY(-26px)}}
.title{font-size:44px;margin:4px 0 2px;color:#5a3e22;letter-spacing:2px}
.stat{display:inline-block;margin:2px 8px;font-size:16px}
.coin{width:20px;height:20px;vertical-align:-4px;margin-right:3px}
.item{display:flex;align-items:center;gap:10px;text-align:left;background:#fff;border-radius:14px;padding:10px;margin:8px 0;box-shadow:3px 3px 0 rgba(74,56,38,.15)}
.item .sw{width:52px;height:52px;border-radius:12px;flex:none}
.item .tx{flex:1;font-size:14px;line-height:1.35}
.item .tx b{font-size:17px;font-weight:normal;display:block}
.lb{list-style:none;margin:6px 0;padding:0;text-align:left;max-height:46vh;overflow-y:auto}
.lb li{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;font-size:16px}
.lb li.me{background:#ffeeb0}
.lb .rk{width:34px;text-align:center}
.lb .av{width:36px;height:36px;border-radius:50%;background:#e9dcc0;object-fit:cover;flex:none}
.lb .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb button.who{pointer-events:auto;display:flex;align-items:center;gap:8px;flex:1;min-height:48px;background:none;border:none;font:inherit;color:inherit;text-align:left;padding:0;cursor:pointer;overflow:hidden}
.lb button.who:focus-visible{outline:3px solid #2f7fd0}
.badge{font-size:12px;background:#a9d8f5;border-radius:8px;padding:1px 6px;margin-left:4px}
.prog{height:18px;background:#e9dcc0;border-radius:9px;overflow:hidden;margin:8px 0 4px}
.prog .f{height:100%;background:#a9d8f5}
.prog.hot .f{background:linear-gradient(90deg,#ffd65a,#ff9d4d)}
.hotTxt{color:#d0592b}
.note{font-size:13px;color:#8a6d4a}
.sim{font-size:13px;color:#b04a2a;background:#ffe9dc;border-radius:8px;padding:4px 8px;margin:6px 0}
.up{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:8px 10px;margin:8px 0;text-align:left;box-shadow:3px 3px 0 rgba(74,56,38,.15)}
.up .tx{flex:1;font-size:16px}
.up .btn{font-size:15px;padding:6px 10px}
.gallery{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin:6px 0;min-height:24px}
.gallery img{width:26px;height:23px}
.modal{pointer-events:auto;position:absolute;inset:0;background:rgba(40,30,20,.45);display:flex;align-items:center;justify-content:center}
@media (max-height:520px){.panel{padding:8px 14px 10px}.panel h2{font-size:20px;margin:2px 0 4px}.panel p{margin:3px 0;font-size:14px}.title{font-size:28px;margin:0}.row{margin:5px 0;gap:8px}.langs{margin:2px 0 4px}.btn{padding:6px 14px;font-size:16px}.btn.primary{font-size:18px}.tagline,.weeklyNote{display:none}.stat{font-size:14px}}
.modal .panel{position:relative;top:auto;transform:none;left:auto;right:auto;max-width:360px;margin:16px}
`;

// Test hooks for the e2e scripts. `owner` lets destroy() remove only its own object,
// so a remount never deletes a newer instance's hooks.
const owner = Symbol("ropeland");
let hooksOwner = null;
const TEST_HOOKS = {
  get run() { return run; }, get flock() { return flock.length; }, get visitor() { return visitor ? { kind: visitor.kind, state: visitor.state, x: visitor.x, y: visitor.y } : null; },
  get screen() { return screen; }, get overlay() { return overlay; }, get coach() { return coach; }, coachNext: () => { coachReadyAt = 0; coachNext(); }, P, bpm: () => currentBpm(), startRun, endRun,
  tapDesign: (x        , y        ) => handleTap(x, y, run ? run.time : 0),
  stage: () => ({ K, OX, OY }),
  anims: () => Object.fromEntries(Object.keys(ANIM).map((k) => [k, ANIM[k].frames.length])),
  turnerFrame: () => { const ta = themeIsSnow() ? ANIM.snowman : ANIM.scarecrow; return ta ? ta.frames.indexOf(turnerSpr.texture) : -1; },
  sim(sec        , opts                                                                   = {}) {
    autoplay = { recruit: opts.recruit || (() => true) }       ; (autoplay       ).jitter = opts.jitter || 0;
    const dt = opts.dt || 1 / 60; let n = Math.round(sec / dt);
    try { while (n-- > 0 && run && screen === "play" && !run.over) step(dt); } finally { autoplay = null; }
    return run ? { time: run.time, score: Math.floor(run.score), jumps: run.jumps, sheep: flock.length, bpm: currentBpm(), bells: run.bells, weather: run.weather, segment: run.segment, over: run.over, mult: run.mult } : null;
  },
};

/* Every node below is created per mount and torn down by destroy(). */
let root = null, ui = null, col = null, hud = null, screenEl = null, toastEl = null, coachEl = null;
let toastTimer = 0;
function toast(msg        , ms = 2200) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.style.opacity = "1";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, ms)       ;
}
function esc(s        ) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }       )[c]); }
const BELL_SVG = (on         ) => `<svg class="bell" viewBox="0 0 26 28" aria-hidden="true"><path d="M13 2c1.2 0 2 .9 2 2v.6c4 1 6.5 4.6 6.5 9v5l2.5 3.4H2l2.5-3.4v-5c0-4.4 2.5-8 6.5-9V4c0-1.1.8-2 2-2z" fill="${on ? "#ffcf3a" : "#d9cdb3"}" stroke="${on ? "#c98f12" : "#b5a888"}" stroke-width="1.5"/><circle cx="13" cy="24.5" r="2.6" fill="${on ? "#c98f12" : "#b5a888"}"/></svg>`;

// loading screen (shown first; __gpReady is set once it's painted)
/** Built in start(); the host measures the container before anything is appended. */
function buildShell() {
  root = document.createElement("div");
  root.className = "rp-root";
  root.style.cssText = "position:absolute;inset:0;overflow:hidden";
  host.appendChild(root);
  document.head.appendChild(css);
  ui = document.createElement("div"); ui.id = "ui"; root.appendChild(ui);
  col = document.createElement("div"); col.id = "col"; ui.appendChild(col);
  hud = document.createElement("div"); hud.id = "hud"; col.appendChild(hud);
  screenEl = document.createElement("div"); screenEl.style.cssText = "position:absolute;inset:0;pointer-events:none"; col.appendChild(screenEl);
  toastEl = document.createElement("div"); toastEl.id = "toast"; col.appendChild(toastEl);
  coachEl = document.createElement("div"); coachEl.id = "coach"; coachEl.setAttribute("role", "dialog"); coachEl.setAttribute("aria-live", "polite"); coachEl.style.display = "none"; ui.appendChild(coachEl);
}
// loading screen (shown first; built in start())
let loadingEl = null;

// ============================================================ pixi
const app = new PIXI.Application();
let display      = null;
let VW = 390, VH = 844, K = 1, OX = 0, OY = 0;
const camRoot = new PIXI.Container(); // additive FX camera impulse root
const world = new PIXI.Container(); // design-space container
const bgLayer = new PIXI.Container();
const backLayer = new PIXI.Container(); // windmill, scarecrow, ground pulse, back rope
const flockLayer = new PIXI.Container();
const frontLayer = new PIXI.Container(); // front rope
const weatherLayer = new PIXI.Container();
const fxLayer = new PIXI.Container();
world.addChild(bgLayer, backLayer, flockLayer, frontLayer, weatherLayer, fxLayer);
const styleFilter = new PIXI.ColorMatrixFilter();

const TEX                               = {};
let fx      = null;
function fxPlay(id        , x        , y        , extra      = {}) {
  if (!fx) return;
  try { fx.play(id, { pos: { x, y }, ...extra }); } catch { /* */ }
}
let assetsReady = false;

function relayout(w        , h        ) {
  VW = w; VH = h;
  K = Math.min(w / DW, h / DH);
  if (w < DW * K + 1) K = w / DW;
  OX = (w - DW * K) / 2; OY = (h - DH * K) / 2;
  world.scale.set(K); world.position.set(OX, OY);
  col.style.maxWidth = Math.max(320, Math.min(520, w)) + "px";
  layoutBg();
  placeCoach();
}

// ============================================================ scene objects
let bgSprites                = [];
const skyFill = new PIXI.Graphics();
const windmillSpr = new PIXI.Sprite();
const sails = new PIXI.Graphics();
const turnerSpr = new PIXI.Sprite();
const crankG = new PIXI.Graphics();
const pulseG = new PIXI.Graphics();
const ropeBack = new PIXI.Graphics();
const ropeFront = new PIXI.Graphics();
const ropeShadow = new PIXI.Graphics();
const duskOverlay = new PIXI.Graphics();
const styleOverlay = new PIXI.Graphics();
let grainSpr                           = null;

function layoutBg() {
  if (!assetsReady) return;
  const tex = TEX[themeBg()];
  const visW = VW / K, visH = VH / K;
  const size = Math.max(900, visH + 20);
  const top = DH / 2 - size / 2 - (size - 900) * 0.25;
  const needed = Math.ceil((visW / size - 1) / 2) + 1;
  for (const s of bgSprites) s.destroy();
  bgSprites = [];
  skyFill.clear().rect(-visW, -visH, visW * 3, visH * 3).fill(themeIsSnow() ? 0xb9dcf2 : 0x8fd0f0);
  for (let i = -needed; i <= needed; i++) {
    const s = new PIXI.Sprite(tex);
    s.width = size; s.height = size;
    s.anchor.set(0.5, 0);
    s.position.set(DW / 2 + i * size, top);
    if (i % 2 !== 0) s.scale.x *= -1;
    bgLayer.addChild(s); bgSprites.push(s);
  }
  if (grainSpr) { grainSpr.width = visW * 3; grainSpr.height = visH * 3; grainSpr.position.set(-visW, -visH); }
  duskOverlay.clear().rect(-visW, -visH, visW * 3, visH * 3).fill({ color: 0x3b2a5a, alpha: 1 });
  styleOverlay.clear().rect(-visW, -visH, visW * 3, visH * 3).fill({ color: 0xff9a5c, alpha: 1 });
}
function themeIsSnow() { return P.equipped.theme === "theme_snow_ranch"; }
function themeBg() { return themeIsSnow() ? "snow" : "meadow"; }

function setupScene() {
  bgLayer.addChild(skyFill);
  windmillSpr.texture = TEX.windmill; windmillSpr.anchor.set(0.5, 1);
  windmillSpr.height = 250; windmillSpr.scale.x = windmillSpr.scale.y; windmillSpr.position.set(52, GROUND + 6);
  backLayer.addChild(windmillSpr, sails, ropeShadow, pulseG, ropeBack, crankG);
  turnerSpr.anchor.set(0.5, 1);
  backLayer.addChild(turnerSpr);
  frontLayer.addChild(ropeFront);
  duskOverlay.alpha = 0; styleOverlay.alpha = 0;
  weatherLayer.addChild(duskOverlay, styleOverlay);
  // paper grain for collage style
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d") ;
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = 120 + Math.random() * 135; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  grainSpr = new PIXI.TilingSprite({ texture: PIXI.Texture.from(c), width: 10, height: 10 });
  grainSpr.alpha = 0;
  weatherLayer.addChild(grainSpr);
  weatherLayer.addChild(ropeShadowTop);
  applyTheme();
  applyStyle();
}
const ropeShadowTop = new PIXI.Graphics();

function applyTheme() {
  if (!assetsReady) return;
  const snow = themeIsSnow();
  const ta = snow ? ANIM.snowman : ANIM.scarecrow;
  if (ta) {
    // animated turner: front view, cranking arm on the viewer's left = toward the rope end, so no flip
    turnerSpr.texture = ta.frames[0]; turnerSpr.anchor.set(ta.ax, ta.ay);
    turnerSpr.scale.set((snow ? 176 : 196) / ta.contentH);
    turnerSpr.position.set(354, GROUND + 10);
  } else {
    const tex = snow ? TEX.snowman : TEX.scarecrow;
    turnerSpr.texture = tex;
    turnerSpr.anchor.set(0.5, 1);
    const k = (snow ? 176 : 196) / Math.max(1, tex.height);
    turnerSpr.scale.set(-k, k); // face left toward the flock
    turnerSpr.position.set(350, GROUND + 10);
  }
  layoutBg();
  for (const s of flock) s.refreshTint();
}
function applyStyle() {
  const st = P.style;
  styleFilter.reset();
  if (st === "dusk") {
    styleFilter.hue(-12, false); styleFilter.saturate(-0.15, true); styleFilter.brightness(0.92, true);
    styleOverlay.alpha = 0.18; if (grainSpr) grainSpr.alpha = 0.08;
    world.filters = [styleFilter];
  } else if (st === "collage") {
    styleFilter.saturate(0.35, false); styleFilter.contrast(0.12, true);
    styleOverlay.alpha = 0; if (grainSpr) grainSpr.alpha = 0.1;
    world.filters = [styleFilter];
  } else {
    styleOverlay.alpha = 0; if (grainSpr) grainSpr.alpha = 0;
    world.filters = [];
  }
}

// ============================================================ sheep
function hsv(h        , s        , v        ) {
  const f = (n        ) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return (Math.round(f(5) * 255) << 16) | (Math.round(f(3) * 255) << 8) | Math.round(f(1) * 255);
}
let sheepSerial = 0;
class Sheep {
  kind      ;
  id        ;
  c                ;
  spr             ;
  shadowSpr             ;
  ground               ;
  x = 0; y = 0; tx = 0; ty = 0; sc = 1;
  jumpT = -1; jumpDur = 0.4; jumpH = 70; jumpDelay = 0;
  leader = false;
  state                                                                       = "flock";
  vx = 0; vy = 0; spin = 0; life = 0;
  lambJumps = 0;
  hue = Math.random();
  constructor(kind      ) {
    this.kind = kind; this.id = ++sheepSerial;
    this.c = new PIXI.Container();
    this.ground = new PIXI.Graphics().ellipse(0, 0, 26, 6).fill({ color: 0x2c4a1e, alpha: 0.22 });
    this.shadowSpr = new PIXI.Sprite(TEX.sheep); this.shadowSpr.anchor.set(0.5, 1); this.shadowSpr.tint = 0x2a2016; this.shadowSpr.alpha = 0.22;
    this.spr = new PIXI.Sprite(TEX.sheep); this.spr.anchor.set(0.5, 1);
    this.c.addChild(this.ground, this.shadowSpr, this.spr);
    this.refreshTint();
  }
  baseScale() { return (this.kind === "lamb" ? 0.68 : 1) * (this.leader ? 1.1 : 1); }
  refreshTint() {
    const k = this.kind;
    if (k === "gold") this.spr.tint = 0xffd45a;
    else if (k === "black") this.spr.tint = 0x5a5560;
    else if (k === "bell") this.spr.tint = 0xffefd8;
    else if (P.equipped.skin === "skin_rainbow_wool") this.spr.tint = hsv(this.hue, 0.38, 1);
    else this.spr.tint = 0xffffff;
  }
  weight() { return this.kind === "gold" ? 3 : 1; }
  show(a                  , i        ) {
    if (!a) return;
    const n = a.frames.length;
    const tex = a.frames[((i % n) + n) % n];
    if (this.spr.texture !== tex) { this.spr.texture = tex; this.shadowSpr.texture = tex; }
    this.spr.anchor.set(a.ax, a.ay); this.shadowSpr.anchor.set(a.ax, a.ay);
  }
}

// ============================================================ frame animations (sprite-sheet packs)
;                                                                                               
const ANIM                       = {};
const ANIM_PACKS                                                    = {
  idle: { dir: "sheep-idle", contentH: 307 }, walk: { dir: "sheep-walk", contentH: 316 }, hop: { dir: "sheep-hop-in-place", contentH: 307 },
  scarecrow: { dir: "scarecrow-turn", contentH: 350 }, snowman: { dir: "snowman-turn", contentH: 352 },
};
const SHEEP_ANIM_K = 512 / 353; // static sheep.png is 512 wide; the animated sheep body is 353 px wide in its cells
async function loadAnims(tick            , addTotal                     ) {
  const mans                      = {};
  await Promise.all(Object.keys(ANIM_PACKS).map(async (k) => {
    try { const r = await fetch(asset(`assets/${ANIM_PACKS[k].dir}/manifest.json`)); mans[k] = await r.json(); addTotal(mans[k].pages.length); } catch { /* static fallback */ }
  }));
  await Promise.all(Object.keys(mans).map(async (k) => {
    const m = mans[k], dir = ANIM_PACKS[k].dir;
    try {
      const pages                 = await Promise.all(m.pages.map(async (p        ) => { const tx = await PIXI.Assets.load(asset(`assets/${dir}/${p}`)); tick(); return tx; }));
      const { w, h, count, cols, rows } = m.frame; const per = cols * rows;
      const frames                 = [];
      for (let i = 0; i < count; i++) {
        const pg = pages[Math.floor(i / per)], c = i % per;
        frames.push(new PIXI.Texture({ source: pg.source, frame: new PIXI.Rectangle((c % cols) * w, Math.floor(c / cols) * h, w, h) }));
      }
      ANIM[k] = { frames, fps: m.fps, ax: m.anchor.x, ay: m.anchor.y, contentH: ANIM_PACKS[k].contentH };
    } catch { /* static fallback */ }
  }));
}
/** Pick the sheep's frame: hop follows jump progress u (0..1), walk/idle run on the clock. */
function sheepAnim(s       , mode                                  , u = 0)          {
  if (mode === "hop" || mode === "tuck") {
    const a = ANIM.hop; if (!a) return false;
    // pack: 0-1 stand, 2-3 rise, 4 apex (legs tucked), 5-7 fall, 8 touchdown
    const f = mode === "tuck" ? 4 : u < 0.5 ? 2 + (u / 0.5) * 2 : 4 + ((u - 0.5) / 0.5) * 4;
    s.show(a, Math.min(8, Math.round(f)));
    return true;
  }
  const a = mode === "walk" ? ANIM.walk : ANIM.idle; if (!a) return false;
  const fps = mode === "walk" ? a.fps * 1.3 : 10; // idle breathing slowed to a calm 1.2 s loop
  s.show(a, Math.floor(elapsed * fps + s.id * 3.7));
  return true;
}
const SHEEP_W = 62; // design px width of a front-row sheep
function sheepScale(s       , row        ) { return (SHEEP_W / 512) * s.baseScale() * Math.pow(0.9, row); }

let flock          = [];
let visitor               = null;
const fleeing          = [];
let ringG = new PIXI.Graphics();
let bellIcon = new PIXI.Graphics();

function layoutFlock() {
  // columns of up to 6 across the rope span, rows step back
  const n = flock.length;
  const per = 6;
  const rows = Math.ceil(n / per);
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const cnt = Math.min(per, n - r * per);
    const spacing = 33 * Math.pow(0.92, r);
    for (let i = 0; i < cnt; i++) {
      const s = flock[idx++];
      s.tx = FLOCK_X + (i - (cnt - 1) / 2) * spacing + (r % 2 ? 10 : 0);
      s.ty = GROUND - r * 13;
      s.sc = sheepScale(s, r);
    }
  }
  // draw order: back rows first
  const ordered = flock.slice().sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  for (let i = 0; i < ordered.length; i++) flockLayer.addChild(ordered[i].c);
  if (visitor) flockLayer.addChild(visitor.c);
  for (const f of fleeing) flockLayer.addChild(f.c);
}

// ============================================================ particles & popups
;                                                                                                   
const parts         = [];
const partPool                  = [];
function puff(x        , y        , n        , color               , spread = 50) {
  for (let i = 0; i < n; i++) {
    if (parts.length > 220) break;
    const g = partPool.pop() || new PIXI.Graphics();
    g.clear().circle(0, 0, 3 + Math.random() * 4).fill(color === null ? hsv(Math.random(), 0.6, 1) : color);
    g.position.set(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 10);
    g.alpha = 1;
    fxLayer.addChild(g);
    parts.push({ g, vx: (Math.random() - 0.5) * spread * 2, vy: -Math.random() * spread * 1.6, life: 0, max: 0.6 + Math.random() * 0.5, grav: 140 });
  }
}
;                                                       
const pops        = [];
function popup(text        , x        , y        , color = 0x5a3e22, size = 22) {
  const tx = new PIXI.Text({
    text, style: { fontFamily: ["MpFontDisplay", "ZCOOLKuaiLe", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "sans-serif"], fontSize: size, fill: color, stroke: { color: 0xfff8e8, width: 5 }, align: "center", wordWrap: true, wordWrapWidth: 300, breakWords: true },
  });
  tx.anchor.set(0.5); tx.position.set(x, y); tx.resolution = Math.min(2, window.devicePixelRatio || 1) * Math.max(1, K);
  fxLayer.addChild(tx);
  pops.push({ t: tx, life: 0, vy: -40 });
  if (pops.length > 12) { const o = pops.shift() ; o.t.destroy(); }
}
// weather particles
;                                                                                 
const drops         = [];

// ============================================================ sound
let sound      = null;
let soundUnlocked = false;
let musicOn = false;
const ambIds                                = { wind: null, rain: null };
async function initSound() {
  try { sound = await loadSoundSystem({ manifestUrl: asset("sound.manifest.json") }); } catch { sound = null; }
}
async function unlockAudio() {
  if (soundUnlocked || !sound) return;
  soundUnlocked = true;
  try {
    await sound.unlock();
    void sound.preload("gameplay");
    if (!musicOn) { musicOn = true; void sound.startMusic("music.meadow", { crossfadeMs: 800 }); }
    syncAmbience();
  } catch { /* */ }
}
function onFirstGesture() { void unlockAudio(); }
window.addEventListener("pointerdown", onFirstGesture);
window.addEventListener("keydown", onFirstGesture);
function sfx(id        ) {
  if (!sound || !soundUnlocked) return;
  try {
    switch (id) {
      case "rope.tap": void sound.playCue("rope.tap"); break;
      case "rope.snow": void sound.playCue("rope.snow"); break;
      case "jump.perfect": void sound.playCue("jump.perfect"); break;
      case "jump.good": void sound.playCue("jump.good"); break;
      case "trip": void sound.playCue("trip"); break;
      case "join": void sound.playCue("join"); break;
      case "gameover": void sound.playCue("gameover"); break;
      case "ui.click": void sound.playCue("ui.click"); break;
      case "unlock": void sound.playCue("unlock"); break;
      case "dog": void sound.playCue("dog"); break;
    }
  } catch { /* */ }
}
function syncAmbience() {
  if (!sound || !soundUnlocked) return;
  const w = run && screen === "play" ? run.weather : "sunny";
  const wantWind = w === "breeze", wantRain = w === "rain";
  try {
    if (wantWind && !ambIds.wind) { ambIds.wind = "…"; sound.playCue("amb.wind").then((r     ) => { ambIds.wind = r?.instanceId || null; if (!(run && run.weather === "breeze" && screen === "play") && ambIds.wind) { sound.stop(ambIds.wind); ambIds.wind = null; } }); }
    if (!wantWind && ambIds.wind && ambIds.wind !== "…") { sound.stop(ambIds.wind); ambIds.wind = null; }
    if (wantRain && !ambIds.rain) { ambIds.rain = "…"; sound.playCue("amb.rain").then((r     ) => { ambIds.rain = r?.instanceId || null; if (!(run && run.weather === "rain" && screen === "play") && ambIds.rain) { sound.stop(ambIds.rain); ambIds.rain = null; } }); }
    if (!wantRain && ambIds.rain && ambIds.rain !== "…") { sound.stop(ambIds.rain); ambIds.rain = null; }
  } catch { /* */ }
}

// ============================================================ run state
;                                                                                            
;              
                                    
                                               
                                                            
                                                               
                                                                       
                                                                         
                                                       
                                                        
                                                                             
                                   
                                                             
                    
                                        
                                  
               
 
let run             = null;
let screen                                                     = "loading";
let overlay                                                                    = "";
let lastResult      = null;
let autoplay                                           = null;

/**
 * Monday-anchored week number, so the ranch's "featured sheep" rotates on the same day
 * everywhere (a plain floor(now / week) rotates mid-week depending on the epoch).
 */
function weekIndex() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
  return Math.floor(monday / (7 * 86400000));
}
function weeklyKind()       { const ks         = ["gold", "lamb", "black", "bell"]; return ks[weekIndex() % 4]; }

function startingSheep() { return 1 + P.up.start; }
function newRun(opts                                          = {})      {
  return {
    tutorial: !!opts.tutorial, calib: !!opts.calib,
    time: 0, phase: -1.5, beatMul: 1,
    beats: [], nextJumped: false, nextResolved: false,
    score: 0, mult: 1, bells: 3 + P.up.bell, maxBells: 3 + P.up.bell,
    jumps: 0, perfects: 0, peakSheep: 0, peakMult: 1,
    spawnIn: opts.tutorial ? 999 : 4 + Math.floor(Math.random() * 2),
    weather: "sunny", weatherIdx: -1, segment: 1,
    irregular: 0, dogBeats: 0, dogLeft: P.up.dog,
    graceBeats: 0, over: false, submitted: false,
    protectFirst: P.protectNext, tutStep: 0, tutCount: 0, tutDone: false,
    coached: {},
    recruits: 0, goldRecruits: 0, goldPassed: 0,
    calTaps: [], delayed: [], lastTrip: -10, shake: 0,
    weekly: weeklyKind(),
  };
}

function clearFlock() {
  for (const s of flock) s.c.destroy({ children: true });
  flock = [];
  if (visitor) { visitor.c.destroy({ children: true }); visitor = null; }
  for (const f of fleeing) f.c.destroy({ children: true });
  fleeing.length = 0;
  for (const p of parts) { p.g.parent?.removeChild(p.g); partPool.push(p.g); }
  parts.length = 0;
  for (const p of pops) p.t.destroy();
  pops.length = 0;
}

function startRun(opts                                          = {}) {
  // Tutorial and latency-calibration runs are not real rounds — never charge for those.
  if (!opts.tutorial && !opts.calib && chargePlay) {
    if (paying) return;
    paying = true;
    Promise.resolve(chargePlay())
      .then((ok) => { paying = false; if (ok !== false) startRun({ ...opts, charged: true }); })
      .catch(() => { paying = false; });
    return;
  }
  const t0 = performance.now();
  clearFlock();
  coach = null; pendingCoach = null;
  run = newRun(opts);
  if (!opts.tutorial && !opts.calib && P.protectNext) { P.protectNext = false; void saveProgress(); }
  const n = opts.tutorial || opts.calib ? 1 : startingSheep();
  for (let i = 0; i < n; i++) {
    const s = new Sheep("normal");
    if (i === 0) s.leader = true;
    flock.push(s);
  }
  layoutFlock();
  for (const s of flock) { s.x = s.tx; s.y = s.ty; }
  run.peakSheep = flock.length;
  screen = "play"; overlay = "";
  renderUI(); refreshHud(true); syncAmbience();
  W.__lastStartMs = performance.now() - t0;
}

function sheepCount() { return flock.length; }
function goldCount() { let g = 0; for (const s of flock) if (s.kind === "gold") g++; return g; }
function lambCount() { let g = 0; for (const s of flock) if (s.kind === "lamb") g++; return g; }
function currentBpm()         {
  if (!run) return 60;
  if (run.calib) return 80;
  let b = 60 + 4 * sheepCount() + 8 * goldCount();
  if (run.dogBeats > 0) b -= 12;
  return Math.max(60, Math.min(180, b));
}
function windows() { const b = currentBpm(); return b > 150 ? { perfect: 0.05, good: 0.1 } : { perfect: 0.06, good: 0.12 }; }
function lambShift() { if (!run || lambCount() === 0) return 0; return Math.min(0.09, 0.15 * 60 / currentBpm()); }
function beatRate() { return currentBpm() / 60 * (run ? run.beatMul : 1); }
function nextBeatTime()         { if (!run) return 0; const fr = Math.ceil(run.phase + 1e-9) - run.phase; return run.time + fr / beatRate(); }

// ============================================================ beat & judging
function onBeat(tCross        , idx        ) {
  if (!run) return;
  const b       = { t: tCross, idx, jumped: run.nextJumped, resolved: run.nextResolved, grace: run.graceBeats > 0 };
  if (run.graceBeats > 0) run.graceBeats--;
  run.nextJumped = false; run.nextResolved = false;
  run.beats.push(b);
  if (run.beats.length > 6) run.beats.shift();
  // rope thud (rain = delayed)
  const id = themeIsSnow() ? "rope.snow" : "rope.tap";
  if (run.weather === "rain") run.delayed.push({ at: run.time + 0.16, id }); else sfx(id);
  puff(FLOCK_X + (Math.random() - 0.5) * 80, GROUND + 4, 2, themeIsSnow() ? 0xffffff : 0xd8c79a, 25);
  // irregular rhythm (black sheep)
  if (run.irregular > 0) { run.irregular--; run.beatMul = run.irregular > 0 ? (idx % 2 ? 0.78 : 1.22) : 1; } else run.beatMul = 1;
  if (run.dogBeats > 0) run.dogBeats--;
}

function eventTime(e                     )         {
  if (!run) return 0;
  if (!e) return run.time;
  const lag = Math.max(0, Math.min(0.25, (performance.now() - e.timeStamp) / 1000));
  return run.time - (isFinite(lag) ? lag : 0);
}

function handleTap(dx        , dy        , tRaw        ) {
  if (!run || screen !== "play" || run.over || coach) return;
  if (run.calib) { calibTap(tRaw); return; }
  if (run.phase < -0.6) return; // count-in
  const tc = tRaw - P.latency / 1000;
  const shift = lambShift();
  const last = run.beats.length ? run.beats[run.beats.length - 1] : null;
  const nT = nextBeatTime();
  const dL = last ? tc - (last.t - shift) : 99;
  const dN = tc - (nT - shift);
  const w = windows();
  const useLast = last && Math.abs(dL) < Math.abs(dN);
  // ring hit test (recruit)
  let onRing = false;
  if (visitor && visitor.state === "waiting") {
    const ddx = dx - visitor.x, ddy = dy - (visitor.y - 22);
    onRing = ddx * ddx + ddy * ddy <= RING_R * RING_R;
  }
  if (useLast && last) {
    if (last.jumped) return; // already airborne
    if (last.resolved) return;
    if (Math.abs(dL) <= w.good) { last.jumped = true; doJump(Math.abs(dL) <= w.perfect, onRing, dL); }
    return;
  }
  if (run.nextJumped || run.nextResolved) return;
  if (Math.abs(dN) <= w.good) { run.nextJumped = true; doJump(Math.abs(dN) <= w.perfect, onRing, dN); return; }
  // too early for the next beat
  if (run.graceBeats > 0 || (run.tutorial && run.tutStep === 0)) return;
  run.nextResolved = true;
  trip("early");
}

function doJump(perfect         , recruit         , delta        ) {
  if (!run) return;
  const bi = 1 / beatRate();
  const dur = Math.min(0.5, Math.max(0.24, bi * 0.62));
  for (const s of flock) { s.jumpT = 0; s.jumpDur = dur; s.jumpDelay = s.kind === "lamb" ? Math.min(0.1, bi * 0.18) : Math.random() * 0.025; s.jumpH = 52 + Math.random() * 10; }
  let wsum = 0; for (const s of flock) wsum += s.weight();
  const pts = wsum * run.mult;
  run.score += pts;
  run.jumps++;
  if (perfect) { run.perfects++; run.mult = Math.min(3, Math.round((run.mult + 0.1) * 10) / 10); }
  run.peakMult = Math.max(run.peakMult, run.mult);
  sfx(perfect ? "jump.perfect" : "jump.good");
  popup((perfect ? t("perfect") : t("good")) + " +" + Math.round(pts), FLOCK_X, GROUND - 120 - Math.min(5, Math.floor(flock.length / 6)) * 13, perfect ? 0xd08a00 : 0x3a7a44, perfect ? 24 : 20);
  fxPlay(perfect ? "land-dust" : "land-dust", FLOCK_X, GROUND + 4, { scale: perfect ? 1.3 : 0.8 });
  if (perfect) {
    const rainbow = P.equipped.skin === "skin_rainbow_wool";
    for (let i = 0; i < Math.min(flock.length, 8); i++) puff(flock[i].tx, flock[i].ty - 20, rainbow ? 4 : 2, rainbow ? null : 0xffffff, 40);
  }
  for (const s of flock) if (s.kind === "lamb") { s.lambJumps++; if (s.lambJumps >= 10) { s.kind = "normal"; s.refreshTint(); } }
  if (recruit && visitor && visitor.state === "waiting") recruitVisitor();
  else if (visitor && visitor.state === "waiting" && (needsRecruitHint() || (run.tutorial && TUT_STEPS[run.tutStep] === "learn-m2"))) popup(t("cOffRing"), 230, visitor.y - 150, 0xc0392b, 17);
  afterJump();
  refreshHud();
}

function afterJump() {
  if (!run) return;
  // tutorial progression
  if (run.tutorial) tutOnJump();
  // segments & weather (real runs)
  if (!run.tutorial) {
    const seg = run.jumps < 30 ? 1 : run.jumps < 80 ? 2 : run.jumps < 130 ? 3 : 4 + Math.floor((run.jumps - 130) / 50);
    if (seg !== run.segment) { run.segment = seg; fxPlay("level-up", FLOCK_X, GROUND - 60); popup(t("newSegment", { n: seg }), FLOCK_X, 300, 0x2f6fae, 26); }
    if (run.jumps >= 30) {
      const wi = Math.floor((run.jumps - 30) / 50);
      if (wi !== run.weatherIdx) { run.weatherIdx = wi; setWeather(WEATHER_ROT[wi % 4]); }
    }
    run.spawnIn--;
    if (run.spawnIn <= 0 && !visitor) spawnVisitor();
  }
}

function setWeather(w         ) {
  if (!run) return;
  run.weather = w;
  toast(t("w_" + w), 1800);
  syncAmbience();
  refreshHud(true);
}

function pickKind()       {
  if (!run) return "normal";
  if (run.protectFirst) { run.protectFirst = false; return "normal"; }
  const pool                   = [["normal", 10]];
  if (run.jumps >= 30) pool.push(["lamb", 2.5]);
  if (run.jumps >= 80) pool.push(["gold", 2.2]);
  if (run.jumps >= 130) { pool.push(["black", 2]); pool.push(["bell", run.bells < run.maxBells ? 1.2 : 0.4]); }
  // Featured sheep only boosts a kind that is actually unlocked — otherwise "this week's
  // sheep" is a sheep that cannot appear yet (the title used to advertise exactly that).
  if (pool.some((p) => p[0] === run.weekly)) for (const p of pool) if (p[0] === run.weekly) p[1] *= 1.6;
  let tot = 0; for (const p of pool) tot += p[1];
  let r = Math.random() * tot;
  for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
  return "normal";
}

function spawnVisitor(kind       ) {
  if (!run || visitor) return;
  if (sheepCount() >= MAX_SHEEP) { run.spawnIn = 6; return; }
  const k = kind || pickKind();
  const s = new Sheep(k);
  s.state = "arriving"; s.x = 440; s.y = GROUND + 18; s.tx = 300; s.ty = GROUND + 18;
  s.sc = sheepScale(s, 0); s.life = 0;
  visitor = s;
  flockLayer.addChild(s.c);
  if (k !== "normal") popup(t("s_" + k) + "\n" + t("s_" + k + "_d"), DW / 2, 400, k === "gold" ? 0xc08000 : 0x5a3e22, 16);
  run.spawnIn = 4 + Math.floor(Math.random() * 6);
}

function recruitVisitor() {
  if (!run || !visitor) return;
  const s = visitor; visitor = null;
  s.state = "flock"; s.jumpT = -1;
  flock.push(s);
  run.recruits++;
  if (s.kind === "gold") run.goldRecruits++;
  if (s.kind === "black") { run.irregular = 8; }
  if (s.kind === "bell") { if (run.bells < run.maxBells) { run.bells++; popup(t("bellBack"), 300, 200, 0xc08000, 22); } s.kind = "normal"; s.refreshTint(); }
  run.peakSheep = Math.max(run.peakSheep, flock.length);
  layoutFlock();
  sfx("join");
  popup(t("join") + " ×" + flock.length, s.x, s.y - 80, 0xd08a00, 24);
  puff(s.x, s.y - 20, 6, 0xffe58a, 60);
  fxPlay(s.kind === "gold" ? "legendary-reward" : "pickup-pop", s.x, s.y - 30);
  run.shake = 0.25;
  const firstLesson = !P.recruitTaught || (run.tutorial && TUT_STEPS[run.tutStep] === "learn-m2");
  if (!P.recruitTaught) { P.recruitTaught = true; void saveProgress(); }
  if (firstLesson) { run.coached.recruit = true; pendingCoach = { id: "ok", at: run.time + 0.5 }; }
  else if (run.tutorial) tutOnRecruit(s.kind);
  refreshHud(true);
}

function trip(kind                  ) {
  if (!run || run.over) return;
  run.lastTrip = run.time;
  run.mult = 1;
  sfx("trip");
  fxPlay("heavy-hit", FLOCK_X, GROUND - 20);
  fxPlay("damage-flash", FLOCK_X, GROUND - 20);
  popup(kind === "early" ? t("early") : t("late"), FLOCK_X, GROUND - 150, 0xc0392b, 26);
  // scatter 30% (floor, min 1) of followers; leader stays
  const followers = flock.filter((s) => !s.leader);
  let lose = Math.max(1, Math.floor(flock.length * 0.3));
  lose = Math.min(lose, followers.length);
  for (let i = 0; i < lose; i++) {
    const idx = flock.lastIndexOf(followers[followers.length - 1 - i]);
    const s = flock.splice(idx, 1)[0];
    s.state = "fleeing"; s.vx = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 120); s.vy = -180 - Math.random() * 100; s.spin = (Math.random() - 0.5) * 8; s.life = 0;
    fleeing.push(s);
  }
  if (lose > 0) popup(t("scatter", { n: lose }), FLOCK_X, GROUND - 180, 0x8a4a2a, 18);
  layoutFlock();
  run.shake = 0.35;
  if (run.tutorial) { run.bells = Math.max(1, run.bells - 1); popup(t("tutTripNote"), FLOCK_X, 260, 0x2f6fae, 16); }
  else {
    run.bells--;
    popup(t("bellLost"), 300, 120, 0xc0392b, 20);
  }
  run.graceBeats = 2;
  if (visitor && visitor.state === "waiting" && !run.tutorial) { visitor.state = "leaving"; }
  refreshHud(true);
  if (!run.tutorial && run.bells <= 0) endRun();
}

function useDog() {
  if (!run || screen !== "play" || run.dogLeft <= 0 || run.over || run.tutorial || run.calib) return;
  run.dogLeft--; run.dogBeats = 16;
  sfx("dog");
  toast(t("dogUsed"), 1600);
  refreshHud(true);
}

function endRun() {
  if (!run) return;
  run.over = true;
  sfx("gameover");
  const r = run;
  const survivors = Math.max(0, flock.length - 1);
  const woolGain = survivors + r.peakSheep;
  const prevBest = P.best;
  const score = Math.floor(r.score);
  P.wool += woolGain;
  P.runs++;
  const avg = P.recent.length ? P.recent.reduce((a, b) => a + b, 0) / P.recent.length : 0;
  if (P.recent.length >= 2 && score < avg) P.below++; else P.below = 0;
  if (P.below >= 3) { P.protectNext = true; P.below = 0; }
  P.recent.push(score); if (P.recent.length > 10) P.recent.shift();
  const newBest = score > prevBest;
  if (newBest) P.best = score;
  P.bestSheep = Math.max(P.bestSheep, r.peakSheep);
  P.bestMult = Math.max(P.bestMult, r.peakMult);
  void saveProgress();
  lastResult = { score, prevBest, newBest, jumps: r.jumps, peakSheep: r.peakSheep, peakMult: r.peakMult, wool: woolGain, goldRecruits: r.goldRecruits, goldPassed: r.goldPassed };
  // hand the run's earnings to the host: wool is a game coin, convertible to vouchers.
  const host = opts.host;
  if (host && typeof host.mintGameCoin === "function" && woolGain > 0) {
    void Promise.resolve(host.mintGameCoin(woolGain, t("woolEarned"))).catch(() => {});
  }
  setTimeout(() => { screen = "results"; overlay = ""; syncAmbience(); renderUI(); }, 700);
}

// ============================================================ tutorial
function tutOnJump() {
  if (!run || !run.tutorial || run.tutDone) return;
  const step = TUT_STEPS[run.tutStep];
  if (step === "intro") advanceTut();
  else if (step === "learn-m1") { run.tutCount++; if (run.tutCount >= 3) advanceTut(); }
  else if (step === "learn-m3") { if (run.mult >= 1.2 - 1e-6) advanceTut(); }
  else if (step === "learn-m4") { if (!visitor) { if (run.tutCount++ % 2 === 1) spawnVisitor("gold"); } }
}
function tutOnRecruit(k      ) {
  if (!run) return;
  const step = TUT_STEPS[run.tutStep];
  if (step === "learn-m2") advanceTut();
  else if (step === "learn-m4" && k === "gold") advanceTut();
}
function tutOnLeave(k      ) {
  if (!run || !run.tutorial) return;
  if (TUT_STEPS[run.tutStep] === "learn-m4" && k === "gold") advanceTut();
}
function advanceTut() {
  if (!run) return;
  run.tutStep++; run.tutCount = 0;
  W.__tutStep = TUT_STEPS[run.tutStep] || "done";
  if (run.tutStep >= TUT_STEPS.length) { finishTutorial(false); return; }
  const step = TUT_STEPS[run.tutStep];
  if (step === "learn-m2") spawnVisitor("normal");
  if (step === "learn-m3") run.mult = Math.max(1, run.mult - 0.0); // keep as is
  if (step === "learn-m4") { setWeather("breeze"); spawnVisitor("gold"); }
  sfx("unlock");
  renderUI();
}
function finishTutorial(skipped         ) {
  if (!run) return;
  coach = null; pendingCoach = null; renderCoach();
  run.tutDone = true;
  P.tutorialDone = true;
  void saveProgress();
  if (skipped) { startRun(); return; }
  overlay = "tut-done"; screen = "pause";
  renderUI();
}

// ============================================================ recruit coaching (paused explanation cards)
// The game freezes (rope, beat timer, visitor wait) while a card is shown; the visitor's ring is spotlit.
;                                                 
;                                                                                                                  
const COACH                               = {
  recruit: [
    { title: "cR1t", lines: ["cR1a", "cR1b"], btn: "cNext", hole: "visitor" },
    { title: "cR2t", lines: ["cR2a", "cR2b", "cR2c"], steps: true, btn: "cTry", hole: "both" },
  ],
  ok: [{ title: "cOkT", lines: ["cOkA", "cOkB"], btn: "cGo", hole: "" }],
  miss: [{ title: "cMissT", lines: ["cMissA", "cMissB"], btn: "cRetry", hole: "" }],
  gold: [{ title: "cGoldT", lines: ["cGoldA", "cGoldB"], btn: "cTry", hole: "visitor" }],
};
let coach                                       = null;
let pendingCoach                                     = null;
let coachReadyAt = 0;
const coachG = new PIXI.Graphics();
const hintG = new PIXI.Graphics();
let hintTx                   = null;

function needsRecruitHint() { return !!run && !run.calib && !P.recruitTaught; }
function maybeCoachOnWait(v       )          {
  const r = run; if (!r || autoplay) return false;
  if (r.tutorial) {
    const st = TUT_STEPS[r.tutStep];
    if (st === "learn-m2" && !r.coached.recruit) { r.coached.recruit = true; openCoach("recruit"); return true; }
    if (st === "learn-m4" && v.kind === "gold" && !r.coached.gold) { r.coached.gold = true; openCoach("gold"); return true; }
    return false;
  }
  if (!r.calib && !P.recruitTaught && !r.coached.recruit) { r.coached.recruit = true; openCoach("recruit"); return true; }
  return false;
}
function openCoach(id         ) {
  if (!run) return;
  if (autoplay) { coach = { id, page: 0 }; coachDone(); return; }
  coach = { id, page: 0 };
  sfx("unlock");
  renderCoach(); refreshHud(true);
}
function coachNext() {
  if (!coach || performance.now() < coachReadyAt) return;
  sfx("ui.click");
  if (coach.page < COACH[coach.id].length - 1) { coach.page++; renderCoach(); return; }
  coachDone();
}
function coachDone() {
  const c = coach; coach = null;
  renderCoach();
  lastFrame = performance.now();
  const r = run; if (!r || !c) return;
  if (visitor) visitor.life = 0; // full waiting time after the pause
  r.graceBeats = Math.max(r.graceBeats, 1); // the beat right after resuming never trips
  if (c.id === "ok" && r.tutorial && TUT_STEPS[r.tutStep] === "learn-m2") advanceTut();
  else if (c.id === "miss" && r.tutorial && !visitor) spawnVisitor("normal");
  refreshHud(true);
}
function renderCoach() {
  const show = !!coach && !!run && screen === "play";
  if (!show) { coachEl.style.display = "none"; coachEl.innerHTML = ""; coachEl.dataset.sig = ""; return; }
  const pages = COACH[coach .id];
  const pg = pages[coach .page];
  const sig = getLang() + coach .id + coach .page;
  coachEl.style.display = "block";
  if (coachEl.dataset.sig !== sig) {
    coachEl.dataset.sig = sig;
    const dots = pages.length > 1 ? `<div class="cdots" aria-hidden="true">${pages.map((_, i) => `<i class="${i === coach .page ? "on" : ""}"></i>`).join("")}</div>` : "";
    const lines = pg.lines.map((k, i) => `<p class="cl${pg.steps ? " step" : ""}" style="animation-delay:${0.15 + i * 0.55}s">${esc(t(k))}</p>`).join("");
    coachEl.innerHTML = `${dots}<h3>${esc(t(pg.title))}</h3>${lines}<div class="crow"><button class="btn primary" id="coachBtn" disabled>${esc(t(pg.btn))}</button></div>`;
    coachEl.setAttribute("aria-label", t(pg.title));
    const wait = 450 + pg.lines.length * 550; // deliberate pause: the button wakes up after the last line appears
    coachReadyAt = performance.now() + wait;
    const b = coachEl.querySelector("#coachBtn")                     ;
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", () => coachNext());
    setTimeout(() => { if (b.isConnected) b.disabled = false; }, wait);
  }
  placeCoach();
}
function placeCoach() {
  if (coachEl.style.display === "none") return;
  const s = coachEl.style;
  if (OX >= 250) { // wide window: use the free side area next to the stage
    s.left = "16px"; s.top = "16px"; s.width = Math.min(360, OX - 32) + "px"; s.maxHeight = (VH - 32) + "px";
  } else { // above the sheep, below the score bar, clear of the rope meter
    const cr = col.getBoundingClientRect();
    s.left = (cr.left + 16) + "px"; s.width = Math.max(240, cr.width - 32 - 52) + "px"; s.top = "128px";
    s.maxHeight = Math.max(140, OY + 478 * K - 128) + "px";
  }
}
function drawCoachFx() {
  // spotlight dim with a hole around what the card talks about
  coachG.clear();
  const pg = coach && screen === "play" ? COACH[coach.id][coach.page] : null;
  if (pg && pg.hole) {
    const visW = VW / K, visH = VH / K;
    coachG.rect(-visW, -visH, visW * 3, visH * 3).fill({ color: 0x1e140a, alpha: 0.5 });
    if (pg.hole === "visitor" && visitor) coachG.circle(visitor.x, visitor.y - 22, RING_R + 16).cut();
    else if (pg.hole === "both") coachG.roundRect(46, 516, 318, 124, 26).cut();
  }
  if (!coachG.parent) world.addChild(coachG);
  // bouncing "tap here" arrow over a waiting glowing sheep while the player is still learning
  hintG.clear();
  const v = visitor;
  const want = !!v && v.state === "waiting" && !!run && screen === "play" && (!pendingCoach) &&
    (needsRecruitHint() || (run.tutorial && !run.tutDone && (TUT_STEPS[run.tutStep] === "learn-m2" || TUT_STEPS[run.tutStep] === "learn-m4")));
  if (want && v) {
    const bob = coach ? 0 : Math.abs(Math.sin(elapsed * 5)) * 10;
    const tipY = v.y - 22 - RING_R - 6 - bob;
    hintG.moveTo(v.x, tipY).lineTo(v.x - 15, tipY - 18).lineTo(v.x - 6, tipY - 18).lineTo(v.x - 6, tipY - 34).lineTo(v.x + 6, tipY - 34).lineTo(v.x + 6, tipY - 18).lineTo(v.x + 15, tipY - 18).closePath()
      .fill(0xff8a00).stroke({ width: 3, color: 0xfff8e8 });
    const pul = 1 + ((elapsed * 1.6) % 1) * 0.35;
    hintG.circle(v.x, v.y - 22, RING_R * pul).stroke({ width: 3, color: 0xffffff, alpha: Math.max(0, 1.35 - pul) * 2 });
    if (!hintTx) {
      hintTx = new PIXI.Text({ text: "", style: { fontFamily: ["MpFontDisplay", "ZCOOLKuaiLe", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "sans-serif"], fontSize: 18, fill: 0xc25a00, stroke: { color: 0xfff8e8, width: 5 }, align: "center" } });
      hintTx.anchor.set(0.5, 1);
    }
    const txt = t("cHint"); if (hintTx.text !== txt) hintTx.text = txt;
    hintTx.position.set(Math.min(v.x, DW - 8 - hintTx.width / 2), tipY - 38);
    hintTx.visible = true;
  } else if (hintTx) hintTx.visible = false;
  if (!hintG.parent) world.addChild(hintG);
  if (hintTx && !hintTx.parent) world.addChild(hintTx);
}

// ============================================================ calibration
function calibTap(tRaw        ) {
  if (!run) return;
  const last = run.beats.length ? run.beats[run.beats.length - 1] : null;
  const nT = nextBeatTime();
  const dL = last ? tRaw - last.t : 99, dN = tRaw - nT;
  const d = Math.abs(dL) < Math.abs(dN) ? dL : dN;
  if (Math.abs(d) > 0.3) return;
  run.calTaps.push(d);
  for (const s of flock) { s.jumpT = 0; s.jumpDur = 0.4; s.jumpDelay = 0; s.jumpH = 50; }
  if (run.calTaps.length >= 8) {
    const a = run.calTaps.slice().sort((x, y) => x - y);
    const med = (a[3] + a[4]) / 2;
    P.latency = Math.round(Math.max(-200, Math.min(200, med * 1000)));
    void saveProgress();
    overlay = "calib-done"; screen = "pause";
    renderUI();
  }
  refreshHud(true);
}

// ============================================================ update loop
function step(dt        ) {
  if (!run || screen !== "play" || coach) return;
  const r = run;
  if (pendingCoach && r.time >= pendingCoach.at) { const id = pendingCoach.id; pendingCoach = null; openCoach(id); if (coach) return; }
  r.time += dt;
  // advance rope phase; may cross several beats in big dt
  let remain = dt;
  while (remain > 0) {
    const rate = beatRate();
    const toNext = (Math.floor(r.phase) + 1 - r.phase) / rate;
    if (toNext <= remain) {
      r.phase = Math.floor(r.phase) + 1;
      remain -= toNext;
      const tCross = r.time - remain;
      if (r.phase >= 0) onBeat(tCross, r.phase);
      if (autoplay && r.phase >= 0) autoTap(tCross);
    } else { r.phase += remain * rate; remain = 0; }
  }
  // resolve missed beats
  const w = windows();
  const shift = lambShift();
  for (const b of r.beats) {
    if (!b.jumped && !b.resolved && r.time > b.t - shift + w.good + Math.max(0, P.latency / 1000) + 0.01) {
      b.resolved = true;
      if (!b.grace && !r.calib && !r.over && !(r.tutorial && r.tutStep === 0)) trip("late");
    }
  }
  // delayed sounds
  for (let i = r.delayed.length - 1; i >= 0; i--) if (r.time >= r.delayed[i].at) { sfx(r.delayed[i].id); r.delayed.splice(i, 1); }
  // visitor lifecycle
  if (visitor) {
    const v = visitor; v.life += dt;
    if (v.state === "arriving") { v.x -= 170 * dt; if (v.x <= v.tx) { v.x = v.tx; v.state = "waiting"; v.life = 0; if (maybeCoachOnWait(v)) return; } }
    else if (v.state === "waiting") {
      const wait = (r.tutorial ? 8 : 3.2) / beatRate() * (r.tutorial ? 1 : 1);
      if (v.life > Math.max(2.2, wait)) v.state = "leaving";
    } else if (v.state === "leaving") {
      v.x += 200 * dt; v.c.scale.x = -Math.abs(v.c.scale.x);
      if (v.x > 470) {
        if (v.kind === "gold") r.goldPassed++;
        const k = v.kind; v.c.destroy({ children: true }); visitor = null; tutOnLeave(k);
        if (r.tutorial && TUT_STEPS[r.tutStep] === "learn-m2" && !autoplay) pendingCoach = { id: "miss", at: r.time + 0.2 };
        else if (r.tutorial && TUT_STEPS[r.tutStep] === "learn-m2") spawnVisitor("normal");
      }
    }
  }
  if (autoplay && visitor && visitor.state === "waiting" && !(visitor       )._decided) {
    (visitor       )._decided = true; (visitor       )._take = autoplay.recruit(visitor.kind);
  }
}

// autoplay bot for tests: taps exactly on each beat (lamb-shifted), recruits per policy
function autoTap(tBeat        ) {
  if (!run) return;
  const take = !!(visitor && visitor.state === "waiting" && (visitor       )._take);
  const shift = lambShift();
  // emulate a tap exactly at the beat
  const last = run.beats[run.beats.length - 1];
  if (!last || last.jumped || last.resolved) return;
  const jitter = (autoplay       ).jitter || 0;
  const err = (Math.random() - 0.5) * 2 * jitter;
  const tc = last.t - shift + err;
  const w = windows();
  if (Math.abs(err) <= w.good) { last.jumped = true; doJump(Math.abs(err) <= w.perfect, take, err); }
  else { last.resolved = true; trip(err < 0 ? "early" : "late"); }
  void tc;
}

let lastFrame = performance.now();
function frame() {
  const now = performance.now();
  const realDt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  let dt = realDt;
  if (fx) { try { const sc = fx.update(realDt); if (typeof sc === "number" && isFinite(sc)) dt = realDt * sc; } catch { /* */ } }
  if (screen === "play" && run) step(dt);
  render(dt);
}

// ============================================================ render
let elapsed = 0;
function render(dt        ) {
  if (!assetsReady) return;
  elapsed += dt;
  const r = run;
  const phase = r ? r.phase : elapsed * 0.6;
  const frac = phase - Math.floor(phase);
  const ang = frac * Math.PI * 2;
  const weather          = r && screen !== "title" ? r.weather : "sunny";
  // windmill sails
  sails.clear();
  const hubX = 52, hubY = GROUND + 6 - 250 * 0.82;
  const sailRot = elapsed * 0.6 + phase * 0.5;
  for (let i = 0; i < 4; i++) {
    const a = sailRot + i * Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = (u        , v        ) => [hubX + ca * u - sa * v, hubY + sa * u + ca * v];
    const p1 = px(8, -6), p2 = px(92, -14), p3 = px(92, 14), p4 = px(8, 6);
    sails.poly([p1[0] + 3, p1[1] + 3, p2[0] + 3, p2[1] + 3, p3[0] + 3, p3[1] + 3, p4[0] + 3, p4[1] + 3]).fill({ color: 0x3a2a16, alpha: 0.18 });
    sails.poly([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]]).fill(themeIsSnow() ? 0xeef3f8 : 0xe9cf9a).stroke({ width: 1.5, color: 0xb59262 });
  }
  sails.circle(hubX, hubY, 9).fill(0x8a5a36);
  // rope turner: arm frame follows the rope phase (frame ~6 = arm up = rope at the top)
  const ta = themeIsSnow() ? ANIM.snowman : ANIM.scarecrow;
  if (ta) { const n = ta.frames.length; const off = themeIsSnow() ? -2 : 0; turnerSpr.texture = ta.frames[(Math.floor(frac * n) + off + n) % n]; }
  // rope ends rotate on small circles
  const e1x = ROPE_L.x + Math.sin(ang) * 9, e1y = ROPE_L.y + Math.cos(ang) * 9;
  const e2x = ROPE_R.x + Math.sin(ang) * 9, e2y = ROPE_R.y + Math.cos(ang) * 9;
  crankG.clear().circle(ROPE_L.x, ROPE_L.y, 6).fill(0x8a5a36).moveTo(ROPE_L.x, ROPE_L.y).lineTo(e1x, e1y).stroke({ width: 4, color: 0x8a5a36 });
  crankG.moveTo(52, GROUND - 40).lineTo(ROPE_L.x, ROPE_L.y).stroke({ width: 5, color: 0x9a6a3e });
  const handY = (e1y + e2y) / 2;
  const breeze = weather === "breeze";
  const a0 = breeze ? -10 : -60, a1 = breeze ? 82 : 132; // mid offset = a0 + a1*cos
  const midOff = a0 + a1 * Math.cos(ang);
  const ctrlY = handY + 2 * midOff;
  const ctrlX = (e1x + e2x) / 2 + (breeze ? Math.sin(elapsed * 2) * 12 : 0);
  const inFront = frac < 0.25 || frac > 0.75;
  const dusk = weather === "dusk";
  const ropeCol = themeIsSnow() ? 0xc23b3b : 0xc8873e;
  const ropeAlpha = dusk ? 0.1 : 1;
  ropeBack.clear(); ropeFront.clear();
  const g = inFront ? ropeFront : ropeBack;
  g.moveTo(e1x + 3, e1y + 4).quadraticCurveTo(ctrlX + 3, ctrlY + 4, e2x + 3, e2y + 4).stroke({ width: 5, color: 0x3a2a16, alpha: 0.18 * ropeAlpha });
  g.moveTo(e1x, e1y).quadraticCurveTo(ctrlX, ctrlY, e2x, e2y).stroke({ width: 5, color: ropeCol, alpha: ropeAlpha });
  // rope ground shadow (key cue at dusk)
  const close = Math.pow((Math.cos(ang) + 1) / 2, 3);
  const shG = dusk ? ropeShadowTop : ropeShadow;
  ropeShadow.clear(); ropeShadowTop.clear();
  shG.ellipse(FLOCK_X, GROUND + 8, 30 + 95 * close, 3 + 5 * close).fill({ color: dusk ? 0x0e0820 : 0x2c4a1e, alpha: (dusk ? 0.35 : 0.12) + (dusk ? 0.6 : 0.25) * close });
  // ground pulse ring (double cue): shrinks to the target moment
  pulseG.clear();
  if (r && screen !== "title") {
    const shift = lambShift();
    const nT = nextBeatTime() - shift;
    const bi = 1 / beatRate();
    let u = (nT - r.time) / bi; if (u > 1) u -= 1; if (u < 0) u += 1;
    const rad = 26 + 110 * u;
    const pulseCol = lambCount() ? 0xff8fb0 : 0xfff3a0;
    pulseG.ellipse(FLOCK_X, GROUND + 8, rad, rad * 0.16).stroke({ width: 4, color: pulseCol, alpha: 0.35 + 0.6 * (1 - u) });
    pulseG.ellipse(FLOCK_X, GROUND + 8, 26, 4.2).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
    const sinceBeat = r.beats.length ? r.time - r.beats[r.beats.length - 1].t : 9;
    if (sinceBeat < 0.12) pulseG.ellipse(FLOCK_X, GROUND + 8, 60, 10).fill({ color: 0xffffff, alpha: 0.4 * (1 - sinceBeat / 0.12) });
  }
  // flock
  const rainbow = P.equipped.skin === "skin_rainbow_wool";
  for (const s of flock) {
    const moving = Math.abs(s.tx - s.x) > 4;
    const faceMove = s.tx < s.x - 4 ? -1 : 1;
    s.x += (s.tx - s.x) * Math.min(1, dt * 8);
    s.y += (s.ty - s.y) * Math.min(1, dt * 8);
    let lift = 0, squash = 1, hopU = -1;
    if (s.jumpT >= 0) {
      s.jumpT += dt;
      const u = (s.jumpT - s.jumpDelay) / s.jumpDur;
      if (u >= 1) { s.jumpT = -1; squash = 0.86; }
      else if (u > 0) { lift = Math.sin(u * Math.PI) * s.jumpH; squash = u < 0.15 ? 0.9 : 1.06; hopU = u; }
    } else { lift = Math.abs(Math.sin(elapsed * 3 + s.id)) * 1.5; }
    if (rainbow) { s.hue = (s.hue + dt * 0.08) % 1; s.spr.tint = s.kind === "normal" ? hsv(s.hue, 0.4, 1) : s.spr.tint; }
    if (hopU >= 0 && sheepAnim(s, "hop", hopU)) {
      // the hop frames already rise ~30 design px inside the cell; code adds the other half of the arc
      placeSheep(s, s.x, s.y, lift * 0.5, 1, 1, lift);
    } else {
      const walking = moving && s.jumpT < 0;
      sheepAnim(s, walking ? "walk" : "idle");
      placeSheep(s, s.x, s.y, lift, squash, walking ? faceMove : 1);
    }
  }
  // visitor + ring
  if (visitor) {
    const v = visitor;
    const bob = v.state === "waiting" ? Math.abs(Math.sin(elapsed * 6)) * 3 : Math.abs(Math.sin(elapsed * 14)) * 5;
    const hasWalk = sheepAnim(v, v.state === "waiting" ? "idle" : "walk");
    // arriving/waiting face the flock (left); leaving: the container is flipped, so face -1 nets facing right
    placeSheep(v, v.x, v.y, hasWalk && v.state !== "waiting" ? 0 : bob, 1, hasWalk || v.state === "leaving" ? -1 : 1);
    ringG.clear();
    if (v.state === "waiting" || v.state === "arriving") {
      const pul = 1 + Math.sin(elapsed * 8) * 0.06;
      const col = v.kind === "gold" ? 0xffb300 : v.kind === "black" ? 0xb07cff : v.kind === "lamb" ? 0xff8fb0 : v.kind === "bell" ? 0x6cc3ff : 0xffd84a;
      ringG.ellipse(v.x, v.y + 2, 40 * pul, 11 * pul).fill({ color: col, alpha: 0.35 }).stroke({ width: 4, color: col, alpha: 0.95 });
      ringG.circle(v.x, v.y - 22, RING_R * pul).stroke({ width: 3, color: col, alpha: 0.55 });
      if (v.kind === "bell") ringG.circle(v.x + 14, v.y - 30, 7).fill(0xffcf3a);
    }
    if (!ringG.parent) fxLayer.addChildAt(ringG, 0);
  } else ringG.clear();
  // fleeing sheep
  for (let i = fleeing.length - 1; i >= 0; i--) {
    const f = fleeing[i]; f.life += dt;
    f.x += f.vx * dt; f.vy += 500 * dt; f.y += f.vy * dt;
    sheepAnim(f, "tuck");
    if (f.y > GROUND + 20) { f.y = GROUND + 20; f.vy = -Math.abs(f.vy) * 0.3; }
    placeSheep(f, f.x, f.y, 0, 1, f.vx < 0 ? -1 : 1);
    f.spr.rotation += f.spin * dt; f.shadowSpr.rotation = f.spr.rotation;
    f.c.alpha = Math.max(0, 1 - f.life / 1.6);
    if (f.life > 1.6) { f.c.destroy({ children: true }); fleeing.splice(i, 1); }
  }
  // particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt;
    p.vy += p.grav * dt; p.g.x += p.vx * dt; p.g.y += p.vy * dt; p.g.alpha = Math.max(0, 1 - p.life / p.max);
    if (p.life >= p.max) { p.g.parent?.removeChild(p.g); partPool.push(p.g); parts.splice(i, 1); }
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.life += dt; p.t.y += p.vy * dt; p.vy *= 0.96; p.t.alpha = Math.max(0, 1 - Math.max(0, p.life - 0.6) / 0.5);
    if (p.life > 1.1) { p.t.destroy(); pops.splice(i, 1); }
  }
  // weather visuals
  duskOverlay.alpha += ((dusk ? 0.55 : 0) - duskOverlay.alpha) * Math.min(1, dt * 2);
  updateDrops(dt, weather);
  // shake
  if (r && r.shake > 0) { r.shake -= dt; const m = r.shake * 14; world.position.set(OX + (Math.random() - 0.5) * m, OY + (Math.random() - 0.5) * m); }
  else world.position.set(OX, OY);
  drawCoachFx();
  if (r && screen === "play") hudTick();
}
function placeSheep(s       , x        , y        , lift        , squash        , face        , shadowLift = lift) {
  s.c.position.set(x, y);
  const sc = s.sc * (ANIM.idle ? SHEEP_ANIM_K : 1);
  s.spr.scale.set(sc * face / Math.sqrt(squash), sc * squash);
  s.spr.y = -lift;
  s.shadowSpr.scale.copyFrom(s.spr.scale); s.shadowSpr.position.set(4, -lift + 4);
  const gsc = Math.max(0.4, 1 - shadowLift / 120);
  s.ground.scale.set(gsc * s.sc / (SHEEP_W / 512), gsc);
}
function updateDrops(dt        , w         ) {
  const want = w === "rain" ? 60 : w === "breeze" ? 14 : themeIsSnow() && screen !== "loading" ? 26 : 0;
  while (drops.length < want) {
    const g = new PIXI.Graphics();
    const kind = w === "rain" ? "rain" : w === "breeze" ? "leaf" : "snow";
    if (kind === "rain") g.moveTo(0, 0).lineTo(-4, 14).stroke({ width: 2, color: 0xbfe3ff, alpha: 0.8 });
    else if (kind === "leaf") g.ellipse(0, 0, 6, 3).fill(0x8fd16a);
    else g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.9 });
    weatherLayer.addChild(g);
    drops.push({ g, x: Math.random() * DW * 1.4 - DW * 0.2, y: Math.random() * DH, v: kind === "rain" ? 520 : 50 + Math.random() * 40, kind });
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const desired = w === "rain" ? "rain" : w === "breeze" ? "leaf" : "snow";
    if (i >= want || d.kind !== desired) { d.g.destroy(); drops.splice(i, 1); continue; }
    if (d.kind === "rain") { d.y += d.v * dt; d.x -= d.v * 0.25 * dt; }
    else if (d.kind === "leaf") { d.x -= 120 * dt; d.y += Math.sin(elapsed * 3 + i) * 30 * dt + 10 * dt; d.g.rotation += dt * 3; }
    else { d.y += d.v * dt; d.x += Math.sin(elapsed + i) * 12 * dt; }
    if (d.y > DH + 20) { d.y = -20; d.x = Math.random() * DW * 1.4 - DW * 0.2; }
    if (d.x < -DW * 0.4) d.x = DW * 1.3;
    d.g.position.set(d.x, d.y);
  }
}

// ============================================================ HUD
let hudBuilt = false;
const H                              = {};
function buildHud() {
  hud.innerHTML = `
  <div id="hudTop"><div id="score" aria-live="off">0</div><div id="mult">×1.0</div><div id="bells"></div></div>
  <button class="btn" id="pauseBtn"></button>
  <div id="meter" role="meter" aria-valuemin="60" aria-valuemax="180"><div id="meterIn"><div id="meterCover"></div><div id="meterMark"></div></div></div>
  <div id="meterLbl"></div>
  <button class="btn" id="dogBtn"><img src="${asset("assets/sprites/dog.webp")}" alt=""><span id="dogTxt"></span></button>
  <div id="info"></div>
  <div id="tut" style="display:none"></div>`;
  for (const id of ["score", "mult", "bells", "pauseBtn", "meter", "meterCover", "meterMark", "meterLbl", "dogBtn", "dogTxt", "info", "tut"]) H[id] = document.getElementById(id) ;
  H.pauseBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
  H.pauseBtn.addEventListener("click", () => { sfx("ui.click"); pauseGame(); });
  H.dogBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
  H.dogBtn.addEventListener("click", () => { useDog(); });
  hudBuilt = true;
}
let lastHud = "";
function refreshHud(force = false) {
  if (!hudBuilt) buildHud();
  const show = screen === "play" || (screen === "pause" && !!run);
  hud.style.display = show && run ? "block" : "none";
  if (!run) return;
  const r = run;
  H.score.textContent = String(Math.floor(r.score));
  H.mult.textContent = "×" + r.mult.toFixed(1);
  const key = r.bells + "/" + r.maxBells;
  if (force || key !== lastHud) { lastHud = key; let b = ""; for (let i = 0; i < r.maxBells; i++) b += BELL_SVG(i < r.bells); H.bells.innerHTML = b; H.bells.setAttribute("aria-label", r.bells + "/" + r.maxBells); }
  const bpm = currentBpm();
  const u = (bpm - 60) / 120;
  H.meterCover.style.height = (100 - u * 100) + "%";
  H.meterMark.style.bottom = "calc(" + (u * 100) + "% - 2px)";
  H.meter.setAttribute("aria-valuenow", String(bpm));
  H.meterLbl.textContent = t("bpm") + " " + bpm;
  H.pauseBtn.textContent = "Ⅱ"; H.pauseBtn.setAttribute("aria-label", t("pause"));
  const dogShow = !r.tutorial && !r.calib && P.up.dog > 0;
  H.dogBtn.style.display = dogShow ? "flex" : "none";
  (H.dogBtn                     ).disabled = r.dogLeft <= 0;
  H.dogTxt.textContent = t("dog") + " ×" + r.dogLeft;
  H.dogBtn.setAttribute("aria-label", t("dog") + " " + r.dogLeft);
  const parts           = [];
  if (r.calib) parts.push(t("calTitle") + " " + t("calCount", { n: r.calTaps.length }));
  else {
    parts.push(t("w_" + r.weather).split("：")[0].split(":")[0]);
    if (!r.tutorial) parts.push(t("newSegment", { n: r.segment }));
    parts.push("🐑" + flock.length);
  }
  H.info.textContent = parts.join(" · ");
  // tutorial banner
  if (r.tutorial && !r.tutDone && screen === "play" && coach) H.tut.style.display = "none";
  else if (r.tutorial && !r.tutDone && screen === "play") {
    const id = TUT_STEPS[r.tutStep];
    H.tut.style.display = "block";
    const sig = getLang() + id;
    if (force || H.tut.dataset.sig !== sig) {
      H.tut.dataset.sig = sig;
      H.tut.innerHTML = `<div class="tutTop"><span>${esc(t("tutStep", { a: r.tutStep + 1, b: TUT_STEPS.length }))}</span><button class="btn" id="tutSkip" style="pointer-events:auto">${esc(t("tutSkip"))}</button></div><div>${esc(t("tut_" + id))}</div>`;
      const sk = document.getElementById("tutSkip") ;
      sk.addEventListener("pointerdown", (e) => e.stopPropagation());
      sk.addEventListener("click", () => { sfx("ui.click"); finishTutorial(true); });
    }
  } else if (r.calib && screen === "play") {
    H.tut.style.display = "block";
    const sig = getLang() + "calib";
    if (force || H.tut.dataset.sig !== sig) { H.tut.dataset.sig = sig; H.tut.innerHTML = `<div>${esc(t("calInfo"))}</div>`; }
  } else H.tut.style.display = "none";
}
let hudAcc = 0;
function hudTick() { hudAcc++; if (hudAcc % 4 === 0) refreshHud(); }

// ============================================================ screens
function pauseGame() { if (screen !== "play" || !run || run.over) return; screen = "pause"; overlay = ""; renderUI(); }
function resumeGame() { if (screen !== "pause" || !run) return; screen = "play"; overlay = ""; lastFrame = performance.now(); renderUI(); refreshHud(true); }
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });

function langChips() {
  return `<div class="langs" role="group" aria-label="Language">${LANGS.map((l) => `<button class="lang" data-lang="${l}" lang="${l}" aria-pressed="${getLang() === l}">${LANG_NAMES[l]}</button>`).join("")}</div>`;
}
function bind(root             ) {
  root.querySelectorAll             ("[data-lang]").forEach((b) => b.addEventListener("click", () => { manualLang = true; sfx("ui.click"); applyLang(b.dataset.lang        ); }));
  root.querySelectorAll             ("[data-act]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", () => act(b.dataset.act , b));
  });
}
function act(a        , el             ) {
  if (a !== "buy") sfx("ui.click");
  switch (a) {
    case "start": if (!P.tutorialDone) startRun({ tutorial: true }); else startRun(); break;
    case "restart": startRun(); break;
    case "ranch": overlay = "ranch"; renderUI(); break;
    case "help": overlay = "help"; renderUI(); break;
    case "close": overlay = ""; renderUI(); break;
    case "menu": run = null; clearFlock(); screen = "title"; overlay = ""; syncAmbience(); renderUI(); refreshHud(); break;
    case "resume": resumeGame(); break;
    case "quit": if (run && !run.tutorial && !run.calib) { screen = "play"; endRun(); } else act("menu", el); break;
    case "replayTut": startRun({ tutorial: true }); break;
    case "calib": startRun({ calib: true }); break;
    case "calReset": P.latency = 0; void saveProgress(); renderUI(); break;
    case "tutGo": startRun(); break;
    case "up": upgrade(el.dataset.k       ); break;
    case "buy": doBuy(el.dataset.item          ); renderUI(); break;
    case "equip": equip(el.dataset.item          ); break;
    case "style": P.style = el.dataset.s       ; applyStyle(); void saveProgress(); renderUI(); break;
  }
}

function renderUI() {
  refreshHud(true);
  let h = "";
  if (screen === "title" && !overlay) h = titleHtml();
  else if (screen === "pause" && !overlay) h = pauseHtml();
  else if (screen === "results" && !overlay) h = resultsHtml();
  if (overlay === "ranch") h = ranchHtml();
  else if (overlay === "help") h = helpHtml();
  else if (overlay === "tut-done") h = `<div class="panel" data-mp-scroll><h2>${esc(t("tutDone"))}</h2><p>${esc(t("tutDoneSub"))}</p><div class="row"><button class="btn primary" data-act="tutGo">${esc(t("tutGo"))}</button></div><div class="row"><button class="btn blue" data-act="calib">${esc(t("calibrate"))}</button></div></div>`;
  else if (overlay === "calib-done") h = `<div class="panel" data-mp-scroll><h2>${esc(t("calTitle"))}</h2><p>${esc(t("calDone", { n: P.latency }))}</p><div class="row"><button class="btn primary" data-act="menu">${esc(t("menu"))}</button><button class="btn" data-act="calib">${esc(t("retry"))}</button></div></div>`;
  screenEl.innerHTML = h;
  bind(screenEl);
  renderCoach();
}

function titleHtml() {
  return `<div class="panel" style="background:rgba(255,248,232,.95)">
  ${langChips()}
  <div class="title">${esc(t("title"))}</div>
  <p class="tagline">${esc(t("tagline"))}</p>
  <div><span class="stat">${esc(t("best"))} <b>${P.best}</b></span><span class="stat">${esc(t("bestSheep"))} <b>${P.bestSheep}</b></span><span class="stat">${esc(t("wool"))} <b>${P.wool}</b></span></div>
  <div class="row"><button class="btn primary" data-act="start" style="min-width:200px">${esc(t("start"))}</button></div>
  <div class="row"><button class="btn mint" data-act="ranch">${esc(t("ranch"))}</button><button class="btn" data-act="help">${esc(t("help"))}</button></div>
  </div>`;
}
function pauseHtml() {
  const r = run;
  return `<div class="panel" data-mp-scroll>${langChips()}<h2>${esc(t("pause"))}</h2>
  <div class="row"><button class="btn primary" data-act="resume">${esc(t("resume"))}</button></div>
  <div class="row"><button class="btn" data-act="help">${esc(t("help"))}</button><button class="btn peach" data-act="quit">${esc(r && !r.tutorial && !r.calib ? t("quit") : t("menu"))}</button></div></div>`;
}
function resultsHtml() {
  const R = lastResult; if (!R) return "";
  const target = Math.max(R.prevBest, 1);
  const pct = Math.min(100, R.score / target * 100);
  const gap = Math.max(0, (R.prevBest - R.score) / target * 100);
  const hot = !R.newBest && gap <= 5 && R.prevBest > 0;
  let msg = R.newBest ? (R.prevBest > 0 ? t("beatBest") : t("newBest")) : hot ? t("closeToBest", { p: gap.toFixed(1) }) : t("toBest", { p: gap.toFixed(0) });
  return `<div class="panel" data-mp-scroll><h2>${esc(t("results"))}</h2>
  <div style="font-size:40px;color:#5a3e22">${R.score}</div>
  <div class="prog ${hot || R.newBest ? "hot" : ""}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="f" style="width:${R.newBest ? 100 : pct}%"></div></div>
  <p class="${hot || R.newBest ? "hotTxt" : ""}">${esc(msg)} · ${esc(t("best"))} ${Math.max(P.best, R.score)}</p>
  <div><span class="stat">${esc(t("jumps"))} <b>${R.jumps}</b></span><span class="stat">${esc(t("peakSheep"))} <b>${R.peakSheep}</b></span><span class="stat">${esc(t("peakMult"))} <b>×${R.peakMult.toFixed(1)}</b></span><span class="stat">${esc(t("woolEarned"))} <b>+${R.wool}</b></span></div>
  <div class="row"><button class="btn primary" data-act="restart" style="min-width:220px;min-height:64px">${esc(t("restart"))}</button></div>
  <div class="row"><button class="btn mint" data-act="ranch">${esc(t("ranch"))}</button><button class="btn" data-act="menu">${esc(t("menu"))}</button></div></div>`;
}
function ranchHtml() {
  const lv = P.up;
  const upRow = (k                          , label        , level        , max        , value        ) => {
    const cost = (UPGRADE_COST       )[k][level];
    const maxed = level >= max;
    return `<div class="up"><div class="tx">${esc(label)} <b>${esc(value)}</b><br><span class="note">${esc(t("level", { n: level }))}</span></div>
    ${maxed ? `<span class="note">${esc(t("max"))}</span>` : `<button class="btn mint" data-act="up" data-k="${k}" ${P.wool < cost ? "disabled" : ""} aria-label="${esc(t("buy") + " " + label)}">${esc(t("costWool", { n: cost }))}</button>`}</div>`;
  };
  let gal = ""; for (let i = 0; i < Math.min(30, P.bestSheep); i++) gal += `<img src="${asset("assets/sprites/sheep.webp")}" alt="">`;
  const wardrobe = SHOP_ITEMS.map((it) => {
    const owned = !!P.owned[it.id];
    const on = it.id === "skin_rainbow_wool" ? P.equipped.skin === it.id : P.equipped.theme === it.id;
    const label = esc(t("item_" + it.id));
    if (owned) return `<div class="up"><div class="tx">${label}</div><button class="btn ${on ? "" : "blue"}" data-act="equip" data-item="${it.id}" aria-pressed="${on}">${esc(on ? t("unequip") : t("equip"))}</button></div>`;
    const can = P.wool >= it.price;
    return `<div class="up"><div class="tx">${label}<br><span class="note">${esc(t("costWool", { n: it.price }))}</span></div><button class="btn mint" data-act="buy" data-item="${it.id}" ${can ? "" : "disabled"}>${esc(can ? t("buyBtn") : t("locked"))}</button></div>`;
  }).join("");
  const styles = (["paper", "dusk", "collage"]         ).map((s) => `<button class="lang" data-act="style" data-s="${s}" aria-pressed="${P.style === s}">${esc(t("style_" + s))}</button>`).join("");
  return `<div class="panel" data-mp-scroll><h2>${esc(t("ranchTitle"))}</h2><p>${esc(t("wool"))} <b>${P.wool}</b></p>
  ${upRow("start", t("up_start"), lv.start, 4, String(1 + lv.start))}
  ${upRow("bell", t("up_bell"), lv.bell, 1, String(3 + lv.bell))}
  ${upRow("dog", t("up_dog"), lv.dog, 2, String(lv.dog))}
  <p class="note">${esc(t("gallery"))} · ${P.bestSheep}</p><div class="gallery">${gal}</div>
  <p style="margin-top:12px">${esc(t("artStyle"))}</p><div class="langs">${styles}</div>
  <p style="margin-top:12px">${esc(t("wardrobe"))}</p>${wardrobe}
  <div class="row"><button class="btn" data-act="close">${esc(t("back"))}</button></div></div>`;
}
function upgrade(k                          ) {
  const max = k === "start" ? 4 : k === "bell" ? 1 : 2;
  const lv = P.up[k];
  if (lv >= max) return;
  const cost = (UPGRADE_COST       )[k][lv];
  if (P.wool < cost) { toast(t("notEnough")); return; }
  P.wool -= cost; P.up[k] = lv + 1;
  sfx("unlock");
  void saveProgress();
  renderUI();
}
function equip(id        ) {
  if (!P.owned[id]) return;
  if (id === "skin_rainbow_wool") P.equipped.skin = P.equipped.skin === id ? "" : id;
  else { P.equipped.theme = P.equipped.theme === id ? "" : id; applyTheme(); }
  for (const s of flock) s.refreshTint();
  void saveProgress();
  renderUI();
}

// ---------------- wardrobe (paid with in-game wool, the only repeatable wool sink)
/** Buy an appearance item with wool. Returns true when the purchase went through. */
function doBuy(id        ) {
  const it = SHOP_ITEMS.find((x) => x.id === id);
  if (!it || P.owned[id]) return false;
  if (P.wool < it.price) { toast(t("notEnough")); return false; }
  P.wool -= it.price;
  P.owned[id] = true;
  if (id === "skin_rainbow_wool") P.equipped.skin = id;
  else P.equipped.theme = id;
  sfx("unlock");
  applyTheme();
  for (const s of flock) s.refreshTint();
  toast(t("buyOk"));
  void saveProgress();
  return true;
}

function helpHtml() {
  return `<div class="panel" data-mp-scroll>${langChips()}<h2>${esc(t("helpTitle"))}</h2>
  <p style="text-align:left">${esc(t("help1"))}</p><p style="text-align:left">${esc(t("help2"))}</p><p style="text-align:left">${esc(t("help3"))}</p><p style="text-align:left">${esc(t("help4"))}</p>
  <div class="row"><button class="btn primary" data-act="replayTut">${esc(t("replayTut"))}</button></div>
  <div class="row"><button class="btn blue" data-act="calib">${esc(t("calibrate"))}</button><button class="btn" data-act="calReset">${esc(t("calReset"))}</button></div>
  <p class="note">${esc(t("latency", { n: P.latency }))}</p>
  <div class="row"><button class="btn" data-act="close">${esc(t("back"))}</button></div></div>`;
}

// ============================================================ input
function onPointerDown(e              ) {
  if (screen !== "play" || !run) return;
  const rect = (app.canvas                     ).getBoundingClientRect();
  const x = (e.clientX - rect.left - OX) / K, y = (e.clientY - rect.top - OY) / K;
  handleTap(x, y, eventTime(e));
}
function onKey(e               ) {
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp") {
    if (screen === "play" && run && coach) { e.preventDefault(); coachNext(); return; }
    if (screen === "play" && run) {
      e.preventDefault();
      // keyboard: jump; also recruits when a visitor is waiting (desktop convenience is Shift+Space to pass)
      const take = !e.shiftKey && visitor && visitor.state === "waiting";
      handleTap(take ? visitor .x : -999, take ? visitor .y - 22 : -999, run.time);
    }
  } else if (e.code === "KeyD") useDog();
  else if (e.code === "Escape" || e.code === "KeyP") { if (screen === "play") pauseGame(); else if (screen === "pause" && !overlay) resumeGame(); }
}

// ============================================================ boot
/**
 * Boot the game inside `o.mountTo`.
 *
 * Everything that used to run at module top level (document access, listeners, the
 * PIXI.Application) happens here instead — a plugin module is imported onto the host's
 * page and must never assume it owns it.
 *
 * @param {{
 *   mountTo: HTMLElement,
 *   assetBase: string,                                     // "assets/" or an absolute/blob URL ending in "/"
 *   host?: object|null,                                    // storage / mintGameCoin / pushToast / tone
 *   chargePlay?: (() => Promise<boolean>|boolean)|null,     // false ⇒ the round never starts
 * }} o
 */
export async function start(o) {
  if (!o || !o.mountTo) throw new Error("ropeland: mountTo is required");
  host = o.mountTo;
  ASSET_BASE = o.assetBase ?? "assets/";
  chargePlay = o.chargePlay ?? null;
  api = o.host ?? null;
  alive = true; destroyed = false; paying = false;
  // The store is live by now (plugin.js installs it before calling start), so re-read.
  reloadProgress();
  try { W.gp ??= { playCue: id => api?.tone?.(id) }; } catch { /* */ }
  buildShell();
  loadingEl = document.createElement("div"); loadingEl.id = "loading";
  loadingEl.innerHTML = `<div class="hop"></div><div style="margin-top:18px;font-size:20px">${esc(t("loading"))}</div><div class="bar"><div class="fill"></div></div>`;
  col.appendChild(loadingEl);
  await boot();
  if (!alive) return;
  hooksOwner = owner;
  W.__game = TEST_HOOKS;
  W.__gpReady = true;
  return destroy;
}

async function boot() {
  await app.init({ resizeTo: host, autoDensity: true, antialias: true, backgroundColor: 0x8fd0f0, resolution: Math.min(2, window.devicePixelRatio || 1) });
  if (!alive) return;
  host.appendChild(app.canvas                     );
  (app.canvas                     ).style.touchAction = "none";
  display = mountDisplay({ orientation: "portrait", host, onResize: (info     ) => relayout(info.width, info.height) });
  display.attachPixi(app);
  relayout(display.info.width, display.info.height);
  camRoot.addChild(world);
  app.stage.addChild(camRoot);
  app.ticker.add(frame);
  screen = "loading";
  loadFonts();
  void initSound();
  // load assets with real progress
  const urls                         = {
    meadow: "assets/bg/meadow.webp", snow: "assets/bg/snow.webp", sheep: "assets/sprites/sheep.webp",
    scarecrow: "assets/sprites/scarecrow.webp", snowman: "assets/sprites/snowman.webp", windmill: "assets/sprites/windmill.webp",
  };
  const keys = Object.keys(urls);
  const fill = loadingEl.querySelector(".fill")               ;
  let done = 0, total = keys.length + 5;
  const tick = () => { done++; fill.style.width = Math.min(100, done / total * 100) + "%"; };
  await Promise.all([
    ...keys.map(async (k) => {
      try { TEX[k] = await PIXI.Assets.load(asset(urls[k])); } catch { TEX[k] = PIXI.Texture.WHITE; }
      tick();
    }),
    loadAnims(tick, (n) => { total += n - 1; }),
  ]);
  if (!alive) return;
  assetsReady = true;
  setupScene();
  relayout(VW, VH);
  try { fx = await createPixiFx({ PIXI, app, world: fxLayer, referenceSpan: SHEEP_W, photosafe: "auto", onImpulse: (i     ) => { camRoot.position.set(i.offsetX || 0, i.offsetY || 0); camRoot.pivot.set(VW / 2, VH / 2); camRoot.position.x += VW / 2; camRoot.position.y += VH / 2; camRoot.rotation = i.roll || 0; } }); } catch (e) { fx = null; }
  if (!alive) return;
  loadingEl.remove();
  screen = "title";
  renderUI();
  (app.canvas                     ).addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKey);
  W.__gpPlayable = true;
}

/** Tear everything down. Host unmount calls this; it must be safe to call twice. */
export function destroy() {
  if (!destroyed) {
    destroyed = true;
    alive = false;
  }
  if (unmountGame) { const u = unmountGame; unmountGame = null; try { u(); } catch { /* */ } }
  try { app.ticker?.remove(frame); } catch { /* */ }
  try { (app.canvas                     )?.removeEventListener?.("pointerdown", onPointerDown); } catch { /* */ }
  try { window.removeEventListener("keydown", onKey); } catch { /* */ }
  try { display?.dispose?.(); } catch { /* */ }
  try { fx?.destroy?.(); } catch { /* */ }
  try { sound?.dispose?.(); } catch { /* */ }
  // Persist before tearing the renderer down: the save shim buffers writes in memory.
  try { flushProgress(); } catch { /* */ }
  try { app.destroy?.(true, { children: true, texture: false, textureSource: false }); } catch { /* */ }
  try { css.remove(); } catch { /* */ }
  try { root.remove(); } catch { /* */ }
  if (W.__game && hooksOwner === owner && W.__game === TEST_HOOKS) {
    try { delete W.__game; } catch { /* */ }
    hooksOwner = null;
  }
}
