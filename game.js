import * as PIXI from "pixi.js";
import { mountDisplay } from "@makeplay/display";
import { createPixiFx } from "@makeplay/fx";
import { loadSoundSystem } from "@makeplay/sound";
                                                           
import { LANGS, PRIMARY, pickLang,              } from "./i18n.js";
import { createUI, uiCanDrop } from "./ui.js";

// ---------- 言語 ----------
let T = LANGS[pickLang(navigator.language)];
let manuallySelectedLanguage = false;
const setLang = (k         , manual = false) => {
  if (manual) manuallySelectedLanguage = true;
  T = LANGS[k];
  document.documentElement.lang = k;
  document.title = T.title;
};
document.documentElement.lang = pickLang(navigator.language);
document.title = T.title;

// ---------- 定数（世界単位 = レーン幅720px基準の論理ピクセル） ----------
const LANE_W = 720;
const BLOCK_H = 84;
const BASE_W = LANE_W * 0.7; // 504
const PERFECT_TOL = 6;
const SPAWN_GAP = 300;
const GRAVITY = 4300;
const BLOCK_ASSETS = ["assets/blocks/block-pink.png", "assets/blocks/block-yellow.png", "assets/blocks/block-teal.png", "assets/blocks/block-purple.png"];
const BG_ASSETS = ["assets/bg/bg-dusk-pink.png", "assets/bg/bg-teal-city.png", "assets/bg/bg-night-purple.png"];
const INK = 0x14110f;

// ---------- 状態 ----------
const GameMode = { Loading: 0, Playing: 1, GameOver: 2, Title: 3 }         ;
let paused = false;
let muted = false;
let uiHooks                                     = null;
                                                   
let mode         = GameMode.Loading;
let segments            = [];
let score = 0;
let best = 0;
let combo = 0;
let stacked = 0; // ベース除く積み上げ数
let submitted = false;
let newBestThisRun = false;

                                                                                                           
const debrisList           = [];

// ---------- Pixi セットアップ ----------
const host = document.getElementById("app") ;
let app                  ;
let fx                                          ;
let sound                  ;
let impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };

// 録画契約：ステージ宣言と瞬間イベント
const stageEvent = () => window.dispatchEvent(new CustomEvent("mp:stage"));
const moment = (type        , value         ) => {
  const fn = (window       ).__mpMoment;
  if (typeof fn === "function") fn(type, value);
  else window.dispatchEvent(new CustomEvent("mp:moment", { detail: { type, score: value } }));
};
// サウンドは起動直後に読み込み開始（__mpSound 登録を ready 前に間に合わせる）
const soundPromise = loadSoundSystem({ manifestUrl: "./sound.manifest.json" });

const worldView = new PIXI.Container();   // レーン世界（カメラ変換の対象）
const bgLayer = new PIXI.Container();     // 画面いっぱいの背景層
const worldFx = new PIXI.Container();     // ワールドFX層（worldView内）
const fxScreen = new PIXI.Container();    // 画面FX層
const floatingTexts = new PIXI.Container(); // 世界内のフローティングテキスト

let viewScale = 1;
let camY = 0;            // worldView.position.y の論理値（シェイク適用前）
let camEaseY = 0;
let blockTextures                 = [];
let bgTextures                 = [];
let blockMeta                                           = {};

// 往復ブロック
const cur = { x: LANE_W / 2, w: BASE_W, dir: 1, y: 0, vy: 0, sliding: true, t: 0, exists: false };
let curSprite                              = null;
let curBaseSX = 1;
let curBaseSY = 1;

const topSegment = () => segments[segments.length - 1];
const levelNow = () => Math.min(10, Math.floor(stacked / 10) + 1);
const BASE_SPEED = 480; // Lv1基礎速度（世界px/s）— ユーザーFBで2回減速（1152→750→480）
const speedNow = () => BASE_SPEED * Math.pow(1.18, Math.min(levelNow(), 10) - 1);

function makeBlockSprite(c        , w        )                       {
  const tex = blockTextures[c % blockTextures.length];
  const srcH = tex.height;
  const ns = new PIXI.NineSliceSprite({
    texture: tex,
    leftWidth: Math.round(srcH * 0.3),
    rightWidth: Math.round(srcH * 0.3),
    topHeight: Math.round(srcH * 0.5),
    bottomHeight: Math.round(srcH * 0.5),
  });
  ns.width = w;
  ns.height = BLOCK_H;
  return ns;
}

