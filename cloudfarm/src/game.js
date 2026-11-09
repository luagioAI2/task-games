// Entry: boot Pixi + display + FX + sound, load assets, restore save, run the world, route input.
//
// ★ 移植改动：四个裸标识符换成随包发布的本地产物（`src/vendor/`）。
//   原版靠 `<script type="importmap">` 把它们指到 makeplay.ai 的 CDN。
//   我们不依赖那个 CDN —— 远程站点/插件都要能离线起，而且插件包里
//   根本不允许出现裸标识符（blob: 模块没有 importmap 可查）。
import * as PIXI from "./vendor/pixi.min.mjs";
import { mountDisplay } from "./vendor/display.mjs";
import { createPixiFx } from "./vendor/fx.mjs";
import { loadSoundSystem } from "./vendor/sound.mjs";
                                                                  
import { Farm, newFarm, parseSave, hashRandom,                } from "./farm.js";
import { animalById, cropById, MS_PER_FARM_MIN, FISHING } from "./data/catalog.js";
import { WorldView, ALL_TEXTURES, ANIM_PACKS, FONT, plotCenter, itemTexKey, FIELD_TOP, POND_TOP, WUTONG_SPOT,          } from "./world.js";
import { t, pickLang, setLangCode, getLang, qty, nm } from "./i18n.js";
import { installUi, uninstallUi } from "./ui.js";
import { Economy } from "./economy.js";
import { STANDALONE_START } from "./wallet.js";

                                                        

/** Hooks the screen UI implements; the world calls them on taps/events. */
                       
                                    
                   
                                                                   
                               
                                        
                                       
                            
                                                          
  
export const ui          = {
  harvestPrompt() {}, needSeed() {}, openSeedsForPlot() {}, animalTap() {}, zoneTap() {}, creekTap() {}, event() {},
  layout() { return { colW: 0, top: 0, bottom: 0 }; },
};

let playtestSnapshot = null;
/** 存档后端。由 `start()` 注入 —— 独立网页是 localStorage，插件是宿主 storage。 */
let __cfStore = null;
/**
 * 兑换券桥（**卖出 → 兑换券**）。由 `start()` 注入。
 *
 * 独立网页也会建一个（只是 `enabled === false`）—— 那边照常累积未发出的券，
 * 这样同一份存档进插件时不会把「已经该给」的券吞掉。见 `src/economy.js`。
 */
let __cfEco = null;
/**
 * 宿主 HostApi（插件形态）；独立网页是 null。
 *
 * 只有两件事用它：`Farm` 的积分钱包（`src/wallet.js`，花积分走
 * `host.spendPoints`）和上面那个经济桥（`host.mintVoucher`）。
 * 业务代码一律不直接碰它。
 */
let __cfHostApi = null;
/**
 * 当前挂载容器。
 *
 * ⚠️ 不能像原版那样在模块顶层 `const host = document.getElementById("app")`
 * 定死：插件会被挂载多次（切 tab → unmount → 再挂），每次给的是**新的**容器。
 * 所以做成函数，`start()` 调用时才求值。
 */
const hostEl = () => (globalThis       ).__cfHostEl || document.getElementById("app") ;
let sound                          = null;
let soundUnlocked = false;

