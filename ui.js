// DOM menus layered over the pixi canvas (logical 540×H, scaled with the stage).
import { core, W, eid, setMusic, loadMany } from './core.js';
import { CHARS, CHAR_BY_ID, ELEMENTS, EL_CSS, GEM_ICON, STAGES, charArt, tierCost, TIER_STAT, TIER_ENERGY } from './data.js';
                                         
import { save, persist, isUnlocked, tierOf, stats, canAfford, shortfall, tryUpgrade } from './state.js';
import { t, setLang, lang, LANGS, LANG_LABEL, FONT } from './i18n.js';
import { scopeCss } from './scope-css.js';
import { A } from './src/assets.js';
                                      
import { Battle } from './battle.js';
                                                

/*
 * ★ 原来这里是 `export const uiRoot = document.createElement('div')` —— **模块顶层碰 DOM**。
 *   两个后果：① 宿主 `check-plugin.mjs` 在 Node 里真 `import()` 这个包时直接抛；
 *   ② 模块级节点在第二次挂载时还指着上一次已经被移除的那个（切走再切回 = 白屏）。
 *   所以改成 `initUI()` 里建、`destroyUI()` 里清。
 */
export let uiRoot = null;
let styleEl = null;
let screen             = () => {};
let battle                = null;
let setBackdrop                        = () => {};

/** 开局收费回调：由 `game.js` 的 `start(opts)` 注入；独立网页里是 null（不收费）。 */
let chargePlay = null;
export function setChargePlay(fn) { chargePlay = fn; }