// 背景（レベル帯で切替・クロスフェード）
const bgSprites                = [];
let bgIndex = 0;
function setBg(i        ) {
  if (i === bgIndex || !bgSprites[i]) return;
  const prev = bgSprites[bgIndex];
  const next = bgSprites[i];
  bgIndex = i;
  next.alpha = 0;
  fadeBgTarget = next;
  fadeBgSource = prev;
}
let fadeBgTarget                     = null;
let fadeBgSource                     = null;

function layoutBg() {
  const sw = app.screen.width;
  const sh = app.screen.height;
  for (const bgSp of bgSprites) {
    const s = Math.max(sw / bgSp.texture.width, sh / bgSp.texture.height);
    bgSp.width = bgSp.texture.width * s;
    bgSp.height = bgSp.texture.height * s;
    bgSp.x = (sw - bgSp.width) / 2;
    bgSp.y = (sh - bgSp.height) / 2;
  }
}

// ---------- ローディング画面 ----------
const loadRoot = new PIXI.Container();
let loadBarFill               ;
let loadMarker               ;
let loadLabel           ;
function buildLoading() {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const bg = new PIXI.Graphics().rect(0, 0, sw, sh).fill(0x23203c);
  loadRoot.addChild(bg);
  loadLabel = new PIXI.Text({ text: T.title, style: { fontSize: 44, fontWeight: "900", fill: 0xffd23f, stroke: { color: INK, width: 6, join: "round" } } });
  loadLabel.anchor.set(0.5);
  loadLabel.x = sw / 2;
  loadLabel.y = sh * 0.42;
  loadRoot.addChild(loadLabel);
  const barW = Math.min(sw * 0.6, 320);
  const barBg = new PIXI.Graphics().roundRect(-barW / 2, -8, barW, 16, 8).fill(0x3a3852);
  barBg.x = sw / 2;
  barBg.y = sh * 0.55;
  loadRoot.addChild(barBg);
  loadBarFill = new PIXI.Graphics();
  loadBarFill.x = sw / 2 - barW / 2;
  loadBarFill.y = sh * 0.55;
  loadRoot.addChild(loadBarFill);
  loadMarker = new PIXI.Graphics().roundRect(-26, -10, 52, 20, 6).fill(0xff3b6b).stroke({ color: INK, width: 4 });
  loadMarker.x = sw / 2;
  loadMarker.y = sh * 0.55;
  loadRoot.addChild(loadMarker);
  (loadRoot       ).__barW = barW;
}
function setLoadProgress(p        ) {
  const barW = (loadRoot       ).__barW || 320;
  loadBarFill.clear().roundRect(0, -8, Math.max(0.001, barW * p), 16, 8).fill(0x2ec4b6);
}
function tickLoadMarker(elapsed        ) {
  const sw = app.screen.width;
  loadMarker.x = sw / 2 + Math.sin(elapsed * 0.004) * Math.min(sw * 0.28, 150);
  loadMarker.rotation = Math.sin(elapsed * 0.004) * 0.12;
}

// ---------- カメラ ----------
function cameraTargets() {
  const sh = app.screen.height;
  const topY = -stacked * BLOCK_H; // 塔頂の世界y
  let anchorFrac = 0.44;
  let targetScale = Math.min(app.screen.width / LANE_W, sh / 1280);
  if (mode === GameMode.Title) {
    anchorFrac = 0.52;
  } else if (mode === GameMode.GameOver) {
    anchorFrac = 0.32;
    const towerH = Math.max(stacked * BLOCK_H + SPAWN_GAP + BLOCK_H, BLOCK_H * 6);
    targetScale = Math.min(targetScale, (sh * 0.82) / towerH);
  }
  return { anchorPx: sh * anchorFrac, worldY: topY, scale: targetScale };
}

function applyCamera(dt        , screenW        ) {
  const t = cameraTargets();
  viewScale += (t.scale - viewScale) * Math.min(1, dt * 2.2);
  const targetCamY = t.anchorPx - t.worldY * viewScale;
  camEaseY += (targetCamY - camEaseY) * Math.min(1, dt * (mode === GameMode.GameOver ? 1.6 : 3.4));
  camY = camEaseY;
  worldView.scale.set(viewScale);
  worldView.x = (screenW - LANE_W * viewScale) / 2 + impulse.offsetX * 10;
  worldView.y = camY + impulse.offsetY * 10;
  // 背景パララクス（わずかに世界に追従）
  bgLayer.y = impulse.offsetY * 4 - camY * 0.05;
}

