// 四角にハマる — polyomino rectangle-filling puzzle (pixi.js v8)
// Entry point. Data: puzzles.ts (generated+verified), strings: i18n.ts.
import * as PIXI from "pixi.js";
import { loadSoundSystem } from "@makeplay/sound";
import { createPixiFx, FX_PRESETS } from "@makeplay/fx";
                                                                  
import { MAIN_PUZZLES, POOL_PUZZLES } from "./puzzles.js";
                                              
import { LANGS, pickLang, LANG_LABELS, LANG_ORDER } from "./i18n.js";
                                               

// ---------- constants ----------
const UNIT = 64; // logical pixels per cell in piece/board geometry
const PAL = {
  bg: 0xf7f3e8, line: 0xb8c8d8, ink: 0x28323c, boardFill: 0xfdfbf2,
  tray: 0xefe9da, ok: 0x45b7a5, bad: 0xd94f4f, white: 0xffffff,
};
const PIECE_COLORS = [0xef6f6c, 0x45b7a5, 0xe7b84b, 0x559ccf, 0x9274c7];
const FONT = "'Hiragino Maru Gothic ProN','Rounded Mplus 1c','M PLUS Rounded 1c','Noto Sans JP','Yu Gothic','Microsoft YaHei',sans-serif";
const TA_SCORE_BASE = 7200000; // one-puzzle score band; higher = faster (old 3-puzzle scores stay below it)

                            // [flip, rotCW]
                             