const CSS = `
#ui{overflow:hidden;position:absolute;left:0;top:0;width:${W}px;transform-origin:0 0;font-family:${FONT};color:#5d4a86;user-select:none;-webkit-user-select:none;pointer-events:none}
#ui *{box-sizing:border-box}
#ui .scr{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:auto}
#ui .scr.pass{pointer-events:none}
#ui .top{display:flex;align-items:center;gap:8px;padding:14px 16px 6px}
#ui .gems{display:flex;gap:4px;flex:1;flex-wrap:wrap}
#ui .gem{display:flex;align-items:center;gap:2px;background:rgba(255,255,255,.78);border-radius:14px;padding:2px 8px 2px 2px;font-weight:800;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px rgba(150,110,200,.25)}
#ui .gem img{width:24px;height:24px}
#ui .gem.prism{cursor:pointer;position:relative}
#ui .gem.prism::before{content:'';position:absolute;inset:-13px -6px}
#ui .gem .plus{margin-left:4px;width:18px;height:18px;border-radius:50%;background:#f5b950;color:#fff;font-size:14px;line-height:18px;text-align:center}
#ui .icon-btn{line-height:1;padding:0;width:var(--m);height:var(--m);border-radius:50%;border:3px solid #fff;background:linear-gradient(#cdb6f5,#a98be6);color:#fff;font-size:24px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(120,80,180,.35);cursor:pointer;flex:none}
#ui .btn{border:3px solid #fff;border-radius:999px;padding:12px 26px;font-family:inherit;font-size:22px;font-weight:900;color:#fff;cursor:pointer;background:linear-gradient(#ffb3d4,#f48ab8);box-shadow:0 4px 12px rgba(220,110,170,.4),inset 0 2px 0 rgba(255,255,255,.6);text-shadow:0 2px 0 rgba(180,70,130,.45);min-height:max(52px,var(--m))}
#ui .btn.blue{background:linear-gradient(#a9d4ff,#7aa9f2);box-shadow:0 4px 12px rgba(90,130,220,.4),inset 0 2px 0 rgba(255,255,255,.6);text-shadow:0 2px 0 rgba(60,90,170,.45)}
#ui .btn.violet{background:linear-gradient(#d3bdfa,#a88be8);text-shadow:0 2px 0 rgba(100,60,170,.45)}
#ui .btn.gold{background:linear-gradient(#ffe48f,#f5b950);text-shadow:0 2px 0 rgba(170,110,30,.5)}
#ui .btn:disabled{filter:grayscale(.8) opacity(.6);cursor:default}
#ui .btn:active:not(:disabled),#ui .icon-btn:active,#ui .tap:active{transform:scale(.95)}
#ui .panel{background:rgba(255,255,255,.86);border:3px solid #fff;border-radius:22px;box-shadow:0 6px 20px rgba(150,110,210,.25)}
#ui .title{font-size:50px;padding:0 12px;font-weight:900;color:#fff;text-align:center;letter-spacing:2px;text-shadow:0 0 18px #e7c9ff,0 3px 0 #b48ce0,0 6px 14px rgba(140,90,200,.5);font-style:italic}
#ui .sub{text-align:center;font-weight:800;color:#8a6fc0;font-size:16px}
#ui h2{margin:0;font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 0 #a985e0,0 0 10px #d9c4ff;flex:1;text-align:center}
#ui .scroll{flex:1;overflow-y:auto;padding:6px 16px 24px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
#ui .area{padding:12px;margin-bottom:12px}
#ui .area-h{display:flex;align-items:center;gap:8px;font-weight:900;font-size:19px;margin-bottom:10px}
#ui .area-h img{width:30px;height:30px}
#ui .stages{display:flex;gap:8px}
#ui .st{flex:1;min-height:max(64px,var(--m));border-radius:16px;border:3px solid #fff;background:linear-gradient(#f3eaff,#e3d5fb);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:16px;cursor:pointer;color:#6c56a0;position:relative}
#ui .st.boss{background:linear-gradient(#ffe2f0,#f7c3df);color:#b0477e}
#ui .st.done::after{content:'★';position:absolute;top:2px;right:8px;color:#f5b950;font-size:16px}
#ui .st.lock{filter:grayscale(1) opacity(.5);cursor:default}
#ui .st small{font-size:12px;font-weight:800;opacity:.8}
#ui .face{background-repeat:no-repeat;background-size:190%;background-position:50% 20%;background-color:#f6effd}
#ui .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#ui .cc{position:relative;border-radius:18px;border:3px solid #fff;overflow:hidden;aspect-ratio:0.82;cursor:pointer;box-shadow:0 3px 10px rgba(150,110,210,.25)}
#ui .cc .nm{position:absolute;left:0;right:0;bottom:0;padding:16px 4px 5px;background:linear-gradient(transparent,rgba(255,255,255,.95) 50%);text-align:center;font-weight:900;font-size:15px}
#ui .cc .el{position:absolute;left:4px;top:4px;width:26px;height:26px}
#ui .cc .stars{color:#f5b950;font-size:13px;letter-spacing:-1px;text-shadow:0 1px 0 #fff}
#ui .cc.lock{filter:grayscale(1) brightness(1.1) opacity(.6)}
#ui .cc .lk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:14px;padding:8px;color:#6c56a0;background:rgba(255,255,255,.55)}
#ui .cc .lk .buy{display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:3px 9px;border-radius:999px;background:linear-gradient(#ffe6a8,#f8c65a);border:2px solid #fff;color:#7a4a12;font-size:14px;box-shadow:0 2px 5px rgba(180,120,40,.35)}
#ui .cc .lk .buy img{width:18px;height:18px;display:block}
#ui .price{display:inline-flex;align-items:center;gap:.25em;vertical-align:middle}
#ui .price img{width:24px;height:24px;flex:none}
#ui .cc.aw{border-color:#ffd86b;box-shadow:0 0 12px #ffd86b}
#ui .ghost{position:absolute;width:110px;height:110px;border-radius:50%;border:4px solid #fff;box-shadow:0 8px 20px rgba(120,80,180,.5),0 0 0 4px #f48ab8;pointer-events:none;z-index:50}
#ui.dragging .slot{outline:3px dashed #fff;outline-offset:3px}
#ui .cc .tm{position:absolute;right:4px;top:4px;background:#f48ab8;color:#fff;border-radius:10px;font-size:11px;font-weight:900;padding:2px 6px;border:2px solid #fff}
#ui .team{display:flex;gap:8px;padding:4px 16px 4px}
#ui .teambox{margin:4px 14px 10px;padding:10px 12px 12px;background:linear-gradient(#fff7fc,#f0e2ff);border:4px solid #f48ab8;border-radius:24px;box-shadow:0 6px 18px rgba(200,100,170,.4),inset 0 0 0 3px #fff}
#ui .teambox .th{display:flex;align-items:center;gap:8px;margin-bottom:8px}
#ui .teambox .th b{background:linear-gradient(#ffb3d4,#f48ab8);color:#fff;border-radius:12px;padding:3px 14px;font-size:17px;border:2px solid #fff;flex:none;box-shadow:0 2px 5px rgba(220,110,170,.4)}
#ui .teambox .th span{font-size:12px;font-weight:800;color:#8a6fc0;flex:1;line-height:1.25}
#ui .teambox .team{padding:0}
#ui .teambox .slot{border-color:#f7b6d6;overflow:hidden}
#ui .slot i{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:12px;font-weight:900;text-align:center;background:rgba(255,255,255,.88);padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui .grid.sm{grid-template-columns:repeat(5,1fr);gap:7px}
#ui .grid.sm .cc{border-radius:14px;border-width:2px}
#ui .grid.sm .nm{font-size:12px;padding:12px 1px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ui .grid.sm .stars{font-size:10px}
#ui .grid.sm .el{width:20px;height:20px;left:2px;top:2px}
#ui .grid.sm .tm{font-size:9px;padding:1px 4px;right:2px;top:2px;border-width:1px}
#ui .grid.sm .lk{font-size:10px;padding:2px;line-height:1.2}
#ui .slot{flex:1;aspect-ratio:1;border-radius:16px;border:3px solid #fff;cursor:pointer;position:relative;box-shadow:0 3px 8px rgba(150,110,210,.3)}
#ui .slot.sel{border-color:#f48ab8;box-shadow:0 0 0 3px #ffc2dc,0 0 14px #f48ab8}
#ui .slot b{position:absolute;left:4px;top:2px;color:#fff;text-shadow:0 1px 2px #8a5fb8;font-size:15px}
#ui .hint{font-size:13px;font-weight:800;text-align:center;color:#fff;text-shadow:0 1px 3px #8a6fc0;padding:4px 16px}
#ui .art{position:relative;height:42%;min-height:300px;display:flex;justify-content:center}
#ui .art img{height:100%;filter:drop-shadow(0 6px 14px rgba(150,110,210,.35));animation:mgs-float 4s ease-in-out infinite}
#ui .art.aw img{filter:drop-shadow(0 0 10px #ffe08a) drop-shadow(0 0 22px #ffd06b)}
/* ★ 关键帧名带 mgs- 前缀：@keyframes 是**全局**的（scopeCss 作用域不了它），
   float / spin / flash / pop 这种名字撞上宿主的 Tailwind（animate-spin）
   或别的插件时，**后注入的那份会赢**，而症状是「宿主的动画变快了/不转了」。
   宿主自己那套已经统一叫 kqf-*，我们这边跟着加前缀。
   ⚠️ 这段注释在**模板字符串**里，不能出现反引号（会把 CSS 字符串提前闭合）。 */
@keyframes mgs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
#ui .info{margin:0 14px;padding:12px 14px;flex:1;overflow-y:auto;touch-action:pan-y}
#ui .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#ui .tag{border-radius:10px;padding:2px 10px;color:#fff;font-weight:900;font-size:14px;border:2px solid #fff}
#ui .stat{display:flex;justify-content:space-between;font-weight:800;font-size:15px;padding:2px 0}
#ui .stat i{font-style:normal;color:#e27aa9}
#ui .sk{margin-top:8px;font-size:14px;line-height:1.35}
#ui .sk b{color:#8a5fc8;font-size:15px}
#ui .cost{display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0;flex-wrap:wrap}
#ui .cost span{display:flex;align-items:center;font-weight:900;font-size:16px}
#ui .cost span.no{color:#e05a7a}
#ui .cost img{width:28px;height:28px}
#ui .cost .plus-btn{width:48px;height:48px;border-radius:50%;background:linear-gradient(#ffe48f,#f5b950);border:3px solid #fff;color:#fff;font-size:26px;justify-content:center;cursor:pointer;box-shadow:0 3px 8px rgba(170,110,30,.35)}
#ui .modal{position:absolute;inset:0;background:rgba(120,90,170,.35);display:flex;align-items:center;justify-content:center;pointer-events:auto;backdrop-filter:blur(2px)}
#ui .modal .panel{width:86%;padding:20px;display:flex;flex-direction:column;gap:12px;align-items:stretch;text-align:center;max-height:90%;overflow-y:auto}
#ui .big{font-size:40px;font-weight:900;color:#fff;text-shadow:0 3px 0 #b48ce0,0 0 16px #e7c9ff}
#ui .seg{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
#ui .seg button{flex:1;min-height:var(--m);border-radius:14px;border:3px solid #fff;background:#efe6fb;font-family:inherit;font-weight:900;font-size:16px;color:#6c56a0;cursor:pointer}
#ui .seg button.on{background:linear-gradient(#ffb3d4,#f48ab8);color:#fff}
#ui .bar{height:16px;border-radius:8px;background:rgba(255,255,255,.8);border:2px solid #fff;overflow:hidden}
#ui .bar div{height:100%;background:linear-gradient(90deg,#ffb3d4,#b9a0f5);width:0}
#ui .spin{width:46px;height:46px;margin:0 auto;animation:mgs-spin 1.2s linear infinite;font-size:44px;line-height:46px;color:#ffd86b;text-shadow:0 0 10px #fff}
@keyframes mgs-spin{to{transform:rotate(360deg)}}
#ui .flash{position:absolute;inset:0;background:#fff;pointer-events:none;animation:mgs-flash 1.2s ease-out forwards}
@keyframes mgs-flash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
#ui .pop{animation:mgs-pop .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes mgs-pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
#ui .rk{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:#f6effd;border:2px solid #fff;text-align:left;font-weight:800}
#ui .rk.me{background:linear-gradient(#fff0f7,#ffd9ea);border-color:#f48ab8}
#ui .rk .no{width:34px;text-align:center;font-size:20px;font-weight:900;color:#a58bd0;flex:none}
#ui .rk .av{width:36px;height:36px;border-radius:50%;background:#e3d5fb center/cover;flex:none;border:2px solid #fff}
#ui .rk .nmx{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px}
#ui .rk .sc{font-size:14px;color:#e27aa9;white-space:nowrap;flex:none}
#ui .rklist{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow-y:auto;touch-action:pan-y}
#ui .leader{flex:1;display:flex;justify-content:center;align-items:flex-end;min-height:0;overflow:hidden}
#ui .leader img{height:100%;max-height:520px;animation:mgs-float 4s ease-in-out infinite;filter:drop-shadow(0 8px 18px rgba(150,110,210,.4))}
`;