async function boot() {
  const host = hostEl();
  if (!host) throw new Error("没有挂载容器（既没有 __cfHostEl，也没有 #app）");
  const app = new PIXI.Application();
  await app.init({ resizeTo: host, background: 0x6fae3e, antialias: true, autoDensity: true });
  app.ticker.maxFPS = 30; // v49 性能：30fps 省电，动画照常流畅（全场 dt 驱动）
  host.appendChild(app.canvas);
  app.canvas.style.touchAction = "none";
  document.documentElement.lang = getLang() === "zh" ? "zh-Hans" : getLang();
  document.title = t("title");

  // ---- loading screen (own art, visible after __gpReady) ----
  const loading = new PIXI.Container();
  const sun = new PIXI.Graphics();
  for (let r = 0; r < 10; r++) { const a = r / 10 * Math.PI * 2; sun.moveTo(Math.cos(a) * 38, Math.sin(a) * 38).lineTo(Math.cos(a) * 56, Math.sin(a) * 56); }
  sun.stroke({ width: 7, color: 0xf7c531, cap: "round" }).circle(0, 0, 30).fill({ color: 0xffd84a }).stroke({ width: 4, color: 0xe0a020 });
  const hills = new PIXI.Graphics();
  const barBg = new PIXI.Graphics(), barFill = new PIXI.Graphics();
  const ltext = new PIXI.Text({ text: t("title"), style: { fontFamily: FONT, fontSize: 40, fontWeight: "900", fill: 0xffffff, stroke: { color: 0x4a3222, width: 8, join: "round" } } });
  ltext.anchor.set(0.5);
  loading.addChild(hills, sun, ltext, barBg, barFill);
  app.stage.addChild(loading);
  let loadFrac = 0;
  const drawLoading = () => {
    const w = app.screen.width, h = app.screen.height;
    hills.clear().rect(0, h * 0.62, w, h * 0.38).fill({ color: 0x86c84a }).ellipse(w * 0.2, h * 0.64, w * 0.5, 80).fill({ color: 0x86c84a }).ellipse(w * 0.85, h * 0.63, w * 0.45, 70).fill({ color: 0x7cc043 });
    sun.position.set(w / 2, h * 0.34); ltext.position.set(w / 2, h * 0.5);
    const bw = Math.min(320, w * 0.7), bx = (w - bw) / 2, by = h * 0.58;
    barBg.clear().roundRect(bx, by, bw, 22, 11).fill({ color: 0xfff6e0 }).stroke({ width: 4, color: 0xb07a45 });
    barFill.clear().roundRect(bx + 4, by + 4, Math.max(14, (bw - 8) * loadFrac), 14, 7).fill({ color: 0x6dbb3c });
  };
  const loadTick = (tk             ) => { sun.rotation += tk.deltaMS / 1000 * 1.2; drawLoading(); };
  app.ticker.add(loadTick);

  let viewReady = false;
  const display = mountDisplay({ host, orientation: "portrait", onResize: () => { if (viewReady) relayout(); } });
  display.attachPixi(app);
  drawLoading();
  app.render();
  window.__gpReady = true;

  // ---- assets ----
  //
  // ★ 移植改动（插件化最关键的一处）：所有资源地址都过 `__cfAsset()`。
  //
  //   原版直接写 `"assets/" + p` —— 相对**文档**解析，独立网页里正好对。
  //   但插件是在 `blob:` 模块里跑的，相对路径会以 `blob:` 为基准 ⇒ 全 404。
  //   宿主为此给了 `ctx.assetUrl(rel)`，它知道资源到底在
  //   `/games/<id>/`、CDN 还是 `convertFileSrc(...)` 的本地目录。
  //
  //   独立网页形态下 `__cfAsset` 就是恒等前缀 `assets/`，两者共用一份代码。
  const A = (rel) => (globalThis       ).__cfAsset ? (globalThis       ).__cfAsset(rel) : "assets/" + rel;
  const manifests                                      = {};
  await Promise.all(Object.entries(ANIM_PACKS).map(async ([kind, pack]) => { manifests[kind] = await (await fetch(A(`${pack}/manifest.json`))).json(); }));
  loadFrac = 0.05;
  const pageUrl = (kind        , page        ) => A(`${ANIM_PACKS[kind]}/${page}`);
  const urls = [
    ...ALL_TEXTURES.map(p => A(p)),
    ...Object.entries(manifests).flatMap(([kind, m]) => m.pages.map(pg => pageUrl(kind, pg))),
  ];
  const loaded = await PIXI.Assets.load(urls, p => { loadFrac = 0.05 + p * 0.9; });
  const tex      = {};
  for (const p of ALL_TEXTURES) tex[p.replace(/\.(webp)$/, "")] = loaded[A(p)];
  const animSheets                                                        = {};
  for (const [kind, m] of Object.entries(manifests)) animSheets[kind] = { pages: m.pages.map(pg => loaded[pageUrl(kind, pg)]), m };
  loadFrac = 1;

  // ---- save ----
  //
  // ★ 移植改动：原来读 `gp.player.saves.getLatest()` / `gp.player.user.locale`。
  // 现在走 `__cfStore`（见 src/store.js）—— 独立网页背后是 localStorage，
  // 插件形态背后是宿主的 `host.storage`。业务代码不知道也不关心是哪一种。
  let state = newFarm(Date.now());
  let fresh = true;
  try {
    const saved = await __cfStore.loadSave();
    if (saved) {
      const parsed = parseSave(saved);
      if (parsed) { state = parsed; fresh = false; }
    }
  } catch (e) { console.warn("save read failed", e); }
  // 独立网页没有 App 的积分账本，给一笔启动资金好试玩 / 截图；
  // 插件形态下 `state.points` 只是显示镜像，进来就被 `wallet.commit()`
  // 覆盖成 `host.balance()`，写多少都不影响真实余额。
  if (fresh && !__cfHostApi) state.points = STANDALONE_START;
  const farm = new Farm(state, __cfHostApi);
  // 宿主拒绝扣款（余额在别处被改过）时提示一次。不回滚动作，见 wallet.js 文件头。
  farm.wallet.onReject = () => {
    ui.event({ type: "toast", k: "toast.pointsRejected" });
  };
  farm.wallet.commit();
  farm.tick();

  // ---- world + FX ----
  app.ticker.remove(loadTick);
  loading.destroy({ children: true });
  const view = new WorldView(farm, tex, animSheets                                                     , app.renderer);
  const todQ = new URLSearchParams(location.search).get("tod");
  if (todQ != null && !Number.isNaN(Number(todQ))) view.debugHour = Math.max(0, Math.min(24, Number(todQ))); // ?tod=20 预览夜晚
  const wxQ = new URLSearchParams(location.search).get("wx");
  if (wxQ === "rain" || wxQ === "cloud" || wxQ === "sun") view.debugWx = wxQ; // ?wx= 预览天气表现（不改模拟、不进存档）
  // v49 性能：DrawCall 计数（灵机 WebGL 上行调用包一层，成本可忽略）+ FPS 平滑，供调试面板/离线核查（view.fps()）
  {
    const gl = app.renderer.gl                                      ;
    if (gl && typeof gl.drawElements === "function") {
      let dcAcc = 0;
      for (const k of ["drawElements", "drawElementsInstanced", "drawArrays", "drawArraysInstanced"]) {
        const orig = (gl[k]                                   ).bind(gl);
        gl[k] = (...args           ) => { dcAcc++; return orig(...args); };
      }
      app.ticker.add(() => { view.perf.dc = dcAcc; dcAcc = 0; }); // 上一帧渲染的调用总数
    }
  }
  // 调试预览：?dbg=pest 第一块长着的地立刻长虫；?dbg=poop 牧场动物立刻集体拉粑粑；?dbg=leap 进场 ~1s 内强制一次鱼跃（不影响判定逻辑；种/养出来后再补上）
  const dbgWanted = new Set((new URLSearchParams(location.search).get("dbg") ?? "").split(",").filter(Boolean));
  if (dbgWanted.has("lvcard")) setTimeout(() => farm.emit({ type: "levelup", level: farm.level.level, unlocked: ["magicbean"] }       ), 25000); // v56 试玩：只展示升级卡（不改存档）
  const applyDbg = () => {
    if (dbgWanted.has("pest")) {
      const cs = farm.s.plots.find(p => p.crop && !p.crop.dead && !p.crop.old && !p.crop.pest)?.crop;
      if (cs) cs.pest = true;
    }
    if (dbgWanted.has("poop")) {
      for (const a of farm.s.animals) if (animalById(a.kind).zone === "ranch" && !a.dead && a.poopSince == null) { a.poopSince = farm.now(); a.poopChecked = a.poopChecked ?? 0; }
    }
    if (dbgWanted.has("leap")) { if (dbgWanted.has("loop")) view.forceLeapLoop(); else view.forceLeap(); } // 池塘没活鱼则小河 minnow 跳
    if (dbgWanted.has("dry")) farm.debugDry(); // 长着的地立刻口渴（测浇水动画）
    if (dbgWanted.has("sleep")) view.debugSleep = "sleep"; // 强制全员睡觉（表现层）
    if (dbgWanted.has("wake")) view.debugSleep = "wake";   // 强制全员起床（表现层）
  };
  applyDbg();
  // 试玩布置（?rig=…）：这些场景要买一堆种子和动物，但**不该真花孩子的积分**。
  // 所以给钱包开 `free`（只影响本地判断，不写宿主账本）。
  // ⚠️ 原来这里用 `farm.addPoints(9999)` 反复打钱 —— 那个口子已经删了：
  //    积分只能由 App 发（任务/打卡/家长），游戏只能花。
  if (new URLSearchParams(location.search).get("rig")) farm.wallet.free = true;
  // 试玩专用：?rig=farm 现场布置一个住满动物的农场（不写存档之外的数据，模拟数值不变；玩家正常路径碰不到）
  if (new URLSearchParams(location.search).get("rig") === "farm") {
    farm.s.totalHarvests = 24; // 升到 Lv.3：能领养鸭子/乌龟
    for (const id of ["chicken", "chicken", "chicken", "chicken", "duck", "fish", "fish", "turtle"]) farm.adopt(id);
    for (const i of [0, 1, 2]) farm.plant(i, "rose"); // 玫瑰 36s 生长期：试玩有充分窗口观察虫/浇水
    if (dbgWanted.has("pest")) { const c = farm.s.plots[0].crop; if (c) c.pest = true; }
    if (dbgWanted.has("dry")) farm.debugDry();
  }
  // 试玩专用：?rig=pond 升到 Lv.5，鱼塘放入 4 种新鱼（成年+幼体各一），成年那批把出生时间往前拨到已有产出
  if (new URLSearchParams(location.search).get("rig") === "pond") {
    farm.s.totalHarvests = 40;
    for (const id of ["loach", "grasscarp", "mandarinfish", "sturgeon"]) {
      const a = farm.adopt(id); const d = animalById(id);
      if (a) { a.bornAt -= (d.matureMin + d.intervalMin + 1) * MS_PER_FARM_MIN; }
    }
    for (const id of ["loach", "grasscarp", "mandarinfish", "sturgeon"]) farm.adopt(id);
  }
  // 试玩专用：?rig=zoo 牧场放满全部 10 种成年动物（加 &baby 则全为幼体）；鱼塘放乌龟成年+幼体、鲫鱼、锦鲤
  if (new URLSearchParams(location.search).get("rig") === "zoo") {
    farm.s.totalHarvests = 40;
    const babyRig = new URLSearchParams(location.search).has("baby"); // &baby：牧场 10 只全是幼体
    const ranch = ["chicken", "duck", "sheep", "pig", "dog", "cow", "polarbear", "giraffe", "peacock", "ostrich"];
    for (const id of [...ranch, "turtle", "fish", "koi"]) {
      const a = farm.adopt(id); const d = animalById(id);
      if (a && !(babyRig && d.zone === "ranch")) a.bornAt -= (d.matureMin + 1) * MS_PER_FARM_MIN;
    }
    farm.adopt("turtle");
  }
  // 试玩专用：?rig=myth 升到 Lv.6：神兽猫成年（带 1 颗宝珠可收）+ 幼体各一；两头成年奶牛用于对照 5% 光环加速；
// v51 同场加料：玉龙一成年（带 1 颗龙珠可收）一幼体，神圣梧桐直接落户河畔（检验三阶段贴图与余烬）
  if (new URLSearchParams(location.search).get("rig") === "myth") {
    farm.s.totalHarvests = 64;
    const grown = farm.adopt("mythcat");
    if (grown) { const d = animalById("mythcat"); grown.bornAt -= (d.matureMin + d.intervalMin + 1) * MS_PER_FARM_MIN; }
    farm.adopt("mythcat");
    for (const id of ["cow", "cow"]) { const a = farm.adopt(id); const d = animalById(id); if (a) a.bornAt -= (d.matureMin + 1) * MS_PER_FARM_MIN; }
    const yd = animalById("yulong");
    const yAdu = farm.adopt("yulong"); if (yAdu) yAdu.bornAt -= (yd.matureMin + yd.intervalMin + 1) * MS_PER_FARM_MIN;
    farm.adopt("yulong"); // 小玉龙宝宝在塘里戏水
    const tq = new URLSearchParams(location.search).get("tree"); // v52 测试：&tree=1|2 直接把梧桐推到花期/古树
    if (!new URLSearchParams(location.search).has("notree")) { farm.buyWutong(); if (tq && farm.s.wutong) farm.s.wutong.plantedAt -= (tq === "2" ? 1441 : 481) * MS_PER_FARM_MIN; } // &notree：留给商店购买流程测试；神圣梧桐（阶段 0→1→2 需 0/480/1440 农场分钟，可用 playtest step 快进）
  }
  // 鱼跃水花音：起跳/落水各一次机会，3s 最小间隔；音频未解锁时 cue 内部自动不播
  let lastLeapSfxAt = 0;
  view.onLeapSplash = () => {
    const t = performance.now();
    if (t - lastLeapSfxAt < 3000) return;
    lastLeapSfxAt = t; cue("sfx.splash");
  };
  const fxScreen = new PIXI.Container();
  app.stage.addChild(view.backdrop, view.world, fxScreen);
  const fx = await createPixiFx({ PIXI, app, world: view.fxLayer, screen: fxScreen, referenceSpan: 90, onImpulse: () => {} });

  function relayout() {
    const w = app.screen.width, h = app.screen.height;
    const L = ui.layout();
    const colW = L.colW || Math.min(w, Math.max(360, Math.min(600, h * 0.62)));
    view.layout(w, h, Math.min(w, colW), L.top, L.bottom, !L.wide);
  }
  viewReady = true;
  relayout();

  const save = () => {
    void __cfStore.saveGame(farm.s).then(ok => {
      if (!ok) console.warn("autosave rejected");
    });
  };

  // ---- 雨声环境循环：下雨才播、转晴/转阴即停；音频解锁瞬间若正下雨由 afterUnlock 补播 ----
  let rainVoice                = null;
  let rainVoiceBusy = false; // playCue 是异步的：解码期间重入会叠层，用 busy 位挡住
  const syncRainAmbience = () => {
    if (!sound || !soundUnlocked) return;
    const wantRain = (view.debugWx ?? farm.weather()) === "rain";
    if (wantRain && !rainVoice && !rainVoiceBusy) {
      rainVoiceBusy = true;
      void (async () => {
        try {
          const r = await sound .playCue("amb.rain", { eventId: `rain-amb:${cueSeq++}` });
          rainVoice = (r                                  ).instanceId ?? null; // 被冷却压住时 instanceId=null，下一拍重试
        } catch { rainVoice = null; }
        finally { rainVoiceBusy = false; }
      })();
    } else if (!wantRain && rainVoice) {
      try { void sound.stop(rainVoice); } catch { /* 已自行结束 */ }
      rainVoice = null;
    }
  };
  // ---- 昼夜/天气 BGM + 夜虫 + 入夜/清晨提示音：0.5s 刻度评估；音频未解锁时只记录目标、解锁即补播 ----
                                                                    
  let musicPlayed                   = null;
  let nightAmbVoice                = null;
  let nightAmbBusy = false;
  let lastNightBucket                 = null;
  /** 音乐优先级：夜晚(21:00~5:00) > 雨 > 多云 > 黄昏(17:30~19:30) > 默认。调试面板那两条切换即时生效（走同一判定）。 */
  const syncAudioScene = () => {
    const h = view.hour; // 含 ?tod / debugHour 预览值
    const night21 = h >= 21 || h < 5;
    if (lastNightBucket !== null && night21 !== lastNightBucket) cue("sfx.nightchime"); // 很轻的昼夜切换提示音
    lastNightBucket = night21;
    const wx = view.debugWx ?? farm.weather();
    const want            = night21 ? "night" : wx === "rain" ? "rain" : wx === "cloud" ? "cloud" : h >= 17.5 && h < 19.5 ? "evening" : "light";
    if (want !== musicPlayed && sound && soundUnlocked) {
      musicPlayed = want;
      void sound.setMusicState(want, { eventId: `music:${want}:${cueSeq++}` }); // 淡入淡出由 musicStates 的 crossfadeMs 处理
    }
    if (sound && soundUnlocked) {
      if (night21 && !nightAmbVoice && !nightAmbBusy) {
        nightAmbBusy = true; // playCue 是异步的：解码期间重入会叠层
        void (async () => {
          try {
            const r = await sound .playCue("amb.night", { eventId: `night-amb:${cueSeq++}` });
            nightAmbVoice = (r                                  ).instanceId ?? null;
          } catch { nightAmbVoice = null; }
          finally { nightAmbBusy = false; }
        })();
      } else if (!night21 && nightAmbVoice) {
        try { void sound.stop(nightAmbVoice); } catch { /* 已自行结束 */ }
        nightAmbVoice = null;
      }
    }
  };
  afterUnlock = () => { syncRainAmbience(); syncAudioScene(); };
  // —— 入睡/醒来：很轻的一声（节流防夜里全员齐睡时齐响）——
  let lastSnoreAt = 0;
  view.onSleep = (_v, asleep) => {
    const tt = performance.now();
    if (asleep && tt - lastSnoreAt > 1500) { lastSnoreAt = tt; cue("sfx.snore"); }
  };

  // ---- events → feedback ----
  const plotPos = (i        ) => plotCenter(i);
  farm.on(e => {
    switch (e.type) {
      case "change": save(); view.syncAnimals(); view.syncWutong(); break;
      case "planted": { const c = plotPos(e.plot); view.pressPlot(e.plot); fx.play("land-dust", { pos: { x: c.x, y: c.y + 20 }, power: 0.6 }); cue("sfx.plant"); break; }
      case "fertilized": { const c = plotPos(e.plot); fx.play("heal-pulse", { pos: { x: c.x, y: c.y }, power: 0.7 }); cue("sfx.fertilize"); break; }
      case "unlocked": { const c = plotPos(e.plot); view.pressPlot(e.plot); fx.play("shield-break", { pos: { x: c.x, y: c.y - 10 }, power: 0.6 }); cue("sfx.unlock"); break; }
      case "ripe": { const c = plotPos(e.plot); if (visibleWorldY(c.y)) cue("sfx.ripe"); break; }
      case "harvested": {
        const c = plotPos(e.plot);
        if (e.amount === 0) { view.shakePlot(e.plot); view.floatText(c.x, c.y - 40, t("ev.wither"), 0xffffff); fx.play("smoke-puff", { pos: { x: c.x, y: c.y }, power: 0.4 }); cue("sfx.bad"); break; }
        view.floatText(c.x, c.y - 40, `+${e.amount}`, 0xffffff, itemTexKey(e.item));
        if (e.kind === "weather_good") fx.play("confetti-burst", { pos: { x: c.x, y: c.y - 30 }, power: 0.5 });
        else fx.play("pickup-pop", { pos: { x: c.x, y: c.y - 20 }, power: 0.8 });
        if (e.kind === "pest" || e.kind === "disease" || e.kind === "weather_bad") { view.shakePlot(e.plot); cue("sfx.bad"); } else cue("sfx.harvest");
        if (e.mode === "sell" && e.earned > 0) cue("sfx.sell");
        // 发券在 `case "sold"` 里做（卖出是唯一的券来源）。这里只放表现。
        break;
      }
      case "sold": {
        // ★ 卖出 → 兑换券（`src/economy.js`）。
        //   触发点选 `sold` 而不是 `harvested`：孩子卖出去的那一刻才该有券，
        //   「收进背包」不该。`harvest(mode:"sell")` 内部也走 `sellInternal`，
        //   所以那条路同样会发到这里，不存在漏发。
        if (e.earned > 0) {
          void __cfEco?.pay(e.earned, `农场卖出 · ${e.item} ×${e.count}`).then(n => {
            if (n > 0) {
              // 只在真发出去的那一刻提示（含之前欠的），否则孩子会以为每卖一次就该多一张
              ui.event({ type: "toast", k: "toast.voucher", p: { n } });
              cue("sfx.levelup"); // 券到手是「有进展」的音色
            }
          });
        }
        break;
      }
      case "collected": {
        const v = view.animals.get(e.uid); if (!v) break;
        view.hopAnimal(e.uid);
        const pond = v.zone === "pond";
        if (e.amount > 0) view.floatText(v.x, v.y - v.height() - 20, `+${e.amount}`, 0xffffff, itemTexKey(e.item));
        else view.floatText(v.x, v.y - v.height() - 20, t("ev.wither"));
        if (pond) { fx.play("magic-area-ripple", { pos: { x: v.x, y: v.y }, power: 0.5 }); cue("sfx.splash"); }
        else fx.play("pickup-pop", { pos: { x: v.x, y: v.y - v.height() }, power: 0.8 });
        cue("sfx.collect");
        animalCall(v.an.kind);
        break;
      }
      case "adopted": { view.syncAnimals(); const v = view.animals.get(e.uid); if (v) { fx.play("pickup-pop", { pos: { x: v.x, y: v.y - 20 }, power: 0.7 }); if (v.zone === "pond") cue("sfx.splash"); else animalCall(v.an.kind); } break; }
      case "fed": {
        const v = view.animals.get(e.uid); if (!v) break;
        view.wakeAnimal(e.uid);
        if (v.zone === "pond") {
          const p = view.dropFood(e.uid);
          if (p) setTimeout(() => fx.play("magic-area-ripple", { pos: p, power: 0.3 }), 300);
          cue("sfx.pellets");
        } else { view.hopAnimal(e.uid); fx.play("heal-pulse", { pos: { x: v.x, y: v.y - v.height() / 2 }, power: 0.6 }); cue("sfx.feed"); }
        break;
      }
      case "petted": { const v = view.animals.get(e.uid); if (v) { view.wakeAnimal(e.uid); view.hopAnimal(e.uid); fx.play("heal-pulse", { pos: { x: v.x, y: v.y - v.height() / 2 }, power: 0.6 }); } cue("sfx.tap"); break; }
      case "bask": { cue("sfx.tap"); break; }
      case "pestNow": { view.shakePlot(e.plot); cue("sfx.bad"); ui.event({ type: "toast", k: "toast.bugComing" }); break; }
      case "dryNow": { view.shakePlot(e.plot); ui.event({ type: "toast", k: "toast.dryNow" }); break; }
      case "watered": {
        const c = plotPos(e.plot);
        if ((view.debugWx ?? farm.weather()) !== "rain") {
          view.playWater(e.plot); // 水壶倒水动画（纯表现层；雨天不播）——替代旧的白色魔法涟漪，避免遮住土壤变湿
          window.setTimeout(() => view.floatText(c.x, c.y - 40, t("ev.watered")), 1250); // 壶离场后再飘字，不压在水壶上
        } else {
          fx.play("magic-area-ripple", { pos: { x: c.x, y: c.y }, power: 0.5 });
          view.floatText(c.x, c.y - 40, t("ev.watered"));
        }
        cue("sfx.watercan");
        break;
      }
      case "bugCaught": {
        const c = plotPos(e.plot);
        fx.play("pickup-pop", { pos: { x: c.x, y: c.y - 30 }, power: 0.6 });
        view.floatText(c.x, c.y - 40, t("ev.bug"));
        view.floatText(c.x, c.y - 94, `+${e.bonus}`, 0xf5b027, itemTexKey("coin"));
        cue("sfx.bugcatch");
        break;
      }
      case "healed": {
        if (e.bonus && e.bonus > 0) {
          const v = view.animals.get(e.uid);
          if (v) {
            view.floatText(v.x, v.y - v.height() - 24, `+${e.bonus}`, 0xf5b027, itemTexKey("coin"));
            fx.play("heal-pulse", { pos: { x: v.x, y: v.y - v.height() / 2 }, power: 0.7 });
          }
        }
        break;
      }
      case "weather": { cue("sfx.ripe"); if (e.kind === "rain") ui.event({ type: "toast", k: "weather.tip" }); break; }
      case "levelup": { const c = view.toWorld(app.screen.width / 2, app.screen.height * 0.42); fx.play("level-up", { pos: c, power: 1 }); cue("sfx.levelup"); break; }
      case "treebuy": { view.syncWutong(); fx.play("confetti-burst", { pos: { x: WUTONG_SPOT.x, y: WUTONG_SPOT.y - 60 }, power: 0.8 }); cue("sfx.plant"); cue("sfx.levelup"); break; }
      case "sold": cue("sfx.sell"); break;
      case "points": cue("sfx.addpoints"); break;
      case "died": { const v = view.animals.get(e.uid); if (v) fx.play("teleport-light", { pos: { x: v.x, y: v.y - 20 }, power: 0.4 }); break; }
      case "poop": { const v = view.animals.get(e.uid); if (v) view.floatText(v.x, v.y - v.height() - 20, t("ev.poop")); break; }
      case "poopClean": {
        const v = view.animals.get(e.uid);
        if (v) { view.floatText(v.x, v.y - v.height() - 20, t("ev.poopClean")); fx.play("heal-pulse", { pos: { x: v.x, y: v.y - v.height() / 2 }, power: 0.6 }); }
        cue("sfx.sweep");
        break;
      }
    }
    ui.event(e);
    if (e.type === "planted" || e.type === "adopted") applyDbg(); // 调试参数： newly planted/adopted 后补上
  });
  view.onAte = v => {
    fx.play("heal-pulse", { pos: { x: v.x, y: v.y - v.height() / 2 }, power: 0.5 });
    view.floatText(v.x, v.y - v.height() - 16, "❤");
    cue(v.an.kind === "turtle" ? "sfx.munch" : "sfx.splash");
  };
  view.onDisplay = v => {
    cue("sfx.spread");
    fx.play("confetti-burst", { pos: { x: v.x, y: v.y - v.height() }, power: 0.7 });
  };
  view.onBaskArrive = v => {
    fx.play("pickup-pop", { pos: { x: v.x, y: v.y - v.height() * 0.6 }, power: 0.5 });
    if (visibleWorldY(v.y)) cue("sfx.bask");
  };
  const visibleWorldY = (y        ) => y > view.scrollY - 50 && y < view.scrollY + app.screen.height / view.scale + 50;

  // ---- input: drag-scroll with inertia, tap → hit test ----
  const canvas = app.canvas;
  let down                                                         = null;
  let lastY = 0, lastT = 0, moved = false;
  // ---- creek fishing ----
  // v58：下竿费 15 → 8（产出物单价整体降到 1/3 之后跟着降）。
  // v59.1：`fish` 产出 2 → 4 个 —— 原来 L1~4 的期望只有 0.21 券/积分（85% 只钓到 2 个鱼片），
  //   比目录里最差的一项还低一半，也就是「等级越低越亏」。现在 L1~4 = 0.425、L5+ = 0.525，都进带。
  // ⚠️ **数值与概率表在 `data/catalog.js` 的 `FISHING`**，别在这里写死：
  //   它是「积分 → 券」的另一条路，要能被 `scripts/check-economy-table.mjs` 读到。
  //   失败不退钱（原来那个从没被用过的 `FISH_REFUND` 已删）—— 那是下竿的风险成本。
  const FISH_COST = FISHING.cost;
  const fishing = { active: false, x: 0, y: 0, resolveAt: 0 };
  let castSeq = 0;
  function rollCatch()                                     {
    const r = hashRandom(`fish-cast|${Date.now()}|${farm.s.points}|${castSeq}`);
    const lvl = farm.level.level;
    // 档位表在 catalog.js 的 FISHING.rolls（数值闸门要读它，别在这里写死）
    for (const roll of FISHING.rolls) {
      if (r >= roll.below) continue;
      // 等级不够就退回最常见的鱼（低等级钓不到稀有的）
      if (roll.minLevel != null && lvl < roll.minLevel) return FISHING.fallback;
      return roll.catch;
    }
    return FISHING.fallback;
  }
  function startFishing(wx        , wy        ) {
    if (fishing.active) { ui.event({ type: "toast", k: "fishing.casting" }); return false; }
    // 下竿是**花积分**（不是游戏币），走钱包 —— 不够会自己弹提示
    if (!farm.pay(FISH_COST, "溪边钓鱼")) return false;
    castSeq += 1;
    const r0 = hashRandom("fish-wait|" + Date.now() + "|" + castSeq);
    fishing.active = true; fishing.x = wx; fishing.y = wy;
    fishing.resolveAt = farm.now() + 3000 + Math.floor(r0 * 4200);
    view.showBobber(wx, wy);
    cue("sfx.cast");
    return true;
  }
  function resolveFishing() {
    fishing.active = false;
    view.hideBobber();
    const out = rollCatch();
    if (out === "fail") {
      farm.logEvent("log.fishingFail");
      ui.event({ type: "toast", k: "fishing.fail", p: { n: FISH_COST } });
      cue("sfx.bad");
      view.spawnRipple(fishing.x, fishing.y, 16);
    } else {
      // 产出表同样在 catalog.js 的 FISHING.catch（理由同上）
      const { item: bagItem, n: bagN } = FISHING.catch[out];
      farm.s.bag[bagItem] = (farm.s.bag[bagItem] || 0) + bagN;
      farm.logEvent("log.fishingCatch", { c: out });
      farm.emit({ type: "change" });
      cue("sfx.catch");
      ui.event({ type: "toast", k: "fishing.caught", p: { c: out, n: bagN } });
      view.spawnRipple(fishing.x, fishing.y, 22);
      view.spawnRipple(fishing.x, fishing.y, 14);
      view.playCatch(fishing.x, fishing.y);
    }
  }

  canvas.addEventListener("pointerdown", ev => {
    unlockAudio();
    down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
    lastY = ev.clientY; lastT = performance.now(); moved = false; view.vel = 0;
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* synthetic */ }
  });
  canvas.addEventListener("pointermove", ev => {
    if (!down || ev.pointerId !== down.id) return;
    if (!moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) { moved = true; view.dragging = true; }
    if (moved) {
      const now = performance.now(); const dy = ev.clientY - lastY;
      let ny = view.scrollY - dy / view.scale;
      const max = view.maxScroll();
      if (ny < 0 || ny > max) ny = view.scrollY - dy / view.scale * 0.35;
      view.scrollY = ny;
      const dtm = Math.max(1, now - lastT);
      view.vel = view.vel * 0.6 + (-dy / view.scale / (dtm / 1000)) * 0.4;
      lastY = ev.clientY; lastT = now;
    }
  });
  const up = (ev              ) => {
    if (!down || ev.pointerId !== down.id) return;
    const rect = canvas.getBoundingClientRect();
    if (!moved) tap(ev.clientX - rect.left, ev.clientY - rect.top);
    if (performance.now() - lastT > 80) view.vel = 0;
    view.dragging = false; down = null;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", ev => { if (down && ev.pointerId === down.id) { view.dragging = false; down = null; } });
  canvas.addEventListener("wheel", ev => { view.scrollY = Math.max(0, Math.min(view.maxScroll(), view.scrollY + ev.deltaY / view.scale)); view.vel = 0; ev.preventDefault(); }, { passive: false }); // 硬夹在边界内：防止和 world 边缘回弹来回打架颤动
  // 手机轻点会补发一个兼容性 click；弹窗恰好在这一瞬打开时，click 会命中蒙层把弹窗立刻关掉
  //（表现为“点了没反应”）。拦掉画布上的首次 touchstart，让浏览器不再补发 click。
  canvas.addEventListener("touchstart", ev => ev.preventDefault(), { passive: false });

  function tap(sx        , sy        ) {
    const w = view.toWorld(sx, sy);
    const h = view.hit(w.x, w.y);
    (globalThis                           ).__MP_LAST_TAP__ = { sx: Math.round(sx), sy: Math.round(sy), wx: Math.round(w.x), wy: Math.round(w.y), hit: h ? h.type : null };
    if (!h) return;
    if (h.type === "remains") {
      const deadKind = farm.animal(h.uid)?.kind ?? "fish";
      if (farm.removeRemains(h.uid)) {
        view.syncAnimals();
        cue("sfx.collect");
        ui.event({ type: "toast", k: "toast.fishClear", p: { c: deadKind } });
      }
      return;
    }
    if (h.type === "balloon") {
      const r = farm.popBalloon(h.uid);
      if (r) {
        const b = view.balloons.get(h.uid);
        const px = b ? b.x : 200, py = b ? b.y : 300;
        view.balloons.delete(h.uid);
        view.syncAnimals();
        cue("sfx.pop");
        cue("sfx.collect"); // pop 后接一声奖励叮当
        fx.play("confetti-burst", { pos: { x: px, y: py }, power: 0.9 });
        view.floatText(px, py - 40, `+${r.amount} 🪙`, 0xf5b027, itemTexKey("coin"));
      }
      return;
    }
    if (h.type === "plot") return tapPlot(h.i);
    if (h.type === "animal") {
      const an = farm.animal(h.uid); if (!an) return;
      if (an.poopSince != null) { farm.cleanPoop(h.uid); return; } // 拉了粑粑：点它先清理
      const info = farm.animalInfo(an);
      if (info.ready > 0) { farm.collect(h.uid); return; }
      animalCall(an.kind);
      view.wakeAnimal(h.uid);
      view.hopAnimal(h.uid);
      ui.animalTap(h.uid);
      return;
    }
    if (h.type === "zone") { cue("sfx.tap"); ui.zoneTap(h.zone); }
    else if (h.type === "creek") {
      cue("sfx.tap");
      if (fishing.active) { ui.event({ type: "toast", k: "fishing.casting" }); }
      else ui.creekTap(h.x, h.y);
    }
  }
  function tapPlot(i        ) {
    const p = farm.s.plots[i];
    if (!p.unlocked) { farm.unlockPlot(i); return; }
    const cs = p.crop;
    if (!cs) {
      if (game.selectedSeed) farm.plant(i, game.selectedSeed);
      else { cue("sfx.tap"); ui.openSeedsForPlot(i); } // 未选种子：直接为这块地打开选种面板，选完立种
      return;
    }
    if (cs.dead || cs.old) { farm.clearPlot(i); cue("sfx.tap"); return; }
    if (farm.now() >= cs.readyAt) { cue("sfx.tap"); ui.harvestPrompt(i); return; }
    const needs = farm.plotNeeds(cs);
    if (needs.pest) { farm.catchPest(i); return; }
    if (needs.thirsty) { farm.water(i); return; }
    if (farm.fertilize(i)) ui.event({ type: "toast", k: "toast.fertilized" });
  }

  // ---- loop ----
  // ★ 具名而不是内联：卸载时要能 `ticker.remove(tickFn)` 摘干净。
  //   匿名函数摘不掉，ticker 会继续 tick 已销毁的 scene，报一堆错。
  let tickAcc = 0;
  const tickFn = (tk) => {
    const real = Math.min(tk.deltaMS / 1000, 0.066); // v49：切面回前台吃 66ms 顶扣，防频闪/连跳
    view.perf.fps = view.perf.fps * 0.92 + (real > 0 ? 1 / real : 60) * 0.08;
    const scale = fx.update(real);
    const dt = real * scale;
    tickAcc += real; if (tickAcc > 0.5) { tickAcc = 0; farm.tick(); syncRainAmbience(); syncAudioScene(); }
    view.syncAnimals(); // 轻量同步：spent/死亡等驱动气球与残骸换装
    if (fishing.active && farm.now() >= fishing.resolveAt) resolveFishing();
    view.update(dt, !!game.selectedSeed);
  };
  app.ticker.add(tickFn);

  // ---- public game API for the UI layer + tests ----
  const game = {
    farm, view, app, fx, tex,
    /** 积分钱包（探针 / 断言用）：`wallet.snapshot()` 能看出镜像是谁给的 */
    wallet: farm.wallet,
    /** 兑换券桥的快照：`{ paid, pending, enabled }` */
    economy() { return __cfEco ? __cfEco.snapshot() : null; },
    /**
     * 彻底销毁这一局。
     *
     * 插件形态下**必须**有它：宿主切走 tab 就 `unmount()`，不销毁的话
     * WebGL context 不会自己释放 —— 切几次就把浏览器的 context 配额
     * （通常 8~16 个）耗光，之后整个页面包括宿主自己都渲染不出东西。
     * 症状是「玩几次游戏回来整个 App 白屏」，且**不报错**。
     *
     * 顺序有讲究：先摘 ticker（否则 destroy 过程中还在 tick），
     * 再拆 display 的 DOM 包裹，最后才 `app.destroy`。
     */
    async destroy() {
      try { app.ticker.remove(tickFn) } catch { /* 已移除 */ }
      try { app.ticker.stop() } catch { /* 已停 */ }
      try { display.dispose() } catch { /* 已拆 */ }
      try { fx?.destroy?.() } catch { /* 已拆 */ }
      try { app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true }) } catch { /* 已拆 */ }
      if (gameRef.current === game) gameRef.current = null;
      // ★ 调试钩子也要摘掉（2026-10-24 真宿主 e2e 抓到）。
      //   原来只清 `gameRef.current`，`window.__farm` 一直指着**已销毁**的实例：
      //   宿主切走 tab 后它还在，于是「卸载到底跑没跑」这件事在外部**看不出来**
      //   （`window.__farm` 仍存在 ⇒ 判据失效）；再挂载时被覆盖，症状被盖住。
      //   判据是**身份比较**：别人（宿主/别的插件）放的 `__farm` 不许误删。
      // ★ 同上：`__gpPlayable` 也得摘。它留成 true 的后果更阴 ——
      //   **第二次挂载时**任何「等 __gpPlayable」的脚本会立刻通过，
      //   而那时纹理可能还没加载完 ⇒ 假通过。
      if ((globalThis       ).__gpPlayable) { try { delete (globalThis       ).__gpPlayable } catch { /* 只读 */ } }
      if ((globalThis       ).__farm === game) { try { delete (globalThis       ).__farm } catch { /* 只读 */ } }
    },
    selectedSeed: null                 ,
    selectSeed(id               ) { game.selectedSeed = id; },
    relayout,
    scrollToZone(z                            ) { view.scrollTo(z === "ranch" ? 0 : z === "field" ? FIELD_TOP - 30 : POND_TOP - 20); },
    tapScreen: tap,
    startFishing(x        , y        ) { return startFishing(x, y); },
    fishingActive() { return fishing.active; },
    fishCost() { return FISH_COST; },
    display(uid        ) { return view.displayPeacock(uid); },
    displayState(uid        ) { return view.displayState(uid); },
    isSleeping(uid        ) { return view.isSleeping(uid); },
    isNapping(uid        ) { return view.isNapping(uid); },
    cue, sound: () => sound,
    skip(ms        ) { farm.timeOffset += ms; farm.tick(); },
    plotScreen(i        ) { const c = plotCenter(i); return view.toScreen(c.x, c.y); },
  };
  gameRef.current = game;
  window.__farm = game;
  if (new URLSearchParams(location.search).has("playtest")) {
    (globalThis                           ).__MAKEPLAY_PLAYTEST__ = {
      snapshot() {
        return {
          soundUnlocked, soundReady: !!sound, musicState: musicPlayed, nightAmb: !!nightAmbVoice, rainAmb: !!rainVoice, muted: audioPrefsStore.muted,
          points: farm.s.points, level: farm.level.level,
          plots: farm.s.plots.map(p => ({ u: p.unlocked, hasCrop: !!p.crop, needs: farm.plotNeeds(p.crop), ripe: !!p.crop && farm.now() >= p.crop.readyAt, dead: !!p.crop?.dead })),
          animals: farm.s.animals.map(a => ({ uid: a.uid, kind: a.kind, sick: a.sickSince != null })),
          leapCounts: { pond: view.pondLeapsStarted, minnow: view.minnowLeapsStarted },
          waterFx: { started: view.waterFxCount, active: view.waterFxActive },
          perf: view.fps(),
          pondViews: [...view.animals.values()].filter(v => v.zone === "pond").map(v => ({ uid: v.an.uid, kind: v.an.kind, baby: v.isBaby, dead: v.an.dead, leaping: v.leapT >= 0 })),
          hour: view.hour,
          restViews: [...view.animals.values()].map(v => ({ uid: v.an.uid, kind: v.an.kind, zone: v.zone, resting: v.resting, asleep: v.asleep, homing: v.homing, graze: v.graze ? v.graze.kind : null, eating: v.grazeT > 0, x: Math.round(v.x), y: Math.round(v.y), ...(v.an.kind === "yulong" ? { phase: v.yuPhase, phaseT: Math.round(v.yuPhaseT * 10) / 10, nextLeap: Math.round(v.yuNextLeap * 10) / 10, trip: v.yuTrip, wtime: Math.round(view.time * 10) / 10 } : {}) })),
          plotBugs: view.plots.map(v => v.bugs.visible),
          scrollY: Math.round(view.scrollY),
          probe: (q => q ? `${q.type}:${(q                                ).i ?? (q                    ).uid ?? ""}` : null)(view.hit(view.toWorld(88, 120).x, view.toWorld(88, 120).y)),
          lastTap: (globalThis                           ).__MP_LAST_TAP__ ?? null,
        };
      },
      step(ms        ) { game.skip(ms); },
    };
  }
  view.applyScroll();
  window.__gpPlayable = true;
  readyResolvers.forEach(r => r(game));
}