// ---------- D4 transform helpers (must match generator math) ----------
function applyT(cells        , t    )         {
  let cs         = cells.map(([x, y]) => (t[0] ? [-x, y] : [x, y]));
  for (let i = 0; i < t[1]; i++) cs = cs.map(([x, y]) => [-y, x]);
  const mx = Math.min(...cs.map((c) => c[0])), my = Math.min(...cs.map((c) => c[1]));
  return cs.map(([x, y]) => [x - mx, y - my]        ).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const rotT = (t    )     => [t[0], (t[1] + 1) % 4];
const flipT = (t    )     => [1 - t[0], (4 - t[1]) % 4];
function boundsOf(cells        )                           {
  return { w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1 };
}
function shade(c        , f        )         {
  const r = Math.min(255, (((c >> 16) & 255) * f) | 0);
  const g = Math.min(255, (((c >> 8) & 255) * f) | 0);
  const b = Math.min(255, ((c & 255) * f) | 0);
  return (r << 16) | (g << 8) | b;
}
function fmtTime(ms        )         {
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

// ---------- save ----------
;                                                           
;                  
                           
                                                                                  
                                                         
                                                               
                             
 
const MAX_PROFILES = 8, MAX_RUNS = 20, MAX_NAME = 12;
                    
                                                                     
                                             
           
                                                 
 
function defaultSave()           {
  return { v: 1, stamps: new Array(15).fill(0), taBest: null, lang: null, volM: 0.8, volS: 0.9, muted: false, tut: { drag: false, rot: false, flip: false }, profiles: [], curProfile: null };
}
function parseStamps(x         )           {
  const a = Array.isArray(x) ? (x             ) : [];
  return new Array(15).fill(0).map((_, i) => (typeof a[i] === "number" ? ((a[i]          ) | 0) : 0));
}
function parseTut(x         )      {
  const t = (x ?? {})                           ;
  return { drag: t.drag === true, rot: t.rot === true, flip: t.flip === true };
}
function parseProfile(x         )                 {
  if (!x || typeof x !== "object") return null;
  const o = x                           ;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const runs                              = [];
  if (Array.isArray(o.runs)) for (const r of o.runs             ) {
    const rr = r                           ;
    if (rr && typeof rr.t === "number") runs.push({ t: rr.t | 0, at: typeof rr.at === "number" ? rr.at : 0 });
  }
  const oneRuns                              = [];
  if (Array.isArray(o.ta1Runs)) for (const r of o.ta1Runs             ) {
    const rr = r                           ;
    if (rr && typeof rr.t === "number") oneRuns.push({ t: rr.t | 0, at: typeof rr.at === "number" ? rr.at : 0 });
  }
  return {
    id: o.id, name: o.name.slice(0, MAX_NAME),
    best: typeof o.best === "number" ? o.best : null,
    runs: runs.slice(-MAX_RUNS),
    ta1Best: typeof o.ta1Best === "number" ? o.ta1Best : null,
    ta1Runs: oneRuns.slice(-MAX_RUNS),
    stamps: parseStamps(o.stamps), tut: parseTut(o.tut),
  };
}
function parseSave(d         )                  {
  if (!d || typeof d !== "object") return null;
  const o = d                           ;
  if (o.v !== 1 || !Array.isArray(o.stamps)) return null;
  const base = defaultSave();
  base.stamps = parseStamps(o.stamps);
  base.taBest = typeof o.taBest === "number" ? o.taBest : null;
  base.lang = typeof o.lang === "string" ? o.lang : null;
  base.volM = typeof o.volM === "number" ? o.volM : base.volM;
  base.volS = typeof o.volS === "number" ? o.volS : base.volS;
  base.muted = o.muted === true;
  base.tut = parseTut(o.tut);
  if (Array.isArray(o.profiles)) base.profiles = (o.profiles             ).map(parseProfile).filter((p)               => p !== null).slice(0, MAX_PROFILES);
  base.curProfile = typeof o.curProfile === "string" && base.profiles.some((p) => p.id === o.curProfile) ? o.curProfile : (base.profiles[0]?.id ?? null);
  return base;
}
function curProfile()                 { return save.profiles.find((p) => p.id === save.curProfile) ?? null; }
/** progress (stamps / tutorial flags) belongs to the selected player; without a player the legacy device-wide fields are used */
function curStamps()           { return curProfile()?.stamps ?? save.stamps; }
function curTut()      { return curProfile()?.tut ?? save.tut; }
function newProfileId()         { return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function addProfile(name        )                 {
  if (save.profiles.length >= MAX_PROFILES) return null;
  // a new player starts from puzzle 1 with fresh tutorials and no time-attack records
  const p          = {
    id: newProfileId(), name: name.trim().slice(0, MAX_NAME) || "?",
    best: null, runs: [], ta1Best: null, ta1Runs: [],
    stamps: new Array(15).fill(0), tut: { drag: false, rot: false, flip: false },
  };
  save.profiles.push(p); save.curProfile = p.id; saveNow();
  return p;
}
function recordOnePuzzleRun(p         , ms        )          {
  const isBest = p.ta1Best === null || ms < p.ta1Best;
  if (isBest) p.ta1Best = ms;
  p.ta1Runs.push({ t: ms, at: Date.now() });
  if (p.ta1Runs.length > MAX_RUNS) p.ta1Runs.splice(0, p.ta1Runs.length - MAX_RUNS);
  saveNow();
  return isBest;
}
/** local (this device) ranking: players with a best time first, fastest on top */
function localRanking()            {
  return save.profiles.slice().sort((a, b) => (a.ta1Best ?? Infinity) - (b.ta1Best ?? Infinity));
}
/** legacy saves had one device-wide progress: hand it to the first player */
function migrateLegacyBest()       {
  if (save.profiles.length === 0 && (save.taBest !== null || save.stamps.some((s) => s > 0))) {
    const p = addProfile(`${T.playerLabel} 1`);
    if (p) {
      p.stamps = save.stamps.slice(); p.tut = { ...save.tut };
      if (save.taBest !== null) { p.best = save.taBest; p.runs.push({ t: save.taBest, at: 0 }); }
      saveNow();
    }
  }
}

// ---------- share (gp.share is not in the typed contract yet) ----------
;                  
                                                 
                                    
                                                               
 
const gpShare                      = (gp                                  ).share;

// ---------- module state ----------
let app                  ;
let sound                  ;
let fx                                                                                                                                                = null;
let confettiId                = null;
let texFiber              , texStamp              , texPencil              , texEraser              ;
let save           = defaultSave();
let lang          = "ja";
let T       = LANGS.ja;

let shakeWrap                , sceneRoot                , dragLayer                ,
  overlayRoot                , fxWorld                , fxScreen                ;
let bgTile                   ;

let scene                                                                 = "title";
let audioOn = false;

// tweens
                                                                                                     
const tweens          = [];
function tw(dur        , fn                     , done             , delay = 0)       {
  tweens.push({ delay, t: 0, dur, fn, done });
}
function after(sec        , fn            )       { tw(0.001, () => { /* wait */ }, fn, sec); }
const eoQ = (k        )         => 1 - Math.pow(1 - k, 3);
const eoBack = (k        )         => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

function cue(id       )       {
  // literal cue IDs (catalog contract)
  switch (id) {
    case "music.think": void sound.playCue("music.think"); break;
    case "sfx.button": void sound.playCue("sfx.button"); break;
    case "sfx.clear": void sound.playCue("sfx.clear"); break;
    case "sfx.flip": void sound.playCue("sfx.flip"); break;
    case "sfx.hint": void sound.playCue("sfx.hint"); break;
    case "sfx.invalid": void sound.playCue("sfx.invalid"); break;
    case "sfx.pickup": void sound.playCue("sfx.pickup"); break;
    case "sfx.rotate": void sound.playCue("sfx.rotate"); break;
    case "sfx.snap": void sound.playCue("sfx.snap"); break;
    case "sfx.undo": void sound.playCue("sfx.undo"); break;
    case "sfx.drop": void sound.playCue("sfx.drop"); break;
    case "sfx.stamp": void sound.playCue("sfx.stamp"); break;
    case "sfx.record": void sound.playCue("sfx.record"); break;
  }
}
function saveNow()       { void gp.player.saves.putLatest(save); }

// ---------- play state ----------
;                     
                                                                    
                                                                
                                                                                                   
 
;                                                                                                        
;                
                                                                      
                                                                                              
 
let lastTaPuzzle                   = null;

let mode                = "main";
let qIndex = 0;
let puzzle                   = null;
let pieces               = [];
let moves = 0, hintsUsed = 0, hintsLeft = 2;
let history         = [];
let placedOrder           = [];
let solved = false;
let taRun               = null;
let selected                    = null;
let drag                                                                                                                                                                                         = null;

// play scene containers/refs (rebuilt per puzzle)
let boardWrap                , boardLayer                , gridG               ,
  piecesLayer                , ghostG               , hintG               , fxBoard                ;
let trayLayer                , trayBg               ;
let hudRefs   
                                                                                 
                                                                                        
                                                                                                    
         = null;
let boardScale = 1;
let trayScale = 0.5;
let trayRect = { x: 0, y: 0, w: 100, h: 100 };
let lastW = 0, lastH = 0;

// ==========================================================================
// boot
// ==========================================================================
async function boot()                {
  const host = document.getElementById("app")               ;
  app = new PIXI.Application();
  await app.init({
    resizeTo: host, background: PAL.bg, antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
  });
  host.appendChild(app.canvas);

  // loading frame (own visible loading UI), then hand off to the platform
  const loadT = new PIXI.Text({ text: LANGS[pickLang(navigator.language)].loading, style: { fontFamily: FONT, fontSize: 22, fill: PAL.ink, fontWeight: "700" } });
  loadT.anchor.set(0.5);
  loadT.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(loadT);
  window.__gpReady = true;

  // save + language
  save = parseSave(gp.player.saves.latestSync) ?? defaultSave();
  lang = pickLang(save.lang ?? navigator.language);
  document.title = "四角にハマる";
  document.documentElement.lang = lang;
  document.documentElement.dir = "ltr";
  T = LANGS[lang];
  migrateLegacyBest();
  loadT.text = T.loading;
  let uiReady = false;
  void gp.player.ready.then(({ user }) => {
    if (!save.lang && user?.locale) { lang = pickLang(user.locale); T = LANGS[lang]; if (uiReady && scene === "title") buildTitle(); }
  });

  // assets
  const [fiber, bg, stamp, pencil, eraser] = await Promise.all([
    PIXI.Assets.load("assets/paper-fiber.png"),
    PIXI.Assets.load("assets/bg-paper.png"),
    PIXI.Assets.load("assets/stamp.png"),
    PIXI.Assets.load("assets/prop-pencil.png"),
    PIXI.Assets.load("assets/prop-eraser.png"),
  ]);
  texFiber = fiber                ; texStamp = stamp                ;
  texPencil = pencil                ; texEraser = eraser                ;

  sound = (await loadSoundSystem({ manifestUrl: "./sound.manifest.json" }))                    ;
  sound.settings.setVolumes({ music: save.volM, sfx: save.volS });
  sound.settings.setMuted(save.muted);

  // stage layout
  app.stage.removeChild(loadT); loadT.destroy();
  bgTile = new PIXI.TilingSprite({ texture: bg                , width: app.screen.width, height: app.screen.height });
  bgTile.tileScale.set(0.5);
  shakeWrap = new PIXI.Container();
  sceneRoot = new PIXI.Container();
  fxWorld = new PIXI.Container();
  dragLayer = new PIXI.Container();
  overlayRoot = new PIXI.Container();
  fxScreen = new PIXI.Container();
  shakeWrap.addChild(sceneRoot);
  app.stage.addChild(bgTile, shakeWrap, fxWorld, dragLayer, overlayRoot, fxScreen);

  // FX runtime (impulse is intentionally NOT wired to the camera: this game never shakes the screen)
  try {
    const f = await createPixiFx({
      PIXI, app, world: fxWorld, screen: fxScreen, referenceSpan: 80,
      onImpulse: () => { /* no screen shake by design */ },
    }                                                 );
    fx = f                        ;
    const raw          = FX_PRESETS;
    let ids           = [];
    if (Array.isArray(raw)) ids = raw.map((e) => (typeof e === "string" ? e : (e && typeof e === "object" && "id" in e ? String((e                   ).id) : ""))).filter(Boolean);
    else if (raw && typeof raw === "object") ids = Object.keys(raw);
    confettiId = ids.find((s) => /confetti/i.test(s)) ?? ids.find((s) => /celebrat|firework|sparkle|reward/i.test(s)) ?? null;
  } catch { fx = null; }

  // audio unlock on the first real user gesture (DOM-level)
  const unlockOnce = ()       => {
    void sound.unlock();
    void ensureAudio();
  };
  window.addEventListener("pointerdown", unlockOnce, { once: true });
  window.addEventListener("keydown", unlockOnce, { once: true });

  // global input
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointerdown", () => {
    void sound.unlock();
    void ensureAudio();
  });
  app.stage.on("pointermove", onStageMove);
  app.stage.on("pointerup", onStageUp);
  app.stage.on("pointerupoutside", onStageUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("pagehide", () => { try { void sound.dispose(); fx?.dispose(); } catch { /* noop */ } }, { once: true });

  // ticker
  app.ticker.add((tk) => {
    const realDt = Math.min(tk.deltaMS / 1000, 0.05);
    const ts = fx ? fx.update(realDt) : 1;
    stepTweens(realDt * ts);
    if (scene === "play" && mode === "ta" && taRun && taRun.running && !solved) {
      taRun.timeMs = performance.now() - taRun.startedAt;
      if (hudRefs?.timerT) hudRefs.timerT.text = fmtTime(taRun.timeMs);
    }
    if (app.screen.width !== lastW || app.screen.height !== lastH) {
      lastW = app.screen.width; lastH = app.screen.height;
      onResize();
    }
  });
  lastW = app.screen.width; lastH = app.screen.height;

  buildTitle();
  uiReady = true;
  window.__gpPlayable = true;

  // debug hooks for self-testing (read-only + deterministic solver step)
  (window                                      ).__app = app;
  (window                                      ).__debug = {
    get sizes() {
      const cv = app.canvas                     ;
      return {
        inner: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio,
        screen: [app.screen.width, app.screen.height], res: app.renderer.resolution,
        canvasAttr: [cv.width, cv.height], canvasCss: [cv.style.width, cv.style.height],
        host: [(document.getElementById("app")               ).clientWidth, (document.getElementById("app")               ).clientHeight],
      };
    },
    get state() {
      return {
        scene, mode, qIndex, moves, hintsUsed, solved,
        placed: pieces.map((p) => p.placed),
        ts: pieces.map((p) => p.t.slice()),
        ta: taRun ? { step: taRun.step, timeMs: taRun.timeMs, running: taRun.running, count: taRun.course.length, puzzleIndex: POOL_PUZZLES.indexOf(taRun.course[0]), recorded: taRun.recorded } : null,
        puzzleCount: { main: MAIN_PUZZLES.length, pool: POOL_PUZZLES.length },
        stamps: curStamps().slice(), taBest: curProfile()?.ta1Best ?? null, lang,
        profiles: save.profiles.map((p) => ({ id: p.id, name: p.name, best: p.ta1Best, runs: p.ta1Runs.length })), curProfile: save.curProfile,
        ranking: localRanking().filter(p => p.ta1Best !== null).map(p => ({ name: p.name, time: p.ta1Best })),
        promptOpen: promptEl !== null,
      };
    },
    parseSaved(data         )          { return parseSave(data); },
    get savedData() { return JSON.parse(JSON.stringify(save)); },
    solveStep()          {
      const p = pieces.find((q) => !q.placed);
      if (!p || solved) return false;
      p.t = [0, 0]; rebuildPiece(p);
      const snap = snapshotState();
      doPlace(p, p.anchor[0], p.anchor[1], snap, 1);
      return true;
    },
    selectFirst()          {
      const p = pieces.find((q) => !q.placed);
      if (!p || scene !== "play") return false;
      selectPiece(p);
      return true;
    },
    controls()                                                        {
      if (!hudRefs) return null;
      const rec = (b                )          => {
        const r = b.getBounds();
        const meta = b                                      ;
        return { x: r.x, y: r.y, w: r.width, h: r.height, scale: b.scale.x, fill: meta.__fill, enabled: b.eventMode !== "none" };
      };
      return { rot: rec(hudRefs.rotB), flip: rec(hudRefs.flipB), undo: rec(hudRefs.undoB) };
    },
    start(i        )       { startMain(i); },
    startTa()       { startTa(); },
    resetNow()       { doReset(); },
    hint()       { doHint(); },
    overlayCount()         { return overlayRoot.children.length; },
    dragPlan(i        )          {
      const p = pieces[i];
      if (!p || p.placed || !puzzle) return null;
      const cells = applyT(p.cells, p.t);
      const b = boundsOf(cells);
      const occ = occupancy(p);
      for (let y = 0; y <= puzzle.h - b.h; y++) for (let x = 0; x <= puzzle.w - b.w; x++) {
        if (legalAt(cells, x, y, occ)) {
          const c = p.view.getGlobalPosition(new PIXI.Point());
          const from = { x: c.x + b.w * UNIT * p.view.scale.x / 2, y: c.y + b.h * UNIT * p.view.scale.y / 2 };
          const tg = boardLayer.toGlobal(new PIXI.Point((x + b.w / 2 * 1.06) * UNIT, (y + b.h / 2 * 1.06) * UNIT));
          return { from, to: { x: tg.x, y: tg.y }, cell: { x, y } };
        }
      }
      return null;
    },
    invalidPlan(i        )          {
      const p = pieces[i];
      if (!p || !puzzle) return null;
      const cells = applyT(p.cells, p.t);
      const b = boundsOf(cells);
      const occ = occupancy(p);
      for (let y = 0; y <= puzzle.h - b.h; y++) for (let x = 0; x <= puzzle.w - b.w; x++) {
        let conf = 0;
        for (const [cx, cy] of cells) if (occ[y + cy]?.[x + cx] !== null && occ[y + cy]?.[x + cx] !== undefined) conf++;
        if (conf > 0) {
          const c = p.view.getGlobalPosition(new PIXI.Point());
          const from = { x: c.x + b.w * UNIT * p.view.scale.x / 2, y: c.y + b.h * UNIT * p.view.scale.y / 2 };
          const tg = boardLayer.toGlobal(new PIXI.Point((x + b.w / 2 * 1.06) * UNIT, (y + b.h / 2 * 1.06) * UNIT));
          return { from, to: { x: tg.x, y: tg.y }, cell: { x, y } };
        }
      }
      return null;
    },
  };
}

async function ensureAudio()                {
  if (audioOn) return;
  audioOn = true;
  await sound.unlock();
  await sound.preload("gameplay");
  void sound.setMusicState("calm", { eventId: "session-start" });
}

function stepTweens(dt        )       {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    if (t.delay > 0) { t.delay -= dt; if (t.delay > 0) continue; }
    t.t += dt;
    const k = Math.min(t.t / t.dur, 1);
    t.fn(k);
    if (k >= 1) { tweens.splice(i, 1); t.done?.(); }
  }
}

function onResize()       {
  bgTile.width = app.screen.width; bgTile.height = app.screen.height;
  app.stage.hitArea = app.screen;
  if (scene === "play") {
    relayoutPlay();
    if (mode === "ta" && solved && overlayOpen) showTaResult();
  }
  else if (scene === "title") buildTitle();
  else if (scene === "select") buildSelect();
  else if (scene === "ending") buildEnding();
  else if (scene === "players") buildPlayers();
  else if (scene === "ranking") buildRanking();
}

// ==========================================================================
// generic UI helpers
// ==========================================================================
function mkText(str        , size        , color = PAL.ink, weight                = "700", align                              = "center")            {
  const t = new PIXI.Text({ text: str, style: { fontFamily: FONT, fontSize: size, fill: color, fontWeight: weight, align, lineHeight: size * 1.35 } });
  return t;
}

function mkButton(label        , w        , h        , onTap            , opts                                                         )                 {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const fill = opts?.fill ?? PAL.white;
  g.roundRect(3, 5, w, h, 12).fill({ color: 0x000000, alpha: 0.10 });
  g.roundRect(0, 0, w, h, 12).fill({ color: fill, alpha: 1 }).stroke({ width: 2.5, color: PAL.ink, alpha: 0.85 });
  c.addChild(g);
  const t = mkText(label, opts?.small ? 15 : 19, opts?.textColor ?? PAL.ink);
  t.anchor.set(0.5); t.position.set(w / 2, h / 2);
  if (t.width > w - 14) t.scale.set((w - 14) / t.width);
  c.addChild(t);
  c.eventMode = "static"; c.cursor = "pointer";
  c.on("pointertap", (e                            ) => {
    e.stopPropagation();
    void sound.unlock();
    void ensureAudio();
    cue("sfx.button");
    onTap();
  });
  (c                                      ).__label = t;
  const meta = c                                      ;
  meta.__bg = g; meta.__bw = w; meta.__bh = h; meta.__fill = fill;
  return c;
}
function setBtnFill(b                , color        )       {
  const r = b                                      ;
  if (r.__fill === color) return;
  r.__fill = color;
  const g = r.__bg                 , w = r.__bw          , h = r.__bh          ;
  const accent = color === 0xdcf1ec;
  g.clear();
  g.roundRect(3, 5, w, h, 12).fill({ color: 0x000000, alpha: 0.10 });
  g.roundRect(0, 0, w, h, 12).fill({ color, alpha: 1 }).stroke({ width: accent ? 4 : 2.5, color: accent ? PAL.ok : PAL.ink, alpha: 0.9 });
}
/** instant press feedback: quick scale pop + a short haptic tap (no-op where unsupported) */
function addPressFx(b                )       {
  b.on("pointerdown", () => {
    if (typeof navigator.vibrate === "function") { try { navigator.vibrate(12); } catch { /* no-op */ } }
    b.scale.set(1.12);
    tw(0.16, (k) => { if (!b.destroyed) b.scale.set(1.12 - 0.12 * eoQ(k)); }, () => { if (!b.destroyed) b.scale.set(1); });
  });
}
function setBtnEnabled(b                , on         )       {
  b.eventMode = on ? "static" : "none";
  b.alpha = on ? 1 : 0.4;
}

function mkPanel(w        , h        )                 {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.roundRect(6, 9, w, h, 18).fill({ color: 0x000000, alpha: 0.13 });
  g.roundRect(0, 0, w, h, 18).fill({ color: 0xfffdf6 }).stroke({ width: 3, color: PAL.ink, alpha: 0.8 });
  c.addChild(g);
  return c;
}

let overlayOpen = false;
function openOverlay(panel                )       {
  closeOverlay();
  overlayOpen = true;
  const dim = new PIXI.Graphics();
  dim.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x28323c, alpha: 0.35 });
  dim.eventMode = "static";
  overlayRoot.addChild(dim, panel);
  panel.position.set(Math.round((app.screen.width - panel.width) / 2), Math.round((app.screen.height - panel.height) / 2));
  panel.alpha = 0; panel.scale.set(0.94);
  const px = panel.position.x + panel.width / 2, py = panel.position.y + panel.height / 2;
  tw(0.16, (k) => { if (panel.destroyed) return; panel.alpha = k; const s = 0.94 + 0.06 * eoQ(k); panel.scale.set(s); panel.position.set(px - (panel.width / panel.scale.x) * s / 2, py - (panel.height / panel.scale.y) * s / 2); });
}
function closeOverlay()       {
  overlayOpen = false;
  overlayRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
}

