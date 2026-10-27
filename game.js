import * as PIXI from "pixi.js";
import { mountDisplay } from "@makeplay/display";
import { createPixiFx } from "@makeplay/fx";
                                                         
import { loadSoundSystem } from "@makeplay/sound";
                                                           
import {
  CARDS, CARD_MAP, ENEMIES, ICON, RARITY_ORDER, RARITY_RATE, TAG_LABEL,
  PLAYER_MAX_HP, MIN_DECK, WIN_HEAL, HAND_MAX, MODES,
} from "./data.js";
                                      
                                                      
import {
  newBattle, playCard, endTurn, canPlay, currentIntent, intentDamage, snap as snapOf,
} from "./battle.js";
                                                    
import {
  t, lang, setLang, pickLang, isManualLang, cardName, cardText, enemyName, tagName, onLangChange, ACH_KEYS, achText,
} from "./i18n.js";
import { mountUi, updateUi, setCardFacts, toast, groupDeck, resetTutorial } from "./ui.js";
                                               

// ---------- palette (ART_DIRECTION.md) ----------
const P = {
  sand: 0xf1db9e, cream: 0xfbf3dc, coral: 0xef8354, red: 0xd64933, sky: 0x357ca5, skyLt: 0x8cc4e3,
  olive: 0x729b60, gold: 0xe8b839, ink: 0x344657, black: 0x1d232b, purple: 0x7b5ea7, white: 0xffffff,
};
const RAINBOW = [0xef8354, 0xe8b839, 0x729b60, 0x357ca5, 0x7b5ea7];
const RARITY_COLOR                         = { N: P.sand, R: P.sky, SR: P.gold, UR: P.coral };
const JP = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
let NUM = `"LuckiestGuy",${JP}`;

// ---------- run state ----------
                                                               
               
       
               
                
             
                
                 
               
                         
                
                              
                        
                                
             
                                                               
                    
 
let run             = null;
let selectedMode       = "normal";

function newRun(mode      )      {
  return {
    v: 1, phase: "build", stage: 1, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, deck: [], time: MODES[mode].build,
    offer: null, turns: 0, dmg: {}, battle: null, result: null, mode, flawless: true,
  };
}

function save() {
  if (!run || run.phase === "result") return;
  const g = (window       ).gp;
  g?.player?.saves?.putLatest(JSON.stringify(run), "text").then((ok         ) => {
    if (!ok) console.warn("autosave rejected:", g.player.saves.lastError);
  });
}
function clearSave() {
  void (window       ).gp?.player?.saves?.clearLatest();
}
function readSave()             {
  try {
    const raw = (window       ).gp?.player?.saves?.latestSync;
    if (!raw || typeof raw !== "string") return null;
    const r = JSON.parse(raw);
    if (!r || r.v !== 1 || !Array.isArray(r.deck) || typeof r.stage !== "number") return null;
    if (!(r.mode in MODES)) r.mode = "normal";
    if (typeof r.flawless !== "boolean") r.flawless = false;
    return r       ;
  } catch {
    return null;
  }
}

// ---------- engine ----------
const host = document.getElementById("app") ;
const app = new PIXI.Application();
await app.init({
  width: host.clientWidth || window.innerWidth,
  height: host.clientHeight || window.innerHeight,
  background: P.ink,
  antialias: true,
  autoDensity: true,
});
host.appendChild(app.canvas);

const root = new PIXI.Container();
const bgLayer = new PIXI.Container();
const sceneLayer = new PIXI.Container();
const fxWorld = new PIXI.Container();
const popLayer = new PIXI.Container();
const fxScreen = new PIXI.Container();
root.addChild(bgLayer, sceneLayer, fxWorld, popLayer);
app.stage.addChild(root, fxScreen);
app.stage.eventMode = "static";

let W = app.screen.width;
let H = app.screen.height;
let portrait = H > W;
let titleShown = false;
let lastBvRef          = null;

const display = mountDisplay({
  orientation: "both",
  onResize: ({ width, height }) => {
    W = width; H = height; portrait = H > W;
    app.stage.hitArea = new PIXI.Rectangle(0, 0, W, H);
    relayout();
  },
});
display.attachPixi(app);
app.stage.hitArea = new PIXI.Rectangle(0, 0, W, H);

// ---------- loading screen (painted before ready) ----------
const loading = new PIXI.Container();
app.stage.addChild(loading);
const loadBar = new PIXI.Graphics();
const loadSpin = new PIXI.Graphics();
loading.addChild(loadBar, loadSpin);
let loadFrac = 0;
function drawLoading() {
  loadBar.clear();
  const bw = Math.min(W * 0.6, 360);
  const x = (W - bw) / 2, y = H * 0.6;
  loadBar.roundRect(x, y, bw, 18, 9).fill(P.black).stroke({ width: 3, color: P.black });
  loadBar.roundRect(x + 3, y + 3, Math.max(0, (bw - 6) * loadFrac), 12, 6).fill(P.gold);
  loadSpin.clear();
  loadSpin.roundRect(-22, -30, 44, 60, 6).fill(P.sand).stroke({ width: 3, color: P.black });
  loadSpin.circle(0, 0, 10).fill(P.coral).stroke({ width: 2, color: P.black });
  loadSpin.position.set(W / 2, H * 0.45);
}
drawLoading();
const loadTick = (t             ) => { loadSpin.scale.x = Math.cos(performance.now() / 260); drawLoading(); void t; };
app.ticker.add(loadTick);
app.renderer.render(app.stage);
(window       ).__gpReady = true;

// ---------- assets ----------
const tex                               = {};
const artTex                               = {};
const thumbTex                               = {};
const iconTex                 = [];
const ENEMY_IDS = ENEMIES.map((e) => e.id);
{
  const urls                         = {
    "bg-courtyard": "assets/bg/courtyard.webp", "bg-forest": "assets/bg/forest.webp",
    "bg-volcano": "assets/bg/volcano.webp", "bg-gacha": "assets/bg/gacha.webp",
    hero: "assets/hero.webp", icons: "assets/icons.webp",
  };
  for (const id of ENEMY_IDS) urls["enemy-" + id] = `assets/enemies/${id}.webp`;
  for (const c of CARDS) urls["card-" + c.id] = `assets/cards/${c.id}.webp`;
  const keys = Object.keys(urls);
  const loaded = await PIXI.Assets.load(keys.map((k) => ({ alias: k, src: urls[k] })), (p) => { loadFrac = p; });
  for (const k of keys) tex[k] = loaded[k];
  const it = tex.icons;
  const cell = it.width / 4;
  for (let i = 0; i < 16; i++) {
    iconTex.push(new PIXI.Texture({ source: it.source, frame: new PIXI.Rectangle((i % 4) * cell, Math.floor(i / 4) * cell, cell, cell) }));
  }
  for (const c of CARDS) {
    const t = tex["card-" + c.id];
    const s = t.width;
    const h = s * (130 / 180);
    artTex[c.id] = new PIXI.Texture({ source: t.source, frame: new PIXI.Rectangle(0, (s - h) / 2, s, h) });
    thumbTex[c.id] = t;
  }
}

// fonts never block first paint
{
  const fontUrl = (window       ).gp?.fonts?.url?.("google-fonts-apache/luckiest-guy/LuckiestGuy-Regular.ttf")
    ?? "https://static.makeplay.ai/fonts/v1/google-fonts-apache/luckiest-guy/LuckiestGuy-Regular.ttf";
  const f = new FontFace("LuckiestGuy", `url("${fontUrl}")`);
  void f.load().then(() => { document.fonts.add(f); relayout(); }).catch(() => { NUM = JP; });
}

// ---------- sound ----------
const sound = (await loadSoundSystem({ manifestUrl: "./sound.manifest.json" }))                    ;
let audioOn = false;
async function unlockAudio() {
  if (audioOn) return;
  audioOn = true;
  await sound.unlock();
  await sound.preload("gameplay");
  syncMusic();
}
window.addEventListener("pointerdown", () => { void unlockAudio(); });
window.addEventListener("keydown", () => { void unlockAudio(); });
window.addEventListener("pagehide", () => { save(); void sound.dispose(); }, { once: true });
let musicNow = "";
function syncMusic() {
  if (!audioOn || !run) return;
  const want = run.phase === "battle" ? (run.stage === 6 ? "boss" : "battle") : run.phase === "result" ? "" : "build";
  if (want === musicNow) return;
  musicNow = want;
  if (want === "build") void sound.setMusicState("build", { eventId: "m-build" });
  else if (want === "battle") void sound.setMusicState("battle", { eventId: "m-battle" });
  else if (want === "boss") void sound.setMusicState("boss", { eventId: "m-boss" });
}
let sfxSeq = 0;
const sid = () => `e${++sfxSeq}`;

// ---------- FX ----------
let impulse            = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
const REF_SPAN = 160;
const fx = await createPixiFx({
  PIXI, app, world: fxWorld, screen: fxScreen, referenceSpan: REF_SPAN,
  onImpulse: (n) => { impulse = n; },
});
const fxScale = () => Math.max(0.55, Math.min(1.6, Math.min(W, H) / 640));
let warnReceipt                   = null;

// ---------- tweens ----------
                                                                               
const tweens       = [];
const easeOut = (k        ) => 1 - (1 - k) * (1 - k);
function tween(d        , fn                     )                {
  return new Promise((res) => { tweens.push({ t: 0, d: Math.max(0.001, d), fn, res }); });
}
const wait = (d        ) => tween(d, () => {});
function stepTweens(dt        ) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.d);
    try { tw.fn(k); } catch { /* target destroyed by relayout */ }
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}

// ---------- drawing helpers ----------
function txt(s        , size        , color = P.ink, opts                                 = {})            {
  const t = new PIXI.Text({
    text: s,
    style: { fontFamily: JP, fontWeight: "900", fontSize: size, fill: color, ...opts },
    resolution: Math.max(2, app.renderer.resolution),
  });
  return t;
}
function num(s        , size        , color = P.white, strokeW = 0)            {
  return txt(s, size, color, { fontFamily: NUM, fontWeight: "400", stroke: { color: P.black, width: strokeW || Math.max(3, size * 0.14), join: "round" } });
}
function icon(i        , size        )              {
  const s = new PIXI.Sprite(iconTex[i]);
  s.anchor.set(0.5);
  s.width = s.height = size;
  return s;
}
function rainbow()                    {
  return new PIXI.FillGradient({
    type: "linear", start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, textureSpace: "local",
    colorStops: RAINBOW.map((c, i) => ({ offset: i / (RAINBOW.length - 1), color: c })),
  });
}
function button(label        , w        , h        , color        , onTap            , size = 0)                                                    {
  const c = new PIXI.Container()                                                     ;
  const g = new PIXI.Graphics();
  const draw = (en         ) => {
    if (g.destroyed) return;
    g.clear();
    g.roundRect(-w / 2, -h / 2 + 4, w, h, h * 0.3).fill(P.black);
    g.roundRect(-w / 2, -h / 2, w, h, h * 0.3).fill(en ? color : 0x9aa3ab).stroke({ width: 3, color: P.black });
  };
  draw(true);
  const t = txt(label, size || h * 0.42, P.white, { stroke: { color: P.black, width: 4, join: "round" } });
  t.anchor.set(0.5);
  if (t.width > w - 12) t.scale.set((w - 12) / t.width);
  c.addChild(g, t);
  c.eventMode = "static";
  c.cursor = "pointer";
  let enabled = true;
  c.setEnabled = (b) => { enabled = b; draw(b); c.cursor = b ? "pointer" : "default"; };
  c.on("pointertap", () => { if (!enabled) return; void sound.playCue("ui.click", { eventId: sid() }); onTap(); });
  c.on("pointerdown", () => { if (enabled) c.scale.set(0.95); });
  c.on("pointerup", () => c.scale.set(1));
  c.on("pointerupoutside", () => c.scale.set(1));
  return c;
}

