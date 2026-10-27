// Screen-space UI layer: title, pause/settings, deck viewer, result, toasts, language picker.
// Tokens come verbatim from UI_CONTRACT.md §1. The gameplay scenes stay in game.ts (canvas).
import { LANGS, LANG_NAMES, t, setLang, lang, onLangChange, cardName, cardText, enemyName, tagName } from "./i18n.js";
                                      

// ---- tokens (UI_CONTRACT.md §1) ----
const TOKEN = {
  background: "#344657",
  surface: "#fbf3dc",
  surfaceAlt: "#f1db9e",
  text: "#1d232b",
  textOnDark: "#fbf3dc",
  muted: "#729b60",
  accent: "#357ca5",
  accentWarm: "#ef8354",
  gold: "#e8b839",
  danger: "#d64933",
  success: "#729b60",
  purple: "#7b5ea7",
};

                                                  
                                                   
                                                                                                           
                              
               
                
                
                 
                       
                 
                    
                    
                  
               
 
                          
                                                           
                                                                                                                       
                    
                                               
                     
                    
                      
                   
                             
                     
                       
                        
                 
                                                          
               
                                                          
                                          
 

                         
                                    
                      
                       
                         
                            
                            
                        
                                 
                             
                                 
                             
                             
                                 
                                 
                                                                  
                    
 

let host        ;
let model         ;
let root                ;
let hostEl             ;
let display                                          = { safeTop: 0, safeBottom: 0 };
let toastTimer = 0;

// ---------- helpers ----------
const el =                                        (tag   , cls         , text         ) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
function panel(cls = "")                 {
  const p = el("div", "mp-panel " + cls);
  p.setAttribute("data-mp-round", "");
  return p;
}
/** A real <button> so the 48px/contrast/focus audits can measure it. */
function btn(label        , kind                                         , onTap            , w         )                    {
  const b = el("button", "mp-btn mp-" + kind, label);
  b.type = "button";
  if (w) b.style.width = w;
  b.addEventListener("pointerdown", () => { b.classList.add("down"); });
  b.addEventListener("pointerup", () => b.classList.remove("down"));
  b.addEventListener("pointerleave", () => b.classList.remove("down"));
  b.addEventListener("click", () => { host.click(); onTap(); });
  return b;
}
function modal(children               , cls = "")                 {
  const back = el("div", "mp-modal");
  const p = panel(cls);
  p.setAttribute("data-mp-scroll", "");
  p.style.setProperty("--mp-gap", "12px");
  for (const c of children) p.appendChild(c);
  back.appendChild(p);
  return back;
}
const center = (n             ) => { n.classList.add("mp-center"); return n; };
const row = (children               , cls = "")                 => {
  const r = el("div", "mp-row " + cls);
  children.forEach((c) => r.appendChild(c));
  return r;
};
function head(title        , close             )                 {
  const h = el("div", "mp-head");
  h.appendChild(el("h2", "mp-h2", title));
  if (close) {
    const x = el("button", "mp-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", t("close"));
    x.addEventListener("click", () => { host.click(); close(); });
    h.appendChild(x);
  }
  return h;
}

// ---------- language picker (first screen, direct selection) ----------
function langBar()                 {
  const r = el("div", "mp-langs");
  r.setAttribute("role", "group");
  r.setAttribute("aria-label", t("langLabel"));
  for (const l of LANG_NAMES) {
    const b = el("button", "mp-lang" + (lang() === l.code ? " on" : ""), l.native);
    b.type = "button";
    b.setAttribute("lang", l.code);
    b.setAttribute("aria-pressed", String(lang() === l.code));
    b.addEventListener("click", () => {
      if (lang() === l.code) return;
      host.click();
      setLang(l.code, true);
      render();
    });
    r.appendChild(b);
  }
  return r;
}