function addDeskProps(parent                )       {
  const W = app.screen.width, H = app.screen.height;
  const s = Math.min(W, H);
  const pencil = new PIXI.Sprite(texPencil);
  pencil.anchor.set(0.5); pencil.rotation = -0.5;
  pencil.width = s * 0.22; pencil.scale.y = pencil.scale.x;
  pencil.position.set(W - s * 0.09, H * 0.16); pencil.alpha = 0.85;
  const eraser = new PIXI.Sprite(texEraser);
  eraser.anchor.set(0.5); eraser.rotation = 0.35;
  eraser.width = s * 0.11; eraser.scale.y = eraser.scale.x;
  eraser.position.set(s * 0.07, H * 0.82); eraser.alpha = 0.8;
  parent.addChild(pencil, eraser);
}

async function captureShare()                       {
  if (gpShare && typeof gpShare.snap === "function") {
    try { const b = await gpShare.snap(); if (b) return b; } catch { /* fall through */ }
  }
  try {
    const src = app.renderer.extract.canvas({ target: app.stage, frame: new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height) })                                ;
    const k = Math.min(1, 1280 / Math.max(src.width, src.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    const g = c.getContext("2d"); if (!g) return null;
    g.drawImage(src, 0, 0, c.width, c.height);
    return await new Promise             ((r) => c.toBlob((b) => r(b), "image/webp", 0.85));
  } catch { return null; }
}
function addShareRow(panel                , y        , text        )       {
  if (!gpShare || gpShare.available === false || typeof gpShare.image !== "function") return;
  let blob              = null; let sharing = false;
  void captureShare().then((b) => {
    blob = b;
    if (!blob) return;
    const w = 150;
    const btn = mkButton(T.share, w, 46, () => {
      if (!blob || sharing) return;
      sharing = true;
      void gpShare.image (blob, { text }).then(() => { sharing = false; });
    });
    btn.position.set((panel.width / panel.scale.x - w) / 2, y);
    panel.addChild(btn);
  });
}

// ==========================================================================
// title / select / ending scenes
// ==========================================================================
function clearScene()       {
  tweens.length = 0;
  closeOverlay();
  if (ghostG && !ghostG.destroyed) ghostG.clear();
  drag = null; selected = null;
  fx?.clear();
  sceneRoot.removeChildren().forEach((c) => c.destroy({ children: true }));
  dragLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  hudRefs = null;
}

function buildTitle()       {
  scene = "title";
  clearScene();
  const W = app.screen.width, H = app.screen.height;
  addDeskProps(sceneRoot);

  // decorative pieces
  const deco = new PIXI.Container();
  const decoDefs                                                                      = [
    { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: 0, x: W * 0.16, y: H * 0.20, r: -0.3 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: 3, x: W * 0.82, y: H * 0.58, r: 0.4 },
    { cells: [[0, 0], [1, 0], [2, 0]], color: 2, x: W * 0.12, y: H * 0.66, r: 0.15 },
    { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: 4, x: W * 0.85, y: H * 0.16, r: 0.5 },
  ];
  for (const d of decoDefs) {
    const c = new PIXI.Container();
    drawCellsInto(c, d.cells, d.color, false);
    const b = boundsOf(d.cells);
    c.pivot.set(b.w * UNIT / 2, b.h * UNIT / 2);
    c.position.set(d.x, d.y); c.rotation = d.r;
    c.scale.set(Math.min(W, H) / 1100);
    deco.addChild(c);
  }
  sceneRoot.addChild(deco);

  const title = mkText("四角にハマる", Math.min(W * 0.11, 64));
  title.anchor.set(0.5); title.position.set(W / 2, H * 0.24);
  const sub = mkText(lang === "ja" ? "つないで、返して、ぴたりと埋めよう" : (lang === "zh" ? "旋转、翻面，把长方形填满" : "Rotate, flip, fill the rectangle"), Math.max(14, Math.min(W * 0.035, 20)), shade(PAL.ink, 1.6));
  sub.anchor.set(0.5); sub.position.set(W / 2, H * 0.24 + title.height * 0.75);
  sceneRoot.addChild(title, sub);

  const n = 4;
  const bw = Math.min(300, W * 0.72);
  const avail = H - 16 - H * 0.40;
  const gap = Math.max(10, Math.min(20, avail / n * 0.25));
  const bh = Math.max(44, Math.min(58, avail / n - gap));
  const items                         = [
    [T.play, () => openSelect()],
    [T.timeAttack, () => openTaIntro()],
    [T.players, () => buildPlayers()],
    [T.settings, () => openSettings()],
  ];
  items.forEach(([label, fn], i) => {
    const b = mkButton(label, bw, bh, fn);
    b.position.set((W - bw) / 2, H * 0.40 + i * (bh + gap));
    sceneRoot.addChild(b);
  });
  sceneRoot.addChild(mkPlayerChip(W));
}

/** top-right chip naming the active player; tapping it opens the player list */
function mkPlayerChip(W        )                 {
  const p = curProfile();
  const label = p ? p.name : T.newPlayer;
  const t = mkText(label, 15, PAL.ink);
  const w = Math.max(120, t.width + 28), h = 40;
  const c = mkButton(label, w, h, () => buildPlayers(), { small: true, fill: 0xdcf1ec });
  t.destroy();
  c.position.set(W - w - 12, 12);
  return c;
}

// ---------- player profiles ----------
function buildPlayers()       {
  scene = "players";
  clearScene();
  const W = app.screen.width, H = app.screen.height;
  const narrow = W < 640;
  const head = mkText(T.players, 26);
  head.anchor.set(0.5); head.position.set(W / 2, 40);
  if (narrow) head.position.set(W / 2 + 40, 36);
  if (head.width > W - 260 && !narrow) head.scale.set((W - 260) / head.width);
  sceneRoot.addChild(head);
  const back = mkButton("◀ " + T.back, 110, 42, () => buildTitle(), { small: true });
  back.position.set(12, 16);
  sceneRoot.addChild(back);
  const rankB = mkButton(T.localRanking, Math.min(200, W - 24), 44, () => buildRanking(), { small: true, fill: 0xdcf1ec });
  if (narrow) rankB.position.set((W - rankB.width) / 2, 68); else rankB.position.set(W - 212, 16);
  sceneRoot.addChild(rankB);

  const landscape = W > H && W >= 700;
  const cols = Math.min(landscape ? 2 : 1, save.profiles.length + 1);
  const areaX = 16, areaY = narrow ? 126 : 76, areaW = W - 32, areaH = H - areaY - 16;
  const list = save.profiles;
  const total = list.length + 1; // + "new player" card
  const rows = Math.ceil(total / cols);
  const gapY = 10;
  const ch = Math.max(56, Math.min(84, (areaH - gapY * (rows - 1)) / rows));
  const cw = Math.min(480, (areaW - 10 * (cols - 1)) / cols);
  const gridW = cols * (cw + 10) - 10, gridH = rows * (ch + gapY) - gapY;
  const ox = areaX + (areaW - gridW) / 2, oy = areaY + Math.max(0, (areaH - gridH) / 2);

  list.forEach((p, i) => {
    const col = i % cols, row = (i / cols) | 0;
    const isCur = p.id === save.curProfile;
    const card = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.roundRect(2, 4, cw, ch, 12).fill({ color: 0x000000, alpha: 0.08 });
    g.roundRect(0, 0, cw, ch, 12).fill({ color: isCur ? 0xdcf1ec : 0xfffdf6 }).stroke({ width: isCur ? 3 : 2, color: isCur ? PAL.ok : PAL.ink, alpha: 0.85 });
    card.addChild(g);
    const sw = new PIXI.Graphics();
    sw.roundRect(12, ch / 2 - 14, 28, 28, 6).fill({ color: PIECE_COLORS[i % 5] });
    card.addChild(sw);
    const name = mkText(p.name, 19, PAL.ink, "700", "left");
    name.anchor.set(0, 0.5); name.position.set(52, ch * 0.34);
    if (name.width > cw - 200) name.scale.set((cw - 200) / name.width);
    card.addChild(name);
    const cleared = p.stamps.filter((s) => s > 0).length;
    const sub = mkText(`⭐${cleared}/15  ·  ${T.taBest} ${p.ta1Best !== null ? fmtTime(p.ta1Best) : "—"}  ·  ${p.ta1Runs.length} ${T.runs}${isCur ? "  ·  " + T.selected : ""}`, 14, shade(PAL.ink, 1.4), "400", "left");
    sub.anchor.set(0, 0.5); sub.position.set(52, ch * 0.70);
    if (sub.width > cw - 200) sub.scale.set((cw - 200) / sub.width);
    card.addChild(sub);
    // whole card selects this player
    card.eventMode = "static"; card.cursor = "pointer";
    card.on("pointertap", () => { void ensureAudio(); cue("sfx.button"); save.curProfile = p.id; saveNow(); buildPlayers(); });
    // rename / delete
    const bsz = 48;
    const ren = mkButton("✎", bsz, bsz, () => {
      promptName(p.name, (nm) => { if (nm) { p.name = nm; saveNow(); } buildPlayers(); });
    }, { small: true });
    ren.position.set(cw - bsz * 2 - 20, (ch - bsz) / 2);
    const del = mkButton("✕", bsz, bsz, () => openDeleteProfile(p), { small: true, fill: 0xfbe3e1 });
    del.position.set(cw - bsz - 10, (ch - bsz) / 2);
    card.addChild(ren, del);
    card.position.set(ox + col * (cw + 10), oy + row * (ch + gapY));
    sceneRoot.addChild(card);
  });

  const ni = list.length, ncol = ni % cols, nrow = (ni / cols) | 0;
  const canAdd = save.profiles.length < MAX_PROFILES;
  const add = mkButton(canAdd ? T.newPlayer : T.maxPlayers, cw, Math.min(ch, 56), () => {
    if (!canAdd) return;
    promptName("", (nm) => { if (nm) addProfile(nm); buildPlayers(); });
  });
  setBtnEnabled(add, canAdd);
  add.position.set(ox + ncol * (cw + 10), oy + nrow * (ch + gapY) + (ch - Math.min(ch, 56)) / 2);
  sceneRoot.addChild(add);
}

function openDeleteProfile(p         )       {
  const panel = mkPanel(300, 190);
  const t = mkText(T.deleteConfirm(p.name), 17);
  t.anchor.set(0.5); t.position.set(150, 62);
  if (t.width > 270) t.scale.set(270 / t.width);
  panel.addChild(t);
  const yes = mkButton(T.yes, 118, 46, () => {
    closeOverlay();
    save.profiles = save.profiles.filter((q) => q.id !== p.id);
    if (save.curProfile === p.id) save.curProfile = save.profiles[0]?.id ?? null;
    saveNow();
    buildPlayers();
  }, { fill: 0xfbe3e1 });
  yes.position.set(22, 122);
  const no = mkButton(T.no, 118, 46, () => closeOverlay());
  no.position.set(160, 122);
  panel.addChild(yes, no);
  openOverlay(panel);
}

/** DOM text prompt (native keyboard on phones). cb(null) on cancel. */
let promptEl                        = null;
function promptName(initial        , cb                               )       {
  if (promptEl) { promptEl.remove(); promptEl = null; }
  const root = document.createElement("div");
  root.setAttribute("data-mp-prompt", "");
  root.style.cssText = "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(40,50,60,0.35);font-family:" + FONT + ";";
  const box = document.createElement("div");
  box.style.cssText = "background:#fffdf6;border:3px solid rgba(40,50,60,0.8);border-radius:18px;padding:22px 20px 18px;width:min(320px,calc(100vw - 32px));box-shadow:6px 9px 0 rgba(0,0,0,0.13);box-sizing:border-box;";
  const lab = document.createElement("div");
  lab.textContent = T.namePrompt;
  lab.style.cssText = "font-size:18px;font-weight:700;color:#28323c;text-align:center;margin-bottom:12px;";
  const inp = document.createElement("input");
  inp.type = "text"; inp.maxLength = MAX_NAME; inp.value = initial; inp.placeholder = T.namePlaceholder;
  inp.autocomplete = "off"; inp.setAttribute("enterkeyhint", "done");
  inp.style.cssText = "display:block;width:100%;box-sizing:border-box;height:48px;font-size:18px;font-family:inherit;color:#28323c;background:#ffffff;border:2.5px solid rgba(40,50,60,0.85);border-radius:12px;padding:0 14px;outline:none;user-select:text;-webkit-user-select:text;";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;margin-top:14px;";
  const mk = (txt        , fill        )                    => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = txt;
    b.style.cssText = `flex:1;height:48px;font-size:17px;font-weight:700;font-family:inherit;color:#28323c;background:${fill};border:2.5px solid rgba(40,50,60,0.85);border-radius:12px;box-shadow:3px 5px 0 rgba(0,0,0,0.10);cursor:pointer;`;
    return b;
  };
  const cancel = mk(T.cancel, "#ffffff"), ok = mk(T.ok, "#dcf1ec");
  row.append(cancel, ok);
  box.append(lab, inp, row);
  root.append(box);
  document.body.append(root);
  promptEl = root;
  const finish = (v               )       => {
    if (promptEl !== root) return;
    root.remove(); promptEl = null;
    cue("sfx.button");
    cb(v);
  };
  ok.addEventListener("click", () => { void sound.unlock(); const v = inp.value.trim(); finish(v.length ? v.slice(0, MAX_NAME) : null); });
  cancel.addEventListener("click", () => { void sound.unlock(); finish(null); });
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { const v = inp.value.trim(); finish(v.length ? v.slice(0, MAX_NAME) : null); }
    else if (e.key === "Escape") finish(null);
  });
  setTimeout(() => inp.focus(), 30);
}

