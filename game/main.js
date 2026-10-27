// 値上げで満室 — boot, game loop, save/load, sound, FX.
import * as PIXI from "pixi.js";
import { mountDisplay } from "@makeplay/display";
import { createPixiFx,                } from "@makeplay/fx";
import { loadSoundSystem } from "@makeplay/sound";
                                                            
import { fontStack, getLang, pickLang, setLang, t,           } from "../i18n.js";
import { loadTextures } from "./art.js";
import { loadWalks } from "./walks.js";
import { loadLounge } from "./lounge.js";
import { BuildingView } from "./view.js";
import { Ui, fmtMoney, fmtRate, fmtYen } from "./ui.js";
import { TutorialOverlay,                         } from "./tutorial.js";
import {
  activateBoost, addFloor, applicantsFor, baseRate, buyLounge, canBuild, claimOffline, deserialize, incomePerSec, setFloorsWithTenants as simSetFloors,
  unlockKonbini, unlockTwin, pinInfinite, eventActive, eventOverride, setEventOverride, INF_MONEY, SCORE_CAP, ensureTwinStart, maxFloorsOf, canShutter, closeShutter, digBasement, finishRaid, finishRobbery, isShut, moveIn, reportCrime, reportRobbery as simReportRobbery, warnTenant, newGame, obliterateOne, occupiedCount, pendingAmount, quakeStrike, renovate, repair, repairPlan, shutterPlan, roomRent, rentRange, rentStep, serialize, setRentYen, settleOffline, talk, tick, upgradeCost,
                                
} from "./sim.js";
import { DELEGATE_COST, MAX_FLOORS, MAX_LV, SHOP, TENANT_TYPES, UPGRADE_REP } from "./data.js";
import { KonbiniShift } from "./kbshift.js";
import { KONBINI_MAX_LV, kbCap, kbCustomers, kbRestockCost, kbSellPrice, kbUnit, kbUpgradeCost } from "./konbini.js";
import { fallbackProfile, requestProfile } from "./tenants.js";

const nowSec = () => Date.now() / 1000;
const appEl = document.getElementById("app") ;

// ---- leaderboard score layout (LEADERBOARD.json ruleVersion 6) ----
// The platform caps leaderboard raws at ≤ 1e15, so the rv6 cap raise reuses the low 1e8 field
// (the old flipped TA time — TA abolished, 0 on every new submission) as a tier-2 rent continuation:
//   tier 1 (rent ≤ 9,999,999万円): raw = rentUnits(floor(¥/1e4)) × 1e8 — byte-identical to rv5.
//   tier 2 (rent ≥ ¥1000億): raw = 9,999,999 × 1e8 + min(floor((¥ − ¥1000億)/¥1兆), 99,999,999)
//     — ¥1兆 granularity up to ¥9999京 (raw ≈ 999,999,999,899,999, ≤ maxRaw 999,999,999,999,999).
// Order vs stored rv5 scores is monotone non-decreasing (ties inside one ¥1兆 bucket near the break).
// Accepted corner case: an old score at EXACTLY ¥9,999,999万 with a finished TA bonus can sit above
// a new just-above-ceiling score (needs ceiling-exact rent × TA finish — practically nonexistent).
const BOARD_T1_SIZE = 100000000; // 1e8 — low field (old time field)
const BOARD_T1_MAX_UNITS = 9999999; // ¥9,999,999万 — tier-1 ceiling rent unit
const BOARD_T2_BREAK_YEN = 1e11; // ¥1000億 — tier-2 rent origin
const BOARD_T2_STEP_YEN = 1e12; // ¥1兆 per low-field unit
const BOARD_T2_MAX_UNITS = 99999999;
/** packed submit value: rent descending, time part zero (TA abolished), capped at ¥9999京 */
/** sandbox playtest mode (URL ?playtest=1) — never set for players */
const PLAYTEST = /[?&]playtest=1\b/.test(location.search);
function packBoardScore(rentYen        ) {
  const yen = Math.max(0, rentYen);
  const r1 = Math.floor(yen / 1e4);
  if (r1 <= BOARD_T1_MAX_UNITS) return r1 * BOARD_T1_SIZE;
  const u2 = Math.max(0, Math.min(BOARD_T2_MAX_UNITS, Math.floor((yen - BOARD_T2_BREAK_YEN) / BOARD_T2_STEP_YEN)));
  return BOARD_T1_MAX_UNITS * BOARD_T1_SIZE + u2;
}

// ------------------------------------------------------------------ loading screen (visible after __gpReady)

function buildLoading() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:absolute;inset:0;background:#cfe5f1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:40;transition:opacity .25s";
  const title = document.createElement("div");
  title.style.cssText = `font:800 23px ${fontStack(getLang())};color:#22303d`;
  title.textContent = t("title");
  const dot = document.createElement("div");
  dot.style.cssText = "width:16px;height:16px;border-radius:50%;background:#357ca5";
  const track = document.createElement("div");
  track.style.cssText = "width:210px;height:14px;background:#fbf3dc;border:2px solid #22303d;border-radius:999px;overflow:hidden";
  const fill = document.createElement("i");
  fill.style.cssText = "display:block;height:100%;width:0;background:#ef8354;transition:width .15s linear";
  track.appendChild(fill);
  wrap.append(title, dot, track);
  appEl.appendChild(wrap);
  // the moving element runs on its own timer so a slow file can't freeze it
  let ph = 0;
  const spin = window.setInterval(() => { ph += 0.2; dot.style.transform = `translateY(${-Math.abs(Math.sin(ph)) * 12}px)`; }, 33);
  return {
    progress: (p        ) => { fill.style.width = `${Math.round(p * 100)}%`; },
    done: () => { wrap.style.opacity = "0"; window.clearInterval(spin); window.setTimeout(() => wrap.remove(), 280); },
  };
}

// ------------------------------------------------------------------ boot