function h(tag        , cls = '', html = '')              {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function tap(el             , fn            ) {
  el.addEventListener('click', () => { void core.sound?.playCue('ui.tap', { eventId: eid('tap') }); fn(); });
  return el;
}
function cname(id        ) { return t('name_' + id); }
function ctitle(id        ) { return t((tierOf(id) > 0 ? 'title1_' : 'title0_') + id); }
function stars(tier        ) { return '★'.repeat(tier + 1) + '☆'.repeat(2 - tier); }
function gemBar() {
  const g = h('div', 'gems');
  for (const e of ELEMENTS) g.appendChild(h('div', 'gem', `<img src="${GEM_ICON[e]}">${save.gems[e]}`));
  // 无色水晶现在是**通关掉落**（见 onBattleEnd），没有商店入口了 —— 只读显示。
  g.appendChild(h('div', 'gem prism', `<img src="${A('assets/ui-gem/prism.png')}">${save.prism || 0}`));
  return g;
}
function clear() { if (uiRoot) uiRoot.innerHTML = ''; }
const BACK_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" style="display:block"><path d="M15 4.5 L7.5 12 L15 19.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function backBtn(fn            ) { return tap(h('div', 'icon-btn', BACK_SVG), fn); }
// Vector gear centred exactly on (12,12) — the ⚙ glyph sat off-centre because of font metrics.
const GEAR_SVG = (() => {
  const teeth = 8, ro = 10.6, ri = 8, pts          = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, hw = Math.PI / teeth * 0.5;
    for (const [ang, r] of [[a - hw * 1.25, ri], [a - hw * 0.75, ro], [a + hw * 0.75, ro], [a + hw * 1.25, ri]]) {
      pts.push(`${(12 + Math.cos(ang) * r).toFixed(2)},${(12 + Math.sin(ang) * r).toFixed(2)}`);
    }
  }
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block"><path fill="#fff" fill-rule="evenodd" d="M${pts.join(' L')} Z M15.4 12 A3.4 3.4 0 1 0 8.6 12 A3.4 3.4 0 1 0 15.4 12 Z"/></svg>`;
})();
function areaName(a        ) { return `${t('area' + (a % 5))} ${Math.floor(a / 5) + 1}`; }

