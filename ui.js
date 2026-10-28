// DOM UI: HUD, tab bar, bottom sheet panels, modals, toasts.
import { t, itemName, setName, LANGS, LANG_LABEL, getLang, GAME_TITLE } from './i18n.js';
                                      
                                                
import { fmt, fmt2, fmtTime } from './fmt.js';
import { Decimal, num } from './decimal.js';
const clock = (sec        ) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60; const p = (n        ) => String(n).padStart(2, '0'); return h ? h + ':' + p(m) + ':' + p(x) : m + ':' + p(x); };
// the permanent multiplier split into its four sources, so rebirth timing is a visible decision
function permCard(s     , cls = '') {
  const now = Date.now(); const pm = permMult(s, now), mom = momentum(s, now);
  const dpPart = (s.dpTotal           ).mul(0.1).add(1), orig = 1 + 0.25 * (s.perks.origin || 0);
  return '<div class="bigstat ' + cls + '" style="padding:10px"><div class="l">' + t('permMult') + '</div><div class="v">×' + fmt(pm) + '</div>' +
    '<div class="l" style="margin-top:2px;line-height:1.4">' + t('permMultSrc', { a: fmt2(dpPart), b: orig.toFixed(2), c: fxGlobal(s.fx).toFixed(2), d: mom.toFixed(2) }) + '</div></div>';
}
function momCard(s     ) {
  if (s.rebirths <= 0) return '';
  const mom = momentum(s);
  const secs = Math.max(0, MOM_SEC - (Date.now() - (s.momT || 0)) / 1000);
  return '<div class="row" style="width:100%"><div class="spr" style="' + iconStyle(3) + '"></div><div class="info"><div class="nm">' + t('mom') + ' <b>' + (mom > 1.001 ? t('momOn', { v: mom.toFixed(2), t: clock(secs) }) : t('momOff')) + '</b></div><div class="ds">' + t('mom_d') + '</div></div></div>';
}
import {
  GENS, UPS, SKILLS, SPECIES, GRADES, SETS, GRADE_COLORS, SET_BONUS, BONUS_PER, GRADE_VAL,
  BOTS, PERKS, SKINS, bot, perk, botCost, perkCost, skinStat, perkState,
  upCost, upMaxAfford, genCost, genMaxAfford, genUnit, clickBaseOf, MILESTONE, MILESTONE_X, permMult, momentum, MOM_SEC, lvl, gen, sk, bestGrade, itemBonusValue, rebirthGain, setOf,
} from './core.js';
import { snd } from './audio.js';
import { fxGlobal, FX_IDS, FX_ICON, FX_REQ, fxUnlocked, ACHS, achStat, WHEEL, CROPS, plotCount, EXPS, LABS, labLv, labCost } from './features.js';
                                          
import { fxPanel, fxIcon, FX_CSS, wheelHtml, wheelPrizeLabel, wheelPrizeIcon } from './fxui.js';

                        
                             
                                     
                                      
                          
                   
                                                                      
                  
                           
                            
                             
                    
                     
                            
                                        
                              
                         
                                               
                                            
                   
 

// ---------- sprite helpers ----------
const ITEM_SHEETS = ['assets/sheets/items-animals-c.webp', 'assets/sheets/items-food-c.webp', 'assets/sheets/items-magic-c.webp'].map((u) => AB + u);
export function itemStyle(sp        ) {
  const sh = Math.floor(sp / 16), k = sp % 16, r = Math.floor(k / 4), c = k % 4;
  return `background-image:url(${ITEM_SHEETS[sh]});background-size:400% 400%;background-position:${c * 33.333}% ${r * 33.333}%`;
}
export function iconStyle(i        ) {
  const r = i >> 2, c = i & 3;
  return `background-image:url(${AB}assets/sheets/icons-c.webp);background-size:400% 200%;background-position:${c * 33.333}% ${r * 100}%`;
}
export function chestStyle(tier        , open = false) {
  return `background-image:url(${AB}assets/sheets/chests-c.webp);background-size:400% 200%;background-position:${tier * 33.333}% ${open ? 100 : 0}%`;
}
export function skinCss(i        ) {
  const k = SKINS[i];
  let pat = '';
  if (k.pat === 'rainbow') return `background:conic-gradient(#FF5A5A,#FFC928,#2FC48D,#2F8BFF,#8B5CF6,#FF5A5A);border-radius:50%;box-shadow:0 4px 0 ${k.base}`;
  if (k.pat === 'dots' || k.pat === 'chips' || k.pat === 'seeds' || k.pat === 'stars' || k.pat === 'cosmic') pat = `radial-gradient(circle at 30% 60%,${k.acc} 0 6%,transparent 7%),radial-gradient(circle at 65% 35%,${k.acc} 0 6%,transparent 7%),radial-gradient(circle at 70% 72%,${k.acc} 0 5%,transparent 6%),`;
  if (k.pat === 'ring' || k.pat === 'rings') pat = `radial-gradient(circle,transparent 0 30%,${k.acc}88 31% 40%,transparent 41%),`;
  if (k.pat === 'gem') pat = `linear-gradient(135deg,transparent 40%,#ffffffaa 41% 50%,transparent 51%),`;
  if (k.pat === 'shine') pat = `linear-gradient(135deg,transparent 30%,#ffffff99 31% 42%,transparent 43%),`;
  if (k.pat === 'neon') return `background:radial-gradient(circle,transparent 0 52%,${k.acc} 53% 58%,transparent 59%),radial-gradient(circle at 35% 30%,${k.top2},${k.top} 60%);border-radius:50%;box-shadow:0 4px 0 ${k.base},0 0 14px #FF2E63`;
  return `background:${pat}radial-gradient(circle at 35% 30%,${k.top2},${k.top} 60%);border-radius:50%;box-shadow:0 4px 0 ${k.base}`;
}
export const SHOP_ITEMS = [
  { id: 'gems300', key: 'it_gems', icon: 'gem', once: false },
  { id: 'cosmic3', key: 'it_chests', icon: 'chest3', once: false },
  { id: 'frenzy60', key: 'it_frenzy', icon: 'frenzy', once: false },
  { id: 'warp4h', key: 'it_warp', icon: 'warp', once: false },
  { id: 'golden', key: 'it_golden', icon: 'golden', once: true },
  { id: 'pact', key: 'it_pact', icon: 'pact', once: true },
  { id: 'perpetual', key: 'it_perp', icon: 'perp', once: true },
  { id: 'skin_neon', key: 'it_skin', icon: 'skin', once: true },
];
// one-time items already owned (S.shop flags); ids are stable purchase ids — never rename
const SHOP_FLAG                         = { golden: 'golden', skin_neon: 'skin', pact: 'pact', perpetual: 'perpetual' };
export function shopOwned(s                                  , id        ) { const f = SHOP_FLAG[id]; return !!(f && s.shop[f]); }
export const SHOP_PRICE = 1;
const PCOIN = (n        ) => `<span class="pcoin" aria-label="${t('shop_coin', { v: n })}"><img src="assets/ui/icon_coin_selected.svg" width="20" height="20" alt="" aria-hidden="true"><span>${n}</span></span>`;
const HAND = `background-image:url(${AB}assets/sheets/hand.webp);background-size:contain;background-position:center;background-repeat:no-repeat`;

const GEN_ICON = [
  iconStyle(6), iconStyle(7), iconStyle(1), chestStyle(2), itemStyle(41), itemStyle(32), itemStyle(47), itemStyle(33), itemStyle(42), itemStyle(38),
];
const UP_ICON                         = { power: HAND, sniff: chestStyle(0), cap: chestStyle(1), quality: chestStyle(3) };
const BRANCH_ICON = [iconStyle(1), iconStyle(6), itemStyle(40)];

const TAB_DEF = [
  { id: 'up', icon: 0 }, { id: 'sk', icon: 1 }, { id: 'bot', icon: 6 }, { id: 'col', icon: 2 }, { id: 'gacha', icon: 3 }, { id: 'reb', icon: 4 },
];