// ---------- deck list (shared by the pause menu and the result panel) ----------
function deckListEl(rows           , compact = false)                 {
  const wrap = el("div", "mp-deck" + (compact ? " compact" : ""));
  wrap.setAttribute("data-mp-scroll", "");
  for (const r of rows) {
    const line = el("div", "mp-deckrow");
    const svg = cardThumb(r.id);
    line.appendChild(svg);
    line.appendChild(el("span", "mp-deckname", cardName(r.id)));
    line.appendChild(el("span", "mp-deckn", "×" + r.n));
    wrap.appendChild(line);
  }
  return wrap;
}
/** Rarity-tinted square showing the card's first character — no extra asset needed. */
function cardThumb(id        )                  {
  const s = el("span", "mp-thumb");
  const [, rarity] = cardFacts(id);
  s.style.background = rarity === "UR" ? "linear-gradient(135deg,#ef8354,#e8b839,#729b60,#357ca5,#7b5ea7)" : rarity === "R" ? TOKEN.accent : rarity === "SR" ? TOKEN.gold : TOKEN.surfaceAlt;
  s.textContent = (cardName(id)[0] ?? "?").toUpperCase();
  return s;
}
// card rarity lookup is filled in by the game so ui.ts needn't import the card table
let cardFactsFn                                                  = () => [0, "N", null];
export function setCardFacts(fn                                                                    ) { cardFactsFn = fn; }
function cardFacts(id        )                                                     { return cardFactsFn(id); }