;                   
                                                                                            
                                                                                                           
                                                                                    
                                                                                            
                                                                    
                                                                                                                                                                                                      
  
export const gameRef                           = { current: null };
const readyResolvers                        = [];
export const gameReady = new Promise      (r => readyResolvers.push(r));

// ---- language ----
let manualLang = false;
const langListeners                 = [];
export function onLang(fn            ) { langListeners.push(fn); }
export function setLang(l                    , manual = false) {
  if (manual) manualLang = true;
  setLangCode(l);
  document.documentElement.lang = l === "zh" ? "zh-Hans" : l;
  document.title = t("title");
  langListeners.forEach(f => f());
}

// ---- sound ----
async function initSound() {
  // ★ 移植改动：`./sound.manifest.json` 是相对**文档**的。插件里文档是宿主的，
  //   会去宿主的站点根找这个文件 ⇒ 404。改走 `__cfAsset`。
  //   `baseUrl` 同时得给 —— manifest 里 `packs.main.url` 是 `"sound.pack"`,
  //   它相对的是 **baseUrl** 而不是 manifestUrl（见 vendor/sound.mjs 的 resolveUrl）。
  try {
    const A = (rel) => (globalThis       ).__cfAsset ? (globalThis       ).__cfAsset(rel) : "assets/" + rel;
    const manifestUrl = A("sound.manifest.json");
    // manifest 与 pack 都在 assets/ 下（构建时一起拷进去），baseUrl 取其目录
    const packBase = manifestUrl.replace(/[^/]*$/, "");
    sound = await loadSoundSystem({ manifestUrl, baseUrl: packBase })                    ;
  }
  catch (e) { console.warn("sound init failed", e); }
}
let cueSeq = 0;
let afterUnlock                      = null; // 声音解锁成功后要补一次的动作（如雨声环境循环）
export function cue(id                                                                                                                                                                                                                                                                                                                                                                                                                                                         ) {
  if (!sound || !soundUnlocked) return;
  const eventId = `${id}:${cueSeq++}`;
  void sound.playCue(id         , { eventId });
}
function animalCall(kind        ) {
  if (!sound || !soundUnlocked) return;
  const eventId = `call:${kind}:${cueSeq++}`;
  const d = animalById(kind);
  if (d.zone === "pond") { void sound.playCue("sfx.splash", { eventId }); return; }
  switch (kind) {
    case "chicken": void sound.playCue("animal.chicken", { eventId, seed: eventId }); break;
    case "cow": void sound.playCue("animal.cow", { eventId, seed: eventId }); break;
    case "pig": void sound.playCue("animal.pig", { eventId, seed: eventId }); break;
    case "sheep": void sound.playCue("animal.sheep", { eventId, seed: eventId }); break;
    case "peacock": void sound.playCue("sfx.peacock", { eventId }); break;
    case "ostrich": void sound.playCue("sfx.ostrich", { eventId }); break;
    case "dog": void sound.playCue("animal.dog", { eventId }); break;
    case "mythcat": void sound.playCue("animal.mythcat", { eventId }); break;
    default: void sound.playCue("animal.chick", { eventId }); break;
  }
}
export function unlockAudio() {
  if (soundUnlocked || !sound) return;
  const s = sound;
  // 先不设 soundUnlocked：unlock 失败时下一次手势还能重试（否则整局静音）
  void s.unlock().then(async () => {
    soundUnlocked = true;
    applyAudioPrefs(); // 静音/音量设置随存档恢复后立即生效
    void s.playCue("sfx.water", { eventId: "water-ambience" });
    afterUnlock?.(); // 里面会按当前时刻/天气 setMusicState
  }).catch(e => console.warn("audio unlock failed", e));
}
// ---- 音频解锁监听 ----
//
// ⚠️ 原版挂在 `window` 上。插件里那样是**污染宿主**：用户点宿主的按钮
// 也会去解锁我们的音频，而且卸载后监听还在（没人清）。
// 所以改成：容器存在就挂容器，否则才挂 window（独立网页形态）。
// `pagehide` 是「页面要没了」的信号，只有独立网页需要 —— 插件卸载由 unmount 负责。
//
// ★ 注意：这里**不在模块顶层注册**，而是由 `start()` 调用 `bindAudioUnlock()`。
//   顶层注册的话 `__cfHostEl` 还没赋值（那是 start 里才设的），会挂到 window 上。
let audioUnlockEl = null;
const onAudioUnlock = () => unlockAudio();
function bindAudioUnlock() {
  audioUnlockEl = (globalThis       ).__cfHostEl || window;
  audioUnlockEl.addEventListener("pointerdown", onAudioUnlock, { capture: true });
  audioUnlockEl.addEventListener("keydown", onAudioUnlock, { capture: true });
  if (audioUnlockEl === window) {
    window.addEventListener("pagehide", onPageHideSound, { once: true });
  }
}
const onPageHideSound = () => { void sound?.dispose(); };
function unbindAudioUnlock() {
  try {
    audioUnlockEl?.removeEventListener("pointerdown", onAudioUnlock, { capture: true });
    audioUnlockEl?.removeEventListener("keydown", onAudioUnlock, { capture: true });
    window.removeEventListener("pagehide", onPageHideSound);
  } catch { /* 已摘 */ }
  audioUnlockEl = null;
}
export const soundApi = () => sound;