async function boot() {
  setLang(pickLang(navigator.language));

  const app = new PIXI.Application();
  try {
    await app.init({ background: 0xcfe5f1, antialias: true, autoDensity: true, resizeTo: appEl });
  } catch (e) {
    console.error("pixi init failed", e);
    return;
  }
  app.canvas.style.cssText = "position:absolute;inset:0;display:block;touch-action:none";
  appEl.appendChild(app.canvas);
  const display = mountDisplay({ orientation: "portrait", host: appEl });
  display.attachPixi(app);

  const loading = buildLoading();
  app.render();
  window.__gpReady = true;

  // ---------------------------------------------------------------- slow work behind the loading screen
  const tex = await loadTextures((p) => loading.progress(p * 0.7));
  const [walks, lounge] = await Promise.all([
    loadWalks().catch((e) => { console.warn("walk packs unavailable", e); return {}; }),
    loadLounge().catch((e) => { console.warn("lounge packs unavailable", e); return {}; }),
  ]);
  loading.progress(1);

  const view = new BuildingView(tex, walks, app.renderer, lounge);
  view.setVacantLabel(t("room.vacant"), fontStack(getLang()));
  // raid feedback: door burst, radio chatter, and the arrest settling in the sim when the van has left
  view.onBreach = (room) => {
    const p = view.roomLocal(room);
    fx.play("smoke-big", { pos: { x: p.x, y: p.y + 8 }, power: 0.9 });
    fx.play("lightning-impact", { pos: { x: p.x, y: p.y }, power: 0.5 });
    void sound?.playCue("police.breach", { eventId: eid("breach") });
    // barricade giving way right after the door is forced (user request)
    setTimeout(() => void sound?.playCue("police.barricade", { eventId: eid("barricade") }), 400);
    fx.play("explosion-impact", { pos: { x: p.x, y: p.y }, power: 0.35 });
  };
  view.onRadio = () => { void sound?.playCue("police.radio", { eventId: eid("radio") }); };
  view.onSiren = (on) => {
    // a steady wail under the whole scene, replacing the one-shot approach siren
    if (on) void sound?.playCue("police.sirenLoop", { eventId: eid("sirenLoop") }).then((r) => { sirenLoop = r?.instanceId ?? null; }).catch(() => {});
    else if (sirenLoop && sound) { void sound.stop(sirenLoop); sirenLoop = null; }
  };
  const raidPhases = new Set        ();
  let lastArrest                                                       = null;
  let robberySquad = false;
  view.onRaidDone = () => {
    const evs             = [];
    if (robberySquad) {
      robberySquad = false;
      finishRobbery(state, evs);
    } else {
      const rep0 = state.rep, m0 = state.money, room0 = state.crime.room;
      finishRaid(state, evs);
      lastArrest = { room: room0, reward: Math.round(state.money - m0), rep: Math.round(state.rep - rep0) };
    }
    if (evs.length) { handle(evs); save(); ui.refreshSheet(); }
  };
  const shaker = new PIXI.Container();
  shaker.addChild(view.backdrop, view.root, view.weather.front);
  app.stage.addChild(shaker);
  const fxScreen = new PIXI.Container();
  app.stage.addChild(fxScreen);
  // コンビニ register shift: a full-screen canvas scene above the building
  let shiftSize = "";
  const shift = new KonbiniShift(tex, {
    konbini: () => state.konbini,
    baseRate: () => baseRate(state),
    residents: () => state.rooms.flatMap((r, i) => (r.occupant ? [{ tex: "tenant_" + r.occupant.kind, room: i + 1 }] : [])),
    tenantTex: () => TENANT_TYPES.map((x) => "tenant_" + x.kind).filter((k) => !!tex[k]),
    earn: (yen) => { state.money += yen; },
    save: () => save(),
    cue: (id) => { void sound?.playCue(id       , { eventId: eid(id) }); },
    music: (m) => { void sound?.setMusicState(m, { eventId: eid("mus") }).catch(() => {}); },
    buzz: (k) => buzz(k),
    moment: (type, score) => { window.dispatchEvent(new CustomEvent("mp:moment", { detail: { type, score } })); },
    fmt: (n) => fmtMoney(n),
    onExit: () => { shaker.visible = true; ui.setSceneHidden(false); ui.update(state, nowSec(), 0.016); showKonbini(); window.dispatchEvent(new CustomEvent("mp:stage")); },
    onRestock: () => {
      const k = state.konbini;
      if (!k) return;
      const cost = kbRestockCost(k, kbUnit(baseRate(state)));
      if (cost <= 0) return;
      if (state.money < cost) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); buzz("warning"); return; }
      state.money -= cost;
      k.stock = kbCap(k);
      void sound?.playCue("renovate.install", { eventId: eid("kbStock") });
      save();
    },
  });
  app.stage.addChild(shift.root);
  function startShift() {
    if (!state.konbini || shift.active) return;
    void sound?.playCue("ui.tap", { eventId: eid("tap") });
    buzz("select");
    if (ui.isSheetOpen) closeSheet();
    ui.setSceneHidden(true);
    shaker.visible = false;
    shiftSize = `${app.screen.width}x${app.screen.height}`;
    shift.open(app.screen.width, app.screen.height);
    window.dispatchEvent(new CustomEvent("mp:stage"));
  }

  let impulse            = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
  const C_DANGER = "#9b3a22";
  let stormAmb                = null;
  let sirenLoop                = null;
  view.weather.onBolt = () => {
    void sound?.playCue("storm.thunder", { eventId: eid("thunder") });
  };
  const fx = await createPixiFx({
    PIXI, app, world: view.fxWorld, screen: fxScreen, referenceSpan: 50,
    onImpulse: (next) => { impulse = next; },
  });

  // ---- autosave boot read: three outcomes
  const S = gp.player.saves;
  await gp.player.ready.catch(() => null);
  let state           ;
  let saveBlocked = false;
  const missiles                                      = [];
  let kick = 0;
  let targetMode = false;
  let aimChip                     = null;
  function setAim(on         ) {
    targetMode = on;
    if (aimChip) { aimChip.remove(); aimChip = null; }
    if (on) {
      const chip = document.createElement("div");
      chip.style.cssText = "position:absolute;left:12px;top:150px;display:flex;align-items:center;gap:8px;background:#22303d;color:#fffaf0;font-weight:800;font-size:13px;border-radius:999px;padding:8px 12px;box-shadow:0 3px 0 rgba(34,48,61,.35)";
      const txt = document.createElement("span");
      txt.textContent = t("adm.aim");
      const x = document.createElement("button");
      x.style.cssText = "min-width:56px;min-height:48px;font-weight:800;font-size:13px;color:#f2b33d";
      x.textContent = t("adm.cancel");
      x.addEventListener("click", () => setAim(false));
      chip.append(txt, x);
      appEl.appendChild(chip);
      aimChip = chip;
    }
  }
  /** a missile targets exactly ONE room and explodes on arrival; the destruction fires at impact */
  function fireMissileAt(room        ) {
    const sp = new PIXI.Sprite(tex.missile);
    sp.anchor.set(0.85, 0.5); sp.scale.set(0.3);
    const { y } = view.roomScreen(room);
    sp.x = app.screen.width + 80;
    sp.y = Number.isFinite(y) ? y : app.screen.height / 2;
    view.weather.front.addChild(sp);
    missiles.push({ sp, room });
    void sound?.playCue("missile.strike", { eventId: eid("missile" + room) });
  }
  const latest = await S.getLatest();
  const parsed = latest ? deserialize(latest.data) : null;
  if (parsed) state = parsed;
  else {
    state = newGame(nowSec());
    // a save exists but couldn't be read (or failed to parse) → play, but never overwrite it this session
    if (latest || (S.lastError && gp.player.user)) saveBlocked = true;
  }
  settleOffline(state, nowSec());

  // ---- sound
  let sound                          = null;
  try { sound = (await loadSoundSystem({ manifestUrl: "./sound.manifest.json" }))                    ; }
  catch (e) { console.warn("sound unavailable", e); }
  let unlocked = false;
  let audioLive = false;
  if (sound) {
    // cues fired by the simulation before the first gesture finishes unlocking are dropped instead of rejecting
    // (the runtime object is frozen, so wrap it in a plain object rather than patching or proxying it)
    const real      = sound;
    const wrap      = {};
    const keys = new Set        ();
    for (let o = real; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      for (const k of Object.getOwnPropertyNames(o)) if (k !== "constructor") keys.add(k);
    }
    for (const k of keys) {
      const v = real[k];
      if (typeof v === "function") wrap[k] = v.bind(real);
      else Object.defineProperty(wrap, k, { get: () => real[k], enumerable: true });
    }
    const rawPlay = real.playCue.bind(real);
    wrap.playCue = (...a       ) => {
      if (!audioLive) return Promise.resolve(null);
      try { return Promise.resolve(rawPlay(...a)).catch(() => null); } catch { return Promise.resolve(null); }
    };
    sound = wrap                    ;
  }
  async function unlockAudio() {
    if (unlocked || !sound) return;
    unlocked = true;
    try {
      await sound.unlock();
      audioLive = true;
      await sound.preload("gameplay");
      await sound.setMusicState("main", { eventId: "session" });
      void sound.playCue("amb.street", { eventId: "amb" });
    } catch (e) { console.warn(e); }
  }
  window.addEventListener("pointerdown", () => { void unlockAudio(); });
  window.addEventListener("keydown", () => { void unlockAudio(); });
  let cueN = 0;
  const eid = (k        ) => `${k}:${++cueN}`;

  // ---- persistence
  function save() {
    if (saveBlocked) return;
    void S.putLatest(serialize(state), "text").then((ok) => {
      if (!ok) console.warn("autosave rejected:", S.lastError);
    });
    publishStatus();
  }

  view.sync(state, false);
  view.setLounge(state.lounge);
  view.setKonbini(!!state.konbini, t("kb.name"));
  view.maxFloors = maxFloorsOf(state);
  if (state.floors > MAX_FLOORS) view.setTwinMode(0);
  const buzz = (k                                             ) => {
    const h = (window       ).gp?.haptics;
    if (!h) return;
    try { if (k === "impact") h.impact("light"); else if (k === "select") h.selection(); else h.notify(k); } catch { /* no motor */ }
  };

  // ---------------------------------------------------------------- screen UI
  let manualLang = false;
  let bgmVol = 0.8, sfxVol = 0.9, muted = false;
  let rankCache                                         = null;

  let taps           = [];
  let lastSubmitted = -1;
  const shareOk = () => !!(window       ).gp?.share?.available;

  function applyLanguage(k      ) {
    setLang(k);
    view.setVacantLabel(t("room.vacant"), fontStack(k));
    view.setKonbini(!!state.konbini, t("kb.name"));
    document.title = t("title");
    ui.applyText();
    if (state.tut === 0) save();
  }

  const ui     = new Ui(appEl, {
    selectRoom: (i) => selectRoom(i),
    closeSheet: () => closeSheet(),
    renovate: (i) => { if (actions.renovate(i)) ui.openSheet(i, state); },
    moveIn: (i, id) => { if (actions.moveIn(i, id)) ui.openSheet(i, state); },
    talk: (i) => {
      if (talk(state, i, nowSec())) {
        // 満足度回復の演出: person hop + pip flash (canvas), hearts + +30 float (DOM), heal pulse
        view.celebrateRoom(i);
        void sound?.playCue("tenant.talk", { eventId: eid("talk") });
        fx.play("heal-pulse", { pos: view.roomLocal(i), power: 0.6 });
        const sc0 = view.roomScreen(i);
        ui.floatText(sc0.x - 14, sc0.y - 22, "♥", "#e8604c");
        ui.floatText(sc0.x + 14, sc0.y - 26, "♥", "#f2b33d");
        ui.floatText(sc0.x, sc0.y - 40, t("msg.satUp", { n: 30 }), "#f2b33d");
        save();
        ui.refreshSheet();
      } else void sound?.playCue("ui.deny", { eventId: eid("deny") });
    },
    claim: () => {
      const amount = actions.claim();
      if (amount > 0) {
        const r = appEl.getBoundingClientRect();
        ui.floatText(r.width / 2, r.height - 110, `+¥${fmtMoney(amount)}`);
        ui.toast(t("msg.offline", { n: fmtMoney(amount) }));
      }
    },
    build: () => {
      const before = state.floors;
      if (actions.build()) {
        if (state.floors > before + 1) twinRose();
        else if (state.floors > MAX_FLOORS) ui.toast(`${t("build.twin")} · ${t("build.done", { n: state.floors - MAX_FLOORS })}`);
        else ui.toast(t("build.done", { n: state.floors }));
        void submitScore();
      } else if (state.floors >= maxFloorsOf(state)) ui.toast(t("build.max"));
    },
    openMenu: () => {
      void sound?.playCue("ui.tap", { eventId: eid("tap") });
      ui.openMenu(state, { bgm: bgmVol, sfx: sfxVol }, muted, gp.pay.available, DELEGATE_COST);
    },
    openRanking: () => { void sound?.playCue("ui.tap", { eventId: eid("tap") }); void openRanking(); },
    // ?playtest=1 only: the sandbox has no gp.pay, so the shop list renders for layout checks (buying still needs gp.pay)
    openShop: () => { void sound?.playCue("ui.tap", { eventId: eid("tap") }); ui.openShop(state, null, gp.pay.available || PLAYTEST, (id) => void buyItem(id)); },
    setLanguage: (k) => {
      manualLang = true;
      applyLanguage(k);
      if (ui) ui.closeModal();
    },
    setVolume: (kind, v) => {
      if (kind === "bgm") bgmVol = v; else sfxVol = v;
      void sound?.settings.setVolumes(kind === "bgm" ? { music: v } : { sfx: v });
    },
    setMuted: (on) => { muted = on; void sound?.settings.setMuted(on); },
    buyDelegate: () => {
      if (state.money < DELEGATE_COST) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return; }
      state.money -= DELEGATE_COST;
      state.delegate = true;
      save();
      ui.toast(t("msg.delegated"));
      ui.openMenu(state, { bgm: bgmVol, sfx: sfxVol }, muted, gp.pay.available, DELEGATE_COST);
    },
    toggleDelegate: (on) => { state.delegate = on; save(); },
    startOver: () => {
      fx.clear();
      closeSheet();
      const hadKb = !!state.konbini, hadTwin = !!state.twin, hadInf = !!state.infBuy, paid = state.delivered.slice();
      state = newGame(nowSec());
      // the コンビニ was bought with platform coins: starting over keeps the store (fresh Lv1) and the delivery ledger
      state.delivered = paid;
      if (hadKb) unlockKonbini(state);
      view.setKonbini(!!state.konbini, t("kb.name"));
      if (hadInf) { state.infBuy = true; pinInfinite(state); }   // paid お金無限 stays
      if (hadTwin) unlockTwin(state);   // paid: held until the new tower 1 reaches 500 floors
      view.setTwinMode(1);
      saveBlocked = false;
      view.resetResidents();
      view.sync(state, false);
      save();
    },
    activity: (i) => view.activityOf(i),
    scrollTop: () => view.scrollToTop(),
    scrollBottom: () => view.scrollToBottom(),
    floorRange: () => ({ lo: view.visibleFloors[0], hi: view.visibleFloors[1], total: view.visibleTower === 2 ? state.floors - MAX_FLOORS : Math.min(state.floors, MAX_FLOORS), scrolling: view.isScrolling }),
    sheetMoved: (open, h) => { view.setSheetHeight(open ? h : 0); view.setSideInset(open ? ui.sidePanelWidth : 0); },
    shopAvailable: () => gp.pay.available || PLAYTEST,
    openRow: (row) => openRow(row),
    buyItem: (id) => void buyItem(id),
    share: () => void share(),
    replayTutorial: () => startTutorial(),
    stormPhase: (phase, shut) => view.setStorm(phase, shut),
    openStorm: () => { void sound?.playCue("ui.tap", { eventId: eid("tap") }); ui.openStorm(state); },
    // counting taps happens at the unlock point (the settings title, see ui.openMenu); this just opens the panel
    debugTap: () => {
      void sound?.playCue("rep.up", { eventId: eid("dbg") }); ui.openDebug(state);
    },
    debugGive: (yen) => {

      state.money += yen;
      save();
      ui.toast("+¥" + fmtMoney(yen));
      void sound?.playCue("coin.claim", { eventId: eid("dbgGive") });
    },
    debugScoreInf: () => {

      // ∞: pin the cumulative rent at exactly ¥9999京 — the ruleVersion-6 hard cap (user decision)
      const cap = 9999 * 1e16;
      state.total = Math.max(state.total, cap);
      state.money = Math.max(state.money, cap); // user: score buttons raise money too
      lastSubmitted = -1;
      save();
      const m1 = t("dbg.scoreApplied", { n: "¥" + fmtMoney(cap) });
      void submitScore().then((ok2) => ui.toast(ok2 ? m1 : t("dbg.scorePending"))).catch(() => {});
    },
    debugScore: () => {

      state.total = Math.max(state.total, 1e18); // ¥100京
      state.money = Math.max(state.money, 1e18);   // user: score buttons raise money too
      lastSubmitted = -1;
      save();
      const m1 = t("dbg.scoreApplied", { n: "¥" + fmtMoney(1e18) });
      void submitScore().then((ok2) => ui.toast(ok2 ? m1 : t("dbg.scorePending"))).catch(() => {});
    },
    adminToggle: (on         ) => {
      state.quake.adminOn = on;
      save();
      ui.setAdminPanel(state);
      void sound?.playCue("ui.tap", { eventId: eid("adm") });
    },
    adminFire: (kind) => {
      if (!state.quake.dlc) return;
      if (kind === "quake" || kind === "missile") {
        if (kind === "missile") {
          // pick-a-target mode: tap a room; the missile hits exactly that one (2026-10-23 user request)
          const cando = state.rooms.some((r) => !r.damaged);
          if (!cando) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return; }
          setAim(true);
          void sound?.playCue("ui.tap", { eventId: eid("aim") });
          ui.toast(t("adm.aim"));
          return;
        }
        // rumble first — the floors go when the shake ends
        if (!state.rooms.some((r) => !r.damaged)) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return; }
        state.quake.warnIn = 2.0;
        void sound?.playCue("quake.hit", { eventId: eid("warn"), pitchSemitones: -6 });
        ui.toast(t("quake.warn"));
        save();
        return;
      }
      if (kind === "typhoon") {
        if (state.storm.phase !== "calm") { ui.toast(t("adm.denyTyphoon")); void sound?.playCue("ui.deny", { eventId: eid("deny") }); return; }
        state.storm.timer = Math.min(state.storm.timer, 1.2);
        void sound?.playCue("ui.tap", { eventId: eid("adm") });
        return;
      }
      let rebuilt = false;
      for (const rm of state.rooms) if (rm.damaged) { rm.damaged = false; rebuilt = true; }
      if (!rebuilt) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return; }
      void sound?.playCue("repair.done", { eventId: eid("admfix") });
      save();
    },
    debugEvent: () => {
      // auto → forced ON → forced OFF → auto (session only)
      setEventOverride(eventOverride === null ? true : eventOverride ? false : null);
      void sound?.playCue("ui.tap", { eventId: eid("dbgEv") });
      buzz("select");
      ui.toast(t("dbg.ev", { m: eventOverride === null ? t("dbg.evAuto") : eventOverride ? t("dbg.evOn") : t("dbg.evOff") }) + (eventActive() ? " ✓" : ""));
    },
    openEvent: () => showEventPopup(),
    debugInfMoney: (on         ) => {
      // cheat お金無限: same cash effect, and (unlike the purchase) the ranked total is held at the ¥9999京 cap
      if (on) {
        if (!state.infCheat) state.infPrev = state.money;
        state.infCheat = true;
        pinInfinite(state);
        lastSubmitted = -1;
        void sound?.playCue("fanfare.full", { eventId: eid("infC") });
        buzz("success");
        const m1 = t("dbg.infOn");
        void submitScore().then((ok2) => ui.toast(ok2 ? m1 : t("dbg.scorePending"))).catch(() => {});
      } else {
        state.infCheat = false;
        if (!state.infBuy) state.money = Math.min(state.infPrev ?? 0, SCORE_CAP);
        state.infPrev = undefined;
        void sound?.playCue("ui.tap", { eventId: eid("infC") });
        buzz("select");
        ui.toast(t("dbg.infOff"));
      }
      save();
    },
    debugTwin: () => {
      if (!openTwin()) ui.toast(t("dbg.twinHave"));
      save();
    },
    twinView: () => ({ on: state.floors > MAX_FLOORS, mode: view.twinView }),
    setTwinView: (m) => {
      void sound?.playCue("ui.tap", { eventId: eid("tap") });
      buzz("select");
      view.setTwinMode(m);
      if (ui.isSheetOpen) closeSheet();
    },
    debugKonbini: () => {
      if (!openKonbiniStore()) ui.toast(t("dbg.kbHave"));
      save();
    },
    openKonbini: () => { void sound?.playCue("ui.tap", { eventId: eid("tap") }); showKonbini(); },
    kbShift: () => startShift(),
    kbRestock: () => {
      const k = state.konbini;
      if (!k) return;
      const unit = kbUnit(baseRate(state));
      const cost = kbRestockCost(k, unit);
      if (cost <= 0) return;
      if (state.money < cost) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); buzz("warning"); ui.toast(t("kb.noMoney")); return; }
      state.money -= cost;
      k.stock = kbCap(k);
      void sound?.playCue("renovate.install", { eventId: eid("kbStock") });
      buzz("impact");
      fx.play("pickup-pop", { pos: view.konbiniLocal(), power: 0.7 });
      ui.toast(t("kb.restocked"));
      save();
      showKonbini();
    },
    kbUpgrade: () => {
      const k = state.konbini;
      if (!k || k.lv >= KONBINI_MAX_LV) return;
      const cost = kbUpgradeCost(k, baseRate(state));
      if (state.money < cost) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); buzz("warning"); ui.toast(t("kb.noMoney")); return; }
      state.money -= cost;
      k.lv += 1;
      void sound?.playCue("floor.build", { eventId: eid("kbUp") });
      buzz("success");
      fx.play("light-hit", { pos: view.konbiniLocal(), power: 0.9 });
      fx.play("confetti-burst", { pos: view.konbiniLocal(), power: 0.45 });
      ui.toast(t("kb.upgraded", { n: k.lv }));
      save();
      showKonbini();
    },
    kbPrice: (p           ) => {
      const k = state.konbini;
      if (!k || k.price === p) return;
      k.price = p;
      void sound?.playCue("ui.tap", { eventId: eid("tap") });
      buzz("select");
      save();
      showKonbini();
    },
    kbAuto: (on         ) => {
      const k = state.konbini;
      if (!k || k.lv < 3) return;
      k.auto = on;
      save();
      showKonbini();
    },
    debugSetFloors: (n        ) => {

      // 2棟目 owned and tower 1 complete: the button fills the 2nd tower up to 500 too
      if (state.twin && state.floors >= MAX_FLOORS) n = MAX_FLOORS + n;
      const before = state.floors;
      if (!simSetFloors(state, Math.min(n, maxFloorsOf(state)))) { ui.toast(t("build.max")); return; }
      if (ensureTwinStart(state)) twinRose();
      n = state.floors > MAX_FLOORS ? state.floors - MAX_FLOORS : state.floors;
      closeSheet();
      save();
      ui.toast(t("build.done", { n }));
    },
    openCrime: () => {
      void sound?.playCue("ui.tap", { eventId: eid("tap") });
      ui.openCrime(state, () => { if (state.rob.phase !== "quiet" && state.rob.room >= 0) view.revealRoom(state.rob.room); else if (state.crime.room >= 0) view.revealRoom(state.crime.room); });
    },
    reportCrime: () => {
      const evs             = [];
      const name = state.rooms[state.crime.room]?.occupant?.name ?? "";
      if (reportCrime(state, evs)) { ui.toast(t("msg.report", { name })); handle(evs); save(); ui.refreshSheet(); }
    },
    reportRobbery: () => {
      const room = state.rob.room;
      if (room < 0 || !simReportRobbery(state)) return;
      ui.toast(t("rob.reported"));
      save();
      ui.refreshSheet();
      robberySquad = true;
      view.endRobbery(true);
      view.startRaid(state, room, t("crime.caught"), t("crime.breach"), ["walk-burglar"]);
    },
    warnTenant: () => {
      const evs             = [];
      if (warnTenant(state, evs)) { handle(evs); save(); ui.refreshSheet(); }
    },
    shutter: (i) => {
      const evs             = [];
      if (closeShutter(state, i, evs)) { handle(evs); save(); }
      else void sound?.playCue("ui.deny", { eventId: eid("deny") });
    },
    repair: (i) => {
      const evs             = [];
      if (repair(state, i, evs)) { handle(evs); save(); ui.openSheet(i, state); }
      else void sound?.playCue("ui.deny", { eventId: eid("deny") });
    },
    shutterAll: () => {
      const plan = shutterPlan(state);
      const evs             = [];
      for (const i of plan.rooms) closeShutter(state, i, evs);
      if (evs.length) { handle(evs); save(); }
    },
    repairAll: () => {
      const evs             = [];
      for (const i of repairPlan(state).rooms) repair(state, i, evs);
      if (evs.length) { handle(evs); save(); }
    },
    setRentYen: (i, yen) => {
      const evs             = [];
      const rg = rentRange(state, i);
      // a typed price outside the room's band is clamped — say so instead of silently changing it
      if (yen < rg.min - rentStep(rg.base) / 2 || yen > rg.max + rentStep(rg.base) / 2) {
        ui.toast(t("rent.clamped", { min: fmtYen(rg.min), max: fmtYen(rg.max) }));
        void sound?.playCue("ui.deny", { eventId: eid("rentClamp") });
      }
      if (setRentYen(state, i, yen, evs)) {
        void sound?.playCue("ui.tap", { eventId: eid("rent") });
        save();
      }
    },
  });
  ui.setAdminPanel(state);
  document.title = t("title");
  window.addEventListener("resize", () => { ui.onResize(); });

  gp.player.ready.then(({ user }) => {
    if (user?.locale && !manualLang) applyLanguage(pickLang(user.locale));
  }).catch(() => {});

  function selectRoom(i        ) {
    void sound?.playCue("ui.tap", { eventId: eid("tap") });
    ui.openSheet(i, state);
    view.setSelection(i);
  }
  function closeSheet() {
    ui.closeSheet();
    view.setSelection(-1);
    view.setSheetHeight(0);
  }

  /** packed rent-first board defined in LEADERBOARD.json (ruleVersion 5); time part always 0 since TA's removal */
  async function submitScore()                   {
    const score = packBoardScore(state.total);
    if (score <= lastSubmitted) return true;
    const r = await gp.player.submitScore(score).catch(() => null);
    if (r && typeof r.rank === "number") { rankCache = { rank: r.rank, score: r.best ?? score }; lastSubmitted = score; publishStatus(); return true; }
    return false;
  }

  async function openRanking() {
    await submitScore();
    const rows = await gp.player.topScores(20, { includeMutual: true }).catch(() => []                      );
    ui.openRanking(rows.map((r, k) => ({ ...r, rank: r.rank ?? k + 1 })), rankCache);
  }

  function openRow(row                  ) {
    if (!row.userId) return;
    const uid = row.userId;
    ui.openPlayerMenu(row.name, async () => {
      ui.openDetails(row.name, row.avatar, row.rank ?? 0, row.score, null);
      const r = await gp.player.status.get(uid).catch(() => null);
      const st = r && r.ok ? r.player.status : null;
      const flat = st ? { ...((st       ).head ?? {}), ...((st       ).stats ?? {}) } : null;
      ui.openDetails(row.name, row.avatar, row.rank ?? 0, row.score, flat);
    }, () => {
      void gp.player.openProfile(uid).then((res) => { if (!res.ok) ui.toast(t("rank.none")); });
    }, gp.player.profileAvailable === true);
  }

  async function share() {
    const g = (window       ).gp;
    let ok = false;
    try {
      const blob = g?.share?.snap ? await g.share.snap() : null;
      if (blob) ok = await g.share.image(blob, { text: `${t("title")} · ¥${fmtMoney(state.total)}` });
    } catch { ok = false; }
    if (!ok) ui.toast(t("btn.shareFail"));
  }

  // ---- shop: deliver on ok, and on every startup deliver anything paid but never handed over
  const ITEMS                                                                                                       = [
    { id: SHOP.lounge.itemId, title: () => t("shop.lounge"), titles: { en: "Sky lounge", zh: "空中休息区", ja: "スカイラウンジ" }, price: SHOP.lounge.price },
    { id: SHOP.boost.itemId, title: () => t("shop.boost"), titles: { en: "Rush boost", zh: "加速道具", ja: "時短ブースト" }, price: SHOP.boost.price },
    { id: SHOP.quake.itemId, title: () => t("shop.quake"), titles: { en: "Disaster pack", zh: "灾害包", ja: "災害パック" }, price: SHOP.quake.price },
    { id: SHOP.konbini.itemId, title: () => t("shop.konbini"), titles: { en: "Convenience store", zh: "便利店", ja: "コンビニ" }, price: SHOP.konbini.price },
    { id: SHOP.twin.itemId, title: () => t("shop.twin"), titles: { en: "Second tower", zh: "第2栋公寓", ja: "2棟目のマンション" }, price: SHOP.twin.price },
    { id: SHOP.infMoney.itemId, title: () => t("shop.inf"), titles: { en: "Unlimited money", zh: "无限金钱", ja: "お金無限" }, price: SHOP.infMoney.price },
    { id: SHOP.set.itemId, title: () => t("shop.set"), titles: { en: "Store + 2nd tower set", zh: "便利店＋第2栋公寓套装", ja: "コンビニ＋2棟目セット" }, price: SHOP.set.price },
  ];
  /** the 2nd tower has just risen beside the first: frame both, celebrate */
  function twinRose() {
    view.maxFloors = maxFloorsOf(state);
    view.sync(state, true);
    view.setTwinMode(0);
    fx.play("confetti-burst", { pos: view.lobbyLocal(2), power: 0.9 });
    void sound?.playCue("fanfare.full", { eventId: eid("twin") });
    buzz("success");
    ui.toast(t("msg.twin"));
    view.scrollToBottom();
  }
  /** 2棟目 granted (shop delivery or the creator's debug unlock). Before 500 floors it is held until then. */
  function openTwin() {
    const before = state.floors;
    if (!unlockTwin(state)) return false;
    view.maxFloors = maxFloorsOf(state);
    if (state.floors > before) twinRose();
    else { void sound?.playCue("rep.up", { eventId: eid("twinPaid") }); buzz("success"); ui.toast(t("msg.twinPaid")); }
    return true;
  }
  function kbInfo() {
    const k = state.konbini ;
    const br = baseRate(state), occ = occupiedCount(state), unit = kbUnit(br);
    return { cap: kbCap(k), sell: kbSellPrice(k, unit), customers: kbCustomers(k, occ), restock: kbRestockCost(k, unit), upgrade: kbUpgradeCost(k, br), maxLv: KONBINI_MAX_LV, occupied: occ };
  }
  function showKonbini() {
    if (!state.konbini) return;
    if (ui.isSheetOpen) closeSheet();
    ui.openKonbini(state, kbInfo());
  }
  /** コンビニ opens in the lobby (shop delivery or the creator's debug unlock). */
  function openKonbiniStore() {
    if (!unlockKonbini(state)) return false;
    view.setKonbini(true, t("kb.name"));
    fx.play("confetti-burst", { pos: view.konbiniLocal(), power: 0.7 });
    void sound?.playCue("fanfare.full", { eventId: eid("kbOpen") });
    buzz("success");
    ui.toast(t("msg.konbini"));
    view.scrollToBottom();
    return true;
  }
  function deliver(itemId        , purchaseId        ) {
    if (state.delivered.includes(purchaseId)) return;
    state.delivered.push(purchaseId);
    if (state.delivered.length > 60) state.delivered.splice(0, state.delivered.length - 60);
    if (itemId === SHOP.lounge.itemId) {
      buyLounge(state); view.setLounge(true);
      fx.play("confetti-burst", { pos: view.roofLocal(state.floors), power: 0.6 });
      ui.toast(t("msg.lounge"));
    } else if (itemId === SHOP.quake.itemId) {
      state.quake.dlc = true;
      ui.setAdminPanel(state);
      ui.toast(t("msg.quake"));
    } else if (itemId === SHOP.konbini.itemId) {
      openKonbiniStore();
    } else if (itemId === SHOP.twin.itemId) {
      openTwin();
    } else if (itemId === SHOP.infMoney.itemId) {
      // purchased お金無限: cash only — state.total (the ranked number) is never touched here
      if (!state.infBuy) {
        state.infBuy = true;
        pinInfinite(state);
        fx.play("confetti-burst", { pos: view.lobbyLocal(1), power: 0.8 });
        void sound?.playCue("fanfare.full", { eventId: eid("inf") });
        buzz("success");
        ui.toast(t("msg.inf"));
      }
    } else if (itemId === SHOP.set.itemId) {
      // bundle: grant whichever part is still missing (each unlock is a no-op when already owned)
      openKonbiniStore();
      openTwin();
    } else if (itemId === SHOP.boost.itemId) {
      activateBoost(state, nowSec());
      ui.toast(t("shop.boostDesc"));
    }
    save();
  }
  let buying = false;
  async function buyItem(itemId        ) {
    const item = ITEMS.find((x) => x.id === itemId);
    if (!item || buying || !gp.pay.available) return;
    buying = true;
    const r = await gp.pay.purchase({ itemId: item.id, title: item.title(), titles: item.titles, price: item.price });
    buying = false;
    if (r.ok) {
      deliver(itemId, r.purchaseId);
      void gp.pay.ack(r.purchaseId);
      ui.closeModal();
    } else {
      const err = (r            ).error;
      if (err === "disabled" || err === "offline" || err === "bad_request") ui.toast(t("shop.off"));
    }
  }
  async function pendingPurchases() {
    if (!gp.pay.available) return;
    const p = await gp.pay.pending().catch(() => null);
    if (!p || !p.ok) return;
    for (const item of p.items) { deliver(item.itemId, item.purchaseId); void gp.pay.ack(item.purchaseId); }
  }

  // ---- public status for the leaderboard details page (ids + numbers only)
  let statusSent = "";
  let statusTimer = 0;
  function publishStatus() {
    if (!gp.player.user) return;
    const occ = occupiedCount(state);
    const view2 = {
      v: 1,
      head: { floors: state.floors, rooms: state.rooms.length, pct: Math.round((occ / state.rooms.length) * 100) },
      stats: { money: Math.floor(state.money), rep: Math.floor(state.rep), total: Math.floor(state.total) },
    };
    const json = JSON.stringify({ ...view2, stats: { ...view2.stats, money: Math.round(view2.stats.money / 1000) * 1000, total: Math.round(view2.stats.total / 1000) * 1000 } });
    if (json === statusSent) return;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      void gp.player.status.set(JSON.parse(json)).then((r) => { if (r.ok) statusSent = json; }).catch(() => {});
    }, statusSent ? 20000 : 1500);
  }

  // ---------------------------------------------------------------- event → feedback
  function handle(evs            ) {
    for (const e of evs) {
      if (e.type === "kbEmpty") {
        ui.toast(t("kb.empty"));
        void sound?.playCue("ui.deny", { eventId: eid("kbEmpty") });
        buzz("warning");
        continue;
      }
      if (e.type === "kbAuto") {
        const sc = view.konbiniScreen();
        ui.floatText(sc.x, sc.y - 10, "📦 -¥" + fmtMoney(e.cost), "#357ca5");
        continue;
      }
      if (e.type === "renovate") {
        view.flashRoom(e.room);
        const p = view.roomLocal(e.room);
        fx.play("smoke-puff", { pos: { x: p.x, y: p.y + 30 }, power: 0.7 });
        fx.play("light-hit", { pos: { x: p.x, y: p.y - 10 }, power: 0.8 });
        void sound?.playCue("renovate.install", { eventId: eid("renovate"), pitchSemitones: (e.lv - 2) * 2 });
        const sc = view.roomScreen(e.room);
        ui.floatText(sc.x, sc.y - 14, `Lv${e.lv}`, "#357ca5");
        ui.toast(t("msg.repUp", { n: UPGRADE_REP[e.lv] }));
      } else if (e.type === "movein") {
        const p = view.roomLocal(e.room);
        fx.play("pickup-pop", { pos: { x: p.x, y: p.y }, power: 0.9 });
        void sound?.playCue("tenant.movein", { eventId: eid("movein") });
        ui.toast(t("msg.movein", { name: state.rooms[e.room].occupant?.name ?? "" }));
      } else if (e.type === "moveout") {
        const p = view.roomLocal(e.room);
        fx.play("smoke-puff", { pos: { x: p.x, y: p.y }, power: 0.45 });
        void sound?.playCue("tenant.moveout", { eventId: eid("moveout") });
        ui.toast(t("msg.leave", { name: e.name }));
      } else if (e.type === "quake") {
        kick = 1.6;
        void sound?.playCue("quake.hit", { eventId: eid("quake") });
        ui.toast(t("quake.toast", { n: e.band, n2: e.count ?? e.rooms.length }));
        for (const ri of e.rooms) {
          const lp = view.roomLocal(ri);
          fx.play("ground-impact", { pos: lp, power: 0.9 });
          fx.play("land-dust", { pos: lp, power: 0.7 });
          view.rubbleBurst(ri, 5);
        }
      } else if (e.type === "quakeWarn") {
        void sound?.playCue("quake.hit", { eventId: eid("warn"), pitchSemitones: -6 });
        ui.toast(t("quake.warn"));
      } else if (e.type === "forecast") {
        void sound?.playCue("storm.warning", { eventId: eid("forecast") });
        void sound?.playCue("amb.storm", { eventId: eid("stormAmb") }).then((r) => { stormAmb = r?.instanceId ?? null; }).catch(() => {});
        ui.toast(t("storm.toastForecast"));
      } else if (e.type === "stormStart") {
        void sound?.playCue("storm.shutters", { eventId: eid("stormStart") });
        ui.toast(t("storm.toastStart"));
      } else if (e.type === "strike") {
        const p = view.roomLocal(e.room);
        fx.play("smoke-big", { pos: { x: p.x, y: p.y }, power: 1 });
        fx.play("lightning-impact", { pos: { x: p.x, y: p.y - 20 }, power: 0.9 });
        void sound?.playCue("storm.crash", { eventId: eid("strike") });
        ui.floatText(view.roomScreen(e.room).x, view.roomScreen(e.room).y - 16, t("storm.hitText"), C_DANGER);
      } else if (e.type === "stormEnd") {
        if (stormAmb && sound) { void sound.stop(stormAmb); stormAmb = null; }
        void sound?.playCue("ui.tap", { eventId: eid("stormEnd") });
        if (e.damaged > 0) ui.toast(t("storm.toastAfter", { n: e.damaged }));
      } else if (e.type === "repair") {
        const p = view.roomLocal(e.room);
        fx.play("smoke-puff", { pos: { x: p.x, y: p.y }, power: 0.5 });
        void sound?.playCue("repair.done", { eventId: eid("repair") });
      } else if (e.type === "crime") {
        void sound?.playCue("crime.suspicious", { eventId: eid("crime") });
        ui.toast(t("toast.crime", { n: e.room + 1 }));
        view.setAlert(e.room);
      } else if (e.type === "raid") {
        if (!e.reported) ui.toast(t("msg.ignored"));
        void sound?.playCue("police.siren", { eventId: eid("siren") });
        view.setAlert(-1);
        view.startRaid(state, e.room, t("crime.caught"), t("crime.breach"));
      } else if (e.type === "arrest") {
        void sound?.playCue("police.arrest", { eventId: eid("arrest") });
        const sc = view.roomScreen(e.room);
        if (e.reward > 0) {
          ui.floatText(sc.x, sc.y - 18, `+¥${fmtMoney(e.reward)}`, "#c9623a");
          ui.toast(t("msg.arrest", { name: e.name, n: fmtMoney(e.reward) }));
        }
      } else if (e.type === "reform") {
        void sound?.playCue("rep.up", { eventId: eid("reform") });
        ui.toast(t("msg.reform", { name: state.rooms[e.room]?.occupant?.name ?? "" }));
        view.setAlert(-1);
      } else if (e.type === "fled") {
        const p = view.roomLocal(e.room);
        fx.play("smoke-puff", { pos: { x: p.x, y: p.y }, power: 0.5 });
        void sound?.playCue("tenant.moveout", { eventId: eid("fled") });
        ui.toast(t("msg.fled", { name: e.name }));
        view.setAlert(-1);
      } else if (e.type === "crimeClear") {
        view.setAlert(-1);
      } else if (e.type === "apply") {
        void sound?.playCue("ui.tap", { eventId: eid("apply") });
      } else if (e.type === "dig") {
        void sound?.playCue("floor.build", { eventId: eid("dig") });
        ui.toast(t("toast.dig", { n: (e       ).level }));
        view.scrollToBasement();
      } else if (e.type === "build") {
        const r = view.roofLocal(e.floor);
        fx.play("land-dust", { pos: { x: r.x, y: r.y + 120 }, power: 1 });
        fx.play("ground-impact", { pos: { x: r.x, y: r.y + 120 }, power: 0.5 });
        void sound?.playCue("floor.build", { eventId: eid("build") });
      } else if (e.type === "rep" && e.amount > 0) {
        void sound?.playCue("rep.up", { eventId: eid("rep") });
      } else if (e.type === "full") {
        fx.play("confetti-burst", { pos: view.roofLocal(state.floors), power: 1 });
        void sound?.playCue("fanfare.full", { eventId: eid("full") });
        ui.openFullHouse(state, shareOk());
      }
    }
  }

  /** World-space floating text over a room (game feedback, not screen UI). */
  const floaters                                   = [];
  function flashText(i        , str        ) {
    const p = view.roomLocal(i);
    const txt = new PIXI.Text({ text: str, style: { fontFamily: fontStack(getLang()), fontSize: 22, fontWeight: "800", fill: 0xc9623a, stroke: { color: 0xfffaf0, width: 5 }, padding: 6 } });
    txt.anchor.set(0.5);
    txt.position.set(p.x, p.y - 20);
    view.fxWorld.addChild(txt);
    floaters.push({ t: txt, life: 1.1 });
  }

  // at most two profiles in flight; a big building must not fire one AI call per tenancy at once
  let aiBusy = 0;
  async function fetchProfile(i        , since        ) {
    const o = state.rooms[i]?.occupant;
    if (!o || o.since !== since || !o.pending) return;
    if (aiBusy >= 2) { o.pending = false; return; }
    aiBusy++;
    try { await profileCall(i, since); } finally { aiBusy--; }
  }
  async function profileCall(i        , since        ) {
    const o = state.rooms[i]?.occupant;
    if (!o || o.since !== since || !o.pending) return;
    const r = await requestProfile(o.kind, t(`tn.${o.kind}`), i + 1, state.rooms[i].lv);
    const cur = state.rooms[i]?.occupant;
    if (!cur || cur.since !== since) return;
    cur.pending = false;
    if (r) { cur.name = r.name; cur.comment = r.comment; }
    save();
  }
  for (let i = 0; i < state.rooms.length; i++) {
    const o = state.rooms[i].occupant;
    if (o?.pending) void fetchProfile(i, o.since);
  }

  // ---------------------------------------------------------------- actions (named; the UI layer calls these)
  const actions = {
    renovate(i        )          {
      const evs             = [];
      if (!renovate(state, i, nowSec(), evs)) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return false; }
      handle(evs); save();
      return true;
    },
    moveIn(i        , appId        )          {
      const idx = state.applicants.findIndex((a) => a.id === appId);
      const evs             = [];
      const occ = idx >= 0 ? moveIn(state, i, idx, nowSec(), evs) : null;
      if (!occ) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return false; }
      handle(evs); save();
      void fetchProfile(i, occ.since);
      return true;
    },
    build()          {
      const evs             = [];
      // tower is full → the same button digs the next underground tier
      // (2棟目 owned: digs only while tower 1 is framed, otherwise tower 2 grows)
      const twinGrow = !!state.twin && state.floors < maxFloorsOf(state) && !(view.twinView === 1 && state.basement < 5);
      if (state.floors >= MAX_FLOORS && !twinGrow) {
        if (!digBasement(state, evs)) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return false; }
        handle(evs); save();
        return true;
      }
      if (!addFloor(state, evs)) { void sound?.playCue("ui.deny", { eventId: eid("deny") }); return false; }
      view.sync(state, true);
      ui.update(state, nowSec(), 0.016);
      handle(evs); save();
      return true;
    },
    claim()         {
      const amount = claimOffline(state);
      if (amount > 0) {
        void sound?.playCue("coin.claim", { eventId: eid("claim") });
        fx.play("pickup-pop", { pos: view.roofLocal(state.floors), power: 1 });
        save();
      }
      return amount;
    },
  };

  /** Substrate input: tapping a room opens its sheet. `quickAction` stays available for probes. */
  function quickAction(i        ) {
    void sound?.playCue("ui.tap", { eventId: eid("tap") });
    const room = state.rooms[i];
    if (!room.occupant) {
      const elig = applicantsFor(state, i);
      if (elig.length) { actions.moveIn(i, state.applicants[elig[elig.length - 1]].id); return; }
    }
    if (room.lv < MAX_LV && state.money >= upgradeCost(room.lv)) actions.renovate(i);
    else void sound?.playCue("ui.deny", { eventId: eid("deny") });
  }
  let onRoomTap                      = selectRoom;

  // ---------------------------------------------------------------- pointer: tap a room
  let down                                                                                                                     = null;
  app.canvas.addEventListener("pointerdown", (e) => {
    if (shift.active) { down = null; return; }
    const r = app.canvas.getBoundingClientRect();
    down = { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, t: performance.now(), lastY: e.clientY, lastT: performance.now(), vy: 0, dragged: false };
    view.cancelScrollAnim();
  });
  app.canvas.addEventListener("pointermove", (e) => {
    if (!down || down.id !== e.pointerId) return;
    const dy = e.clientY - down.lastY;
    const now = performance.now();
    const dt = Math.max(1, now - down.lastT);
    const r = app.canvas.getBoundingClientRect();
    if (down.dragged || Math.hypot(e.clientX - r.left - down.x, e.clientY - r.top - down.y) > 8) {
      down.dragged = true;
      view.dragBy(dy);
    }
    down.vy = (dy / dt) * 1000;
    down.lastY = e.clientY;
    down.lastT = now;
  });
  const endPointer = (e              ) => {
    if (!down || down.id !== e.pointerId) return;
    const r = app.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const moved = Math.hypot(x - down.x, y - down.y);
    const wasDrag = down.dragged;
    const vy = performance.now() - down.lastT > 120 ? 0 : down.vy;
    down = null;
    if (wasDrag) { view.release(vy); return; }
    if (moved > 14) return;
    const i = view.roomAt(x, y, state.rooms.length);
    if (targetMode) {
      if (i >= 0 && !state.rooms[i].damaged) {
        setAim(false);
        view.revealRoom(i);
        fireMissileAt(i);
      } else if (i < 0) setAim(false);
      else void sound?.playCue("ui.deny", { eventId: eid("deny") });
      return;
    }
    if (i >= 0) onRoomTap(i);
    else if (view.konbiniAt(x, y)) { void sound?.playCue("ui.tap", { eventId: eid("tap") }); buzz("select"); showKonbini(); }
    else if (ui.isSheetOpen) closeSheet();
  };
  app.canvas.addEventListener("pointerup", endPointer);
  app.canvas.addEventListener("pointercancel", endPointer);
  app.canvas.addEventListener("wheel", (e) => { e.preventDefault(); if (shift.active) return; view.scrollBy(e.deltaY * 0.6); }, { passive: false });

  // ---------------------------------------------------------------- lifecycle
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else settleOffline(state, nowSec());
  });
  window.addEventListener("pagehide", () => {
    save();
    void sound?.dispose();
  });

  // ---------------------------------------------------------------- loop
  let loopErrors = 0;
  app.ticker.add(() => {
    try { frame(); } catch (err) {
      if (loopErrors++ < 3) console.error("frame failed", err);
    }
  });
  let kbPop = 0, kbLastSales = state.konbini?.sales ?? 0;
  function frame() {
    const realDt = Math.min(0.05, app.ticker.deltaMS / 1000);
    const timeScale = fx.update(realDt);
    if (display.info.blocked) return;
    if (shift.active) {
      const sz = `${app.screen.width}x${app.screen.height}`;
      if (sz !== shiftSize) { shiftSize = sz; shift.resize(app.screen.width, app.screen.height); window.dispatchEvent(new CustomEvent("mp:stage")); }
      shift.update(realDt);
    }
    const dt = realDt * timeScale;
    const now = nowSec();
    const evs             = [];
    tick(state, dt, now, true, evs);
    if (evs.length) { handle(evs); save(); }
    view.setViewport(app.screen.width, app.screen.height);
  (window       ).__appScreen = app.screen;
    view.maxFloors = maxFloorsOf(state);
    view.update(state, dt);
    if (state.konbini) {
      view.updateKonbini(state.konbini.stock / kbCap(state.konbini), realDt);
      if (ui.konbiniOpen) ui.updateKonbini(state, kbInfo());
      // a little "+¥" over the shop front now and then, so the store visibly earns
      kbPop += dt;
      if (kbPop > 4) {
        kbPop = 0;
        const gain = state.konbini.sales - kbLastSales;
        kbLastSales = state.konbini.sales;
        const sc = view.konbiniScreen();
        if (gain > 0 && sc.y > 80 && sc.y < app.screen.height - 60) ui.floatText(sc.x, sc.y - 8, "+¥" + fmtMoney(gain), "#3f6a35");
      }
    }
    if (state.quake.warnIn > 0) kick = Math.min(1.15, 0.55 + (2.0 - state.quake.warnIn) * 0.55 + Math.random() * 0.25);
    else if (kick > 0) kick = Math.max(0, kick - realDt * 1.1);
    shaker.position.x += (Math.random() - 0.5) * kick * 11;
    shaker.position.y += (Math.random() - 0.5) * kick * 8;
    for (let k = missiles.length - 1; k >= 0; k--) {
      const ms = missiles[k];
      ms.sp.x -= 820 * realDt;
      const tp = view.roomScreen(ms.room);
      if (Number.isFinite(tp.y)) ms.sp.y += (tp.y - ms.sp.y) * Math.min(1, 8 * realDt);
      if (ms.sp.x <= (Number.isFinite(tp.x) ? tp.x + 26 : app.screen.width * 0.28)) {
        const lp = view.roomLocal(ms.room);
        fx.play("explosion-impact", { pos: lp, power: 1.2 });
        fx.play("smoke-big", { pos: lp, power: 0.9 });
        fx.play("land-dust", { pos: lp, power: 0.8 });
        view.rubbleBurst(ms.room, 9);
        kick = Math.max(kick, 1.4);
        obliterateOne(state, ms.room, "missile");
        ui.toast(t("missile.hit", { n: ms.room + 1 }));
        void sound?.playCue("quake.hit", { eventId: eid("missileImpact") });
        save();
        ms.sp.destroy();
        missiles.splice(k, 1);
      }
    }
    if (view.raidActive) raidPhases.add(view.raidPhase);
    ui.update(state, now, realDt);
    tutFrame();
    shaker.position.set(impulse.offsetX * 5, impulse.offsetY * 5);
    for (let k = floaters.length - 1; k >= 0; k--) {
      const f = floaters[k];
      f.life -= realDt;
      f.t.y -= realDt * 40;
      f.t.alpha = Math.min(1, f.life * 2);
      if (f.life <= 0) { f.t.destroy(); floaters.splice(k, 1); }
    }
  }

  // ---------------------------------------------------------------- tutorial (GAME_DESIGN §4b)
  const TUT_STEPS = 9;
  let tutF0 = 1;
  const overlay = new TutorialOverlay(ui.tutSlot, () => tutNext(), () => skipTutorial(), (k) => {
    manualLang = true;
    applyLanguage(k);
  });
  /** the vacant room the hands-on steps use, picked when they start */
  let tutRoom = -1;
  let tutLv0 = 0;
  let tutEntered = -2;
  const pickTutRoom = () => {
    for (let i = 0; i < state.rooms.length; i++) if (!state.rooms[i].occupant && state.rooms[i].lv < MAX_LV) return i;
    return -1;
  };
  function setTut(step        ) {
    state.tut = step;
    tutEntered = -2;
    save();
  }
  function tutNext() {
    void sound?.playCue("ui.tap", { eventId: eid("tut") });
    if (state.tut >= TUT_STEPS - 1) { finishTutorial(); return; }
    setTut(state.tut + 1);
  }
  function finishTutorial() {
    state.tut = -1;
    state.hintDone = true;
    overlay.hide();
    save();
  }
  function skipTutorial() {
    void sound?.playCue("ui.tap", { eventId: eid("tut") });
    finishTutorial();
  }
  function startTutorial() {
    closeSheet();
    tutRoom = -1;
    setTut(0);
  }
  /** Runs once when a step becomes current (also after a reload into the middle of the tutorial). */
  function enterTutStep(step        ) {
    tutEntered = step;
    if (step >= 2 && step <= 4) {
      if (tutRoom < 0 || state.rooms[tutRoom]?.lv >= MAX_LV || (step === 2 && state.rooms[tutRoom]?.occupant)) tutRoom = pickTutRoom();
      // replay on a building with no room left to renovate: skip the hands-on part
      if (tutRoom < 0) { setTut(5); return; }
      view.revealRoom(tutRoom);
    }
    if (step === 3) {
      const room = state.rooms[tutRoom];
      tutLv0 = room.lv;
      const cost = upgradeCost(room.lv);
      // the opening gift: a brand-new player never has to wait out the first renovation
      if (!state.tutGift && room.lv === 1 && state.money < cost) {
        const gift = Math.ceil(cost - state.money);
        state.money += gift;
        state.tutGift = true;
        ui.toast(t("tut.gift", { n: gift }));
        void sound?.playCue("coin.claim", { eventId: eid("gift") });
        save();
      }
    }
    if (step === 5) {
      if (tutRoom < 0 || !state.rooms[tutRoom]?.occupant) tutRoom = state.rooms.findIndex((r) => r.occupant);
      if (tutRoom >= 0 && (!ui.isSheetOpen || ui.selectedRoom !== tutRoom)) {
        view.revealRoom(tutRoom);
        ui.openSheet(tutRoom, state);
        view.setSelection(tutRoom);
      }
    }
    if (step === 6) {
      if (tutRoom < 0 || !state.rooms[tutRoom]?.occupant) tutRoom = state.rooms.findIndex((r) => r.occupant);
      tutF0 = state.rooms[tutRoom]?.occupant?.factor ?? 1;
      if (tutRoom >= 0 && (!ui.isSheetOpen || ui.selectedRoom !== tutRoom)) {
        view.revealRoom(tutRoom);
        ui.openSheet(tutRoom, state);
        view.setSelection(tutRoom);
      }
      if (tutRoom < 0) { setTut(7); return; }
    }
    if (step === 7) closeSheet();
  }
  const box = (r                )             => r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  function tutFrame() {
    const step = state.tut;
    if (step < 0 || ui.isModalOpen || display.info.blocked) { overlay.hide(); return; }
    if (tutEntered !== step) { enterTutStep(step); if (state.tut !== step) return; }
    const roomNo = tutRoom + 1;
    const sheetOnRoom = ui.isSheetOpen && ui.selectedRoom === tutRoom;
    const roomBox = () => tutRoom >= 0 ? view.roomScreenRect(tutRoom) : null;
    const sheetBox = () => box(ui.tutTarget("sheet"));
    let f                            ;
    switch (step) {
      case 0:
        f = { key: "0", title: t("tut.welcomeT"), body: t("tut.welcome"), target: null, avoid: null, next: t("tut.start"), showLangs: true };
        break;
      case 1:
        f = { key: "1", title: t("tut.incomeT"), body: t("tut.income"), target: box(ui.tutTarget("money")), avoid: null, next: t("tut.next"), showLangs: false };
        break;
      case 2: {
        // any vacant room the player opens counts
        if (ui.isSheetOpen && ui.selectedRoom >= 0 && !state.rooms[ui.selectedRoom].occupant && state.rooms[ui.selectedRoom].lv < MAX_LV) {
          tutRoom = ui.selectedRoom;
          setTut(3);
          return;
        }
        f = { key: `2:${roomNo}`, title: t("tut.tapT"), body: t("tut.tap", { n: roomNo }), target: roomBox(), avoid: null, next: null, showLangs: false };
        break;
      }
      case 3: {
        const room = state.rooms[tutRoom];
        if (!room) { setTut(5); return; }
        if (room.lv > tutLv0) { setTut(4); return; }
        f = sheetOnRoom
          ? { key: "3", title: t("tut.renovateT"), body: t("tut.renovate"), target: box(ui.tutTarget("up")), avoid: sheetBox(), next: null, showLangs: false }
          : { key: `3r:${roomNo}`, title: t("tut.renovateT"), body: t("tut.reopen", { n: roomNo }), target: roomBox(), avoid: null, next: null, showLangs: false };
        break;
      }
      case 4: {
        const room = state.rooms[tutRoom];
        if (!room) { setTut(5); return; }
        if (room.occupant) { setTut(5); return; }
        // keep one eligible applicant waiting for the whole step
        const elig = applicantsFor(state, tutRoom);
        if (!elig.length) {
          state.applicants.push({ kind: "student", premium: false, bornAt: nowSec(), id: state.nextAppId++ });
          if (state.applicants.length > 8) state.applicants.shift();
        } else for (const k of elig) state.applicants[k].bornAt = nowSec();
        f = sheetOnRoom
          ? { key: "4", title: t("tut.moveInT"), body: t("tut.moveIn"), target: box(ui.tutTarget("movein")), avoid: sheetBox(), next: null, showLangs: false }
          : { key: `4r:${roomNo}`, title: t("tut.moveInT"), body: t("tut.reopen", { n: roomNo }), target: roomBox(), avoid: null, next: null, showLangs: false };
        break;
      }
      case 5:
        f = { key: "5", title: t("tut.satT"), body: t("tut.sat"), target: box(ui.tutTarget("sat")), avoid: sheetBox(), next: t("tut.next"), showLangs: false };
        break;
      case 6: {
        const o = state.rooms[tutRoom]?.occupant;
        if (!o) { setTut(7); return; }
        if (Math.abs((o.factor || 1) - tutF0) > 1e-6) { setTut(7); return; }
        f = sheetOnRoom
          ? { key: "6", title: t("tut.rentT"), body: t("tut.rent"), target: box(ui.tutTarget("rent")), avoid: sheetBox(), next: null, showLangs: false }
          : { key: `6r:${roomNo}`, title: t("tut.rentT"), body: t("tut.reopenRent", { n: roomNo }), target: roomBox(), avoid: null, next: null, showLangs: false };
        break;
      }
      case 7:
        f = { key: "7", title: t("tut.buildT"), body: t("tut.build"), target: box(ui.tutTarget("build")), avoid: null, next: t("tut.next"), showLangs: false };
        break;
      default:
        f = { key: "8", title: t("tut.awayT"), body: t("tut.away"), target: box(ui.tutTarget("gear")), avoid: null, next: t("tut.finish"), showLangs: false };
    }
    overlay.show({ ...f, progress: t("tut.progress", { n: Math.min(step, TUT_STEPS - 1) + 1, m: TUT_STEPS }) }, app.screen.width, app.screen.height);
  }

  /** 1000プレイ記念 thank-you popup (shown once per player during the event; the banner reopens it) */
  function showEventPopup() {
    void sound?.playCue("fanfare.full", { eventId: eid("ev1k") });
    buzz("success");
    ui.textOnly("🎉 " + t("ev.title"), t("ev.body"));
  }
  function maybeEventPopup() {
    if (!eventActive() || state.ev1k) return;
    if (state.tut !== -1) { setTimeout(maybeEventPopup, 4000); return; } // not on top of the tutorial
    state.ev1k = true;
    save();
    showEventPopup();
  }

  loading.done();
  window.__gpPlayable = true;
  setTimeout(maybeEventPopup, 1200);
  ui.update(state, nowSec(), 0.016);
  if (state.pendingSec >= 10) ui.toast(t("msg.offline", { n: fmtMoney(pendingAmount(state)) }));
  void pendingPurchases();
  void submitScore();
  publishStatus();

  // read-only probe hooks
  window.__debug = {
    get money() { return state.money; },
    get total() { return state.total; },
    get rep() { return state.rep; },
    get floors() { return state.floors; },
    get twin() { return { owned: !!state.twin, mode: view.twinView, visTower: view.visibleTower, vis: view.visibleFloors }; },
    get rate() { return incomePerSec(state, nowSec()); },
    get pending() { return pendingAmount(state); },
    get pendingSec() { return state.pendingSec; },
    get baseRate() { return baseRate(state); },
    get lastSeen() { return state.lastSeen; },
    get canBuild() { return canBuild(state); },
    get rooms() { return state.rooms.map((r) => ({ lv: r.lv, occupied: !!r.occupant, kind: r.occupant?.kind ?? null, name: r.occupant?.name ?? "", comment: r.occupant?.comment ?? "", sat: r.occupant?.sat ?? 0, pending: r.occupant?.pending ?? false, factor: r.occupant?.factor ?? 1, rentYen: r.occupant ? roomRent(state, state.rooms.indexOf(r)) : 0 })); },
    get applicants() { return state.applicants.map((a) => ({ kind: a.kind, premium: a.premium, id: a.id })); },
    get fixtures() { return view.fixtureCounts(); },
    get walkers() { return view.walkerInfo(); },
    get walkVisible() { return view.visibleWalkerSprites(); },
    get walkChildren() { return view.walkLayerChildren(); },
    get lift() { const l = view.lift; return { level: l.level, y: Math.round(l.y), door: l.doorOpen, phase: l.phase, queued: l.queued }; },
    sendOut: (i        , dest                ) => view.startOuting(state, i, dest),
    activity: (i        ) => view.activityOf(i),
    ffResidents: (sec        ) => view.fastForwardResidents(state, sec),
    walkPacks: Object.keys(walks),
    setAutoOutings: (on         ) => { view.autoOutings = on; },
    get scale() { return view.scale; },
    get scrolling() { return view.isScrolling; },
    get cam() { return view.camera; },
    setCam: (v        ) => view.setCamera(v),
    dragBy: (dy        ) => view.dragBy(dy),
    get builtFloors() { return view.builtFloors(); },
    personKind: (i        ) => view.personKindDrawn(i),
    get saveSize() { return serialize(state).length; },
    get navVisible() { const r = document.querySelector('[aria-label]') ; return Array.from(document.querySelectorAll('button')).filter((x) => x.getAttribute('aria-label') === t('nav.top') && (x.parentElement               ).style.display !== 'none').length > 0; },
    tick: (sec        ) => { const evs             = []; for (let k = 0; k < sec * 10; k++) tick(state, 0.1, nowSec(), true, evs); handle(evs.filter((e) => e.type !== 'full')); return evs.length; },
    setDelegate: (on         ) => { state.delegate = on; },
    /** Probe-only: place an occupant without sound, AI or a save. */
    fill: (i        , kind        , lv        ) => {
      const room = state.rooms[i];
      if (!room) return false;
      room.lv = lv;
      const p = fallbackProfile(kind       , i + 1);
      room.occupant = { kind: kind       , premium: false, name: p.name, comment: p.comment, sat: 100, since: nowSec(), talkAt: 0, factor: 1, pending: false };
      return true;
    },
    get visibleBuilt() { return view.visibleBuiltFloors(); },
    get frame() { return view.frameInfo(state.floors); },
    get visibleFloors() { return view.visibleFloors; },
    get topInset() { return view.topInsetPx; },
    get createdAt() { return Date.now(); },
    get geom() {
      const el = document.querySelector("#mpSheet")               ;
      const r = el.getBoundingClientRect();
      return {
        vw: innerWidth, vh: innerHeight, scale: view.scale,
        screen: { w: (window       ).__appScreen?.width, h: (window       ).__appScreen?.height },
        sheet: { top: Math.round(r.top), h: Math.round(r.height) },
        bodyScroll: document.querySelector(".sheet-body")?.scrollHeight,
        bodyClient: document.querySelector(".sheet-body")?.clientHeight,
        rail: (document.querySelector(".mp-row.mp-hit")               )?.getBoundingClientRect().top,
      };
    },
    roomScreen: (i        ) => view.roomScreen(i),
    get tut() { return state.tut; },
    get gesturing() { return view.gesturingCount(); },
    spot: (i        ) => view.personSpot(i),
    get movePicks() { return view.movePicksCount; },
    ffSpots: (sec        ) => view.ffSpots(sec),
    /** probe: set a room's rent in yen through the same sim path the sheet uses */
    setRentYenProbe: (i        , yen        ) => setRentYen(state, i, yen, []),
    forceGesture: (i        ) => view.forceGesture(i),
    get tutRoom() { return tutRoom; },
    get tutVisible() { return overlay.visible; },
    get tutGift() { return state.tutGift; },
    tutSkip: () => skipTutorial(),
    tutReplay: () => startTutorial(),
    get crime() { const c = state.crime; return { phase: c.phase, timer: c.timer, room: c.room, crime: c.crime, reported: c.reported }; },
    crimeIn: (sec        ) => { state.crime.timer = sec; },
    get raid() { return { active: view.raidActive, phase: view.raidPhase, arrested: view.raidArrested }; },
    /** probe: every raid phase seen since the last reset, and the last settled arrest */
    get raidLog() { return { phases: [...raidPhases], last: lastArrest }; },
    warnRoll: (roll        ) => { const evs             = []; const r = warnTenant(state, evs, roll); handle(evs); return r; },
    get storm() { const st = state.storm; return { phase: st.phase, timer: st.timer, shut: [...st.shut], strikesLeft: st.strikesLeft, count: st.count, damaged: state.rooms.map((r, i) => (r.damaged ? i : -1)).filter((i) => i >= 0), weather: view.weather.level }; },
    /** probe: jump the typhoon clock (seconds left in the current phase) */
    stormIn: (sec        ) => { state.storm.timer = sec; },
    get rubble() { return view.rubbleCount(); },
    get aim() { return targetMode; },
    /** probe: run the exact purchase-delivery code for the quake DLC (pay API is unavailable in playtest) */
    grantDlc: () => { deliver(SHOP.quake.itemId, "probe" + Date.now()); },
    /** probe: run the exact shop-delivery path for the コンビニ */
    grantKonbini: () => { deliver(SHOP.konbini.itemId, "probe-kb" + Date.now()); },
    /** probe: run the exact shop-delivery path for the コンビニ＋2棟目 set */
    grantInf: () => { deliver(SHOP.infMoney.itemId, "probe-inf" + Date.now()); },
    get scoreState() { return { money: state.money, total: state.total, infBuy: !!state.infBuy, infCheat: !!state.infCheat, lastSubmitted }; },
    grantSet: () => { deliver(SHOP.set.itemId, "probe-set" + Date.now()); },
    get konbini() { return state.konbini ? { ...state.konbini, cap: kbCap(state.konbini), inView: view.hasKonbini } : null; },
    get konbiniInView() { return view.hasKonbini; },
    konbiniScreen: () => view.konbiniScreen(),
    get shift() { return shift.snapshot(); },
    startShift: () => startShift(),
    quakeIn: (sec        ) => { state.quake.quakeIn = sec; },
    get quake() { return { dlc: state.quake.dlc, adminOn: state.quake.adminOn, in: state.quake.quakeIn, warnIn: state.quake.warnIn }; },
    get basement() { return state.basement; },
    scrollBasement: () => view.scrollToBasement(),
    visitNow: () => view.startVisitNow(state),
    get visit() { return view.visitPhase(); },
    get kick() { return kick; },
    setMoney: (v        ) => { state.money = v; },
    get scoreDebug() { return { total: state.total, score: packBoardScore(state.total), lastSubmitted, rankCache }; },
    setRep: (v        ) => { state.rep = v; },
    setSat: (i        , v        ) => { const o = state.rooms[i].occupant; if (o) o.sat = v; },
    setLastSeen: (sec        ) => { state.lastSeen = sec; },
    settle: () => settleOffline(state, nowSec()),
    giveApplicant: (kind        ) => { state.applicants.push({ kind: kind       , premium: false, bornAt: nowSec(), id: 9000 + state.applicants.length }); return state.applicants.at(-1) .id; },
    ui,
    version: 3,
    actions,
    build: () => actions.build(),
    /** Probe-only: wipe the autosave and start a clean run. */
    freshGame: () => {
      state = newGame(nowSec());
      view.resetResidents();
      view.sync(state, false);
      view.setLounge(false);
      saveBlocked = false;
      save();
      return state.rooms.length;
    },
    save,
  };
}

void boot();