// ---------- screens ----------
const MODE_IDS           = ["normal", "hard", "extreme"];
const modeName = (m        ) => t(m === "normal" ? "modeNormal" : m === "hard" ? "modeHard" : "modeExtreme");
function modePicker()                 {
  const wrap = el("div", "mp-modes");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", t("difficulty"));
  wrap.appendChild(el("div", "mp-modehead", t("difficulty")));
  const r = el("div", "mp-moderow");
  for (const m of MODE_IDS) {
    const on = model.mode === m;
    const b = el("button", "mp-mode" + (on ? " on" : "") + (m === "extreme" ? " ex" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    b.appendChild(el("span", "mp-modename", modeName(m)));
    b.appendChild(el("span", "mp-modedesc", t("modeDesc", model.modes[m].build, model.modes[m].bonus)));
    b.addEventListener("click", () => { host.click(); host.onSetMode(m); });
    r.appendChild(b);
  }
  wrap.appendChild(r);
  return wrap;
}

function titleScreen()                 {
  const s = el("div", "mp-screen mp-titlescreen");
  const col = el("div", "mp-titlecol");
  const h1 = el("h1", "mp-title");
  h1.innerHTML = t("title").replace(/(!\?|！？|？！|？!)/g, "$1<br>");
  col.appendChild(h1);
  col.appendChild(el("p", "mp-tag", t("tagline")));
  col.appendChild(modePicker());
  const acts = el("div", "mp-actions");
  if (model.hasResume) acts.appendChild(btn(t("continue"), "primary", () => host.onStart(false)));
  acts.appendChild(btn(model.hasResume ? t("newRun") : t("start"), model.hasResume ? "plain" : "warm", () => host.onStart(true)));
  col.appendChild(acts);
  col.appendChild(row([
    btn(t("settings"), "primary", () => host.onSettings()),
    btn(t("achievements"), "primary", () => host.onOpenAchievements()),
  ], "mp-split"));
  col.appendChild(row([
    btn(t("tutorial"), "primary", () => host.onOpenTutorial()),
    btn(t("cardList"), "primary", () => host.onOpenCardList()),
  ], "mp-split"));
  col.appendChild(langBar());
  s.appendChild(col);
  return s;
}

// Deck count / tag summary live in the canvas deck panel; the bar only carries pause.
function topBar()                 {
  const b = el("div", "mp-topbar");
  const p = el("button", "mp-iconbtn", "❚❚");
  p.type = "button";
  p.setAttribute("aria-label", t("pause"));
  p.addEventListener("click", () => { host.click(); host.onPause(); });
  b.appendChild(p);
  return b;
}

function pauseScreen()                 {
  const kids                = [
    head(t("paused"), () => host.onResume()),
    btn(t("resume"), "primary", () => host.onResume()),
    btn(t("deckList"), "plain", () => host.onOpenDeckView()),
    row([
      btn(t("settings"), "plain", () => host.onSettings()),
      btn(t("backToTitle"), "danger", () => host.onBackToTitle()),
    ], "mp-split"),
    langBar(),
  ];
  return modal(kids);
}

function settingsScreen()                 {
  const kids                = [head(t("settings"), () => host.onCloseScreen())];
  for (const [bus, label] of [["master", t("master")], ["music", t("music")], ["sfx", t("sfx")]]         ) {
    const line = el("div", "mp-slide");
    line.appendChild(el("label", "mp-slideL", label));
    const r = el("input", "mp-range")                    ;
    r.type = "range";
    r.min = "0"; r.max = "100"; r.step = "5";
    r.value = String(Math.round(model.volumes[bus] * 100));
    r.setAttribute("aria-label", label);
    r.addEventListener("input", () => host.setVolume(bus, Number(r.value) / 100));
    line.appendChild(r);
    kids.push(line);
  }
  const mute = el("label", "mp-check");
  const cb = el("input")                    ;
  cb.type = "checkbox";
  cb.checked = model.muted;
  cb.addEventListener("change", () => host.setMuted(cb.checked));
  mute.appendChild(cb);
  mute.appendChild(el("span", null, t("mute")));
  kids.push(mute);
  kids.push(el("div", "mp-slideL", t("langLabel")));
  kids.push(langBar());
  if (model.phase === "title") kids.push(btn(t("achievements"), "primary", () => host.onOpenAchievements()));
  return modal(kids);
}

function achievementsScreen()                 {
  const kids                = [head(t("achievements"), () => host.onCloseScreen())];
  const a = model.achievements;
  if (a === null) kids.push(el("div", "mp-stat", t("loading")));
  else if (a === "error" || a.length === 0) kids.push(el("div", "mp-stat", t("achUnavailable")));
  else {
    const list = el("div", "mp-deck");
    list.setAttribute("data-mp-scroll", "");
    for (const r of a) {
      const line = el("div", "mp-achrow" + (r.unlocked ? " on" : ""));
      if (r.icon) {
        const img = el("img", "mp-achicon")                    ;
        img.src = r.icon;
        img.alt = "";
        line.appendChild(img);
      } else line.appendChild(el("span", "mp-achicon"));
      const txt = el("div", "mp-achtxt");
      txt.appendChild(el("div", "mp-achname", r.name));
      txt.appendChild(el("div", "mp-achdesc", r.desc));
      line.appendChild(txt);
      line.appendChild(el("span", "mp-achstate", r.unlocked ? t("achUnlocked") : t("achLocked")));
      list.appendChild(line);
    }
    kids.push(list);
  }
  return modal(kids, "tall");
}

// ---------- tutorial ----------
const TUT_PAGES = 6;
/** Page art: p1 = the boss silhouetted (no spoilers), p2 = a gacha 3-pick, p3 = the battle view with the enemy intent, p4 = status cards, p5 = the festival reward. */
const TUT_ART                                     = [
  { srcs: ["assets/enemies/dragon_silhouette.webp"], cls: "contain" },
  { srcs: ["assets/tutorial/gacha_pick.webp"] },
  { srcs: ["assets/cards/hourglass.webp"], cls: "contain" },
  { srcs: ["assets/tutorial/slime_intent.webp"], cls: "contain" },
  { srcs: ["assets/cards/frost.webp", "assets/cards/ember.webp", "assets/cards/warcry.webp"] },
  { srcs: ["assets/cards/fireworks.webp"] },
];
let tutPage = 0;
export function resetTutorial() { tutPage = 0; }
function tutorialScreen()                 {
  const kids                = [head(t("tutorial"), () => host.onCloseScreen())];
  const n = tutPage + 1;
                                                                                                                                                                                
  const kT = ("tut" + n + "Title")          ;
  const kB = ("tut" + n + "Body")          ;
  const art = TUT_ART[tutPage];
  if (art) {
    if (art.srcs.length === 1) {
      const img = document.createElement("img");
      img.className = "mp-tutart" + (art.cls === "dark" ? " mp-tutcontain mp-tutdark" : art.cls === "contain" ? " mp-tutcontain" : "");
      img.src = art.srcs[0];
      img.alt = "";
      kids.push(img);
    } else {
      const trio = el("div", "mp-tuttrio");
      for (const src of art.srcs) {
        const img = document.createElement("img");
        img.className = "mp-tutart";
        img.src = src;
        img.alt = "";
        trio.appendChild(img);
      }
      kids.push(trio);
    }
  }
  kids.push(el("div", "mp-tuttitle", t(kT)));
  kids.push(el("div", "mp-tutbody", t(kB)));
  const nav = row([
    btn(t("tutorialPrev"), "plain", () => { if (tutPage > 0) { tutPage--; render(); } }),
    el("span", "mp-tutpage", t("tutorialPage", n, TUT_PAGES)),
    btn(t("tutorialNext"), "primary", () => { if (tutPage < TUT_PAGES - 1) { tutPage++; render(); } }),
  ], "mp-tutnav");
  kids.push(nav);
  return modal(kids);
}

const TAG_IDS = ["sword", "fire", "thunder", "shield", "holy", "fest"]         ;
let cardFilter                                                = { rarity: null, tag: null };

function chip(label        , on         , onTap            )                    {
  const b = el("button", "mp-chip" + (on ? " on" : ""), label);
  b.type = "button";
  b.setAttribute("aria-pressed", String(on));
  b.addEventListener("click", () => { host.click(); onTap(); render(); });
  return b;
}
function filterRow(label        , chips               )                 {
  const w = el("div", "mp-frow");
  w.appendChild(el("span", "mp-flabel", label));
  const c = el("div", "mp-fchips");
  for (const ch of chips) c.appendChild(ch);
  w.appendChild(c);
  return w;
}

function cardListScreen()                 {
  const kids                = [head(t("cardList"), () => host.onCloseScreen())];
  kids.push(el("div", "mp-note", t("cardRatesIntro")));
  kids.push(filterRow(t("filterRarity"), [
    chip(t("filterAll"), cardFilter.rarity === null, () => { cardFilter.rarity = null; }),
    ...model.cardRates.map((rate) => chip(rate.rarity, cardFilter.rarity === rate.rarity, () => { cardFilter.rarity = rate.rarity; })),
  ]));
  kids.push(filterRow(t("filterTag"), [
    chip(t("filterAll"), cardFilter.tag === null, () => { cardFilter.tag = null; }),
    ...TAG_IDS.map((tg) => chip(tagName(tg), cardFilter.tag === tg, () => { cardFilter.tag = tg; })),
  ]));
  const box = el("div", "mp-deck");
  box.setAttribute("data-mp-scroll", "");
  const visible = model.cardIds.filter((id) => {
    const f = cardFacts(id);
    if (cardFilter.rarity && f[1] !== cardFilter.rarity) return false;
    if (cardFilter.tag && f[2] !== cardFilter.tag) return false;
    return true;
  });
  if (visible.length === 0) box.appendChild(el("div", "mp-stat", t("filterEmpty")));
  for (const rate of model.cardRates) {
    if (cardFilter.rarity && rate.rarity !== cardFilter.rarity) continue;
    if (!visible.some((id) => cardFacts(id)[1] === rate.rarity)) continue;
    const header = el("div", "mp-cardgroup", rate.rarity + "  —  " + t("cardRate", rate.pct));
    box.appendChild(header);
    for (const id of visible.filter((c) => cardFacts(c)[1] === rate.rarity)) {
      const r = el("div", "mp-cardrow");
      const img = document.createElement("img");
      img.className = "mp-cardimg";
      img.src = "assets/cards/" + id + ".webp";
      img.alt = "";
      r.appendChild(img);
      const meta = el("div", "mp-cardmeta");
      const [cost, , tagOf] = cardFacts(id);
      meta.appendChild(el("div", "mp-cardname", cardName(id)));
      const bits = [t("cardCost", cost)];
      bits.push(tagOf ? tagName(tagOf) : t("cardTagNone"));
      meta.appendChild(el("div", "mp-cardsub", bits.join(" ・ ")));
      meta.appendChild(el("div", "mp-carddesc", cardText(id)));
      r.appendChild(meta);
      box.appendChild(r);
    }
  }
  kids.push(box);
  return modal(kids, "tall");
}

function drawPileScreen()                 {
  const n = model.drawPile.length;
  const kids                = [head(t("drawPileTitle", n), () => host.onCloseScreen())];
  if (n === 0) kids.push(el("div", "mp-stat", t("drawPileEmpty")));
  else {
    kids.push(el("div", "mp-note", t("drawPileNote")));
    const rows = groupDeck(model.drawPile).sort((x, y) => cardFacts(x.id)[0] - cardFacts(y.id)[0] || cardName(x.id).localeCompare(cardName(y.id)));
    kids.push(deckListEl(rows));
  }
  kids.push(el("div", "mp-note", t("discardTitle", model.discardCount)));
  return modal(kids, "tall");
}

function discardPileScreen()                 {
  const n = model.discardPile.length;
  const kids                = [head(t("discardPileTitle", n), () => host.onCloseScreen())];
  if (n === 0) kids.push(el("div", "mp-stat", t("discardPileEmpty")));
  else {
    kids.push(el("div", "mp-note", t("discardPileNote")));
    const rows = groupDeck(model.discardPile).sort((x, y) => cardFacts(x.id)[0] - cardFacts(y.id)[0] || cardName(x.id).localeCompare(cardName(y.id)));
    kids.push(deckListEl(rows));
  }
  return modal(kids, "tall");
}

function deckScreen()                 {
  const kids                = [head(t("deckList"), () => host.onCloseScreen()), deckListEl(model.deckRows)];
  return modal(kids, "tall");
}

function resultScreen()                 {
  const r = model.result ;
  const s = el("div", "mp-screen mp-result");
  const p = panel("mp-resultpanel");
  const h = el("h2", "mp-h1 " + (r.win ? "win" : "lose"), r.win ? t("clear") : t("gameOver"));
  p.appendChild(h);
  const stats = el("div", "mp-stats");
  const lines = [
    t("modeLine", modeName(r.mode)),
    t("reachedStage", r.win ? 6 : r.stage),
    t("totalTurns", r.turns),
    t("deckSize", r.deck.length),
  ];
  if (r.mvpId) lines.push(t("mvp", cardName(r.mvpId), r.mvpDmg));
  for (const l of lines) stats.appendChild(el("div", "mp-stat", l));
  p.appendChild(stats);
  p.appendChild(deckListEl(groupDeck(r.deck), true));
  if (r.bestStage > 0) p.appendChild(el("div", "mp-best", t("best", r.bestStage, r.bestTurns) + (r.newest ? "  " + t("newest") : "")));
  const acts = el("div", "mp-actions");
  acts.appendChild(btn(t("again"), "warm", () => host.onRestart()));
  const share = btn(t("share"), "primary", () => { void host.onShare().then((m) => toast(m)); });
  acts.appendChild(share);
  p.appendChild(acts);
  p.appendChild(btn(t("backToTitle"), "plain", () => host.onBackToTitle()));
  s.appendChild(p);
  return s;
}

export function groupDeck(deck          )            {
  const m = new Map                ();
  for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].map(([id, n]) => ({ id, n }));
}

// ---------- render ----------
function render() {
  if (!root || !model) return;
  const keep = root.scrollTop;
  root.replaceChildren();
  root.dataset.phase = model.phase;
  if (model.phase === "title") {
    root.appendChild(titleScreen());
    if (model.screen === "settings") root.appendChild(settingsScreen());
    else if (model.screen === "achievements") root.appendChild(achievementsScreen());
    else if (model.screen === "tutorial") root.appendChild(tutorialScreen());
    else if (model.screen === "cardlist") root.appendChild(cardListScreen());
  } else if (model.phase === "result" && model.result) {
    root.appendChild(resultScreen());
  } else {
    root.appendChild(topBar());
    if (model.screen === "pause" && (model.phase === "build" || model.phase === "bonus" || model.phase === "battle")) root.appendChild(pauseScreen());
    else if (model.screen === "settings") root.appendChild(settingsScreen());
    else if (model.screen === "deck") root.appendChild(deckScreen());
    else if (model.screen === "drawpile") root.appendChild(drawPileScreen());
    else if (model.screen === "discardpile") root.appendChild(discardPileScreen());
  }
  root.scrollTop = keep;
}

export function setVolumes(v                                                , muted         ) {
  model.volumes = v;
  model.muted = muted;
}

export function toast(msg        , ms = 2600) {
  const box = document.getElementById("mp-toasts");
  if (!box) return;
  const n = el("div", "mp-toast", msg);
  box.appendChild(n);
  requestAnimationFrame(() => n.classList.add("in"));
  clearTimeout(toastTimer);
  const off = () => { n.classList.remove("in"); setTimeout(() => n.remove(), 300); };
  setTimeout(off, ms);
}

export function mountUi(h             , m         , uh        , d                                         ) {
  hostEl = h; model = m; host = uh; display = d;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  root = el("div", "mp-ui");
  root.id = "mp-ui";
  const toasts = el("div", "mp-toasts");
  toasts.id = "mp-toasts";
  hostEl.appendChild(root);
  hostEl.appendChild(toasts);
  onLangChange(() => render());
  render();
}

export function updateUi(m                  ) {
  Object.assign(model, m);
  render();
}

// ---------- styles (tokens verbatim from UI_CONTRACT.md §1) ----------
const CSS = `
.mp-ui, .mp-ui *, .mp-toasts * { box-sizing: border-box; }
.mp-ui { position: fixed; inset: 0; pointer-events: none; z-index: 20;
  font-family: "Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif;
  font-weight: 800; color: ${TOKEN.text}; }
.mp-ui button, .mp-ui input, .mp-ui .mp-panel { pointer-events: auto; }
.mp-screen { position: absolute; inset: 0; display: flex; }
.mp-titlescreen { align-items: center; padding: 4vmin; }
.mp-titlecol { width: min(92vw, 560px); display: flex; flex-direction: column; gap: 14px; }
.mp-title { margin: 0; font-size: clamp(28px, 7.4vmin, 52px); line-height: 1.08; letter-spacing: -0.5px;
  color: ${TOKEN.surface}; -webkit-text-stroke: 0; text-shadow: 0 3px 0 ${TOKEN.text}, 0 0 14px rgba(29,35,43,.85);
  overflow-wrap: anywhere; }
.mp-tag { margin: 0; font-size: clamp(13px, 2.1vmin, 17px); font-weight: 700; line-height: 1.5; color: ${TOKEN.surface};
  text-shadow: 0 2px 0 ${TOKEN.text}, 0 0 10px ${TOKEN.text}; }
.mp-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.mp-actions > button { flex: 1 1 150px; }
.mp-btn { min-height: 52px; min-width: 48px; padding: 12px 18px; border: 3px solid ${TOKEN.text}; border-radius: 14px;
  font: inherit; font-size: 17px; color: ${TOKEN.surface}; cursor: pointer; transition: transform .08s ease, filter .12s ease;
  background: ${TOKEN.accent}; box-shadow: 0 4px 0 ${TOKEN.text}; }
.mp-btn.mp-warm { background: ${TOKEN.accentWarm}; }
.mp-btn.mp-danger { background: ${TOKEN.danger}; }
.mp-btn.mp-plain { background: ${TOKEN.muted}; }
.mp-btn.down { transform: translateY(3px); box-shadow: 0 1px 0 ${TOKEN.text}; }
.mp-btn:focus-visible { outline: 3px solid ${TOKEN.gold}; outline-offset: 2px; }
.mp-btn:disabled { filter: grayscale(.7) brightness(.85); cursor: default; }
.mp-langs { display: flex; flex-wrap: wrap; gap: 8px; }
.mp-lang { min-height: 48px; min-width: 48px; padding: 8px 14px; border: 3px solid ${TOKEN.text}; border-radius: 12px;
  background: ${TOKEN.surface}; color: ${TOKEN.text}; font: inherit; font-size: 15px; cursor: pointer; }
.mp-lang.on { background: ${TOKEN.gold}; box-shadow: inset 0 0 0 3px ${TOKEN.text}; }
.mp-lang:focus-visible { outline: 3px solid ${TOKEN.accent}; outline-offset: 2px; }
.mp-topbar { position: absolute; top: max(8px, env(safe-area-inset-top)); right: 0; display: flex;
  align-items: center; padding: 8px 10px; }
.mp-badge { padding: 8px 12px; border: 3px solid ${TOKEN.text}; border-radius: 12px; background: ${TOKEN.surface};
  font-size: 14px; min-height: 44px; display: flex; align-items: center; }
.mp-badge.danger { background: ${TOKEN.danger}; color: ${TOKEN.surface}; }
.mp-badge.muted { background: ${TOKEN.surfaceAlt}; font-weight: 700; }
.mp-iconbtn { margin-left: auto; width: 52px; height: 52px; border: 3px solid ${TOKEN.text}; border-radius: 12px;
  background: ${TOKEN.surface}; color: ${TOKEN.text}; font-size: 16px; cursor: pointer; }
.mp-modal { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(29,35,43,.62); padding: 16px; pointer-events: auto; }
.mp-panel { width: min(92vw, 420px); max-height: 90vh; display: flex; flex-direction: column; gap: 10px;
  padding: 16px; background: ${TOKEN.surface}; border: 4px solid ${TOKEN.text}; border-radius: 18px;
  box-shadow: 0 8px 0 rgba(29,35,43,.55); overflow-y: auto; }
.mp-panel.tall { width: min(94vw, 520px); }
.mp-head { display: flex; align-items: center; gap: 10px; }
.mp-h2 { margin: 0; font-size: 20px; flex: 1; }
.mp-h1 { margin: 0; font-size: clamp(28px, 7vmin, 44px); text-align: center; }
.mp-h1.win { color: ${TOKEN.gold}; text-shadow: 0 3px 0 ${TOKEN.text}; }
.mp-h1.lose { color: ${TOKEN.danger}; text-shadow: 0 3px 0 ${TOKEN.text}; }
.mp-x { margin-left: auto; width: 48px; height: 48px; border: 3px solid ${TOKEN.text}; border-radius: 12px;
  background: ${TOKEN.surfaceAlt}; color: ${TOKEN.text}; font-size: 18px; cursor: pointer; }
.mp-center { align-items: center; }
.mp-row { display: flex; gap: 10px; }
.mp-split > * { flex: 1; }
.mp-slide { display: flex; align-items: center; gap: 10px; min-height: 48px; }
.mp-slideL { width: 6.5em; font-size: 15px; }
.mp-range { flex: 1; height: 40px; accent-color: ${TOKEN.accent}; }
.mp-check { display: flex; align-items: center; gap: 10px; min-height: 48px; font-size: 16px; }
.mp-check input { width: 28px; height: 28px; accent-color: ${TOKEN.danger}; }
.mp-deck { overflow-y: auto; overscroll-behavior: contain; display: grid; grid-template-columns: 1fr; gap: 6px;
  max-height: 46vh; }
.mp-deck.compact { max-height: 30vh; }
.mp-deckrow { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 4px 10px;
  background: ${TOKEN.surfaceAlt}; border: 3px solid ${TOKEN.text}; border-radius: 10px; }
.mp-thumb { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border: 2px solid ${TOKEN.text};
  border-radius: 8px; color: ${TOKEN.surface}; font-size: 16px; text-shadow: 0 1px 0 ${TOKEN.text}; }
.mp-deckname { flex: 1; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-deckn { font-size: 15px; }
.mp-result { align-items: center; justify-content: center; padding: 16px; }
.mp-resultpanel { width: min(92vw, 460px); }
.mp-stats { display: grid; gap: 4px; }
.mp-stat { font-size: 15px; font-weight: 700; }
.mp-best { font-size: 13px; font-weight: 700; color: ${TOKEN.accent}; }
.mp-note { font-size: 13px; font-weight: 700; line-height: 1.45; }
.mp-modes { display: flex; flex-direction: column; gap: 6px; }
.mp-modehead { font-size: 14px; color: ${TOKEN.surface}; text-shadow: 0 2px 0 ${TOKEN.text}, 0 0 8px ${TOKEN.text}; }
.mp-moderow { display: flex; gap: 8px; }
.mp-mode { flex: 1 1 0; min-width: 0; min-height: 56px; padding: 6px 6px; border: 3px solid ${TOKEN.text}; border-radius: 12px;
  background: ${TOKEN.surface}; color: ${TOKEN.text}; font: inherit; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 2px; }
.mp-mode.on { background: ${TOKEN.gold}; box-shadow: inset 0 0 0 3px ${TOKEN.text}; }
.mp-mode.ex.on { background: ${TOKEN.accentWarm}; }
.mp-mode:focus-visible { outline: 3px solid ${TOKEN.accent}; outline-offset: 2px; }
.mp-modename { font-size: 15px; line-height: 1.15; }
.mp-modedesc { font-size: 11px; font-weight: 700; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
.mp-achrow { display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 6px 10px; background: ${TOKEN.surfaceAlt};
  border: 3px solid ${TOKEN.text}; border-radius: 10px; }
.mp-achrow:not(.on) .mp-achicon { filter: grayscale(1) brightness(.85); }
.mp-achicon { width: 44px; height: 44px; flex: none; border: 2px solid ${TOKEN.text}; border-radius: 10px; background: ${TOKEN.surface}; object-fit: cover; }
.mp-achtxt { flex: 1; min-width: 0; }
.mp-achname { font-size: 15px; }
.mp-achdesc { font-size: 12px; font-weight: 700; line-height: 1.35; }
.mp-achstate { flex: none; font-size: 12px; padding: 4px 8px; border: 2px solid ${TOKEN.text}; border-radius: 8px; background: ${TOKEN.surface}; }
.mp-achrow.on .mp-achstate { background: ${TOKEN.gold}; }
.mp-toasts { position: fixed; left: 0; right: 0; bottom: calc(88px + env(safe-area-inset-bottom)); z-index: 30;
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; padding: 0 12px; }
.mp-toast { max-width: 92vw; padding: 10px 16px; border: 3px solid ${TOKEN.text}; border-radius: 12px;
  background: ${TOKEN.background}; color: ${TOKEN.textOnDark}; font-size: 15px; font-weight: 800;
  transform: translateY(10px); opacity: 0; transition: transform .22s ease, opacity .22s ease; text-align: center; }
.mp-tuttitle { font-size: 20px; font-weight: 800; line-height: 1.3; }
.mp-tutart { width: min(100%, 220px); height: 110px; object-fit: cover; border: 3px solid #1d232b; border-radius: 12px;
  background: #f1db9e; align-self: center; }
.mp-tutcontain { object-fit: contain; height: 150px; }
.mp-tutdark { filter: brightness(0) drop-shadow(0 0 12px rgba(29,35,43,.9)); }
.mp-tuttrio { display: flex; gap: 8px; justify-content: center; }
.mp-tuttrio .mp-tutart { width: 96px; height: 130px; object-fit: cover; }
.mp-frow { display: flex; align-items: center; gap: 8px; }
.mp-flabel { flex: none; width: 5.5em; font-size: 13px; font-weight: 800; }
.mp-fchips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
.mp-chip { min-height: 36px; min-width: 48px; padding: 4px 10px; border: 3px solid #1d232b; border-radius: 999px;
  background: #fbf3dc; color: #1d232b; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
.mp-chip.on { background: #e8b839; }
.mp-chip:focus-visible { outline: 3px solid #357ca5; outline-offset: 2px; }
.mp-cardgroup { font-size: 15px; font-weight: 800; margin-top: 6px; }
.mp-cardrow { display: flex; gap: 10px; align-items: center; min-height: 72px; padding: 4px 8px 4px 4px;
  background: ${TOKEN.surfaceAlt}; border: 3px solid ${TOKEN.text}; border-radius: 10px; }
.mp-cardimg { width: 56px; height: 74px; flex: none; object-fit: cover; border: 2px solid ${TOKEN.text}; border-radius: 6px; }
.mp-cardmeta { flex: 1; min-width: 0; }
.mp-cardname { font-size: 15px; font-weight: 800; }
.mp-cardsub { font-size: 11px; font-weight: 700; opacity: .8; }
.mp-carddesc { font-size: 13px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.mp-tutbody { font-size: 15px; font-weight: 700; line-height: 1.65; overflow-wrap: anywhere; }
.mp-tutnav { align-items: center; justify-content: space-between; }
.mp-tutpage { font-size: 15px; font-weight: 800; }
.mp-toast.in { transform: none; opacity: 1; }
@media (orientation: landscape) and (max-height: 480px) {
  .mp-titlecol { width: min(70vw, 560px); gap: 8px; }
  .mp-title { font-size: clamp(22px, 6.5vmin, 40px); }
  .mp-tag { display: none; }
  .mp-mode { min-height: 48px; }
  .mp-btn { min-height: 48px; font-size: 15px; padding: 8px 14px; }
}
@media (prefers-reduced-motion: reduce) { .mp-btn, .mp-toast { transition: none; } }
`;