// ---------- ranking ----------
let rankTab                     = "local";
function buildRanking()       {
  scene = "ranking";
  clearScene();
  const W = app.screen.width, H = app.screen.height;
  const head = mkText(T.taRanking, 24);
  head.anchor.set(0.5); head.position.set(W / 2, 86);
  sceneRoot.addChild(head);
  const back = mkButton("◀ " + T.back, 110, 48, () => buildTitle(), { small: true });
  back.position.set(16, 16);
  sceneRoot.addChild(back);

  const tabW = Math.min(180, (W - 44) / 2);
  const tl = mkButton(T.localRanking, tabW, 48, () => { rankTab = "local"; buildRanking(); }, { small: true, fill: rankTab === "local" ? 0xdcf1ec : PAL.white });
  const to = mkButton(T.onlineRanking, tabW, 48, () => { rankTab = "online"; buildRanking(); }, { small: true, fill: rankTab === "online" ? 0xdcf1ec : PAL.white });
  tl.position.set(W / 2 - tabW - 6, 116); to.position.set(W / 2 + 6, 116);
  sceneRoot.addChild(tl, to);

  const short = H < 560 && W > 600;
  const listW = Math.min(short ? 370 : 520, short ? (W - 60) / 2 : W - 32);
  const lx = (W - (short ? listW * 2 + 16 : listW)) / 2, ly = 198;
  const rowH = Math.min(44, (H - ly - 20) / (short ? 5 : 10));
  const scope = mkText(rankTab === "local" ? T.taScope : T.taOnlineNote, 14);
  scope.anchor.set(0.5); scope.position.set(W / 2, 181); sceneRoot.addChild(scope);
  const bg = new PIXI.Graphics();
  bg.roundRect(lx, ly - 4, short ? listW * 2 + 16 : listW, rowH * (short ? 5 : 10) + 8, 14).fill({ color: 0xfffdf6, alpha: 0.92 }).stroke({ width: 2, color: PAL.line });
  sceneRoot.addChild(bg);

  const addRow = (i        , name        , time        , hi         , extra         )       => {
    const x = lx + (short && i >= 5 ? listW + 16 : 0);
    const y = ly + (short ? i % 5 : i) * rowH + rowH / 2;
    if (hi) { const g = new PIXI.Graphics().roundRect(x + 4, y - rowH / 2 + 2, listW - 8, rowH - 4, 6).fill(0xdcf1ec); sceneRoot.addChild(g); }
    const num = mkText(String(i + 1), 14, PAL.ink);
    num.anchor.set(0.5); num.position.set(x + 24, y);
    const nm = mkText(name, 16, PAL.ink, hi ? "700" : "400", "left");
    nm.anchor.set(0, 0.5); nm.position.set(x + 46, y);
    const tm = mkText(time, 16, PAL.ink);
    tm.anchor.set(1, 0.5); tm.position.set(x + listW - 16, y);
    const maxNm = listW - 46 - 16 - tm.width - 12;
    while (nm.width > maxNm && nm.text.length > 2) nm.text = nm.text.slice(0, -2) + "…";
    sceneRoot.addChild(num, nm, tm);
  };

  if (rankTab === "local") {
    const ranked = localRanking().filter((p) => p.ta1Best !== null).slice(0, 10);
    if (!ranked.length) {
      const t = mkText(T.noRuns, 15, 0x9a958a);
      t.anchor.set(0.5); t.position.set(W / 2, ly + rowH * 1.5);
      sceneRoot.addChild(t);
    } else ranked.forEach((p, i) => addRow(i, p.name, fmtTime(p.ta1Best ?? 0), p.id === save.curProfile, `${p.ta1Runs.length} ${T.runs}`));
  } else {
    const wait = mkText("…", 18, 0x9a958a);
    wait.anchor.set(0.5); wait.position.set(W / 2, ly + rowH * 1.5);
    sceneRoot.addChild(wait);
    void gp.player.topScores(10).then((rows) => {
      if (scene !== "ranking" || rankTab !== "online" || !wait.parent) return;
      wait.destroy();
      const onePuzzleRows = rows.filter(r => r.score > 3600000 && r.score < TA_SCORE_BASE);
      if (!onePuzzleRows.length) {
        const t = mkText(T.noScores, 15, PAL.ink);
        t.anchor.set(0.5); t.position.set(W / 2, ly + rowH * 1.5);
        sceneRoot.addChild(t);
        return;
      }
      onePuzzleRows.forEach((r, i) => addRow(i, r.name, fmtTime(TA_SCORE_BASE - r.score), r.isMe));
    });
  }
}

/** entry from the title: progress is per player, so make sure one exists first */
function openSelect()       {
  if (!curProfile()) { promptName("", (nm) => { if (nm) { addProfile(nm); buildSelect(); } }); return; }
  buildSelect();
}

function buildSelect()       {
  scene = "select";
  clearScene();
  const W = app.screen.width, H = app.screen.height;
  const narrow = W < 640;
  const head = mkText(T.list, 26);
  head.anchor.set(0.5); head.position.set(narrow ? W / 2 - 10 : W / 2, 40);
  sceneRoot.addChild(head);
  const back = mkButton("◀ " + T.back, 110, 42, () => buildTitle(), { small: true });
  back.position.set(12, 16);
  sceneRoot.addChild(back);
  // whose progress this list shows (tap to switch player)
  const prof = curProfile();
  const got = curStamps().reduce((a, b) => a + b, 0);
  const chipLabel = `${prof ? prof.name : T.playerLabel}  ⭐${got}/45`;
  const chipT = mkText(chipLabel, 15); const chipW = Math.min(W - 24, Math.max(150, chipT.width + 28)); chipT.destroy();
  const chip = mkButton(chipLabel, chipW, 40, () => buildPlayers(), { small: true, fill: 0xdcf1ec });
  if (narrow) chip.position.set((W - chipW) / 2, 66); else chip.position.set(W - chipW - 12, 16);
  sceneRoot.addChild(chip);

  const landscape = W > H;
  const cols = landscape ? 5 : 3, rows = landscape ? 3 : 5;
  const areaX = 16, areaY = narrow ? 120 : 76, areaW = W - 32, areaH = H - areaY - 16;
  const cw = Math.min(areaW / cols - 10, 150), ch = Math.min(areaH / rows - 10, 120);
  const gridW = cols * (cw + 10) - 10, gridH = rows * (ch + 10) - 10;
  const ox = areaX + (areaW - gridW) / 2, oy = areaY + (areaH - gridH) / 2;

  for (let i = 0; i < MAIN_PUZZLES.length; i++) {
    const col = i % cols, row = (i / cols) | 0;
    const p = MAIN_PUZZLES[i];
    const unlocked = i === 0 || curStamps()[i - 1] > 0;
    const card = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.roundRect(2, 4, cw, ch, 10).fill({ color: 0x000000, alpha: 0.08 });
    g.roundRect(0, 0, cw, ch, 10).fill({ color: unlocked ? 0xfffdf6 : 0xe7e2d4 }).stroke({ width: 2, color: PAL.ink, alpha: unlocked ? 0.8 : 0.35 });
    card.addChild(g);
    const num = mkText(String(i + 1), ch * 0.34, unlocked ? PIECE_COLORS[i % 5] : 0x9a958a);
    num.anchor.set(0.5); num.position.set(cw / 2, ch * 0.32);
    card.addChild(num);
    const size = mkText(unlocked ? `${p.w}×${p.h}` : T.locked, ch * 0.16, unlocked ? PAL.ink : 0x9a958a);
    size.anchor.set(0.5); size.position.set(cw / 2, ch * 0.6);
    card.addChild(size);
    // stamp dots
    const earned = curStamps()[i];
    for (let s = 0; s < 3; s++) {
      if (unlocked && earned > s) {
        const miniStamp = new PIXI.Sprite(texStamp);
        miniStamp.anchor.set(0.5);
        miniStamp.scale.set((ch * 0.19) / texStamp.width);
        miniStamp.position.set(cw / 2 + (s - 1) * ch * 0.22, ch * 0.82);
        card.addChild(miniStamp);
      } else {
        const d = new PIXI.Graphics();
        d.circle(cw / 2 + (s - 1) * ch * 0.22, ch * 0.82, ch * 0.055).stroke({ width: 1.5, color: PAL.ink, alpha: 0.3 });
        card.addChild(d);
      }
    }
    card.position.set(ox + col * (cw + 10), oy + row * (ch + 10));
    if (unlocked) {
      card.eventMode = "static"; card.cursor = "pointer";
      card.on("pointertap", () => { void ensureAudio(); cue("sfx.button"); startMain(i); });
    } else card.alpha = 0.75;
    sceneRoot.addChild(card);
  }
}

function buildEnding()       {
  scene = "ending";
  clearScene();
  const W = app.screen.width, H = app.screen.height;
  addDeskProps(sceneRoot);
  const head = mkText(T.endingTitle, Math.min(W * 0.09, 44));
  head.anchor.set(0.5); head.position.set(W / 2, H * 0.10);
  const msg = mkText(T.endingMsg, 18, shade(PAL.ink, 1.5));
  msg.anchor.set(0.5); msg.position.set(W / 2, H * 0.10 + head.height * 0.9);
  sceneRoot.addChild(head, msg);

  const landscape = W > H;
  const cols = landscape ? 5 : 3, rows = landscape ? 3 : 5;
  const areaY = H * 0.2, areaH = H * 0.62, areaW = W - 40;
  const slotW = areaW / cols, slotH = areaH / rows;
  for (let i = 0; i < MAIN_PUZZLES.length; i++) {
    const p = MAIN_PUZZLES[i];
    const mini = new PIXI.Graphics();
    const cs = Math.min((slotW - 16) / p.w, (slotH - 16) / p.h);
    for (const pc of p.pieces) {
      for (const [cx, cy] of pc.cells) {
        mini.rect((pc.anchor[0] + cx) * cs, (pc.anchor[1] + cy) * cs, cs, cs).fill({ color: PIECE_COLORS[pc.color] });
      }
    }
    mini.rect(0, 0, p.w * cs, p.h * cs).stroke({ width: 1.5, color: PAL.ink, alpha: 0.7 });
    const col = i % cols, row = (i / cols) | 0;
    mini.position.set(20 + col * slotW + (slotW - p.w * cs) / 2, areaY + row * slotH + (slotH - p.h * cs) / 2);
    sceneRoot.addChild(mini);
  }
  const bw = 150;
  const menuB = mkButton(T.menu, bw, 48, () => buildTitle());
  menuB.position.set(W / 2 - bw - 10, H * 0.87);
  sceneRoot.addChild(menuB);
  if (gpShare && gpShare.available !== false && typeof gpShare.image === "function") {
    let blob              = null; let sharing = false;
    void captureShare().then((b) => { blob = b; });
    const shareB = mkButton(T.share, bw, 48, () => {
      if (!blob || sharing) return;
      sharing = true;
      void gpShare.image (blob, { text: T.shareEnd }).then(() => { sharing = false; });
    });
    shareB.position.set(W / 2 + 10, H * 0.87);
    sceneRoot.addChild(shareB);
  } else {
    menuB.position.set((W - bw) / 2, H * 0.87);
  }
  if (fx && confettiId) {
    fx.play(confettiId, { pos: { x: W / 2, y: H * 0.35 }, power: 1 });
    after(0.5, () => { if (fx && confettiId) fx.play(confettiId, { pos: { x: W * 0.3, y: H * 0.3 }, power: 0.7 }); });
  }
  cue("sfx.clear");
}