const CARD_W = 200, CARD_H = 278;
/** A card face drawn at 200×278 local units; scale the returned container to size it. */
function makeCard(def         )                 {
  const c = new PIXI.Container();
  const name = cardName(def.id);
  const body = cardText(def.id);
  const g = new PIXI.Graphics();
  const fill = def.unplayable ? P.purple : def.rarity === "UR" ? rainbow() : RARITY_COLOR[def.rarity];
  g.roundRect(0, 4, CARD_W, CARD_H, 16).fill(P.black);
  g.roundRect(0, 0, CARD_W, CARD_H, 16).fill(fill).stroke({ width: 4, color: P.black });
  g.roundRect(10, 34, 180, 130, 6).fill(P.ink).stroke({ width: 3, color: P.black });
  g.roundRect(10, 172, 180, 96, 8).fill(P.cream).stroke({ width: 3, color: P.black });
  c.addChild(g);
  if (artTex[def.id]) {
    const a = new PIXI.Sprite(artTex[def.id]);
    a.position.set(11.5, 35.5);
    a.width = 177; a.height = 127;
    c.addChild(a);
  } else {
    const sk = icon(ICON.curse, 100);
    sk.position.set(100, 99);
    c.addChild(sk);
  }
  const nm = txt(name, 22, def.rarity === "N" || def.rarity === "SR" ? P.ink : P.white,
    def.rarity === "N" || def.rarity === "SR" ? {} : { stroke: { color: P.black, width: 4, join: "round" } });
  nm.anchor.set(0.5);
  nm.position.set(110, 18);
  if (nm.width > 140) nm.scale.set(140 / nm.width);
  c.addChild(nm);
  // description
  const d = txt(body, 19, P.ink, { wordWrap: true, breakWords: true, wordWrapWidth: 166, align: "center", lineHeight: 23 });
  let fs = 19;
  while (d.height > 86 && fs > 11) { fs--; d.style.fontSize = fs; d.style.lineHeight = fs * 1.2; d.style.wordWrapWidth = 166; }
  d.anchor.set(0.5);
  d.position.set(100, 220);
  c.addChild(d);
  // cost gem
  if (!def.unplayable) {
    const gem = new PIXI.Graphics();
    gem.circle(20, 20, 22).fill(P.sky).stroke({ width: 4, color: P.black });
    gem.circle(14, 13, 6).fill({ color: P.white, alpha: 0.5 });
    c.addChild(gem);
    const ct = num(String(def.cost), 30);
    ct.anchor.set(0.5);
    ct.position.set(20, 22);
    c.addChild(ct);
  }
  if (def.tag) {
    const tb = new PIXI.Graphics();
    tb.circle(176, 150, 18).fill(P.cream).stroke({ width: 3, color: P.black });
    c.addChild(tb);
    const ti = icon(ICON[def.tag], 28);
    ti.position.set(176, 150);
    c.addChild(ti);
  }
  if (!def.unplayable) {
    const rb = new PIXI.Graphics();
    rb.roundRect(14, 140, 40, 20, 6).fill(def.rarity === "UR" ? rainbow() : RARITY_COLOR[def.rarity]).stroke({ width: 2, color: P.black });
    c.addChild(rb);
    const rt = num(def.rarity, 14);
    rt.anchor.set(0.5);
    rt.position.set(34, 151);
    c.addChild(rt);
  }
  return c;
}

function destroyChildren(c) {
  if (!c) return;
  for (const child of [...c.children]) child.destroy({ children: true });
}

function coverSprite(t              , x        , y        , w        , h        , focusY = 0.5)                 {
  const c = new PIXI.Container();
  const bgSprite = new PIXI.Sprite(t);
  const sc = Math.max(w / t.width, h / t.height);
  bgSprite.scale.set(sc);
  bgSprite.position.set(x + (w - t.width * sc) / 2, y + (h - t.height * sc) * focusY);
  const m = new PIXI.Graphics().rect(x, y, w, h).fill(P.white);
  c.addChild(bgSprite, m);
  bgSprite.mask = m;
  return c;
}

// ---------- popups / banners ----------
function popup(s        , x        , y        , color        , size        , rise = 60, life = 0.8) {
  const t = num(s, size, color);
  t.anchor.set(0.5);
  t.position.set(x, y);
  popLayer.addChild(t);
  const sx = (Math.random() - 0.5) * 30;
  void tween(life, (k) => {
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5);
    t.scale.set(pop);
    t.position.set(x + sx * k, y - rise * easeOut(k));
    t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  }).then(() => t.destroy());
}
function banner(s        , size        , color = P.white, life = 1.4, yFrac = 0.4) {
  const c = new PIXI.Container();
  const t = txt(s, size, color, { stroke: { color: P.black, width: Math.max(4, size * 0.12), join: "round" }, align: "center", wordWrap: true, breakWords: true, wordWrapWidth: W * 0.86 });
  t.anchor.set(0.5);
  const bg = new PIXI.Graphics().roundRect(-t.width / 2 - 20, -t.height / 2 - 10, t.width + 40, t.height + 20, 14).fill({ color: P.ink, alpha: 0.85 }).stroke({ width: 3, color: P.black });
  c.addChild(bg, t);
  c.position.set(W / 2, H * yFrac);
  popLayer.addChild(c);
  void tween(life, (k) => {
    c.scale.set(k < 0.12 ? 0.5 + k / 0.12 * 0.5 : 1);
    c.alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
  }).then(() => c.destroy());
}

// =====================================================================
// BUILD (gacha) scene
// =====================================================================
;                    
                   
                           
                             
                                                    
                               
                                       
                                      
                                                        
                       
                    
                  
                                                                                        
                 
                    
                       
                     
                  
                  
 
let bv                   = null;