void qty; void nm;

// ---- 音频设置（音量/静音）：存 settings 槽，不进玩法 autosave ----
const prefListeners                                            = [];
const audioPrefsStore             = { muted: false, music: 0.8, sfx: 1 };
function applyAudioPrefs() { try { sound?.settings.setVolumes({ music: audioPrefsStore.music, sfx: audioPrefsStore.sfx }); sound?.settings.setMuted(audioPrefsStore.muted); } catch { /* 运行时未就绪忽略 */ } }
async function loadAudioPrefs() {
  try {
    const d = await __cfStore.loadSettings();
    if (d && typeof d === "object") {
      if (typeof d.music === "number") audioPrefsStore.music = d.music;
      if (typeof d.sfx === "number") audioPrefsStore.sfx = d.sfx;
      if (typeof d.muted === "boolean") audioPrefsStore.muted = d.muted;
      if (typeof d.barsHidden === "boolean") { audioPrefsStore.barsHidden = d.barsHidden; prefListeners.forEach(fn => fn({ barsHidden: d.barsHidden })); }
      applyAudioPrefs();
    }
  } catch { /* 无宿主/离线：静默用默认 */ }
}
let prefTimer = 0;
async function flushAudioPrefs() {
  try {
    await __cfStore.saveSettings({ ...audioPrefsStore });
  } catch { /* 无宿主/离线：静默 */ }
}
function setAudioPrefs(p                     ) {
  Object.assign(audioPrefsStore, p);
  applyAudioPrefs();
  if (prefTimer) clearTimeout(prefTimer);
  prefTimer = window.setTimeout(() => { prefTimer = 0; void flushAudioPrefs(); }, 1500); // 连调合并一次写
}
/**
 * 音频偏好的生命周期。
 *
 * ⚠️ 这两件事**必须在 `start()` 里做**，不能在模块顶层（2026-10-24 修，两个都是真 bug）：
 *
 * ① 顶层 `window.addEventListener("pagehide", …)` ⇒ 整个包在**没有 DOM 的环境**里
 *    import 就抛 `ReferenceError: window is not defined`。宿主的
 *    `scripts/check-plugin.mjs` 正是在 Node 里 `import()` 一次做静态校验（查导出形状、
 *    manifest 字段、裸说明符），于是那一步直接挂 —— 而浏览器里一切正常，
 *    看着像"校验脚本坏了"。
 * ② 顶层 `void loadAudioPrefs()` 跑的时候 `__cfStore` 还是 **null**（它由 `start()` 注入），
 *    `loadSettings()` 抛 TypeError → 被 catch 吞掉 ⇒ **音量/静音设置从来没被恢复过**，
 *    而且不报错。只有放到 `__cfStore = store` 之后才真的读得到。
 */