/**
 * 建 UI 层。
 *
 * @param backdrop 背景图切换回调
 * @param opts.host  宿主给的容器（不传 = 独立网页，挂 `#app`）
 * @param opts.scope 作用域类名（随机，如 `moestrike-a1b2c3`）
 *
 * ★ 样式必须经 `scopeCss` 收进根类名：这份 CSS 里有 `.grid` / `.btn` / `.panel` /
 *   `.modal` 这种通用类名，直接注入会盖掉宿主的 Tailwind 工具类
 *   （未分层样式胜过 `@layer utilities`）—— 症状是**宿主**坏了，不是游戏坏了。
 */
export function initUI(backdrop, opts = {}) {
  setBackdrop = backdrop;
  screen = showHome;
  battle = null;
  const scope = opts.scope || 'moestrike';
  const host = opts.host || document.getElementById('app') || document.body;
  // 作用域容器：`#ui` 要**在它里面**，否则 `.scope #ui{…}` 一条都不匹配
  let wrap = host.querySelector(':scope > .' + scope);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = scope;
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    host.appendChild(wrap);
  }
  styleEl = document.createElement('style');
  styleEl.textContent = scopeCss(CSS, '.' + scope);
  document.head.appendChild(styleEl);
  uiRoot = document.createElement('div');
  uiRoot.id = 'ui';
  wrap.appendChild(uiRoot);
}

/** 卸载：停掉战斗、摘样式、摘节点。**每一步单独 try** —— 前面抛了后面就不执行了。 */
export function destroyUI() {
  try { battle?.destroy(); } catch { /* ignore */ }
  battle = null;
  screen = () => {};
  setBackdrop = () => {};
  chargePlay = null;
  try { styleEl?.remove(); } catch { /* ignore */ }
  styleEl = null;
  try { uiRoot?.remove(); } catch { /* ignore */ }
  uiRoot = null;
}

export function layoutUI() {
  // `mountDisplay` 的第一次 onResize 可能在 initUI 之前就到（微任务），
  // 那时候还没有 UI 层 —— 直接返回，别让整个启动流程挂在这一句上。
  if (!uiRoot) return;
  uiRoot.style.height = core.H + 'px';
  uiRoot.style.transform = `translate(${core.offX}px,${core.offY}px) scale(${core.scale})`;
  uiRoot.style.setProperty('--m', `${Math.ceil(Math.max(48, 50 / core.scale))}px`);
}

export function refresh() { screen(); }

/**
 * 调试钩子：把当前战斗交出去。
 *
 * ★ 为什么需要它 —— 这是一款**回合制弹弓**，球靠摩擦减速，
 *   实测**一回合 10 秒以上**，一整关 5 波打完要 6 分钟。
 *   让 e2e 真打完一场，一套两屏就是 12 分钟，还随时可能超时；
 *   而「通关掉落」这条逻辑（`onBattleEnd` 里的 `prismGain`）恰恰只有
 *   打赢才走得到。所以 e2e 读回合数用 `turn`、验结算用 `finish(true)` ——
 *   走的都是游戏自己的方法，没有测试专用分支。
 */
export function currentBattle() { return battle; }