// ---------- ゲーム処理 ----------
function laneBounds(w        ) {
  return { lo: w / 2 + 20, hi: LANE_W - w / 2 - 20 };
}

function spawnBlock() {
  const top = topSegment();
  cur.w = top.w;
  cur.x = top.x;
  cur.dir = Math.random() < 0.5 ? -1 : 1;
  const { lo, hi } = laneBounds(cur.w);
  cur.x = cur.dir === 1 ? lo : hi;
  cur.y = topStart() - SPAWN_GAP;
  cur.vy = 0;
  cur.sliding = true;
  cur.exists = true;
  if (!curSprite) {
    curSprite = makeBlockSprite(colorFor(stacked), cur.w);
    worldView.addChild(curSprite);
  }
  restyleCurSprite();
  curBaseSX = curSprite .scale.x;
  curBaseSY = curSprite .scale.y;
  placeCurSprite();
}

function colorFor(segIndex        ) {
  return (segIndex + levelNow() - 1) % 4;
}

function restyleCurSprite() {
  if (!curSprite) return;
  curSprite.texture = blockTextures[colorFor(stacked) % blockTextures.length];
  curSprite.width = cur.w;
  curSprite.height = BLOCK_H;
  curBaseSX = curSprite.scale.x;
  curBaseSY = curSprite.scale.y;
}

function placeCurSprite() {
  if (!curSprite || !cur.exists) {
    if (curSprite) curSprite.visible = false;
    return;
  }
  curSprite.visible = true;
  curSprite.x = cur.x - cur.w / 2;
  curSprite.y = cur.y - BLOCK_H;
}

const topStart = () => -stacked * BLOCK_H; // 塔頂面の世界y（= 次のブロックが着地すべきy）

function rebuildTower() {
  towerGroup.removeChildren().forEach(c => c.destroy());
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const ns = makeBlockSprite(i === 0 ? 1 : colorFor(i - 1), s.w);
    ns.x = s.x - s.w / 2;
    ns.y = -i * BLOCK_H - BLOCK_H;
    towerGroup.addChild(ns);
  }
}
const towerGroup = new PIXI.Container();

function spawnDebris(x        , w        , c        , dirBoost        ) {
  const tex = blockTextures[c % blockTextures.length];
  const sp = new PIXI.Sprite(tex);
  sp.width = Math.max(8, w);
  sp.height = BLOCK_H * 0.92;
  sp.anchor.set(0.5, 0.5);
  const d         = {
    sp, x, y: cur.y - BLOCK_H / 2,
    vx: dirBoost * (60 + Math.random() * 90),
    vy: cur.vy * 0.6, vr: dirBoost * (2.2 + Math.random() * 2.4),
    done: false,
  };
  sp.x = d.x;
  sp.y = d.y;
  debrisList.push(d);
  worldView.addChild(sp);
}

function floatText(msg        , x        , y        , fill = 0xffd76a) {
  const t = new PIXI.Text({
    text: msg,
    style: { fontSize: 44, fontWeight: "900", fill, stroke: { color: INK, width: 7, join: "round" }, fontFamily: "system-ui, sans-serif" },
  });
  t.anchor.set(0.5);
  t.x = x;
  t.y = y;
  (t       ).__age = 0;
  floatingTexts.addChild(t);
}