// ==========================================================================
// piece drawing
// ==========================================================================
function drawCellsInto(cont                , cells        , colorIdx        , shadow         )       {
  cont.removeChildren().forEach((c) => c.destroy({ children: true }));
  const color = PIECE_COLORS[colorIdx];
  if (shadow) {
    const g = new PIXI.Graphics();
    for (const [x, y] of cells) g.rect(x * UNIT, y * UNIT, UNIT, UNIT).fill({ color: 0x000000 });
    cont.addChild(g);
    return;
  }
  const set = new Set(cells.map((c) => `${c[0]},${c[1]}`));
  for (const [x, y] of cells) {
    const cellSp = new PIXI.Sprite(texFiber);
    cellSp.position.set(x * UNIT - 0.5, y * UNIT - 0.5);
    cellSp.width = UNIT + 1; cellSp.height = UNIT + 1;
    cellSp.tint = color;
    cont.addChild(cellSp);
  }
  const line = new PIXI.Graphics();
  for (const [x, y] of cells) {
    if (!set.has(`${x},${y - 1}`)) { line.moveTo(x * UNIT, y * UNIT); line.lineTo((x + 1) * UNIT, y * UNIT); }
    if (!set.has(`${x},${y + 1}`)) { line.moveTo(x * UNIT, (y + 1) * UNIT); line.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x - 1},${y}`)) { line.moveTo(x * UNIT, y * UNIT); line.lineTo(x * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x + 1},${y}`)) { line.moveTo((x + 1) * UNIT, y * UNIT); line.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
  }
  line.stroke({ width: 4, color: shade(color, 0.68), alpha: 1, cap: "round", join: "round" });
  cont.addChild(line);
  // accessibility corner mark (shape varies per color index)
  const m = new PIXI.Graphics();
  const [mx, my] = cells[0];
  const cx = mx * UNIT + 15, cy2 = my * UNIT + 15, r = 6.5;
  if (colorIdx === 0) m.circle(cx, cy2, r).fill({ color: 0xffffff, alpha: 0.85 });
  else if (colorIdx === 1) m.poly([cx, cy2 - r, cx + r, cy2 + r, cx - r, cy2 + r]).fill({ color: 0xffffff, alpha: 0.85 });
  else if (colorIdx === 2) m.rect(cx - r + 1, cy2 - r + 1, r * 2 - 2, r * 2 - 2).fill({ color: 0xffffff, alpha: 0.85 });
  else if (colorIdx === 3) m.poly([cx, cy2 - r, cx + r, cy2, cx, cy2 + r, cx - r, cy2]).fill({ color: 0xffffff, alpha: 0.85 });
  else m.rect(cx - r, cy2 - 2.5, r * 2, 5).fill({ color: 0xffffff, alpha: 0.85 });
  cont.addChild(m);
}

function rebuildPiece(p            )       {
  const cells = applyT(p.cells, p.t);
  drawCellsInto(p.shape, cells, p.color, false);
  drawCellsInto(p.shadowC, cells, p.color, true);
  const b = boundsOf(cells);
  const cx = b.w * UNIT / 2, cy = b.h * UNIT / 2;
  p.shape.pivot.set(cx, cy); p.shape.position.set(cx, cy);
  p.shape.rotation = 0; p.shape.scale.set(1);
  p.shadowC.pivot.set(cx, cy); p.shadowC.position.set(cx + 5, cy + 8);
  // selection glow
  if (p.selG) { p.selG.destroy(); p.selG = null; }
  const sel = new PIXI.Graphics();
  const set = new Set(cells.map((c) => `${c[0]},${c[1]}`));
  for (const [x, y] of cells) {
    if (!set.has(`${x},${y - 1}`)) { sel.moveTo(x * UNIT, y * UNIT); sel.lineTo((x + 1) * UNIT, y * UNIT); }
    if (!set.has(`${x},${y + 1}`)) { sel.moveTo(x * UNIT, (y + 1) * UNIT); sel.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x - 1},${y}`)) { sel.moveTo(x * UNIT, y * UNIT); sel.lineTo(x * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x + 1},${y}`)) { sel.moveTo((x + 1) * UNIT, y * UNIT); sel.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
  }
  sel.stroke({ width: 9, color: 0xffffff, alpha: 0.55, cap: "round", join: "round" });
  sel.visible = selected === p;
  p.shape.addChildAt(sel, 0);
  p.selG = sel;
}

// ==========================================================================
// play scene
// ==========================================================================
function startMain(i        )       {
  mode = "main"; qIndex = i; taRun = null;
  loadPuzzle(MAIN_PUZZLES[i]);
}
function startTa()       {
  const prof = curProfile();
  if (!prof) { openTaIntro(); return; }
  const pool = POOL_PUZZLES.filter(p => p !== lastTaPuzzle);
  const next = pool[Math.floor(Math.random() * pool.length)];
  lastTaPuzzle = next;
  mode = "ta";
  taRun = { course: [next], step: 0, timeMs: 0, running: false, startedAt: 0,
    playerId: prof.id, recorded: false, isBest: false, submitted: false };
  loadPuzzle(next);
  taRun.startedAt = performance.now();
  taRun.running = true;
}

function loadPuzzle(def           )       {
  scene = "play";
  clearScene();
  puzzle = def;
  moves = 0; hintsUsed = 0; hintsLeft = 2; history = []; placedOrder = []; solved = false;
  selected = null; drag = null;

  addDeskProps(sceneRoot);

  boardWrap = new PIXI.Container();
  boardLayer = new PIXI.Container();
  gridG = new PIXI.Graphics();
  piecesLayer = new PIXI.Container();
  ghostG = new PIXI.Graphics();
  hintG = new PIXI.Graphics();
  fxBoard = new PIXI.Container();
  boardLayer.addChild(gridG, ghostG, hintG, piecesLayer, fxBoard);
  boardWrap.addChild(boardLayer);

  trayLayer = new PIXI.Container();
  trayBg = new PIXI.Graphics();
  trayLayer.addChild(trayBg);

  sceneRoot.addChild(trayLayer, boardWrap);

  pieces = def.pieces.map((pd, idx) => {
    const view = new PIXI.Container();
    const shadowC = new PIXI.Container(); shadowC.alpha = 0.13; shadowC.visible = false;
    const shape = new PIXI.Container();
    view.addChild(shadowC, shape);
    const p             = {
      idx, cells: pd.cells.map((c) => [c[0], c[1]]        ), anchor: [pd.anchor[0], pd.anchor[1]],
      color: pd.color, init: [pd.init[0], pd.init[1]], t: [pd.init[0], pd.init[1]],
      placed: false, cell: null, view, shape, shadowC, selG: null,
    };
    rebuildPiece(p);
    view.eventMode = "static"; view.cursor = "pointer";
    view.on("pointerdown", (e                            ) => onPieceDown(p, e));
    trayLayer.addChild(view);
    return p;
  });

  buildHud();
  relayoutPlay();
  updateHud();
  maybeShowBubble();
}

function buildHud()       {
  const bar = new PIXI.Container();
  const back = mkButton("◀", 46, 40, () => {
    if (mode === "ta") { taRun = null; buildTitle(); }
    else buildSelect();
  }, { small: true });
  const label = mkText("", 17);
  label.anchor.set(0, 0.5);
  const movesT = mkText("", 16);
  movesT.anchor.set(0, 0.5);
  bar.addChild(back, label, movesT);

  let hintB                        = null, resetB                        = null, timerT                   = null;
  if (mode === "main") {
    hintB = mkButton("", 108, 40, () => doHint(), { small: true });
    resetB = mkButton(T.reset, 96, 40, () => confirmReset(), { small: true });
    bar.addChild(hintB, resetB);
  } else {
    timerT = mkText("0:00.0", 24, PAL.ink);
    timerT.anchor.set(1, 0.5);
    bar.addChild(timerT);
  }
  sceneRoot.addChild(bar);
  ctrlKey = ctrlSpecKey();
  const c = mkCtrlButtons(ctrlSpecFor(app.screen.width));
  hudRefs = { bar, back, label, movesT, hintB, resetB, timerT, rotB: c.rot, flipB: c.flip, undoB: c.undo, bubble: null };
}

// ---------- transform control buttons (thumb-sized, rebuilt on resize) ----------
;                                                                                               
let ctrlKey = "";
function ctrlSpecFor(W        )           {
  const avail = Math.max(280, W - 20);
  const undoW = Math.max(84, Math.min(104, Math.round(avail * 0.22)));
  const gapBig = Math.max(32, Math.min(56, Math.round(avail * 0.05)));
  const gapSmall = 10;
  const actW = Math.max(100, Math.min(160, Math.round((avail - undoW - gapBig - gapSmall) / 2)));
  return { actW, undoW, bh: 60, gapBig, gapSmall };
}
function ctrlSpecKey()         {
  const s = ctrlSpecFor(app.screen.width);
  return `${s.actW}x${s.undoW}|${lang}`;
}
function mkCtrlButtons(s          )                                                                      {
  const rot = mkButton(`⟳ ${T.rotate}`, s.actW, s.bh, () => doTransform("rot"));
  const flip = mkButton(`⇋ ${T.flip}`, s.actW, s.bh, () => doTransform("flip"));
  const undo = mkButton(`↩ ${T.undo}`, s.undoW, s.bh, () => doUndo());
  for (const b of [rot, flip, undo]) { addPressFx(b); sceneRoot.addChild(b); }
  return { rot, flip, undo };
}
function ensureCtrlButtons()       {
  const key = ctrlSpecKey();
  if (!hudRefs || key === ctrlKey) return;
  for (const b of [hudRefs.rotB, hudRefs.flipB, hudRefs.undoB]) { b.parent?.removeChild(b); b.destroy({ children: true }); }
  const c = mkCtrlButtons(ctrlSpecFor(app.screen.width));
  hudRefs.rotB = c.rot; hudRefs.flipB = c.flip; hudRefs.undoB = c.undo;
  ctrlKey = key;
  updateHud();
}

function relayoutPlay()       {
  if (!puzzle || !hudRefs) return;
  const W = app.screen.width, H = app.screen.height;
  const topH = 60;
  const ctrlH = 66;
  const trayH = Math.max(110, Math.min(H * 0.26, 220));

  // HUD bar
  const hr = hudRefs;
  hr.back.position.set(10, 10);
  hr.label.position.set(66, 30);
  if (mode === "main") {
    hr.movesT.position.set(66 + Math.max(90, hr.label.width + 14), 30);
    const rx = W - 10;
    if (hr.resetB) hr.resetB.position.set(rx - 96, 10);
    if (hr.hintB) hr.hintB.position.set(rx - 96 - 118, 10);
  } else {
    hr.movesT.position.set(66 + Math.max(90, hr.label.width + 14), 30);
    if (hr.timerT) hr.timerT.position.set(W - 14, 30);
  }

  // tray
  trayRect = { x: 10, y: H - trayH - 10, w: W - 20, h: trayH };
  trayBg.clear();
  trayBg.roundRect(trayRect.x, trayRect.y, trayRect.w, trayRect.h, 14)
    .fill({ color: PAL.tray, alpha: 0.9 }).stroke({ width: 2, color: PAL.line, alpha: 0.9 });

  // control buttons above tray: undo | rotate | (wide gap) | flip — flip sits at the
  // outer edge in thumb reach, the wide rot↔flip gap prevents mis-taps on phones
  ensureCtrlButtons();
  const s = ctrlSpecFor(W);
  const totalW = s.undoW + s.gapSmall + s.actW + s.gapBig + s.actW;
  let cx = Math.max(10, (W - totalW) / 2);
  const cy = trayRect.y - ctrlH + 4;
  hr.undoB.position.set(cx, cy); cx += s.undoW + s.gapSmall;
  hr.rotB.position.set(cx, cy); cx += s.actW + s.gapBig;
  hr.flipB.position.set(cx, cy);

  // board
  const availY0 = topH + 6, availY1 = cy - 10;
  const availH = Math.max(80, availY1 - availY0);
  const cell = Math.max(24, Math.min((W - 36) / puzzle.w, availH / puzzle.h, Math.min(W, H) * 0.65 / Math.min(puzzle.w, puzzle.h), 92));
  boardScale = cell / UNIT;
  boardLayer.scale.set(boardScale);
  const bwpx = cell * puzzle.w, bhpx = cell * puzzle.h;
  boardWrap.position.set(Math.round((W - bwpx) / 2), Math.round(availY0 + (availH - bhpx) / 2));

  // grid
  gridG.clear();
  gridG.rect(-6, -6, puzzle.w * UNIT + 12, puzzle.h * UNIT + 12).fill({ color: PAL.boardFill, alpha: 0.94 });
  for (let x = 0; x <= puzzle.w; x++) { gridG.moveTo(x * UNIT, 0); gridG.lineTo(x * UNIT, puzzle.h * UNIT); }
  for (let y = 0; y <= puzzle.h; y++) { gridG.moveTo(0, y * UNIT); gridG.lineTo(puzzle.w * UNIT, y * UNIT); }
  gridG.stroke({ width: 2, color: PAL.line, alpha: 0.95 });
  gridG.rect(0, 0, puzzle.w * UNIT, puzzle.h * UNIT).stroke({ width: 5, color: PAL.ink, alpha: 0.85 });

  // tray scale: fit the largest piece in a slot
  const n = pieces.length;
  const rows = n <= 5 ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const slotW = trayRect.w / cols, slotH = (trayRect.h - 8) / rows;
  let span = 1;
  for (const p of pieces) { const b = boundsOf(applyT(p.cells, p.t)); span = Math.max(span, b.w, b.h); }
  trayScale = Math.min((slotW - 12) / (span * UNIT), (slotH - 12) / (span * UNIT), boardScale * 0.85);

  for (const p of pieces) {
    if (drag && drag.p === p) continue;
    restPiece(p, false);
  }
  positionBubble();
}