// ---------- home ----------
export function showHome() {
  screen = showHome;
  setBackdrop('assets/bg/home.webp');
  setMusic('home');
  clear();
  const s = h('div', 'scr');
  const top = h('div', 'top');
  top.appendChild(gemBar());
  top.appendChild(tap(h('div', 'icon-btn', GEAR_SVG), showSettings));
  s.appendChild(top);
  const title = h('div', 'title', t('title'));
  title.style.marginTop = '10px';
  s.appendChild(title);
  s.appendChild(h('div', 'sub', `${t('stage', { n: Math.min(save.cleared + 1, STAGES.length) })} · ${areaName(STAGES[Math.min(save.cleared, STAGES.length - 1)].area)}`));
  const lead = h('div', 'leader');
  const img = document.createElement('img');
  img.src = charArt(save.team[0], tierOf(save.team[0]));
  lead.appendChild(img);
  s.appendChild(lead);
  const btns = h('div');
  btns.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:0 60px 40px';
  btns.appendChild(tap(h('button', 'btn', t('adventure')), showStages));
  btns.appendChild(tap(h('button', 'btn violet', t('characters')), () => showChars()));
  s.appendChild(btns);
  uiRoot.appendChild(s);
}

// ---------- settings ----------
function showSettings() {
  const m = h('div', 'modal');
  const p = h('div', 'panel pop');
  p.appendChild(h('div', '', `<b style="font-size:22px">${t('settings')}</b>`));
  p.appendChild(h('div', '', `<b>${t('language')}</b>`));
  const seg = h('div', 'seg');
  for (const l of LANGS) {
    const b = tap(h('button', l === lang ? 'on' : '', LANG_LABEL[l]), () => { applyLang(l); m.remove(); screen(); showSettings(); });
    seg.appendChild(b);
  }
  p.appendChild(seg);
  p.appendChild(h('div', '', `<b>${t('sound')}</b>`));
  const seg2 = h('div', 'seg');
  const on = tap(h('button', !save.muted ? 'on' : '', t('on')), () => { setMuted(false); m.remove(); showSettings(); });
  const off = tap(h('button', save.muted ? 'on' : '', t('off')), () => { setMuted(true); m.remove(); showSettings(); });
  seg2.append(on, off);
  p.appendChild(seg2);
  p.appendChild(tap(h('button', 'btn blue', t('close')), () => m.remove()));
  m.appendChild(p);
  uiRoot.appendChild(m);
}
export function applyLang(l      ) { setLang(l); save.lang = l; persist(); }
export function setMuted(v         ) { save.muted = v; core.sound?.settings.setMuted(v); persist(); }

// ---------- stages ----------
function showStages() {
  screen = showStages;
  setBackdrop('assets/bg/home.webp');
  clear();
  const s = h('div', 'scr');
  const top = h('div', 'top');
  top.appendChild(backBtn(showHome));
  top.appendChild(h('h2', '', t('adventure')));
  top.appendChild(h('div', '', '')).style.width = '48px';
  s.appendChild(top);
  const sc = h('div', 'scroll');
  let curPanel                     = null;
  for (let a = 0; a < 20; a++) {
    const ar = h('div', 'panel area');
    const st0 = STAGES[a * 5];
    if (Math.floor(Math.min(save.cleared, STAGES.length - 1) / 5) === a) curPanel = ar;
    ar.appendChild(h('div', 'area-h', `<img src="${GEM_ICON[st0.el]}">${areaName(a)}`));
    const row = h('div', 'stages');
    for (let k = 0; k < 5; k++) {
      const st = STAGES[a * 5 + k];
      const locked = st.n > save.cleared + 1;
      const done = st.n <= save.cleared;
      const b = h('div', `st tap ${st.boss ? 'boss' : ''} ${done ? 'done' : ''} ${locked ? 'lock' : ''}`, `${st.n}<small>${st.boss ? t('boss') : ''}</small>`);
      if (!locked) tap(b, () => confirmStage(st.n));
      row.appendChild(b);
    }
    ar.appendChild(row);
    sc.appendChild(ar);
  }
  if (save.cleared >= STAGES.length) sc.appendChild(h('div', 'hint', t('allClear')));
  s.appendChild(sc);
  uiRoot.appendChild(s);
  if (curPanel) sc.scrollTop = Math.max(0, curPanel.offsetTop - sc.offsetTop - 60);
}

function joinerFor(n        ) { return CHARS.find(c => c.unlockAfter === n); }

function confirmStage(n        ) {
  const st = STAGES[n - 1];
  const m = h('div', 'modal');
  const p = h('div', 'panel pop');
  p.appendChild(h('div', '', `<b style="font-size:24px">${t('stage', { n })} · ${areaName(st.area)}</b>`));
  const strong                           = { wood: 'fire', water: 'wood', fire: 'water', light: 'dark', dark: 'light' };
  p.appendChild(h('div', 'row', `<span style="margin:auto;display:flex;align-items:center;gap:6px;font-weight:800">${t('recommended')} <img src="${GEM_ICON[strong[st.el]]}" style="width:28px"> ${t('el_' + strong[st.el])}</span>`));
  const team = h('div', 'team');
  team.style.padding = '0';
  for (const id of save.team) {
    const sl = h('div', 'slot face');
    sl.style.backgroundImage = `url(${charArt(id, tierOf(id))})`;
    sl.style.cursor = 'default';
    sl.appendChild(h('b', '', ''));
    team.appendChild(sl);
  }
  p.appendChild(team);
  const j = joinerFor(n);
  if (j && save.cleared < n) p.appendChild(h('div', 'sub', t('joinReward', { name: cname(j.id) })));
  const row = h('div', 'row');
  row.style.justifyContent = 'center';
  row.appendChild(tap(h('button', 'btn violet', t('team')), () => { m.remove(); showChars(); }));
  row.appendChild(tap(h('button', 'btn blue', t('close')), () => m.remove()));
  p.appendChild(row);
  const startBtn = tap(h('button', 'btn', t('start')), () => { m.remove(); void enterBattle(n); });
  startBtn.style.cssText = 'width:72%;margin:6px auto 0;font-size:26px;min-height:64px';
  p.appendChild(startBtn);
  m.appendChild(p);
  uiRoot.appendChild(m);
}