function resolveLanding() {
  const top = topSegment();
  const landY = topStart(); // この頂面に着地
  const curL = cur.x - cur.w / 2;
  const curR = cur.x + cur.w / 2;
  const topL = top.x - top.w / 2;
  const topR = top.x + top.w / 2;
  const ovL = Math.max(curL, topL);
  const ovR = Math.min(curR, topR);
  const ovW = ovR - ovL;

  if (ovW <= 0) {
    // 完全ミス → ゲームオーバーへ
    gameOver(cur.x, cur.w);
    return;
  }

  const offset = Math.abs(cur.x - top.x);
  const isPerfect = offset <= PERFECT_TOL;
  let newX = (ovL + ovR) / 2;
  let newW = ovW;
  let restored = 0;
  if (isPerfect) {
    newX = top.x;
    // PERFECTコンボが2連続目以降で、最上段の有効幅を+40回復（上限=基礎幅）
    if (combo + 1 >= 2 && top.w < BASE_W) {
      restored = Math.round(Math.min(40, BASE_W - top.w));
      top.w += restored;
    }
    newW = top.w;
  } else {
    // はみ出し分を切り落とし
    if (curL < topL) spawnDebris((curL + topL) / 2, topL - curL, colorFor(stacked), -1);
    if (curR > topR) spawnDebris((topR + curR) / 2, curR - topR, colorFor(stacked), 1);
    void sound.playCue("cut.piece", { eventId: `cut:${stacked}`, seed: `cut:${stacked}` });
  }

  // 着地段を塔に追加
  const c = colorFor(stacked);
  segments.push({ x: newX, w: newW, c });
  stacked += 1;
  const np = makeBlockSprite(c, newW);
  np.x = newX - newW / 2;
  np.y = landY - BLOCK_H;
  towerGroup.addChild(np);

  // 幅が回復したときは、塔全体の描画を合わせ直す
  if (restored > 0) rebuildTower();

  // スコアとコンボ
  if (isPerfect) {
    combo += 1;
    score += 2;
    fx.play("critical-light-hit", { pos: { x: newX, y: landY - BLOCK_H / 2 }, power: 0.9 });
    void sound.playCue("hit.perfect", { eventId: `pf:${stacked}:${combo}`, seed: `pf:${stacked}:${combo}`, pitchSemitones: Math.min(12, combo) });
    floatText(combo > 1 ? `${T.perfect} ×${combo}` : T.perfect, newX, landY - BLOCK_H - 30);
    if (restored > 0) floatText(`✦ ${T.widthRestore}`, newX, landY - BLOCK_H - 80, 0x2ec4b6);
  } else {
    combo = 0;
    score += 1;
    fx.play("land-dust", { pos: { x: newX, y: landY } });
    void sound.playCue("land.block", { eventId: `land:${stacked}`, seed: `land:${stacked}` });
  }

  // レベルアップ判定
  const lv = levelNow();
  if (stacked % 10 === 0 && lv <= 10) {
    void sound.playCue("jingle.levelup", { eventId: `lv:${lv}`, seed: `lv:${lv}` });
    moment("level-clear", stacked);
    setBg((lv - 1) % 3);
    floatText(T.levelUp, LANE_W / 2, landY - BLOCK_H * 2 - 40, 0xffd23f);
    uiHooks?.onLevelUp(lv);
  }

  // 中断続行セーブ
  void gp.player.saves.putLatest({ v: 1, stack: segments.map(s => ({ x: Math.round(s.x * 10) / 10, w: Math.round(s.w * 10) / 10, c: s.c })), score, combo, stacked });

  spawnBlock();
  uiHooks?.onScore();
  if (score > best && !newBestThisRun) {
    newBestThisRun = true;
    if (best > 0) moment("new-best", score);
    if (best > 0) floatText(T.newBest, LANE_W / 2, landY - BLOCK_H * 3 - 60, 0x2ec4b6);
  }
}

let dropFilter                         = null;

function drop() {
  if (mode !== GameMode.Playing || !cur.sliding || !cur.exists) return;
  if (dropFilter && !dropFilter()) return;
  if (paused) return;
  cur.sliding = false;
  cur.vy = 0;
  void sound.playCue("ui.drop", { eventId: `drop:${stacked}`, seed: `drop:${stacked}` });
}

async function gameOver(missX        , missW        ) {
  mode = GameMode.GameOver;
  moment("death", score);
  cur.exists = false;
  if (curSprite) curSprite.visible = false;
  // 外れたブロックはそのままデブリ落下
  spawnDebris(missX, missW, colorFor(stacked), cur.dir);
  fx.play("damage-flash");
  void sound.playCue("hit.gameover", { eventId: "gameover", seed: "gameover" });
  await sound.setMixState("results", { active: true });

  try {
    const list = await gp.player.saves.list();
    const autoRow = (list ?? []).find((s     ) => s.kind === "auto");
    if (autoRow) await gp.player.saves.delete(autoRow.id);
  } catch { /* 失敗しても進行 */ }
  const isNewBest = score > best && score > 0;
  if (score > 0) {
    try {
      const r = await gp.player.submitScore(score);
      if (r && typeof r.best === "number") best = Math.max(best, r.best);
    } catch { /* オフラインでも進行 */ }
  }
  if (score > best) best = score;
  writeBestMeta();
  uiHooks?.onGameOver(isNewBest);
}

