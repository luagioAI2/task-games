// Screen UI — the building's own stationery: sand/cream plates, one ink contour, coral for spending.
// Tokens below are copied verbatim from UI_CONTRACT.md §1 (C-2 audits this correspondence).
import { fontStack, getLang, LANGS, NATIVE, ORDER, t,           } from "../i18n.js";
import { BASEMENT, FIXTURE_KEY, MAX_FLOORS, MAX_LV, REP_MAX, RENT, ROOMS_PER_FLOOR, SAT_MAX, SHOP, TENANT_TYPES, TALK_COOLDOWN, UPGRADE_REP, basementFacilityYen, basementPct } from "./data.js";
import {
  applicantsFor, buildCost, buildRepNeed, canBuild, floorOf, incomePerSec, occupiedCount,
  canShutter, fairRentYen, isShut, pendingAmount, repairCost, repairPlan, rentRange, shutterCost, shutterPlan, rentStep, rentVerdict, roomRent, satDecayRate, talkWait, upgradeCost,                
  eventActive, eventOverride,
} from "./sim.js";

import { C } from "../ui-tokens.js";

const R = (n        , d = 0) => n.toFixed(d);

/** Big-number units per language: ja 万/億/兆, zh 万/亿/万亿, en K/M/B/T. */
function unitize(v        , rateDigits         )         {
  const lang = getLang();
  const steps                     = lang === "en"
    ? [[1e18, "Qi"], [1e15, "Qa"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e4, "K"]]
    : lang === "zh" ? [[1e16, "亿亿"], [1e12, "万亿"], [1e8, "亿"], [1e4, "万"]] : [[1e16, "京"], [1e12, "兆"], [1e8, "億"], [1e4, "万"]];
  for (const [d, u] of steps) {
    if (v >= d) {
      const x = lang === "en" && d === 1e4 ? v / 1e3 : v / d;
      // past the largest unit fall back to exponent form so the pill never overflows
      if (x >= 1e5) return x.toExponential(2).replace("e+", "e") + u;
      return (rateDigits ? x.toFixed(2) : trim(x)) + u;
    }
  }
  return "";
}
export function fmtMoney(n        )         {
  const v = Math.max(0, n);
  return unitize(v, false) || Math.floor(v).toLocaleString("en-US");
}
const trim = (v        ) => (v >= 100 ? Math.floor(v).toString() : v.toFixed(1).replace(/\.0$/, ""));
/** Exact price for the rent field: ¥12,345 or ¥7.4 — never abbreviated, so the player sees what they typed. */
export function fmtYen(n        )         {
  if (n < 100) return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return Math.round(n).toLocaleString("en-US");
}
export function fmtRate(n        )         {
  return unitize(n, true) || (n < 10 ? n.toFixed(1) : Math.floor(n).toLocaleString("en-US"));
}
const secs = (n        ) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

                                                                                                                                           

                          
                              
                     
                            
                                         
                        
                
                
                   
                      
                   
                             
                                                  
                              
                      
                                    
                    
                                                  
                           
                          
                                                                            
                                             
                    
                       
                                                                                
                                                                              
                                
                
                                                                         
                         
                                                                          
                                           
                                                  
                    
                                                                        
                   
                               
                     
                        
                                  
                                                      
                       
                                                             
                    
                                   
                     
                    
                                                                                       
                                               
                                  
                                                               
                      
                    
                                                           
                  
                    
                              
                            
                             
                    
                      
                     
                        
                           
                          
                     
                    
                                                          
                                 
                                                                       
 

const SVG = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.7M12 18.7v2.7M2.6 12h2.7M18.7 12h2.7M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4.2a5 5 0 0 1-10 0z"/><path d="M7 5H4.6v1.4A3.4 3.4 0 0 0 8 9.8M17 5h2.4v1.4A3.4 3.4 0 0 1 16 9.8M12 13.2V17M9 20.2h6"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 8h13.2L17.4 20H6.6z"/><path d="M9.2 8V6.2a2.8 2.8 0 0 1 5.6 0V8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19.4V6.4M6 12.4l6-6 6 6"/></svg>',
  toTop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.6h12M12 20V9.2M6.6 14.4L12 9l5.4 5.4"/></svg>',
  toBottom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19.4h12M12 4v10.8M6.6 9.6L12 15l5.4-5.4"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M8.6 11.4V5.6a1.4 1.4 0 0 1 2.8 0v5.8m0-1.2a1.4 1.4 0 0 1 2.8 0v1.2m0-.6a1.4 1.4 0 0 1 2.8 0v4a4.6 4.6 0 0 1-4.6 4.6h-1a4.6 4.6 0 0 1-4.6-4.6v-3.2a1.4 1.4 0 0 1 2.8 0"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  coin: '<img class="mp-coin" src="assets/coin.webp" alt="">',
  /** official platform coin — every platform-coin price */
  pcoin: '<img class="mp-pcoin" src="assets/ui/icon_coin_selected.svg" alt="">',
};
const TENANT_IMG                         = Object.fromEntries(TENANT_TYPES.map((t) => [t.kind, `assets/tenant_${t.kind}.webp`]));
const FIX_IMG                         = {
  2: "assets/fx_aircon.webp", 3: "assets/fx_bath.webp", 4: "assets/fx_kitchen.webp", 5: "assets/fx_dryer.webp",
  6: "assets/fx_tv.webp", 7: "assets/fx_shelf.webp", 8: "assets/room_lux.webp", 9: "assets/fx_chandelier.webp", 10: "assets/fx_rug.webp",
};
const MULT                         = Object.fromEntries(TENANT_TYPES.map((t) => [t.kind, t.mult]));
const WANT_LV                         = Object.fromEntries(TENANT_TYPES.map((t) => [t.kind, t.lv]));

const esc = (s        ) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ));

/** ¥ rent read from a packed leaderboard score (LEADERBOARD.json ruleVersion 6, read-only mirror of the
 *  packer in main.ts). Every raw below 9,999,999×1e8 is an rv5-era value: rent = floor(raw/1e8)万円, and a
 *  finished-TA remnant in the low 1e8 field (0..99,999,999) is absorbed by the floor, exactly as before.
 *  At ≥ 9,999,999×1e8 the low field is the rv6 tier-2 rent continuation (TA abolished ⇒ every new row is
 *  ¥1000億 + low×¥1兆); low = 0 means the old ceiling rent ¥9,999,999万円. */
const BOARD_BREAK_RAW = 999999900000000; // 9,999,999 × 1e8 — the tier-2 zone starts here
const boardRentYen = (n        ) => n < BOARD_BREAK_RAW ? Math.floor(n / 1e8) * 1e4
  : (n - BOARD_BREAK_RAW) > 0 ? 1e11 + (n - BOARD_BREAK_RAW) * 1e12 : Math.floor(n / 1e8) * 1e4;