// ---------- characters ----------
/** Press-and-drag a heroine onto a team slot; a press without movement opens her detail page. */
function dragSource(el             , id        ) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => {
    const sx = e.clientX, sy = e.clientY;
    let ghost                     = null;
    const slotAt = (ev              ) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)                      ;
      const sl = hit?.closest('.slot')                      ;
      return sl && sl.dataset.i ? Number(sl.dataset.i) : -1;
    };
    const move = (ev              ) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) {
        ghost = h('div', 'ghost face');
        ghost.style.backgroundImage = `url(${charArt(id, tierOf(id))})`;
        uiRoot.appendChild(ghost);
        uiRoot.classList.add('dragging');
        el.style.opacity = '0.4';
      }
      if (!ghost) return;
      const r = uiRoot.getBoundingClientRect();
      ghost.style.left = `${(ev.clientX - r.left) / core.scale - 55}px`;
      ghost.style.top = `${(ev.clientY - r.top) / core.scale - 70}px`;
      const over = slotAt(ev);
      uiRoot.querySelectorAll('.slot').forEach(sl => sl.classList.toggle('sel', Number((sl               ).dataset.i) === over));
    };
    const up = (ev              ) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      uiRoot.classList.remove('dragging');
      if (!ghost) {
        if (ev.type === 'pointerup' && Math.hypot(ev.clientX - sx, ev.clientY - sy) <= 10) {
          void core.sound?.playCue('ui.tap', { eventId: eid('tap') });
          showDetail(id);
        }
        return;
      }
      ghost.remove();
      const target = ev.type === 'pointerup' ? slotAt(ev) : -1;
      if (target >= 0 && save.team[target] !== id) {
        const cur = save.team.indexOf(id);
        if (cur >= 0) save.team[cur] = save.team[target];
        save.team[target] = id;
        persist();
        void core.sound?.playCue('sfx.heal', { eventId: eid('swap') });
      }
      showChars();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

function showChars() {
  screen = showChars;
  setBackdrop('assets/bg/home.webp');
  clear();
  const s = h('div', 'scr');
  const top = h('div', 'top');
  top.appendChild(backBtn(showHome));
  top.appendChild(h('h2', '', t('characters')));
  top.appendChild(h('div', '', '')).style.width = '48px';
  s.appendChild(top);
  const tb = h('div', 'top');
  tb.style.padding = '0 16px';
  tb.appendChild(gemBar());
  s.appendChild(tb);
  const box = h('div', 'teambox');
  box.appendChild(h('div', 'th', `<b>${t('team')}</b><span>${t('teamHint')}</span>`));
  const team = h('div', 'team');
  save.team.forEach((id, i) => {
    const sl = h('div', 'slot face tap');
    sl.dataset.i = String(i);
    sl.style.backgroundImage = `url(${charArt(id, tierOf(id))})`;
    sl.appendChild(h('b', '', String(i + 1)));
    sl.appendChild(h('i', '', cname(id)));
    dragSource(sl, id);
    team.appendChild(sl);
  });
  box.appendChild(team);
  s.appendChild(box);
  const sc = h('div', 'scroll');
  const grid = h('div', 'grid sm');
  for (const c of CHARS) {
    const un = isUnlocked(c);
    const tier = tierOf(c.id);
    const card = h('div', `cc face tap ${un ? '' : 'lock'} ${tier === 2 ? 'aw' : ''}`);
    card.style.backgroundImage = `url(${charArt(c.id, tier)})`;
    card.style.backgroundSize = '150%';
    card.style.backgroundPosition = '50% 15%';
    card.appendChild(h('img', 'el')).setAttribute('src', GEM_ICON[c.el]);
    if (un && save.team.includes(c.id)) card.appendChild(h('div', 'tm', t('inTeam')));
    card.appendChild(h('div', 'nm', `${cname(c.id)}<div class="stars">${stars(tier)}</div>`));
    // 付费解锁那条路已删：锁着的角色**只能靠通关解锁**（unlockAt）。
    if (!un) card.appendChild(h('div', 'lk', `🔒<br>${t('unlockAt', { n: c.unlockAfter })}`));
    if (un) dragSource(card, c.id);
    grid.appendChild(card);
  }
  sc.appendChild(grid);
  s.appendChild(sc);
  uiRoot.appendChild(s);
}