function writeBestMeta() {
  void gp.player.saves.list().then(async list => {
    const row = (list ?? []).find((s     ) => s.name === "__sys_best");
    if (row) await gp.player.saves.update(row.id, { v: 1, best, muted }, "__sys_best");
    else await gp.player.saves.create({ v: 1, best, muted }, "__sys_best");
  });
}

function restartRun() {
  paused = false;
  for (const d of debrisList) d.sp.destroy();
  debrisList.length = 0;
  floatingTexts.removeChildren().forEach(c => c.destroy());
  fx.clear();
  score = 0;
  combo = 0;
  stacked = 0;
  submitted = false;
  newBestThisRun = false;
  segments = [{ x: LANE_W / 2, w: BASE_W, c: 0 }];
  rebuildTower();
  setBg(0);
  mode = GameMode.Playing;
  void sound.setMixState("gameplay", { active: true });
  spawnBlock();
  void gp.player.saves.putLatest({ v: 1, stack: segments.map(s => ({ x: s.x, w: s.w, c: s.c })), score, combo, stacked });
}

function resetToTitle() {
  restartRun();
  mode = GameMode.Title;
  paused = false;
}

// 保存データからランを復元
function restoreRun(save     )          {
  try {
    if (!save || !Array.isArray(save.stack) || save.stack.length === 0) return false;
    segments = save.stack.map((s     ) => ({ x: Number(s.x), w: Number(s.w), c: Number(s.c) || 0 }));
    stacked = Number(save.stacked) || segments.length - 1;
    score = Number(save.score) || 0;
    combo = Number(save.combo) || 0;
    mode = GameMode.Playing;
    rebuildTower();
    setBg((levelNow() - 1) % 3);
    spawnBlock();
    return true;
  } catch {
    return false;
  }
}

// ---------- 入力 ----------
let musicStarted = false;
function onTapAny() {
  void sound?.unlock();
  if (!musicStarted && sound) {
    musicStarted = true;
    void sound.setMusicState("main", { eventId: "music-start" });
  }
  if (mode === GameMode.Playing) {
    drop();
  }
}

// ---------- デブリ更新 ----------
function updateDebris(dt        ) {
  const groundTop = 0;
  for (const d of debrisList) {
    if (d.done) continue;
    d.vy += GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.sp.x = d.x;
    d.sp.y = d.y;
    d.sp.rotation += d.vr * dt;
    if (d.vy > 0 && d.y + BLOCK_H * 0.46 >= groundTop) {
      // 基盤レベルに着地 → 煙＋音
      d.done = true;
      fx.play("smoke-puff", { pos: { x: d.x, y: groundTop }, power: 0.7 });
      void sound.playCue("land.piece", { eventId: `pl:${d.x | 0}`, seed: `pl:${d.x | 0}` });
      dustList.push({ sp: d.sp, age: 0 });
      continue;
    }
    // 画面下から大きく外れたらフェード
    if (d.y * viewScale + camY > app.screen.height + 500) {
      d.done = true;
      dustList.push({ sp: d.sp, age: 0.6 });
    }
  }
}
const dustList                                     = [];
function updateDust(dt        ) {
  for (let i = dustList.length - 1; i >= 0; i--) {
    const d = dustList[i];
    d.age += dt * 1.6;
    d.sp.alpha = Math.max(0, 1 - d.age);
    if (d.age >= 1) {
      d.sp.destroy();
      dustList.splice(i, 1);
    }
  }
}