let prefsBound = false;
const onPageHidePrefs = () => {
  if (prefTimer) { clearTimeout(prefTimer); prefTimer = 0; }
  void flushAudioPrefs();
};
/** 读一次存档里的音量/静音，并挂上"页面要没了先落盘"的监听。 */
async function bindPrefsLifecycle(standalone) {
  await loadAudioPrefs();
  // `pagehide` 只有独立网页需要（插件卸载由 unmount 负责）
  if (standalone && typeof window !== "undefined" && !prefsBound) {
    window.addEventListener("pagehide", onPageHidePrefs);
    prefsBound = true;
  }
}
function unbindPrefsLifecycle() {
  if (typeof window !== "undefined" && prefsBound) {
    window.removeEventListener("pagehide", onPageHidePrefs);
    prefsBound = false;
  }
}

/**
 * 启动游戏。
 *
 * ## 为什么改成导出一个 start()，而不是模块顶层直接 `boot()`
 *
 * 原版是「import 这个文件 = 立刻开玩」：模块顶层就跑 `boot()`、往
 * `window` 上挂监听、调 `installUi()` 挂到 `document.body`。
 *
 * 插件形态下这行不通：宿主的 `blob:` 模块只是**加载**，什么时候挂载由
 * 宿主决定（用户点 tab 才挂）；而且卸载后要能再挂一次。所以改成：
 *
 * ```js
 * const dispose = await start({ mountTo, store, hero, onReady })
 * ```
 *
 * @param {object} o
 * @param {HTMLElement} o.mountTo  游戏画布和 UI 挂到哪里
 * @param {import('./store.js').Store} o.store 存档后端
 * @param {object|null} [o.host]  宿主 HostApi（插件形态）；独立网页不传
 * @param {(g:any)=>void} [o.onReady] 首帧可玩时回调（宿主拿它解除 loading）
 * @param {()=>void} [o.haptic]    触感回调
 * @returns {Promise<()=>Promise<void>>} 卸载函数
 */