function el(tag        , cls         , html         )              {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

let CSS_DONE = false;
function installCss() {
  if (CSS_DONE) return;
  CSS_DONE = true;
  const f = document.createElement("style");
  f.id = "mp-ui";
  f.textContent = `
.mp-layer{position:absolute;inset:0;pointer-events:none}
.mp-hit{pointer-events:auto}
.mp-layer :where(button,input){font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mp-plate{background:${C.surface};border:2px solid ${C.outline};border-radius:12px;box-shadow:0 3px 0 rgba(34,48,61,.35)}
.mp-pill{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex:0 0 auto;background:${C.surfaceStrong};border:2px solid ${C.outline};
  border-radius:999px;padding:4px 10px;box-shadow:0 2px 0 rgba(34,48,61,.35);color:${C.text}}
.mp-row{display:flex;align-items:center;gap:8px}
.mp-num{font-variant-numeric:tabular-nums}
.mp-ico{width:19px;height:19px;flex:0 0 19px;display:block}
.mp-coin{width:20px;height:20px;flex:0 0 20px}
.mp-pcoin{width:24px;height:24px;flex:0 0 24px;display:block}
.kbseg{display:flex;gap:6px}
.kbseg button{flex:1;min-height:48px;border-radius:11px;border:2px solid ${C.outline};background:${C.paper};font-size:13px;font-weight:800;color:${C.text};line-height:1.15;padding:2px 4px}
.kbseg button.on{background:${C.accent};color:${C.paper};text-shadow:0 1px 0 rgba(0,0,0,.22)}
.kbstat{display:grid;grid-template-columns:1fr auto;gap:3px 10px;font-size:13px;color:${C.text}}
.kbstat b{font-variant-numeric:tabular-nums;text-align:right}
.kbbar{height:10px;border-radius:999px;border:2px solid ${C.outline};background:${C.disabled};overflow:hidden;margin:4px 0 2px}
.kbbar i{display:block;height:100%;background:${C.success}}
.sh{font-variant-numeric:tabular-nums;font-weight:800;color:${C.text}}
.sheet-body{overflow-y:auto;overscroll-behavior:contain}
/* short landscape windows: the side panel is ~230px tall, so the sheet zones sit side by side and secondary hints drop */
@media (max-height:480px) and (min-aspect-ratio:1/1){
  #mpSheet .sheet-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:8px;align-items:start}
  #mpSheet .rentInput{font-size:15px!important}
  #mpSheet .rentUnit{display:none}
  #mpSheet .sheet-body>.zone{margin:0}
  #mpSheet .rentHint,#mpSheet .rentRange,#mpSheet .tenantComment{display:none}
  #mpSheet .rentSlider{height:26px}
  #mpSheet .sheet-body .mp-row{flex-wrap:wrap}
}
.sheet-body::-webkit-scrollbar,.rank-list::-webkit-scrollbar{width:0;height:0}
.rank-list{overflow-y:auto;overscroll-behavior:contain}
.zone{background:${C.paper};border:2px solid ${C.outline};border-radius:12px;padding:8px 10px;margin-bottom:8px}
.zone h4{margin:0 0 6px;font-size:12px;font-weight:800;color:${C.muted};letter-spacing:.04em}
.btn{min-height:52px;border-radius:12px;border:2px solid ${C.outline};background:${C.surfaceStrong};color:${C.text};
  display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;padding:0 10px;
  box-shadow:0 3px 0 rgba(34,48,61,.35)}
.btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(34,48,61,.35)}
.btn.primary{background:${C.accent};color:${C.paper};box-shadow:0 3px 0 ${C.accentShadow};text-shadow:0 1px 0 rgba(0,0,0,.22)}
.btn.primary:active{box-shadow:0 1px 0 ${C.accentShadow}}
.btn.off{background:${C.disabled};color:${C.disabledText};box-shadow:0 3px 0 #c4bba4;text-shadow:none}
.btn.wide{width:100%}
.btn .lbl{font-size:15px;line-height:1.1}
.btn .sub{font-size:11px;font-weight:700;opacity:.9;line-height:1.15}
.ico-btn{width:48px;height:48px;border-radius:12px;border:2px solid ${C.outline};background:${C.surfaceStrong};
  color:${C.outline};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(34,48,61,.35)}
.ico-btn:active{transform:translateY(2px);box-shadow:none}
.chip{min-height:48px;display:flex;gap:8px;align-items:center;background:${C.surface};border:2px solid ${C.outline};
  border-radius:11px;padding:5px 8px;text-align:left}
.chip img{width:34px;height:34px;object-fit:contain;flex:0 0 34px}
.chip .cn{display:block;font-size:13px;font-weight:800;color:${C.text}}
.chip .cc{display:block;font-size:11px;color:${C.muted}}
.chip.locked{opacity:.55}
.chip.premium{background:#fff2d8;border-color:${C.accentShadow}}
.chip.sel{outline:3px solid ${C.accent}}
.langbtn{min-height:48px;min-width:64px;border-radius:11px;border:2px solid ${C.outline};background:${C.paper};padding:0 13px;
  font-size:14px;font-weight:800;color:${C.text}}
.langbtn.on{background:${C.accent};color:${C.paper};text-shadow:0 1px 0 rgba(0,0,0,.22)}
.rowline{display:flex;align-items:center;gap:9px;margin:8px 0;font-size:14px;font-weight:700;color:${C.text}}
@keyframes mpFadeUp{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
@keyframes mpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes mpRise{0%{opacity:0;transform:translate(-50%,-50%) translateY(4px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) translateY(-32px)}}
@media (prefers-reduced-motion: reduce){*{animation:none !important;transition:none !important}}
`;
  document.head.appendChild(f);
}

export class Ui {
  hooks          ;
          host             ;
          hudLayer             ;
          worldLayer             ;
          modalLayer             ;
  /** host for the tutorial overlay: above the HUD and sheet, below toasts and modals */
           tutSlot             ;
          state                   = null;
          now = 0;
          sel = -1;
          selApp = 0;
          moneyShown = 0;
          sheetOpen = false;

          money              ;         rate              ;         bonus              ;         evBanner              ;
          repFill              ;         repLabel              ;         floorChip              ;
          twSeg              ;         twBtns                      = [];         twSig = "";
          navRow              ;         navRange              ;         navTop                    ;         navBottom                    ;
          navShown = false;         navText = "";
          titleChip              ;         claim              ;         claimAmt              ;
          stormChip                    ;
          adminPanel                     = null;

  /** disaster button panel (admin mode, bundled with the quake DLC) */
  setAdminPanel(s           ) {
    const show = s.quake.dlc && s.quake.adminOn;
    if (!show && this.adminPanel) { this.adminPanel.remove(); this.adminPanel = null; }
    if (show && !this.adminPanel) {
      const p = el("div", "mp-hit");
      p.style.cssText = "position:absolute;left:10px;bottom:calc(84px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;z-index:3";
      const mk = (kind                                               , label        , warn         ) => {
        const sb = el("button", "btn ico-btn")                     ;
        sb.style.cssText = "width:56px;height:56px;border-radius:14px;font-size:12px;font-weight:800;line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0 2px;" +
          "background:" + (warn ? C.warnTint : C.surfaceStrong) + ";color:" + (warn ? C.warnText : C.text) + ";border-color:" + (warn ? C.warnText : C.outline);
        sb.innerHTML = label;
        sb.addEventListener("click", () => this.hooks.adminFire(kind));
        return sb;
      };
      p.append(
        mk("missile", "<span>" + esc(t("adm.missile")) + "</span>", true),
        mk("quake", "<span>" + esc(t("adm.quake")) + "</span>", true),
        mk("typhoon", "<span>" + esc(t("adm.typhoon")) + "</span>", true),
        mk("repairAll", "<span>" + esc(t("adm.repair")) + "</span>", false),
      );
      this.worldLayer.appendChild(p);
      this.adminPanel = p;
    }
  }
          crimeChip                    ;
          crimeSig = "";
          stormSig = "";
          buildBtn                    ;         rankBtn                    ;         shopBtn                    ;
          sheet              ;         sheetBody              ;         sheetFoot              ;         sheetHeadNo              ;         sheetBadge              ;
          claimShown = false;

  constructor(host             , hooks         ) {
    installCss();
    this.host = host;
    this.hooks = hooks;
    this.hudLayer = el("div", "mp-layer");
    this.worldLayer = el("div", "mp-layer");
    this.modalLayer = el("div", "mp-layer");
    this.tutSlot = el("div");
    this.tutSlot.style.cssText = "position:absolute;inset:0;pointer-events:none";
    this.buildHud();
    this.buildRail();
    this.buildSheet();
    host.append(this.hudLayer, this.tutSlot, this.worldLayer, this.modalLayer);
    this.applyText();
  }

  // ------------------------------------------------------------ static text

  applyText() {
    const f = fontStack(getLang());
    document.documentElement.style.fontFamily = f;
    (this.rate.querySelector(".u")               ).textContent = t("hud.perSec");
    this.repLabel.setAttribute("aria-label", t("hud.rep"));
    this.navTop.setAttribute("aria-label", t("nav.top"));
    this.navBottom.setAttribute("aria-label", t("nav.bottom"));
    this.buildBtn.setAttribute("aria-label", t("hud.build"));
    this.rankBtn.querySelector(".lbl") .textContent = t("hud.rank");
    this.shopBtn.querySelector(".lbl") .textContent = t("hud.shop");
    this.shopBtn.setAttribute("aria-label", t("hud.shop"));
    const gear = this.hudLayer.querySelector("#mpGear")                     ;
    gear.setAttribute("aria-label", t("hud.menu"));
    const cl = this.claim.querySelector(".cl")               ;
    cl.textContent = t("hud.claim");
    const cs = this.claim.querySelector(".cs")               ;
    cs.textContent = t("hud.claimBody");
    if (this.state) this.refreshSheet();
  }

  // ------------------------------------------------------------ hud

          buildHud() {
    const hud = el("div", "mp-hit");
    hud.style.cssText = `position:absolute;left:8px;right:8px;top:8px;pointer-events:none`;
    const row1 = el("div", "mp-row");
    const money = el("div", "mp-pill mp-hit", `${SVG.coin}<span class="sh mp-num" style="font-size:19px">¥0</span>`);
    const rate = el("div", "mp-pill mp-hit", `<span class="sh mp-num" style="font-size:15px">¥0</span><span class="u" style="font-size:12px;font-weight:800"></span>`);
    const gear = el("button", "ico-btn mp-hit")                     ;
    gear.id = "mpGear";
    gear.innerHTML = `<span class="mp-ico">${SVG.gear}</span>`;
    gear.style.marginLeft = "auto";
    gear.addEventListener("click", () => this.hooks.openMenu());
    // creator/debug access moved into the settings sheet (tap its title 7 times), per user request
    row1.append(money, rate, gear);
    const row2 = el("div", "mp-row");
    row2.style.marginTop = "6px";
    const bonus = el("div", "mp-pill mp-hit");
    bonus.style.cssText += `background:${C.successTint};color:${C.successText};padding:2px 8px;display:none`;
    bonus.innerHTML = `<span style="font-size:11px;font-weight:800">+0%</span>`;
    const bar = el("div", "mp-hit");
    bar.style.cssText = `flex:1;min-width:56px;height:14px;background:${C.paper};border:2px solid ${C.outline};border-radius:999px;overflow:hidden`;
    const fill = el("i");
    fill.style.cssText = `display:block;height:100%;width:0;background:${C.success};transition:width .3s ease-out`;
    bar.appendChild(fill);
    const repLabel = el("div", "mp-pill mp-hit");
    repLabel.style.cssText += "font-size:11px;font-weight:800;padding:2px 8px";
    const floorChip = el("div", "mp-pill mp-hit");
    floorChip.style.cssText += "font-size:11px;font-weight:800;padding:2px 8px";
    const stormChip = el("button", "mp-pill mp-hit")                     ;
    // a 48px-tall hit area (visual height stays small via the negative margin) so the chip is a legal touch target
    stormChip.style.cssText += "font-size:11px;font-weight:800;padding:2px 8px;min-height:48px;display:none;gap:4px;" +
      "border-color:" + C.warnText + ";margin:-13px 0;align-items:center";
    stormChip.addEventListener("click", () => this.hooks.openStorm());
    const crimeChip = el("button", "mp-pill mp-hit")                     ;
    crimeChip.style.cssText += "font-size:11px;font-weight:800;padding:2px 8px;min-height:48px;display:none;gap:4px;" +
      "border-color:" + C.warnText + ";margin:-13px 0;align-items:center;background:" + C.warnTint + ";color:" + C.warnText;
    crimeChip.addEventListener("click", () => this.hooks.openCrime());
    row2.append(bonus, bar, crimeChip, stormChip, repLabel, floorChip);
    this.crimeChip = crimeChip;
    const row3 = el("div", "mp-row");
    row3.style.cssText += "margin-top:6px;justify-content:flex-end;display:none";
    const range = el("div", "mp-pill mp-hit");
    range.style.cssText += "font-size:12px;font-weight:800;padding:3px 10px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:0 1 auto";
    const toTop = el("button", "ico-btn mp-hit")                     ;
    toTop.innerHTML = `<span class="mp-ico">${SVG.toTop}</span>`;
    toTop.style.flex = "0 0 48px";
    toTop.addEventListener("click", () => this.hooks.scrollTop());
    const toBottom = el("button", "ico-btn mp-hit")                     ;
    toBottom.innerHTML = `<span class="mp-ico">${SVG.toBottom}</span>`;
    toBottom.style.flex = "0 0 48px";
    toBottom.addEventListener("click", () => this.hooks.scrollBottom());
    const seg = el("div", "mp-row");
    seg.style.cssText = "gap:4px;margin-right:auto;display:none;flex:0 0 auto";
    const segBtns                      = [];
    for (const m of [1, 2, 0]         ) {
      const sb = el("button", "mp-pill mp-hit")                     ;
      sb.dataset.tw = String(m);
      sb.style.cssText += "font-size:11.5px;font-weight:800;padding:2px 8px;min-height:48px;min-width:48px;justify-content:center";
      sb.addEventListener("click", () => this.hooks.setTwinView(m));
      seg.appendChild(sb);
      segBtns.push(sb);
    }
    this.twSeg = seg; this.twBtns = segBtns;
    row3.append(seg, range, toTop, toBottom);
    // 1000プレイ記念 banner (limited time; hidden automatically once the event ends)
    const ev = el("button", "mp-pill mp-hit")                     ;
    ev.dataset.act = "event";
    ev.style.cssText += `margin-top:6px;min-height:48px;max-width:100%;font-size:12px;font-weight:800;padding:3px 10px;display:none;` +
      `background:${C.gold};color:${C.text};border-color:${C.outline};white-space:normal;text-align:left;line-height:1.25`;
    ev.addEventListener("click", () => this.hooks.openEvent());
    this.evBanner = ev;
    hud.append(row1, row2, ev, row3);
    this.navRow = row3; this.navRange = range; this.navTop = toTop; this.navBottom = toBottom;
    this.hudLayer.appendChild(hud);

    const claim = el("div", "mp-hit");
    claim.style.cssText = `position:absolute;left:10px;right:10px;bottom:126px;display:none;align-items:center;gap:9px;
      background:${C.accent};border:2px solid ${C.accentShadow};border-radius:14px;padding:8px 11px;
      box-shadow:0 4px 0 ${C.accentShadow};color:${C.paper};animation:mpBob 1.8s ease-in-out infinite`;
    claim.innerHTML = `${SVG.coin}<div style="flex:1;min-width:0"><div class="cl" style="font-size:13px;font-weight:800"></div>
      <div class="cs" style="font-size:11px;font-weight:700;opacity:.92"></div></div>
      <div class="sh" style="font-size:19px;color:${C.paper}">¥<span class="v mp-num">0</span></div>`;
    claim.addEventListener("click", () => this.hooks.claim());
    this.hudLayer.appendChild(claim);


    this.money = money.querySelector(".sh")               ;
    this.rate = rate;
    this.bonus = bonus;
    this.repFill = fill;
    this.repLabel = repLabel;
    this.floorChip = floorChip;
    this.stormChip = stormChip;
    this.titleChip = money;
    this.claim = claim;
    this.claimAmt = claim.querySelector(".v")               ;
  }

          buildRail() {
    const rail = el("div", "mp-row mp-hit");
    rail.style.cssText = `position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));gap:8px;align-items:stretch`;
    const build = el("button", "btn primary wide")                     ;
    build.style.cssText += "flex:1.4 1 0;min-width:0";
    build.innerHTML = `<span class="mp-ico">${SVG.up}</span><span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0">
      <span class="lbl"></span><span class="sub mp-num"></span></span>`;
    build.addEventListener("click", () => this.hooks.build());
    const rank = el("button", "btn wide")                     ;
    rank.innerHTML = `<span class="mp-ico">${SVG.trophy}</span><span class="lbl"></span>`;
    rank.style.cssText += "flex:1 1 0;min-width:0";
    rank.addEventListener("click", () => this.hooks.openRanking());
    const shop = el("button", "btn wide")                     ;
    shop.innerHTML = `<span class="mp-ico">${SVG.bag}</span><span class="lbl"></span>`;
    shop.style.cssText += "flex:1 1 0;min-width:0";
    shop.addEventListener("click", () => this.hooks.openShop());
    rail.append(build, rank, shop);
    this.hudLayer.appendChild(rail);
    this.buildBtn = build;
    this.rankBtn = rank;
    this.shopBtn = shop;
  }

          buildSheet() {
    const sheet = el("div", "mp-hit");
    sheet.id = "mpSheet";
    const head = el("div", "mp-row");
    head.style.marginBottom = "8px";
    const no = el("div", "sh");
    no.style.cssText = "font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0";
    const badge = el("div", "mp-pill");
    badge.style.cssText += "font-size:11px;font-weight:800;padding:2px 8px;white-space:nowrap";
    const x = el("button", "ico-btn")                     ;
    x.style.marginLeft = "auto";
    x.style.flex = "0 0 48px";
    x.innerHTML = `<span class="mp-ico">${SVG.close}</span>`;
    x.setAttribute("aria-label", t("btn.close"));
    x.addEventListener("click", () => this.hooks.closeSheet());
    head.append(no, badge, x);
    const body = el("div", "sheet-body");
    body.setAttribute("data-mp-scroll", "");
    body.style.cssText = "min-height:0;flex:0 1 auto";
    const foot = el("div");
    foot.style.cssText = "flex:0 0 auto;display:flex;gap:8px;padding-top:8px";
    sheet.append(head, body, foot);
    this.hudLayer.appendChild(sheet);
    this.sheet = sheet; this.sheetBody = body; this.sheetFoot = foot; this.sheetHeadNo = no; this.sheetBadge = badge;
    this.layoutSheet();
  }

  /** Bottom sheet in tall windows, right-side panel in wide ones (portrait game in a landscape window). */
          side = false;
          hideTimer = 0;
          layoutSheet() {
    const side = innerWidth > innerHeight;
    this.side = side;
    const base = `position:absolute;background:${C.surface};flex-direction:column;overflow:hidden;
      transition:transform .26s cubic-bezier(.2,.8,.3,1);`;
    const shown = this.sheetOpen;
    const disp = `display:${shown || this.hideTimer ? "flex" : "none"};`;
    if (side) {
      this.sheet.style.cssText = base + disp + `top:8px;bottom:8px;right:8px;left:auto;width:min(420px,52vw);
        border:3px solid ${C.outline};border-radius:18px;padding:10px 12px;box-shadow:0 6px 0 rgba(34,48,61,.3);
        transform:${shown ? "translateX(0)" : "translateX(110%)"}`;
    } else {
      this.sheet.style.cssText = base + disp + `left:0;right:0;bottom:0;max-height:72%;border-top:3px solid ${C.outline};
        border-radius:18px 18px 0 0;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));
        transform:${shown ? "translateY(0)" : "translateY(105%)"}`;
    }
  }
  get sidePanelWidth() { return this.side && this.sheetOpen ? this.sheet.offsetWidth + 16 : 0; }
          reportSheet() { this.hooks.sheetMoved(this.sheetOpen, this.side ? 0 : this.sheet.offsetHeight); }

  // ------------------------------------------------------------ per-frame

  get isSheetOpen() { return this.sheetOpen; }
  /** hide every DOM layer while a full-screen canvas scene (the register shift) runs */
  setSceneHidden(on         ) {
    for (const l of [this.hudLayer, this.tutSlot, this.worldLayer, this.modalLayer]) l.style.display = on ? "none" : "";
  }
  get isModalOpen() { return this.modalLayer.childElementCount > 0; }
  /** Screen rect of a named UI element for the tutorial spotlight (null when not on screen). */
  tutTarget(name                                                                         )                 {
    const r = (e                            ) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 ? b : null;
    };
    if (name === "money") {
      const a = r(this.titleChip), b = r(this.rate);
      return a && b ? new DOMRect(a.left, Math.min(a.top, b.top), b.right - a.left, Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)) : a;
    }
    if (name === "build") return r(this.buildBtn);
    if (name === "gear") return r(this.hudLayer.querySelector("#mpGear"));
    if (!this.sheetOpen) return null;
    if (name === "sheet") return r(this.sheet);
    if (name === "up") return r(this.sheetFoot.querySelector("[data-act='up']"));
    if (name === "movein") return r(this.sheetFoot.querySelector("[data-act='movein']"));
    if (name === "rent") return r(this.sheetBody.querySelector(".rentBox"));
    return r(this.sheetBody.querySelector(".satFill")?.closest(".rowline"));
  }
  get selectedRoom() { return this.sel; }

          wasInf = false;
  update(s           , now        , dt        ) {
    this.state = s;
    this.now = now;
    const target = s.money;
    const d = target - this.moneyShown;
    if (Math.abs(d) > 0.5) this.moneyShown += d * Math.min(1, dt * 6);
    else this.moneyShown = target;
    const infNow = !!(s.infBuy || s.infCheat);
    if (infNow || this.wasInf) this.moneyShown = s.money; // never animate to/from the ∞ pin
    this.wasInf = infNow;
    this.money.textContent = infNow ? "¥∞" : "¥" + fmtMoney(this.moneyShown);
    (this.rate.querySelector(".sh")               ).textContent = "¥" + fmtRate(incomePerSec(s, now));
    const bp = Math.round((s.rep / 2000) * 100);
    this.bonus.style.display = bp > 0 ? "" : "none";
    this.bonus.firstElementChild .textContent = `+${bp}%`;
    this.bonus.title = t("hud.repBonus");
    const evOn = eventActive();
    const evTxt = "🎉 " + t("ev.banner");
    if (this.evBanner.textContent !== evTxt) this.evBanner.textContent = evTxt;
    this.evBanner.style.display = evOn ? "flex" : "none";
    this.repFill.style.width = `${Math.min(100, (s.rep / REP_MAX) * 100)}%`;
    this.repLabel.textContent = `${t("hud.rep")} ${Math.floor(s.rep)}`;
    this.floorChip.textContent = s.floors > MAX_FLOORS ? `${MAX_FLOORS}+${s.floors - MAX_FLOORS}F · ${occupiedCount(s)}/${s.rooms.length}` : `${s.floors}F · ${occupiedCount(s)}/${s.rooms.length}`;
    const fr = this.hooks.floorRange();
    const st = s.storm;
    const sig = `${st.phase}:${Math.ceil(st.timer)}:${st.shut.length}:${s.rooms.filter((r) => r.damaged).length}`;
    if (sig !== this.stormSig) {
      this.stormSig = sig;
      const dmg = s.rooms.reduce((n, r) => n + (r.damaged ? 1 : 0), 0);
      // the chip borrows the reputation label's slot so row 2 never overflows a narrow phone
      if (st.phase === "calm" && dmg === 0) { this.stormChip.style.display = "none"; this.repLabel.style.display = ""; }
      else {
        this.stormChip.style.display = "inline-flex";
        this.repLabel.style.display = "none";
        const label = st.phase === "forecast"
          ? t("storm.forecast", { n: secs(st.timer), s: st.shut.length })
          : st.phase === "storm" ? t("storm.now") : t("storm.damage", { n: dmg });
        this.stormChip.textContent = label;
        this.stormChip.style.background = st.phase === "storm" ? C.warnTint : dmg > 0 && st.phase === "calm" ? C.warnTint : C.surfaceStrong;
        this.stormChip.style.color = st.phase === "storm" || dmg > 0 ? C.warnText : C.text;
      }
    }
    const cr = s.crime;
    const csig = cr.phase === "quiet" ? "" : `${cr.phase}:${cr.room}:${Math.ceil(cr.timer)}`;
    if (csig !== this.crimeSig) {
      this.crimeSig = csig;
      if (!csig) this.crimeChip.style.display = "none";
      else {
        this.crimeChip.style.display = "inline-flex";
        this.crimeChip.textContent = cr.phase === "raid" ? t("crime.raid") : t("crime.chip", { n: secs(cr.timer) });
        // one alert chip at a time on narrow phones
        this.stormChip.style.display = "none";
        this.repLabel.style.display = "none";
      }
      this.stormSig = "";
    }
    if (csig) { this.stormChip.style.display = "none"; this.repLabel.style.display = "none"; }
    else if (!this.stormChip.offsetParent && this.repLabel.style.display === "none" && s.storm.phase === "calm" && !s.rooms.some((r) => r.damaged)) this.repLabel.style.display = "";
    this.hooks.stormPhase(st.phase, st.shut);
    const tv = this.hooks.twinView();
    const rowOn = fr.scrolling || tv.on;
    if (rowOn !== this.navShown) { this.navShown = rowOn; this.navRow.style.display = rowOn ? "flex" : "none"; }
    const tsig = `${tv.on}:${tv.mode}:${getLang()}:${fr.scrolling}`;
    if (tsig !== this.twSig) {
      this.twSig = tsig;
      this.twSeg.style.display = tv.on ? "flex" : "none";
      const keys = ["tw.t1", "tw.t2", "tw.all"], modes = [1, 2, 0];
      this.twBtns.forEach((b, k) => {
        b.textContent = t(keys[k]);
        const act = modes[k] === tv.mode;
        b.style.background = act ? C.accent : "";
        b.style.color = act ? C.paper : "";
        b.setAttribute("aria-pressed", act ? "true" : "false");
      });
      this.navRange.style.display = fr.scrolling ? "" : "none";
      this.navTop.style.display = fr.scrolling ? "" : "none";
      this.navBottom.style.display = fr.scrolling ? "" : "none";
    }
    if (fr.scrolling) {
      const txt = tv.on ? `${fr.lo}–${fr.hi}F / ${fr.total}F` : `${fr.lo}F – ${fr.hi}F / ${fr.total}F`;
      if (txt !== this.navText) { this.navText = txt; this.navRange.textContent = txt; }
      this.navTop.disabled = fr.hi >= fr.total;
      this.navBottom.disabled = fr.lo <= 1;
    }

    const pend = pendingAmount(s);
    const show = pend > 0;
    if (show !== this.claimShown) {
      this.claimShown = show;
      this.claim.style.display = show ? "flex" : "none";
    }
    if (show) this.claimAmt.textContent = fmtMoney(pend);

    // rail
    const cost = buildCost(s), need = buildRepNeed(s);
    // 2棟目: tower 1 framed → its basement; tower 2 / both → the 2nd tower grows
    const tvw = this.hooks.twinView();
    const twinBuild = !!s.twin && s.floors >= MAX_FLOORS && s.floors < MAX_FLOORS * 2 && !(tvw.mode === 1 && s.basement < 5);
    const fullTower = s.floors >= MAX_FLOORS && !twinBuild;
    const digNext = fullTower && s.basement < 5;
    const maxed = fullTower && s.basement >= 5;
    // 2026-11-25: at the tower cap the rail digs the basement (price from BASEMENT tiers)
    const digCost                = digNext ? BASEMENT[s.basement].cost : null;
    const ok = fullTower ? (digCost !== null && s.money >= digCost) : canBuild(s);
    this.buildBtn.className = "btn wide " + (ok ? "primary" : "off");
    (this.buildBtn.querySelector(".lbl")               ).textContent =
      maxed ? t("bm.done") : digNext ? t("bm.dig", { n: s.basement + 1 }) : twinBuild ? `${t("hud.build")} ${t("build.twin")} ${s.floors + 1 - MAX_FLOORS}F` : `${t("hud.build")} ${s.floors + 1}F`;
    (this.buildBtn.querySelector(".sub")               ).textContent =
      maxed ? t("bm.bonus", { pct: Math.round(basementPct(s.basement) * 100), n: s.basement, fac: fmtMoney(basementFacilityYen(s.basement)) }) : digNext ? `¥${fmtMoney(digCost ?? 0)}` : ok ? `¥${fmtMoney(cost)}` : s.money < cost ? `¥${fmtMoney(cost)}` : t("build.needRep", { rep: need });
    if (this.shopBtn) this.shopBtn.style.display = this.hooks.shopAvailable() ? "" : "none";

    if (this.sheetOpen) this.liveSheet();
  }

  // ------------------------------------------------------------ sheet

  openSheet(i        , s           ) {
    this.sel = i; this.selApp = 0;
    this.state = s;
    const wasOpen = this.sheetOpen;
    window.clearTimeout(this.hideTimer); this.hideTimer = 0;
    if (!wasOpen) {
      // mount off-screen first, then slide in on the next frame
      this.layoutSheet();
      this.sheet.style.display = "flex";
      void this.sheet.offsetHeight;
    }
    this.sheetOpen = true;
    this.layoutSheet();
    this.renderSheet();
    this.reportSheet();
  }
  closeSheet() {
    if (!this.sheetOpen) return;
    this.sheetOpen = false;
    this.sel = -1;
    this.hideTimer = window.setTimeout(() => { this.hideTimer = 0; if (!this.sheetOpen) this.sheet.style.display = "none"; }, 300);
    this.layoutSheet();
    this.hooks.sheetMoved(false, 0);
  }
  onResize() { this.layoutSheet(); if (this.sheetOpen) this.reportSheet(); this.placeToasts(); }
  /** Keep the toast column inside the visible game area (left of a docked side panel, never wider than the window). */
          placeToasts() {
    const st = this.toastStack;
    if (!st) return;
    const right = Math.min(this.sidePanelWidth, Math.max(0, innerWidth - 200));
    st.style.cssText = `position:absolute;left:8px;right:${right + 8}px;top:112px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;overflow:hidden`;
  }
  refreshSheet() { if (this.state && this.sel >= 0) this.renderSheet(); }

          tenantLabel(kind        ) { return t(`tn.${kind}`); }

          renderSheet() {
    const s = this.state ;
    const i = this.sel;
    if (!s.rooms[i]) return;
    if (i < 0 || i >= s.rooms.length) return;
    const room = s.rooms[i];
    const o = room.occupant;
    {
      // 2nd tower: number rooms and floors from its own ground (room 1 / 1F), prefixed with the tower tag
      const t2 = floorOf(i) > MAX_FLOORS;
      const ri = t2 ? i - MAX_FLOORS * ROOMS_PER_FLOOR : i;
      const fl = t2 ? floorOf(i) - MAX_FLOORS : floorOf(i);
      this.sheetHeadNo.textContent = `${t2 ? t("tw.t2") + " " : ""}${t("room.title", { n: ri + 1 })} · ${fl}F`;
    }
    this.sheetBadge.textContent = o ? t(`tn.${o.kind}`) : t("room.vacant");
    this.sheetBadge.style.background = o ? C.info : C.disabled;
    this.sheetBadge.style.color = o ? C.paper : C.disabledText;
    this.sheetBody.innerHTML = "";
    this.sheetFoot.innerHTML = "";
    const next = room.lv >= MAX_LV ? 0 : room.lv + 1;
    const cz = this.crimeZone(s, i);
    if (cz) this.sheetBody.appendChild(cz);
    const sz = this.stormZone(s, i);
    if (sz) this.sheetBody.appendChild(sz);
    const rz = this.robberyZoneOf(s, i);
    if (rz) this.sheetBody.appendChild(rz);

    if (o) {
      const z = el("div", "zone");
      z.innerHTML = `<div class="rowline" style="align-items:flex-start;gap:9px;margin:0">
          <img src="${TENANT_IMG[o.kind]}" alt="" style="width:46px;height:46px;object-fit:contain;flex:0 0 46px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:800;color:${C.info}">${esc(this.tenantLabel(o.kind))} ×${(MULT[o.kind] * (o.premium ? 1.5 : 1)).toFixed(1)}${o.premium ? ` · ${t("room.premium")}` : ""}</div>
            <div style="font-size:16px;font-weight:800;color:${C.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.name || "…")}</div>
            <div class="tenantComment" style="font-size:12px;color:${C.muted};line-height:1.35">${esc(o.comment)}</div>
          </div></div>
        <div class="rowline" style="margin:8px 0 0">
          <span style="font-size:12px;font-weight:700;color:${C.muted};white-space:nowrap">${t("room.sat")}</span>
          <div style="flex:1;min-width:40px;height:12px;background:#ece4d0;border:2px solid ${C.outline};border-radius:999px;overflow:hidden">
            <i class="satFill" style="display:block;height:100%;width:0;background:${C.success};transition:width .25s linear"></i></div>
          <span class="satNum sh mp-num" style="font-size:12px;min-width:66px;text-align:right"></span></div>
        <div class="actStatus" style="display:none;margin-top:6px;font-size:12px;font-weight:800;color:${C.info}"></div>
        <div class="rentBox" style="margin-top:8px;padding-top:8px;border-top:2px dashed ${C.disabled}">
          <div class="rowline" style="margin:0;font-size:13px;justify-content:space-between;gap:6px">
            <span style="display:flex;align-items:center;gap:5px;min-width:0">${SVG.coin}<span class="rentNow mp-num" style="font-weight:800"></span></span>
            <span class="rentVerdict" style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:999px;border:1.5px solid ${C.outline};white-space:nowrap"></span>
          </div>
          <div class="rowline" style="margin:6px 0 0;gap:6px">
            <button class="ico-btn" data-act="rentDown" aria-label="${esc(t("rent.down"))}" style="flex:0 0 48px;font-size:22px;font-weight:800">−</button>
            <label class="rentField" style="flex:1;min-width:0;height:48px;display:flex;align-items:center;gap:4px;padding:0 10px;
              background:${C.paper};border:2px solid ${C.outline};border-radius:12px">
              <span style="font-weight:800;color:${C.muted}">¥</span>
              <input class="rentInput mp-num" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false"
                aria-label="${esc(t("rent.input"))}" style="flex:1;min-width:0;width:100%;height:44px;border:0;background:transparent;
                font-size:17px;font-weight:800;color:${C.text};text-align:right;outline:none;user-select:text;-webkit-user-select:text">
              <span class="rentUnit" style="font-size:12px;font-weight:800;color:${C.muted};white-space:nowrap">${esc(t("hud.perSec"))}</span>
            </label>
            <button class="ico-btn" data-act="rentUp" aria-label="${esc(t("rent.up"))}" style="flex:0 0 48px;font-size:22px;font-weight:800">+</button>
          </div>
          <input class="rentSlider" type="range" min="60" max="140" step="1" aria-label="${esc(t("rent.label"))}"
            style="width:100%;height:36px;margin:2px 0 0;accent-color:${C.accent}">
          <div class="rentRange mp-num" style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:${C.muted};margin-top:-4px"><span></span><span></span></div>
          <div class="rentHint" style="font-size:11.5px;color:${C.muted};margin-top:2px"></div>
        </div>`;
      this.sheetBody.appendChild(z);
      const slider = z.querySelector(".rentSlider")                    ;
      const input = z.querySelector(".rentInput")                    ;
      slider.value = String(Math.round((o.factor || 1) * 100));
      slider.addEventListener("input", () => this.hooks.setRentYen(i, rentRange(s, i).base * Number(slider.value) / 100));
      const nudge = (d        ) => this.hooks.setRentYen(i, roomRent(s, i) + d * rentStep(rentRange(s, i).base));
      (z.querySelector("[data-act='rentDown']")               ).addEventListener("click", () => nudge(-1));
      (z.querySelector("[data-act='rentUp']")               ).addEventListener("click", () => nudge(1));
      // typed price: digits, commas and one decimal point; 万/k shorthands for big rooms; commit on Enter/blur
      const commit = () => {
        const raw = input.value.replace(/[,\s，¥￥]/g, "").replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
        const m = raw.match(/^(\d+(?:\.\d+)?)(万|k|K)?$/);
        if (m) this.hooks.setRentYen(i, Number(m[1]) * (m[2] === "万" ? 10000 : m[2] ? 1000 : 1));
        input.dataset.editing = "";
        this.liveSheet();
      };
      input.addEventListener("focus", () => { input.dataset.editing = "1"; input.select(); });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } e.stopPropagation(); });
      input.addEventListener("blur", commit);
      this.sheetBody.appendChild(this.fixtureZone(room.lv, next));

      const talk = el("button", "btn wide")                     ;
      talk.dataset.act = "talk";
      talk.style.flex = "1";
      talk.addEventListener("click", () => this.hooks.talk(i));
      const up = el("button", "btn wide primary")                     ;
      up.dataset.act = "up";
      up.style.flex = "1";
      up.addEventListener("click", () => this.hooks.renovate(i));
      this.sheetFoot.append(talk, up);
      this.liveSheet();
      return;
    }

    this.sheetBody.appendChild(this.fixtureZone(room.lv, next));

    const ap = el("div", "zone");
    ap.innerHTML = `<h4>${t("ap.title")}</h4>`;
    const elig = applicantsFor(s, i);
    if (!s.applicants.length) {
      ap.insertAdjacentHTML("beforeend", `<div style="font-size:12.5px;color:${C.muted}">${t("ap.none")}</div>`);
    } else {
      const chips = el("div");
      chips.style.cssText = "display:flex;flex-wrap:wrap;gap:7px";
      s.applicants.forEach((a, idx) => {
        const ok = elig.includes(idx);
        const chip = el("button", `chip${a.premium ? " premium" : ""}${ok ? "" : " locked"}${this.selApp === a.id ? " sel" : ""}`)                     ;
        chip.innerHTML = `<img src="${TENANT_IMG[a.kind]}" alt="">
          <span style="min-width:0"><span class="cn">${esc(this.tenantLabel(a.kind))} ×${(MULT[a.kind] * (a.premium ? 1.5 : 1)).toFixed(1)}${a.premium ? " ★" : ""}</span>
          <span class="cc">${t("room.wantLv", { lv: WANT_LV[a.kind] })}${ok ? "" : " · " + t("ap.locked")}</span></span>`;
        chip.disabled = !ok;
        if (ok) chip.addEventListener("click", () => { this.selApp = a.id; this.renderSheet(); });
        chips.appendChild(chip);
      });
      ap.appendChild(chips);
      if (!elig.length) ap.insertAdjacentHTML("beforeend", `<div style="font-size:12px;color:${C.muted};margin-top:6px">${t("room.noOne")}</div>`);
    }
    this.sheetBody.appendChild(ap);

    const up = el("button", "btn wide primary")                     ;
    up.dataset.act = "up";
    up.style.flex = "1";
    up.addEventListener("click", () => this.hooks.renovate(i));
    this.sheetFoot.appendChild(up);
    const chosen = elig.find((k) => s.applicants[k].id === this.selApp) ?? elig[elig.length - 1];
    if (chosen !== undefined && !room.damaged) {
      const a = s.applicants[chosen];
      const mv = el("button", "btn wide primary")                     ;
      mv.dataset.act = "movein";
      mv.style.flex = "1";
      mv.innerHTML = `<span class="lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t("room.moveIn")}</span>`;
      mv.addEventListener("click", () => this.hooks.moveIn(i, a.id));
      this.sheetFoot.appendChild(mv);
    }
    this.liveSheet();
  }

          fixtureZone(lv        , next        )              {
    const z = el("div", "zone");
    const dots = el("div", "mp-row");
    dots.style.cssText = "gap:5px;margin-bottom:6px";
    for (let l = 1; l <= MAX_LV; l++) {
      const d = el("span");
      d.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid ${C.outline};flex:0 0 14px;background:${l <= lv ? C.gold : C.paper}`;
      dots.appendChild(d);
    }
    const lvTxt = el("span");
    lvTxt.style.cssText = `font-size:12px;font-weight:800;margin-left:4px;color:${C.text}`;
    lvTxt.textContent = `${t("room.fixture")} Lv${lv}`;
    dots.appendChild(lvTxt);
    z.appendChild(dots);
    const nx = el("div", "mp-row");
    nx.style.cssText = `font-size:12.5px;color:${C.muted};line-height:1.35;align-items:center;gap:8px`;
    if (next) {
      nx.innerHTML = `<img src="${FIX_IMG[next]}" alt="" style="width:46px;height:30px;object-fit:contain;flex:0 0 46px">
        <span style="min-width:0">${t("room.next")}: <b style="color:${C.text}">${t(FIXTURE_KEY[next])}</b><br>
        <span class="mp-num">${t("room.rent")} ¥${RENT[lv]} → <b style="color:${C.accentShadow}">¥${RENT[next]}</b>${t("hud.perSec")} · ${t("hud.rep")} +${UPGRADE_REP[next]}</span></span>`;
    } else nx.textContent = t("room.max");
    z.appendChild(nx);
    return z;
  }


  /** Live-updating numbers inside an open sheet. */
          appSig = "";
          crimeZoneSig = "";
          lvSig = "";
          liveSheet() {
    const s = this.state ;
    if (this.sel < 0) return;
    // the building shrunk while the sheet was open (new game / start over): close it instead of crashing
    if (!s.rooms[this.sel]) this.closeSheet();
    const o = s.rooms[this.sel]?.occupant;
    // applicants arrive and give up while the sheet is open: re-render the vacant view when the list changes
    const sig = o ? `occ:${o.sat > 0}` : s.applicants.map((a) => a.id).join(",");
    const lvSig = `${this.sel}:${s.rooms[this.sel]?.lv}:${s.rooms[this.sel]?.damaged ? 1 : 0}:${s.storm.phase}:${isShut(s, this.sel) ? 1 : 0}`;
    if (sig !== this.appSig || lvSig !== this.lvSig) {
      this.appSig = sig; this.lvSig = lvSig;
      this.renderSheet();
      return;
    }
    const sat = this.sheetBody.querySelector(".satFill")                      ;
    if (sat && o) {
      const a = Math.max(0, Math.min(1, o.sat / SAT_MAX));
      sat.style.width = `${a * 100}%`;
      sat.style.background = a > 0.45 ? C.success : a > 0.22 ? C.gold : C.danger;
      const num = this.sheetBody.querySelector(".satNum")                      ;
      if (num) {
        const rate = satDecayRate(s, this.sel);
        num.textContent = rate > 0 ? `${Math.floor(o.sat)}/100 · ${secs(o.sat / rate)}` : `${Math.floor(o.sat)}/100 · ${t("room.stable")}`;
      }
    }
    const rentNow = this.sheetBody.querySelector(".rentNow")                      ;
    if (rentNow && o) {
      const f = o.factor || 1;
      const txt = `${t("room.rent")} ¥${fmtRate(roomRent(s, this.sel))}${t("hud.perSec")} · ${Math.round(f * 100)}%` + (eventActive() ? ` · 🎉${t("ev.tag")}` : "");
      if (rentNow.textContent !== txt) rentNow.textContent = txt;
      const v = rentVerdict(s, this.sel);
      const pill = this.sheetBody.querySelector(".rentVerdict")               ;
      const key = v < 0 ? "rent.cheap" : v > 0 ? "rent.high" : "rent.fair";
      const label = t(key);
      if (pill.textContent !== label) {
        pill.textContent = label;
        pill.style.background = v > 0 ? C.warnTint : v < 0 ? C.successTint : C.paper;
        pill.style.color = v > 0 ? C.warnText : v < 0 ? C.successText : C.text;
      }
      const hint = this.sheetBody.querySelector(".rentHint")               ;
      const hTxt = t("rent.hint", { n: fmtYen(fairRentYen(s, this.sel)) });
      if (hint.textContent !== hTxt) hint.textContent = hTxt;
      const slider = this.sheetBody.querySelector(".rentSlider")                    ;
      const want = String(Math.round(f * 100));
      if (slider.value !== want && document.activeElement !== slider) slider.value = want;
      const input = this.sheetBody.querySelector(".rentInput")                    ;
      const shown = fmtYen(roomRent(s, this.sel));
      if (!input.dataset.editing && input.value !== shown) input.value = shown;
      const rg = rentRange(s, this.sel);
      const ends = this.sheetBody.querySelectorAll(".rentRange span");
      const lo = `¥${fmtYen(rg.min)}`, hi = `¥${fmtYen(rg.max)}`;
      if (ends[0].textContent !== lo) { ends[0].textContent = lo; ends[1].textContent = hi; }
      const cur = roomRent(s, this.sel), step = rentStep(rg.base);
      (this.sheetBody.querySelector("[data-act='rentDown']")                     ).disabled = cur - step < rg.min - 1e-6;
      (this.sheetBody.querySelector("[data-act='rentUp']")                     ).disabled = cur + step > rg.max + 1e-6;
    }
    const czSig = s.crime.phase !== "quiet" && s.crime.room === this.sel ? s.crime.phase : "";
    if (czSig !== this.crimeZoneSig) { this.crimeZoneSig = czSig; this.renderSheet(); return; }
    const cz = this.sheetBody.querySelector(".crimeZone")                      ;
    if (cz && s.crime.phase === "suspect") {
      const line = cz.querySelector(".crimeTimer")                      ;
      const txt = secs(s.crime.timer);
      if (line && line.textContent !== txt) line.textContent = txt;
    }
    const sz = this.sheetBody.querySelector(".stormZone")                      ;
    if (sz) {
      const timerLine = sz.firstElementChild               ;
      if (s.storm.phase === "forecast" && !s.rooms[this.sel].damaged) {
        const txt = t("storm.coming", { n: secs(s.storm.timer) });
        if (timerLine.textContent !== txt) timerLine.textContent = txt;
      }
      const rb = sz.querySelector("[data-act='repair']")                            ;
      if (rb) { const ok = s.money >= repairCost(s.rooms[this.sel].lv); rb.disabled = !ok; rb.className = "btn wide " + (ok ? "primary" : "off"); }
      const sb = sz.querySelector("[data-act='shutter']")                            ;
      if (sb) { const ok = canShutter(s, this.sel) && s.money >= shutterCost(s.rooms[this.sel].lv); sb.disabled = !ok; sb.className = "btn wide" + (ok ? "" : " off"); }
    }
    const talk = this.sheetFoot.querySelector("[data-act='talk']")                            ;
    const act = this.sheetBody.querySelector(".actStatus")                      ;
    if (act) {
      const a = o ? this.hooks.activity(this.sel) : null;
      const txt = a === "roof" ? t("room.onRoof") : a === "out" ? t("room.out") : "";
      if (act.textContent !== txt) act.textContent = txt;
      act.style.display = txt ? "block" : "none";
    }
    if (talk) {
      const w = talkWait(s, this.sel, this.now);
      talk.disabled = w > 0;
      talk.className = "btn wide" + (w > 0 ? " off" : "");
      // only touch the DOM when the label changes — rewriting it every frame can swallow a tap
      const label = `${t("room.talk")}${w > 0 ? ` · ${t("room.talkWait", { n: w })}` : ""}`;
      if (talk.dataset.label !== label) { talk.dataset.label = label; talk.innerHTML = `<span class="mp-ico">${SVG.hand}</span><span class="lbl">${esc(label)}</span>`; }
    }
    const up = this.sheetFoot.querySelector("[data-act='up']")                            ;
    if (up) {
      const room = s.rooms[this.sel];
      const lv = room.lv;
      const cost = upgradeCost(lv);
      const can = lv < MAX_LV && s.money >= cost;
      up.disabled = !can;
      up.className = "btn wide" + (can ? " primary" : " off");
      const label = lv >= MAX_LV ? t("room.max") : `${t("room.upgrade")} · ¥${fmtMoney(cost)}`;
      if (up.dataset.label !== label) { up.dataset.label = label; up.innerHTML = `<span class="lbl">${esc(label)}</span>`; }
    }
  }

  // ------------------------------------------------------------ transient

  /** Toasts queue in one stack (never on top of each other) and stay left of a docked side panel. */
          toastStack                     = null;
  toast(msg        ) {
    if (!this.toastStack) {
      this.toastStack = el("div");
      this.worldLayer.appendChild(this.toastStack);
    }
    const st = this.toastStack;
    this.placeToasts();
    while (st.childElementCount >= 3) st.firstElementChild .remove();
    const wrap = el("div");
    wrap.style.cssText = `display:flex;justify-content:center;max-width:100%`;
    const b = el("div");
    b.style.cssText = `background:${C.outline};color:${C.paper};font-size:13px;font-weight:700;border-radius:999px;
      padding:6px 14px;animation:mpFadeUp 2.1s ease-out forwards;max-width:86%;text-align:center`;
    b.textContent = msg;
    wrap.appendChild(b);
    st.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2200);
  }
  floatText(x        , y        , text        , color         = C.accentShadow) {
    const f = el("div");
    f.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:14px;font-weight:800;color:${color};
      text-shadow:0 1px 0 ${C.paper};pointer-events:none;animation:mpRise 1.1s ease-out forwards`;
    f.textContent = text;
    this.worldLayer.appendChild(f);
    setTimeout(() => f.remove(), 1150);
  }

  // ------------------------------------------------------------ modals

  closeModal() { this.modalLayer.innerHTML = ""; }

  /** Incident row inside the room sheet: report / have a word, or "squad moving in". */
          crimeZone(s           , i        )                     {
    const c = s.crime;
    if (c.phase === "quiet" || c.room !== i) return null;
    const z = el("div", "zone crimeZone");
    z.style.cssText += `background:${C.warnTint};border-color:${C.warnText}`;
    if (c.phase === "raid") {
      z.innerHTML = `<div style="font-size:13px;font-weight:800;color:${C.warnText}">${esc(t("crime.raid"))}</div>`;
      return z;
    }
    z.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:800;color:${C.warnText}">
        <span>${esc(t("crime.room"))} · ${esc(t("crime." + c.crime))}</span><span class="crimeTimer mp-num">${secs(c.timer)}</span></div>
      <div style="font-size:11.5px;color:${C.text};margin:2px 0 8px;line-height:1.35">${esc(t("crime.ignore"))}</div>`;
    const row = el("div");
    row.style.cssText = "display:flex;gap:8px";
    const rp = el("button", "btn wide primary")                     ;
    rp.dataset.act = "report";
    rp.style.flex = "1";
    rp.innerHTML = `<span class="lbl">${esc(t("crime.report"))}</span>`;
    rp.addEventListener("click", () => this.hooks.reportCrime());
    const wn = el("button", "btn wide")                     ;
    wn.dataset.act = "warn";
    wn.style.flex = "1";
    wn.innerHTML = `<span class="lbl">${esc(t("crime.warn"))}</span>`;
    wn.addEventListener("click", () => this.hooks.warnTenant());
    row.append(rp, wn);
    z.appendChild(row);
    return z;
  }

  /** Incident panel (from the HUD chip). */
  openCrime(s           , goTo            ) {
    const rb = s.rob;
    if (rb.phase !== "quiet") {
      const b2 = el("div");
      const p2 = el("p");
      p2.style.cssText = `margin:0 0 10px;font-size:13px;line-height:1.45;color:${C.text}`;
      p2.textContent = rb.phase === "squad" ? t("rob.suite")
        : rb.phase === "loot" ? t("rob.lootNow", { n: rb.room + 1, n2: secs(rb.timer) })
        : t("rob.sneakNow", { n: rb.room + 1, n2: secs(rb.timer) }) + "\n" + t("rob.reportDesc");
      b2.appendChild(p2);
      const foot2 = el("div");
      foot2.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px";
      if (rb.phase !== "squad") {
        const rp2 = el("button", "btn wide primary")                     ;
        rp2.dataset.act = "reportRobbery";
        rp2.innerHTML = `<span class="lbl">${esc(t("rob.report"))}</span>`;
        rp2.addEventListener("click", () => { this.hooks.reportRobbery(); this.closeModal(); });
        foot2.appendChild(rp2);
      }
      const go2 = el("button", "btn wide")                     ;
      go2.innerHTML = `<span class="lbl">${esc(t("rob.goto"))}</span>`;
      go2.addEventListener("click", () => { this.closeModal(); goTo(); });
      foot2.appendChild(go2);
      const close2 = el("button", "btn wide")                     ;
      close2.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
      close2.addEventListener("click", () => this.closeModal());
      foot2.appendChild(close2);
      this.modal(t("rob.title"), b2, foot2);
      return;
    }
    const c = s.crime;
    const b = el("div");
    const p = el("p");
    p.style.cssText = `margin:0 0 10px;font-size:13px;line-height:1.45;color:${C.text}`;
    p.textContent = c.phase === "suspect"
      ? t("crime.panel", { n: c.room + 1, crime: t("crime." + c.crime), n2: secs(c.timer) })
      : c.phase === "raid" ? t("crime.panelRaid", { n: c.room + 1 }) : t("crime.panelAfter");
    b.appendChild(p);
    const foot = el("div");
    foot.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px";
    if (c.phase === "suspect") {
      const rp = el("button", "btn wide primary")                     ;
      rp.dataset.act = "reportAll";
      rp.innerHTML = `<span class="lbl">${esc(t("crime.report"))}</span>`;
      rp.addEventListener("click", () => { this.hooks.reportCrime(); this.closeModal(); });
      const wn = el("button", "btn wide")                     ;
      wn.innerHTML = `<span class="lbl">${esc(t("crime.warn"))}</span>`;
      wn.addEventListener("click", () => { this.hooks.warnTenant(); this.closeModal(); });
      foot.append(rp, wn);
    }
    if (c.phase !== "quiet") {
      const go = el("button", "btn wide")                     ;
      go.innerHTML = `<span class="lbl">${esc(t("crime.goto"))}</span>`;
      go.addEventListener("click", () => { this.closeModal(); goTo(); });
      foot.appendChild(go);
    }
    const close = el("button", "btn wide")                     ;
    close.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
    close.addEventListener("click", () => this.closeModal());
    foot.appendChild(close);
    this.modal(t("crime.title"), b, foot);
  }

  /** Typhoon row inside the room sheet: damage + repair, or shutter during the forecast. */
          robberyZoneOf(s           , i        )                     {
    const r = s.rob;
    if (r.phase === "quiet" || r.room !== i) return null;
    const z = el("div", "zone robberyZone");
    z.style.cssText += `background:${C.warnTint};border-color:${C.warnText}`;
    const remain = r.phase === "squad" ? t("rob.suite") : (r.phase === "loot" ? t("rob.lootNow", { n: r.room + 1, n2: secs(r.timer) }) : t("rob.sneakNow", { n: r.room + 1, n2: secs(r.timer) }));
    z.innerHTML = `<div style="font-size:13px;font-weight:800;color:${C.warnText}">${esc(remain)}</div>`;
    if (r.phase !== "squad") {
      const rp = el("button", "btn wide primary")                     ;
      rp.dataset.act = "reportRobbery";
      rp.style.marginTop = "8px";
      rp.innerHTML = `<span class="lbl">${esc(t("rob.report"))}</span>`;
      rp.addEventListener("click", () => this.hooks.reportRobbery());
      z.appendChild(rp);
    }
    return z;
  }

          stormZone(s           , i        )                     {
    const room = s.rooms[i];
    const z = el("div", "zone stormZone");
    if (room.damaged) {
      z.style.cssText += `background:${C.warnTint};border-color:${C.warnText}`;
      const cost = repairCost(room.lv);
      z.innerHTML = `<div style="font-size:13px;font-weight:800;color:${C.warnText}">${esc(t("storm.roomHit"))}</div>
        <div style="font-size:11.5px;color:${C.text};margin:2px 0 8px;line-height:1.35">${esc(t(room.occupant ? "storm.roomHitBody" : "storm.roomHitVacant"))}</div>`;
      const b = el("button", "btn wide primary")                     ;
      b.dataset.act = "repair";
      b.style.width = "100%";
      b.innerHTML = `<span class="lbl">${esc(t("storm.repair", { n: fmtMoney(cost) }))}</span>`;
      b.addEventListener("click", () => this.hooks.repair(i));
      z.appendChild(b);
      return z;
    }
    if (s.storm.phase === "forecast") {
      const shut = isShut(s, i);
      z.innerHTML = `<div style="font-size:13px;font-weight:800;color:${C.text}">${esc(t("storm.coming", { n: secs(s.storm.timer) }))}</div>
        <div style="font-size:11.5px;color:${C.muted};margin:2px 0 8px;line-height:1.35">${esc(t(shut ? "storm.shutDone" : "storm.shutHint"))}</div>`;
      if (!shut) {
        const b = el("button", "btn wide")                     ;
        b.dataset.act = "shutter";
        b.style.width = "100%";
        b.innerHTML = `<span class="lbl">${esc(t("storm.shut", { n: fmtMoney(shutterCost(room.lv)) }))}</span>`;
        b.addEventListener("click", () => this.hooks.shutter(i));
        z.appendChild(b);
      }
      return z;
    }
    return null;
  }

  /** Typhoon panel (from the HUD chip): what is happening, plus the bulk actions. */
  openStorm(s           ) {
    const b = el("div");
    const st = s.storm;
    const p = el("p");
    p.style.cssText = `margin:0 0 10px;font-size:13px;line-height:1.45;color:${C.text}`;
    const plan = repairPlan(s);
    p.textContent = st.phase === "forecast" ? t("storm.panelForecast", { n: secs(st.timer) })
      : st.phase === "storm" ? t("storm.panelNow")
      : plan.rooms.length ? t("storm.panelAfter", { n: plan.rooms.length }) : t("storm.panelCalm");
    b.appendChild(p);
    const foot = el("div");
    foot.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px";
    if (st.phase === "forecast") {
      const sp = shutterPlan(s);
      const btn = el("button", "btn wide primary")                     ;
      btn.dataset.act = "shutterAll";
      btn.disabled = !sp.rooms.length || s.money < sp.cost;
      if (btn.disabled) btn.className = "btn wide off";
      btn.innerHTML = `<span class="lbl">${esc(sp.rooms.length ? t("storm.shutAll", { r: sp.rooms.length, n: fmtMoney(sp.cost) }) : t("storm.allShut"))}</span>`;
      btn.addEventListener("click", () => { this.hooks.shutterAll(); this.closeModal(); });
      foot.appendChild(btn);
    } else if (plan.rooms.length) {
      const btn = el("button", "btn wide primary")                     ;
      btn.dataset.act = "repairAll";
      const afford = s.money >= plan.cost;
      btn.disabled = !afford;
      if (!afford) btn.className = "btn wide off";
      btn.innerHTML = `<span class="lbl">${esc(t("storm.repairAll", { r: plan.rooms.length, n: fmtMoney(plan.cost) }))}</span>`;
      btn.addEventListener("click", () => { this.hooks.repairAll(); this.closeModal(); });
      foot.appendChild(btn);
    }
    const close = el("button", "btn wide")                     ;
    close.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
    close.addEventListener("click", () => this.closeModal());
    foot.appendChild(close);
    this.modal(t("storm.title"), b, foot);
  }

          modal(title        , body             , foot              )              {
    const fresh = !this.modalLayer.firstElementChild;
    this.closeModal();
    const back = el("div", "mp-hit");
    // a modal opened by a canvas tap: swallow the touch's trailing compatibility click so it
    // cannot land on whatever button now sits under the finger (e.g. Close)
    if (fresh) {
      const born = performance.now();
      back.addEventListener("click", (e) => { if (performance.now() - born < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
    }
    back.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:${C.scrim}cc;padding:14px`;
    const card = el("div");
    card.style.cssText = `width:100%;max-width:360px;max-height:88%;display:flex;flex-direction:column;background:${C.surface};
      border:3px solid ${C.outline};border-radius:18px;padding:12px;box-shadow:0 8px 0 rgba(34,48,61,.35)`;
    const h = el("h3");
    h.style.cssText = `margin:0 0 10px;font-size:18px;font-weight:800;color:${C.text};text-align:center`;
    h.textContent = title;
    const scroll = el("div", "sheet-body");
    scroll.setAttribute("data-mp-scroll", "");
    scroll.style.minHeight = "0";
    scroll.appendChild(body);
    const f = foot ?? el("div");
    if (!foot) {
      const close = el("button", "btn wide")                     ;
      close.style.marginTop = "10px";
      close.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
      close.addEventListener("click", () => this.closeModal());
      f.appendChild(close);
    }
    card.append(h, scroll, f);
    back.appendChild(card);
    back.addEventListener("click", (e) => { if (e.target === back) this.closeModal(); });
    this.modalLayer.appendChild(back);
    return card;
  }

          langZone()              {
    const z = el("div", "zone");
    z.innerHTML = `<h4>${t("menu.lang")}</h4>`;
    const row = el("div");
    row.style.cssText = "display:flex;gap:7px;flex-wrap:wrap";
    for (const k of ORDER) {
      const b = el("button", "langbtn" + (getLang() === k ? " on" : ""))                     ;
      b.textContent = NATIVE[k];
      b.setAttribute("aria-pressed", getLang() === k ? "true" : "false");
      b.addEventListener("click", () => this.hooks.setLanguage(k));
      row.appendChild(b);
    }
    z.appendChild(row);
    return z;
  }

          slider(label        , v        , on                     )              {
    const row = el("div", "rowline");
    const lb = el("span");
    lb.textContent = label;
    lb.style.flex = "0 0 64px";
    const inp = el("input")                    ;
    inp.type = "range";
    inp.min = "0";
    inp.max = "100";
    inp.value = String(Math.round(v * 100));
    inp.style.cssText = `flex:1;accent-color:${C.accent};height:32px`;
    inp.addEventListener("input", () => on(Number(inp.value) / 100));
    inp.setAttribute("aria-label", label);
    row.append(lb, inp);
    return row;
  }

          switchRow(label        , on         , toggle                      )              {
    const row = el("div", "rowline");
    const lb = el("span");
    lb.textContent = label;
    lb.style.flex = "1";
    const sw = el("button")                     ;
    let state = on;
    const paint = () => {
      sw.style.cssText = `width:52px;height:30px;border-radius:999px;border:2px solid ${C.outline};
        background:${state ? C.success : C.disabled};position:relative;flex:0 0 52px`;
      sw.innerHTML = `<i style="position:absolute;top:1px;left:${state ? "23px" : "1px"};width:24px;height:24px;border-radius:50%;
        background:${C.paper};border:2px solid ${C.outline};transition:left .18s"></i>`;
    };
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", on ? "true" : "false");
    sw.setAttribute("aria-label", label);
    paint();
    sw.addEventListener("click", () => { state = !state; sw.setAttribute("aria-checked", state ? "true" : "false"); paint(); toggle(state); });
    row.appendChild(lb);
    row.appendChild(sw);
    return row;
  }

  openDebug(s            ) {
    const b = el("div");
    const note = el("p");
    note.style.cssText = `margin:0 0 8px;font-size:12px;color:${C.muted}`;
    note.textContent = t("dbg.note");
    b.appendChild(note);
    if (s) {
      const tot = el("p");
      tot.style.cssText = `margin:0 0 10px;font-size:13px;font-weight:800;color:${C.text}`;
      tot.textContent = t("dbg.totalLabel", { n: "¥" + fmtMoney(s.total) });
      b.appendChild(tot);
    }
    for (const yen of [100000000, 1000000000000, 1000000000000000, 1000000000000000000]) {
      const g = el("button", "btn wide primary")                     ;
      g.style.cssText += "width:100%;margin-bottom:8px;font-size:15px;min-height:48px";
      g.innerHTML = `<span class="lbl">${esc(t("dbg.give", { n: fmtMoney(yen) }))}</span>`;
      g.addEventListener("click", () => { this.hooks.debugGive(yen); this.closeModal(); });
      b.appendChild(g);
    }
    const sc = el("button", "btn wide")                     ;
    sc.style.cssText += "width:100%;font-size:15px;min-height:48px";
    sc.innerHTML = `<span class="lbl">${esc(t("dbg.score"))}</span>`;
    sc.addEventListener("click", () => { this.hooks.debugScore(); this.closeModal(); });
    b.appendChild(sc);
    const si = el("button", "btn wide")                     ;
    si.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    si.innerHTML = `<span class="lbl">${esc(t("dbg.scoreInf"))}</span>`;
    si.addEventListener("click", () => { this.hooks.debugScoreInf(); this.closeModal(); });
    b.appendChild(si);
    const fl = el("button", "btn wide")                     ;
    fl.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    fl.innerHTML = `<span class="lbl">${esc(t("dbg.floors", { n: 500 }))}</span>`;
    fl.addEventListener("click", () => { this.hooks.debugSetFloors(500); this.closeModal(); });
    b.appendChild(fl);
    const kb = el("button", "btn wide")                     ;
    kb.dataset.act = "dbgKonbini";
    kb.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    kb.innerHTML = `<span class="lbl">${esc(s?.konbini ? t("dbg.kbHave") : t("dbg.konbini"))}</span>`;
    kb.disabled = !!s?.konbini;
    if (s?.konbini) kb.className = "btn wide off";
    kb.addEventListener("click", () => { this.closeModal(); this.hooks.debugKonbini(); });
    b.appendChild(kb);
    const tw = el("button", "btn wide")                     ;
    tw.dataset.act = "dbgTwin";
    tw.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    tw.innerHTML = `<span class="lbl">${esc(s?.twin ? t("dbg.twinHave") : t("dbg.twin"))}</span>`;
    tw.disabled = !!s?.twin;
    if (s?.twin) tw.className = "btn wide off";
    tw.addEventListener("click", () => { this.closeModal(); this.hooks.debugTwin(); });
    b.appendChild(tw);
    const evb = el("button", "btn wide")                     ;
    evb.dataset.act = "dbgEvent";
    evb.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    const evMode = eventOverride === null ? t("dbg.evAuto") : eventOverride ? t("dbg.evOn") : t("dbg.evOff");
    evb.innerHTML = `<span class="lbl">${esc(t("dbg.ev", { m: evMode }))}</span>`;
    evb.addEventListener("click", () => { this.closeModal(); this.hooks.debugEvent(); });
    b.appendChild(evb);
    const inf = el("button", "btn wide" + (s?.infCheat ? " primary" : ""))                     ;
    inf.dataset.act = "dbgInf";
    inf.style.cssText += "width:100%;font-size:15px;min-height:48px;margin-top:8px";
    inf.innerHTML = `<span class="lbl">${esc(s?.infCheat ? t("dbg.infStop") : t("dbg.inf"))}</span>`;
    inf.addEventListener("click", () => { this.closeModal(); this.hooks.debugInfMoney(!s?.infCheat); });
    b.appendChild(inf);
    this.modal(t("dbg.title"), b);
  }

  openMenu(s           , vols                              , muted         , shopAvailable         , delegateCost        ) {
    const b = el("div");
    b.appendChild(this.langZone());
    const audio = el("div", "zone");
    audio.innerHTML = `<h4>${t("menu.title")}</h4>`;
    audio.appendChild(this.slider(t("menu.bgm"), vols.bgm, (v) => this.hooks.setVolume("bgm", v)));
    audio.appendChild(this.slider(t("menu.sfx"), vols.sfx, (v) => this.hooks.setVolume("sfx", v)));
    audio.appendChild(this.switchRow(t("menu.sfx") + " / " + t("menu.bgm") + " OFF", muted, (v) => this.hooks.setMuted(v)));
    b.appendChild(audio);

    const dz = el("div", "zone");
    dz.innerHTML = `<h4>${t("menu.delegate")}</h4><div style="font-size:12.5px;color:${C.muted};line-height:1.4">${t("menu.delegateDesc")}</div>`;
    if (!s.delegate) {
      const buy = el("button", "btn wide" + (s.money >= delegateCost ? " primary" : " off"))                     ;
      buy.style.marginTop = "8px";
      buy.innerHTML = `<span class="lbl">${t("menu.delegateBuy")}</span>`;
      buy.disabled = s.money < delegateCost;
      buy.addEventListener("click", () => this.hooks.buyDelegate());
      dz.appendChild(buy);
    } else {
      dz.appendChild(this.switchRow("ON", s.delegate, (v) => this.hooks.toggleDelegate(v)));
    }
    b.appendChild(dz);

    // the disaster DLC bundles an admin mode: a settings toggle for the disaster button panel
    if (s.quake.dlc) {
      const adm = el("div", "zone");
      adm.innerHTML = `<h4>${t("adm.title")}</h4>`;
      adm.appendChild(this.switchRow(t("adm.toggle"), s.quake.adminOn, (on) => this.hooks.adminToggle(on)));
      b.appendChild(adm);
    }

    if (shopAvailable) {
      const sh = el("button", "btn wide")                     ;
      sh.style.marginBottom = "8px";
      sh.innerHTML = `<span class="mp-ico">${SVG.bag}</span><span class="lbl">${t("hud.shop")}</span>`;
      sh.addEventListener("click", () => this.hooks.openShop());
      b.appendChild(sh);
    }
    const tb = el("button", "btn wide")                     ;
    tb.style.marginBottom = "8px";
    tb.dataset.act = "tutorial";
    tb.innerHTML = `<span class="lbl">${t("menu.tutorial")}</span>`;
    tb.addEventListener("click", () => { this.closeModal(); this.hooks.replayTutorial(); });
    b.appendChild(tb);
    const rz = el("div", "zone");
    const rb = el("button", "btn wide off")                     ;
    rb.innerHTML = `<span class="lbl">${t("menu.reset")}</span>`;
    rb.addEventListener("click", () => this.confirm(t("menu.resetAsk"), () => this.hooks.startOver()));
    rz.appendChild(rb);
    b.appendChild(rz);
    this.modal(t("menu.title"), b);
  }

  confirm(text        , onYes            ) {
    const b = el("div");
    const p = el("p");
    p.style.cssText = `margin:0;font-size:13.5px;color:${C.text};line-height:1.45`;
    p.textContent = text;
    b.appendChild(p);
    const foot = el("div", "mp-row");
    foot.style.marginTop = "10px";
    const no = el("button", "btn wide")                     ;
    no.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
    no.addEventListener("click", () => this.closeModal());
    const yes = el("button", "btn wide primary")                     ;
    yes.innerHTML = `<span class="lbl">${t("btn.ok")}</span>`;
    yes.addEventListener("click", () => { this.closeModal(); onYes(); });
    foot.append(no, yes);
    this.modal(t("menu.reset"), b, foot);
  }

  openRanking(rows       , me                                        ) {
    const b = el("div");
    const sub = el("div");
    sub.style.cssText = `font-size:12px;font-weight:800;color:${C.muted};margin-bottom:6px`;
    sub.textContent = t("rank.body");
    b.appendChild(sub);
    const list = el("div", "rank-list");
    list.setAttribute("data-mp-scroll", "");
    list.style.maxHeight = "46vh";
    if (!rows.length) {
      list.innerHTML = `<div style="font-size:12.5px;color:${C.muted}">${t("rank.empty")}</div>`;
    }
    for (const r of rows) {
      const row = el("div", "mp-row");
      row.style.cssText = `padding:6px 4px;border-bottom:1px dashed #d5cbb3;gap:8px${r.isMe ? `;background:${C.surfaceStrong};border-radius:8px` : ""}`;
      const rk = el("span");
      rk.style.cssText = `font-size:12px;font-weight:800;color:${C.muted};min-width:26px`;
      rk.textContent = `#${r.rank ?? 0}`;
      // nothing must draw if the avatar URL is missing or fails — guard both ways
      const img = document.createElement("img");
      img.alt = "";
      if (r.avatar) img.src = r.avatar;
      img.onerror = () => img.remove();
      img.style.cssText = `width:30px;height:30px;border-radius:50%;border:1.5px solid ${C.outline};background:${C.paper};flex:0 0 30px`;
      const nm = el("span");
      nm.style.cssText = `flex:1;min-width:0;font-size:13.5px;font-weight:700;color:${C.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
      nm.textContent = r.name;
      row.append(rk, img, nm);
      if (r.mutual) {
        const mu = el("span");
        mu.style.cssText = `font-size:10px;font-weight:800;color:${C.info};border:1.5px solid ${C.info};border-radius:6px;padding:0 4px`;
        mu.textContent = t("rank.mutual");
        row.appendChild(mu);
      }
      // original leaderboard look: rent amount only (no TA time badge anywhere)
      const sc = el("span", "sh mp-num");
      sc.textContent = "¥" + fmtMoney(boardRentYen(r.score));
      row.appendChild(sc);
      if (r.userId) {
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        row.classList.add("mp-hit");
        row.style.cursor = "pointer";
        const act = () => this.hooks.openRow(r);
        row.addEventListener("click", act);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
        });
      }
      list.appendChild(row);
    }
    b.appendChild(list);
    if (me) {
      const p = el("p");
      p.style.cssText = `margin:8px 0 0;font-size:12.5px;font-weight:800;color:${C.text}`;
      p.textContent = t("rank.me") + ": #" + me.rank + " · ¥" + fmtMoney(boardRentYen(me.score));
      b.appendChild(p);
    }
    this.modal(t("rank.title"), b);
  }

  openPlayerMenu(name        , onDetails            , onProfile            , profileOk         ) {
    const b = el("div");
    const p = el("p");
    p.style.cssText = `margin:0 0 8px;font-size:14px;font-weight:800;color:${C.text}`;
    p.textContent = name;
    b.appendChild(p);
    const foot = el("div");
    foot.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:4px";
    const d = el("button", "btn wide")                     ;
    d.innerHTML = `<span class="lbl">${t("rank.view")}</span>`;
    d.addEventListener("click", () => { this.closeModal(); onDetails(); });
    foot.appendChild(d);
    if (profileOk) {
      const pf = el("button", "btn wide primary")                     ;
      pf.innerHTML = `<span class="lbl">${t("rank.profile")}</span>`;
      pf.setAttribute("aria-label", `${t("rank.profile")} (opens in a new tab)`);
      pf.title = `${t("rank.profile")} (opens in a new tab)`;
      pf.addEventListener("click", () => onProfile());
      foot.appendChild(pf);
    }
    this.modal(name, b, foot);
  }

  openDetails(name        , avatar        , rank        , score        , status     ) {
    const b = el("div");
    const head = el("div", "mp-row");
    head.innerHTML = `<img src="${avatar}" alt="" style="width:52px;height:52px;border-radius:50%;border:2px solid ${C.outline}">
      <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:${C.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>
      <div style="font-size:12px;color:${C.muted}">#${rank} · ¥${fmtMoney(boardRentYen(score))}</div></div>`;
    b.appendChild(head);
    const g = el("div");
    g.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px";
    const st = status ?? {};
    const cells                     = [
      [t("st.floors"), st.floors === undefined ? "—" : String(st.floors)],
      [t("st.rooms"), st.rooms === undefined ? "—" : String(st.rooms)],
      [t("st.rate"), st.pct === undefined ? "—" : `${st.pct}%`],
      [t("st.money"), st.money === undefined ? "—" : "¥" + fmtMoney(Number(st.money))],
      [t("st.rep"), st.rep === undefined ? "—" : String(st.rep)],
      [t("st.income"), st.total === undefined ? "—" : "¥" + fmtMoney(Number(st.total))],
    ];
    for (const [k, v] of cells) {
      const cell = el("div");
      cell.style.cssText = `background:${C.paper};border:2px solid ${C.outline};border-radius:10px;padding:7px 9px`;
      cell.innerHTML = `<div style="font-size:11px;font-weight:700;color:${C.muted}">${esc(k)}</div>
        <div class="sh mp-num" style="font-size:15px">${esc(v)}</div>`;
      g.appendChild(cell);
    }
    b.appendChild(g);
    this.modal(t("st.title"), b);
  }

  openRecord(s           , rank               , shareOk         ) {
    const b = el("div");
    const g = el("div");
    g.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px";
    const cells                     = [
      [t("st.floors"), `${s.floors}`],
      [t("st.rooms"), `${occupiedCount(s)}/${s.rooms.length}`],
      [t("st.rate"), `${Math.round((occupiedCount(s) / s.rooms.length) * 100)}%`],
      [t("st.money"), s.infBuy || s.infCheat ? "¥∞" : "¥" + fmtMoney(s.money)],
      [t("st.rep"), `${Math.floor(s.rep)}`],
      [t("st.income"), "¥" + fmtMoney(s.total)],
    ];
    for (const [k, v] of cells) {
      const cell = el("div");
      cell.style.cssText = `background:${C.paper};border:2px solid ${C.outline};border-radius:10px;padding:7px 9px`;
      cell.innerHTML = `<div style="font-size:11px;font-weight:700;color:${C.muted}">${esc(k)}</div>
        <div class="sh mp-num" style="font-size:15px">${esc(v)}</div>`;
      g.appendChild(cell);
    }
    b.appendChild(g);
    if (rank) {
      const p = el("p");
      p.style.cssText = `margin:8px 0 0;font-size:12.5px;font-weight:800;color:${C.text}`;
      p.textContent = `${t("rank.me")}: #${rank}`;
      b.appendChild(p);
    }
    const foot = el("div");
    if (shareOk) {
      const sh = el("button", "btn wide primary")                     ;
      sh.innerHTML = `<span class="lbl">${t("st.share")}</span>`;
      sh.addEventListener("click", () => this.hooks.share());
      foot.appendChild(sh);
    }
    const close = el("button", "btn wide")                     ;
    close.style.marginTop = "8px";
    close.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
    close.addEventListener("click", () => this.closeModal());
    foot.appendChild(close);
    this.modal(t("st.title"), b, foot);
  }

  openFullHouse(s           , shareOk         ) {
    const b = el("div");
    const p = el("p");
    p.style.cssText = `margin:0 0 8px;font-size:13.5px;color:${C.text};line-height:1.45`;
    p.textContent = t("msg.fullBody");
    b.appendChild(p);
    const g = el("div");
    g.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px";
    const cells                     = [
      [t("st.floors"), `${s.floors}`], [t("st.rooms"), `${occupiedCount(s)}/${s.rooms.length}`],
      [t("st.income"), "¥" + fmtMoney(s.total)], [t("st.rep"), `${Math.floor(s.rep)}`],
    ];
    for (const [k, v] of cells) {
      const cell = el("div");
      cell.style.cssText = `background:${C.paper};border:2px solid ${C.outline};border-radius:10px;padding:7px 9px`;
      cell.innerHTML = `<div style="font-size:11px;font-weight:700;color:${C.muted}">${esc(k)}</div>
        <div class="sh mp-num" style="font-size:15px">${esc(v)}</div>`;
      g.appendChild(cell);
    }
    b.appendChild(g);
    const foot = el("div");
    foot.style.marginTop = "10px";
    if (shareOk) {
      const sh = el("button", "btn wide primary")                     ;
      sh.style.marginBottom = "8px";
      sh.innerHTML = `<span class="lbl">${t("st.share")}</span>`;
      sh.addEventListener("click", () => this.hooks.share());
      foot.appendChild(sh);
    }
    const close = el("button", "btn wide")                     ;
    close.innerHTML = `<span class="lbl">${t("btn.close")}</span>`;
    close.addEventListener("click", () => this.closeModal());
    foot.appendChild(close);
    this.modal(t("msg.full", { n: s.rooms.length }), b, foot);
  }


  openShop(s           , balance               , available         , buy                      ) {
    const b = el("div");
    if (!available) {
      const p = el("p");
      p.style.cssText = `margin:0;font-size:13px;color:${C.muted}`;
      p.textContent = t("shop.off");
      b.appendChild(p);
      this.shopModal(b);
      return;
    }
    if (balance !== null && balance >= 0) {
      const p = el("p");
      p.style.cssText = `margin:0 0 8px;font-size:12.5px;font-weight:800;color:${C.text}`;
      p.textContent = `${t("shop.coins")}: ${balance}`;
      b.appendChild(p);
    }
    const boostLeft = Math.max(0, Math.ceil((s.boostUntil - this.now) / 60));
    // buildings & facilities: the konbini and the 2nd tower are bought in one shared block
    // コンビニ＋2棟目: one 50-coin set; owning one part still lets the player buy the set for the missing one
    const setOwn = !!s.konbini && !!s.twin;
    const twinWait = !!s.twin && s.floors < MAX_FLOORS;
    const parts = [
      { name: t("shop.konbini"), have: !!s.konbini },
      { name: t("shop.twin"), have: !!s.twin },
    ];
    const facilities = [
      { id: SHOP.set.itemId, name: t("shop.set"), desc: t("shop.setDesc"), price: SHOP.set.price, own: setOwn, parts,
        prog: twinWait || !s.twin ? Math.min(s.floors, MAX_FLOORS) / MAX_FLOORS : undefined,
        progLabel: t("shop.setTwinWait", { n: Math.min(s.floors, MAX_FLOORS) }),
        btn: setOwn ? t("shop.owned") : t("shop.buy", { n: SHOP.set.price }) },
    ];
    const items = [
      { id: SHOP.lounge.itemId, name: t("shop.lounge"), desc: t("shop.loungeDesc"), price: SHOP.lounge.price, own: s.lounge, btn: t("shop.owned") },
      { id: SHOP.quake.itemId, name: t("shop.quake"), desc: t("shop.quakeDesc"), price: SHOP.quake.price, own: s.quake.dlc, btn: s.quake.dlc ? t("shop.owned") : t("shop.buy", { n: SHOP.quake.price }), dlc: true },
      { id: SHOP.infMoney.itemId, name: t("shop.inf"), desc: t("shop.infDesc"), price: SHOP.infMoney.price, own: !!s.infBuy,
        btn: s.infBuy ? t("shop.owned") : t("shop.buy", { n: SHOP.infMoney.price }) },
      { id: SHOP.boost.itemId, name: t("shop.boost"), desc: t("shop.boostDesc"), price: SHOP.boost.price, own: false,
        btn: boostLeft > 0 ? t("shop.active", { n: boostLeft }) : t("shop.buy", { n: SHOP.boost.price }) },
    ];
    const card = (r     , parent             , inGroup         ) => {
      const row = el("div", "mp-row");
      row.style.cssText = `background:${C.paper};border:2px solid ${C.outline};border-radius:12px;padding:9px;margin-bottom:${inGroup ? 6 : 8}px;gap:9px;align-items:flex-start`;
      const info = el("div");
      info.style.cssText = "flex:1;min-width:0";
      const badge = r.dlc ? ' <span style="font-size:10px;background:' + C.accent + ';color:' + C.paper + ';border-radius:6px;padding:1px 5px">DLC</span>' : "";
      info.innerHTML = `<div style="font-size:14px;font-weight:800;color:${C.text}">${esc(r.name)}${badge}</div>
        <div style="font-size:11.5px;color:${C.muted};line-height:1.3">${esc(r.desc)}</div>`;
      if (r.parts) {
        info.innerHTML += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${r.parts.map((p                                 ) =>
          `<span style="font-size:11px;font-weight:800;border:1.5px solid ${C.outline};border-radius:7px;padding:1px 6px;background:${p.have ? C.successTint : C.paper};color:${p.have ? C.successText : C.text}">${p.have ? "✓ " : "+ "}${esc(p.name)}${p.have ? " · " + esc(t("shop.owned")) : ""}</span>`).join("")}</div>`;
      }
      if (r.prog !== undefined) {
        if (r.progLabel) info.innerHTML += `<div style="margin-top:5px;font-size:11px;font-weight:700;color:${C.muted};line-height:1.3">${esc(r.progLabel)}</div>`;
        info.innerHTML += `<div style="margin-top:3px;height:7px;border:1.5px solid ${C.outline};border-radius:5px;background:${C.surface};overflow:hidden"><div style="height:100%;width:${(r.prog * 100).toFixed(1)}%;background:${C.accent}"></div></div>`;
      }
      const sb = el("div");
      const btn = el("button", "btn")                     ;
      btn.style.minHeight = "48px";
      btn.dataset.item = r.id;
      if (r.lock) btn.style.maxWidth = "128px";
      if (r.own) { btn.className = "btn off"; btn.disabled = true; }
      // platform-coin price: official coin icon + the same number passed to purchase()
      btn.innerHTML = r.own || r.btn !== t("shop.buy", { n: r.price })
        ? `<span class="lbl" style="font-size:${r.lock ? 11 : 13}px;white-space:normal;line-height:1.25">${esc(r.btn)}</span>`
        : `${SVG.pcoin}<span class="lbl mp-num" style="font-size:15px">${r.price}</span>`;
      btn.setAttribute("aria-label", r.btn);
      btn.addEventListener("click", () => buy(r.id));
      sb.appendChild(btn);
      row.append(info, sb);
      parent.appendChild(row);
    };
    const grp = el("div");
    grp.dataset.group = "facilities";
    grp.style.cssText = `background:${C.surfaceStrong};border:2px solid ${C.outline};border-radius:14px;padding:8px 8px 2px;margin-bottom:10px`;
    const gh = el("div");
    gh.style.cssText = `font-size:12.5px;font-weight:800;color:${C.text};margin:0 2px 6px;letter-spacing:.04em`;
    gh.textContent = t("shop.facilities");
    grp.appendChild(gh);
    for (const r of facilities) card(r, grp, true);
    b.appendChild(grp);
    const ih = el("div");
    ih.style.cssText = `font-size:12.5px;font-weight:800;color:${C.muted};margin:0 4px 6px;letter-spacing:.04em`;
    ih.textContent = t("shop.items");
    b.appendChild(ih);
    for (const r of items) card(r, b, false);
    this.shopModal(b);
  }

  /** Shop dialog (also used by the offline branch) — carries the hidden debug unlock on its title. */
          shopModal(b             )       {
    const card2 = this.modal(t("shop.title"), b);
    let dbgTaps2           = [];
    const title2 = card2.querySelector("h3")                      ;
    if (title2) {
      title2.style.cursor = "pointer";
      title2.classList.add("mp-hit");
      title2.addEventListener("click", () => {
        const now2 = performance.now();
        dbgTaps2 = dbgTaps2.filter((x) => now2 - x < 4000);
        dbgTaps2.push(now2);
        if (dbgTaps2.length >= 7) { dbgTaps2 = []; this.closeModal(); this.hooks.debugTap(); }
      });
    }
  }

  // ------------------------------------------------------------ コンビニ management
          kbLive                                                                                                                                                                                     = null;
  get konbiniOpen() { return !!this.kbLive && this.kbLive.root.isConnected; }
  openKonbini(s           , info        ) {
    const k = s.konbini;
    if (!k) return;
    const b = el("div");
    b.dataset.kb = "1";
    // status
    const st = el("div", "zone");
    st.innerHTML = `<h4>${esc(t("kb.status"))} · Lv${k.lv}/${info.maxLv}</h4>`;
    const bar = el("div", "kbbar");
    const fill = el("i");
    bar.appendChild(fill);
    const grid = el("div", "kbstat");
    const row = (label        ) => { const a = el("span"); a.textContent = label; const v = el("b"); grid.append(a, v); return v; };
    const stock = row(t("kb.stock"));
    const rate = row(t("kb.profit"));
    row(t("kb.unitPrice")).textContent = "¥" + fmtMoney(info.sell);
    row(t("kb.customers")).textContent = t("kb.perMin", { n: (info.customers * 60).toFixed(1) });
    const sales = row(t("kb.sales"));
    st.append(bar, grid);
    const note = el("div");
    note.style.cssText = `font-size:11.5px;color:${C.muted};margin-top:6px;line-height:1.35`;
    note.textContent = info.occupied > 0 ? t("kb.note") : t("kb.noResidents");
    st.appendChild(note);
    b.appendChild(st);
    // hands-on shift: the headline action of the store
    const sh = el("button", "btn wide primary")                     ;
    sh.dataset.act = "kbShift";
    sh.style.cssText = "margin:0 0 4px;min-height:56px;background:#357ca5;font-size:17px";
    sh.innerHTML = `<span style="display:flex;flex-direction:column;align-items:center"><span class="lbl">🛒 ${esc(t("kb.shiftBtn"))}</span>${k.best > 0 ? `<span class="sub mp-num">${esc(t("ks.bestNow", { n: fmtMoney(k.best) }))}</span>` : ""}</span>`;
    sh.addEventListener("click", () => this.hooks.kbShift());
    const shh = el("div");
    shh.style.cssText = `font-size:11.5px;color:${C.muted};margin:0 0 10px;line-height:1.35;text-align:center`;
    shh.textContent = t("kb.shiftHint");
    b.append(sh, shh);
    // restock
    const rs = el("button", "btn wide primary")                     ;
    rs.dataset.act = "kbRestock";
    rs.style.marginBottom = "8px";
    rs.addEventListener("click", () => this.hooks.kbRestock());
    b.appendChild(rs);
    // price policy
    const pz = el("div", "zone");
    pz.innerHTML = `<h4>${esc(t("kb.price"))}</h4>`;
    const seg = el("div", "kbseg");
    ([0, 1, 2]         ).forEach((p) => {
      const pb = el("button", k.price === p ? "on" : "")                     ;
      pb.dataset.act = "kbPrice" + p;
      pb.setAttribute("aria-pressed", k.price === p ? "true" : "false");
      pb.textContent = t("kb.price" + p);
      pb.addEventListener("click", () => this.hooks.kbPrice(p));
      seg.appendChild(pb);
    });
    const ph = el("div");
    ph.style.cssText = `font-size:11.5px;color:${C.muted};margin-top:6px;line-height:1.35`;
    ph.textContent = t("kb.priceHint" + k.price);
    pz.append(seg, ph);
    b.appendChild(pz);
    // upgrade + auto order
    const uz = el("div", "zone");
    uz.innerHTML = `<h4>${esc(t("kb.upgrade"))}</h4>`;
    let up                           = null;
    if (k.lv < info.maxLv) {
      up = el("button", "btn wide")                     ;
      up.dataset.act = "kbUpgrade";
      up.addEventListener("click", () => this.hooks.kbUpgrade());
      const uh = el("div");
      uh.style.cssText = `font-size:11.5px;color:${C.muted};margin-bottom:6px;line-height:1.35`;
      uh.textContent = t("kb.upHint");
      uz.append(uh, up);
    } else {
      const mx = el("div");
      mx.style.cssText = `font-size:13px;font-weight:800;color:${C.successText}`;
      mx.textContent = t("kb.maxLv");
      uz.appendChild(mx);
    }
    if (k.lv >= 3) uz.appendChild(this.switchRow(t("kb.auto"), k.auto, (v) => this.hooks.kbAuto(v)));
    else {
      const al = el("div");
      al.style.cssText = `font-size:11.5px;color:${C.muted};margin-top:8px`;
      al.textContent = t("kb.autoLocked");
      uz.appendChild(al);
    }
    b.appendChild(uz);
    // keep the scroll position when the sheet is rebuilt after an action
    const prev = this.modalLayer.querySelector("[data-kb]")?.parentElement                      ;
    const keep = prev ? prev.scrollTop : 0;
    const card = this.modal(t("kb.title"), b);
    const sc = card.querySelector(".sheet-body")                      ;
    if (sc && keep) sc.scrollTop = keep;
    this.kbLive = { root: b, stock, bar: fill, rate, sales, restock: rs, up, money: -1 };
    this.updateKonbini(s, info);
  }
  /** Live numbers while the sheet is open (called each frame by main; cheap text writes only). */
  updateKonbini(s           , info        ) {
    const L = this.kbLive, k = s.konbini;
    if (!L || !k || !L.root.isConnected) return;
    const st = `${Math.floor(k.stock)} / ${info.cap}`;
    if (L.stock.textContent !== st) L.stock.textContent = st;
    L.bar.style.width = `${Math.round((k.stock / info.cap) * 100)}%`;
    L.bar.style.background = k.stock / info.cap < 0.15 ? C.danger : C.success;
    const rt = `¥${fmtRate(Math.max(0, k.rate))}/s`;
    if (L.rate.textContent !== rt) L.rate.textContent = rt;
    const sa = "¥" + fmtMoney(k.sales);
    if (L.sales.textContent !== sa) L.sales.textContent = sa;
    const full = info.restock <= 0;
    const canR = !full && s.money >= info.restock;
    const rl = full ? t("kb.full") : t("kb.restock");
    const rsub = full ? "" : `<span class="sub mp-num">¥${fmtMoney(info.restock)}</span>`;
    const rh = `<span style="display:flex;flex-direction:column;align-items:center"><span class="lbl">${esc(rl)}</span>${rsub}</span>`;
    if (L.restock.innerHTML !== rh) L.restock.innerHTML = rh;
    L.restock.className = "btn wide " + (canR ? "primary" : "off");
    L.restock.disabled = full;
    if (L.up) {
      const canU = s.money >= info.upgrade;
      const uh = `<span style="display:flex;flex-direction:column;align-items:center"><span class="lbl">${esc(t("kb.upBtn", { n: k.lv + 1 }))}</span><span class="sub mp-num">¥${fmtMoney(info.upgrade)}</span></span>`;
      if (L.up.innerHTML !== uh) L.up.innerHTML = uh;
      L.up.className = "btn wide " + (canU ? "primary" : "off");
    }
  }

  textOnly(title        , body        ) {
    const b = el("div");
    const p = el("p");
    p.style.cssText = `margin:0;font-size:13px;color:${C.text};line-height:1.45`;
    p.textContent = body;
    b.appendChild(p);
    this.modal(title, b);
  }
}