// ---------- メインループ ----------
let lastTime = 0;
function frame(dtReal        ) {
  const timeScale = fx.update(dtReal);
  const dt = dtReal * timeScale;

  if (mode === GameMode.Loading) return;

  // 往復 / 落下（タイトルのアトラクト中でも往復だけ動かす）
  if ((mode === GameMode.Playing || mode === GameMode.Title) && cur.exists && !paused) {
    if (cur.sliding) {
      const { lo, hi } = laneBounds(cur.w);
      cur.x += cur.dir * speedNow() * dt;
      if (cur.x > hi) { cur.x = hi; cur.dir = -1; }
      if (cur.x < lo) { cur.x = lo; cur.dir = 1; }
      curSprite .scale.y = curBaseSY * (1 + Math.sin(performance.now() * 0.004) * 0.015);
    } else {
      const prevBottom = cur.y;
      cur.vy += GRAVITY * dt;
      cur.y += cur.vy * dt;
      if (cur.vy > 0 && curSprite) {
        const k = Math.min(0.35, cur.vy / 9000);
        curSprite.scale.y = curBaseSY * (1 + k);
        curSprite.scale.x = curBaseSX * (1 - k * 0.5);
      }
      const landY = topStart();
      if (prevBottom < landY && cur.y >= landY) {
        if (curSprite) { curSprite.scale.set(curBaseSX, curBaseSY); }
        cur.exists = false;
        if (curSprite) curSprite.visible = false;
        resolveLanding();
      }
    }
    placeCurSprite();
  }

  if (!paused) {
    updateDebris(dt);
    updateDust(dt);
  }

  // フローティングテキスト
  for (const child of [...floatingTexts.children]) {
    (child       ).__age += dt;
    const age = (child       ).__age;
    child.y -= 44 * dt;
    child.alpha = Math.max(0, 1 - Math.max(0, age - 0.6) / 0.5);
    if (age > 1.2) floatingTexts.removeChild(child), child.destroy();
  }

  // 背景クロスフェード
  if (fadeBgTarget) {
    fadeBgTarget.alpha = Math.min(1, fadeBgTarget.alpha + dt * 1.4);
    if (fadeBgSource) fadeBgSource.alpha = Math.max(0, fadeBgSource.alpha - dt * 1.4);
    if (fadeBgTarget.alpha >= 1) {
      if (fadeBgSource) fadeBgSource.alpha = 0;
      fadeBgTarget = null;
      fadeBgSource = null;
    }
  }

  applyCamera(dt, app.screen.width);
}