function traySlotCenter(idx        )                           {
  const n = pieces.length;
  const rows = n <= 5 ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const slotW = trayRect.w / cols, slotH = (trayRect.h - 8) / rows;
  const r = (idx / cols) | 0, c = idx % cols;
  return { x: trayRect.x + c * slotW + slotW / 2, y: trayRect.y + 4 + r * slotH + slotH / 2 };
}

function restPiece(p            , animate         )       {
  const b = boundsOf(applyT(p.cells, p.t));
  if (p.placed && p.cell) {
    if (p.view.parent !== piecesLayer) reparentKeepPos(p.view, piecesLayer);
    const tx = p.cell.x * UNIT, ty = p.cell.y * UNIT;
    if (animate) {
      const sx = p.view.x, sy = p.view.y, ss = p.view.scale.x;
      tw(0.1, (k) => { const e = eoQ(k); p.view.position.set(sx + (tx - sx) * e, sy + (ty - sy) * e); p.view.scale.set(ss + (1 - ss) * e); });
    } else { p.view.position.set(tx, ty); p.view.scale.set(1); }
  } else {
    if (p.view.parent !== trayLayer) reparentKeepPos(p.view, trayLayer);
    const c = traySlotCenter(p.idx);
    const tx = c.x - b.w * UNIT * trayScale / 2, ty = c.y - b.h * UNIT * trayScale / 2;
    if (animate) {
      const sx = p.view.x, sy = p.view.y, ss = p.view.scale.x;
      tw(0.22, (k) => { const e = eoBack(k); p.view.position.set(sx + (tx - sx) * e, sy + (ty - sy) * e); const s = ss + (trayScale - ss) * eoQ(k); p.view.scale.set(s); });
    } else { p.view.position.set(tx, ty); p.view.scale.set(trayScale); }
  }
  p.shadowC.visible = drag?.p === p;
}

function reparentKeepPos(v                , parent                )       {
  const g = v.getGlobalPosition(new PIXI.Point());
  parent.addChild(v);
  const l = parent.toLocal(g);
  v.position.set(l.x, l.y);
}

function updateHud()       {
  if (!hudRefs || !puzzle) return;
  if (mode === "main") {
    hudRefs.label.text = `${T.q}${qIndex + 1}・${puzzle.w}×${puzzle.h}`;
    hudRefs.movesT.text = `${T.moves} ${moves}/${puzzle.par}`;
    if (hudRefs.hintB) {
      const lt = (hudRefs.hintB                                      ).__label             ;
      lt.text = `${T.hint} ×${hintsLeft}`;
      setBtnEnabled(hudRefs.hintB, hintsLeft > 0 && !solved && pieces.some((p) => !p.placed));
    }
    if (hudRefs.resetB) setBtnEnabled(hudRefs.resetB, !solved);
  } else if (taRun) {
    hudRefs.label.text = `${T.taSingle}・${puzzle.w}×${puzzle.h}`;
    hudRefs.movesT.text = "";
    if (hudRefs.timerT) hudRefs.timerT.text = fmtTime(taRun.timeMs);
  }
  const canT = !!selected && !solved;
  setBtnEnabled(hudRefs.rotB, canT);
  setBtnEnabled(hudRefs.flipB, canT);
  setBtnEnabled(hudRefs.undoB, history.length > 0 && !solved);
  setBtnFill(hudRefs.flipB, canT ? 0xdcf1ec : PAL.white);
}

// ---------- tutorial bubbles ----------
function maybeShowBubble()       {
  if (!hudRefs || mode !== "main") return;
  let txt                = null;
  if (qIndex === 0 && !curTut().drag) txt = T.tutDrag;
  else if (qIndex === 1 && !curTut().rot) txt = T.tutRotate;
  else if (qIndex === 2 && !curTut().flip) txt = T.tutFlip;
  if (!txt) return;
  const bub = new PIXI.Container();
  const t = mkText(txt, 15);
  const w = t.width + 28, h = t.height + 20;
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, 10).fill({ color: 0xfffdf6, alpha: 0.97 }).stroke({ width: 2, color: PAL.ok, alpha: 0.9 });
  t.anchor.set(0.5); t.position.set(w / 2, h / 2);
  bub.addChild(g, t);
  sceneRoot.addChild(bub);
  hudRefs.bubble = bub;
  positionBubble();
  tw(1.2, (k) => { bub.alpha = 0.75 + 0.25 * Math.sin(k * Math.PI * 2); });
}
function positionBubble()       {
  if (!hudRefs?.bubble || !puzzle) return;
  const b = hudRefs.bubble;
  b.position.set(Math.round((app.screen.width - b.width) / 2), Math.round(boardWrap.y + puzzle.h * UNIT * boardScale + 8));
}
function dismissBubble(kind                         )       {
  if (!curTut()[kind]) { curTut()[kind] = true; saveNow(); }
  if (hudRefs?.bubble) { const b = hudRefs.bubble; hudRefs.bubble = null; tw(0.2, (k) => { b.alpha = 1 - k; }, () => { b.destroy({ children: true }); }); }
}

// ---------- occupancy / snapping ----------
function occupancy(exclude             )                      {
  const g                      = [];
  if (!puzzle) return g;
  for (let y = 0; y < puzzle.h; y++) g.push(new Array               (puzzle.w).fill(null));
  for (const p of pieces) {
    if (!p.placed || !p.cell || p === exclude) continue;
    for (const [cx, cy] of applyT(p.cells, p.t)) {
      const gx = p.cell.x + cx, gy = p.cell.y + cy;
      if (gy >= 0 && gy < puzzle.h && gx >= 0 && gx < puzzle.w) g[gy][gx] = p.idx;
    }
  }
  return g;
}
function legalAt(cells        , gx        , gy        , occ                     )          {
  if (!puzzle) return false;
  for (const [cx, cy] of cells) {
    const x = gx + cx, y = gy + cy;
    if (x < 0 || y < 0 || x >= puzzle.w || y >= puzzle.h) return false;
    if (occ[y][x] !== null) return false;
  }
  return true;
}
;                                                                                                
function trySnap(p            )          {
  if (!puzzle) return { kind: "outside", x: 0, y: 0, conflicts: [] };
  const cells = applyT(p.cells, p.t);
  const local = boardLayer.toLocal(new PIXI.Point(p.view.x, p.view.y), dragLayer);
  const fx0 = local.x / UNIT, fy0 = local.y / UNIT;
  const bx = Math.round(fx0), by = Math.round(fy0);
  // does the piece meaningfully overlap the board?
  const b = boundsOf(cells);
  if (bx + b.w <= 0 || by + b.h <= 0 || bx >= puzzle.w || by >= puzzle.h) return { kind: "outside", x: bx, y: by, conflicts: [] };
  const occ = occupancy(p);
  const cand                                                        = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    cand.push({ x: bx + dx, y: by + dy, d: Math.abs(fx0 - (bx + dx)) + Math.abs(fy0 - (by + dy)), exact: dx === 0 && dy === 0 });
  }
  cand.sort((a, c) => a.d - c.d);
  for (const c of cand) {
    // snap assist only when the pointer is genuinely near the candidate cell —
    // a drop landing squarely on occupied cells must bounce, not teleport
    if (!c.exact && c.d > 0.9) continue;
    if (legalAt(cells, c.x, c.y, occ)) return { kind: "ok", x: c.x, y: c.y, conflicts: [] };
  }
  // invalid: report conflicting cells at rounded position
  const conflicts         = [];
  for (const [cx2, cy2] of cells) {
    const x = bx + cx2, y = by + cy2;
    if (x >= 0 && y >= 0 && x < puzzle.w && y < puzzle.h && occ[y][x] !== null) conflicts.push([x, y]);
  }
  return { kind: "invalid", x: bx, y: by, conflicts };
}

// ---------- input ----------
function onPieceDown(p            , e                            )       {
  if (solved || overlayOpen || drag) return;
  void ensureAudio();
  selectPiece(p);
  const preSnap = snapshotState();
  const fromCell = p.placed && p.cell ? { ...p.cell } : null;
  if (p.placed) { p.placed = false; }
  reparentKeepPos(p.view, dragLayer);
  const targetScale = boardScale * 1.06;
  const local = p.view.toLocal(e.global);
  drag = {
    p, offX: local.x * targetScale, offY: local.y * targetScale,
    fromCell, preSnap, ops: 0, t0: [p.t[0], p.t[1]], movedPx: 0,
    startG: { x: e.global.x, y: e.global.y },
  };
  const ss = p.view.scale.x;
  tw(0.08, (k) => { const s = ss + (targetScale - ss) * k; p.view.scale.set(s); });
  p.shadowC.visible = true;
  p.view.position.set(e.global.x - drag.offX, e.global.y - drag.offY);
  cue("sfx.pickup");
  updateHud();
  updateGhost();
}

function onStageMove(e                            )       {
  if (!drag) return;
  drag.movedPx = Math.max(drag.movedPx, Math.abs(e.global.x - drag.startG.x) + Math.abs(e.global.y - drag.startG.y));
  drag.p.view.position.set(e.global.x - drag.offX, e.global.y - drag.offY);
  updateGhost();
}

function onStageUp()       {
  if (!drag) return;
  const d = drag;
  drag = null;
  ghostG.clear();
  const p = d.p;
  p.shadowC.visible = false;

  const res = trySnap(p);
  if (res.kind === "ok") {
    const same = d.fromCell && d.fromCell.x === res.x && d.fromCell.y === res.y && d.t0[0] === p.t[0] && d.t0[1] === p.t[1];
    if (same) {
      p.placed = true; p.cell = { x: res.x, y: res.y };
      restPiece(p, true);
    } else {
      doPlace(p, res.x, res.y, d.preSnap, 1 + d.ops);
    }
  } else if (res.kind === "invalid") {
    invalidFeedback(p, res);
    // return to previous spot (board cell or tray)
    if (d.fromCell) {
      p.placed = true; p.cell = d.fromCell;
      if (d.ops > 0) { p.t = d.t0; rebuildPiece(p); } // orientation must also revert to stay legal
      restPiece(p, true);
    } else {
      if (d.ops > 0) { history.push(d.preSnap); moves += d.ops; }
      restPiece(p, true);
    }
  } else {
    // dropped outside the board: piece goes (back) to the tray
    p.cell = null;
    const changed = d.fromCell !== null || d.ops > 0;
    if (changed) { history.push(d.preSnap); moves += d.ops; }
    if (d.movedPx > 8) cue("sfx.drop");
    restPiece(p, true);
    if (mode === "main" && qIndex === 0) dismissBubble("drag");
  }
  updateHud();
}

function doPlace(p            , gx        , gy        , preSnap      , moveCost        )       {
  history.push(preSnap);
  if (history.length > 300) history.shift();
  moves += moveCost;
  p.placed = true; p.cell = { x: gx, y: gy };
  const oi = placedOrder.indexOf(p.idx);
  if (oi >= 0) placedOrder.splice(oi, 1);
  placedOrder.push(p.idx);
  restPiece(p, true);
  // squash feedback + outline flash
  tw(0.16, (k) => { const s = 1 - 0.06 * Math.sin(k * Math.PI); p.shape.scale.set(s); }, () => p.shape.scale.set(1), 0.08);
  flashCells(applyT(p.cells, p.t).map(([cx, cy]) => [gx + cx, gy + cy]        ), PAL.ok);
  cue("sfx.snap");
  if (mode === "main" && qIndex === 0) dismissBubble("drag");
  updateHud();
  if (pieces.every((q) => q.placed)) startClear();
}