function showDetail(id        ) {
  screen = () => showDetail(id);
  clear();
  const c = CHAR_BY_ID[id];
  const tier = tierOf(id);
  const st = stats(id);
  const s = h('div', 'scr');
  const top = h('div', 'top');
  top.appendChild(backBtn(showChars));
  top.appendChild(gemBar());
  s.appendChild(top);
  const art = h('div', `art ${tier === 2 ? 'aw' : ''}`);
  const img = document.createElement('img');
  img.src = charArt(id, tier);
  art.appendChild(img);
  s.appendChild(art);
  const info = h('div', 'panel info');
  info.appendChild(h('div', '', `<div style="font-size:14px;font-weight:800;color:#a58bd0">${ctitle(id)}</div><div style="font-size:26px;font-weight:900">${cname(id)} <span class="stars" style="color:#f5b950;font-size:18px">${stars(tier)}</span></div>`));
  info.appendChild(h('div', 'row', `<span class="tag" style="background:${EL_CSS[c.el]}">${t('el_' + c.el)}</span><span class="tag" style="background:#b9a0f5">${t('shot_' + c.shot)}</span><span class="tag" style="background:${tier === 2 ? '#f5b950' : '#f48ab8'}">${t('tier' + tier)}</span>`));
  const next = tier < 2 ? TIER_STAT[tier + 1] / TIER_STAT[tier] : 0;
  const statRow = (lbl        , v        , fmt = (x        ) => String(Math.round(x))) =>
    h('div', 'stat', `<span>${lbl}</span><span>${fmt(v)}${next ? ` <i>→ ${fmt(v * next)}</i>` : ''}</span>`);
  info.appendChild(statRow(t('hp'), st.hp));
  info.appendChild(statRow(t('atk'), st.atk));
  info.appendChild(h('div', 'stat', `<span>${t('energyGain')}</span><span>×${st.energyRate}${tier < 2 ? ` <i>→ ×${TIER_ENERGY[tier + 1]}</i>` : ''}</span>`));
  info.appendChild(h('div', 'sk', `<b>${t('combo')}：${t('combo_' + c.combo)}</b><br>${t('combo_' + c.combo + '_d')}`));
  info.appendChild(h('div', 'sk', `<b>${t('strike')}：${t('strike_' + c.strike)}</b><br>${t('strike_' + c.strike + '_d')}<br><span style="font-size:12px;color:#a58bd0">${t('energyHint')}</span>`));
  const cost = tierCost(c, tier);
  const evo = h('div', '');
  evo.style.cssText = 'margin-top:10px;text-align:center';
  if (cost) {
    evo.appendChild(h('div', '', `<b>${t('need')}</b>`));
    const cs = h('div', 'cost');
    for (const e of ELEMENTS) if (cost[e]) cs.appendChild(h('span', save.gems[e] >= cost[e]  ? '' : 'no', `<img src="${GEM_ICON[e]}">${save.gems[e]}/${cost[e]}`));
    evo.appendChild(cs);
    const short = shortfall(cost);
    if (short > 0) {
      const enough = short <= (save.prism || 0);
      const pr = h('div', 'cost', `<span class="${enough ? '' : 'no'}" style="font-size:14px"><img src="${A('assets/ui-gem/prism.png')}">${t('prismUse', { n: short })} (${save.prism || 0})</span>`);
      evo.appendChild(pr);
    }
    const ok = canAfford(cost);
    const b = h('button', `btn ${tier === 1 ? 'gold' : ''}`, tier === 0 ? t('evolve') : t('awaken'))                     ;
    b.disabled = !ok;
    b.style.width = '70%';
    tap(b, () => { if (tryUpgrade(id)) playEvolve(id); });
    evo.appendChild(b);
    if (!ok) evo.appendChild(h('div', 'hint', t('gemsHint'))).style.color = '#a58bd0';
    if (!ok) (evo.lastChild               ).style.textShadow = 'none';
  } else evo.appendChild(h('div', 'sub', t('tierMax')));
  info.appendChild(evo);
  s.appendChild(info);
  s.appendChild(h('div', '')).style.height = '16px';
  uiRoot.appendChild(s);
}

function playEvolve(id        ) {
  const tier = tierOf(id);
  void core.sound?.playCue('sfx.evolve', { eventId: eid('evolve') });
  const m = h('div', 'modal');
  m.style.background = 'radial-gradient(circle,rgba(255,250,220,.95),rgba(220,190,255,.9))';
  m.style.flexDirection = 'column';
  const img = document.createElement('img');
  img.src = charArt(id, tier);
  img.className = 'pop';
  img.style.cssText = `width:92%;animation-delay:.5s;filter:drop-shadow(0 0 ${tier === 2 ? 24 : 12}px #ffe08a)`;
  m.appendChild(img);
  const txt = h('div', 'big pop', t(tier === 2 ? 'awakenDone' : 'evolveDone', { name: cname(id) }));
  txt.style.cssText = 'animation-delay:.9s;font-size:32px;text-align:center;padding:0 10px';
  m.appendChild(txt);
  m.appendChild(h('div', 'flash'));
  tap(m, () => { m.remove(); showDetail(id); });
  uiRoot.appendChild(m);
}