export async function start(o) {
  const { mountTo, store } = o;
  __cfStore = store;
  // 宿主 HostApi 先落地：`boot()` 里的 `new Farm(state, __cfHostApi)` 要用它建积分钱包。
  __cfHostApi = o.host || null;
  // 兑换券桥：即使没有宿主也建一个（`enabled === false`），让未发出的券照常累积。
  __cfEco = await new Economy(o.host || null, store).load();
  // ★ 音量/静音必须在 `installUi()` **之前**读回来：设置页第一眼就得是存档里的值。
  //   （原来这段挂在模块顶层，`__cfStore` 还没注入 ⇒ 永远读不到，见函数注释。）
  await bindPrefsLifecycle(!o.host);
  const prevHost = (globalThis       ).__cfHostEl;
  const prevAsset = (globalThis       ).__cfAsset;
  const prevHaptic = (globalThis       ).__cfHaptic;
  (globalThis       ).__cfHostEl = mountTo;
  (globalThis       ).__cfHaptic = o.haptic || null;
  // ★ 资源解析函数：插件传 `ctx.assetUrl`，独立网页不传（走 "assets/" + rel）。
  //   由这里统一设到全局，`game.js` / `ui.js` 里的 `A()` / `asset()` 都读它。
  //
  // ⚠️ 调用方传进来的 `rel` **一律相对 `assets/`**（`A("sound.manifest.json")`、
  //    `A("chicken-walk/manifest.json")`），因为独立网页那一支就是 `"assets/" + rel`。
  //    所以插件这一支必须自己补 `assets/`。
  //    漏了会去 `/games/<id>/chicken-walk/manifest.json` ⇒ 404；而 404 的正文
  //    （`404 Not Found`）喂给 `res.json()` 抛的是
  //    `SyntaxError: Unexpected non-whitespace character after JSON at position 4`
  //    —— `404` 当数字解析完，第 4 个字符 'N' 就成了"多余内容"。
  //    这个报错完全不像 404，会把人往「JSON 序列化 / 存档坏了」方向带。
  const assetBase = typeof o.assetUrl === "function" ? o.assetUrl : null;
  (globalThis       ).__cfAsset = assetBase
    ? (rel) => assetBase("assets/" + String(rel).replace(/^\.?\//, ""))
    : null;

  if (o.locale) { try { setLang(pickLang(o.locale)); } catch { /* 语言不可用就沿用默认 */ } }

  installUi({
    ui, gameReady, setLang, onLang,
    mountTo,                       // ★ 插件形态传容器；独立网页不传 → 挂 body
    audioPrefs: () => ({ ...audioPrefsStore }),
    setVolumes(v) { setAudioPrefs(v); },
    setMuted(m) { setAudioPrefs({ muted: m }); },
    setPrefs(p) { setAudioPrefs(p); },
    onPrefs(fn) { prefListeners.push(fn); },
  });
  void initSound();
  bindAudioUnlock();

  try {
    await boot();
  } catch (e) {
    console.error("boot failed", e);
    throw e;
  }
  if (o.onReady) o.onReady(gameRef.current);

  // ---- 卸载：把这一轮挂上去的东西全收掉 ----
  //
  // ⚠️ 必须能在「刚建好就被调用」时安全执行（宿主可能在 Promise 落地的
  //   同一拍调 unmount）。所以这里只做**幂等**的清理，不假设任何东西已就绪。
  let disposed = false;
  return async function unmount() {
    if (disposed) return;
    disposed = true;
    try { if (prefTimer) { clearTimeout(prefTimer); prefTimer = 0; } await flushAudioPrefs(); } catch { /* 尽力 */ }
    try { unbindPrefsLifecycle(); } catch { /* 已摘 */ }
    try { await sound?.dispose(); } catch { /* 已释放 */ }
    try { unbindAudioUnlock(); } catch { /* 已摘 */ }
    try { uninstallUi(); } catch { /* 已拆 */ }
    // ★ 未发出的券 + 在途扣款必须**先**落地，再拆游戏：
    //   `destroy()` 会把 `gameRef.current` 清空，之后再想拿 `farm.wallet` 就没门了。
    //   挂在账户上的零头若随卸载丢掉，就是「玩到差一张券，切个 tab 回来归零」
    //   —— 静默、无报错。
    const g = gameRef.current;
    try { await g?.farm?.wallet?.drain(); } catch { /* 尽力 */ }
    try { await __cfEco?.chain; await __cfEco?.flush(); } catch { /* 尽力 */ }
    try {
      if (g && typeof g.destroy === "function") await g.destroy();
    } catch { /* 已拆 */ }
    __cfEco = null;
    __cfHostApi = null;
    (globalThis       ).__cfHostEl = prevHost;
    (globalThis       ).__cfAsset = prevAsset;
    (globalThis       ).__cfHaptic = prevHaptic;
  };
}