function rollRarity()         {
  let r = Math.random();
  for (const [k, p] of RARITY_RATE) { if ((r -= p) < 0) return k; }
  return "N";
}
function rollCard()         {
  const r = rollRarity();
  const pool = CARDS.filter((c) => c.rarity === r);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function buildScene() {
  if (!run) return;
  wv = null;
  destroyChildren(sceneLayer);
  destroyChildren(bgLayer);
  bgLayer.addChild(coverSprite(tex["bg-gacha"], 0, 0, W, H, 0.6));
  const dim = new PIXI.Graphics().rect(0, 0, W, H).fill({ color: P.ink, alpha: 0.18 });
  bgLayer.addChild(dim);

  let gx = 0, gw = W, gTop = 0, gBottom = H;
  let panel                                                ;
  if (portrait) {
    panel = { x: 8, y: H * 0.635, w: W - 16, h: H * 0.365 - 8 };
    gBottom = panel.y - 6;
  } else {
    gw = W * 0.6;
    panel = { x: gw + 4, y: 8, w: W - gw - 12, h: H - 16 };
  }
  const gh = gBottom - gTop;

  // timer
  const timerBox = new PIXI.Container();
  const tsize = Math.min(gw * 0.2, gh * 0.12, 96);
  const tb = new PIXI.Graphics();
  tb.roundRect(-tsize * 1.25, -tsize * 0.62, tsize * 2.5, tsize * 1.24, tsize * 0.3).fill({ color: P.ink, alpha: 0.88 }).stroke({ width: 4, color: P.black });
  const timer = num(String(Math.ceil(run.time)), tsize, P.white);
  timer.anchor.set(0.5);
  timer.y = tsize * 0.04;
  timerBox.addChild(tb, timer);
  const topInset = 6;
  timerBox.position.set(gx + gw / 2, gTop + topInset + tsize * 0.75);
  sceneLayer.addChild(timerBox);
  const phaseLbl = txt(run.phase === "bonus" ? t("bonusHint", run.stage) : t("buildHint", MODES[run.mode].build), Math.max(14, tsize * 0.26), P.white, { stroke: { color: P.black, width: 4, join: "round" } });
  phaseLbl.anchor.set(0.5, 0);
  phaseLbl.position.set(gx + gw / 2, timerBox.y + tsize * 0.66 + 4);
  sceneLayer.addChild(phaseLbl);

  // offers
  const offerTop = phaseLbl.y + phaseLbl.height + 8;
  const btnH = Math.max(52, Math.min(70, gh * 0.09));
  const btnY = gBottom - btnH / 2 - 10;
  const offerBottom = btnY - btnH / 2 - 10;
  const ow = Math.min((gw - 40) / 3, (offerBottom - offerTop) / (CARD_H / CARD_W), 230);
  const ocy = (offerTop + offerBottom) / 2;
  const slots = [0, 1, 2].map((i) => ({ x: gx + gw / 2 + (i - 1) * (ow + 10), y: ocy, w: ow }));
  const offerLayer = new PIXI.Container();
  sceneLayer.addChild(offerLayer);
  const hint = txt(t("buildHelp"), Math.max(16, ow * 0.11), P.white, { stroke: { color: P.black, width: 5, join: "round" } });
  hint.anchor.set(0.5);
  hint.position.set(gx + gw / 2, ocy);
  sceneLayer.addChild(hint);

  const summonBtn = button(t("summon"), Math.min(gw * 0.48, 280), btnH, P.coral, () => summon(), btnH * 0.5);
  summonBtn.position.set(gx + gw * 0.3, btnY);
  const readyBtn = button(t("ready"), Math.min(gw * 0.34, 200), btnH * 0.86, P.sky, () => finishBuild(false));
  readyBtn.position.set(gx + gw * 0.77, btnY);
  sceneLayer.addChild(summonBtn, readyBtn);

  // deck panel
  const pg = new PIXI.Graphics();
  pg.roundRect(panel.x, panel.y, panel.w, panel.h, 14).fill({ color: P.cream, alpha: 0.96 }).stroke({ width: 4, color: P.black });
  sceneLayer.addChild(pg);
  const hs = Math.max(15, Math.min(22, panel.w * 0.05));
  const countText = txt("", hs, P.ink);
  countText.position.set(panel.x + 12, panel.y + 8);
  const tagText = txt("", Math.max(14, hs * 0.8), P.ink, { fontWeight: "700" });
  tagText.position.set(panel.x + 12, panel.y + 12 + hs * 1.25);
  sceneLayer.addChild(countText, tagText);
  const listTop = panel.y + 18 + hs * 1.25 + Math.max(14, hs * 0.8) * 1.3;
  const listMaskH = panel.y + panel.h - 8 - listTop;
  const list = new PIXI.Container();
  const lm = new PIXI.Graphics().rect(panel.x + 4, listTop, panel.w - 8, listMaskH).fill(P.white);
  list.mask = lm;
  sceneLayer.addChild(list, lm);

  bv = {
    timer, timerBox, offerLayer, offerSlots: slots, offerCards: [], summonBtn, readyBtn, panel, list, listMaskH, listTop,
    rows: [], scroll: 0, maxScroll: 0, countText, tagText, hint, lastSec: Math.ceil(run.time),
  };
  lastBvRef = bv;

  // panel scroll + tap-to-delete
  const hit = new PIXI.Container();
  hit.eventMode = "static";
  hit.hitArea = new PIXI.Rectangle(panel.x, listTop, panel.w, listMaskH);
  sceneLayer.addChild(hit);
  let down                                                  = null;
  hit.on("pointerdown", (e) => { if (bv) down = { y: e.global.y, s: bv.scroll, moved: false }; });
  hit.on("globalpointermove", (e) => {
    if (!down || !bv) return;
    const dy = e.global.y - down.y;
    if (Math.abs(dy) > 8) down.moved = true;
    if (down.moved) setScroll(down.s - dy);
  });
  const up = (e                            ) => {
    if (!down || !bv) return;
    if (!down.moved) {
      const lx = e.global.x, ly = e.global.y + bv.scroll;
      const r = bv.rows.find((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
      if (r) deleteCard(r.id);
    }
    down = null;
  };
  hit.on("pointerup", up);
  hit.on("pointerupoutside", () => { down = null; });
  hit.on("wheel", (e) => { if (bv) setScroll(bv.scroll + e.deltaY); });

  refreshDeckList();
  syncUi();
  if (run.offer) showOffer(run.offer, false);
}

function setScroll(s        ) {
  if (!bv) return;
  bv.scroll = Math.max(0, Math.min(bv.maxScroll, s));
  bv.list.y = -bv.scroll;
}

function deckGroups(deck          ) {
  const m = new Map                ();
  for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => {
    const da = CARD_MAP[a[0]], db = CARD_MAP[b[0]];
    return RARITY_ORDER[db.rarity] - RARITY_ORDER[da.rarity] || da.cost - db.cost || cardName(a[0]).localeCompare(cardName(b[0]));
  });
}

function refreshDeckList(bounceId         ) {
  if (!bv || !run) return;
  let ct                   = null;
  let tg                   = null;
  try { ct = bv.countText ?? null; tg = bv.tagText ?? null; } catch { ct = null; }
  if (!ct || !tg || ct.destroyed || !ct.style || !ct.parent) { lastBvRef = null; bv = null; return; }
  const n = run.deck.length;
  ct.text = n < MIN_DECK ? t("deckNeed", n, MIN_DECK - n) : t("deckCount", n);
  if (ct.style) ct.style.fill = n < MIN_DECK ? P.red : P.ink;
  const tagCount                               = {};
  for (const id of run.deck) { const t = CARD_MAP[id].tag; if (t) tagCount[t] = (tagCount[t] ?? 0) + 1; }
  const tags = (Object.keys(TAG_LABEL)         ).filter((k) => tagCount[k]).map((k) => `${tagName(k)}${tagCount[k]}`);
  tg.text = tags.length ? tags.join("  ") : t("tapToRemove");
  bv.readyBtn.setEnabled(n >= MIN_DECK);
  destroyChildren(bv.list);
  bv.rows = [];
  const { panel } = bv;
  const cols = panel.w >= 330 ? 2 : 1;
  const gap = 6;
  const rw = (panel.w - 16 - gap * (cols - 1)) / cols;
  const rh = Math.max(48, Math.min(56, rw * 0.22));
  const groups = deckGroups(run.deck);
  groups.forEach(([id, cnt], i) => {
    const def = CARD_MAP[id];
    const x = panel.x + 8 + (i % cols) * (rw + gap);
    const y = bv .listTop + 2 + Math.floor(i / cols) * (rh + gap);
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, rw, rh, 8).fill(def.rarity === "UR" ? rainbow() : RARITY_COLOR[def.rarity]).stroke({ width: 3, color: P.black });
    c.addChild(g);
    const th = new PIXI.Sprite(thumbTex[id]);
    th.width = th.height = rh - 10;
    th.position.set(5, 5);
    const thb = new PIXI.Graphics().rect(5, 5, rh - 10, rh - 10).stroke({ width: 2, color: P.black });
    c.addChild(th, thb);
    const light = def.rarity === "N" || def.rarity === "SR";
    const nm = txt(cardName(id), Math.min(18, rh * 0.36), light ? P.ink : P.white, light ? {} : { stroke: { color: P.black, width: 3, join: "round" } });
    nm.anchor.set(0, 0.5);
    nm.position.set(rh + 2, rh / 2);
    const cntT = num(`×${cnt}`, Math.min(22, rh * 0.44));
    cntT.anchor.set(1, 0.5);
    cntT.position.set(rw - 8, rh / 2);
    const maxNm = rw - rh - 10 - cntT.width - 6;
    if (nm.width > maxNm) nm.scale.set(Math.max(0.4, maxNm / nm.width));
    c.addChild(nm, cntT);
    c.position.set(x, y);
    bv .list.addChild(c);
    bv .rows.push({ id, x, y, w: rw, h: rh, c });
    if (bounceId === id) void tween(0.25, (k) => { c.scale.set(1 + Math.sin(k * Math.PI) * 0.08); });
  });
  const contentH = Math.ceil(groups.length / cols) * (rh + gap) + 4;
  bv.maxScroll = Math.max(0, contentH - bv.listMaskH);
  setScroll(bv.scroll);
  if (bounceId) void tween(0.25, (k) => { if (bv) bv.countText.scale.set(1 + Math.sin(k * Math.PI) * 0.18); });
}

function showOffer(ids          , animate         ) {
  if (!bv) return;
  destroyChildren(bv.offerLayer);
  bv.offerCards = [];
  bv.hint.visible = false;
  let best = "N"          ;
  ids.forEach((id, i) => {
    const def = CARD_MAP[id];
    if (RARITY_ORDER[def.rarity] > RARITY_ORDER[best]) best = def.rarity;
    const s = bv .offerSlots[i];
    const wrap = new PIXI.Container();
    const card = makeCard(def);
    card.pivot.set(CARD_W / 2, CARD_H / 2);
    wrap.addChild(card);
    const sc = s.w / CARD_W;
    wrap.position.set(s.x, s.y);
    wrap.scale.set(sc);
    wrap.eventMode = "static";
    wrap.cursor = "pointer";
    wrap.on("pointertap", () => pickOffer(i));
    bv .offerLayer.addChild(wrap);
    bv .offerCards.push(wrap);
    if (animate) {
      wrap.scale.set(0, sc);
      void tween(0.22, (k) => { wrap.scale.set(sc * easeOut(k), sc * (1 + Math.sin(k * Math.PI) * 0.1)); });
      if (def.rarity !== "N") {
        void wait(0.18).then(() => {
          if (def.rarity === "SR") fx.play("level-up", { pos: { x: s.x, y: s.y }, scale: fxScale() });
          else if (def.rarity === "R") fx.play("pickup-pop", { pos: { x: s.x, y: s.y }, scale: fxScale() * 1.4 });
          else fx.play("legendary-reward", { pos: { x: s.x, y: s.y } });
        });
      }
    }
  });
  if (animate) {
    if (best === "UR") void sound.playCue("ui.reveal_ur", { eventId: sid() });
    else if (best === "SR") void sound.playCue("ui.reveal_sr", { eventId: sid() });
    else if (best === "R") void sound.playCue("ui.reveal_r", { eventId: sid() });
  }
}

function summon() {
  if (!run || !bv || (run.phase !== "build" && run.phase !== "bonus") || run.time <= 0) return;
  run.offer = [rollCard(), rollCard(), rollCard()];
  void sound.playCue("ui.summon", { eventId: sid() });
  const cx = bv.offerSlots[1].x, cy = bv.offerSlots[1].y;
  fx.play("magic-area-pulse", { pos: { x: cx, y: cy }, scale: fxScale() * 1.2 });
  const b = bv.summonBtn;
  void tween(0.1, (k) => b.scale.set(1 + Math.sin(k * Math.PI) * 0.12));
  showOffer(run.offer, true);
  save();
}

function pickOffer(i        ) {
  if (!run || !bv || !run.offer || run.time <= 0) return;
  const id = run.offer[i];
  if (!id) return;
  const src = bv.offerCards[i];
  run.deck.push(id);
  run.offer = null;
  void sound.playCue("ui.pick", { eventId: sid() });
  // fly the picked card into the deck panel
  const fly = makeCard(CARD_MAP[id]);
  fly.pivot.set(CARD_W / 2, CARD_H / 2);
  const sx = src.x, sy = src.y, s0 = src.scale.y;
  fly.position.set(sx, sy);
  fly.scale.set(s0);
  popLayer.addChild(fly);
  const tx = bv.panel.x + bv.panel.w / 2, ty = bv.panel.y + 24;
  void tween(0.28, (k) => {
    const e = easeOut(k);
    fly.position.set(sx + (tx - sx) * e, sy + (ty - sy) * e - Math.sin(k * Math.PI) * 40);
    fly.scale.set(s0 * (1 - 0.8 * e));
    fly.alpha = 1 - k * 0.5;
  }).then(() => { fly.destroy({ children: true }); refreshDeckList(id); syncUi(); });
  destroyChildren(bv.offerLayer);
  bv.offerCards = [];
  bv.hint.visible = true;
  save();
}

function deleteCard(id        ) {
  if (!run || !bv || run.time <= 0) return;
  const idx = run.deck.lastIndexOf(id);
  if (idx < 0) return;
  run.deck.splice(idx, 1);
  void sound.playCue("ui.delete", { eventId: sid() });
  const row = bv.rows.find((r) => r.id === id);
  if (row) {
    // torn ghost of the row
    const ghost = new PIXI.Graphics().roundRect(0, 0, row.w, row.h, 8).fill(RARITY_COLOR[CARD_MAP[id].rarity]).stroke({ width: 3, color: P.black });
    ghost.position.set(row.x, row.y - bv.scroll);
    popLayer.addChild(ghost);
    void tween(0.2, (k) => { ghost.rotation = k * 0.25; ghost.scale.set(1 - k * 0.4, 1 - k * 0.6); ghost.alpha = 1 - k; ghost.y = row.y - bv .scroll + k * 20; })
      .then(() => ghost.destroy());
  }
  refreshDeckList();
  syncUi();
  save();
}

function finishBuild(timeout         ) {
  if (!run || (run.phase !== "build" && run.phase !== "bonus")) return;
  if (!timeout && run.deck.length < MIN_DECK) return;
  run.time = 0;
  run.offer = null;
  let filled = 0;
  while (run.deck.length < MIN_DECK) { run.deck.push(filled % 2 === 0 ? "slash" : "guard"); filled++; }
  if (filled) banner(t("fillToast", filled), Math.max(16, Math.min(26, W * 0.045)), P.white, 2.4, 0.58);
  startBattle();
}

function updateBuild(dt        ) {
  if (!run || !bv || (run.phase !== "build" && run.phase !== "bonus")) return;
  if (paused) return;
  const before = run.deck.length;
  run.time = Math.max(0, run.time - dt);
  if (run.deck.length !== before) syncUi();
  else if (run.deck.length !== lastUiDeck) { lastUiDeck = run.deck.length; syncUi(); }
  const sec = Math.ceil(run.time);
  if (sec !== bv.lastSec) {
    bv.lastSec = sec;
    bv.timer.text = String(sec);
    if (sec <= 10 && sec > 0) void sound.playCue("ui.tick", { eventId: sid() });
  }
  const urgent = run.time <= 10;
  bv.timer.style.fill = urgent ? 0xff6b5b : P.white;
  const pulse = urgent ? 1 + 0.08 * Math.max(0, Math.sin((run.time % 1) * Math.PI)) : 1;
  bv.timerBox.scale.set(pulse);
  if (run.time <= 0) finishBuild(true);
}

// =====================================================================
// BATTLE scene
// =====================================================================
;                                                                                                                                     
;                                        
;                     
                     
                                                 
                                      
                                        
             
                          
                         
                                      
                       
                          
                                       
             
                          
                                                     
                                                     
                      
                     
                                    
                      
                      
                            
                                                                       
                          
                       
              
 
let wv                    = null;
let busy = false;
let busySince = 0;
function startAction() { busy = true; busySince = performance.now(); }
function endAction() { busy = false; }
let paused = false;
let lastUiDeck = -1;

function makeHpBar(w        , h        , color        )        {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const t = num("", h * 0.8);
  t.anchor.set(0.5);
  t.position.set(w / 2, h / 2 + 1);
  c.addChild(g, t);
  const bar        = { c, g, t, w, h, ghost: 1, shown: 1, max: 1 };
  (bar       ).color = color;
  return bar;
}
function drawHp(bar       , hp        , max        ) {
  bar.max = max;
  bar.shown = hp;
  if (bar.ghost < hp) bar.ghost = hp;
  const { g, w, h } = bar;
  if (!g || g.destroyed) return;
  g.clear();
  g.roundRect(0, 0, w, h, h / 2).fill(P.black);
  const gw = Math.max(0, (w - 6) * (bar.ghost / max));
  if (gw > 0) g.roundRect(3, 3, gw, h - 6, (h - 6) / 2).fill(P.white);
  const fw = Math.max(0, (w - 6) * (hp / max));
  if (fw > 0) g.roundRect(3, 3, fw, h - 6, (h - 6) / 2).fill((bar       ).color);
  g.roundRect(0, 0, w, h, h / 2).stroke({ width: 3, color: P.black });
  bar.t.text = `${hp}/${max}`;
}
function stepHp(bar       , dt        ) {
  if (bar.ghost > bar.shown) {
    bar.ghost = Math.max(bar.shown, bar.ghost - bar.max * dt * 0.6);
    drawHp(bar, bar.shown, bar.max);
  }
}

function statusChips(container                , items                                              , size        ) {
  destroyChildren(container);
  let x = 0;
  for (const it of items) {
    const c = new PIXI.Container();
    const bg = new PIXI.Graphics().roundRect(0, 0, size * 1.9, size, size * 0.3).fill({ color: P.cream, alpha: 0.95 }).stroke({ width: 2, color: P.black });
    const ic = icon(it.icon, size * 0.85);
    ic.position.set(size * 0.5, size / 2);
    const t = num(String(it.n), size * 0.62, it.color);
    t.anchor.set(0, 0.5);
    t.position.set(size * 0.95, size / 2 + 1);
    c.addChild(bg, ic, t);
    c.x = x;
    container.addChild(c);
    x += size * 2.0;
  }
}

function intentView(b        , size        )                 {
  const c = new PIXI.Container();
  const it = currentIntent(b);
  const parts                                                   = [];
  if (it.atk) {
    const d = intentDamage(b, it);
    parts.push({ icon: ICON.attack, label: (it.hits ?? 1) > 1 ? `${d}×${it.hits}` : String(d), color: 0xffd0c0 });
  }
  if (it.block) parts.push({ icon: ICON.shield, label: String(it.block), color: P.skyLt });
  if (it.str) parts.push({ icon: ICON.strength, label: `+${it.str}`, color: 0xc8f0b0 });
  if (it.weak) parts.push({ icon: ICON.weak, label: String(it.weak), color: 0xd8c8ff });
  if (it.burn) parts.push({ icon: ICON.burn, label: String(it.burn), color: 0xffc070 });
  if (it.curse) parts.push({ icon: ICON.curse, label: `×${it.curse}`, color: 0xd8c8ff });
  if (it.charge) parts.push({ icon: ICON.charge, label: t("intentChargeShort"), color: P.gold });
  let x = 0;
  for (const p of parts) {
    const ic = icon(p.icon, size);
    ic.position.set(x + size / 2, 0);
    const lt = it.charge && p.icon === ICON.charge ? txt(p.label, size * 0.42, p.color, { stroke: { color: P.black, width: 4, join: "round" } }) : num(p.label, size * 0.56, p.color);
    lt.anchor.set(0, 0.5);
    lt.position.set(x + size * 0.92, 2);
    c.addChild(ic, lt);
    x += size + lt.width + 8;
  }
  const bg = new PIXI.Graphics().roundRect(-8, -size * 0.6, x + 8, size * 1.2, size * 0.3).fill({ color: P.ink, alpha: 0.82 }).stroke({ width: 3, color: P.black });
  c.addChildAt(bg, 0);
  c.pivot.x = x / 2;
  return c;
}

function battleScene() {
  if (!run || !run.battle) return;
  const b = run.battle;
  destroyChildren(sceneLayer);
  destroyChildren(bgLayer);
  const def = ENEMIES[b.stage - 1];

  // regions
  let enemyArea                                                ;
  let handTop        ;
  let heroBox                                     ;
  let barW        , barH        ;
  let orbPos                                     ;
  let endPos                                                ;
  const u = Math.min(W, H);
  if (portrait) {
    enemyArea = { x: 0, y: H * 0.07, w: W, h: H * 0.38 };
    handTop = H * 0.69;
    const midY = H * 0.455, midH = handTop - midY;
    const hs = Math.min(W * 0.2, midH * 0.75);
    heroBox = { x: 12, y: midY + (midH - hs) / 2 - 4, s: hs };
    barW = Math.min(W * 0.42, 240); barH = Math.max(20, Math.min(28, H * 0.03));
    orbPos = { x: W - Math.min(W * 0.11, 52) - 12, y: midY + midH * 0.34, r: Math.min(W * 0.1, midH * 0.3, 46) };
    endPos = { w: Math.min(W * 0.32, 170), h: Math.max(48, midH * 0.3), x: 0, y: 0 };
    endPos.x = W - endPos.w / 2 - 10; endPos.y = handTop - endPos.h / 2 - 6;
    bgLayer.addChild(coverSprite(tex["bg-" + def.bg], 0, 0, W, H * 0.62, 0.62));
    const ground = new PIXI.Graphics().rect(0, H * 0.62, W, H * 0.38).fill(P.ink);
    ground.rect(0, H * 0.62, W, 4).fill(P.black);
    bgLayer.addChild(ground);
  } else {
    handTop = H * 0.7;
    enemyArea = { x: W * 0.32, y: H * 0.08, w: W * 0.62, h: handTop - H * 0.08 - 10 };
    const hs = Math.min(W * 0.16, H * 0.3);
    heroBox = { x: W * 0.15 - hs / 2, y: H * 0.2, s: hs };
    barW = Math.min(W * 0.24, 260); barH = Math.max(20, Math.min(28, H * 0.035));
    orbPos = { x: Math.min(W * 0.06, 70) + 8, y: handTop + (H - handTop) * 0.42, r: Math.min(H * 0.07, 46) };
    endPos = { w: Math.min(W * 0.16, 190), h: Math.max(48, H * 0.075), x: 0, y: 0 };
    endPos.x = W - endPos.w / 2 - 14; endPos.y = handTop - endPos.h / 2 - 8;
    bgLayer.addChild(coverSprite(tex["bg-" + def.bg], 0, 0, W, H, 0.7));
    const band = new PIXI.Graphics().rect(0, handTop + 6, W, H - handTop).fill({ color: P.ink, alpha: 0.55 });
    bgLayer.addChild(band);
  }

  // enemy sprite
  const et = tex["enemy-" + def.id];
  const enemy = new PIXI.Sprite(et);
  enemy.anchor.set(0.5, 1);
  const eh = enemyArea.h * def.size * 0.86;
  const es = Math.min(eh / et.height, (enemyArea.w * 0.8) / et.width);
  enemy.scale.set(es);
  const ebx = enemyArea.x + enemyArea.w / 2, eby = enemyArea.y + enemyArea.h;
  enemy.position.set(ebx, eby);
  const enemyFilter = new PIXI.ColorMatrixFilter();
  enemyFilter.matrix = [0.3, 0, 0, 0, 0.7, 0, 0.3, 0, 0, 0.7, 0, 0, 0.3, 0, 0.7, 0, 0, 0, 1, 0];
  enemyFilter.enabled = false;
  enemy.filters = [enemyFilter];
  sceneLayer.addChild(enemy);
  const etop = eby - et.height * es;
  const enemyCenter = { x: ebx, y: (etop + eby) / 2 };

  // enemy hp + name + status
  const ebw = Math.min(enemyArea.w * 0.6, 300);
  const ehp = makeHpBar(ebw, barH, P.red);
  ehp.c.position.set(ebx - ebw / 2, Math.max(enemyArea.y + barH * 2.6, etop - barH * 0.2));
  sceneLayer.addChild(ehp.c);
  const nmT = txt(enemyName(def.id), barH * 0.72, P.white, { stroke: { color: P.black, width: 4, join: "round" } });
  nmT.anchor.set(0.5, 1);
  nmT.position.set(ebx, ehp.c.y - 2);
  sceneLayer.addChild(nmT);
  const isz = barH * 1.5;
  const intentPos = { x: ebx, y: nmT.y - nmT.height - isz * 0.7 };
  const eStatus = new PIXI.Container();
  const eStatusPos = { x: ehp.c.x, y: ehp.c.y + barH + 4, size: barH * 1.05 };
  eStatus.position.set(eStatusPos.x, eStatusPos.y);
  sceneLayer.addChild(eStatus);

  // stage label
  const stageText = num(t("stage", b.stage), Math.max(18, Math.min(30, u * 0.045)));
  stageText.anchor.set(0, 0);
  stageText.position.set(12, 10);
  sceneLayer.addChild(stageText);

  // hero
  const hero = new PIXI.Container();
  const hg = new PIXI.Graphics();
  hg.roundRect(0, 4, heroBox.s, heroBox.s, 12).fill(P.black);
  hg.roundRect(0, 0, heroBox.s, heroBox.s, 12).fill(P.skyLt).stroke({ width: 4, color: P.black });
  const heroSprite = new PIXI.Sprite(tex.hero);
  heroSprite.width = heroSprite.height = heroBox.s - 8;
  heroSprite.position.set(4, 4);
  hero.addChild(hg, heroSprite);
  hero.position.set(heroBox.x, heroBox.y);
  sceneLayer.addChild(hero);
  const heroCenter = { x: heroBox.x + heroBox.s / 2, y: heroBox.y + heroBox.s / 2 };
  const php = makeHpBar(barW, barH, P.red);
  let pStatusPos                                        ;
  if (portrait) {
    php.c.position.set(heroBox.x + heroBox.s + 10, heroBox.y + heroBox.s * 0.18);
    pStatusPos = { x: php.c.x, y: php.c.y + barH + 6, size: barH * 1.05 };
  } else {
    php.c.position.set(heroCenter.x - barW / 2, heroBox.y + heroBox.s + 10);
    pStatusPos = { x: php.c.x, y: php.c.y + barH + 6, size: barH * 1.05 };
  }
  sceneLayer.addChild(php.c);
  const pStatus = new PIXI.Container();
  pStatus.position.set(pStatusPos.x, pStatusPos.y);
  sceneLayer.addChild(pStatus);

  // energy orb
  const orb = new PIXI.Container();
  const og = new PIXI.Graphics();
  og.circle(0, 3, orbPos.r).fill(P.black);
  og.circle(0, 0, orbPos.r).fill(P.sky).stroke({ width: 4, color: P.black });
  og.circle(-orbPos.r * 0.35, -orbPos.r * 0.35, orbPos.r * 0.22).fill({ color: P.white, alpha: 0.5 });
  const orbText = num("3/3", orbPos.r * 0.62);
  orbText.anchor.set(0.5);
  orb.addChild(og, orbText);
  orb.position.set(orbPos.x, orbPos.y);
  sceneLayer.addChild(orb);

  // end turn
  const endBtn = button(t("endTurn"), endPos.w, endPos.h, P.coral, () => void doEndTurn());
  endBtn.position.set(endPos.x, endPos.y);
  sceneLayer.addChild(endBtn);

  // piles
  const pileS = portrait ? Math.max(36, Math.min(46, W * 0.11)) : Math.max(36, Math.min(56, (H - handTop) * 0.26));
  const mkPile = (ic        , x        )            => {
    const c = new PIXI.Container();
    const i = icon(ic, pileS);
    const t = num("0", pileS * 0.5);
    t.anchor.set(0.5);
    t.position.set(0, pileS * 0.5);
    c.addChild(i, t);
    c.position.set(x, H - pileS * 0.75);
    sceneLayer.addChild(c);
    return t;
  };
  const leftPad = portrait ? 0 : orbPos.r * 2 + 16;
  const drawText = mkPile(ICON.deck, leftPad + pileS * 0.7);
  {
    const pc = drawText.parent ;
    const r = Math.max(30, pileS * 0.75);
    pc.hitArea = new PIXI.Circle(0, pileS * 0.15, r);
    pc.eventMode = "static";
    pc.cursor = "pointer";
    pc.on("pointertap", (e) => { e.stopPropagation(); openDrawPile(); });
  }
  const discText = mkPile(ICON.discard, W - pileS * 0.7);
  {
    const pc = discText.parent ;
    const r = Math.max(30, pileS * 0.75);
    pc.hitArea = new PIXI.Circle(0, pileS * 0.15, r);
    pc.eventMode = "static";
    pc.cursor = "pointer";
    pc.on("pointertap", (e) => { e.stopPropagation(); openDiscardPile(); });
  }

  // hand region
  const handLayer = new PIXI.Container();
  sceneLayer.addChild(handLayer);
  const hx0 = portrait ? 8 : leftPad + pileS * 1.5, hx1 = portrait ? W - 8 : W - pileS * 1.5;
  const handH = H - handTop;
  const cw = portrait
    ? Math.min((handH - pileS - 24) * (CARD_W / CARD_H), W / 3.3, 170)
    : Math.min(handH * 0.86 * (CARD_W / CARD_H), (hx1 - hx0) / 3.2, 170);
  const handCy = portrait ? handTop + (cw * CARD_H / CARD_W) / 2 + 14 : handTop + handH * 0.5 + 4;
  wv = {
    enemy, enemyBase: { x: ebx, y: eby, s: es }, enemyFilter, enemyCenter, ehp, eStatus, intent: new PIXI.Container(), intentPos,
    hero, heroSprite, heroCenter, php, pStatus, pStatusPos, eStatusPos, orb, orbText, endBtn, drawText, discText,
    handLayer, hand: { x0: hx0, x1: hx1, y: handCy, cw, top: handTop }, cards: [], stageText,
    shown: snapOf(b),
  };
  sceneLayer.addChild(wv.intent);
  applySnap(wv.shown);
  refreshIntent();
  refreshPiles();
  layoutHand(false);
  if (b.over === null) endBtn.setEnabled(!busy);
}

function applySnap(s      ) {
  if (!wv) return;
  if (wv.ehp.g?.destroyed || wv.php.g?.destroyed) { wv = null; return; }
  wv.shown = s;
  drawHp(wv.ehp, s.e.hp, s.e.maxHp);
  drawHp(wv.php, s.p.hp, s.p.maxHp);
  const ps                                               = [];
  if (s.p.block) ps.push({ icon: ICON.shield, n: s.p.block, color: P.skyLt });
  if (s.p.str) ps.push({ icon: ICON.strength, n: s.p.str, color: 0xc8f0b0 });
  if (s.p.burn) ps.push({ icon: ICON.burn, n: s.p.burn, color: 0xffc070 });
  if (s.p.weak) ps.push({ icon: ICON.weak, n: s.p.weak, color: 0xd8c8ff });
  statusChips(wv.pStatus, ps, wv.pStatusPos.size);
  const es                                               = [];
  if (s.e.block) es.push({ icon: ICON.shield, n: s.e.block, color: P.skyLt });
  if (s.e.str) es.push({ icon: ICON.strength, n: s.e.str, color: 0xc8f0b0 });
  if (s.e.burn) es.push({ icon: ICON.burn, n: s.e.burn, color: 0xffc070 });
  if (s.e.weak) es.push({ icon: ICON.weak, n: s.e.weak, color: 0xd8c8ff });
  statusChips(wv.eStatus, es, wv.eStatusPos.size);
  wv.orbText.text = `${s.p.energy}/3`;
}

function refreshIntent() {
  if (!wv || !run?.battle) return;
  const old = wv.intent;
  const n = intentView(run.battle, wv.ehp.h * 1.5);
  n.position.set(wv.intentPos.x, wv.intentPos.y);
  old.parent?.addChild(n);
  old.destroy({ children: true });
  wv.intent = n;
  n.visible = !run.battle.over;
}
function refreshPiles() {
  if (!wv || !run?.battle) return;
  wv.drawText.text = String(run.battle.draw.length);
  wv.discText.text = String(run.battle.discard.length);
}

function handSlot(i        , n        ) {
  const h = wv .hand;
  const sc = h.cw / CARD_W;
  const span = h.x1 - h.x0;
  const step = n > 1 ? Math.min(h.cw * 1.04, (span - h.cw) / (n - 1)) : 0;
  const total = step * (n - 1);
  const x = (h.x0 + h.x1) / 2 - total / 2 + i * step;
  const off = n > 1 ? i / (n - 1) - 0.5 : 0;
  const rot = portrait ? off * 0.22 : off * 0.08;
  const y = h.y + Math.abs(off) * (portrait ? h.cw * 0.18 : h.cw * 0.06);
  return { x, y, rot, sc };
}

let dragging                                                                                                                  = null;
let hoverIdx = -1;
let preview                        = null;

function layoutHand(animate         ) {
  if (!wv || !run?.battle) return;
  const b = run.battle;
  destroyChildren(wv.handLayer);
  wv.cards = [];
  const n = b.hand.length;
  b.hand.forEach((inst, i) => {
    const def = CARD_MAP[inst.id];
    const wrap = new PIXI.Container();
    const card = makeCard(def);
    card.pivot.set(CARD_W / 2, CARD_H / 2);
    wrap.addChild(card);
    const s = handSlot(i, n);
    wrap.position.set(s.x, s.y);
    wrap.rotation = s.rot;
    wrap.scale.set(s.sc);
    const playable = canPlay(b, i);
    wrap.alpha = playable || busy ? 1 : 0.62;
    wrap.eventMode = "static";
    wrap.cursor = "pointer";
    wrap.on("pointerdown", (e) => onCardDown(i, wrap, e));
    wrap.on("pointerover", (e) => { if (e.pointerType === "mouse" && !dragging) { hoverIdx = i; poseHand(); } });
    wrap.on("pointerout", () => { if (hoverIdx === i) { hoverIdx = -1; poseHand(); } });
    wv .handLayer.addChild(wrap);
    wv .cards.push(wrap);
    if (animate) {
      const fx0 = wv .drawText.parent .x, fy0 = wv .drawText.parent .y;
      wrap.position.set(fx0, fy0);
      wrap.scale.set(s.sc * 0.3);
      void wait(i * 0.05).then(() => tween(0.2, (k) => {
        const e = easeOut(k);
        wrap.position.set(fx0 + (s.x - fx0) * e, fy0 + (s.y - fy0) * e);
        wrap.scale.set(s.sc * (0.3 + 0.7 * e));
      }));
    }
  });
}

function poseHand() {
  if (!wv || !run?.battle) return;
  const n = wv.cards.length;
  wv.cards.forEach((c, i) => {
    if (dragging && dragging.c === c) return;
    const s = handSlot(i, n);
    const hov = i === hoverIdx;
    c.position.set(s.x, hov ? s.y - wv .hand.cw * 0.45 : s.y);
    c.rotation = hov ? 0 : s.rot;
    c.scale.set(hov ? s.sc * 1.35 : s.sc);
    c.zIndex = hov ? 100 : i;
  });
  wv.handLayer.sortableChildren = true;
}

function onCardDown(i        , c                , e                            ) {
  if (busy || paused || !run?.battle || run.battle.over) return;
  dragging = { idx: i, c, sx: e.global.x, sy: e.global.y, t0: performance.now(), moved: false, preview: false };
}

function showPreview(idx        ) {
  hidePreview();
  if (!run?.battle) return;
  const def = CARD_MAP[run.battle.hand[idx].id];
  const c = makeCard(def);
  c.pivot.set(CARD_W / 2, CARD_H / 2);
  const w = Math.min(W * 0.55, H * 0.4 * (CARD_W / CARD_H), 280);
  c.scale.set(w / CARD_W);
  c.position.set(W / 2, Math.max(CARD_H * c.scale.y / 2 + 10, (wv?.hand.top ?? H * 0.7) - CARD_H * c.scale.y / 2 - 10));
  popLayer.addChild(c);
  preview = c;
}
function hidePreview() { preview?.destroy({ children: true }); preview = null; }

app.stage.on("globalpointermove", (e) => {
  if (!dragging || !wv) return;
  const dx = e.global.x - dragging.sx, dy = e.global.y - dragging.sy;
  if (!dragging.moved && Math.hypot(dx, dy) > 12) {
    dragging.moved = true;
    hidePreview();
  }
  if (dragging.moved) {
    dragging.c.position.set(e.global.x, e.global.y);
    dragging.c.rotation = 0;
    dragging.c.zIndex = 200;
  }
});
app.stage.on("pointerup", (e) => endCardPointer(e));
app.stage.on("pointerupoutside", (e) => endCardPointer(e));
function endCardPointer(e                            ) {
  if (!dragging || !wv) return;
  const d = dragging;
  dragging = null;
  hidePreview();
  const quick = performance.now() - d.t0 < 380;
  if ((d.moved && e.global.y < wv.hand.top - 10) || (!d.moved && !d.preview && quick)) {
    void doPlay(d.idx, d.c);
  } else {
    poseHand();
  }
}

async function doPlay(idx        , from                 ) {
  if (!run?.battle || !wv || busy || paused) return;
  const b = run.battle;
  if (!canPlay(b, idx)) {
    const c = wv.cards[idx];
    if (c) { const x0 = c.x; void tween(0.25, (k) => { c.x = x0 + Math.sin(k * Math.PI * 6) * 6 * (1 - k); }); }
    const def = CARD_MAP[b.hand[idx]?.id];
    if (def) popup(def.unplayable ? t("cantUse") : t("notEnough"), W / 2, wv.hand.top - 20, P.white, 26, 30);
    poseHand();
    return;
  }
  const def = CARD_MAP[b.hand[idx].id];
  startAction();
  hoverIdx = -1;
  wv.endBtn.setEnabled(false);
  const evs = playCard(b, idx) ;
  // fly the card toward its target
  const c = from ?? wv.cards[idx];
  void sound.playCue("card.play", { eventId: sid() });
  if (c) {
    wv.cards.splice(wv.cards.indexOf(c), 1);
    const target = def.kind === "block" || def.kind === "heal" || def.kind === "buff" ? wv.heroCenter : wv.enemyCenter;
    const sx = c.x, sy = c.y, s0 = c.scale.x;
    await tween(0.15, (k) => {
      const e = easeOut(k);
      c.position.set(sx + (target.x - sx) * e, sy + (target.y - sy) * e);
      c.scale.set(s0 * (1 - 0.6 * e));
      c.alpha = 1 - k * 0.6;
    });
    c.destroy({ children: true });
    poseHand();
  }
  try { await playEvents(evs, def); } catch (e) { console.warn("playEvents aborted", e); }
  endAction();
  afterAction();
}

async function doEndTurn() {
  if (!run?.battle || !wv || busy || paused || run.battle.over) return;
  startAction();
  hoverIdx = -1;
  wv.endBtn.setEnabled(false);
  // discard animation
  const cards = [...wv.cards];
  const dx = wv.discText.parent .x, dy = wv.discText.parent .y;
  await Promise.all(cards.map((c, i) => wait(i * 0.03).then(() => {
    const sx = c.x, sy = c.y, s0 = c.scale.x;
    return tween(0.18, (k) => { c.position.set(sx + (dx - sx) * k, sy + (dy - sy) * k); c.scale.set(s0 * (1 - 0.7 * k)); });
  })));
  const evs = endTurn(run.battle);
  layoutHand(false);
  try { await playEvents(evs); } catch (e) { console.warn("playEvents aborted", e); }
  endAction();
  afterAction();
}

function afterAction() {
  if (!run) return;
  syncUi();
  if (!run.battle || !wv) return;
  const b = run.battle;
  if (b.over || !wv.endBtn.parent) return;
  wv.endBtn.setEnabled(true);
  applySnap(snapOf(b));
  refreshIntent();
  refreshPiles();
  layoutHand(false);
  save();
}

function enemyFlash() {
  if (!wv) return;
  const f = wv.enemyFilter, e = wv.enemy, base = wv.enemyBase;
  if (e.destroyed || base.s !== base.s) return;
  f.enabled = true;
  void tween(0.18, (k) => {
    e.x = base.x + Math.sin(k * Math.PI) * 14 * fxScale();
    e.rotation = Math.sin(k * Math.PI) * 0.05;
    if (k > 0.45) f.enabled = false;
  });
}
function heroFlash() {
  if (!wv) return;
  const s = wv.heroSprite, h = wv.hero;
  if (s.destroyed) return;
  s.tint = 0xff7060;
  heroFlashT = 0.3;
  const x0 = h.x;
  void tween(0.25, (k) => { h.x = x0 + Math.sin(k * Math.PI * 4) * 6 * (1 - k); });
}
let heroFlashT = 0;

async function playEvents(evs      , card          ) {
  if (!wv) return;
  for (const ev of evs) {
    if (!wv) return;
    const v = wv;
    const S = fxScale();
    switch (ev.t) {
      case "hit": {
        applySnap(ev.snap);
        if (ev.to === "e") {
          const big = ev.dmg + ev.blocked;
          const p = { x: v.enemyCenter.x + (Math.random() - 0.5) * 40 * S, y: v.enemyCenter.y + (Math.random() - 0.5) * 40 * S };
          const kind = CARD_MAP[ev.card]?.kind ?? "melee";
          if (big >= 30) fx.play("explosion-impact", { pos: p, scale: S * 1.4, power: 1 });
          else if (kind === "thunder") fx.play("electric-arc-burst", { pos: p, scale: S, power: big >= 10 ? 0.9 : 0.5 });
          else if (kind === "fire") fx.play("fire-burst", { pos: p, dir: { x: 0, y: -1 }, scale: S, power: big >= 10 ? 0.9 : 0.5 });
          else if (kind === "ice") fx.play("ice-impact", { pos: p, scale: S, power: 0.6 });
          else if (kind === "magic") fx.play("firework-burst", { pos: p, scale: S * 0.8, power: 0.7 });
          else if (big >= 10) fx.play("heavy-hit", { pos: p, dir: { x: 1, y: -0.3 }, scale: S, power: 0.8 });
          else fx.play("light-hit", { pos: p, dir: { x: 1, y: -0.3 }, scale: S * 1.6, power: 0.6 });
          if (ev.blocked > 0 && ev.dmg === 0) {
            void sound.playCue("hit.block", { eventId: sid() });
            popup(t("block"), p.x, p.y, P.skyLt, 26 * S + 8);
          } else {
            if (kind === "melee") void sound.playCue("hit.slash", { eventId: sid(), pitchSemitones: Math.min(ev.i, 8) });
            else void sound.playCue("hit.magic", { eventId: sid(), pitchSemitones: Math.min(ev.i, 8) });
            popup(String(ev.dmg), p.x, p.y - 20 * S, big >= 30 ? P.gold : P.white, (big >= 30 ? 64 : big >= 10 ? 48 : 38) * S + 6);
          }
          enemyFlash();
          await wait(ev.n > 1 ? 0.08 : 0.12);
        } else {
          heroFlash();
          const p = v.heroCenter;
          if (ev.dmg === 0 && ev.blocked > 0) {
            fx.play("shield-break", { pos: p, scale: S * 0.9, power: 0.6 });
            void sound.playCue("hit.block", { eventId: sid() });
            popup(t("block"), p.x + 30, p.y, P.skyLt, 26 * S + 8);
          } else {
            fx.play("heavy-hit", { pos: p, dir: { x: -1, y: 0 }, scale: S, power: ev.dmg >= 15 ? 1 : 0.6 });
            fx.play("damage-flash", {});
            void sound.playCue("enemy.attack", { eventId: sid() });
            popup(String(ev.dmg), p.x + 40 * S, p.y - 10, 0xff6b5b, 44 * S + 6);
          }
          await wait(ev.n > 1 ? 0.12 : 0.2);
        }
        break;
      }
      case "total":
        popup(t("total", ev.amount), v.enemyCenter.x, v.enemyCenter.y - 70 * S, P.gold, 58 * S + 8, 40, 1.1);
        if (ev.amount >= 20) fx.play("confetti-burst", { pos: { x: v.enemyCenter.x, y: v.enemyCenter.y }, scale: S * 0.6 });
        await wait(0.35);
        break;
      case "block": {
        applySnap(ev.snap);
        const p = ev.who === "p" ? v.heroCenter : v.enemyCenter;
        fx.play("shockwave-ring", { pos: p, scale: S, power: 0.6 });
        void sound.playCue("hit.block", { eventId: sid() });
        popup(`+${ev.amt}`, p.x, p.y - 20, P.skyLt, 36 * S + 6);
        const row = ev.who === "p" ? v.pStatus : v.eStatus;
        void tween(0.2, (k) => row.scale.set(1 + Math.sin(k * Math.PI) * 0.25));
        await wait(0.18);
        break;
      }
      case "heal":
        applySnap(ev.snap);
        fx.play("heal-pulse", { pos: v.heroCenter, scale: S * 1.2, power: 0.8 });
        void sound.playCue("hit.heal", { eventId: sid() });
        popup(`+${ev.amt}`, v.heroCenter.x, v.heroCenter.y - 20, 0x9be07a, 40 * S + 6);
        await wait(0.2);
        break;
      case "status": {
        applySnap(ev.snap);
        const p = ev.who === "p" ? v.heroCenter : v.enemyCenter;
        if (ev.kind === "burn") { fx.play("fire-sparks", { pos: p, dir: { x: 0, y: -1 }, scale: S * 1.4, power: 0.8 }); void sound.playCue("hit.burn", { eventId: sid() }); popup(t("burn") + "+" + ev.amt, p.x, p.y - 30, 0xffa040, 30 * S + 6); }
        else if (ev.kind === "weak") { fx.play("ice-impact", { pos: p, scale: S * 0.8, power: 0.4 }); popup(t("weak") + "+" + ev.amt, p.x, p.y - 30, 0xd8c8ff, 30 * S + 6); }
        else { fx.play("level-up", { pos: p, scale: S * 0.8 }); void sound.playCue("hit.heal", { eventId: sid() }); popup(ev.amt ? t("strength") + "+" + ev.amt : t("swordBonus", 3), p.x, p.y - 30, 0xc8f0b0, 30 * S + 6); }
        await wait(0.2);
        break;
      }
      case "burnTick": {
        applySnap(ev.snap);
        const p = ev.who === "p" ? v.heroCenter : v.enemyCenter;
        fx.play("fire-burst", { pos: p, dir: { x: 0, y: -1 }, scale: S * 0.9, power: 0.6 });
        void sound.playCue("hit.burn", { eventId: sid() });
        popup(String(ev.amt), p.x, p.y, 0xffa040, 40 * S + 6);
        if (ev.who === "e") enemyFlash(); else heroFlash();
        await wait(0.3);
        break;
      }
      case "energy":
        applySnap(ev.snap);
        if (ev.amt > 0) { void tween(0.25, (k) => v.orb.scale.set(1 + Math.sin(k * Math.PI) * 0.3)); popup(`+${ev.amt}`, v.orb.x, v.orb.y - 30, P.skyLt, 32 * S + 6); }
        break;
      case "draw":
      case "shuffle":
        refreshPiles();
        break;
      case "mirror":
        popup(t("nextDouble"), v.heroCenter.x + 40, v.heroCenter.y - 30, P.gold, 26 * S + 6);
        fx.play("magic-area-ripple", { pos: v.heroCenter, scale: S * 0.8 });
        await wait(0.2);
        break;
      case "hpLoss":
        applySnap(ev.snap);
        heroFlash();
        popup(`-${ev.amt}`, v.heroCenter.x, v.heroCenter.y, 0xff6b5b, 36 * S + 6);
        await wait(0.15);
        break;
      case "enemyTurn":
        applySnap(ev.snap);
        await wait(0.25);
        break;
      case "enemyAct": {
        const ic = v.intent;
        await tween(0.18, (k) => ic.scale.set(1 + Math.sin(k * Math.PI) * 0.35));
        if (ev.intent.atk) {
          const e = v.enemy, base = v.enemyBase;
          await tween(0.14, (k) => { e.y = base.y + 18 * k * S; e.scale.set(base.s * (1 + 0.08 * k)); });
          void tween(0.25, (k) => { e.y = base.y + 18 * (1 - k) * S; e.scale.set(base.s * (1 + 0.08 * (1 - k))); });
        }
        break;
      }
      case "charge":
        fx.play("magic-charge", { pos: v.enemyCenter, scale: S * 1.2, power: 0.8 });
        popup(t("intentCharge"), v.enemyCenter.x, v.enemyCenter.y - 40, P.gold, 28 * S + 6, 30, 1.2);
        await wait(0.5);
        break;
      case "curse":
        fx.play("poison-impact", { pos: v.heroCenter, scale: S, power: 0.7 });
        popup(t("cursePile", ev.n), v.heroCenter.x + 60, v.heroCenter.y - 30, 0xd8c8ff, 28 * S + 6, 30, 1.2);
        refreshPiles();
        await wait(0.5);
        break;
      case "phase2": {
        applySnap(ev.snap);
        refreshIntent();
        void sound.playCue("enemy.roar", { eventId: sid() });
        warnReceipt = fx.play("danger-warning", { pos: v.enemyCenter, scale: S * 1.5 });
        fx.play("shockwave-ring", { pos: v.enemyCenter, scale: S * 2.5, power: 1 });
        fx.play("explosion-impact", { pos: v.enemyCenter, scale: S * 1.6, power: 1 });
        banner(t("bossRage"), Math.max(18, Math.min(32, W * 0.05)), 0xffb0a0, 1.6);
        const e = v.enemy, base = v.enemyBase;
        await tween(1.2, (k) => { e.x = base.x + Math.sin(k * 60) * 8 * (1 - k); e.scale.set(base.s * (1 + 0.06 * Math.sin(k * Math.PI))); });
        break;
      }
      case "playerTurn":
        applySnap(ev.snap);
        refreshIntent();
        break;
      case "death":
        applySnap(ev.snap);
        if (ev.who === "e") await onEnemyDeath();
        else await onPlayerDeath();
        return;
    }
  }
  if (card && wv) { /* sequence complete */ }
}

// =====================================================================
// flow
// =====================================================================
function startBattle() {
  if (!run) return;
  bv = null;
  const { b, evs } = newBattle(run.stage, run.deck, run.hp, run.maxHp);
  void evs;
  run.battle = b;
  run.phase = "battle";
  endAction();
  fx.clear();
  battleScene();
  syncMusic();
  if (wv) {
    layoutHand(true);
    const def = ENEMIES[run.stage - 1];
    banner(run.stage === 6 ? t("bossAppear") : t("stageStart", run.stage, enemyName(def.id)), Math.max(20, Math.min(40, W * 0.06)), P.white, 1.3);
    if (run.stage === 6) warnReceipt = fx.play("danger-warning", { pos: wv.enemyCenter, scale: fxScale() * 1.4 });
  }
  save();
}

async function onEnemyDeath() {
  if (!run?.battle || !wv) return;
  const v = wv;
  const b = run.battle;
  v.intent.visible = false;
  fx.play("death-burst", { pos: v.enemyCenter, scale: fxScale() * 2, power: 1 });
  void sound.playCue("jingle.victory", { eventId: sid() });
  const e = v.enemy, base = v.enemyBase;
  void tween(0.7, (k) => { e.alpha = 1 - k; e.scale.set(base.s * (1 + 0.1 * k), base.s * (1 - 0.5 * k)); });
  const stamp = num("VICTORY", Math.min(W * 0.16, 120), P.gold);
  stamp.anchor.set(0.5);
  stamp.position.set(W / 2, H * 0.32);
  stamp.rotation = -0.12;
  popLayer.addChild(stamp);
  await tween(0.3, (k) => { stamp.scale.set(2.2 - 1.2 * easeOut(k)); stamp.alpha = k; });
  fx.play("confetti-burst", { pos: { x: W / 2, y: H * 0.32 }, scale: fxScale() });
  await wait(1.1);
  stamp.destroy();
  run.turns += b.turn;
  for (const [k, n] of Object.entries(b.dmg)) run.dmg[k] = (run.dmg[k] ?? 0) + n;
  const fullHp = b.p.hp >= b.p.maxHp;
  if (!fullHp) run.flawless = false;
  if (run.stage >= 6) {
    run.hp = b.p.hp;
    run.battle = null;
    checkClearAchievements(fullHp);
    endRun("win");
    return;
  }
  run.hp = Math.min(run.maxHp, b.p.hp + WIN_HEAL);
  run.battle = null;
  run.stage++;
  run.phase = "bonus";
  run.time = MODES[run.mode].bonus;
  run.offer = null;
  wv = null;
  fx.clear();
  buildScene();
  syncMusic();
  banner(t("hpRecover", WIN_HEAL, MODES[run.mode].bonus), Math.max(18, Math.min(30, W * 0.05)), P.white, 1.6);
  save();
}

async function onPlayerDeath() {
  if (!run?.battle) return;
  void sound.playCue("jingle.defeat", { eventId: sid() });
  const gray = new PIXI.ColorMatrixFilter();
  sceneLayer.filters = [gray];
  bgLayer.filters = [gray];
  let grayOn = true;
  await tween(1.6, (k) => {
    if (!grayOn) return;
    try { gray.desaturate(); gray.alpha = k; } catch { grayOn = false; sceneLayer.filters = null; bgLayer.filters = null; }
  });
  sceneLayer.filters = null;
  bgLayer.filters = null;
  const b = run.battle;
  run.turns += b.turn;
  for (const [k, n] of Object.entries(b.dmg)) run.dmg[k] = (run.dmg[k] ?? 0) + n;
  run.hp = 0;
  endRun("lose");
}

function checkClearAchievements(bossFullHp         ) {
  if (!run) return;
  const ach = (window       ).gp?.player?.achievements;
  if (!ach) return;
  if (bossFullHp) void ach.unlock("boss_flawless");
  if (bossFullHp && run.flawless) void ach.unlock("all_flawless");
  const tags = new Set(run.deck.map((id) => CARD_MAP[id]?.tag ?? null));
  if (run.deck.length > 0 && tags.size === 1 && !tags.has(null)) void ach.unlock("mono_tag");
  if (run.deck.length >= 30) void ach.unlock("big_deck");
  if (run.turns <= 10) void ach.unlock("speed_clear");
  if (run.mode === "normal") void ach.unlock("clear_normal");
  else if (run.mode === "hard") void ach.unlock("clear_hard");
  else if (run.mode === "extreme") void ach.unlock("clear_extreme");
}

function endRun(result                ) {
  if (!run) return;
  wv = null;
  bv = null;
  endAction();
  run.result = result;
  run.phase = "result";
  clearSave();
  syncMusic();
  showResult();
}

/** Result background on canvas; the panel itself is the DOM result screen (ui.ts). */
function showResult() {
  sceneLayer.filters = null;
  bgLayer.filters = null;
  if (!run) return;
  destroyChildren(sceneLayer);
  destroyChildren(bgLayer);
  const win = run.result === "win";
  bgLayer.addChild(coverSprite(tex[win ? "bg-volcano" : "bg-courtyard"], 0, 0, W, H, 0.55));
  bgLayer.addChild(new PIXI.Graphics().rect(0, 0, W, H).fill({ color: P.ink, alpha: 0.62 }));
  const best = readBest();
  const stage = win ? 6 : run.stage;
  const newer = stage > best.stage || (win && best.turns > 0 && run.turns < best.turns) || (win && best.stage < 6);
  if (win) best.turns = best.turns === 0 ? run.turns : Math.min(best.turns, run.turns);
  if (stage > best.stage) best.stage = stage;
  writeBest(best);
  const mvp = Object.entries(run.dmg).sort((a, b) => b[1] - a[1])[0];
  void gp_pi_submitScore(stage * 1000 + Math.max(0, 999 - run.turns));
  uiModel.result = {
    win, stage, turns: run.turns, deck: [...run.deck],
    mvpId: mvp ? mvp[0] : null, mvpDmg: mvp ? mvp[1] : 0,
    bestStage: best.stage, bestTurns: best.turns, newest: newer, mode: run.mode,
  };
  syncUi();
  captureShare();
}

async function gp_pi_submitScore(score        ) {
  try {
    const g = (window       ).gp;
    await g?.player?.submitScore?.(score);
  } catch { /* leaderboard is best-effort */ }
}

;                                              
let bestCache       = { stage: 0, turns: 0 };
function readBest()       {
  try {
    const raw = (window       ).gp?.player?.saves?.get?.("__sys_best");
    if (raw && typeof raw === "object" && raw.turns > 0) return { ...raw };
  } catch { /* no local best yet */ }
  return { ...bestCache };
}
function writeBest(b      ) {
  bestCache = { stage: Math.max(bestCache.stage, b.stage), turns: b.turns || bestCache.turns };
  void (window       ).gp?.player?.saves?.put?.("__sys_best", JSON.stringify(bestCache), "__sys_best");
}

function startNewRun() {
  paused = false;
  run = newRun(selectedMode);
  wv = null;
  bv = null;
  endAction();
  titleShown = false;
  fx.clear();
  sceneLayer.filters = null;
  bgLayer.filters = null;
  uiModel.screen = null;
  uiModel.result = null;
  uiModel.phase = "build";
  buildScene();
  syncMusic();
  syncUi();
}

function relayout() {
  if (!run && !titleShown) return;
  if (loading.parent) return;
  hidePreview();
  dragging = null;
  if (titleShown) paintTitleBg();
  else if (run?.phase === "battle") battleScene();
  else if (run?.phase === "build" || run?.phase === "bonus") buildScene();
  else if (run?.phase === "result") showResult();
}

function paintTitleBg() {
  destroyChildren(sceneLayer);
  destroyChildren(bgLayer);
  bgLayer.addChild(coverSprite(tex["bg-volcano"] ?? tex["bg-gacha"], 0, 0, W, H, 0.55));
  bgLayer.addChild(new PIXI.Graphics().rect(0, 0, W, H).fill({ color: P.ink, alpha: 0.42 }));
}

// ---------- UI model bridge ----------
const uiModel          = {
  phase: "title", screen: null,
  hasResume: false, deckCount: 0, deckRows: [], deckTags: "", result: null, drawPile: [], discardCount: 0, discardPile: [],
  muted: false, volumes: { master: 1, music: 0.8, sfx: 1 },
  mode: selectedMode, modes: MODES, achievements: null,
  cardIds: CARDS.map((c) => c.id), cardRates: [],
};
let achReturn                    = null;
async function loadAchievements() {
  uiModel.achievements = null;
  syncUi();
  let got        = [];
  try {
    const list = await (window       ).gp?.player?.achievements?.list?.();
    if (Array.isArray(list)) got = list;
  } catch { /* platform list unavailable: show everything as locked */ }
  const done = new Set(got.filter((a) => a?.unlocked).map((a) => a.key));
  uiModel.achievements = ACH_KEYS.map((key)         => {
    const [name, desc] = achText(key);
    return { key, name, desc, icon: `assets/achievements/${key}.webp`, unlocked: done.has(key) };
  });
  syncUi();
}
function openDrawPile() {
  if (!run?.battle || busy || paused || uiModel.screen) return;
  void sound.playCue("ui.click", { eventId: sid() });
  uiModel.drawPile = run.battle.draw.map((c) => c.id);
  uiModel.discardCount = run.battle.discard.length;
  paused = true;
  uiModel.screen = "drawpile";
  hidePreview();
  dragging = null;
  syncUi();
}
function openDiscardPile() {
  if (!run?.battle || busy || paused || uiModel.screen) return;
  void sound.playCue("ui.click", { eventId: sid() });
  uiModel.discardPile = run.battle.discard.map((c) => c.id);
  paused = true;
  uiModel.screen = "discardpile";
  hidePreview();
  dragging = null;
  syncUi();
}
let resumeAvailable             = null;

function deckTagsOf(deck          )         {
  const c                         = {};
  for (const id of deck) { const tg = CARD_MAP[id].tag; if (tg) c[tg] = (c[tg] ?? 0) + 1; }
  return Object.keys(c).length ? Object.entries(c).map(([k, n]) => `${tagName(k)}${n}`).join("  ") : "";
}

function syncUi() {
  if (!run) { updateUi({ phase: "title", hasResume: !!resumeAvailable, deckCount: 0, deckRows: [], deckTags: "" }); return; }
  updateUi({
    phase: run.phase === "title" ? "title" : (run.phase                    ),
    hasResume: !!resumeAvailable,
    deckCount: run.deck.length,
    deckRows: groupDeck(run.deck),
    deckTags: deckTagsOf(run.deck),
  });
}

let shareBlob              = null;
function captureShare() {
  const snap = (window       ).gp?.share?.snap;
  if (!snap) return;
  void snap().then((b      ) => { shareBlob = b; }).catch(() => { shareBlob = null; });
}
const uiHost = {
  onStart(fresh         ) {
    void unlockAudio();
    titleShown = false;
    paused = false;
    void sound.setHold("pause-menu", false);
    if (!fresh && resumeAvailable) {
      run = resumeAvailable;
      selectedMode = run.mode;
      uiModel.mode = run.mode;
      resumeAvailable = null;
      sceneLayer.filters = null;
      bgLayer.filters = null;
      if (run.phase === "battle" && run.battle) battleScene(); else buildScene();
      syncMusic();
    } else {
      resumeAvailable = null;
      startNewRun();
    }
    syncUi();
  },
  onPause() { paused = true; uiModel.screen = "pause"; syncUi(); void sound.setHold("pause-menu", true); },
  onResume() { paused = false; uiModel.screen = null; syncUi(); void sound.setHold("pause-menu", false); },
  onSettings() { uiModel.screen = "settings"; syncUi(); },
  onCloseScreen() {
    if (uiModel.screen === "drawpile" || uiModel.screen === "discardpile") { paused = false; uiModel.screen = null; }
    else if (uiModel.screen === "achievements") uiModel.screen = achReturn;
    else uiModel.screen = paused ? "pause" : null;
    syncUi();
  },
  onOpenAchievements() { achReturn = uiModel.screen; uiModel.screen = "achievements"; void loadAchievements(); },
  onOpenTutorial() { resetTutorial(); uiModel.screen = "tutorial"; syncUi(); },
  onOpenCardList() { uiModel.screen = "cardlist"; syncUi(); },
  onSetMode(m      ) { selectedMode = m; uiModel.mode = m; syncUi(); },
  onOpenDeckView() { uiModel.screen = "deck"; syncUi(); },
  onBackToTitle() {
    paused = false;
    void sound.setHold("pause-menu", false);
    if (run && run.phase !== "result") save();
    if (run && run.phase === "result") { run = null; clearSave(); }
    uiModel.screen = null;
    resumeAvailable = readSave();
    titleShown = true;
    showTitle();
  },
  onRestart() { uiModel.result = null; uiModel.screen = null; if (run) selectedMode = run.mode; uiModel.mode = selectedMode; startNewRun(); },
  async onShare() {
    const g = (window       ).gp;
    if (!g?.share?.image) return t("shareDone");
    if (!shareBlob) { captureShare(); await wait(0.6); }
    const r = run;
    const stage = r && r.result === "win" ? 6 : (r?.stage ?? 0);
    const text = t("shareText", stage, r?.deck.length ?? 0);
    try { if (shareBlob) await g.share.image(shareBlob, { text }); } catch { /* user cancelled */ }
    return t("shareDone");
  },
  setMuted(m         ) { uiModel.muted = m; void sound.settings.setMuted(m); },
  setVolume(bus                            , v        ) {
    uiModel.volumes = { ...uiModel.volumes, [bus]: v };
    void sound.settings.setVolumes(uiModel.volumes);
  },
  click() { void sound.playCue("ui.click", { eventId: sid() }); },
};

function showTitle() {
  run = null;
  wv = null;
  bv = null;
  lastBvRef = null;
  endAction();
  hidePreview();
  dragging = null;
  titleShown = true;
  uiModel.screen = null;
  uiModel.result = null;
  uiModel.phase = "title";
  paintTitleBg();
  syncUi();
}

function scheduleLangRebuild() {
  onLangChange(() => {
    document.title = t("title");
    if (Array.isArray(uiModel.achievements)) uiModel.achievements = uiModel.achievements.map((r) => { const [name, desc] = achText(r.key); return { ...r, name, desc }; });
    if (!run) return;
    hidePreview();
    dragging = null;
    if (run.phase === "battle") battleScene();
    else if (run.phase === "build" || run.phase === "bonus") buildScene();
    else if (run.phase === "result") showResult();
  });
}

// ---------- keyboard ----------
window.addEventListener("keydown", (e) => {
  if (!run || paused) return;
  if (run.phase === "build" || run.phase === "bonus") {
    if (e.code === "Space") { e.preventDefault(); summon(); }
    else if (e.key >= "1" && e.key <= "3") pickOffer(Number(e.key) - 1);
    else if (e.key === "Enter") finishBuild(false);
  } else if (run.phase === "battle") {
    if (e.key >= "1" && e.key <= "9") void doPlay(Number(e.key) - 1);
    else if (e.key === "0") void doPlay(9);
    else if (e.key.toLowerCase() === "e") void doEndTurn();
  }
});

// ---------- main loop ----------
let idleT = 0;
let tickErrs = 0;
function tickBody(t             ) {
  const real = Math.min(t.deltaMS / 1000, 0.05);
  const scale = fx.update(real);
  const dt = real * scale;
  root.position.set(impulse.offsetX * 14 * fxScale(), impulse.offsetY * 14 * fxScale());
  stepTweens(dt);
  updateBuild(real);
  idleT += dt;
  if (dragging && !dragging.moved && !dragging.preview && performance.now() - dragging.t0 > 380) {
    dragging.preview = true;
    showPreview(dragging.idx);
  }
  if (busy && performance.now() - busySince > 5000) { endAction(); console.warn("action watchdog fired"); afterAction(); }
  if (wv) {
    if (heroFlashT > 0) { heroFlashT -= dt; if (heroFlashT <= 0) wv.heroSprite.tint = 0xffffff; }
    if (warnReceipt) fx.setTransform(warnReceipt, wv.enemyCenter);
    stepHp(wv.ehp, dt);
    stepHp(wv.php, dt);
    if (!busy && wv.enemy.alpha > 0.99) {
      const base = wv.enemyBase;
      wv.enemy.scale.set(base.s * (1 + 0.012 * Math.sin(idleT * 2.2)), base.s * (1 - 0.018 * Math.sin(idleT * 2.2)));
    }
  }
}

app.ticker.add((t) => { try { tickBody(t); } catch (e) { tickErrs++; if (tickErrs < 4) console.warn("tick error", e); } });

// ---------- boot ----------
await (window       ).gp?.player?.ready;
{
  const g = (window       ).gp;
  if (g?.player?.user?.locale && !isManualLang()) setLang(pickLang(g.player.user.locale));
}
setCardFacts((id) => [CARD_MAP[id]?.cost ?? 0, CARD_MAP[id]?.rarity ?? "N", CARD_MAP[id]?.tag ?? null]);
uiModel.cardRates = RARITY_RATE.map(([r, p]) => ({ rarity: r, pct: Math.round(p * 100) }));
resumeAvailable = readSave();
readBest();
uiModel.hasResume = !!(resumeAvailable && resumeAvailable.phase !== "title");
const dispSafe = display                                                        ;
mountUi(host, uiModel, uiHost, { safeTop: dispSafe.safeTop ?? 0, safeBottom: dispSafe.safeBottom ?? 0 });
scheduleLangRebuild();
document.title = t("title");
showTitle();
app.ticker.remove(loadTick);
loading.destroy({ children: true });
(window       ).__gpPlayable = true;

// test hooks (read-only views + actions)
(window       ).__dbg = {
  get run() { return run; },
  get busy() { return busy; },
  get model() { return uiModel; },
  soundState() { try { return sound.inspect(); } catch (e) { return String(e); } },
  snap() { return { busy, busySince, tweens: tweens.length, tw: tweens.map((x) => [x.t, x.d]), wv: !!wv, paused, phase: run?.phase, tickErrs }; },
  get ui() { return uiHost; },
  summon, pickOffer, deleteCard, finishBuild, doPlay, doEndTurn, startNewRun, showResult, showTitle,
  setDeck(ids          ) { if (run) { run.deck = ids; try { refreshDeckList(); } catch (e) { console.warn("deck list redraw failed", e); } syncUi(); } },
  get enemyCenter() { return wv?.enemyCenter; },
  get hand() { return wv?.cards.map((c) => ({ x: c.x, y: c.y })); },
  get offer() { return bv?.offerCards.map((c) => ({ x: c.x, y: c.y })); },
  get summonBtn() { return bv ? { x: bv.summonBtn.x, y: bv.summonBtn.y } : null; },
  get endBtn() { return wv ? { x: wv.endBtn.x, y: wv.endBtn.y } : null; },
  get wvRaw() { return wv; },
  get discardPilePos() { const c = wv?.discText.parent; return c ? { x: c.x, y: c.y + 4 } : null; },
  get drawPilePos() { const c = wv?.drawText.parent; return c ? { x: c.x, y: c.y + 4 } : null; },
  get rows() { return bv?.rows.map((r) => ({ id: r.id, x: r.x + r.w / 2, y: r.y + r.h / 2 - (bv?.scroll ?? 0) })); },
  HAND_MAX,
};