const CSS = `
#ui{position:absolute;top:0;bottom:0;pointer-events:none;font-family:MpFontDisplay,SmileySans,"PingFang SC","Hiragino Sans","Microsoft YaHei",sans-serif;color:#17264A;user-select:none;-webkit-user-select:none}
#ui *{box-sizing:border-box}
#ui .spr{background-repeat:no-repeat;flex:none}
.hud{position:absolute;left:12px;right:12px;top:10px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.hrow{display:flex;gap:8px;align-items:center}
.pill{background:#17264A;color:#fff;border-radius:999px;display:flex;align-items:center;gap:6px;padding:4px 14px 4px 5px;height:44px;pointer-events:auto}
.pill .spr{width:34px;height:34px}
.pill.coins{flex:1;min-width:0;font-size:28px;font-weight:900;letter-spacing:.5px}
.pill.coins span,.pill.cps span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill.cps{font-size:17px;font-weight:800;max-width:46%}
.pill.small{cursor:pointer;height:34px;font-size:16px;padding:2px 12px 2px 4px}
.pill.small .spr{width:26px;height:26px}
.lv{flex:1;display:flex;align-items:center;gap:6px;background:#fff;border-radius:999px;height:34px;padding:0 10px;font-size:15px;font-weight:800;box-shadow:0 2px 0 #b9dcc9}
.lv .bar{flex:1;height:10px;background:#E3EEF0;border-radius:6px;overflow:hidden}
.lv .bar i{display:block;height:100%;background:#2FC48D;border-radius:6px;width:0}
.gear{width:48px;height:48px;border-radius:50%;background:#17264A;border:none;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.gear svg{width:24px;height:24px}
.hidden{display:none!important}
.tabs{position:absolute;left:0;right:0;bottom:0;background:#17264A;border-radius:22px 22px 0 0;display:flex;justify-content:space-around;padding:8px 6px calc(10px + env(safe-area-inset-bottom));pointer-events:auto;transition:transform .3s}
.tab span{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tab{flex:1;min-width:0;max-width:110px;min-height:60px;background:none;border:none;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;font-size:12.5px;font-weight:800;border-radius:14px;position:relative;cursor:pointer;padding:2px}
.tab .spr{width:34px;height:34px}
.lbbtn{margin-left:auto;width:48px;height:48px;border-radius:50%;background:#FFC928;border:none;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;box-shadow:0 3px 0 #D99A00;padding:0}
.lbbtn svg{width:28px;height:28px}
.shopbtn{width:48px;height:48px;border-radius:50%;background:#FF3B47;border:none;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;box-shadow:0 3px 0 #B81E2A;padding:0;position:relative}
.shopbtn img{width:30px;height:30px}
.shopbtn .dot{position:absolute;top:0;right:0}
.pcoin{display:inline-flex;align-items:center;gap:.25em;font-weight:900}
.pcoin img{flex:none;width:20px;height:20px}
.shopi{display:flex;align-items:center;gap:10px;background:#fff;border-radius:16px;padding:10px;box-shadow:0 2px 0 #DCE9E3;margin-bottom:8px}
.shopi .si{width:52px;height:52px;flex:none;border-radius:14px;background:#F2F7F5;display:flex;align-items:center;justify-content:center}
.shopi .si .spr{width:44px;height:44px}
.shopi .info{flex:1;min-width:0}
.shopi .btn{min-width:84px}
.shopi.own{opacity:.6}
.lbl{display:flex;flex-direction:column;gap:6px;width:100%;max-height:46vh;overflow:auto}
.lbr{display:flex;align-items:center;gap:8px;background:#F2F7F5;border-radius:12px;padding:6px 10px;font-weight:800;font-size:15px;min-width:0}
.lbr.me{background:#FFF1C2;box-shadow:0 0 0 2px #FFC928}
.lbr .rk{width:28px;text-align:center;font-weight:900;color:#5B6B8C;flex:none}
.lbr img{width:28px;height:28px;border-radius:50%;flex:none;object-fit:cover;background:#DCE9E3}
.lbr .nmx{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.lbr .sc{font-weight:900;flex:none}
.skinbtn{width:48px;height:48px;border-radius:50%;background:#17264A;border:none;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;position:relative;padding:0}
.skinbtn i.m{width:30px;height:30px;display:block;margin-top:-3px}
.skinbtn .dot{position:absolute;top:0;right:0;width:12px;height:12px;border-radius:50%;background:#FF3B47;border:2px solid #DDF3E6}
.skins{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.skc{background:#fff;border-radius:16px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;border:3px solid transparent;box-shadow:0 2px 0 #DCE9E3;text-align:center;cursor:pointer;min-height:48px}
.skc.on{border-color:#17264A}
.skc .mb{width:56px;height:56px;margin-bottom:4px;flex:none}
.skc.lock .mb{filter:grayscale(1) opacity(.35)}
.skc .n{font-size:13px;font-weight:900;line-height:1.1}
.skc .r{font-size:11px;color:#5B6B8C;line-height:1.15}
.skc .progress{width:100%;height:8px;margin:2px 0 0}
.skc .tag{font-size:12px;font-weight:900;padding:2px 8px;border-radius:999px;background:#E3EEF0}
.skc.on .tag{background:#17264A;color:#fff}
.info-btn{border:none;background:#E3EEF0;border-radius:999px;font:inherit;font-weight:900;color:#2F8BFF;min-height:48px;padding:0 16px;cursor:pointer}
.tab.on{background:#2A3D6B}
.tab.pop{animation:pop .6s}
.tab.lock{opacity:.0;pointer-events:none;width:0;flex:0;max-width:0;overflow:hidden;padding:0}
.tab .dot{position:absolute;top:4px;right:18%;width:12px;height:12px;border-radius:50%;background:#FF3B47;border:2px solid #17264A}
@keyframes pop{0%{transform:scale(.3)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
.sheet{position:absolute;left:0;right:0;background:#F7FBF9;border-radius:22px 22px 0 0;pointer-events:auto;display:flex;flex-direction:column;box-shadow:0 -4px 0 rgba(23,38,74,.12);overflow:hidden}
.sheet header{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-size:21px;font-weight:900}
.sheet header .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xbtn{width:48px;height:48px;border-radius:50%;border:none;background:#E3EEF0;font:inherit;font-size:22px;font-weight:900;color:#17264A;cursor:pointer;flex:none}
.body{flex:1;overflow-y:auto;padding:4px 12px 16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.sec{font-size:15px;font-weight:900;color:#5B6B8C;margin:10px 4px 6px}
.row{display:flex;align-items:center;gap:10px;background:#fff;border-radius:16px;padding:8px 10px;margin-bottom:8px;box-shadow:0 2px 0 #DCE9E3}
.row .spr{width:48px;height:48px}
.row .info{flex:1;min-width:0}
.row .nm{font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .nm b{color:#2FC48D;font-size:13px;margin-left:4px}
.row .ds{font-size:12.5px;color:#5B6B8C;line-height:1.25}
.btn{min-width:84px;min-height:48px;border:none;border-radius:14px;background:#FF3B47;color:#fff;font:inherit;font-weight:900;font-size:15px;box-shadow:0 4px 0 #C21F2C;cursor:pointer;padding:4px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.btn small{font-size:11px;opacity:.9;font-weight:700}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 #C21F2C}
.btn.off{background:#C9D3DC;box-shadow:0 4px 0 #A9B4BF;color:#fff}
.btn.mint{background:#2FC48D;box-shadow:0 4px 0 #1E9468}
.btn.purple{background:#8B5CF6;box-shadow:0 4px 0 #6436C9}
.btn.blue{background:#2F8BFF;box-shadow:0 4px 0 #1C63C4}
.seg{display:flex;gap:6px;margin:0 2px 6px}
.seg button{flex:1;min-height:40px;border:none;border-radius:12px;background:#E3EEF0;font:inherit;font-weight:900;color:#17264A;cursor:pointer}
.seg button.on{background:#17264A;color:#fff}
.tree{position:relative;margin:4px 0 8px}
.tree svg{position:absolute;left:0;top:0;width:100%;overflow:visible;pointer-events:none}
.tree .hub{position:absolute;width:56px;height:56px;margin-left:-28px;border-radius:50%;background:#17264A;display:flex;align-items:center;justify-content:center}
.tree .hub .spr{width:40px;height:40px}
.tree .node{position:absolute;width:31%;max-width:116px;transform:translateX(-50%);height:72px;overflow:hidden}
.tree .node .pips{display:flex;gap:2px;justify-content:center;margin-top:3px}
.tree .node .pips i{width:5px;height:5px;border-radius:50%;background:#DCE9E3}
.tree .node .pips i.on{background:#2FC48D}
.tree .node.full .pips i.on{background:#FFB800}
.brseg button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:58px;font-size:13px;line-height:1.1;position:relative}
.brseg .spr{width:26px;height:26px}
.tree.tal .node.can{border-color:#2F8BFF}
.tree.tal .node.has{border-color:#8FB8FF}
.tree.tal .node .pips i.on{background:#2F8BFF}
.branch{display:flex;flex-direction:column;gap:8px;align-items:stretch}
.bhead{display:flex;flex-direction:column;align-items:center;font-size:13px;font-weight:900;text-align:center;gap:2px}
.bhead .spr{width:34px;height:34px}
.node{position:relative;background:#fff;border-radius:14px;border:3px solid #DCE9E3;padding:6px 4px;text-align:center;min-height:62px;cursor:pointer;display:flex;flex-direction:column;justify-content:center}
.node .nn{font-size:13px;font-weight:900;line-height:1.15}
.node .nl{font-size:11.5px;color:#5B6B8C;font-weight:800}
.node.lock{opacity:.45}
.node.can{border-color:#FF3B47}
.node.has{border-color:#2FC48D}
.node.full{border-color:#FFB800;background:#FFF8E1}
.node.sel{box-shadow:0 0 0 3px #17264A}
.detail{background:#17264A;color:#fff;border-radius:16px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px}
.detail .info{flex:1;min-width:0}
.detail .nm{font-size:16px;font-weight:900}
.detail .ds{font-size:13px;opacity:.85}
.setcard{background:#fff;border-radius:16px;padding:8px 10px 10px;margin-bottom:10px;box-shadow:0 2px 0 #DCE9E3}
.setcard h4{margin:0 0 6px;font-size:15px;display:flex;gap:6px;align-items:center;justify-content:space-between}
.setcard h4 em{font-style:normal;font-size:12px;padding:2px 8px;border-radius:999px;background:#E3EEF0;color:#5B6B8C;white-space:nowrap}
.setcard h4 em.on{background:#FFB800;color:#17264A}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.card{position:relative;aspect-ratio:1/1;border-radius:14px;background:#F0F5F3;border:3px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center}
.card .spr{width:84%;height:84%}
.card.none .spr{filter:brightness(0) opacity(.18)}
.card .cnt{position:absolute;bottom:2px;right:3px;font-size:11px;font-weight:900;background:#17264A;color:#fff;border-radius:8px;padding:0 5px}
.card .gd{position:absolute;top:3px;left:3px;display:flex;gap:2px}
.card .gd i{width:6px;height:6px;border-radius:50%;background:#C9D3DC}
.progress{height:14px;border-radius:8px;background:#E3EEF0;overflow:hidden;margin:4px 2px 8px}
.progress i{display:block;height:100%;background:linear-gradient(90deg,#2FC48D,#FFB800)}
.bigcenter{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:6px 0}
.bigcenter .spr{width:120px;height:120px}
.res{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:100%}
.res .card{animation:pop .4s backwards}
.newtag{position:absolute;top:-6px;right:-4px;background:#FF3B47;color:#fff;font-size:10px;font-weight:900;border-radius:6px;padding:0 4px}
.modalbg{position:absolute;inset:0;background:rgba(23,38,74,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:20px}
.modal{background:#fff;border-radius:22px;padding:18px;width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;animation:pop .35s}
.modal h3{margin:0;font-size:22px}
.modal .big{font-size:30px;font-weight:900;color:#E89B00;display:flex;align-items:center;gap:6px}
.modal .spr.huge{width:140px;height:140px}
.modal .spr.huge svg{width:100px;height:100px}
.optrow{display:flex;gap:6px;width:100%;align-items:center}
.optrow label{width:64px;text-align:left;font-weight:900;font-size:15px}
.optrow .seg{flex:1;margin:0}
.stats{width:100%;font-size:13px;color:#5B6B8C;text-align:left;display:grid;grid-template-columns:1fr auto;gap:2px 10px}
.toasts{position:absolute;left:0;right:0;top:112px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.toast{background:#17264A;color:#fff;border-radius:999px;padding:6px 14px 6px 6px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:6px;animation:toast 2.6s forwards;max-width:92%}
.toast .spr{width:30px;height:30px}
.toast span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes toast{0%{opacity:0;transform:translateY(-10px) scale(.8)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
`;