function flashCells(cells        , color        )       {
  const g = new PIXI.Graphics();
  const set = new Set(cells.map((c) => `${c[0]},${c[1]}`));
  for (const [x, y] of cells) {
    if (!set.has(`${x},${y - 1}`)) { g.moveTo(x * UNIT, y * UNIT); g.lineTo((x + 1) * UNIT, y * UNIT); }
    if (!set.has(`${x},${y + 1}`)) { g.moveTo(x * UNIT, (y + 1) * UNIT); g.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x - 1},${y}`)) { g.moveTo(x * UNIT, y * UNIT); g.lineTo(x * UNIT, (y + 1) * UNIT); }
    if (!set.has(`${x + 1},${y}`)) { g.moveTo((x + 1) * UNIT, y * UNIT); g.lineTo((x + 1) * UNIT, (y + 1) * UNIT); }
  }
  g.stroke({ width: 7, color, alpha: 0.9, cap: "round", join: "round" });
  fxBoard.addChild(g);
  tw(0.4, (k) => { g.alpha = 0.9 * (1 - k); }, () => { g.destroy(); });
}

function invalidFeedback(p            , res         )       {
  cue("sfx.invalid");
  const g = new PIXI.Graphics();
  const cells = applyT(p.cells, p.t).map(([cx, cy]) => [res.x + cx, res.y + cy]        );
  if (puzzle) {
    const inb = cells.filter(([x, y]) => x >= 0 && y >= 0 && x < puzzle .w && y < puzzle .h);
    for (const [x, y] of inb) g.rect(x * UNIT + 2, y * UNIT + 2, UNIT - 4, UNIT - 4).stroke({ width: 4, color: PAL.bad, alpha: 0.9 });
    for (const [x, y] of res.conflicts) {
      for (let i = 0; i < 3; i++) {
        const o = 12 + i * 18;
        g.moveTo(x * UNIT + Math.max(2, o - UNIT + 4), y * UNIT + Math.min(UNIT - 2, o));
        g.lineTo(x * UNIT + Math.min(UNIT - 2, o), y * UNIT + Math.max(2, o - UNIT + 4));
      }
    }
    g.stroke({ width: 3, color: PAL.bad, alpha: 0.75 });
  }
  fxBoard.addChild(g);
  tw(0.18, () => { /* hold */ }, () => { tw(0.15, (k) => { g.alpha = 1 - k; }, () => g.destroy()); });
}

function updateGhost()       {
  ghostG.clear();
  if (!drag || !puzzle) return;
  const res = trySnap(drag.p);
  if (res.kind !== "ok") return;
  const cells = applyT(drag.p.cells, drag.p.t);
  for (const [cx, cy] of cells) {
    ghostG.rect((res.x + cx) * UNIT + 2, (res.y + cy) * UNIT + 2, UNIT - 4, UNIT - 4).fill({ color: 0xffffff, alpha: 0.35 });
  }
  for (const [cx, cy] of cells) {
    ghostG.rect((res.x + cx) * UNIT + 2, (res.y + cy) * UNIT + 2, UNIT - 4, UNIT - 4).stroke({ width: 3, color: PAL.ok, alpha: 0.65 });
  }
}

function selectPiece(p                   )       {
  if (selected && selected.selG) selected.selG.visible = false;
  selected = p;
  if (p && p.selG) p.selG.visible = true;
  updateHud();
}

// ---------- transforms / undo / hint / reset ----------
function doTransform(kind                )       {
  const p = drag ? drag.p : selected;
  if (!p || solved || overlayOpen) return;
  const nt = kind === "rot" ? rotT(p.t) : flipT(p.t);

  if (p.placed && p.cell && !drag) {
    // rotate in place: keep anchor if legal, else nearest within 1 cell
    const cells = applyT(p.cells, nt);
    const occ = occupancy(p);
    let pos                                  = null;
    const cand                                        = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cand.push({ x: p.cell.x + dx, y: p.cell.y + dy, d: Math.abs(dx) + Math.abs(dy) });
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) if (legalAt(cells, c.x, c.y, occ)) { pos = { x: c.x, y: c.y }; break; }
    if (!pos) {
      cue("sfx.invalid");
      const cur = p.view.x;
      tw(0.18, (k) => { p.view.x = cur + Math.sin(k * Math.PI * 3) * 5; }, () => { p.view.x = cur; });
      return;
    }
    history.push(snapshotState());
    moves++;
    p.t = nt; p.cell = pos;
  } else {
    if (drag) { drag.ops++; }
    else { history.push(snapshotState()); moves++; }
    p.t = nt;
  }
  rebuildPiece(p);
  if (drag) {
    // keep the piece centered under the pointer after the shape changes
    const b = boundsOf(applyT(p.cells, p.t));
    drag.offX = b.w * UNIT * p.view.scale.x / 2;
    drag.offY = b.h * UNIT * p.view.scale.y / 2;
  } else {
    restPiece(p, false);
  }
  // transform animation
  if (kind === "rot") {
    p.shape.rotation = -Math.PI / 2;
    tw(0.12, (k) => { p.shape.rotation = -Math.PI / 2 * (1 - eoQ(k)); }, () => { p.shape.rotation = 0; });
    cue("sfx.rotate");
    if (mode === "main" && qIndex === 1) dismissBubble("rot");
  } else {
    p.shape.scale.x = -1;
    tw(0.12, (k) => { p.shape.scale.x = -1 + 2 * eoQ(k); }, () => { p.shape.scale.x = 1; });
    cue("sfx.flip");
    if (mode === "main" && qIndex === 2) dismissBubble("flip");
  }
  updateGhost();
  updateHud();
}

function snapshotState()       {
  return {
    moves,
    ts: pieces.map((p) => [p.t[0], p.t[1]]      ),
    placed: pieces.map((p) => p.placed),
    cells: pieces.map((p) => (p.cell ? { ...p.cell } : null)),
  };
}
function applySnap(s      )       {
  moves = s.moves;
  pieces.forEach((p, i) => {
    p.t = [s.ts[i][0], s.ts[i][1]];
    p.placed = s.placed[i];
    p.cell = s.cells[i] ? { x: s.cells[i] .x, y: s.cells[i] .y } : null;
    rebuildPiece(p);
    restPiece(p, false);
  });
  placedOrder = placedOrder.filter((i) => pieces[i].placed);
  selectPiece(null);
}
function doUndo()       {
  if (drag || solved || history.length === 0) return;
  const s = history.pop() ;
  cue("sfx.undo");
  applySnap(s);
  cue("sfx.flip");
  updateHud();
}

function doHint()       {
  if (mode !== "main" || hintsLeft <= 0 || solved) return;
  const p = (selected && !selected.placed) ? selected : pieces.find((q) => !q.placed);
  if (!p) return;
  hintsLeft--; hintsUsed++;
  cue("sfx.hint");
  hintG.clear();
  const color = PIECE_COLORS[p.color];
  for (const [cx, cy] of p.cells) {
    hintG.rect((p.anchor[0] + cx) * UNIT + 3, (p.anchor[1] + cy) * UNIT + 3, UNIT - 6, UNIT - 6)
      .fill({ color, alpha: 0.4 }).stroke({ width: 3, color: shade(color, 0.7), alpha: 0.8 });
  }
  after(3, () => { if (hintG && !hintG.destroyed) hintG.clear(); });
  updateHud();
}

function confirmReset()       {
  if (solved) return;
  const panel = mkPanel(300, 190);
  const t = mkText(T.resetConfirm, 18);
  t.anchor.set(0.5); t.position.set(150, 60);
  panel.addChild(t);
  const yes = mkButton(T.yes, 118, 46, () => { closeOverlay(); doReset(); });
  yes.position.set(22, 120);
  const no = mkButton(T.no, 118, 46, () => closeOverlay());
  no.position.set(160, 120);
  panel.addChild(yes, no);
  openOverlay(panel);
}
function doReset()       {
  moves = 0; hintsUsed = 0; hintsLeft = 2; history = []; placedOrder = []; solved = false;
  hintG.clear();
  for (const p of pieces) {
    p.t = [p.init[0], p.init[1]];
    p.placed = false; p.cell = null;
    rebuildPiece(p);
    restPiece(p, false);
  }
  selectPiece(null);
  updateHud();
}

function onKey(e               )       {
  if (scene !== "play" || overlayOpen) return;
  const k = e.key.toLowerCase();
  if (k === "r") doTransform("rot");
  else if (k === "f") doTransform("flip");
  else if (k === "z") doUndo();
  else if (k === "escape") selectPiece(null);
}

// ---------- clear ----------
function startClear()       {
  if (!puzzle || solved) return;
  solved = true;
  selectPiece(null);
  if (taRun && mode === "ta") {
    taRun.timeMs = Math.max(1, Math.round(performance.now() - taRun.startedAt));
    taRun.running = false;
    if (!taRun.recorded) {
      const prof = save.profiles.find(p => p.id === taRun .playerId);
      taRun.recorded = true;
      taRun.isBest = prof ? recordOnePuzzleRun(prof, taRun.timeMs) : false;
    }
  }
  cue("sfx.clear");
  updateHud();

  // color wave across cells (top-left to bottom-right)
  for (let y = 0; y < puzzle.h; y++) for (let x = 0; x < puzzle.w; x++) {
    const g = new PIXI.Graphics();
    g.rect(x * UNIT + 1, y * UNIT + 1, UNIT - 2, UNIT - 2).fill({ color: 0xffffff });
    g.alpha = 0;
    fxBoard.addChild(g);
    tw(0.36, (k) => { g.alpha = 0.85 * Math.sin(k * Math.PI); }, () => g.destroy(), (x + y) * 0.035);
  }
  // pieces lift in placement order
  placedOrder.forEach((idx, i) => {
    const p = pieces[idx];
    tw(0.3, (k) => { p.shape.y = p.shape.pivot.y - 10 * Math.sin(k * Math.PI); }, () => { p.shape.y = p.shape.pivot.y; }, 0.35 + i * 0.05);
  });
  // confetti + gentle zoom
  if (fx && confettiId) {
    const c = boardWrap.getGlobalPosition(new PIXI.Point());
    fx.play(confettiId, { pos: { x: c.x + puzzle.w * UNIT * boardScale / 2, y: c.y + puzzle.h * UNIT * boardScale / 2 }, power: 0.8 });
  }
  const bs = boardScale;
  tw(0.9, (k) => { const s = 1 + 0.04 * Math.sin(k * Math.PI); boardLayer.scale.set(bs * s); }, () => boardLayer.scale.set(bs), 0.3);

  if (mode === "main") {
    const earned = 1 + (hintsUsed === 0 ? 1 : 0) + (puzzle && moves <= puzzle.par ? 1 : 0);
    if (earned > curStamps()[qIndex]) { curStamps()[qIndex] = earned; }
    saveNow();
    after(1.4, () => showClearPanel());
  } else if (taRun) {
    const completed = taRun;
    after(1.4, () => {
      if (taRun === completed && scene === "play" && solved) showTaResult();
    });
  }
}

function showClearPanel()       {
  if (!puzzle) return;
  const W = Math.min(360, app.screen.width - 24);
  const panel = mkPanel(W, 330);
  const head = mkText(T.clear, 32, PAL.ok);
  head.anchor.set(0.5); head.position.set(W / 2, 38);
  panel.addChild(head);

  const conds                      = [
    [T.stampClear, true],
    [T.stampNoHint, hintsUsed === 0],
    [T.stampPar, moves <= puzzle.par],
  ];
  conds.forEach(([label, got], i) => {
    const x = W / 2 + (i - 1) * (W * 0.28);
    const stampSp = new PIXI.Sprite(texStamp);
    stampSp.anchor.set(0.5);
    const base = 54 / texStamp.width;
    stampSp.scale.set(base);
    stampSp.position.set(x, 96);
    if (!got) { stampSp.tint = 0x999999; stampSp.alpha = 0.25; }
    else {
      stampSp.alpha = 0; stampSp.scale.set(base * 1.8);
      tw(0.25, (k) => { stampSp.alpha = k; stampSp.scale.set(base * (1.8 - 0.8 * eoQ(k))); }, undefined, 0.25 + i * 0.22);
      after(0.25 + i * 0.22, () => cue("sfx.stamp"));
    }
    panel.addChild(stampSp);
    const lt = mkText(label, 12.5, got ? PAL.ink : 0x9a958a);
    lt.anchor.set(0.5); lt.position.set(x, 132);
    panel.addChild(lt);
  });

  const stats = mkText(`${T.moves} ${moves}/${puzzle.par}   ${T.hintsUsed} ${hintsUsed}`, 15, shade(PAL.ink, 1.4));
  stats.anchor.set(0.5); stats.position.set(W / 2, 162);
  panel.addChild(stats);

  const bw = (W - 60) / 2;
  const isLast = qIndex >= MAIN_PUZZLES.length - 1;
  const nextB = mkButton(isLast ? T.endingTitle : T.next, bw, 46, () => {
    closeOverlay();
    if (isLast) buildEnding();
    else startMain(qIndex + 1);
  });
  nextB.position.set(20, 190);
  const retryB = mkButton(T.retry, bw, 46, () => { closeOverlay(); startMain(qIndex); });
  retryB.position.set(40 + bw, 190);
  const listB = mkButton(T.list, W - 40, 42, () => { closeOverlay(); buildSelect(); }, { small: true });
  listB.position.set(20, 248);
  panel.addChild(nextB, retryB, listB);
  addShareRow(panel, 296 - 8, T.shareClear(qIndex + 1, moves));
  openOverlay(panel);
}

// ---------- time attack ----------
function openTaIntro()       {
  const prof = curProfile();
  if (!prof) {
    // time attack records belong to a named player: ask for one first
    promptName("", (nm) => { if (nm) { addProfile(nm); openTaIntro(); } });
    return;
  }
  const wide = app.screen.height < 500 && app.screen.width > 600;
  const W = Math.min(wide ? 720 : 360, app.screen.width - 40);
  const panel = mkPanel(W, wide ? 320 : 432);
  const center = wide ? 170 : W / 2;
  const head = mkText(T.taTitle, 28);
  head.anchor.set(0.5); head.position.set(center, 36);
  panel.addChild(head);
  const desc = mkText(T.taDesc, 15, shade(PAL.ink, 1.3));
  desc.anchor.set(0.5); desc.position.set(center, 90);
  panel.addChild(desc);

  // active player row (tap to switch)
  const pl = mkButton(`${T.playerLabel}: ${prof.name}`, wide ? 280 : W - 60, 48, () => { closeOverlay(); buildPlayers(); }, { small: true, fill: 0xdcf1ec });
  pl.position.set(30, 134);
  panel.addChild(pl);
  const best = mkText(`${T.taBest}: ${prof.ta1Best !== null ? fmtTime(prof.ta1Best) : "—"}`, 17);
  best.anchor.set(0.5); best.position.set(center, 196);
  panel.addChild(best);

  const lbHead = mkText(T.localRanking, 14, shade(PAL.ink, 1.3));
  lbHead.anchor.set(0.5); lbHead.position.set(wide ? 530 : center, wide ? 44 : 222);
  panel.addChild(lbHead);
  const ranked = localRanking().filter((p) => p.ta1Best !== null).slice(0, 3);
  if (!ranked.length) {
    const t = mkText(T.noScores, 14, PAL.ink);
    t.anchor.set(0.5); t.position.set(wide ? 530 : center, wide ? 90 : 246);
    panel.addChild(t);
  } else ranked.forEach((p, i) => {
    const me = p.id === prof.id;
    const line = mkText(`${i + 1}. ${p.name}`, 14, me ? PAL.ok : PAL.ink, me ? "700" : "400", "left");
    line.anchor.set(0, 0.5); line.position.set(wide ? 380 : 34, (wide ? 80 : 244) + i * 22);
    const tm = mkText(fmtTime(p.ta1Best ?? 0), 14, PAL.ink);
    tm.anchor.set(1, 0.5); tm.position.set(W - 34, (wide ? 80 : 244) + i * 22);
    if (line.width > 180) line.scale.set(180 / line.width);
    panel.addChild(line, tm);
  });

  const startB = mkButton(T.taStart, wide ? 260 : W - 120, 50, () => { closeOverlay(); startTa(); }, { fill: 0xdcf1ec });
  startB.position.set(wide ? 40 : 60, wide ? 240 : 306);
  panel.addChild(startB);
  const backB = mkButton(T.back, 110, 48, () => closeOverlay(), { small: true });
  backB.position.set(wide ? 380 : 20, wide ? 240 : 366);
  const rankB = mkButton(T.leaderboard, wide ? 170 : W - 160, 48, () => { closeOverlay(); rankTab = "local"; buildRanking(); }, { small: true });
  rankB.position.set(wide ? 510 : 140, wide ? 240 : 366);
  panel.addChild(backB, rankB);
  openOverlay(panel);
}

function showTaResult()       {
  if (!taRun || !taRun.recorded || !solved) return;
  const total = Math.round(taRun.timeMs);
  const prof = save.profiles.find(p => p.id === taRun .playerId) ?? null;
  const isBest = taRun.isBest;
  if (isBest && !taRun.submitted) after(0.35, () => cue("sfx.record"));

  const wide = app.screen.height < 580 && app.screen.width > 600;
  const W = Math.min(wide ? 720 : 380, app.screen.width - 40);
  const panel = mkPanel(W, wide ? 320 : 554);
  const left = wide ? 170 : W / 2;
  const text = (s        , size        , x        , y        )            => {
    const t = mkText(s, size, PAL.ink); t.anchor.set(0.5); t.position.set(x, y); panel.addChild(t); return t;
  };
  text(T.taResult + " · " + T.taSingle, 24, left, 28);
  text(prof?.name ?? "", 17, left, 60);
  text(fmtTime(total), 38, left, 99);
  text(`${T.taBest}: ${fmtTime(prof?.ta1Best ?? total)}${isBest ? " ★" : ""}`, 16, left, 137);
  const allRanked = localRanking().filter(p => p.ta1Best !== null);
  const personalRank = allRanked.findIndex(p => p.id === prof?.id) + 1;
  text(`${T.rank}: ${personalRank} / ${allRanked.length}`, 15, left, 165);
  const tableX = wide ? 360 : 20, tableW = wide ? W - 380 : W - 40;
  const tableY = wide ? 30 : 202;
  text(T.localRanking, 16, tableX + tableW / 2, tableY);
  allRanked.slice(0, 4).forEach((p, i) => {
    const y = tableY + 28 + i * 28;
    if (p.id === prof?.id) panel.addChild(new PIXI.Graphics().roundRect(tableX, y - 12, tableW, 25, 5).fill(0xdcf1ec));
    const tm = text(fmtTime(p.ta1Best ?? 0), 15, tableX + tableW - 6, y); tm.anchor.x = 1;
    const nm = text(`${i + 1}. ${p.name}`, 15, tableX + 6, y); nm.anchor.x = 0;
    while (nm.width > tableW - tm.width - 24 && nm.text.length > 3) nm.text = nm.text.slice(0, -2) + "…";
  });
  const recent = prof?.ta1Runs.slice(-3).reverse().map(r => fmtTime(r.t)).join("  /  ") ?? "—";
  text(T.recent, 14, tableX + tableW / 2, tableY + 150);
  text(recent, 14, tableX + tableW / 2, tableY + 172);
  const rankT = text("", 14, left, wide ? 193 : 402);
  const shouldSubmit = !taRun.submitted;
  taRun.submitted = true;
  void (async () => {
    if (!shouldSubmit || total >= 3600000) return;
    const r = await gp.player.submitScore(TA_SCORE_BASE - total);
    if (panel.destroyed) return;
    if (r.needLogin) rankT.text = T.loginForRank;
    else if (typeof r.rank === "number") rankT.text = `${T.onlineRanking} ${T.rank}: #${r.rank}`;
    if (rankT.width > 310) rankT.style.fontSize = 14;
  })();
  const actionX = wide ? 20 : 20, actionY = wide ? 218 : 426;
  const actionW = wide ? 300 : W - 40, bw = (actionW - 12) / 2;
  const againB = mkButton(T.taAgain, bw, 48, () => { closeOverlay(); startTa(); });
  againB.position.set(actionX, actionY);
  const menuB = mkButton(T.menu, bw, 48, () => { closeOverlay(); taRun = null; buildTitle(); });
  menuB.position.set(actionX + bw + 12, actionY);
  const rankB = mkButton(T.leaderboard, bw, 48, () => { closeOverlay(); taRun = null; rankTab = "local"; buildRanking(); }, { small: true });
  rankB.position.set(wide ? 360 : actionX, wide ? 250 : 486);
  panel.addChild(againB, menuB, rankB);
  if (gpShare?.image && gpShare.available !== false) {
    let captured              = null;
    const shareB = mkButton(T.share, bw, 48, () => { if (captured) void gpShare.image (captured, { text: T.shareTA(fmtTime(total)) }); }, { small: true });
    shareB.position.set(wide ? 360 + bw + 12 : actionX + bw + 12, wide ? 250 : 486);
    panel.addChild(shareB);
    after(0.25, () => { if (!panel.destroyed) void captureShare().then(b => { captured = b; }); });
  }
  openOverlay(panel);
}