// ---------- battle ----------
async function enterBattle(n        ) {
  /*
   * ★ 开局收费：**一场战斗 10 积分**。
   *
   * 放在这里而不是「开始」按钮里，是因为进战斗有三条路（首次 / 下一关 / 重试），
   * 写在一处才不会漏掉一条。钱不够就回主页 —— 别让玩家进到一半被打断。
   */
  if (chargePlay) {
    const paid = await chargePlay();
    if (!paid) { showHome(); return; }
  }
  clear();
  const s = h('div', 'scr');
  s.style.justifyContent = 'center';
  s.style.padding = '0 60px';
  const p = h('div', 'panel');
  p.style.cssText = 'padding:24px;display:flex;flex-direction:column;gap:14px;text-align:center';
  p.appendChild(h('div', 'spin', '✦'));
  p.appendChild(h('div', '', `<b>${t('stage', { n })} · ${t('loading')}</b>`));
  const bar = h('div', 'bar');
  const fill = h('div');
  bar.appendChild(fill);
  p.appendChild(bar);
  s.appendChild(p);
  uiRoot.appendChild(s);
  await loadMany(Battle.assetsFor(n), f => { fill.style.width = `${Math.round(f * 100)}%`; });
  clear();
  setBackdrop(STAGES[n - 1].bg);
  screen = () => {};
  battle = new Battle({ onEnd: r => onBattleEnd(r), onPause: () => showPause() });
  await battle.start(n);
}

function showPause() {
  if (!battle) return;
  battle.paused = true;
  core.sound?.setHold('pause-menu', true);
  const m = h('div', 'modal');
  const p = h('div', 'panel pop');
  p.appendChild(h('div', '', `<b style="font-size:26px">${t('pause')}</b>`));
  const resume = () => { m.remove(); core.sound?.setHold('pause-menu', false); if (battle) battle.paused = false; };
  p.appendChild(tap(h('button', 'btn', t('resume')), resume));
  const seg2 = h('div', 'seg');
  seg2.append(
    tap(h('button', !save.muted ? 'on' : '', `${t('sound')} ${t('on')}`), () => { setMuted(false); m.remove(); showPause(); }),
    tap(h('button', save.muted ? 'on' : '', `${t('sound')} ${t('off')}`), () => { setMuted(true); m.remove(); showPause(); }),
  );
  p.appendChild(seg2);
  p.appendChild(h('div', 'sub', t('retreatQ')));
  p.appendChild(tap(h('button', 'btn blue', t('retreat')), () => {
    m.remove(); core.sound?.setHold('pause-menu', false);
    battle?.destroy(); battle = null; showHome();
  }));
  m.appendChild(p);
  uiRoot.appendChild(m);
}

function onBattleEnd(r              ) {
  const firstClear = r.win && r.stage > save.cleared;
  let joined                = null;
  // 无色水晶：删掉内购商店之后改成**通关掉落**（Boss 关 3 个、普通关 1 个）。
  // 不加这一步 `save.prism` 永远是 0，而升级面板会一直显示「缺口补不上」。
  const prismGain = r.win ? (STAGES[r.stage - 1].boss ? 3 : 1) : 0;
  if (r.win) {
    for (const e of ELEMENTS) save.gems[e] += r.drops[e];
    save.prism = (save.prism || 0) + prismGain;
    if (firstClear) {
      save.gems[STAGES[r.stage - 1].el] += 3;
      const before = CHARS.filter(isUnlocked).map(c => c.id);
      save.cleared = r.stage;
      const nowC = CHARS.filter(isUnlocked).find(c => !before.includes(c.id));
      joined = nowC ? nowC.id : null;
    }
    persist();
  }
  const m = h('div', 'modal');
  const p = h('div', 'panel pop');
  p.appendChild(h('div', 'big', r.win ? t('victory') : t('defeat')));
  if (r.win) {
    p.appendChild(h('div', '', `<b>${t('drops')}</b>`));
    const cs = h('div', 'cost');
    for (const e of ELEMENTS) {
      const n = r.drops[e] + (firstClear && STAGES[r.stage - 1].el === e ? 3 : 0);
      if (n) cs.appendChild(h('span', '', `<img src="${GEM_ICON[e]}">×${n}`));
    }
    if (prismGain) cs.appendChild(h('span', '', `<img src="${A('assets/ui-gem/prism.png')}">×${prismGain}`));
    p.appendChild(cs);
    if (firstClear) p.appendChild(h('div', 'sub', `${t('firstClear')} +3`));
    if (joined) {
      p.appendChild(h('div', '', `<b style="font-size:20px;color:#f48ab8">${t('newChar')}</b>`));
      const img = document.createElement('img');
      img.src = charArt(joined, 0);
      img.style.cssText = 'width:62%;margin:0 auto;filter:drop-shadow(0 4px 10px rgba(150,110,210,.4))';
      img.className = 'pop';
      p.appendChild(img);
      p.appendChild(h('div', '', `<b style="font-size:20px">${cname(joined)}</b> · ${t('title0_' + joined)}`));
    }
  }
  const row = h('div', 'row');
  row.style.justifyContent = 'center';
  const leave = () => { m.remove(); battle?.destroy(); battle = null; };
  if (r.win && r.stage < STAGES.length) row.appendChild(tap(h('button', 'btn', t('next')), () => { leave(); void enterBattle(r.stage + 1); }));
  if (!r.win) row.appendChild(tap(h('button', 'btn', t('retry')), () => { leave(); void enterBattle(r.stage); }));
  row.appendChild(tap(h('button', 'btn violet', t('characters')), () => { leave(); showChars(); }));
  row.appendChild(tap(h('button', 'btn blue', t('home')), () => { leave(); showHome(); }));
  p.appendChild(row);
  m.appendChild(p);
  uiRoot.appendChild(m);
}