const GEAR = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.5 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>';

import { AB } from './base.js';
import { scopeCss } from './scope-css.js';

export class Ui {
  api       ;
  root                ;
  els                              = {};
  tab                = null;
  lastHtml = '';
  buyN = 1;
  selSkill = 'm1';
  skBranch = 0;
  gachaRes                                              = [];
  rebArm = false;
  shownTabs = new Set        ();
  newSkin = false;
  skinShown = -1;
  col = { left: 0, width: 400, height: 700 };

  constructor(host             , api       ) {
    this.api = api;
    // ★ 收进 #rb-root：这份 CSS 里有 .hud / .pill / .tabs / .sheet 这种通用类名，
    //   不收进作用域会把宿主的顶栏底栏一起改样（未分层样式胜过 Tailwind 的 @layer）
    const style = document.createElement('style'); style.textContent = scopeCss(CSS + FX_CSS, '#rb-root'); document.head.appendChild(style); this.styleEl = style;
    const r = document.createElement('div'); r.id = 'ui'; host.appendChild(r); this.root = r;
    r.innerHTML = `
      <div class="hud">
        <div class="hrow"><div class="pill coins"><div class="spr" style="${iconStyle(7)}"></div><span id="coinTxt">0</span></div>
        <div class="pill cps hidden" id="cpsPill"><div class="spr" style="${iconStyle(7)}"></div><span id="cpsTxt"></span></div></div>
        <div class="hrow"><div class="pill small hidden" id="gemPill"><div class="spr" style="${iconStyle(5)}"></div><span id="gemTxt">0</span></div>
        <div class="lv hidden" id="lvBox"><span id="lvTxt">Lv1</span><div class="bar"><i id="lvBar"></i></div></div>
        <div class="pill small hidden" id="dpPill"><div class="spr" style="${iconStyle(4)}"></div><span id="dpTxt">0</span></div>
        <button class="skinbtn hidden" id="skinBtn" aria-label="skins"><i class="m" id="skinMini"></i><i class="dot hidden" id="skinDot"></i></button>
        <button class="gear" id="gear" aria-label="settings">${GEAR}</button></div>
        <div class="fxrow hidden" id="fxRow">${FX_IDS.map(id => `<button class="fxb lock" data-fx="${id}" aria-label="${id}"><div class="spr" style="${fxIcon(FX_ICON[id])}"></div><i class="dot hidden"></i></button>`).join('')}</div>
      </div>
      <div class="toasts" id="toasts"></div>
      <div class="sheet hidden" id="sheet"><header><div class="spr" id="shIcon" style="width:34px;height:34px"></div><div class="grow" id="shTitle"></div><button class="xbtn" id="shClose">×</button></header><div class="body" id="shBody"></div></div>
      <div class="tabs hidden" id="tabs">${TAB_DEF.map(d => `<button class="tab lock" data-tab="${d.id}"><div class="spr" style="${iconStyle(d.icon)}"></div><span></span><i class="dot hidden"></i></button>`).join('')}</div>
      <div id="modalHost"></div>`;
    for (const id of ['coinTxt', 'cpsTxt', 'cpsPill', 'gemPill', 'gemTxt', 'lvBox', 'lvTxt', 'lvBar', 'dpPill', 'dpTxt', 'gear', 'toasts', 'sheet', 'shIcon', 'shTitle', 'shClose', 'shBody', 'tabs', 'modalHost', 'skinBtn', 'skinMini', 'skinDot', 'fxRow', ]) {
      this.els[id] = r.querySelector('#' + id)               ;
    }
    this.els.tabs.addEventListener('click', (e) => {
      const b = (e.target               ).closest('.tab')                      ;
      if (!b) return;
      void snd?.playCue('sfx.ui', { eventId: 'tab:' + Date.now() });
      const id = b.dataset.tab ;
      this.open(this.tab === id ? null : id);
    });
    this.els.shClose.addEventListener('click', () => { void snd?.playCue('sfx.ui', { eventId: 'close:' + Date.now() }); this.open(null); });
    this.els.gear.addEventListener('click', () => { void snd?.playCue('sfx.ui', { eventId: 'gear:' + Date.now() }); this.settings(); });
    // Panels re-render live (costs, progress), which can swap the DOM between press and release and
    // swallow a 'click'. Capture the target on pointerdown and fire on pointerup instead; freeze re-render while pressed.
    let downEl                     = null, downX = 0, downY = 0, downId = -1;
    this.els.shBody.addEventListener('pointerdown', (e) => {
      downEl = (e.target               ).closest('[data-a]')                      ;
      downX = e.clientX; downY = e.clientY; downId = e.pointerId; this.pressing = true;
    });
    const end = (e              , fire         ) => {
      if (e.pointerId !== downId) return;
      const el = downEl; downEl = null; downId = -1; this.pressing = false;
      if (fire && el && Math.hypot(e.clientX - downX, e.clientY - downY) < 12) this.onBody(el);
    };
    const onUp = (e) => end(e, true), onCancel = (e) => end(e, false);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    this.offWin = [() => window.removeEventListener('pointerup', onUp), () => window.removeEventListener('pointercancel', onCancel)];
    this.els.skinBtn.addEventListener('click', () => { void snd?.playCue('sfx.ui', { eventId: 'skin:' + Date.now() }); this.newSkin = false; this.open(this.tab === 'skin' ? null : 'skin'); });


    this.els.fxRow.addEventListener('click', (e) => {
      const b = (e.target               ).closest('.fxb')                      ;
      if (!b) return;
      const id = b.dataset.fx        ;
      void snd?.playCue('sfx.ui', { eventId: 'fx:' + Date.now() });
      if (b.classList.contains('lock')) {
        const [k, v] = FX_REQ[id];
        this.toast(fxIcon(FX_ICON[id]), t('fx_' + id) + ' · ' + t('fx_lockedMsg', { v: t(k, { v: fmt(v) }) }));
        return;
      }
      this.fxView.pickPlot = -1;
      this.open(this.tab === 'f_' + id ? null : 'f_' + id);
    });
    this.els.dpPill.addEventListener('click', () => { void snd?.playCue('sfx.ui', { eventId: 'dp:' + Date.now() }); this.dpModal(); });
    this.relabel();
  }

  /** 卸载：DOM + 样式 + window 监听。★ 少一样就是「切走以后宿主的按钮还是游戏的样子」 */
  destroy() {
    (this.offWin || []).forEach((f) => f());
    this.offWin = [];
    this.styleEl?.remove();
    this.root?.remove();
  }