// ---------- ブート ----------
async function boot() {
  app = new PIXI.Application();
  await app.init({ background: 0x23203c, resizeTo: host, autoDensity: true, antialias: true });
  app.canvas.setAttribute("data-mp-layer", "");
  (app.canvas.style                       ).position = "absolute";
  host.appendChild(app.canvas);

  const display = mountDisplay({
    orientation: "portrait",
    onResize: () => {
      layoutBg();
      stageEvent();
    },
  });
  display.attachPixi(app);

  // レイヤー順
  app.stage.addChild(bgLayer);
  app.stage.addChild(worldView);
  worldView.addChild(towerGroup);
  worldView.addChild(worldFx);
  worldView.addChild(floatingTexts);
  app.stage.addChild(fxScreen);

  buildLoading();
  app.stage.addChild(loadRoot);

  // 録画契約：__mpSound を ready 前に登録するため先にサウンドを解決
  sound = await soundPromise                    ;

  let firstFrame = true;
  app.ticker.add(t => {
    const dtReal = Math.min(t.deltaMS / 1000, 0.05);
    if (mode === GameMode.Loading) {
      tickLoadMarker(t.lastTime);
      if (firstFrame) {
        firstFrame = false;
        window.__gpReady = true;
        stageEvent();
      }
      return;
    }
    frame(dtReal);
  });

  // アセット読み込み（進捗は実数）
  const files = [...BLOCK_ASSETS, ...BG_ASSETS, "assets/blocks/index.json"];
  const loaded = await PIXI.Assets.load(files, p => setLoadProgress(p));
  blockTextures = BLOCK_ASSETS.map(u => loaded[u]                );
  bgTextures = BG_ASSETS.map(u => loaded[u]                );
  blockMeta = loaded["assets/blocks/index.json"]       ;
  for (const i in bgTextures) {
    const sp = new PIXI.Sprite(bgTextures[i]);
    sp.alpha = i === "0" ? 1 : 0;
    bgLayer.addChild(sp);
    bgSprites.push(sp);
  }
  layoutBg();

  fx = await createPixiFx({
    PIXI,
    app,
    world: worldView,
    screen: fxScreen,
    referenceSpan: BASE_W,
    onImpulse: next => { impulse = next; },
  });

  await gp.player.ready.then(({ user }) => {
    if (user?.locale && !manuallySelectedLanguage) setLang(pickLang(user.locale));
  });

  // ベスト値＆ミュート設定の読み出し
  try {
    const list = await gp.player.saves.list();
    const row = (list ?? []).find((s     ) => s.name === "__sys_best");
    if (row) {
      const data = await gp.player.saves.get(row.id);
      if (data && typeof (data       ).best === "number") best = (data       ).best;
      if (data && typeof (data       ).muted === "boolean") muted = (data       ).muted;
    }
  } catch { /* ゲストやオフラインでも進行 */ }

  // 中断ランの有無（Continue 入口）— 実際の復元はプレイヤーが遊ぶ導線を選んだとき
  const syncSave = gp.player.saves.latestSync;
  const hasResume = !!(syncSave && Number(syncSave.stacked) > 0);
  segments = [{ x: LANE_W / 2, w: BASE_W, c: 0 }];
  rebuildTower();
  spawnBlock();

  camEaseY = cameraTargets().anchorPx - cameraTargets().worldY * viewScale;
  viewScale = cameraTargets().scale;
  worldView.scale.set(viewScale);
  worldView.x = (app.screen.width - LANE_W * viewScale) / 2;
  worldView.y = camEaseY;

  // ---- スクリーンUI ----
  uiHooks = createUI({
    T: () => T,
    langKey: () => (Object.keys(LANGS)             ).find(k => LANGS[k] === T) ?? PRIMARY,
    setLang: (k        ) => setLang(k           , true),
    getState: () => ({ mode, score, best, level: levelNow(), combo, muted, hasResume, newBest: false, stacked }),
    startNewRun: () => restartRun(),
    continueRun: () => { const okR = restoreRun(gp.player.saves.latestSync); if (!okR) restartRun(); },
    restartRun: () => restartRun(),
    home: () => resetToTitle(),
    pauseGame: () => { if (mode !== GameMode.Playing) return; paused = true; void sound.setHold("pause-menu", true); },
    resumeGame: () => { paused = false; void sound.setHold("pause-menu", false); },
    toggleMute: () => { muted = !muted; void sound.settings.setMuted(muted); writeBestMeta(); return muted; },
    topScores: async () => { try { return await gp.player.topScores(10, { includeMutual: true }); } catch { return []; } },
    openProfile: (userId        ) => { try { void gp.player.openProfile(userId); } catch { /* 旧ホスト */ } },
    playTap: () => { void sound?.unlock(); void sound?.playCue("ui.drop", { eventId: `uitap:${Date.now() % 997}`, seed: `uitap:${Date.now() % 997}` }); },
    fxConfetti: () => {
      const sh = app.screen.height;
      const worldY = (sh * 0.5 - worldView.y) / viewScale;
      fx.play("confetti-burst", { pos: { x: LANE_W / 2, y: worldY }, power: 0.8 });
    },
  });
  dropFilter = uiCanDrop;

  mode = GameMode.Title;
  loadRoot.destroy();
  uiHooks.showTitle();
  void sound.settings.setMuted(muted);
  window.__gpPlayable = true;

  window.addEventListener("pointerdown", () => onTapAny());
  window.addEventListener("keydown", e => {
    if (e.code === "Space" || e.code === "Enter") onTapAny();
  });
}

window.addEventListener("pagehide", () => { void sound?.dispose(); }, { once: true });

// テスト用デバッグ窓口（出荷バイナリにも影響なし）
(window       ).__debug = {
  get score() { return score; },
  get stacked() { return stacked; },
  get level() { return levelNow(); },
  get mode() { return mode; },
  get combo() { return combo; },
  get topW() { return segments.length ? topSegment().w : 0; },
  setDropX(x        ) { if (mode === GameMode.Playing && cur.sliding) { cur.x = x; } },
  get paused() { return paused; },
  getCenter() { return segments.length ? topSegment().x : LANE_W / 2; },
  get speed() { return speedNow(); },
  shrinkTop(w        ) { const t = topSegment(); if (t) { t.w = w; cur.w = w; rebuildTower(); } },
  fillTower(n        ) {
    for (let i = 0; i < n; i++) {
      const t = topSegment();
      segments.push({ x: t.x, w: t.w, c: colorFor(stacked) });
      stacked += 1;
    }
    rebuildTower();
    spawnBlock();
  },
};

void boot().catch(err => console.error("boot failed", err));