// ---------- settings ----------
function openSettings()       {
  const W = Math.min(340, app.screen.width - 24);
  const panel = mkPanel(W, 330);
  const head = mkText(T.settings, 24);
  head.anchor.set(0.5); head.position.set(W / 2, 34);
  panel.addChild(head);

  const mkSlider = (y        , label        , get              , set                     )       => {
    const lt = mkText(label, 16, PAL.ink, "700", "left");
    lt.anchor.set(0, 0.5); lt.position.set(24, y);
    panel.addChild(lt);
    const tx = 110, twd = W - 134;
    const track = new PIXI.Graphics();
    const knob = new PIXI.Graphics();
    const draw = ()       => {
      const v = get();
      track.clear();
      track.roundRect(tx, y - 5, twd, 10, 5).fill({ color: 0xe0dacc });
      track.roundRect(tx, y - 5, twd * v, 10, 5).fill({ color: PAL.ok });
      knob.clear();
      knob.circle(tx + twd * v, y, 13).fill({ color: 0xffffff }).stroke({ width: 2.5, color: PAL.ink, alpha: 0.8 });
    };
    draw();
    panel.addChild(track, knob);
    const hit = new PIXI.Graphics();
    hit.rect(tx - 14, y - 22, twd + 28, 44).fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = "static"; hit.cursor = "pointer";
    let dragging = false;
    const apply = (e                            )       => {
      const l = panel.toLocal(e.global);
      set(Math.max(0, Math.min(1, (l.x - tx) / twd)));
      draw();
    };
    hit.on("pointerdown", (e                            ) => { dragging = true; void ensureAudio(); apply(e); });
    hit.on("globalpointermove", (e                            ) => { if (dragging) apply(e); });
    hit.on("pointerup", () => { if (dragging) { dragging = false; saveNow(); cue("sfx.button"); } });
    hit.on("pointerupoutside", () => { if (dragging) { dragging = false; saveNow(); } });
    panel.addChild(hit);
  };

  mkSlider(88, T.bgm, () => save.volM, (v) => { save.volM = v; sound.settings.setVolumes({ music: v }); });
  mkSlider(140, T.sfx, () => save.volS, (v) => { save.volS = v; sound.settings.setVolumes({ sfx: v }); });

  const muteB = mkButton(`${T.mute}: ${save.muted ? "ON" : "OFF"}`, W - 48, 44, () => {
    save.muted = !save.muted;
    sound.settings.setMuted(save.muted);
    saveNow();
    openSettings();
  }, { small: true });
  muteB.position.set(24, 176);
  panel.addChild(muteB);

  const langB = mkButton(`${T.lang}: ${LANG_LABELS[lang]}`, W - 48, 44, () => {
    const i = LANG_ORDER.indexOf(lang);
    lang = LANG_ORDER[(i + 1) % LANG_ORDER.length];
    T = LANGS[lang];
    document.documentElement.lang = lang;
    save.lang = lang;
    saveNow();
    openSettings();
  }, { small: true });
  langB.position.set(24, 228);
  panel.addChild(langB);

  const closeB = mkButton(T.back, 110, 40, () => { closeOverlay(); buildTitle(); }, { small: true });
  closeB.position.set((W - 110) / 2, 280);
  panel.addChild(closeB);
  openOverlay(panel);
}

// ==========================================================================
void boot().catch((err) => {
  console.error("boot failed", err);
});