  layout(left        , width        , height        ) {
    this.col = { left, width, height };
    this.root.style.left = left + 'px'; this.root.style.width = width + 'px';
    const sh = this.els.sheet;
    const top = this.sheetTop();
    sh.style.top = top + 'px';
    sh.style.bottom = this.tabsH() + 'px';
  }
  tabsH() { return this.els.tabs.classList.contains('hidden') ? 0 : (this.els.tabs.offsetHeight || 80); }
  sheetTop() { return Math.round(Math.max(this.col.height * 0.4, 240)); }
  // play-area rect (CSS px, column-relative)
  fxView = { pickPlot: -1 };
  fxRowOn = false;
  playRect() {
    const top = 112 + (this.fxRowOn ? 58 : 0);
    const bottom = this.tab ? this.sheetTop() : this.col.height - this.tabsH();
    return { top, bottom };
  }
  coinTarget() {
    const el = this.root.querySelector('.pill.coins .spr')               ;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  relabel() {
    this.root.querySelectorAll('.tab').forEach((b) => {
      const el = b               ; (el.querySelector('span')               ).textContent = t('tab_' + el.dataset.tab);
    });
    this.lastHtml = '';
    if (this.tab) this.renderPanel();
  }

  fxHud() {
    const s = this.api.st(), d = this.api.dv(), f = s.fx, now = Date.now();
    let any = false;
    this.els.fxRow.querySelectorAll('.fxb').forEach((b) => {
      const el = b               ; const id = el.dataset.fx        ;
      const un = fxUnlocked(s, d, id);
      if (un) any = true;
      if (un && el.classList.contains('lock')) {
        el.classList.remove('lock');
        if (!s.tabs.includes('f_' + id)) {
          s.tabs.push('f_' + id);
          el.classList.add('pop');
          this.toast(fxIcon(FX_ICON[id]), t('fx_unlock', { v: t('fx_' + id) }), '#2F8BFF');
          void snd?.playCue('sfx.levelup', { eventId: 'fxu:' + id });
        }
      }
      let dot = false;
      if (un) {
        if (id === 'ach') dot = ACHS.some((a, i) => !f.ach.includes(i) && achStat(s, d, a.stat) >= a.v);
        else if (id === 'wheel') dot = f.wheelTok > 0;
        else if (id === 'garden') { const n = plotCount(f); for (let i = 0; i < n; i++) { const p = f.garden[i]; if (!p || now >= p.t + CROPS[p.c].min * 60e3) dot = true; } }
        else if (id === 'exp') dot = EXPS.some((e, i) => d.collected >= e.need && (!f.exp[i] || now >= f.exp[i] + e.min * 60e3));
        else if (id === 'lab') dot = LABS.some(l => labLv(f, l.id) < l.max && (l.gems ? s.gems : f.rp) >= labCost(f, l));
      }
      (el.querySelector('.dot')               ).classList.toggle('hidden', !dot);
    });
    if (any !== this.fxRowOn) {
      this.fxRowOn = any;
      this.els.fxRow.classList.toggle('hidden', !any);
      this.api.onLayout();
    }
  }

  wheelModal(prize        ) {
    const n = WHEEL.length, seg = 360 / n;
    const end = 360 * 6 - (prize + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6;
    this.modal(`<h3>${t('fx_wheel')}</h3><div class="wheelbox">${wheelHtml(iconStyle)}</div><div id="wres" style="min-height:64px;display:flex;flex-direction:column;align-items:center;gap:4px;opacity:0;transition:opacity .3s"><div style="font-size:13px;color:#5B6B8C">${t('wh_win')}</div><div style="display:flex;align-items:center;gap:6px"><div class="spr" style="width:40px;height:40px;${wheelPrizeIcon(prize, iconStyle)}"></div><b style="font-size:22px">${wheelPrizeLabel(prize)}</b></div></div><button class="btn" data-x>${t('close')}</button>`, (box, close) => {
      const disc = box.querySelector('#wdisc')               ;
      disc.style.transition = 'transform 3s cubic-bezier(.15,.7,.2,1)';
      void disc.offsetWidth;
      requestAnimationFrame(() => { disc.style.transform = `rotate(${end}deg)`; });
      setTimeout(() => {
        const r = box.querySelector('#wres')                      ; if (r) r.style.opacity = '1';
        if (WHEEL[prize].k === 'jackpot' || WHEEL[prize].v >= 20) void snd?.playCue('sfx.rare', { eventId: 'whr:' + Date.now() }); else void snd?.playCue('sfx.buy', { eventId: 'whr:' + Date.now() });
      }, 3050);
      (box.querySelector('[data-x]')               ).addEventListener('click', close);
    });
  }

  unlockTab(id        , announce         ) {
    const b = this.root.querySelector(`.tab[data-tab="${id}"]`)               ;
    if (!b || !b.classList.contains('lock')) return;
    b.classList.remove('lock');
    this.els.tabs.classList.remove('hidden');
    if (announce) { b.classList.add('pop'); this.toast(iconStyle(TAB_DEF.find(d => d.id === id) .icon), t('unlockTab', { v: t('tab_' + id) })); }
    this.api.onLayout();
  }

  open(id               ) {
    this.tab = id; this.lastHtml = ''; this.rebArm = false;
    this.root.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', (b               ).dataset.tab === id));
    if (!id) this.els.fxRow.querySelectorAll('.fxb').forEach((b) => b.classList.remove('on'));
    this.els.sheet.classList.toggle('hidden', !id);
    if (id) {
      const td = TAB_DEF.find(d => d.id === id);
      const fxid = id.startsWith('f_') ? id.slice(2)         : null;
      this.els.shIcon.setAttribute('style', `width:34px;height:34px;${td ? iconStyle(td.icon) : fxid ? fxIcon(FX_ICON[fxid]) : id === 'shop' ? `background:url(${AB}assets/ui/icon_coin_selected.svg) center/contain no-repeat` : skinCss(this.api.st().skin)}`);
      this.els.fxRow.querySelectorAll('.fxb').forEach((b) => b.classList.toggle('on', 'f_' + (b               ).dataset.fx === id));
      this.els.shBody.scrollTop = 0;
      this.renderPanel();
    }
    this.layout(this.col.left, this.col.width, this.col.height);
    this.api.onLayout();
  }

  // ---------------- per-frame HUD ----------------
  hud() {
    const s = this.api.st(), d = this.api.dv();
    this.els.coinTxt.textContent = fmt(s.coins);
    const showCps = d.cps.gt(0);
    this.els.cpsPill.classList.toggle('hidden', !showCps);
    if (showCps) this.els.cpsTxt.textContent = '+' + fmt(d.cps) + t('perSec');
    this.els.gemPill.classList.toggle('hidden', s.gems <= 0 && s.pulls <= 0);
    this.els.gemTxt.textContent = fmt(s.gems);
    this.els.lvBox.classList.toggle('hidden', s.clicks < 5);
    this.els.lvTxt.textContent = t('lv') + s.level;
    (this.els.lvBar               ).style.width = Math.min(100, s.xp / d.xpNeed * 100) + '%';
    this.els.dpPill.classList.toggle('hidden', s.dpTotal.lte(0));
    this.els.dpTxt.textContent = fmt(s.dp);
    if (this.skinShown !== s.skin) { this.skinShown = s.skin; this.els.skinMini.setAttribute('style', skinCss(s.skin)); }
    this.els.skinBtn.classList.toggle('hidden', s.clicks < 30 && s.skins <= 1);
    this.els.skinDot.classList.toggle('hidden', !this.newSkin);


    // badges
    const dots                          = {
      up: UPS.some(u => lvl(s, u.id) < u.max && s.coins.gte(upCost(s, u))) || GENS.some(g => this.genVisible(g.cost) && s.coins.gte(genCost(s, g))),
      sk: s.sp > 0 && SKILLS.some(k => this.skillState(k.id) === 'can'),
      col: this.mergeable(),
      gacha: s.gems >= d.gachaCost,
      bot: BOTS.some(b => bot(s, b.id) < b.max && s.coins.gte(botCost(s, b))),
      reb: rebirthGain(s).gt(0) || PERKS.some(p => perk(s, p.id) < p.max && s.dp.gte(perkCost(s, p))),
    };
    this.root.querySelectorAll('.tab').forEach((b) => {
      const el = b               ; (el.querySelector('.dot')               ).classList.toggle('hidden', !dots[el.dataset.tab ]);
    });
    this.fxHud();
    if (this.tab) this.renderPanel();
  }

  mergeable() {
    const s = this.api.st();
    for (let sp = 0; sp < SPECIES; sp++) {
      for (let g = 0; g < GRADES - 1; g++) if (s.inv[sp * GRADES + g] >= 3) return true;
      if (s.inv[sp * GRADES + 3] > 1) return true;
    }
    return false;
  }
  genVisible(cost        ) { const s = this.api.st(); return s.lifeCoins.gte(cost * 0.3) || s.runCoins.gte(cost * 0.3); }

  skillState(id        )                                   {
    const s = this.api.st(); const k = SKILLS.find(x => x.id === id) ;
    const l = sk(s, id);
    if (l >= k.max) return 'full';
    if (k.req && sk(s, k.req) < (k.reqLv || 1)) return 'lock';
    return s.sp >= k.cost ? 'can' : 'poor';
  }

  // ---------------- panels ----------------
  renderPanel() {
    const id = this.tab; if (!id) return;
    if (id.startsWith('f_')) {
      const fid = id.slice(2)        ;
      this.els.shTitle.textContent = t('fx_' + fid);
      const fh = fxPanel(fid, this.api.st(), this.api.dv(), iconStyle, itemStyle, this.fxView);
      if (fh !== this.lastHtml && !this.pressing) { this.lastHtml = fh; this.els.shBody.innerHTML = fh; }
      return;
    }
    this.els.shTitle.textContent = t(id === 'col' ? 'col_title' : id === 'gacha' ? 'gacha_title' : id === 'reb' ? 'reb_title' : 'tab_' + id);
    if (id === 'skin') this.els.shIcon.setAttribute('style', `width:34px;height:34px;${skinCss(this.api.st().skin)}`);
    let html = '';
    if (id === 'up') html = this.pUp();
    else if (id === 'sk') html = this.pSk();
    else if (id === 'col') html = this.pCol();
    else if (id === 'gacha') html = this.pGacha();
    else if (id === 'reb') html = this.pReb();
    else if (id === 'bot') html = this.pBot();
    else if (id === 'skin') html = this.pSkin();
    else if (id === 'shop') html = this.pShop();
    if (html !== this.lastHtml && !this.pressing) { this.lastHtml = html; this.els.shBody.innerHTML = html; }
  }

  pUp() {
    const s = this.api.st(), d = this.api.dv();
    const n = this.buyN;
    let h = `<div class="seg">${[1, 10, 0].map(v => `<button data-a="bn" data-v="${v}" class="${n === v ? 'on' : ''}">${t(v === 1 ? 'buyX1' : v === 10 ? 'buyX10' : 'buyMax')}</button>`).join('')}</div>`;
    h += `<div class="sec">${t('sec_click')}</div>`;
    for (const u of UPS) {
      if (u.id === 'quality' && s.lifeCoins.lt(800) && !lvl(s, 'quality')) continue;
      if (u.id === 'cap' && s.opened < 1 && !lvl(s, 'cap')) continue;
      if (u.id === 'sniff' && s.opened < 1 && !lvl(s, 'sniff')) continue;
      const l = lvl(s, u.id);
      let cnt = n === 0 ? 0 : n;
      if (n === 0) { cnt = upMaxAfford(s, u, Math.min(500, u.max - l)); if (cnt === 0) cnt = 1; }
      cnt = Math.min(cnt, u.max - l);
      const full = l >= u.max;
      const cost = full ? new Decimal(0) : upCost(s, u, Math.max(1, cnt));
      const ds = u.id === 'power' ? t('u_power_d', { v: fmt(clickBaseOf(l + 1).sub(clickBaseOf(l)).mul(d.clickMult)) }) + ' · ' + t('ms_next', { n: MILESTONE - (l % MILESTONE), x: MILESTONE_X }) : t('u_' + u.id + '_d');
      h += `<div class="row"><div class="spr" style="${UP_ICON[u.id]}"></div><div class="info"><div class="nm">${t('u_' + u.id)}<b>${t('lv')}${l}</b></div><div class="ds">${ds}</div></div>
        ${full ? `<button class="btn off">${t('max')}</button>` : `<button class="btn ${s.coins.gte(cost) ? '' : 'off'}" data-a="up" data-id="${u.id}" data-n="${Math.max(1, cnt)}">${fmt(cost)}<small>+${Math.max(1, cnt)}</small></button>`}</div>`;
    }
    const vis = GENS.filter(g => this.genVisible(g.cost) || gen(s, g.id) > 0);
    if (vis.length) {
      h += `<div class="sec">${t('sec_auto')}</div>`;
      GENS.forEach((g, i) => {
        if (!vis.includes(g)) return;
        const own = gen(s, g.id);
        let cnt = n === 0 ? Math.max(1, genMaxAfford(s, g)) : n;
        const cost = genCost(s, g, cnt);
        const each = genUnit(g, own).mul(d.cpsMult);
        h += `<div class="row"><div class="spr" style="${GEN_ICON[i]}"></div><div class="info"><div class="nm">${t('g_' + g.id)}<b>×${own}</b></div><div class="ds">${t('g_d', { v: fmt(each) })} · ${t('ms_next', { n: MILESTONE - (own % MILESTONE), x: MILESTONE_X })}</div></div>
          <button class="btn mint ${s.coins.gte(cost) ? '' : 'off'}" data-a="gen" data-id="${g.id}" data-n="${cnt}">${fmt(cost)}<small>+${cnt}</small></button></div>`;
      });
    }
    return h;
  }

  pSk() {
    const s = this.api.st();
    const k = SKILLS.find(x => x.id === this.selSkill) ;
    const st = this.skillState(k.id);
    const l = sk(s, k.id);
    let h = `<div class="detail"><div class="info"><div class="nm">${t(k.id)} · ${t('lvShort')}${l}/${k.max}</div><div class="ds">${t(k.id + '_d')}${st === 'lock' ? ' · ' + t('needPrev') : ''}</div></div>
      ${st === 'full' ? `<button class="btn off">${t('max')}</button>` : `<button class="btn ${st === 'can' ? '' : 'off'}" data-a="learn" data-id="${k.id}">${t('learn')}<small>${k.cost} SP</small></button>`}</div>`;
    h += `<div class="sec">${t('sk_points')}: ${s.sp} · <span style="font-weight:700">${t('sk_hint')}</span></div>`;
    const b = this.skBranch;
    h += `<div class="seg brseg">${[0, 1, 2].map(i => {
      const tot = SKILLS.filter(x => x.branch === i).reduce((a, x) => a + sk(s, x.id), 0);
      const can = SKILLS.some(x => x.branch === i && this.skillState(x.id) === 'can');
      return `<button data-a="br" data-v="${i}" class="${i === b ? 'on' : ''}"><div class="spr" style="${BRANCH_ICON[i]}"></div>${t(['br_m', 'br_i', 'br_l'][i])}<small style="opacity:.7">${tot}</small>${can ? '<i style="position:absolute;top:5px;right:6px;width:9px;height:9px;border-radius:50%;background:#FF3B47"></i>' : ''}</button>`;
    }).join('')}</div>`;
    // tidy tree layout: leaves get sequential columns, parents centre over children
    const nodes = SKILLS.filter(x => x.branch === b);
    const kids = (id        ) => nodes.filter(n => n.req === id);
    const pos                                           = {};
    let leaf = 0, maxD = 0;
    const place = (n                      , d        ) => {
      maxD = Math.max(maxD, d);
      const ch = kids(n.id);
      if (!ch.length) { pos[n.id] = { x: leaf++, d }; return; }
      ch.forEach(c => place(c, d + 1));
      const xs = ch.map(c => pos[c.id].x);
      pos[n.id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, d };
    };
    nodes.filter(n => !n.req).forEach(r => place(r, 0));
    const ROW = 96, TOP = 74, NH = 72;
    const px = (x        ) => ((x + 0.5) / Math.max(leaf, 1)) * 100;
    const H = TOP + (maxD + 1) * ROW - (ROW - NH);
    let lines = '';
    const root = nodes.find(n => !n.req) ;
    const lc = (id        ) => sk(s, id) > 0 ? '#2FC48D' : this.skillState(id) === 'lock' ? '#C9D3DC' : '#FF8A92';
    lines += `<line x1="${px(pos[root.id].x)}%" y1="50" x2="${px(pos[root.id].x)}%" y2="${TOP}" stroke="${lc(root.id)}" stroke-width="5" stroke-linecap="round"/>`;
    for (const n of nodes) {
      if (!n.req) continue;
      const p = pos[n.req], c = pos[n.id];
      const y1 = TOP + p.d * ROW + NH, y2 = TOP + c.d * ROW, ym = (y1 + y2) / 2;
      const col = lc(n.id);
      lines += `<line x1="${px(p.x)}%" y1="${y1}" x2="${px(p.x)}%" y2="${ym}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      lines += `<line x1="${px(p.x)}%" y1="${ym}" x2="${px(c.x)}%" y2="${ym}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      lines += `<line x1="${px(c.x)}%" y1="${ym}" x2="${px(c.x)}%" y2="${y2}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
    }
    h += `<div class="tree" style="height:${H}px"><svg height="${H}">${lines}</svg>`;
    h += `<div class="hub" style="left:${px(pos[root.id].x)}%;top:0"><div class="spr" style="${BRANCH_ICON[b]}"></div></div>`;
    for (const n of nodes) {
      const ss = this.skillState(n.id); const nl = sk(s, n.id);
      const cls = ss === 'full' ? 'full' : ss === 'lock' ? 'lock' : ss === 'can' ? 'can' : nl > 0 ? 'has' : '';
      const pips = Array.from({ length: n.max }, (_, i) => `<i class="${i < nl ? 'on' : ''}"></i>`).join('');
      h += `<div class="node ${cls} ${n.id === this.selSkill ? 'sel' : ''}" data-a="sel" data-id="${n.id}" style="left:${px(pos[n.id].x)}%;top:${TOP + pos[n.id].d * ROW}px"><div class="nn">${t(n.id)}</div><div class="nl">${nl}/${n.max}</div><div class="pips">${pips}</div></div>`;
    }
    return h + `</div>`;
  }

  pCol() {
    const s = this.api.st(), d = this.api.dv();
    const pct = d.collected / (SPECIES * GRADES) * 100;
    let h = `<div class="sec">${t('col_progress')} ${d.collected}/${SPECIES * GRADES}</div><div class="progress"><i style="width:${pct}%"></i></div>`;
    h += `<div class="row" style="background:#17264A;color:#fff"><div class="info"><div class="ds" style="color:#cfd8e8">${t('mergeHint')}</div></div><button class="btn ${this.mergeable() ? '' : 'off'}" data-a="merge">${t('mergeAll')}</button></div>`;
    for (let st = 0; st < SETS; st++) {
      const m = d.bonds[st];
      h += `<div class="setcard"><h4><span>${setName(st)}</span><em class="${m ? 'on' : ''}">${m ? t('bondOn', { v: m }) : t('bondOff')}</em></h4><div class="grid4">`;
      for (let k = 0; k < 4; k++) {
        const sp = st * 4 + k; const bg = bestGrade(s, sp);
        let total = 0; for (let g = 0; g < GRADES; g++) total += s.inv[sp * GRADES + g];
        const dots = [0, 1, 2, 3].map(g => `<i style="${s.seen[sp] & (1 << g) ? 'background:' + GRADE_COLORS[g] : ''}"></i>`).join('');
        h += `<div class="card ${bg < 0 ? 'none' : ''}" data-a="item" data-id="${sp}" style="${bg >= 0 ? 'border-color:' + GRADE_COLORS[bg] : ''}"><div class="spr" style="${itemStyle(sp)}"></div><div class="gd">${dots}</div>${total ? `<div class="cnt">${total}</div>` : ''}</div>`;
      }
      h += `</div></div>`;
    }
    return h;
  }

  pGacha() {
    const s = this.api.st(), d = this.api.dv();
    const c = d.gachaCost;
    let h = `<div class="bigcenter"><div class="spr" style="${iconStyle(3)}"></div><div class="ds" style="font-size:14px;color:#5B6B8C">${t('gacha_d')}</div>
      <div style="font-weight:900">${t('pity', { v: 40 - s.pity })}</div>
      <div style="display:flex;gap:10px"><button class="btn purple ${s.gems >= c ? '' : 'off'}" data-a="pull" data-n="1">${t('pull1')}<small>${c} ${t('gems')}</small></button>
      <button class="btn purple ${s.gems >= c * 10 ? '' : 'off'}" data-a="pull" data-n="10">${t('pull10')}<small>${c * 10} ${t('gems')}</small></button></div>`;
    if (this.gachaRes.length) {
      h += `<div class="res">${this.gachaRes.map((r, i) => `<div class="card" data-a="item" data-id="${r.sp}" style="border-color:${GRADE_COLORS[r.g]};animation-delay:${i * 0.06}s"><div class="spr" style="${itemStyle(r.sp)}"></div>${r.isNew ? `<div class="newtag">NEW</div>` : ''}</div>`).join('')}</div>`;
    }
    return h + `</div>`;
  }

  pBot() {
    const s = this.api.st(), d = this.api.dv();
    let h = `<div class="sec" style="font-weight:700">${t('bot_hint')}</div>`;
    const icons                         = { tap: HAND, opener: chestStyle(1, true), merger: iconStyle(2), miner: iconStyle(5) };
    for (const b of BOTS) {
      const l = bot(s, b.id);
      const full = l >= b.max;
      const cost = botCost(s, b);
      const val = (lv        ) => b.id === 'tap' ? fmtNum(lv * 0.5) : b.id === 'opener' ? fmtNum(Math.max(0.8, 10 - 0.46 * lv)) : b.id === 'miner' ? String(Math.round(lv * d.gemMult)) : '';
      const cur = l > 0 ? t('bot_' + b.id + '_d', { v: val(l) }) : '';
      const nxt = !full && b.max > 1 ? `${t('bot_next')}: ${t('bot_' + b.id + '_d', { v: val(l + 1) })}` : (l === 0 ? t('bot_' + b.id + '_d', { v: val(1) }) : '');
      h += `<div class="row"><div class="spr" style="position:relative;${icons[b.id]}"></div><div class="info"><div class="nm">${t('bot_' + b.id)}<b>${b.max > 1 ? t('lv') + l : ''}</b></div><div class="ds">${cur}${cur && nxt ? '<br>' : ''}${nxt}</div></div>
        ${full ? `<button class="btn off">${t('max')}</button>` : `<button class="btn mint ${s.coins.gte(cost) ? '' : 'off'}" data-a="bot" data-id="${b.id}">${fmt(cost)}<small>${l === 0 ? t('buy') : '+1'}</small></button>`}</div>`;
    }
    h += `<div class="sec" style="font-weight:700">${t('lucky_hint')}</div>`;
    return h;
  }

  pShop() {
    const s = this.api.st(); const busy = this.api.shopBusy();
    const icon = (k        ) => k === 'gem' ? iconStyle(5) : k === 'chest3' ? chestStyle(3) : k === 'frenzy' ? iconStyle(1) : k === 'warp' ? fxIcon(6) : k === 'golden' ? iconStyle(7) : k === 'pact' ? iconStyle(4) : k === 'perp' ? iconStyle(6) : skinCss(13);
    let h = `<div class="sec" style="font-weight:700">${t('shop_hint')}</div>`;
    for (const it of SHOP_ITEMS) {
      const own = it.once && shopOwned(s, it.id);
      const btn = own ? `<button class="btn off">${t('shop_owned')}</button>`
        : busy === it.id ? `<button class="btn off">${t('shop_wait')}</button>`
        : `<button class="btn ${busy ? 'off' : ''}" data-a="shop" data-id="${it.id}">${PCOIN(SHOP_PRICE)}</button>`;
      h += `<div class="shopi ${own ? 'own' : ''}"><div class="si"><div class="spr" style="${icon(it.icon)}"></div></div><div class="info"><div class="nm" style="font-weight:900">${t(it.key)}</div><div class="ds" style="font-size:12px;color:#5B6B8C;line-height:1.3">${t(it.key + '_d')}</div></div>${btn}</div>`;
    }
    return h;
  }

  pSkin() {
    const s = this.api.st(), d = this.api.dv();
    let h = `<div class="sec">${t('skin_hint', { v: d.skinCount * 5 })}</div><div class="skins">`;
    SKINS.forEach((k, i) => {
      const own = !!(s.skins & (1 << i));
      const on = s.skin === i;
      const cur = Math.min(skinStat(s, d, k.req), k.v);
      const req = t('req_' + k.req, { v: k.req === 'life' ? fmt(k.v) : k.v });
      h += `<div class="skc ${on ? 'on' : ''} ${own ? '' : 'lock'}" ${own ? `data-a="skin" data-id="${i}"` : ''}><div class="mb" style="${skinCss(i)}"></div><div class="n">${t('s' + i)}</div>`;
      if (own) h += `<div class="tag">${on ? t('equipped') : t('equip')}</div>`;
      else h += `<div class="r">${req}</div><div class="progress"><i style="width:${k.v ? cur / k.v * 100 : 0}%"></i></div>`;
      h += `</div>`;
    });
    return h + `</div>`;
  }

  dpModal() {
    const s = this.api.st();
    this.modal(`<div class="spr huge" style="${iconStyle(4)}"></div><h3>${t('dp_what')}</h3>
      ${permCard(s)}<div style="font-size:15px;line-height:1.4">${t('dp_explain')}</div>
      <div class="stats"><span>${t('dp_total')}</span><b>${fmt(s.dpTotal)} → +${fmt(s.dpTotal.mul(10))}%</b><span>${t('dp_have')}</span><b>${fmt(s.dp)}</b></div>
      <button class="btn blue" data-x>${t('close')}</button>`, (box, close) => {
      (box.querySelector('[data-x]')               ).addEventListener('click', close);
    });
  }

  talSel = 'origin';
  talBranch = 0;
  pTalent() {
    const s = this.api.st();
    const b = this.talBranch;
    let h = `<div class="sec" style="align-self:stretch;text-align:left">${t('tal_title')} · ${t('dp_have')} <span style="color:#2F8BFF">${fmt(s.dp)}</span> · <span style="font-weight:700">${t('tal_hint')}</span></div>`;
    // selected talent detail
    const k = PERKS.find(x => x.id === this.talSel) || PERKS[0];
    const ks = perkState(s, k.id), kl = perk(s, k.id);
    h += `<div class="detail" style="width:100%;text-align:left"><div class="info"><div class="nm">${t('perk_' + k.id)} · ${t('lvShort')}${kl}/${k.max}</div><div class="ds">${t('perk_' + k.id + '_d')}${ks === 'lock' ? ' · ' + t('needPrev') : ''}</div></div>
      ${ks === 'full' ? `<button class="btn off">${t('max')}</button>` : `<button class="btn blue ${ks === 'can' ? '' : 'off'}" data-a="perk" data-id="${k.id}">${fmt(perkCost(s, k))}<small>${t('reb_dp')}</small></button>`}</div>`;
    h += `<div class="seg brseg" style="width:100%">${[0, 1, 2].map(i => {
      const can = PERKS.some(x => x.branch === i && perkState(s, x.id) === 'can');
      return `<button data-a="tbr" data-v="${i}" class="${i === b ? 'on' : ''}"><div class="spr" style="${iconStyle([0, 2, 4][i])}"></div>${t('tal_b' + i)}${can ? '<i style="position:absolute;top:5px;right:6px;width:9px;height:9px;border-radius:50%;background:#FF3B47"></i>' : ''}</button>`;
    }).join('')}</div>`;
    // tree: shared root on top, then this branch
    const root = PERKS.find(x => x.branch === -1) ;
    const nodes = [root, ...PERKS.filter(x => x.branch === b)];
    const kids = (id        ) => nodes.filter(n => n.req === id);
    const pos                                           = {};
    let leaf = 0, maxD = 0;
    const place = (n                      , d        ) => {
      maxD = Math.max(maxD, d);
      const ch = kids(n.id);
      if (!ch.length) { pos[n.id] = { x: leaf++, d }; return; }
      ch.forEach(c => place(c, d + 1));
      const xs = ch.map(c => pos[c.id].x);
      pos[n.id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, d };
    };
    place(root, 0);
    const ROW = 96, TOP = 8, NH = 72;
    const px = (x        ) => ((x + 0.5) / Math.max(leaf, 1)) * 100;
    const H = TOP + (maxD + 1) * ROW - (ROW - NH) + 4;
    const lc = (id        ) => perk(s, id) > 0 ? '#2F8BFF' : perkState(s, id) === 'lock' ? '#C9D3DC' : '#8FB8FF';
    let lines = '';
    for (const n of nodes) {
      if (!n.req) continue;
      const p = pos[n.req], c = pos[n.id];
      const y1 = TOP + p.d * ROW + NH, y2 = TOP + c.d * ROW, ym = (y1 + y2) / 2, col = lc(n.id);
      lines += `<line x1="${px(p.x)}%" y1="${y1}" x2="${px(p.x)}%" y2="${ym}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      lines += `<line x1="${px(p.x)}%" y1="${ym}" x2="${px(c.x)}%" y2="${ym}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      lines += `<line x1="${px(c.x)}%" y1="${ym}" x2="${px(c.x)}%" y2="${y2}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
    }
    h += `<div class="tree tal" style="height:${H}px;width:100%"><svg height="${H}">${lines}</svg>`;
    for (const n of nodes) {
      const ss = perkState(s, n.id), nl = perk(s, n.id);
      const cls = ss === 'full' ? 'full' : ss === 'lock' ? 'lock' : ss === 'can' ? 'can' : nl > 0 ? 'has' : '';
      const pips = n.max <= 10 ? Array.from({ length: n.max }, (_, i) => `<i class="${i < nl ? 'on' : ''}"></i>`).join('') : '';
      h += `<div class="node ${cls} ${n.id === this.talSel ? 'sel' : ''}" data-a="tsel" data-id="${n.id}" style="left:${px(pos[n.id].x)}%;top:${TOP + pos[n.id].d * ROW}px"><div class="nn">${t('perk_' + n.id)}</div><div class="nl">${nl}/${n.max}</div><div class="pips">${pips}</div></div>`;
    }
    return h + `</div>`;
  }

  // Tap a tree node → popup with its details and a learn button (stays open for repeated levels).
  nodeModal(kind              , id        ) {
    const build = () => {
      const s = this.api.st();
      if (kind === 'sk') {
        const k = SKILLS.find(x => x.id === id) ; const l = sk(s, id); const st = this.skillState(id);
        const req = k.req ? SKILLS.find(x => x.id === k.req) : null;
        const pips = Array.from({ length: k.max }, (_, i) => `<i style="width:10px;height:10px;border-radius:50%;background:${i < l ? '#2FC48D' : '#DCE9E3'}"></i>`).join('');
        return `<div class="spr" style="width:64px;height:64px;${BRANCH_ICON[k.branch]}"></div><h3>${t(k.id)}</h3>
          <div style="font-weight:900;color:#5B6B8C">${t('lvShort')} ${l}/${k.max}</div><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${pips}</div>
          <div style="font-size:16px;line-height:1.4">${t(k.id + '_d')}</div>
          ${st === 'lock' && req ? `<div style="color:#FF3B47;font-weight:900">${t('needPrev')}: ${t(req.id)}</div>` : ''}
          <div style="font-size:13px;color:#5B6B8C">${t('sk_points')}: ${s.sp}</div>
          <div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1;background:#E3EEF0;color:#17264A" data-x>${t('close')}</button>
          ${st === 'full' ? `<button class="btn off" style="flex:1">${t('max')}</button>` : `<button class="btn ${st === 'can' ? '' : 'off'}" style="flex:1" data-y>${t('learn')}<small>${k.cost} SP</small></button>`}</div>`;
      }
      const k = PERKS.find(x => x.id === id) ; const l = perk(s, id); const st = perkState(s, id);
      const req = k.req ? PERKS.find(x => x.id === k.req) : null;
      const pips = Array.from({ length: k.max }, (_, i) => `<i style="width:10px;height:10px;border-radius:50%;background:${i < l ? '#2F8BFF' : '#DCE9E3'}"></i>`).join('');
      return `<div class="spr" style="width:64px;height:64px;${iconStyle(4)}"></div><h3>${t('perk_' + k.id)}</h3>
        <div style="font-weight:900;color:#5B6B8C">${t('lvShort')} ${l}/${k.max}</div><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${pips}</div>
        <div style="font-size:16px;line-height:1.4">${t('perk_' + k.id + '_d')}</div>
        ${st === 'lock' && req ? `<div style="color:#FF3B47;font-weight:900">${t('needPrev')}: ${t('perk_' + req.id)}</div>` : ''}
        <div style="font-size:13px;color:#5B6B8C">${t('dp_have')}: ${fmt(s.dp)}</div>
        <div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1;background:#E3EEF0;color:#17264A" data-x>${t('close')}</button>
        ${st === 'full' ? `<button class="btn off" style="flex:1">${t('max')}</button>` : `<button class="btn blue ${st === 'can' ? '' : 'off'}" style="flex:1" data-y>${fmt(perkCost(s, k))}<small>${t('reb_dp')}</small></button>`}</div>`;
    };
    this.modal(build(), (box, close) => {
      box.addEventListener('click', (e) => {
        const tg = e.target               ;
        if (tg.closest('[data-x]')) { close(); return; }
        const y = tg.closest('[data-y]')                      ;
        if (!y || y.classList.contains('off')) return;
        if (kind === 'sk') this.api.learn(id); else this.api.buyPerk(id);
        box.innerHTML = build();
        this.lastHtml = ''; this.renderPanel();
      });
    });
  }

  rebModal() {
    const s = this.api.st(); const g = rebirthGain(s);
    if (g.lte(0)) return;
    const after = { ...s, dpTotal: s.dpTotal.add(g) };
    this.modal(`<div class="spr huge" style="${iconStyle(4)}"></div><h3>${t('reb_title')}</h3>
      <div style="font-size:20px;font-weight:900">${t('reb_gain')} <span style="color:#2F8BFF">+${fmt(g)} ${t('reb_dp')}</span></div>
      <div style="font-size:13px;color:#5B6B8C">${t('dp_total')} ${fmt(s.dpTotal)} → ${fmt(after.dpTotal)} · +${fmt(after.dpTotal.mul(10))}%</div>
      <div style="width:100%;font-size:14px;font-weight:900;display:flex;justify-content:space-between;background:#F2F7F5;border-radius:12px;padding:8px 10px"><span>${t('permMult')} ×${fmt(permMult(s))}</span><span style="color:#2F8BFF">${t('permNext')} ×${fmt(permMult(after))}</span></div>
      <div class="stats" style="text-align:left;grid-template-columns:auto 1fr;gap:6px 10px"><span style="color:#FF3B47">${t('reb_resets')}</span><b style="font-weight:700">${t('reb_reset_list')}</b><span style="color:#2FC48D">${t('reb_keeps')}</span><b style="font-weight:700">${t('reb_keep_list')}</b></div>
      <div style="display:flex;gap:10px;width:100%"><button class="btn off" style="flex:1;opacity:1;background:#E3EEF0;color:#17264A" data-c>${t('cancel')}</button><button class="btn blue" style="flex:1" data-y>${t('reb_go')}</button></div>`, (box, close) => {
      (box.querySelector('[data-c]')               ).addEventListener('click', close);
      (box.querySelector('[data-y]')               ).addEventListener('click', () => { close(); this.api.rebirth(); this.lastHtml = ''; this.renderPanel(); });
    });
  }

  pReb() {
    const s = this.api.st();
    const g = rebirthGain(s);
    const perksH = this.pTalent();
    return `<div class="bigcenter"><div class="spr" style="${iconStyle(4)}"></div>
      <div style="font-size:14px;color:#5B6B8C">${t('reb_d')}</div>
      <div class="row" style="width:100%"><div class="info"><div class="nm">${t('reb_dp')}: ${fmt(s.dp)} · ${t('dp_total')} ${fmt(s.dpTotal)}</div><div class="ds">${t('reb_dp_d')} · ${t('reb_count')} ${s.rebirths}</div></div></div>
      ${permCard(s)}
      ${g.gt(0) ? `<div style="font-size:18px;font-weight:900">${t('reb_gain')} <span style="color:#2F8BFF">+${fmt(g)} ${t('reb_dp')}</span></div><div style="font-size:13px;color:#5B6B8C">${t('permNext')} ×${fmt(permMult({ ...s, dpTotal: s.dpTotal.add(g) }))}</div>` : `<div style="font-weight:900">${t('reb_need', { v: fmt(2e6) })}</div><div class="progress" style="width:100%"><i style="width:${Math.min(100, num(s.runCoins.div(2e6)) * 100)}%"></i></div>`}
      ${momCard(s)}
      <button class="btn blue ${g.gt(0) ? '' : 'off'}" data-a="reb" style="min-width:180px;min-height:56px;font-size:20px">${t('reb_btn')}</button>
      <button class="info-btn" data-a="dpinfo">${t('dp_what')}</button>${perksH}</div>`;
  }

  pressing = false;
  onBody(el             ) {
    if (!el) return;
    const a = el.dataset.a, id = el.dataset.id || '';
    if (a === 'fx') {
      const v = el.dataset.v || '';
      if (id === 'pick') { this.fxView.pickPlot = this.fxView.pickPlot === +v ? -1 : +v; void snd?.playCue('sfx.ui', { eventId: 'pick:' + Date.now() }); }
      else if (id === 'plant') { if (this.api.fx('plant', this.fxView.pickPlot + ':' + v) >= 0) this.fxView.pickPlot = -1; }
      else if (id === 'spin') { const p = this.api.fx('spin', v); if (p >= 0) this.wheelModal(p); }
      else this.api.fx(id, v);
      this.lastHtml = ''; this.renderPanel();
      return;
    }
    if (a === 'shop') { if (!this.api.shopBusy()) this.api.buyShop(id); }
    else if (a === 'bn') { this.buyN = +el.dataset.v ; void snd?.playCue('sfx.ui', { eventId: 'bn:' + Date.now() }); }
    else if (a === 'up') this.api.buyUp(id, +el.dataset.n );
    else if (a === 'gen') this.api.buyGen(id, +el.dataset.n );
    else if (a === 'br') { this.skBranch = +el.dataset.v ; this.selSkill = SKILLS.find(x => x.branch === this.skBranch) .id; void snd?.playCue('sfx.ui', { eventId: 'br:' + Date.now() }); }
    else if (a === 'sel') { this.selSkill = id; void snd?.playCue('sfx.ui', { eventId: 'sel:' + Date.now() }); this.nodeModal('sk', id); }
    else if (a === 'learn') this.api.learn(id);
    else if (a === 'merge') this.api.mergeAll();
    else if (a === 'item') this.itemModal(+id);
    else if (a === 'pull') { const r = this.api.pull(+el.dataset.n ); if (r) this.gachaRes = r; }
    else if (a === 'bot') this.api.buyBot(id);
    else if (a === 'perk') this.api.buyPerk(id);
    else if (a === 'skin') this.api.equipSkin(+id);
    else if (a === 'dpinfo') { this.dpModal(); return; }
    else if (a === 'reb') { if (rebirthGain(this.api.st()).lte(0)) return; void snd?.playCue('sfx.ui', { eventId: 'rebm:' + Date.now() }); this.rebModal(); return; }
    else if (a === 'tbr') { this.talBranch = +el.dataset.v ; this.talSel = PERKS.find(x => x.branch === this.talBranch) .id; void snd?.playCue('sfx.ui', { eventId: 'tbr:' + Date.now() }); }
    else if (a === 'tsel') { this.talSel = id; void snd?.playCue('sfx.ui', { eventId: 'tsel:' + Date.now() }); this.nodeModal('tal', id); }
    this.lastHtml = ''; this.renderPanel();
  }

  // ---------------- modals / toasts ----------------
  modal(html        , bind                                               ) {
    const host = this.els.modalHost;
    const bg = document.createElement('div'); bg.className = 'modalbg';
    bg.innerHTML = `<div class="modal">${html}</div>`;
    host.appendChild(bg);
    const close = () => { bg.remove(); };
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bind(bg.querySelector('.modal')               , close);
  }

  itemModal(sp        ) {
    const s = this.api.st();
    void snd?.playCue('sfx.ui', { eventId: 'item:' + Date.now() });
    const bg = bestGrade(s, sp);
    const type = SET_BONUS[setOf(sp)];
    const rows = [0, 1, 2, 3].map(g => `<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:${s.seen[sp] & (1 << g) ? '#17264A' : '#B5C0CC'}"><i style="width:10px;height:10px;border-radius:50%;background:${GRADE_COLORS[g]}"></i>${t('grade' + g)} · ${t('b_' + type, { v: fmtNum(BONUS_PER[type] * GRADE_VAL[g]) })} · ${t('copies')} ${s.inv[sp * GRADES + g]}</div>`).join('');
    this.modal(`<div class="spr huge" style="${itemStyle(sp)};${bg < 0 ? 'filter:brightness(0) opacity(.2)' : ''}"></div>
      <h3>${bg < 0 ? t('unknown') : itemName(sp)}</h3><div style="font-size:13px;color:#5B6B8C">${setName(setOf(sp))}${bg >= 0 ? ' · <b style="color:' + GRADE_COLORS[bg] + '">' + t('grade' + bg) + '</b>' : ''}</div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">${rows}</div>
      <button class="btn" data-x>${t('close')}</button>`, (box, close) => {
      (box.querySelector('[data-x]')               ).addEventListener('click', close);
    });
  }

  offlineModal(sec        , coins         , onClaim            ) {
    const time = fmtTime(sec, v => t('hours', { v }), v => t('minutes', { v }));
    this.modal(`<div class="spr huge" style="${iconStyle(6)}"></div><h3>${t('offline_title')}</h3><div>${t('offline_d', { t: time })}</div>
      <div class="big"><div class="spr" style="width:36px;height:36px;${iconStyle(7)}"></div>${fmt(coins)}</div><div style="font-size:12px;color:#5B6B8C">${t('offline_rule', { r: +(this.api.dv().offlineRate * 100).toFixed(1), h: this.api.dv().offlineHours })}</div><button class="btn mint" data-x style="min-width:160px">${t('claim')}</button>`, (box, close) => {
      (box.querySelector('[data-x]')               ).addEventListener('click', () => { onClaim(); close(); });
    });
  }

  settings() {
    const s = this.api.st();
    const p = this.api.prefs();
    const seg = (key        , val         ) => `<div class="seg"><button data-k="${key}" data-v="1" class="${val ? 'on' : ''}">${t('on')}</button><button data-k="${key}" data-v="0" class="${val ? '' : 'on'}">${t('off')}</button></div>`;
    const cur = getLang();
    this.modal(`<div style="font-size:13px;font-weight:900;color:#FF3B47">${GAME_TITLE}</div><h3>${t('settings')}</h3>
      <div class="optrow"><label>${t('language')}</label><div class="seg">${LANGS.map(l => `<button data-l="${l}" class="${l === cur ? 'on' : ''}">${LANG_LABEL[l]}</button>`).join('')}</div></div>
      <div class="optrow"><label>${t('music')}</label>${seg('music', p.music)}</div>
      <div class="optrow"><label>${t('sfx')}</label>${seg('sfx', p.sfx)}</div>
      <div class="sec" style="align-self:flex-start;margin:6px 0 0">${t('stats')}</div>
      <div class="stats"><span>${t('st_clicks')}</span><b>${fmt(s.clicks)}</b><span>${t('st_chests')}</span><b>${fmt(s.opened)}</b><span>${t('st_life')}</span><b>${fmt(s.lifeCoins)}</b><span>${t('reb_count')}</span><b>${s.rebirths}</b></div>
      <button class="btn" data-x>${t('close')}</button>`, (box, close) => {
      box.addEventListener('click', (e) => {
        const el = e.target               ;
        if (el.dataset.x !== undefined) { close(); return; }
        if (el.dataset.l) { this.api.setLang(el.dataset.l        ); close(); this.settings(); return; }
        if (el.dataset.k) {
          const q = this.api.prefs();
          const v = el.dataset.v === '1';
          this.api.setPrefs(el.dataset.k === 'music' ? v : q.music, el.dataset.k === 'sfx' ? v : q.sfx);
          close(); this.settings();
        }
      });
    });
  }



  toast(iconCss        , text        , color         ) {
    const host = this.els.toasts;
    while (host.children.length > 3) host.firstElementChild .remove();
    const d = document.createElement('div'); d.className = 'toast';
    if (color) d.style.boxShadow = `0 0 0 3px ${color}`;
    d.innerHTML = `<div class="spr" style="${iconCss}"></div><span></span>`;
    (d.querySelector('span')               ).textContent = text;
    host.appendChild(d);
    setTimeout(() => d.remove(), 2700);
  }
}

function fmtNum(v        ) { return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
export { itemBonusValue };

const TROPHY = '<svg viewBox="0 0 24 24"><path fill="#17264A" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/></svg>';
// floor(log10(1 + lifetime coins) * 100) = "digits of lifetime coins x100". Logarithmic, so it can't blow up:
// 1e1000 coins = 100,000 pts; WEALTH_MAX (1e12, LEADERBOARD.json maxRaw) needs 1e(1e10) coins — far beyond any real run,
// and stays an exact integer (< 2^53). Decimal exponents top out near 9e15, so the clamp also guards the library limit.
export const WEALTH_MAX = 1e12;
export function wealthScore(lifeCoins                  ) {
  const l = lifeCoins instanceof Decimal ? (lifeCoins.mantissa > 0 ? (lifeCoins.exponent > 15 ? lifeCoins.exponent + Math.log10(lifeCoins.mantissa) : lifeCoins.add(1).log10()) : 0) : Math.log10(1 + Math.max(0, lifeCoins));
  const v = Math.floor(l * 100);
  return Number.isFinite(v) ? Math.max(0, Math.min(WEALTH_MAX, v)) : WEALTH_MAX;
}
function escapeHtml(x        ) { return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }                          )[c]); }
