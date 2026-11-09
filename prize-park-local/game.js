/// <reference path="./makeplay-fx.d.ts" />
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createThreeFx } from "./fx.js";
import { makeGp } from "./gp-bridge.js";
import { loadSoundSystem } from "@makeplay/sound";
                                                           
import { GAME, PALETTE, BEAR_FUR, MACHINES, PRIZE_META, PHYSICS, POP_LIBRARY,                                                              } from "./config.js";
import { LANGS, PRIMARY, pick,                           } from "./i18n.js";
import { createWallet, COIN, POINTS_PER_COIN } from "./wallet.js";
import { recycleValue } from "./recycle.js";
import { COMBOS, comboBase, comboTotal, validateCombos } from "./combos.js";

/**
 * 兑换券的显示口径。emoji 必须和宿主 `currency.ts` 的 `coupon` 一致（🎟️）——
 * 币 🧸 / 积分 🪙 / 兑换券 🎟️ 四个同屏，图标重了就看不出在发哪一个。
 */
const VOUCHER = Object.freeze({ name: "兑换券", emoji: "🎟️" });
import { scopeCss } from "./scope-css.js";

// ---------- 插件入口（原来这里是模块顶层直接执行）----------
/**
 * 以工厂函数导出，供宿主的 v2 插件契约调用：
 *   const game = await createGame({ container, host, save })
 *   game.destroy()
 *
 * 为什么整段包进函数而不是保持"模块求值时自执行"：
 *   ESM 模块只求值一次，卸载后再 import 拿到的还是同一份闭包 —— 第二次挂载必然拿到
 *   已经 dispose 掉的 renderer / 停掉的 rAF。包成工厂，每次 mount 都是一份全新状态。
 *
 * 只做了三处外科手术，其余 3000 行一个字没动：
 *   ① 根节点由外部传入（原来是 document.getElementById("app")），CSS 里的 #app 改成 .pp-root
 *   ② gp 由 makeGp(host) 提供，**函数内声明遮蔽全局** —— 9 处 `gp.player.*` 调用点不用改
 *   ③ rAF 循环加 alive 守卫，末尾 return 一个 destroy
 *
 * ctx.save：宿主那边是异步读出来的存档快照。游戏在模块求值阶段就会**同步**读
 *   `gp.player.saves.latestSync`（loadSave()），所以必须提前读好传进来，不能在里面 await。
 */
export async function createGame(ctx) {
const { container, host, save: initialSave = null, wallet: walletInit = null, assetBase = "", resolveAsset = null, voucherPerCoin = 0 } = ctx;
const gp = makeGp({ host, initialSave });

// 钱包。余额快照由入口（plugin.js / main.js）在挂载前读好传进来 —— 和存档同一个理由：
// 游戏在求值阶段就同步读 `wallet.coins`（refreshTexts 在 boot 段直接调用）。
// onChange 只做重画，不写盘：币的事实只在宿主账本里，这边是它的一份镜像。
const wallet = createWallet({
  host,
  coins: walletInit?.coins ?? 0,
  points: walletInit?.points ?? 0,
  onChange: () => { if (alive) refreshTexts(); },
});

// 资源根。单独跑时是 ""（相对当前页面，和原来完全一样）；
// 作为插件从 blob: URL 加载时必须给一个绝对前缀 —— 相对路径会以 blob: 为基准解析，必然 404。
// 宿主给了 `assetUrl()` 就用它（三种形态：本地 / CDN / Capacitor 文件，拼法不一样）。
const A = (p) => (resolveAsset ? resolveAsset(p) : assetBase + String(p).replace(/^\.\//, ""));

/**
 * `<img src>` 用。**所有拼进 HTML 字符串的图片地址都必须过这里。**
 *
 * 事故（2026-10-22 改版时抓到）：`prizeImg()` / `buildCards()` 里写的是裸的
 * `assets/xxx.webp`，没走 `A()`。假宿主（`_plugin-test.html`）恰好把游戏目录当站点根，
 * 相对路径**正好**指向 `/assets/xxx.webp` —— 图全对，测试全绿。
 * 真宿主里插件挂在 `/games/prizepark/` 下，`assets/xxx.webp` 解析成 `/assets/xxx.webp`
 * → 404 → 机台卡片一片空白，而「点得动 / 进得去 / 扣钱对」全部通过。
 * 所以判据只能是 `naturalWidth > 0`（见宿主 e2e 的「奖品图全部解码」那条）。
 *
 * data: / blob: / http(s): / 站内绝对路径**原样返回** —— 娃娃缩略图是 canvas 的
 * data URL，拼上 assetBase 会变成 `.../data:image/png;base64,...` 直接坏掉。
 */
const imgSrc = (p) => {
  const u = String(p);
  return /^(data:|blob:|https?:|\/)/i.test(u) ? u : A(u);
};

// ---------- 生命周期与定时器 ----------
// 原来有 4 个模块级 setInterval 永远不会停（市场行情 2s、每日刷新 30s、机台占用 20s/1s）。
// 单独跑整页时无所谓 —— 页面关了进程就没了；但作为插件被反复挂载时，它们会在 destroy()
// 之后继续跑，回调里 `$("...")` 拿到 null 再 .textContent → 抛错（实测抓到的就是这个）。
// 所以：alive 放在**最前面**声明（TDZ 安全，后面的函数随时可以读），定时器统一登记、统一清。
let alive = true;
const timers = new Set();
function every(fn, ms) { const id = setInterval(fn, ms); timers.add(id); return id; }
function stopTimers() { for (const id of timers) { clearInterval(id); clearTimeout(id); } timers.clear(); }

// ---------- i18n ----------
let lang          = pick(navigator.language);
const T = (k        )         => (LANGS[lang]                          )[k] ?? (LANGS[PRIMARY]                          )[k];
const hex = (n        ) => "#" + n.toString(16).padStart(6, "0");

// ---------- save state (autosave channel) ----------
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
const save = { v: 1, coinMigrated: false, gotCounts: {}, stock: {}, firstGot: {}, layouts: {} };
function loadSave() {
  try {
    const s = gp.player.saves.latestSync;
    if (s && typeof s === "object") {
      Object.assign(save, s);
      save.layouts = s.layouts ?? {};
      save.gotCounts = s.gotCounts ?? {};
      save.firstGot = s.firstGot ?? {};
      if (s.lang) lang = pick(s.lang);
    }
  } catch { /* guest / no save */ }
  // 老档没有 stock —— 那时候「手上还有几个」是 gotCounts − 在架数量算出来的。
  // 现在没有在架了，直接按 gotCounts 补齐：宁可多给几个，也不要让人以为娃娃丢了。
  if (!save.stock || typeof save.stock !== "object") {
    save.stock = {};
    for (const [id, n] of Object.entries(save.gotCounts)) save.stock[id] = n;
  }
  // 这三样都随经济改造退场了，留着只会让下一个人以为它们还有用。
  delete save.coins; delete save.tickets; delete save.market; delete save.daily;
}
function persist() { save.lang = lang; try { void gp.player.saves.putLatest(save); } catch { /* */ } }

// ---------- DOM ----------
const appEl = container;
const style = document.createElement("style");
/*
 * ★ 整份样式表必须收进 `.pp-root`（`scopeCss`）。
 *
 * 原来是全局的，里面有一堆通用类名（`.grid` / `.cell` / `.card` / `.overlay`），
 * 接进宿主之后会盖掉宿主自己的 Tailwind 工具类 —— 因为**未分层的样式胜过
 * `@layer`**，而 Tailwind v4 的工具类在 `@layer utilities` 里。
 * 症状是「切走以后农场页的网格变成可拖拽的两列小卡片」，而游戏本身看起来正常。
 * 详细事故与取舍写在 `scope-css.js` 的头注释里。
 */
style.textContent = scopeCss(`/* ============================================================================
   抓奖乐园 · 界面样式（2026-10-22 改版）
   ----------------------------------------------------------------------------
   目标：**和农场长成同一个 App**，而不是「农场里嵌了一个街机」。
   做法是照抄农场的纸感令牌（见 kid-quest-farm-2d/src/styles/theme.css）：
     纸白底 + 暖棕墨色 + 1px 发丝线 + 极浅的 shadow-flat + 圆角卡片。
   抓奖乐园自己的粉色/薰衣草/薄荷留在**强调色**上（底部动作条、主按钮、选中态）。

   ⚠️ 三条和宿主有关的硬约束，改这里之前先读：
   ① 安全区**不要再吃一遍**。宿主外壳已经用 pt-safe / pb-safe 把状态栏和底部
      TabBar 的间距吃掉了，插件容器既不贴顶也不贴底。原版这里每个 topbar 都写
      「max(10px, env(safe-area-inset-top))」，装进宿主后在刘海机上会多出 ~47px
      空白 —— 那也是「每个都太大」的一部分。
   ② 整份样式由 「scopeCss(..., '.pp-root')」 收进根类。里面**不能有裸的元素选择器
      依赖**（「button{}」 这类会被改写成 「.pp-root button{}」，是安全的；但 「.grid」
      这种通用类名必须留在 「.pp-root」 里，否则会盖掉宿主的 Tailwind）。
   ③ 底部不再有 「.bnav」。宿主自己的 TabBar 就是导航，插件再挂一条 5 格的底栏
      = 两条导航叠在一起，白吃掉 62px 高度。现在改成农场那种「页面底部一排
      动作磁贴」：🎁 背包 / ♻️ 回收 / 🏆 排行。
   ========================================================================== */

.pp-root,.pp-root *,.pp-root *::before,.pp-root *::after{box-sizing:border-box}
.pp-root{
  --paper:#fffaf2;--paper2:#fff6ea;--line:#efe6d9;
  --ink:#33281e;--ink7:#574838;--ink5:#9a8875;
  --pink:#ff8fb8;--grape:#a995ff;--mint:#7de2d1;--sun:#fcd34d;--berry:#f43f5e;
  --r-card:18px;--r-btn:14px;
  --shadow-flat:0 1px 2px rgba(51,40,30,.05),0 6px 16px -10px rgba(51,40,30,.18);
  background:linear-gradient(180deg,#fff6ee 0%,var(--paper) 44%,#f5f1ff 100%);
  font-family:"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  color:var(--ink);
}
.screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;overflow:hidden}
.hidden{display:none!important}
button{font:inherit;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none;user-select:none;-webkit-user-select:none}

/* ---------- 通用小件 ---------- */
.pill{border-radius:999px;padding:12px 22px;font-weight:800;font-size:16px;min-height:46px;background:#fff;color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow-flat)}
.pill.pink{background:linear-gradient(180deg,#ffa8c6,var(--pink));color:#fff;border-color:transparent}
.pill.mint{background:linear-gradient(180deg,#a8f0e4,var(--mint));color:var(--ink);border-color:transparent}
.pill:active{transform:translateY(1px) scale(.99)}
.pill:disabled{opacity:.45}

.topbar{flex:none;width:100%;display:flex;align-items:center;gap:8px;padding:10px 12px 8px;box-sizing:border-box;color:var(--ink);font-weight:800;position:relative;z-index:2}
.topbar .grow{flex:1;min-width:0;text-align:center;font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar .sp{flex:1;min-width:0}
.mkTitle{font-weight:900;font-size:16px;letter-spacing:.02em}
.iconBtn{width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid var(--line);color:var(--ink);font-size:19px;font-weight:900;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:var(--shadow-flat);line-height:1}
.iconBtn:active{transform:translateY(1px)}
.coinTag{background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;box-shadow:var(--shadow-flat)}
/* 娃娃界面顶栏那颗币就是「换币」入口：整颗可点，右边挂一个绿色 ＋。
   原来换币只有底部那个大按钮一条路，而底部按钮一开局就变回 PLAY，等于藏起来了。 */
.coinBtn{display:flex;align-items:center;gap:3px;padding:5px 7px 5px 10px;flex:none;min-height:30px}
.coinBtn .plus{font-style:normal;width:17px;height:17px;border-radius:999px;background:var(--mint);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;line-height:1}
.coinBtn:active{transform:translateY(1px)}

/* ---------- 机台列表（= 首页） ---------- */
.mkScroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;width:100%;padding:10px 12px 8px;box-sizing:border-box;touch-action:none;scrollbar-width:none}
.mkScroll::-webkit-scrollbar{display:none}
.mkScroll>*{max-width:100%;box-sizing:border-box;min-width:0}
.mkTop{display:flex;align-items:center;gap:8px}
.mkSearch{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:8px 12px;font-size:14px;box-shadow:var(--shadow-flat)}
.mkSearch input{flex:1;border:0;outline:0;font:inherit;font-weight:700;font-size:14px;color:var(--ink);background:transparent;min-width:0}
.mkCats{display:flex;gap:7px;margin:10px 0}
.lstCats{overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;scrollbar-width:none;touch-action:none;width:100%;max-width:100%}
.lstCats::-webkit-scrollbar{display:none}
.lstCats .cat{flex:0 0 auto}
.cat{border-radius:999px;padding:6px 13px;font-weight:800;font-size:12.5px;background:#fff;color:var(--ink7);min-height:32px;border:1px solid var(--line);box-shadow:var(--shadow-flat);white-space:nowrap}
.cat.on{background:linear-gradient(135deg,var(--pink),var(--grape));color:#fff;border-color:transparent}

/* 机台格子：3 列、图 1:0.82、名字一行 —— 一屏能看到三排以上。
   原来图是 1:1.05 + 名字两行 + 一行 meta，一张卡 ~200px，一屏只放得下 2 排半。 */
.mGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%}
.mcell{min-width:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;padding:0;text-align:left;position:relative;box-shadow:var(--shadow-flat);display:flex;flex-direction:column}
.mcell:active{transform:translateY(1px) scale(.99)}
.mcell.wip{opacity:.55}
.mcell .img{aspect-ratio:1/.82;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.mcell .img img{width:78%;height:78%;object-fit:contain}
.mcell .nm{font-size:11.5px;font-weight:800;color:var(--ink);padding:5px 6px 0;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mcell .pr{font-size:12px;font-weight:900;color:var(--ink);padding:1px 6px 6px}
.mcell .cnt{position:absolute;left:5px;top:5px;z-index:1;background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:999px;padding:1px 5px;font-size:9.5px;font-weight:900;color:var(--ink7)}
.mcell .playing{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(90deg,#ff5c6c,#ff7a6e);color:#fff;font-size:9.5px;font-weight:900;text-align:center;padding:2px 0}
.mcell .playing.mine{background:linear-gradient(90deg,#7de2d1,#5cc7f5);color:#1f3a4a}
.sweetPile{position:relative;width:100%;height:100%}
.sweetPile img{position:absolute;width:52%;height:52%;object-fit:contain}
.sweetPile img:nth-child(1){left:4%;top:8%}
.sweetPile img:nth-child(2){right:4%;top:10%;transform:rotate(12deg)}
.sweetPile img:nth-child(3){left:10%;bottom:6%;transform:rotate(-10deg)}
.sweetPile img:nth-child(4){right:8%;bottom:8%}
/* 平板：宿主把插件容器放宽到 672px（.page-col），3 列会变成 200px 一张的大卡。
   按宽度补列，卡片尺寸保持和手机一致。 */
@media (min-width:560px){.mGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:760px){.mGrid{grid-template-columns:repeat(5,minmax(0,1fr))}}

/* ---------- 底部动作条（照农场「种子 / 动物 / 市场」那一排） ---------- */
.ppBar{flex:none;width:100%;display:flex;gap:8px;padding:8px 12px;background:var(--paper);border-top:1px solid var(--line);box-shadow:0 -6px 16px -12px rgba(51,40,30,.28)}
/* 娃娃界面也要这条动作条（背包 / 回收 / 排行），但那里每一像素都在跟 3D 画面抢，
   所以用紧凑版：图标和文字排成一行，54px → 40px。 */
#play>.ppBar{grid-area:bar}
.ppBar.compact{padding:6px 12px 8px}
.ppBar.compact .barTile{min-height:40px;flex-direction:row;gap:5px;font-size:12px;border-radius:12px}
.ppBar.compact .barTile .ico{font-size:16px}
.barTile{position:relative;flex:1;min-height:54px;border-radius:var(--r-btn);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:900;font-size:12px;color:var(--ink);border:1px solid rgba(51,40,30,.10);box-shadow:var(--shadow-flat);padding:0 4px;line-height:1.2}
.barTile .ico{font-size:19px;line-height:1.15}
.barTile.grape{background:linear-gradient(180deg,#ddd6fe,#c4b5fd)}
.barTile.sun{background:linear-gradient(180deg,#fde68a,#fcd34d)}
.barTile.mint{background:linear-gradient(180deg,#c7f5ec,#7de2d1)}
.barTile:active{transform:translateY(1px)}
.barTile .cnt{position:absolute;top:-5px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--berry);color:#fff;font-size:10px;font-weight:900;font-style:normal;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(244,63,94,.35)}
.barTile .cnt.neutral{background:var(--ink7);box-shadow:0 2px 6px rgba(51,40,30,.25)}
.barTile .cnt.zero{display:none}

/* ---------- 图鉴 / 回收 / 排行 共用的滚动网格 ---------- */
.grid{flex:1;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden;touch-action:none;padding:6px 12px 16px;box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));grid-auto-rows:max-content;gap:8px;align-content:start;position:relative}
.cell{background:#fff;border:1px solid var(--line);border-radius:14px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;font-weight:800;font-size:12px;box-shadow:var(--shadow-flat);min-height:104px;justify-content:center;color:var(--ink);text-align:center}
.cell .ico{font-size:38px;line-height:1}
.cell.locked{color:var(--ink5)}
.cell.locked .ico{filter:brightness(0) opacity(.6)}
.ico img,.thumb img,#getPrize img,.sheet .big img{display:block;pointer-events:none}
.cards{flex:1;min-height:0;width:100%;overflow-y:auto;overflow-x:hidden;touch-action:none;padding:6px 12px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;align-items:center;position:relative}
.snackList{flex:1;min-height:0;overflow-y:auto;width:100%;padding:6px 12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;touch-action:none}
.snackRow{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:7px 12px;box-shadow:var(--shadow-flat);width:100%;font:inherit;color:var(--ink);text-align:left}
.snackRow .val{font-weight:900;font-size:13px;color:var(--berry);flex:none}
.snackRow img{width:44px;height:44px;object-fit:contain}
.snackRow .nm{flex:1;font-weight:800;font-size:14px}
.snackRow .qty{font-weight:900;font-size:16px;color:var(--berry)}
.snackRow.locked{opacity:.5}

/* ---------- 排行 ---------- */
.rankCard{width:100%;background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:12px 14px;box-shadow:var(--shadow-flat)}
.rankRow{display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid #f7f1e8;font-weight:800;color:var(--ink)}
.rankRow:last-child{border-bottom:0}
.rankRow.me{background:#fff4f7;border-radius:12px}
.rankNo{width:24px;text-align:center;color:var(--ink5);font-weight:900}
.rankRow.me .rankName,.rankRow.me .rankScore{color:var(--berry)}
.rankName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.rankScore{font-size:14px}
.rankMine{padding:4px 2px 10px}
.rankStats{display:flex;gap:8px;padding-top:8px}
.rankStats span{flex:1;background:var(--paper2);border-radius:12px;padding:7px 10px;display:flex;flex-direction:column;gap:2px;color:var(--ink5);font-size:12px;font-weight:700}
.rankStats b{color:var(--ink);font-size:16px}
.rankHead{font-weight:900;color:var(--ink);font-size:13px;letter-spacing:.04em;padding-bottom:6px}
.rankNote{color:var(--ink5);font-size:13px;text-align:center;padding:18px 4px;font-weight:700}

/* ---------- 背包（卖娃娃 / 组合兑换） ---------- */
#collection{background:linear-gradient(180deg,#fff7f0 0%,#fff6ea 60%,#f2fbf8 100%)}
/* 组合条：横向滚动、固定高度，不抢下面网格的高度。
   ⚠️ 不要让它 flex:1 —— 组合条一撑开，网格就只剩两三行。 */
.comboStrip{flex:none;width:100%;display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:2px 12px 8px;box-sizing:border-box;touch-action:pan-x;scrollbar-width:none}
.comboStrip::-webkit-scrollbar{display:none}
.comboCard{flex:none;width:140px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:7px;display:flex;flex-direction:column;gap:4px;align-items:center;box-shadow:var(--shadow-flat);color:var(--ink);text-align:center}
.comboCard.ready{border-color:#f9a8d4;box-shadow:0 6px 18px -10px rgba(244,63,94,.55)}
.comboCard .who{font-size:11.5px;font-weight:900;line-height:1.2;min-height:26px;display:flex;align-items:center}
.comboCard .dots{display:flex;gap:3px;flex-wrap:wrap;justify-content:center}
.comboCard .dot{width:23px;height:23px;border-radius:7px;background:#f4f1fa;display:flex;align-items:center;justify-content:center;overflow:hidden}
.comboCard .dot img{width:100%;height:100%;object-fit:cover}
.comboCard .dot.miss{filter:grayscale(1) opacity(.35)}
.comboCard .price{font-size:11.5px;font-weight:900;color:var(--berry);line-height:1.1}
.comboCard .price small{display:block;color:var(--ink7);font-weight:800;font-size:10.5px}
.comboCard .go{width:100%;border-radius:9px;padding:4px 0;font-size:11.5px;font-weight:900;background:#e9e5f5;color:var(--ink6)}
.comboCard.ready .go{background:linear-gradient(180deg,#fbcfe8,#f9a8d4);color:#7f1d3a}
.bagHead{grid-column:1/-1;font-weight:800;font-size:12.5px;color:#6f6889;line-height:1.5;text-align:center;padding:2px 0 0}
.redeemBar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:#fff;border-top:1px solid var(--line)}
.redeemBar #rcTip{color:var(--ink7);font-weight:800;font-size:12.5px;line-height:1.3;flex:1;min-width:0}
.redeemBar #rcVoucher{width:auto;min-width:128px;padding:10px 14px;flex:none;font-size:14px}

/* ---------- 弹层 ---------- */
.overlay{position:absolute;inset:0;background:rgba(40,30,24,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:6;padding:12px;box-sizing:border-box}
.sheet{background:#fff;border-radius:20px;padding:20px;width:min(86vw,360px);display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center;font-weight:700;color:var(--ink);box-shadow:0 16px 48px rgba(0,0,0,.35)}
.sheet .big{font-size:60px;line-height:1}
.sheet h3{margin:0;font-size:19px;font-weight:900}
.sheet .dim{color:var(--ink5);font-size:13px;font-weight:700;white-space:pre-line}
.sheet .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px;width:100%}
.sheet .row .pill{flex:1;min-width:104px;padding:11px 14px;font-size:15px}
.sheet .calc{width:100%;max-width:280px;font-size:14px;font-weight:700;color:var(--ink5);text-align:left}
.sheet .calc>div{display:flex;justify-content:space-between;padding:2px 0}
.sheet .calc .tot{border-top:1px solid var(--line);margin-top:4px;padding-top:6px;font-weight:900;font-size:17px;color:var(--ink)}
.calc{width:100%;max-width:280px;text-align:left;font-size:14px;font-weight:700;color:var(--ink5)}
.calc div{display:flex;justify-content:space-between}
.calc .tot{border-top:2px solid var(--line);margin-top:4px;padding-top:4px;color:var(--ink);font-weight:900;font-size:16px}
.menuSheet{background:#fff;border-radius:20px;padding:18px;width:min(86vw,340px);display:flex;flex-direction:column;gap:8px;color:var(--ink)}
.menuSheet .pill{width:100%;font-size:16px;padding:12px 18px}
.menuSheet h3{margin:0 0 4px;font-size:17px;font-weight:900;text-align:center;white-space:pre-line}
.menuList{display:flex;flex-direction:column;gap:10px;width:100%}
.setRow{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;font-size:15px;font-weight:800}
.setRow input[type=range]{flex:1;max-width:190px;accent-color:var(--pink);height:28px}
.setRow .pill{width:auto;min-width:72px;margin:0;padding:8px 16px;font-size:14px;min-height:40px}
.tog{background:#eee7dc;color:var(--ink7)}
.tog.on{background:var(--mint);color:var(--ink)}
#detail{position:absolute;inset:0;background:rgba(40,30,24,.62);display:flex;align-items:center;justify-content:center;z-index:9}
#busyModal .sheet .dim{white-space:pre-line}

/* ---------- 抓娃娃画面 ---------- */
#play{display:grid;align-items:stretch;justify-items:stretch;grid-template-columns:100%;grid-template-rows:auto minmax(0,1fr) auto auto;grid-template-areas:"hud" "view" "ctrl" "bar";background:linear-gradient(180deg,#fff7f0,#f5f1ff)}
#play.land{grid-template-columns:64% 36%;grid-template-rows:auto 1fr auto;grid-template-areas:"view hud" "view ctrl" "view bar"}
#hud{grid-area:hud;display:flex;flex-direction:column;padding:10px 12px 4px;box-sizing:border-box;color:var(--ink);font-weight:800;z-index:2;min-width:0;gap:2px}
#hud .row1{display:flex;align-items:center;gap:8px;min-width:0}
#hud .grow{flex:1;text-align:center;font-size:16px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#hud .row2{display:flex;align-items:center;gap:6px;min-width:0;font-size:11.5px;color:var(--ink5);font-weight:700;padding-top:2px}
#pPrice{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#viewChips{flex:none;display:flex;align-items:center;gap:5px}
#backBtn{background:#fff;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px;min-height:38px;flex:none;box-shadow:var(--shadow-flat)}
#viewport{grid-area:view;position:relative;overflow:hidden;border-radius:16px;margin:2px 10px;border:1px solid var(--line);box-shadow:0 10px 30px -18px rgba(51,40,30,.45);background:#f6eef8;min-height:0}
#play.land #viewport{margin:8px}
#viewport canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
/* 视角 / 店员：原来是压在 3D 画面右上角的一竖列，白吃掉画面右侧 ~70px。
   这三颗只在开局前用得上，挪到顶栏第二行的一排小胶囊，画面就能占满整宽。 */
#camBtns{display:flex;gap:5px}
#camBtns button,.smallBtn{height:26px;padding:0 9px;border-radius:999px;background:#fff;color:var(--ink);font-weight:800;font-size:11px;border:1px solid var(--line);line-height:1;white-space:nowrap;box-shadow:var(--shadow-flat)}
#camBtns button.on{background:var(--mint);border-color:#8fe4d6}
#testBtn{background:rgba(255,205,90,.6)}
#leftTag{position:absolute;left:10px;top:10px;background:rgba(255,255,255,.9);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-weight:800;font-size:12.5px;z-index:3;backdrop-filter:blur(4px)}
#flash{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:4;font-size:clamp(40px,14vw,84px);font-weight:900;color:#fff;text-shadow:0 5px 0 var(--pink),0 0 34px rgba(125,226,209,.8)}
#flash.pop{animation:pop .25s cubic-bezier(.2,1.6,.4,1) both}
#missTag{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;z-index:4;font-size:clamp(24px,7vw,40px);font-weight:900;color:#fff;text-shadow:0 3px 0 var(--grape),0 0 20px rgba(0,0,0,.4);animation:pop .3s cubic-bezier(.2,1.6,.4,1) both}
#controls{grid-area:ctrl;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:4px 14px 10px;box-sizing:border-box;min-height:0}
#step{color:var(--ink);font-weight:900;font-size:15px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 16px;box-shadow:var(--shadow-flat)}
#hint{color:var(--ink5);font-size:11.5px;font-weight:700}
.bigBtn{width:min(100%,340px);height:clamp(56px,9.5vh,76px);border-radius:20px;font-weight:900;font-size:30px;color:#fff;background:linear-gradient(180deg,#ffa8c6,var(--pink));box-shadow:0 5px 0 #d2698f,0 0 22px rgba(255,143,184,.45);transition:transform .08s,box-shadow .08s;display:flex;align-items:center;justify-content:center;gap:10px;line-height:1}
.bigBtn.mintBtn{background:linear-gradient(180deg,#a8f0e4,var(--mint));color:var(--ink);box-shadow:0 5px 0 #4aa89a,0 0 22px rgba(125,226,209,.45)}
.bigBtn.down{transform:translateY(5px) scale(.985);box-shadow:0 0 0 #c8577f}
.bigBtn.mintBtn.down{box-shadow:0 0 0 #4aa89a}
.bigBtn small{font-size:17px;font-weight:800;opacity:.92}
.bigBtn .arrow{font-size:40px}
.bigBtn:disabled{opacity:.5}
#noCoins{color:var(--berry);font-weight:800;font-size:13px}
#restockMsg{color:var(--ink);font-weight:800;font-size:13px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 14px}

/* 抓到 / 没抓到 那一层：盖在 3D 画面上，保持深色遮罩 + 白字，和以前一样有「烟花」感 */
#getOverlay{justify-content:flex-start;padding-top:14px;overflow-y:auto;gap:10px}
#getOverlay .btns{gap:8px}
#getOverlay .btns .pill{min-height:44px;padding:10px 18px;font-size:15px}
#getText{font-size:clamp(40px,13vw,76px);font-weight:900;color:#fff;text-shadow:0 6px 0 var(--pink),0 0 40px var(--mint);animation:pop .3s cubic-bezier(.2,1.6,.4,1) both;line-height:1}
#getPrize{width:min(34vw,132px);aspect-ratio:1;border-radius:26px;background:radial-gradient(circle,#fff 0%,#ffe3ee 70%);display:flex;align-items:center;justify-content:center;font-size:clamp(64px,22vw,112px);box-shadow:0 0 0 6px rgba(255,255,255,.7),0 16px 40px rgba(0,0,0,.4);animation:pop .4s .15s cubic-bezier(.2,1.6,.4,1) both;position:relative}
#newTag{position:absolute;top:-12px;right:-12px;background:linear-gradient(135deg,var(--sun),var(--pink));color:#fff;font-weight:900;border-radius:999px;padding:5px 13px;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,.3);transform:rotate(10deg)}
#getMsg{color:#fff;font-weight:900;font-size:clamp(17px,5vw,23px);text-align:center}
#allClear{color:#ffe9a8;font-weight:900;font-size:15px;text-align:center}
.overlay .btns{display:flex;flex-direction:column;gap:10px;width:min(88vw,320px)}
.overlay .btns .pill{width:100%}
#confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.cf{position:absolute;top:-12px;width:10px;height:16px;border-radius:3px;animation:fall linear forwards}
@keyframes fall{to{transform:translateY(110vh) rotate(720deg)}}
@keyframes pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}

/* 调试面板（GAME.testMode 才出现） */
.tRow{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:var(--ink)}
.tRow label{flex:1}
.tRow input[type=range]{flex:2}
.tRow .val{width:44px;text-align:right}
.tRow.toggle .pill{flex:1}
.tRow .pill.on{background:var(--mint)}
#params{position:absolute;left:10px;bottom:10px;z-index:3;background:rgba(0,0,0,.55);color:#bff;font:11px/1.35 monospace;padding:6px 8px;border-radius:8px;white-space:pre;pointer-events:none}

#toast{position:absolute;left:0;right:0;bottom:24%;text-align:center;z-index:8;pointer-events:none}
#toast span{background:rgba(51,40,30,.92);color:#fff;border-radius:999px;padding:9px 16px;font-weight:800;font-size:13.5px}
`.replaceAll("url(assets/", "url(" + A("assets/")), ".pp-root");
document.head.appendChild(style);

function ownedCount(id) { return save.stock?.[id] ?? 0; }
const machineName = (m               ) => T(m.nameKey          );
const machineDesc = (m               ) => T(("d_" + m.id.replace("big-bear", "bigbear"))          );
const prizeName = (id        ) => T(PRIZE_META[id].nameKey          );
const stars = (d        ) => "★".repeat(d) + "☆".repeat(5 - d);
const PRIZE_ICON                         = { bear: "🧸", figure: "📦" };

appEl.insertAdjacentHTML("beforeend", `<div id="busyModal" class="overlay hidden" style="z-index:30"><div class="sheet" id="busySheet"></div></div>
<div id="settingsModal" class="overlay hidden"><div class="sheet" id="settingsSheet"></div></div>
<div id="list" class="screen">
  <div class="mkScroll" id="cards">
    <div class="mkTop">
      <div class="mkSearch"><span>🔍</span><input id="lstSearch" type="search" autocomplete="off"></div>
      <span id="lCoins" class="coinTag"></span>
      <button id="settingsBtn" class="iconBtn">⚙️</button>
    </div>
    <div class="mkCats lstCats" id="lstCats"></div>
    <div class="mGrid" id="mGrid"></div>
  </div>
  <div class="ppBar" id="ppBar">
    <button id="colBtn" class="barTile grape"><span class="ico">🎁</span><b id="colLbl"></b><i class="cnt neutral zero" id="colCnt"></i></button>
    <button id="rankBtn" class="barTile mint"><span class="ico">🏆</span><b id="rankLbl"></b></button>
  </div>
</div>
<div id="collection" class="screen hidden">
  <div class="topbar"><button id="colBack" class="iconBtn">‹</button><div class="grow" data-t="collection"></div><span id="cCoins" class="coinTag"></span></div>
  <div class="mkCats" style="padding:0 12px"><button class="cat on" data-cc="prize" data-t="colPrizes"></button><button class="cat" data-cc="sweets" data-t="catSweets"></button></div>
  <div class="comboStrip" id="comboWrap"></div>
  <div class="grid" id="colGrid"></div>
  <div class="snackList hidden" id="snackList"></div>
  <div class="redeemBar" id="rcBar">
    <span id="rcTip"></span>
    <button id="rcVoucher" class="pill mint"></button>
  </div>
  <div id="detail" class="hidden"><div class="sheet" id="detailSheet"></div></div>
  <div id="sellModal" class="overlay hidden"><div class="sheet" id="sellSheet"></div></div>
</div>
<div id="rank" class="screen hidden">
  <div class="topbar"><button id="rankBack" class="iconBtn">‹</button><div class="grow" data-t="ranking"></div></div>
  <div class="cards">
    <div class="rankCard">
      <div class="rankRow me rankMine"><span class="rankName" id="rankYouLine"></span><span class="rankScore" id="rankYouGet"></span></div>
      <div class="rankStats"><span><small data-t="rankComp"></small><b id="rankYouComp"></b></span><span><small data-t="rankSales"></small><b id="rankYouSales"></b></span></div>
    </div>
    <div class="rankCard"><div class="rankHead" data-t="rankTotalGet"></div><div id="rankList"></div></div>
  </div>
</div>
<div id="play" class="screen hidden">
  <div id="viewport">
    <div id="leftTag"></div>
    <div id="flash" class="hidden"></div>
    <div id="missTag" class="hidden"></div>
    <div id="params" class="hidden"></div>
  </div>
  <div id="hud">
    <div class="row1"><button id="backBtn"></button><div class="grow" id="hudName"></div><button id="pCoinsBtn" class="coinTag coinBtn"><span id="pCoins"></span><i class="plus">＋</i></button></div>
    <div class="row2">
      <span id="pPrice"></span>
      <span id="viewChips">
        <span id="camBtns"><button id="camFront" class="on"></button><button id="camSide"></button></span>
        <button id="staffBtn" class="smallBtn"></button>
        <button id="testBtn" class="smallBtn hidden"></button>
      </span>
    </div>
  </div>
  <div id="controls">
    <div id="step"></div><div id="hint"></div>
    <button id="btnPlay" class="bigBtn"></button>
    <button id="btnX" class="bigBtn hidden"><span class="arrow">→</span></button>
    <button id="btnZ" class="bigBtn mintBtn hidden"><span class="arrow">↑</span></button>
    <div id="noCoins" class="hidden"></div>
    <div id="restockMsg" class="hidden"></div>
  </div>
  <div id="payModal" class="overlay hidden"><div class="sheet" id="paySheet"></div></div>
  <div id="getOverlay" class="overlay hidden">
    <div id="confetti"></div>
    <div id="getText"></div>
    <div id="getPrize"><span id="getIcon"></span><div id="newTag" class="hidden"></div></div>
    <div id="getMsg"></div><div id="allClear" class="hidden"></div>
    <div class="btns"><button id="getAgain" class="pill pink"></button><button id="getCol" class="pill mint"></button><button id="getToList" class="pill"></button></div>
  </div>
  <div id="staffOverlay" class="overlay hidden"><div class="menuSheet" id="staffSheet"></div></div>
  <div id="testOverlay" class="overlay hidden"><div class="menuSheet" id="testSheet"></div></div>
  <div id="toast" class="hidden"><span id="toastText"></span></div>
</div>
`);

const $ =                                      (id        ) => document.getElementById(id)     ;
const listEl = $("list"), playEl = $("play"), colEl = $("collection"), viewportEl = $("viewport");
const btnX = $                   ("btnX"), btnZ = $                   ("btnZ"), btnPlay = $                   ("btnPlay");

let currentMachine                = MACHINES[0];
let toastTimer = 0;
function toast(msg        ) { if (!alive) return; $("toastText").textContent = msg; $("toast").classList.remove("hidden"); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { if (alive) $("toast").classList.add("hidden"); }, 1800); }

function refreshTexts() {
  if (!alive) return;   // destroy() 之后可能还有 setTimeout 在飞（toast 隐藏、行情刷新等），这里兜住
  document.documentElement.lang = lang;
  document.querySelectorAll             ("[data-t]").forEach(el => { el.textContent = T(el.dataset.t          ); });
  const coinTxt = `${COIN.emoji} ${wallet.coins}`;
  $("lCoins").textContent = coinTxt; $("cCoins").textContent = coinTxt; $("pCoins").textContent = coinTxt;
  refreshBar();
  $("camFront").textContent = `📷${T("camFront")}`; $("camSide").textContent = `📷${T("camSide")}`;
  $("staffBtn").textContent = `🔔${T("staff")}`; $("testBtn").textContent = T("test");
  $("testBtn").classList.toggle("hidden", !GAME.testMode);
  $("backBtn").textContent = `← ${T("back")}`;
  $("getText").textContent = T("get"); $("newTag").textContent = T("newTag"); $("allClear").textContent = inMachine && currentMachine.kind === "bridge" && prizes.length && prizes.every(q => q.got) ? T("noMoreHere") : T("allClear");
  $("getAgain").textContent = inMachine && prizes.length && prizes.every(q => q.got) ? T("refill") : T("playAgain"); $("getCol").textContent = T("seeCollection"); $("getToList").textContent = T("toList");
  $("hudName").textContent = machineName(currentMachine);
  $("pPrice").textContent = `${T("onePlay")}：${currentMachine.price} ${COIN.name}`;
  $("noCoins").textContent = T("noCoins");
  btnPlay.innerHTML = `${T("playBtn")} <small>${currentMachine.price} 🪙</small>`;
  if (!listEl.classList.contains("hidden")) buildCards(); updateStep(); updateLeftTag(); refreshRedeemBar();
}
function updateLeftTag() { if (currentMachine.kind === "sweets") { $("leftTag").textContent = `🍬 ×${sweetsLeft()}`; return; } if (currentMachine.kind === "takoyaki") { $("leftTag").textContent = T("ballsLeftFmt").replace("{n}", `${TAKO.stock - takoState().got}`); return; } $("leftTag").textContent = `${currentMachine.kind === "bridge" ? "📦" : "🧸"} ${T("remaining")} ×${prizes.filter(p => !p.got).length}`; }

let lstCat                                                                                 = "all"; let lstQuery = "";
// ---------- "in use" system: machines go busy (other players / anti-hogging); layouts are never touched, only access is paused
                                                                                                                         
const busy                       = {};
const busyOf = (id        ) => busy[id] ?? (busy[id] = { until: 0, streak: 0, lastPlayAt: 0, gets: [], reason: "other" });
const isBusy = (id        ) => busyOf(id).until > Date.now();
const busyLeftMs = (id        ) => Math.max(0, busyOf(id).until - Date.now());
const mmss = (ms        ) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}${T("minUnit")}${String(s % 60).padStart(2, "0")}${T("secUnit")}`; };
const freeCount = () => MACHINES.filter(m => m.playable && !isBusy(m.id)).length;
function setBusy(id        , ms        , reason                ) {
  // keep at least 2 machines free at all times
  if (!isBusy(id) && freeCount() <= 2) return false;
  const b = busyOf(id); b.until = Date.now() + ms; b.reason = reason; b.streak = 0; cardsSig = ""; if (!listEl.classList.contains("hidden")) buildCards(); return true;
}
// random "another player" occupancy: checked every 20s, ~8% per free machine, never inside the machine the player is currently in
function busyTick() {
  const now = Date.now();
  for (const m of MACHINES) { if (!m.playable || isBusy(m.id)) continue; if (inMachine && currentMachine.id === m.id) continue; if (Math.random() < 0.08) setBusy(m.id, (60 + Math.random() * 120) * 1000, "other"); }
  void now;
}
every(busyTick, 20000);
every(() => { if (!listEl.classList.contains("hidden") && MACHINES.some(m => busyOf(m.id).until && busyOf(m.id).until < Date.now() + 1500 && busyOf(m.id).until > Date.now() - 1500)) { cardsSig = ""; buildCards(); } }, 1000);
function notePlay(id        ) {
  const b = busyOf(id); const now = Date.now();
  b.streak = now - b.lastPlayAt < 3 * 60000 ? b.streak + 1 : 1; b.lastPlayAt = now;
}
function noteGet(id        ) { const b = busyOf(id); const now = Date.now(); b.gets = b.gets.filter(t => now - t < 5 * 60000); b.gets.push(now); void submitRank(); }
// after a play resolves: hogging rules → pause this machine and send the player back to the list
function afterPlayBusyCheck() {
  const id = currentMachine.id; const b = busyOf(id);
  let ms = 0, reason                 = "streak";
  if (b.gets.length >= 3) { ms = 5 * 60000; reason = "haul"; b.gets = []; }
  else if (b.streak >= 5) { ms = (120 + Math.random() * 120) * 1000; reason = "streak"; }
  if (!ms) return;
  // never interrupt a session: the pause is applied when the player leaves this machine
  pendingBusy = { id, ms, reason };
}
let pendingBusy                                                            = null;
function applyPendingBusy() { if (pendingBusy) { const p = pendingBusy; pendingBusy = null; setBusy(p.id, p.ms, p.reason); } }
function openBusySheet(id        ) {
  const sh = $("busySheet"); const b = busyOf(id);
  const render = () => { sh.innerHTML = `<h3>${T("busyTitle")}</h3><div class="dim">${b.reason === "other" ? T("busyOther") : b.reason === "haul" ? T("busyHaul") : T("busyStreak")}</div><div style="font-size:30px;font-weight:900;color:#e0506f" id="busyLeft">${T("busyLeft").replace("{t}", mmss(busyLeftMs(id)))}</div><button class="pill" id="busyClose">${T("close")}</button>`; $("busyClose").addEventListener("click", () => { void sfx("ui.tap"); $("busyModal").classList.add("hidden"); clearInterval(iv); }); };
  render(); $("busyModal").classList.remove("hidden");
  const iv = window.setInterval(() => { if ($("busyModal").classList.contains("hidden")) { clearInterval(iv); return; } const left = busyLeftMs(id); const el = document.getElementById("busyLeft"); if (el) el.textContent = T("busyLeft").replace("{t}", mmss(left)); if (left <= 0) { clearInterval(iv); $("busyModal").classList.add("hidden"); cardsSig = ""; buildCards(); } }, 500);
}
let cardsSig = "";
function buildCards(force = false) {
  const grid = $("mGrid");
  // rebuild only when what the cards show has changed — re-creating <img> nodes makes the figure photo flash
  const sig = JSON.stringify([lang, lstCat, lstQuery, MACHINES.map(m => [m.id, m === currentMachine ? prizes.filter(p => !p.got).length : -1, !!save.layouts[m.id]]), save.tako?.filled.length ?? 0, save.tako?.got ?? 0, JSON.stringify(save.takos ?? {}), MACHINES.map(m => isBusy(m.id))]);
  if (!force && sig === cardsSig && grid.children.length) return;
  cardsSig = sig; grid.innerHTML = "";
  const cats = $("lstCats");
  const catDefs                            = [["all", T("catAll")], ["new", T("catNew")], ["bear", T("catPlush")], ["figure", T("catFigure")], ["sweets", T("catSweets")], ["takoyaki", T("catTako")], ["bridge", T("catBridge")], ["goods", T("catGoods")]];
  cats.innerHTML = catDefs.map(([k, l]) => `<button class="cat ${k === lstCat ? "on" : ""}" data-lc="${k}">${l}</button>`).join("");
  cats.querySelectorAll                   (".cat").forEach(b => b.addEventListener("click", () => { void sfx("ui.tap"); lstCat = b.dataset.lc                 ; buildCards(); }));
  $                  ("lstSearch").placeholder = T("searchMachines");
  const icons                         = { grab: "🧸", bridge: "📦", takoyaki: "⚪", sweets: "🍬" };
  const bg                         = { mascot: "#F3E8FF", "big-bear": "#FFE3EE", "big-pillow": "#FFEAF0", bridge: "#E8E2FF", "bridge-noctis": "#DDE3F5", "cake-bridge": "#FFE8E8", takoyaki: "#FFF3D8", "takoyaki-noctis": "#DDE8F8", sweets: "#FFF6D6" };
  const q = lstQuery.trim().toLowerCase();
  const list = MACHINES.filter(m => {
    if (lstCat === "new" && !m.isNew) return false;
    if (lstCat === "bear" && !(m.prizeId === "bear" || m.mascot || m.id === "big-pillow")) return false; if (lstCat === "figure" && !(m.prizeId === "figure" || m.prizeId === "noctis")) return false;
    if ((lstCat === "takoyaki" || lstCat === "bridge" || lstCat === "sweets") && m.kind !== lstCat) return false;
    if (lstCat === "goods" && m.id !== "cake-bridge") return false;
    if (q && !(machineName(m) + " " + prizeName(m.prizeId)).toLowerCase().includes(q)) return false;
    return true;
  });
  for (const m of list) {
    const b = document.createElement("button");
    b.className = "mcell" + (m.playable ? "" : " wip");
    const leftN = m.kind === "takoyaki" ? TAKO.stock - takoStateOf(m.id).got : m.kind === "sweets" ? (m === currentMachine && prizes.length ? prizes.filter(p => !p.got).length : (save.layouts[m.id]?.filter(x => !x.got).length ?? SWEET_PILE.n)) : m === currentMachine && prizes.length ? prizes.filter(p => !p.got).length : m.prizes.length;
    // 卡片结构刻意压扁了：图 1:0.82、名字一行、价格一行。
    // 原来图 1:1.05 + 名字两行 + 一行「种类 ×剩余」，一张 ~200px 高，一屏只看得见两排半。
    // 原来那行 meta 里的「剩余 ×N」现在挪成图上角的小角标，种类图标直接去掉（分类条已经能筛）。
    b.innerHTML = `<div class="img" style="background:${bg[m.id] ?? "#f1eefa"}">${m.kind === "sweets" ? `<div class="sweetPile">${SWEETS.map(s => `<img src="${imgSrc(s.img)}" alt="">`).join("")}</div>` : m.mascot ? `<img src="${imgSrc("assets/pop-mascot.webp")}" style="width:96%;height:96%;object-fit:cover;object-position:50% 62%;border-radius:10px" alt="">` : m.id === "big-pillow" ? `<img src="${imgSrc("assets/pop-pillow.webp")}" style="width:96%;height:96%;object-fit:cover;object-position:50% 58%;border-radius:10px" alt="">` : m.playable ? prizeImgP(m.prizeId, 120) : `<span style="font-size:40px">${icons[m.kind]}</span>`}${leftN ? `<span class="cnt">×${leftN}</span>` : ""}${isBusy(m.id) ? `<span class="playing busy">${T("playing")}</span>` : ""}</div>
      <div class="nm">${m.playable && m.kind !== "sweets" && !m.mascot && m.id !== "big-pillow" ? prizeName(m.prizeId) : machineName(m)}</div>
      <div class="pr">${m.playable ? `${m.price} 🪙` : T("wip")}</div>`;
    b.addEventListener("click", () => { void sfx("ui.tap"); if (!m.playable) return; if (isBusy(m.id)) { openBusySheet(m.id); return; } enterMachine(m); });
    grid.appendChild(b);
  }
  if (!list.length) { const e = document.createElement("div"); e.style.cssText = "grid-column:1/-1;text-align:center;color:#8b84a3;font-weight:700;padding:20px"; e.textContent = T("noResults"); grid.appendChild(e); }
}
let colCat                     = "prize";

/**
 * 背包 —— 原「图鉴」+「回收站」合并成一个屏。
 *
 * 用户的要求：「只需要背包就行，不需要回收按钮，在背包里可卖」。
 * 所以卖娃娃不再是第二个屏，而是**点背包里的格子**：
 *   有货的格子 → 卖 1 个 / 全部卖掉；没抓到的 → 详情（图鉴用）。
 *
 * ⚠️ 图鉴部分（没抓到的显示 ???）**必须留着** —— 排行页的「收集率」是按
 * `PRIZE_META` 里有多少个 id 被 `gotCounts` 覆盖算的，删掉图鉴那一列就没数了。
 * 但**有货的排前面**：背包首先得让人一眼看到「我现在能卖什么」。
 */
function buildCollection() {
  document.querySelectorAll("#collection .cat").forEach(b => b.classList.toggle("on", b.dataset.cc === colCat));
  const prizeTab = colCat === "prize";
  $("colGrid").classList.toggle("hidden", !prizeTab);
  $("snackList").classList.toggle("hidden", prizeTab);
  $("comboWrap").classList.toggle("hidden", !prizeTab);
  if (!prizeTab) { buildSnackList(); return; }
  buildCombos();
  buildBagGrid();
  refreshRedeemBar();
}

/**
 * 零食页。**零食也能卖** —— 原来它们混在回收站的格子里，
 * 回收屏删掉之后如果这里只是「看一眼」，那就是静默砍掉一个功能
 * （抓到的零食再也换不成券）。所以有货的行就是按钮，点开同一个卖出面板。
 */
function buildSnackList() {
  const L = $("snackList"); L.innerHTML = "";
  const any = SWEETS.some(sd => (save.snacks?.[sd.id]?.quantity ?? 0) > 0);
  const head = document.createElement("div");
  head.className = "bagHead";
  head.style.gridColumn = "auto";
  head.textContent = any ? T("bagHint") : T("bagEmptySweet");
  L.appendChild(head);
  for (const sd of SWEETS) {
    const q = save.snacks?.[sd.id]?.quantity ?? 0;
    const el = document.createElement("button");
    el.className = "snackRow" + (q ? "" : " locked");
    el.dataset.owned = String(q);
    el.innerHTML = `${prizeImg(sd.id, 56)}<div class="nm">${q ? prizeName(sd.id) : T("unknown")}</div><div class="qty">×${q}</div>` +
      (q > 0 ? `<div class="val">${VOUCHER.emoji} ${recycleValue(sd.id)}</div>` : "");
    if (q > 0) el.addEventListener("click", () => { void sfx("ui.tap"); openRecycleSheet(sd.id); });
    L.appendChild(el);
  }
}

/* ---------------- 组合兑换 ---------------- */

let comboSig = "";
let bagSig = "";

/**
 * 组合条。**只在「奖品」页出现**（零食不参与组合）。
 *
 * 重建条件用签名而不是每次都重建：缩略图重建会闪一下，
 * 而这个屏在卖完一件之后会立刻重画（`bagSig` 同理）。
 */
function buildCombos() {
  const w = $("comboWrap");
  const sig = JSON.stringify([lang, save.stock]);
  if (sig === comboSig && w.children.length) return;
  comboSig = sig; w.innerHTML = "";

  for (const c of COMBOS) {
    const have = c.ids.map(id => stockOf(id));
    const lack = have.filter(n => n <= 0).length;
    const ready = lack === 0;
    const el = document.createElement("button");
    el.className = "comboCard" + (ready ? " ready" : "");
    el.dataset.combo = c.id;
    el.dataset.ready = ready ? "1" : "0";
    el.innerHTML = `<div class="who">${T("cb_" + c.id)}</div>` +
      `<div class="dots">${c.ids.map((id, k) => `<span class="dot${have[k] > 0 ? "" : " miss"}">${prizeImg(id, 23)}</span>`).join("")}</div>` +
      `<div class="price">${VOUCHER.emoji} ${comboTotal(c)}<small>${T("comboBase")} ${comboBase(c)} +${c.bonus}</small></div>` +
      `<div class="go">${ready ? T("comboGo") : T("comboNeed").replace("{n}", String(lack))}</div>`;
    // ⚠️ 不 disabled：disabled 的按钮连 click 都不发，孩子只会觉得「按钮坏了」。
    el.addEventListener("click", () => {
      void sfx("ui.tap");
      if (!ready) { toast(T("comboNeed").replace("{n}", String(lack))); return; }
      openComboSheet(c);
    });
    w.appendChild(el);
  }
}

function openComboSheet(c) {
  const sh = $("sellSheet");
  const base = comboBase(c), total = comboTotal(c);
  sh.className = "sheet";
  sh.innerHTML = `<h3>${T("cb_" + c.id)}</h3>
    <div class="dim">${T("comboEach")}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${c.ids.map(id => `<span style="width:44px;height:44px;border-radius:10px;overflow:hidden;background:#f4f1fa;display:flex;align-items:center;justify-content:center">${prizeImg(id, 44)}</span>`).join("")}</div>
    <div class="calc"><div class="tot"><span>${T("comboBase")} ×${c.ids.length}</span><span>${VOUCHER.emoji} ${base}</span></div><div class="tot"><span>${T("comboBonus")}</span><span style="color:${hex(PALETTE.pink)}">+${VOUCHER.emoji} ${c.bonus}</span></div></div>
    <div class="row"><button class="pill" id="cbCancel">${T("cancel")}</button><button class="pill pink" id="cbGo">${T("comboGo")} · ${VOUCHER.emoji}${total}</button></div>`;
  $("sellModal").classList.remove("hidden");
  $("cbCancel").addEventListener("click", () => { void sfx("ui.tap"); $("sellModal").classList.add("hidden"); });
  $("cbGo").addEventListener("click", async () => {
    void sfx("crane.confirm");
    const got = await exchangeCombo(c);
    if (!(got > 0)) { toast(T("comboFail")); $("sellModal").classList.add("hidden"); return; }
    if (!alive) return;
    // 显示宿主实际发出的券数（`got`），不是自己算的 `total`
    sh.innerHTML = `<h3 style="font-size:24px">✓ ${T("comboGo")}</h3><div style="font-size:34px;font-weight:900;color:${hex(PALETTE.pink)}">${VOUCHER.emoji} +${got}</div>`;
    void sfx("prize.get");
    spawnConfettiIn($("sellModal"));
    setTimeout(() => { if (alive) $("sellModal").classList.add("hidden"); }, 900);
  });
}

/**
 * 真的兑换一个组合。返回**宿主实际发出的券数**（0 = 没换成）。
 *
 * ⚠️ 和单件卖出同一条纪律：**先扣库存，再发券**。
 * 反过来的话，发券成功、扣库存失败就是「娃娃还在、券已到」，可以无限重复换。
 */
async function exchangeCombo(c) {
  if (!c.ids.every(id => stockOf(id) > 0)) return 0;
  for (const id of c.ids) save.stock[id] = stockOf(id) - 1;
  save.soldCount = (save.soldCount ?? 0) + c.ids.length;
  persist();

  const got = await wallet.redeemPrize(comboTotal(c), `组合 ${T("cb_" + c.id)} ×1`);
  comboSig = ""; bagSig = "";
  if (alive) { refreshTexts(); buildCollection(); }
  return got;
}

/* ---------------- 背包网格 ---------------- */

function buildBagGrid() {
  const g = $("colGrid");
  const sig = JSON.stringify([lang, save.stock, save.gotCounts]);
  if (sig === bagSig && g.children.length) return;
  bagSig = sig; g.innerHTML = "";

  // 有货的排前面（V8 的 sort 是稳定的 ⇒ 两组内部仍按 PRIZE_META 的原顺序）
  const ids = Object.keys(PRIZE_META).filter(id => id !== "snackbox" && !id.startsWith("sweet_"));
  ids.sort((a, b) => (stockOf(b) > 0 ? 1 : 0) - (stockOf(a) > 0 ? 1 : 0));
  const anyOwned = ids.some(id => stockOf(id) > 0);

  const head = document.createElement("div");
  head.className = "bagHead";
  head.textContent = anyOwned ? T("bagHint") : T("bagEmpty");
  g.appendChild(head);

  for (const id of ids) {
    const n = stockOf(id);
    const got = save.gotCounts[id] ?? 0;
    const cell = document.createElement("button");
    cell.className = "cell" + (got ? "" : " locked");
    cell.dataset.prize = id;
    cell.dataset.owned = String(n);
    cell.innerHTML = `<div class="ico">${prizeImg(id, 64)}</div><div>${got ? prizeName(id) : T("unknown")}</div>` +
      (n > 0
        ? `<div style="color:#8b84a3;font-size:12px">×${n}</div><div style="color:${hex(PALETTE.pink)};font-size:13px;font-weight:900">${VOUCHER.emoji} ${recycleValue(id)}</div>`
        : (got ? `<div style="color:#8b84a3;font-size:11.5px">×0</div>` : ""));
    cell.addEventListener("click", () => {
      void sfx("ui.tap");
      if (n > 0) openRecycleSheet(id); else openDetail(id);
    });
    g.appendChild(cell);
  }
}

/** 图鉴详情（只有没货的格子会走到这里 —— 有货的点开是卖出面板）。 */
function openDetail(id) {
  const meta = PRIZE_META[id];
  const n = save.gotCounts[id] ?? 0;
  const owned = ownedCount(id);
  const sheet = $("detailSheet");
  sheet.innerHTML = n
    ? `<div class="big">${prizeImg(id, 120)}</div><h3>${prizeName(id)}</h3><div>${T("rarity")} <span style="color:${hex(PALETTE.pink)}">${stars(meta.rarity)}</span> ${T(("r" + meta.rarity)          )}</div><div class="dim">${T("gotCount")}: ${n}　${T("owned")}: ${owned}\n${T("firstGot")}: ${save.firstGot[id] ?? "-"}</div><div class="dim">${T(meta.descKey          )}</div><div class="row"><button class="pill" id="detailClose">${T("close")}</button></div>`
    : `<div class="big" style="filter:brightness(0) opacity(.75)">${prizeImg(id, 120)}</div><h3>${T("unknown")}</h3><div>${T("rarity")} <span style="color:${hex(PALETTE.pink)}">${stars(meta.rarity)}</span></div><div class="row"><button class="pill" id="detailClose">${T("close")}</button></div>`;
  $("detail").classList.remove("hidden");
  $("detailClose").addEventListener("click", () => { void sfx("ui.tap"); $("detail").classList.add("hidden"); });
}

// ---------- touch scroller: drag anywhere in the list, 8px moves cancel the tap, inertia on release ----------
function makeScroller(el             , axis            = "y") {
  let startX = 0, startY = 0, last = 0, lastT = 0, vel = 0, dragging = false, moved = false, rejected = false, raf = 0, pid = -1;
  const pos = (e              ) => axis === "y" ? e.clientY : e.clientX;
  const get = () => axis === "y" ? el.scrollTop : el.scrollLeft;
  const set = (v        ) => { if (axis === "y") el.scrollTop = v; else el.scrollLeft = v; };
  const cancelClicks = (e       ) => { if (moved) { e.stopPropagation(); e.preventDefault(); } };
  el.addEventListener("click", cancelClicks, true);
  el.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearTimeout(raf); dragging = true; moved = false; rejected = false; pid = e.pointerId; startX = e.clientX; startY = e.clientY; last = pos(e); lastT = performance.now(); vel = 0;
  });
  el.addEventListener("pointermove", e => {
    if (!dragging || e.pointerId !== pid || rejected) return;
    const now = performance.now();
    if (!moved) {
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
      if (Math.max(dx, dy) <= 8) return;
      // direction lock: a swipe along the other axis belongs to the parent scroller
      const mine = axis === "y" ? dy >= dx : dx > dy;
      if (!mine) { rejected = true; return; }
      moved = true; e.stopPropagation(); try { el.setPointerCapture(pid); } catch { /* */ }
    }
    e.stopPropagation();
    const d = pos(e) - last;
    set(get() - d);
    const dt = Math.max(1, now - lastT); vel = 0.8 * vel + 0.2 * (-d / dt * 1000); last = pos(e); lastT = now;
  });
  const end = (e              ) => {
    if (!dragging || e.pointerId !== pid) return; dragging = false;
    if (!moved) return;
    let v = vel, prev = performance.now();
    // DOM scroll inertia on a timer (the rAF loop is reserved for the 3D frame)
    const step = () => { const t = performance.now(); const dt = Math.min(0.05, (t - prev) / 1000); prev = t; set(get() + v * dt); v *= Math.pow(0.05, dt); if (Math.abs(v) > 20) raf = window.setTimeout(step, 16); else moved = false; };
    raf = window.setTimeout(step, 16);
    setTimeout(() => { if (!dragging) moved = false; }, 60);
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => { if (axis === "y") el.scrollTop += e.deltaY; else el.scrollLeft += e.deltaX; }, { passive: true });
}
makeScroller($("cards")); makeScroller($("lstCats"), "x"); makeScroller($("colGrid")); makeScroller($("comboWrap"), "x");

// ---------- three ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0xf6eef8, 1);
viewportEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6eef8);
scene.fog = new THREE.Fog(0xf6eef8, 14, 30);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 60);
scene.add(camera);

const hemi = new THREE.HemisphereLight(PALETTE.cream, PALETTE.lavender, 0.9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 9, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5; key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5; key.shadow.camera.near = 2; key.shadow.camera.far = 22; key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
scene.add(key); scene.add(key.target);
const rimP = new THREE.PointLight(PALETTE.pink, 6, 14); rimP.position.set(-4, 4, 3); scene.add(rimP);
const rimM = new THREE.PointLight(PALETTE.mint, 6, 14); rimM.position.set(4, 3, -3); scene.add(rimM);

// camera: tweened between front/side rigs (0.3s)
let camMode                   = "front";
let zoom = 1, zoomTarget = 1;
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(), camGoalPos = new THREE.Vector3(), camGoalTarget = new THREE.Vector3();
let camTween = 1; // 0..1 progress
const camFrom = new THREE.Vector3(), camFromT = new THREE.Vector3();
let freeCam                       = null;
function computeRig(mode                  , outPos               , outTarget               ) {
  const w = viewportEl.clientWidth || 1, h = viewportEl.clientHeight || 1;
  const aspect = w / h;
  let vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(42) / 2) / aspect);
  vfov = THREE.MathUtils.clamp(vfov, THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(78));
  const hfovEff = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  camera.fov = THREE.MathUtils.radToDeg(vfov); camera.aspect = aspect; camera.updateProjectionMatrix();
  const m = currentMachine;
  const halfW = (mode === "front" ? m.caseW / 2 : m.caseD / 2) + 0.9;
  const halfH = m.caseH / 2 + 0.75;
  const d = Math.max(halfW / Math.tan(hfovEff / 2), halfH / Math.tan(vfov / 2)) * zoom;
  outTarget.set(0, m.caseH * 0.44, 0);
  if (mode === "front") outPos.set(0, m.caseH * 0.44 + d * 0.3, d);
  else outPos.set(d, m.caseH * 0.44 + d * 0.28, 0.5);
}
function fitCamera() { computeRig(camMode, camGoalPos, camGoalTarget); }
function setCam(mode                  ) {
  if (freeCam) return;
  camMode = mode; $("camFront").classList.toggle("on", mode === "front"); $("camSide").classList.toggle("on", mode === "side");
  camFrom.copy(camPos); camFromT.copy(camTarget); camTween = 0; fitCamera();
}
function camTick(dt        ) {
  if (freeCam) { freeCam.update(); return; }
  fitCamera();
  if (camTween < 1) {
    camTween = Math.min(1, camTween + dt / 0.3);
    const e = camTween < 0.5 ? 2 * camTween * camTween : 1 - Math.pow(-2 * camTween + 2, 2) / 2;
    camPos.lerpVectors(camFrom, camGoalPos, e); camTarget.lerpVectors(camFromT, camGoalTarget, e);
  } else { camPos.lerp(camGoalPos, Math.min(1, dt * 10)); camTarget.lerp(camGoalTarget, Math.min(1, dt * 10)); }
  camera.position.copy(camPos); camera.lookAt(camTarget);
}
function resize() {
  const w = viewportEl.clientWidth, h = viewportEl.clientHeight;
  if (w > 0 && h > 0) renderer.setSize(w, h, false);
  playEl.classList.toggle("land", innerWidth > innerHeight * 1.05);
  fitCamera();
}
new ResizeObserver(resize).observe(viewportEl);
addEventListener("resize", resize);

// ---------- world building ----------
                                               
                                                                      
                                                                                                                                                                                                                                                                                               
                                                                                                                                                    

let world               ;
let machineGroup                     = null;
function teardownMachine() {
  fx.clear(); mascotPendingGets = 0; mascotLastGet = null; mascotHaul = [];
  suck = null; if (restock) { scene.remove(restock.box); restock = null; } if (staffHand) { scene.remove(staffHand); }
  if (machineGroup) { scene.remove(machineGroup); machineGroup = null; } chuteGlow = null;
  if (debugGroup) scene.remove(debugGroup);
  for (const p of prizes) scene.remove(p.mesh);
  prizes.length = 0; fingers.length = 0; clawColliders.length = 0; balls = []; takoStock = []; takoCups = []; spoonMesh = null; spoonBody = null; takoFingers = []; takoTilt = 0; bridgeColliders.length = 0; stockMeshes = []; clawPassThrough = false;
  if (world) world.free();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = PHYSICS.fixedDt;
}
let eventQueue                    ;
const prizes          = [];
const fingers           = [];
let clawHead                   ;
let popGroup              ;
// 所有贴图都走这个 loader，所以资源前缀只要在这里加一次（43 处 texLoader.load("assets/...") 都不用改）
const texManager = new THREE.LoadingManager();
texManager.setURLModifier(u => (String(u).startsWith("assets/") ? assetBase + u : u));
const texLoader = new THREE.TextureLoader(texManager);
// POPs are real objects glued to the back panel (lit, slightly glossy laminate); missing/failed images show nothing.
function applyPops(pops                    ) {
  if (!popGroup) return;
  while (popGroup.children.length) { const c = popGroup.children.pop()              ; (c.material                  ).dispose(); c.geometry.dispose(); }
  if (!pops) return;
  const m = currentMachine, W = m.caseW, H = m.caseH;
  for (const slot of [pops.main, pops.sub1, pops.sub2]) {
    if (!slot?.image) continue;
    const s          = slot;
    texLoader.load(s.image, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const img = tex.image                                     ;
      const w = W * s.width, h = w * (img.height / img.width);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05, transparent: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set((s.x - 0.5) * W, s.y * H, s === pops.main ? 0 : 0.01);
      mesh.receiveShadow = true; mesh.userData.slot = s; popGroup.add(mesh);
    }, undefined, () => { /* missing image: show nothing */ });
  }
}
let headMesh              , beamMesh             , cableMesh             , shadowBlob             , debugGroup              ;
const BEAR_GLOBAL = 0.95;
const clawColliders                    = [];
const GROUP_STATIC = 0x0001, GROUP_PRIZE = 0x0002, GROUP_CLAW = 0x0004;
const grp = (mem        , filt        ) => (mem << 16) | filt;
let clawPassThrough = false;
function setClawPassThrough(on         ) { if (on === clawPassThrough) return; clawPassThrough = on; for (const c of clawColliders) c.setCollisionGroups(grp(GROUP_CLAW, on ? GROUP_STATIC : GROUP_STATIC | GROUP_PRIZE)); }
// test-mode tunables (multipliers on config)
let popTestIdx = -1;
const tune = { armPower: 1, weight: 1, friction: 1, forceGet: false, showHit: false, showParams: false };

const matCabinet = new THREE.MeshStandardMaterial({ color: PALETTE.cabinet, roughness: 0.55, metalness: 0.05 });
const matAcrylic = new THREE.MeshStandardMaterial({ color: PALETTE.acrylic, transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
const matSteel = new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.35, metalness: 0.7 });
const matFloor = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.8 });
const matBackWall = new THREE.MeshStandardMaterial({ color: 0xfbf6ff, roughness: 0.9 });
const matChute = new THREE.MeshStandardMaterial({ color: 0x3b3556, roughness: 0.9 });
// ---- shared prize-chute dressing (all machines with a drop hole; not the takoyaki plate) ----
let chuteGlow                    = null; let chuteGlowT = 0;
function decalTexture(kind                  )                {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d") ;
  c.fillStyle = "#ff5c8d"; c.strokeStyle = "#ff5c8d"; c.lineWidth = 14; c.lineCap = "round"; c.lineJoin = "round";
  if (kind === "arrow") { c.beginPath(); c.moveTo(64, 14); c.lineTo(64, 104); c.moveTo(28, 70); c.lineTo(64, 108); c.lineTo(100, 70); c.stroke(); }
  else { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 54, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.closePath(); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// user-supplied chute artwork (assets/chute-art.webp, 1672×941): UV windows into it — front band (striped pink w/ arrows+stars),
// side collar strips, and the brushed-metal interior. Never repainted.
function chuteWin(x0        , y0        , x1        , y1        , repeatX = 1) {
  const t = texLoader.load("assets/chute-art.webp"); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.offset.set(x0 / 1672, 1 - y1 / 941); t.repeat.set((x1 - x0) / 1672 * repeatX, (y1 - y0) / 941); return t;
}
function buildChuteDressing(m               , g             , chOverride                                                                  ) {
  const ch = chOverride ?? m.chute; const cd = ch.depth; const bev = 0.18, lipH = 0.09;
  const back = new THREE.MeshStandardMaterial({ map: chuteWin(365, 255, 1305, 400), roughness: 0.5 });   // top band: arrows + stars
  const sideL = new THREE.MeshStandardMaterial({ map: chuteWin(60, 300, 350, 820), roughness: 0.5 });
  const sideR = new THREE.MeshStandardMaterial({ map: chuteWin(1320, 300, 1610, 820), roughness: 0.5 });
  const front = new THREE.MeshStandardMaterial({ map: chuteWin(40, 760, 1630, 860), roughness: 0.5 });   // striped band
  const metal = new THREE.MeshStandardMaterial({ map: chuteWin(430, 400, 1240, 760), roughness: 0.35, metalness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ map: chuteWin(40, 760, 1630, 860, 2), roughness: 0.5 });
  // sloped collar wedges, each textured with the matching part of the artwork
  const mats                             = [[sideL, 0], [sideR, Math.PI], [back, Math.PI / 2], [front, -Math.PI / 2]];
  for (const [i, [sx, sz, x, z, rotY]] of ([[bev, ch.d + bev * 2, ch.cx - ch.w / 2 - bev / 2, ch.cz, 0], [bev, ch.d + bev * 2, ch.cx + ch.w / 2 + bev / 2, ch.cz, Math.PI], [ch.w + bev * 2, bev, ch.cx, ch.cz - ch.d / 2 - bev / 2, Math.PI / 2], [ch.w + bev * 2, bev, ch.cx, ch.cz + ch.d / 2 + bev / 2, -Math.PI / 2]]              ).entries()) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(bev, 0); shape.lineTo(bev, lipH); shape.lineTo(0, 0.005); shape.closePath();
    const len = rotY === 0 || rotY === Math.PI ? sz : sx;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }); geo.translate(-bev, 0, -len / 2);
    // remap UVs so the slope face spans the texture once
    const uv = geo.attributes.uv                         ; const pos = geo.attributes.position                         ;
    for (let k = 0; k < uv.count; k++) { uv.setXY(k, (pos.getZ(k) + len / 2) / len, (pos.getX(k) + bev) / bev); }
    const wedge = new THREE.Mesh(geo, mats[i][0]); wedge.rotation.y = rotY; wedge.position.set(x + (rotY === 0 ? bev / 2 : rotY === Math.PI ? -bev / 2 : 0), 0.002, z + (rotY === Math.PI / 2 ? -bev / 2 : rotY === -Math.PI / 2 ? bev / 2 : 0));
    wedge.castShadow = wedge.receiveShadow = true; g.add(wedge);
  }
  // outer striped band around the collar
  const band = new THREE.Mesh(new THREE.BoxGeometry(ch.w + bev * 2 + 0.3, 0.05, ch.d + bev * 2 + 0.3), [stripe, stripe, stripe, stripe, stripe, stripe]); band.position.set(ch.cx, 0.025, ch.cz); g.add(band);
  // metal interior walls
  for (const [w, x, z, ry] of [[ch.d, ch.cx - ch.w / 2 + 0.005, ch.cz, Math.PI / 2], [ch.d, ch.cx + ch.w / 2 - 0.005, ch.cz, -Math.PI / 2], [ch.w, ch.cx, ch.cz - ch.d / 2 + 0.005, 0], [ch.w, ch.cx, ch.cz + ch.d / 2 - 0.005, Math.PI]]              ) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, cd), metal); pl.rotation.y = ry; pl.position.set(x, -cd / 2, z); g.add(pl);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb0d0, transparent: true, opacity: 0.35 });
  chuteGlow = new THREE.Mesh(new THREE.BoxGeometry(ch.w + 0.02, 0.03, ch.d + 0.02), glowMat); chuteGlow.position.set(ch.cx, -0.05, ch.cz); g.add(chuteGlow);
}
function chuteFlash() { chuteGlowT = 1; }
function chuteGlowTick(dt        ) { if (!chuteGlow) return; chuteGlowT = Math.max(0, chuteGlowT - dt * 1.6); (chuteGlow.material                           ).opacity = 0.35 + chuteGlowT * 0.65; (chuteGlow.material                           ).color.set(chuteGlowT > 0.2 ? 0xffffff : 0xffb0d0); }
const glowPink = new THREE.MeshStandardMaterial({ color: PALETTE.pink, emissive: PALETTE.pink, emissiveIntensity: 1.6, roughness: 0.4 });
const glowMint = new THREE.MeshStandardMaterial({ color: PALETTE.mint, emissive: PALETTE.mint, emissiveIntensity: 1.6, roughness: 0.4 });
const matDebug = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.6, depthTest: false });

function qz(angle        ) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle); return { x: q.x, y: q.y, z: q.z, w: q.w }; }

function fixedBox(hx        , hy        , hz        , x        , y        , z        , friction = 0.8) {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction).setRestitution(0.05), b);
}

function buildMachine(m               ) {
  const W = m.caseW, D = m.caseD, H = m.caseH, ch = m.chute;
  const t = 0.1;
  const cx0 = ch.cx - ch.w / 2, cx1 = ch.cx + ch.w / 2, cz0 = ch.cz - ch.d / 2, cz1 = ch.cz + ch.d / 2;
  const fy = -t;
  const tako = m.kind === "takoyaki";
  if (m.kind !== "bridge" && !tako) {
    // rim: a slippery bevel ring just around the hole so a plush touching the lip slides in rather than parking on it
    const bev = 0.18;
    for (const [hx, hz, x, z] of [[bev / 2, ch.d / 2 + bev, cx0 - bev / 2, ch.cz], [bev / 2, ch.d / 2 + bev, cx1 + bev / 2, ch.cz], [ch.w / 2, bev / 2, ch.cx, cz0 - bev / 2], [ch.w / 2, bev / 2, ch.cx, cz1 + bev / 2]]              ) {
      const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.02, z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.02, hz).setFriction(0.05).setRestitution(0), rb);
    }
    fixedBox((cx0 + W / 2) / 2, t, D / 2, (-W / 2 + cx0) / 2, fy, 0);
    fixedBox((W / 2 - cx1) / 2, t, D / 2, (cx1 + W / 2) / 2, fy, 0);
    fixedBox(ch.w / 2, t, (D / 2 - cz1) / 2, ch.cx, fy, (cz1 + D / 2) / 2);
    fixedBox(ch.w / 2, t, (cz0 + D / 2) / 2, ch.cx, fy, (-D / 2 + cz0) / 2);
  }
  fixedBox(t, H / 2 + 1, D / 2 + t, -W / 2 - t, H / 2, 0, 0.3);
  fixedBox(t, H / 2 + 1, D / 2 + t, W / 2 + t, H / 2, 0, 0.3);
  fixedBox(W / 2 + t, H / 2 + 1, t, 0, H / 2, -D / 2 - t, 0.3);
  fixedBox(W / 2 + t, H / 2 + 1, t, 0, H / 2, D / 2 + t, 0.3);
  fixedBox(W / 2, t, D / 2, 0, H + t, 0, 0.3);
  if (tako) fixedBox(W / 2, t, D / 2, 0, fy, 0, 0.6);
  const cd = ch.depth, cy = -cd / 2;
  fixedBox(t, cd / 2, ch.d / 2 + t, cx0 - t, cy, ch.cz, 0.4);
  fixedBox(t, cd / 2, ch.d / 2 + t, cx1 + t, cy, ch.cz, 0.4);
  fixedBox(ch.w / 2, cd / 2, t, ch.cx, cy, cz0 - t, 0.4);
  fixedBox(ch.w / 2, cd / 2, t, ch.cx, cy, cz1 + t, 0.4);
  fixedBox(ch.w / 2 + t, t, ch.d / 2 + t, ch.cx, -cd - t, ch.cz, 0.9);

  debugGroup = new THREE.Group(); debugGroup.visible = tune.showHit; scene.add(debugGroup);
  const g = new THREE.Group(); scene.add(g); machineGroup = g;
  const shape = new THREE.Shape(); shape.moveTo(-W / 2, -D / 2); shape.lineTo(W / 2, -D / 2); shape.lineTo(W / 2, D / 2); shape.lineTo(-W / 2, D / 2); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(cx0, -cz0); hole.lineTo(cx1, -cz0); hole.lineTo(cx1, -cz1); hole.lineTo(cx0, -cz1); hole.closePath(); if (!tako) shape.holes.push(hole);
  const floorGeo = new THREE.ShapeGeometry(shape); floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, matFloor); floor.receiveShadow = true; if (m.kind !== "bridge") g.add(floor);
  if (m.kind === "bridge") buildBridge(m, g);
  if (tako) buildTakoyaki(m, g);
  if (m.kind === "sweets") buildSweetsStage(m, g);
  // depth stripes on the floor help judge z
  if (m.kind !== "bridge" && !tako) for (let i = 1; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.004, 0.02), new THREE.MeshStandardMaterial({ color: 0xe8d9c4, roughness: 1 })); st.position.set(0, 0.003, -D / 2 + i * D / 4); g.add(st); }
  const chuteWalls = [
    [t / 2, cd / 2, ch.d / 2, cx0 - t / 2, cy, ch.cz], [t / 2, cd / 2, ch.d / 2, cx1 + t / 2, cy, ch.cz],
    [ch.w / 2, cd / 2, t / 2, ch.cx, cy, cz0 - t / 2], [ch.w / 2, cd / 2, t / 2, ch.cx, cy, cz1 + t / 2], [ch.w / 2, t / 2, ch.d / 2, ch.cx, -cd, ch.cz],
  ];
  if (!tako) for (const [hx, hy, hz, x, y, z] of chuteWalls) { const mm = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), matChute); mm.position.set(x, y, z); mm.receiveShadow = true; g.add(mm); }
  // chute artwork removed on all machines (user request); buildChuteDressing kept unused
  // "GET" zone marker (visual only) on the chute floor
  if (m.kind === "bridge") {
    // hollow base: four walls + bottom so the pit reads as a deep drop
    for (const sd of [-1, 1]) {
      const wx = new THREE.Mesh(new THREE.BoxGeometry(0.3, cd + 0.6, D + 0.6), matCabinet); wx.position.set(sd * (W / 2 + 0.15), -(cd + 0.6) / 2 - 0.02, 0); g.add(wx);
      const wz = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, cd + 0.6, 0.3), matCabinet); wz.position.set(0, -(cd + 0.6) / 2 - 0.02, sd * (D / 2 + 0.15)); g.add(wz);
      const inX = new THREE.Mesh(new THREE.PlaneGeometry(D, cd), m.theme === "cafe" ? matCafeWhite : matChute); inX.rotation.y = -sd * Math.PI / 2; inX.position.set(sd * (W / 2 - 0.01), -cd / 2, 0); g.add(inX);
      const inZ = new THREE.Mesh(new THREE.PlaneGeometry(W, cd), m.theme === "cafe" ? matCafeWhite : matChute); inZ.rotation.y = sd > 0 ? Math.PI : 0; inZ.position.set(0, -cd / 2, sd * (D / 2 - 0.01)); g.add(inZ);
    }
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.3, D + 0.6), matCabinet); bottom.position.set(0, -cd - 0.45, 0); g.add(bottom);
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, cd + 0.6, D + 0.6), matCabinet); base.position.set(0, -(cd + 0.6) / 2 - 0.02, 0); base.receiveShadow = true; g.add(base);
  }
  const baseLine = new THREE.Mesh(new THREE.BoxGeometry(W + 0.64, 0.05, D + 0.64), m.led ? new THREE.MeshStandardMaterial({ color: m.led.a, emissive: m.led.a, emissiveIntensity: 1.6 }) : glowPink); baseLine.position.set(0, -0.3, 0); g.add(baseLine);
  // back wall inside case (opaque pastel) — helps read depth & shadows
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m.theme === "cafe" ? new THREE.MeshStandardMaterial({ color: 0xffe9ef, roughness: 0.9 }) : matBackWall); backWall.position.set(0, H / 2, -D / 2 + 0.01); backWall.receiveShadow = true; g.add(backWall);
  popGroup = new THREE.Group(); popGroup.position.set(0, 0, -D / 2 + 0.03); g.add(popGroup);
  applyPops(m.pops);
  const wallGeoWD = new THREE.PlaneGeometry(W, H), wallGeoDH = new THREE.PlaneGeometry(D, H);
  const front = new THREE.Mesh(wallGeoWD, matAcrylic); front.position.set(0, H / 2, D / 2); g.add(front);
  const left = new THREE.Mesh(wallGeoDH, matAcrylic); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, H / 2, 0); g.add(left);
  const right = new THREE.Mesh(wallGeoDH, matAcrylic); right.rotation.y = -Math.PI / 2; right.position.set(W / 2, H / 2, 0); g.add(right);
  const pillarGeo = new THREE.BoxGeometry(0.14, H + 0.3, 0.14);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(pillarGeo, matCabinet); p.position.set(x * (W / 2 + 0.07), H / 2, z * (D / 2 + 0.07)); g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), matCabinet); top.position.set(0, H + 0.25, 0); g.add(top);
  const ledA = m.led ? new THREE.MeshStandardMaterial({ color: m.led.a, emissive: m.led.a, emissiveIntensity: 1.6, roughness: 0.4 }) : glowPink;
  const ledB = m.led ? new THREE.MeshStandardMaterial({ color: m.led.b, emissive: m.led.b, emissiveIntensity: 1.6, roughness: 0.4 }) : glowMint;
  const topLine = new THREE.Mesh(new THREE.BoxGeometry(W + 0.64, 0.04, D + 0.64), ledA); topLine.position.set(0, H + 0.05, 0); g.add(topLine);
  const topLine2 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.64, 0.04, D + 0.64), ledB); topLine2.position.set(0, H + 0.45, 0); g.add(topLine2);
  if (m.led) { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, H + 0.2, 0.03), (x + z) ? ledA : ledB); p.position.set(x * (W / 2 + 0.15), H / 2, z * (D / 2 + 0.15)); g.add(p); } }
  const railGeo = new THREE.BoxGeometry(0.08, 0.08, D);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(railGeo, matSteel); r.position.set(s * (W / 2 - 0.1), H - 0.1, 0); g.add(r); }
  beamMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.1, 0.16), matSteel); beamMesh.position.set(0, H - 0.18, m.home.z); beamMesh.castShadow = true; g.add(beamMesh);
  cableMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), matSteel); g.add(cableMesh);
  // soft claw shadow blob on the floor (always-visible aim aid, in addition to real shadows)
  shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ color: 0x302a4a, transparent: true, opacity: 0.28, depthWrite: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.006; g.add(shadowBlob);
  // GET zone wireframe (debug)
  if (m.kind !== "bridge" && !tako) { const gz = new THREE.Mesh(new THREE.BoxGeometry(ch.w, cd, ch.d), matDebug); gz.position.set(ch.cx, -cd / 2, ch.cz); debugGroup.add(gz); }

  clawHead = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m.home.x, m.home.y, m.home.z));
  if (!tako) {
  clawColliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(0.26, 0.13, 0.18).setFriction(0.5).setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE)), clawHead));
  clawColliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.14, 0.14).setTranslation(0, -0.26, 0).setFriction(0.3).setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE)), clawHead));
  }
  headMesh = new THREE.Group();
  if (!tako && m.claws === 3) {
    // 3-claw: round white head (fingers hang from its rim) + vertical shaft up to the gantry
    const white = new THREE.MeshStandardMaterial({ color: 0xfff7fa, roughness: 0.4 }); const pinkM = new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.5 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.3, 40), white); disc.castShadow = true; headMesh.add(disc);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.y = 0.15; dome.scale.y = 0.45; headMesh.add(dome);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 12, 48), pinkM); band.rotation.x = Math.PI / 2; band.position.y = -0.02; headMesh.add(band);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.1, 40), pinkM); under.position.y = -0.2; headMesh.add(under);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16), matSteel); shaft.position.y = 0.8; headMesh.add(shaft);
  } else if (!tako) {
    const hm = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.36), matCabinet); hm.castShadow = true; headMesh.add(hm);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.38), glowPink); hl.position.y = -0.02; headMesh.add(hl);
  }
  if (!tako && m.claws !== 3) { const palm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.28), matCabinet); palm.position.y = -0.26; palm.castShadow = true; headMesh.add(palm); }
  g.add(headMesh);
  buildArcadeSurround(m, g);
  if (!tako) { if (m.claws === 3) for (const yaw of [Math.PI / 2, Math.PI / 2 + Math.PI * 2 / 3, Math.PI / 2 - Math.PI * 2 / 3]) buildFinger(m, 1, g, yaw); else for (const side of [-1, 1]) buildFinger(m, side, g); }
  fitCamera();
}

// Bridge: two parallel bars spanning the case along x, over an open pit. Bars are exact static cylinders; the pit is the chute.
let bridgeBars               = [];
function buildBridge(m               , g             ) {
  const b = m.bridge ; const W = m.caseW, D = m.caseD;
  bridgeBars = [];
  const cafe = m.theme === "cafe";
  const matBar = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.3, metalness: 0.75 });
  const matCap = new THREE.MeshStandardMaterial({ color: 0xf29bc0, roughness: 0.35, metalness: 0.3 });
  for (const sd of [-1, 1]) {
    const z = b.zCenter + sd * (b.gap / 2 + b.barR);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, b.barY, z).setRotation(qz(Math.PI / 2)));
    const col = world.createCollider(RAPIER.ColliderDesc.cylinder(b.barLen / 2, b.barR).setFriction(b.friction).setRestitution(0.02), body);
    bridgeColliders.push(col);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(b.barR, b.barR, b.barLen, 20), matBar); mesh.rotation.z = Math.PI / 2; mesh.position.set(0, b.barY, z); mesh.castShadow = true; g.add(mesh); bridgeBars.push(mesh);
    // bar supports at both ends
    for (const ex of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, b.barY + m.chute.depth, 0.12), cafe ? matCafeWhite : matCabinet); post.position.set(ex * (b.barLen / 2 + 0.06), (b.barY - m.chute.depth) / 2, z); g.add(post);
      if (cafe) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(b.barR + 0.03, b.barR + 0.03, 0.16, 20), matCap); cap.rotation.z = Math.PI / 2; cap.position.set(ex * (b.barLen / 2 - 0.08), b.barY, z); g.add(cap); } }
    const dbgBar = new THREE.Mesh(new THREE.CylinderGeometry(b.barR, b.barR, b.barLen, 10), matDebug); dbgBar.rotation.z = Math.PI / 2; dbgBar.position.copy(mesh.position); debugGroup.add(dbgBar);
  }
  // floor in front of / behind the bars is solid (a box knocked off the outside just lands there); only the slot under the gap drops into the pit
  const slotZ0 = b.zCenter - b.gap / 2 - b.barR, slotZ1 = b.zCenter + b.gap / 2 + b.barR;
  const t = 0.1;
  void slotZ0; void slotZ1; void t;
  // the whole base under the bars is the drop pit (as on real bridge machines): a box pushed off either side is a win too
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: cafe ? 0xfff4f6 : 0x3a3358, roughness: 1 })); pit.rotation.x = -Math.PI / 2; pit.position.y = -m.chute.depth; pit.receiveShadow = true; g.add(pit);
  const rimMat = cafe ? matCap : glowMint;
  for (const sd of [-1, 1]) { const rimZ = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, 0.06), rimMat); rimZ.position.set(0, 0.0, sd * (D / 2 - 0.03)); g.add(rimZ); const rimX = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, D), rimMat); rimX.position.set(sd * (W / 2 - 0.03), 0.0, 0); g.add(rimX); }
  if (cafe) {
    // low display shelf right behind the back bar (stock boxes stand on it), white with a pink lace edge
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.08, 1.0), matCafeWhite); shelf.position.set(0, 0.98, -D / 2 + 0.55); shelf.receiveShadow = true; g.add(shelf);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.05, 0.03), matCap); lace.position.set(0, 0.98, -D / 2 + 1.06); g.add(lace);
    for (let i = 0; i < 12; i++) { const sc = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), matCafeWhite); sc.position.set(-W / 2 + 0.3 + i * (W - 0.6) / 11, 0.93, -D / 2 + 1.07); g.add(sc); }
    // Keep the café booth walls clear; no decorative wall dressing.
  } else {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.08, 0.9), matCabinet); shelf.position.set(0, 1.9, -D / 2 + 0.5); shelf.receiveShadow = true; g.add(shelf);
    const shelfLed = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.03, 0.03), glowMint); shelfLed.position.set(0, 1.86, -D / 2 + 0.96); g.add(shelfLed);
  }
  // a glowing GET line at bar level shows the drop zone
  const zone = new THREE.Mesh(new THREE.BoxGeometry(b.barLen, 0.01, b.gap), new THREE.MeshBasicMaterial({ color: cafe ? 0xffb6c9 : PALETTE.mint, transparent: true, opacity: 0.12, depthWrite: false })); zone.position.set(0, -0.6, b.zCenter); g.add(zone);
  // debug GET plane (box centre must fall below this)
  const gz = new THREE.Mesh(new THREE.BoxGeometry(b.barLen, 0.02, b.gap + 2 * b.barR), matDebug); gz.position.set(0, b.barY - b.barR - 0.02, b.zCenter); debugGroup.add(gz);
}
const bridgeColliders                    = [];
const matCafeWhite = new THREE.MeshStandardMaterial({ color: 0xfffaf7, roughness: 0.55 });
// Café goods booth interior: strawberry-milk pink / white / cream / beige, gingham + lace bands, ribbons, strawberries, a bear and a cake on the side walls.
// Visual only (no colliders); play field left clear so claw / bars / box stay readable.
function buildCafeDressing(m               , g             ) {
  const W = m.caseW, D = m.caseD, H = m.caseH;
  const pink = new THREE.MeshStandardMaterial({ color: 0xffd1dc, roughness: 0.8 });
  const deepPink = new THREE.MeshStandardMaterial({ color: 0xf29bc0, roughness: 0.6 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.85 });
  const beige = new THREE.MeshStandardMaterial({ color: 0xead9c8, roughness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe6485f, roughness: 0.5 });
  const green = new THREE.MeshStandardMaterial({ color: 0x7bbf6a, roughness: 0.7 });
  const brown = new THREE.MeshStandardMaterial({ color: 0xb5794a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2418 });
  const white = matCafeWhite;
  const gingham = (w        , h        , ox        , oy        , place                            ) => {
    const s = 0.16; const nx = Math.floor(w / s), ny = Math.floor(h / s);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(s, s), (i + j) % 2 ? pink : white); q.position.set(ox + i * s + s / 2, oy + j * s + s / 2, 0); place(q); }
  };
  for (const sd of [-1, 1]) {
    const wall = new THREE.Group(); wall.position.set(sd * (W / 2 - 0.015), 0, 0); wall.rotation.y = -sd * Math.PI / 2; g.add(wall);
    gingham(D - 0.2, 0.7, -D / 2 + 0.1, 0.05, q => wall.add(q));
    const laceLine = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.2, 0.06), deepPink); laceLine.position.set(0, 0.78, 0.002); wall.add(laceLine);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.2, H - 1.0), cream); panel.position.set(0, 0.85 + (H - 1.0) / 2, 0.001); wall.add(panel);
    const bow = new THREE.Group(); bow.position.set(sd * 0.6, 3.6, 0.03); wall.add(bow);
    for (const k of [-1, 1]) { const loop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), deepPink); loop.scale.set(1.3, 0.8, 0.3); loop.position.x = k * 0.19; bow.add(loop); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.03), deepPink); tail.position.set(k * 0.12, -0.3, 0); tail.rotation.z = -k * 0.35; bow.add(tail); }
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), red));
    for (const [x, y] of [[-1.1, 2.4], [-0.5, 3.1], [1.2, 2.6], [0.4, 4.2]]) { const sb = new THREE.Group(); sb.position.set(x, y, 0.06); wall.add(sb); const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), red); body.scale.set(1, 1.2, 0.5); sb.add(body); const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 5), green); leaf.position.y = 0.2; leaf.rotation.x = Math.PI; sb.add(leaf); for (let i = 0; i < 6; i++) { const seed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), cream); seed.position.set(-0.08 + (i % 3) * 0.08, -0.08 + Math.floor(i / 3) * 0.12, 0.085); sb.add(seed); } }
    if (sd < 0) { const bear = new THREE.Group(); bear.position.set(0.9, 3.7, 0.06); wall.add(bear); const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), brown); head.scale.z = 0.45; bear.add(head); for (const k of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), brown); ear.position.set(k * 0.22, 0.22, 0); ear.scale.z = 0.4; bear.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark); eye.position.set(k * 0.1, 0.04, 0.13); bear.add(eye); } const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), cream); muzzle.position.set(0, -0.08, 0.12); muzzle.scale.z = 0.5; bear.add(muzzle); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark); nose.position.set(0, -0.05, 0.18); bear.add(nose); }
    else { const cake = new THREE.Group(); cake.position.set(-0.9, 3.6, 0.06); wall.add(cake); [cream, deepPink, cream].forEach((mm, i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), mm); l.position.y = i * 0.12; cake.add(l); }); const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), red); top.position.set(0, 0.42, 0); top.scale.set(1, 1.2, 0.6); cake.add(top); const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24), white); plate.position.y = -0.08; plate.scale.z = 0.4; cake.add(plate); }
  }
  const backSkirt = new THREE.Group(); backSkirt.position.set(0, 0, -D / 2 + 0.02); g.add(backSkirt);
  gingham(W - 0.1, 0.9, -W / 2 + 0.05, 0.02, q => backSkirt.add(q));
  const skirtLine = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.06), deepPink); skirtLine.position.set(0, 0.95, 0.002); backSkirt.add(skirtLine);
  for (let i = 0; i < 14; i++) { const sc = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), white); sc.position.set(-W / 2 + 0.2 + i * (W - 0.4) / 13, H - 0.12, 0.004); backSkirt.add(sc); }
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.62, 0.22, 0.06), deepPink); lip.position.set(0, -0.12, D / 2 + 0.31); g.add(lip);
  const lip2 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.62, 0.5, 0.05), beige); lip2.position.set(0, -0.5, D / 2 + 0.31); g.add(lip2);
}
let boxTexFront                       = null, boxTexSide                       = null;
// user-supplied box sheet (front | side | back, 1536×1024): each face is a UV window into the same image, no repainting
// per-prize box sheets (user-supplied, front | side | back windows into one image; never repainted)
// window = [x0, x1] or [x0, x1, y0, y1] (per-face y range when the reference photo shows lids / labels outside the face)
                                                                  
const BOX_SHEETS                                                                                                                            = {
  figure: { file: "assets/figure-box-sheet.webp", W: 1536, H: 1024, y0: 95, y1: 975, front: [22, 575], side: [610, 905], back: [962, 1515] },
  // reference photo: package faces only — lids, marble table and the 正面/背面/側面 labels are outside these rects.
  // windows are centre-cropped to the box face aspect (w:h 0.54:0.6 front/back, 0.32:0.6 side) — never stretched
  cake_set: { file: "assets/cake-plate-box-sheet.webp", W: 1536, H: 1024, y0: 118, y1: 860, front: [24, 606, 166, 812], side: [1334, 1524, 313, 669], back: [652, 1266, 135, 817] },
  // B. Strawberry Parfait (user-supplied sheet, same 1536×1024 layout): front | back | side, labels/marble table excluded, windows centre-cropped to the box face aspect
  cake_parfait: { file: "assets/cake-parfait-box-sheet.webp", W: 1536, H: 1024, y0: 145, y1: 798, front: [24, 612, 145, 798], side: [1315, 1520, 301, 685], back: [665, 1232, 158, 788] },
  noctis: { file: "assets/noctis-box-sheet.webp", W: 1223, H: 1286, y0: 60, y1: 1250, front: [15, 470], side: [490, 715], back: [745, 1205] },
};
const boxTexCache                                                                                     = {};
function boxTextures(prizeId = "figure") {
  const S = BOX_SHEETS[prizeId] ?? BOX_SHEETS.figure;
  if (!boxTexCache[prizeId]) {
    const win = ([x0, x1, wy0 = S.y0, wy1 = S.y1]        ) => { const t = texLoader.load(S.file); t.colorSpace = THREE.SRGBColorSpace; t.offset.set(x0 / S.W, 1 - wy1 / S.H); t.repeat.set((x1 - x0) / S.W, (wy1 - wy0) / S.H); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
    boxTexCache[prizeId] = { front: win(S.front), side: win(S.side), back: win(S.back) };
  }
  return boxTexCache[prizeId];
}
function buildBoxVisual(bw        , bh        , bd        , prizeId = currentMachine?.prizeId ?? "figure")             {
  const t = boxTextures(prizeId);
  const face = (tex               ) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.02 });
  const side = face(t.side), front = face(t.front), back = face(t.back);
  const sideL = new THREE.MeshStandardMaterial({ map: t.side.clone(), roughness: 0.45, metalness: 0.02 }); (sideL.map                 ).repeat.x *= -1; (sideL.map                 ).offset.x += t.side.repeat.x; // mirrored for the left face
  const plain = new THREE.MeshStandardMaterial({ color: 0xe9dcff, roughness: 0.5 });
  // BoxGeometry order: +X right, -X left, +Y top, -Y bottom, +Z front, -Z back
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [side, sideL, plain, plain, front, back]);
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
// rigid box prize: collider == visual box exactly
function buildBoxPrize(def          , m               )        {
  const bx = m.bridge .box; const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rot[0], def.rot[1], def.rot[2]));
  // cake bridge mixes two box designs 50/50; every other bridge machine has a single design
  const boxType = m.prizeId === "cake_set" ? (Math.random() < 0.5 ? "cake_set" : "cake_parfait") : m.prizeId;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(def.pos[0], def.pos[1], def.pos[2]).setRotation({ x: q0.x, y: q0.y, z: q0.z, w: q0.w })
    .setLinearDamping(0.2).setAngularDamping(0.3).setCcdEnabled(true).setCanSleep(true));
  const col = world.createCollider(RAPIER.ColliderDesc.cuboid(bx.w / 2, bx.h / 2, bx.d / 2).setDensity(4.0 * def.weight).setFriction(def.friction).setRestitution(0.03)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW)), body);
  const mesh = new THREE.Group(); mesh.add(buildBoxVisual(bx.w, bx.h, bx.d, boxType)); scene.add(mesh);
  const dbg = new THREE.Group(); dbg.userData.follow = mesh; dbg.add(new THREE.Mesh(new THREE.BoxGeometry(bx.w, bx.h, bx.d), matDebug)); debugGroup.add(dbg);
  // containment parts: 8 corners as tiny spheres (used by the generic chute test; bridge uses its own rule)
  const parts              = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const c = new THREE.Vector3(sx * bx.w / 2, sy * bx.h / 2, sz * bx.d / 2); parts.push({ a: c, b: c.clone(), r: 0 }); }
  return { sweetType: boxType, def, body, mesh, parts, got: false, safe: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]), safeQ: q0.clone(), inChuteT: 0, prevVel: 0, colliderHandles: new Set([col.handle]), colliders: [col], safeT: 0 };
}
// rebuild a box mesh's faces for its assigned type (used when a saved layout restores per-box types)
function reboxMesh(p       , type        ) {
  const bx = currentMachine.bridge .box; p.mesh.clear(); p.mesh.add(buildBoxVisual(bx.w, bx.h, bx.d, type));
}
// stock boxes: static display on the back shelf, no physics
let stockMeshes               = [];
function updateStock() {
  const m = currentMachine; if (m.kind !== "bridge") return;
  for (const s of stockMeshes) machineGroup?.remove(s); stockMeshes = [];
  const bx = m.bridge .box; const rest = prizes.filter(p => !p.got && p !== activeBox());
  for (let i = 0; i < rest.length; i++) {
    const mesh = buildBoxVisual(bx.w, bx.h, bx.d, rest[i].sweetType ?? m.prizeId);
    if (m.theme === "cafe") {
      // café booth: a neat upright display row on the low shelf right behind the back bar (front faces toward the player)
      const cols = Math.min(rest.length, 5); const pitch = bx.w + 0.14; const x0 = -(cols - 1) * pitch / 2;
      const col = i % cols, row = Math.floor(i / cols);
      mesh.position.set(x0 + col * pitch, 1.02 + bx.h / 2 + row * (bx.h + 0.02), -m.caseD / 2 + 0.55 + row * 0.0); mesh.rotation.y = 0;
    } else { mesh.position.set(-0.9 + i * 1.0, 1.94 + bx.h / 2, -m.caseD / 2 + 0.5); mesh.rotation.y = 0.1 - i * 0.1; }
    machineGroup?.add(mesh); stockMeshes.push(mesh);
  }
}
// ---- staff restock: a hand + uniform sleeve carries the next stock box from the shelf to the bridge start pose (physics off until placed)
let staffHand                     = null;
let restock                                                                                                                                                   = null;
const RESTOCK = { enter: 0.5, carry: 1.1, release: 0.3, exit: 0.5, hold: 0.45 }         ;
let restockHold                                 = null;
function restockHoldTick(dt        ) {
  if (!restockHold) return;
  const p = restockHold.p; placeOnBridge(p); restockHold.t -= dt;
  if (restockHold.t <= 0) { p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); placeOnBridge(p); restockHold = null; saveLayout(); }
}
function buildStaffHand()              {
  // adult human hand + forearm, sized to the figure box (box w 0.6 → hand ≈0.35 wide). Group origin = palm centre;
  // the forearm runs along +X so the root stays off the right edge of the screen (the staff stands outside the cabinet).
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9ad, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xfaf7ff, roughness: 0.85 });
  const pink = new THREE.MeshStandardMaterial({ color: PALETTE.pink, roughness: 0.7 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.4), skin); g.add(palm);
  // four fingers curl over the top edge of the box (toward −X), thumb hooks under the bottom
  for (let i = 0; i < 4; i++) {
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.14, 4, 10), skin); seg1.rotation.z = Math.PI / 2; seg1.position.set(-0.12, 0.19, -0.14 + i * 0.095); g.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 10), skin); seg2.rotation.z = Math.PI / 2 - 0.9; seg2.position.set(-0.25, 0.12, -0.14 + i * 0.095); g.add(seg2);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.16, 4, 10), skin); thumb.rotation.z = Math.PI / 2; thumb.rotation.y = 0.35; thumb.position.set(-0.12, -0.18, 0.08); g.add(thumb);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 16), skin); wrist.rotation.z = Math.PI / 2; wrist.position.set(0.17, 0, 0); g.add(wrist);
  // shirt sleeve with a PRIZE PARK pink cuff and a pink piping line, long enough that the elbow end never enters the frame
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 16), pink); cuff.rotation.z = Math.PI / 2; cuff.position.set(0.35, 0, 0); g.add(cuff);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 3.8, 16), shirt); sleeve.rotation.z = Math.PI / 2; sleeve.position.set(0.42 + 1.9, 0, 0); g.add(sleeve);
  const pipe = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.025, 0.06), pink); pipe.position.set(0.45 + 1.85, 0.2, 0.03); g.add(pipe);
  g.traverse(o => { const mm = o              ; mm.castShadow = true; mm.renderOrder = 50; });
  g.rotation.y = -0.55; // forearm angles toward the viewer: the root exits the frame at the front-right, not behind the side pillar
  return g;
}
function startRestock(p       ) {
  const m = currentMachine; if (m.kind !== "bridge") return;
  const bx = m.bridge .box; const d = p.def;
  if (!staffHand) { staffHand = buildStaffHand(); }
  scene.add(staffHand); staffHand.visible = true;
  const stockIdx = 0; const stockMesh = stockMeshes[stockIdx];
  const from = stockMesh ? stockMesh.position.clone() : new THREE.Vector3(-0.9, 1.94 + bx.h / 2, -m.caseD / 2 + 0.5);
  const fromRot = stockMesh ? stockMesh.rotation.y : 0.1;
  if (stockMesh) { machineGroup?.remove(stockMesh); stockMeshes.splice(stockIdx, 1); }
  const box = buildBoxVisual(bx.w, bx.h, bx.d, p.sweetType ?? m.prizeId); box.position.copy(from); box.rotation.y = fromRot; scene.add(box);
  const toQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(d.rot[0], d.rot[1], d.rot[2]));
  restock = { p, t: 0, box, from, fromRot, to: new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]), toQ, placed: false };
  crane.phase = "restock"; updateStep();
  $("restockMsg").textContent = T("restocking"); $("restockMsg").classList.remove("hidden");
}
function restockTick(dt        ) {
  if (!restock || !staffHand) return;
  const r = restock; r.t += dt; const m = currentMachine; const bx = m.bridge .box;
  const T0 = RESTOCK.enter, T1 = T0 + RESTOCK.carry, T2 = T1 + RESTOCK.release, T3 = T2 + RESTOCK.exit;
  // hand grips the box's right side face; the arm enters/leaves horizontally from beyond the right edge of the screen
  const grip = (boxPos               ) => boxPos.clone().add(new THREE.Vector3(bx.w / 2 + 0.05, 0.02, 0));
  const holdFrom = grip(r.from), holdTo = grip(r.to);
  const offscreen = new THREE.Vector3(m.caseW / 2 + 2.6, holdFrom.y, holdFrom.z + 1.6);
  const released = holdTo.clone().add(new THREE.Vector3(0.45, 0.06, 0));
  let hp               ;
  if (r.t < T0) { hp = offscreen.clone().lerp(holdFrom, ease(r.t / T0)); }
  else if (r.t < T1) {
    const k = ease((r.t - T0) / RESTOCK.carry);
    const pos = r.from.clone().lerp(r.to, k); pos.y += Math.sin(k * Math.PI) * 0.25; // small lift so the box clears the bars, otherwise horizontal
    r.box.position.copy(pos);
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.fromRot, 0)); r.box.quaternion.copy(q0.slerp(r.toQ, k));
    hp = grip(pos);
  } else if (r.t < T2) {
    if (!r.placed) { r.placed = true; r.box.position.copy(r.to); r.box.quaternion.copy(r.toQ); }
    hp = holdTo.clone().lerp(released, ease((r.t - T1) / RESTOCK.release));
  } else if (r.t < T3) { hp = released.clone().lerp(new THREE.Vector3(offscreen.x, released.y, released.z + 1.6), ease((r.t - T2) / RESTOCK.exit)); }
  else {
    scene.remove(r.box); staffHand.visible = false; scene.remove(staffHand);
    // the real body takes over at exactly the machine's start pose (same position / rotation as the game-start box);
    // it stays kinematic for a short hold so it cannot roll or flip while the hand withdraws, then goes dynamic at rest
    unparkPrize(r.p); placeOnBridge(r.p); r.p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); placeOnBridge(r.p);
    restockHold = { p: r.p, t: RESTOCK.hold };
    restock = null; saveLayout(); updateStock();
    crane.phase = "ready"; crane.t = 0; updateStep();
    $("restockMsg").textContent = T("readyOk"); setTimeout(() => { if (crane.phase !== "restock") $("restockMsg").classList.add("hidden"); }, 1200);
    void sfx("crane.confirm");
    return;
  }
  staffHand.position.copy(hp);
  staffHand.rotation.set(0, -0.55, 0.06); // nearly horizontal forearm pointing out toward the front-right of the screen
}
// the box currently on the bridge = first un-got prize; the others stay parked until refill
function activeBox()                    { return prizes.find(p => !p.got && p.body.isEnabled()); }
function bridgeSetup() {
  // only the first remaining box is live on the bars; others are parked (physics off) and shown as stock
  let live = false;
  for (const p of prizes) { if (p.got) continue; if (!live) { live = true; if (!p.body.isEnabled()) { unparkPrize(p); placeOnBridge(p); } } else if (p.body.isEnabled()) { p.body.setEnabled(false); for (const c of p.colliders) c.setEnabled(false); p.mesh.visible = false; p.body.setTranslation({ x: 0, y: -40 - 3 * prizes.indexOf(p), z: 0 }, false); } }
  updateStock();
}
function placeOnBridge(p       ) {
  const d = p.def; p.body.setTranslation({ x: d.pos[0], y: d.pos[1], z: d.pos[2] }, true);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d.rot[0], d.rot[1], d.rot[2])); p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp(); p.inChuteT = 0;
}
// bridge GET: the box centre has dropped below the bars (most of the body through the gap) and keeps falling / lands in the pit
function setBridgeGap(gap        ) {
  const b = currentMachine.bridge ;
  bridgeColliders.forEach((c, i) => { const sd = i ? 1 : -1; const z = b.zCenter + sd * (gap / 2 + b.barR); c.parent()?.setTranslation({ x: 0, y: b.barY, z }, true); bridgeBars[i].position.z = z; });
}
function boxThroughBridge(p       , m               )          {
  const b = m.bridge ; const t = p.body.translation();
  return t.y < -0.3 && Math.abs(t.x) < m.caseW / 2;
}

// Arcade surround: floor, far backdrop, neighbour cabinets, ceiling lights and a signboard on this cabinet — visuals only, no colliders.
// ================= TAKOYAKI CATCHER =================
// Own game: a spoon scoops real ping-pong balls from a pool, tips them over a takoyaki plate; one of 12 cups is the GET hole.
// Balls that land in normal cups stay there between plays (plate fills up → GET gets likelier); a GET clears the plate.
const TAKO = {
  pool: { x0: -2.3, x1: -0.7, z0: -1.1, z1: 1.1, wallH: 1.1 },   // ball pool box (left third of the case)
  // round takoyaki plate: 12 cups = 4 inner ring + 8 outer ring (radial layout). cupDepth ≈ ball radius so a settled ball shows its top half
  // hex-packed 18 cups (rows 3-4-5-4-3 minus centre → like a real 18-hole takoyaki pan); pitch = cup diameter + thin wall
  plate: { cx: 1.05, cz: 0.0, R: 1.0, cupR: 0.15, top: 0.42, depth: 0.1, pitch: 0.345, rings: []                       },
  drop: { x: 1.05, z: 0.0, y: 2.15 },                             // plate centre (reference only: actual drop XZ is mapped from the player's aim, see dropPoint)
  ballR: 0.1, balls: 230, getIdx: 5, stock: 3,
  // big 4-claw cage: round head, long curved fingers. openAng/closeAng = finger swing from vertical; closed leaves a gap so balls sit in the cage
  // big 4-arm cage (reference: real takoyaki catcher). Each arm is a flat steel bar: flares OUT from the disc rim, runs DOWN, then hooks IN under the balls.
  // Local frame per arm: origin = pivot on the disc rim, -Y down, +X radially outward. pts = polyline of the arm; tilt swings the whole arm about Z (+ = outward).
  // TWO wide flat scoop arms (left/right of the disc, reference: real takoyaki catcher): each is a broad steel plate that flares out, drops, and bends inward at the tip
  claw: { headR: 0.56, headH: 0.26, pivotR: 0.4, barW: 0.62, barT: 0.05, pts: [[0, 0], [0.12, -0.4], [0.12, -0.95], [-0.3, -1.22]]                      , openAng: 0.28, closeAng: -0.02, n: 2 },
}         ;
                                                                           
let balls         = []; let takoStock               = []; let spoonMesh                     = null; let spoonBody                          = null; let takoFingers                                                               = [];
// the player's aim over the pool maps 1:1 onto the plate: left/right/front/back of the pool → same side of the plate (always inside the cup grid)
let dropXZ = { x: TAKO.drop.x, z: TAKO.drop.z };
function dropPoint(m               ) {
  const P = TAKO.plate; const kx = (crane.x - m.home.x) / (m.limits.xMax - m.home.x), kz = (crane.z - m.limits.zMin) / (m.home.z - m.limits.zMin);
  const hx = P.R * 0.68, hz = P.R * 0.68; // square inscribed in the round plate
  return { x: P.cx - hx + Math.min(1, Math.max(0, kx)) * 2 * hx, z: P.cz - hz + Math.min(1, Math.max(0, kz)) * 2 * hz };
}
let takoCups                                               = []; let takoFilled           = []; let takoScooped = 0; let takoTilt = 0;
const takoStateOf = (id        ) => { if (id === "takoyaki") return save.tako ?? (save.tako = { filled: [], got: 0 }); const T2 = save.takos ?? (save.takos = {}); return T2[id] ?? (T2[id] = { filled: [], got: 0 }); };
const takoState = () => takoStateOf(currentMachine.id);
const takoGetPos = () => { const c = takoCups[TAKO.getIdx]; return { x: c.x, z: c.z }; };
const CUP_LAYOUT                     = (() => { const out                     = []; const rows = [3, 4, 5, 4, 3]; rows.forEach((n, ri) => { const z = (ri - 2) * 0.866; for (let c = 0; c < n; c++) { const x = (c - (n - 1) / 2); if (ri === 2 && c === 2) return; out.push([x, z]); } }); return out; })();
const CUP_N = CUP_LAYOUT.length; // 18
function cupCentre(i        ) { const P = TAKO.plate; const [ux, uz] = CUP_LAYOUT[i]; return { x: P.cx + ux * P.pitch, z: P.cz + uz * P.pitch }; }
function buildTakoyaki(m               , g             ) {
  const P = TAKO.plate, B = TAKO.pool;
  // --- ball pool: floor + four low walls (physics), pastel tub (visual)
  const pw = (B.x1 - B.x0) / 2, pd = (B.z1 - B.z0) / 2, pcx = (B.x0 + B.x1) / 2, pcz = (B.z0 + B.z1) / 2;
  fixedBox(pw, 0.05, pd, pcx, 0.0, pcz, 0.6);
  fixedBox(0.04, B.wallH / 2, pd, B.x0 - 0.04, B.wallH / 2, pcz, 0.3); fixedBox(0.04, B.wallH / 2, pd, B.x1 + 0.04, B.wallH / 2, pcz, 0.3);
  fixedBox(pw + 0.08, B.wallH / 2, 0.04, pcx, B.wallH / 2, B.z0 - 0.04, 0.3); fixedBox(pw + 0.08, B.wallH / 2, 0.04, pcx, B.wallH / 2, B.z1 + 0.04, 0.3);
  const tubMat = new THREE.MeshStandardMaterial({ color: 0x7de2d1, roughness: 0.5, transparent: true, opacity: 0.55 });
  for (const [sx, sz, x, z] of [[0.04, pd + 0.08, B.x0 - 0.04, pcz], [0.04, pd + 0.08, B.x1 + 0.04, pcz], [pw + 0.08, 0.04, pcx, B.z0 - 0.04], [pw + 0.08, 0.04, pcx, B.z1 + 0.04]]              ) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(sx * 2, B.wallH, sz * 2), tubMat); w.position.set(x, B.wallH / 2, z); g.add(w);
  }
  const tubFloor = new THREE.Mesh(new THREE.BoxGeometry(pw * 2, 0.06, pd * 2), new THREE.MeshStandardMaterial({ color: 0x5cc7f5, roughness: 0.7 })); tubFloor.position.set(pcx, 0.03, pcz); g.add(tubFloor);
  // --- round takoyaki plate: thick white/pink disc with 19 shallow radial cups (real recesses cut in the extruded disc)
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xfff7fa, roughness: 0.45 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffb8d0, roughness: 0.55 });
  const sh = new THREE.Shape(); sh.absarc(0, 0, P.R, 0, Math.PI * 2, false);
  for (let i = 0; i < CUP_N; i++) { const c = cupCentre(i); const hp = new THREE.Path(); hp.absarc(c.x - P.cx, -(c.z - P.cz), P.cupR, 0, Math.PI * 2, true); sh.holes.push(hp); }
  const slabGeo = new THREE.ExtrudeGeometry(sh, { depth: P.top, bevelEnabled: false, curveSegments: 48 }); slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, plateMat); slab.position.set(P.cx, 0, P.cz); slab.castShadow = slab.receiveShadow = true; g.add(slab);
  // pink base + rounded raised rim (visual torus, physics = ring of boxes)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(P.R + 0.16, P.R + 0.22, 0.14, 64), pinkMat); base.position.set(P.cx, 0.07, P.cz); base.receiveShadow = true; g.add(base);
  const rimH = 0.22, rimR = P.R + 0.05;
  const rimV = new THREE.Mesh(new THREE.TorusGeometry(rimR, rimH / 2, 14, 72), pinkMat); rimV.rotation.x = Math.PI / 2; rimV.position.set(P.cx, P.top + rimH / 2 - 0.02, P.cz); rimV.castShadow = true; g.add(rimV);
  const rimWall = new THREE.Mesh(new THREE.CylinderGeometry(rimR + 0.03, rimR + 0.06, P.top + rimH / 2, 64, 1, true), pinkMat); rimWall.position.set(P.cx, (P.top + rimH / 2) / 2, P.cz); g.add(rimWall);
  const RS = 36;
  for (let k = 0; k < RS; k++) { const a = (k / RS) * Math.PI * 2; const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(P.cx + Math.cos(a) * rimR, P.top + rimH / 2, P.cz + Math.sin(a) * rimR)); const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a); rb.setRotation({ x: qq.x, y: qq.y, z: qq.z, w: qq.w }, true); world.createCollider(RAPIER.ColliderDesc.cuboid(0.06, rimH / 2, Math.PI * rimR / RS * 1.1).setFriction(0.4).setRestitution(0.3), rb); }
  // plate top physics: flat disc (balls roll on it) with cup funnels below each hole
  // plate surface with real holes: trimesh of the extruded slab (only the top cap matters for rolling balls)
  // physics plate = one solid disc up to the rim height: balls can never tunnel into the body; the cup magnet/lock places balls into cups
  { const tb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(P.cx, P.top / 2, P.cz)); world.createCollider(RAPIER.ColliderDesc.cylinder(P.top / 2, P.R + 0.02).setFriction(0.45).setRestitution(0.3), tb); }
  fixedBox(P.R, 0.04, P.R, P.cx, -0.04, P.cz, 0.9);
  takoCups = [];
  for (let i = 0; i < CUP_N; i++) {
    const c = cupCentre(i); const isGet = i === TAKO.getIdx;
    // real socket: a shallow bevel ABOVE the rim (so a ball landing on the ridge between cups rolls into the nearest one)
    // plus a deep funnel below it — the ball sinks so only its top half shows
    const segs = 12;
    const slat = (rOut        , rIn        , yTop        , h        , fr        ) => {
      for (let k = 0; k < segs; k++) {
        const a2 = ((k + 0.5) / segs) * Math.PI * 2; const rm = (rOut + rIn) / 2, tilt = Math.atan2(rOut - rIn, h), len = Math.hypot(rOut - rIn, h);
        const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(c.x + Math.cos(a2) * rm, yTop - h / 2, c.z + Math.sin(a2) * rm));
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a2, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 - tilt));
        rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        void rb; void len; void q; void fr; // colliders intentionally omitted: solid disc + lock-in handle the physics
      }
    };
    slat(P.pitch / 2 * 1.04, P.cupR, P.top + 0.045, 0.045, 0.15);        // bevel ridge (slippery → balls roll into the hole)
    slat(P.cupR * 1.02, P.cupR * 0.42, P.top, P.depth, 0.5);           // funnel
    const bevelV = new THREE.Mesh(new THREE.CylinderGeometry(P.pitch / 2 * 1.04, P.cupR, 0.045, 24, 1, true), plateMat); bevelV.position.set(c.x, P.top + 0.0225, c.z); g.add(bevelV);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(P.cupR * 0.99, P.cupR * 0.42, P.depth, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3e1ea, roughness: 0.7, side: THREE.DoubleSide })); bowl.position.set(c.x, P.top - P.depth / 2 + 0.001, c.z); g.add(bowl);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(P.cupR * 0.42, 20), new THREE.MeshStandardMaterial({ color: 0xeacfd9 })); bottom.rotation.x = -Math.PI / 2; bottom.position.set(c.x, P.top - P.depth + 0.002, c.z); g.add(bottom);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(P.cupR * 1.02, isGet ? 0.04 : 0.014, 10, 40), isGet ? new THREE.MeshStandardMaterial({ color: 0xff3d7a, emissive: 0xff3d7a, emissiveIntensity: 1.4, roughness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0xe6d3dc, roughness: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(c.x, P.top + 0.05, c.z); g.add(ring);
    if (isGet) {
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const cx2 = cv.getContext("2d") ;
      cx2.fillStyle = "#ff3d7a"; cx2.font = "900 96px sans-serif"; cx2.textAlign = "center"; cx2.textBaseline = "middle"; cx2.fillText("GET", 128, 64);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); label.rotation.x = -Math.PI / 2; label.position.set(c.x, P.top + 0.02, c.z + P.cupR + 0.1); g.add(label);
    }
    takoCups.push({ x: c.x, z: c.z, ring });
  }
  // low lip around the plate so balls rolling off the edge fall to the floor (they become dead balls, swept back to the pool next play)
  // --- figure stock on the back shelf (display only)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(m.caseW - 0.2, 0.08, 0.7), matCabinet); shelf.position.set(0, 2.6, -m.caseD / 2 + 0.4); g.add(shelf);
  takoStock = [];
  const bxm = MACHINES.find(x => x.kind === "bridge") .bridge .box;
  for (let i = 0; i < TAKO.stock; i++) { const mesh = buildBoxVisual(bxm.w, bxm.h, bxm.d); mesh.position.set(-1.0 + i * 1.0, 2.64 + bxm.h / 2, -m.caseD / 2 + 0.4); mesh.rotation.y = 0.12 * (i - 1); g.add(mesh); takoStock.push(mesh); }
  updateTakoStock();
  // --- big claw: kinematic round head + 4 long kinematic fingers hanging from its rim (posed every tick, no motors)
  const C = TAKO.claw;
  spoonBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m.home.x, m.home.y - 0.3, m.home.z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(C.headH / 2, C.headR * 0.55).setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC)), spoonBody); // head never touches balls (kept out of clawColliders so pass-through toggles never re-enable it)
  spoonMesh = new THREE.Group();
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfaf7ff, roughness: 0.35, metalness: 0.2 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(C.headR, C.headR * 0.94, C.headH, 40), headMat); disc.castShadow = true; spoonMesh.add(disc);
  const navy = new THREE.MeshStandardMaterial({ color: 0x2e4a7a, roughness: 0.4 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(C.headR * 0.62, 0.025, 10, 48), navy); ring1.rotation.x = Math.PI / 2; ring1.position.y = C.headH / 2 + 0.005; spoonMesh.add(ring1);
  for (let k = 0; k < 4; k++) { const arc = new THREE.Mesh(new THREE.TorusGeometry(C.headR * 0.97, 0.03, 8, 24, Math.PI / 3), navy); arc.rotation.x = Math.PI / 2; arc.rotation.z = k * Math.PI / 2 + Math.PI / 12; arc.position.y = C.headH / 2 + 0.005; spoonMesh.add(arc); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(C.headR * 0.96, 0.03, 10, 40), new THREE.MeshStandardMaterial({ color: PALETTE.pink, emissive: PALETTE.pink, emissiveIntensity: 0.5 })); band.rotation.x = Math.PI / 2; band.position.y = -C.headH / 2 + 0.03; spoonMesh.add(band);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, C.headR * 0.5, 0.2, 20), matSteel); cap.position.y = C.headH / 2 + 0.1; spoonMesh.add(cap);
  g.add(spoonMesh);
  takoFingers = [];
  const barMat = new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.3, metalness: 0.85 });
  for (let i = 0; i < C.n; i++) {
    const ang = (i / C.n) * Math.PI * 2; // n=2 → arms on ±X (left/right as seen from the front camera)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const mesh = new THREE.Group();
    for (let s = 0; s < C.pts.length - 1; s++) {
      const [x0, y0] = C.pts[s], [x1, y1] = C.pts[s + 1]; const len = Math.hypot(x1 - x0, y1 - y0) + C.barT;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const rot = Math.atan2(x1 - x0, -(y1 - y0)); // angle of the segment from straight-down, toward +X
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot);
      clawColliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(C.barT / 2, len / 2, C.barW / 2).setTranslation(cx, cy, 0).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.6).setRestitution(0.05).setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE)), body));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(C.barT, len, C.barW), barMat); bar.position.set(cx, cy, 0); bar.quaternion.copy(q); mesh.add(bar);
      const joint = new THREE.Mesh(new THREE.CylinderGeometry(C.barT * 0.9, C.barT * 0.9, C.barW + 0.01, 12), barMat); joint.rotation.x = Math.PI / 2; joint.position.set(x1, y1, 0); mesh.add(joint);
    }
    mesh.traverse(o => { (o              ).castShadow = true; }); g.add(mesh);
    takoFingers.push({ body, mesh, ang });
  }
  takoTilt = C.openAng; spoonPose();
  // --- balls
  balls = []; const bm = new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.35 }); const bgeo = new THREE.SphereGeometry(TAKO.ballR, 14, 10);
  for (let i = 0; i < TAKO.balls; i++) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.4).setAngularDamping(0.6).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.ball(TAKO.ballR).setDensity(0.25).setFriction(0.3).setRestitution(0.45).setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW)), body);
    const mesh = new THREE.Mesh(bgeo, bm); mesh.castShadow = true; g.add(mesh);
    balls.push({ body, mesh, inCup: -1 });
  }
  // restore filled cups then pile the rest in the pool
  const st = takoState(); takoFilled = st.filled.filter(i => i >= 0 && i < takoCups.length && i !== TAKO.getIdx);
  let bi = 0;
  for (const ci of takoFilled) { const c = takoCups[ci]; const b = balls[bi++]; b.inCup = ci; b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); b.body.setTranslation({ x: c.x, y: P.top + 0.01, z: c.z }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (; bi < balls.length; bi++) { const b = balls[bi]; b.body.setTranslation({ x: B.x0 + 0.15 + rnd() * (B.x1 - B.x0 - 0.3), y: 0.15 + Math.floor((bi - takoFilled.length) / 28) * 0.21 + rnd() * 0.05, z: B.z0 + 0.15 + rnd() * (B.z1 - B.z0 - 0.3) }, true); }
  for (let i = 0; i < 240; i++) world.step(); // let the pile settle before the first frame
  takoUpdateRings();
}
function updateTakoStock() { const left = TAKO.stock - takoState().got; takoStock.forEach((s, i) => { s.visible = i < left; }); }
function takoUpdateRings() { /* filled cups show the real ball sitting in them; rings stay as they are */ }
function spoonPose() {
  if (!spoonBody || !spoonMesh) return; const C = TAKO.claw;
  const hy = crane.y - 0.3; spoonBody.setNextKinematicTranslation({ x: crane.x, y: hy, z: crane.z }); spoonMesh.position.set(crane.x, hy, crane.z);
  for (const f of takoFingers) {
    // pivot on the head rim; finger swings outward by takoTilt in its radial plane (local -Y hangs down; +X points radially outward)
    const px = crane.x + Math.cos(f.ang) * C.pivotR, pz = crane.z + Math.sin(f.ang) * C.pivotR, py = hy - C.headH / 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -f.ang, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), takoTilt)); // +tilt swings the hanging finger OUTWARD (radial +X)
    f.body.setNextKinematicTranslation({ x: px, y: py, z: pz }); f.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    f.mesh.position.set(px, py, pz); f.mesh.quaternion.copy(q);
  }
}
function ballsInSpoon()         { let n = 0; const C = TAKO.claw; for (const b of balls) { const t = b.body.translation(); if (Math.hypot(t.x - crane.x, t.z - crane.z) < C.headR + 0.2 && t.y < crane.y - 0.3 && t.y > crane.y - 0.3 - C.headH / 2 - 1.3) n++; } return n; }
// sweep loose balls (not in a cup, not in the pool) back into the pool between plays
function takoSweep() {
  // balls resting on the plate (in or out of a cup) stay where they are; only balls that fell off the plate or out of the pool are returned
  const B = TAKO.pool, P = TAKO.plate; let seed = Date.now() >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const b of balls) {
    if (b.inCup >= 0) continue; const t = b.body.translation();
    const inPool = t.x >= B.x0 && t.x <= B.x1 && t.z >= B.z0 && t.z <= B.z1 && t.y <= 1.2;
    const onPlate = Math.hypot(t.x - P.cx, t.z - P.cz) < P.R + 0.1 && t.y > P.top - P.depth - 0.05 && t.y < P.top + 0.6;
    const inCase = Math.abs(t.x) < 2.3 && Math.abs(t.z) < 1.9 && t.y > -0.2 && t.y < 3;
    if (inPool || onPlate || inCase) continue;
    b.body.setTranslation({ x: B.x0 + 0.2 + rnd() * (B.x1 - B.x0 - 0.4), y: 1.0 + rnd() * 0.3, z: B.z0 + 0.2 + rnd() * (B.z1 - B.z0 - 0.4) }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
}
function takoResetPlate() {
  // GET → the plate is cleared for real: every ball on or in the plate goes back to the pool (otherwise the magnet re-locks them, and the one left in the GET hole would make every following play a GET)
  const P = TAKO.plate, B = TAKO.pool; let seed = Date.now() >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  takoFilled = []; takoState().filled = []; takoGetPending = false;
  for (const b of balls) {
    if (b.inCup >= 0) b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); b.inCup = -1;
    const t = b.body.translation();
    if (Math.hypot(t.x - P.cx, t.z - P.cz) < P.R + 0.3 || t.x > B.x1 + 0.2) { b.body.setTranslation({ x: B.x0 + 0.2 + rnd() * (B.x1 - B.x0 - 0.4), y: 1.0 + rnd() * 0.4, z: B.z0 + 0.2 + rnd() * (B.z1 - B.z0 - 0.4) }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); b.body.wakeUp(); }
  }
  takoSweep(); takoUpdateRings();
}
// after a pour: which cup did each free ball settle in?
// per-step cup magnet: a free ball whose centre is over a cup (radius + margin) is pulled toward the centre and eased down;
// once it sinks below the rim it is locked at the cup centre as a kinematic body (other balls cannot push it out)
let takoGetPending = false;
function takoMagnetTick() {
  const P = TAKO.plate; const capR = P.cupR * 1.45;
  for (const b of balls) {
    if (b.inCup >= 0) continue; const t = b.body.translation();
    if (t.y > P.top + 0.35 || t.y < P.top - P.depth - 0.15 || Math.hypot(t.x - P.cx, t.z - P.cz) > P.R + 0.1) continue;
    let best = -1, bd = Infinity; for (let i = 0; i < takoCups.length; i++) { const c = takoCups[i]; const dd = Math.hypot(t.x - c.x, t.z - c.z); if (dd < bd) { bd = dd; best = i; } }
    const sunk = t.y < P.top - 0.02 && Math.hypot(t.x - P.cx, t.z - P.cz) < P.R;
    if (best < 0 || (bd > capR && !sunk)) continue;
    const c = takoCups[best]; const occupied = balls.some(o => o.inCup === best);
    if (occupied) { if (sunk) { b.body.setTranslation({ x: t.x, y: P.top + TAKO.ballR + 0.02, z: t.z }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); } continue; }
    if (sunk) { b.body.setTranslation({ x: c.x, y: P.top + TAKO.ballR, z: c.z }, true); }
    const restY = P.top + 0.01; // locked height: top half of the ball shows above the rim
    if (t.y <= P.top + TAKO.ballR * 2.6 && bd < P.cupR * 1.15 && b.body.linvel().y <= 0.6) {
      // lock in
      b.inCup = best; b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      b.body.setTranslation({ x: c.x, y: restY, z: c.z }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (best === TAKO.getIdx) takoGetPending = true; else if (!takoFilled.includes(best)) { takoFilled.push(best); takoState().filled = takoFilled.slice(); }
      continue;
    }
    // magnet: blend velocity toward the cup centre and downward
    const lv = b.body.linvel(); const k = 0.25; const pull = 6.0;
    const vx = lv.x + (c.x - t.x) * pull - lv.x * k, vz = lv.z + (c.z - t.z) * pull - lv.z * k;
    b.body.setLinvel({ x: vx, y: lv.y, z: vz }, true); b.body.wakeUp();
  }
}
function takoJudge()                 {
  takoMagnetTick();
  const hit                 = takoGetPending ? "get" : "miss"; takoGetPending = false;
  takoState().filled = takoFilled.slice(); takoUpdateRings(); return hit;
}
function takoTick(dt        ) {
  const m = currentMachine; crane.t += dt;
  switch (crane.phase) {
    case "idle_x": if (input.x) { crane.phase = "moving_x"; updateStep(); void sfx("crane.motor"); crane.motorT = 0; } break;
    case "moving_x": crane.vx = smoothVel(crane.vx, input.x ? m.speedX : 0, m, dt, m.speedX); crane.x = Math.min(m.limits.xMax, crane.x + crane.vx * dt); if (input.x) { crane.motorT += dt; if (crane.motorT > 1.4) { crane.motorT = 0; void sfx("crane.motor"); } } if (!input.x && crane.vx <= 0.001) { crane.vx = 0; crane.phase = "idle_z"; updateStep(); void sfx("crane.confirm"); } break;
    case "idle_z": if (input.z) { crane.phase = "moving_z"; updateStep(); void sfx("crane.motor"); crane.motorT = 0; } break;
    case "moving_z": crane.vz = smoothVel(crane.vz, input.z ? m.speedZ : 0, m, dt, m.speedZ); crane.z = Math.max(m.limits.zMin, crane.z - crane.vz * dt); if (input.z) { crane.motorT += dt; if (crane.motorT > 1.4) { crane.motorT = 0; void sfx("crane.motor"); } } if (!input.z && crane.vz <= 0.001) { crane.vz = 0; crane.phase = "catchgo"; crane.t = 0; updateStep(); void sfx("crane.confirm"); showFlash(T("catchGo")); void sfx("catch.go"); } break;
    case "catchgo": takoTilt = TAKO.claw.openAng; if (crane.t >= 0.6) { crane.phase = "descend"; crane.t = 0; $("flash").classList.add("hidden"); crane.descendTarget = m.home.y - m.descentDistance; void sfx("crane.descend"); } break;
    case "descend": {
      // straight down into the pile: the spoon enters ~one ball below the surface then stops (no contact stop — the pile just yields)
      const speed = m.descentDistance / m.descentTime;
      crane.y = Math.max(crane.descendTarget, crane.y - speed * dt * (crane.t < 0.3 ? crane.t / 0.3 : 1));
      // fingers plunge INTO the pile: stop when the open tips reach just above the pool floor (head never enters the pile: head bottom stays ≥ pile top)
      const C = TAKO.claw; const tipY = crane.y - 0.3 - C.headH / 2 + Math.min(...C.pts.map(([x, y]) => x * Math.sin(takoTilt) + y * Math.cos(takoTilt)));
      let pileTop = 0.1; for (const b of balls) { if (b.inCup >= 0) continue; const t = b.body.translation(); if (Math.hypot(t.x - crane.x, t.z - crane.z) < C.headR + 0.3) pileTop = Math.max(pileTop, t.y + TAKO.ballR); }
      const headBottom = crane.y - 0.3 - C.headH / 2;
      if (crane.y <= crane.descendTarget + 0.001 || tipY <= TAKO.ballR * 2.2 || headBottom <= Math.max(pileTop, 0.8) + 0.05) { crane.phase = "close"; crane.t = 0; crane.contactY = crane.y; }
      break;
    }
    case "close": {
      // swing the fingers inward slowly; they stop well short of touching so a few balls stay caged, not pinched
      const C = TAKO.claw; const k = Math.min(1, crane.t / 0.9); takoTilt = C.openAng + (C.closeAng - C.openAng) * (k * k * (3 - 2 * k));
      if (k >= 1) { crane.phase = "hold"; crane.t = 0; }
      break;
    }
    case "hold": if (crane.t >= 0.4) { crane.phase = "lift"; crane.t = 0; void sfx("crane.descend"); } break;
    case "lift": {
      // slow start, gentle stop: smoothstep, so balls neither get left behind nor thrown at the top
      const k = Math.min(1, crane.t / m.liftTime); const s = k * k * (3 - 2 * k); crane.y = crane.contactY + (m.home.y - crane.contactY) * s;
      if (k >= 1) { crane.phase = "home"; crane.t = 0; crane.startX = crane.x; crane.startZ = crane.z; dropXZ = dropPoint(m); takoScooped = ballsInSpoon(); void sfx("crane.motor"); }
      break;
    }
    case "home": {
      // settle pause after clearing the pool (spoon stays put and level), then a slow smoothstep carry to the drop point
      const PAUSE = 0.55;
      if (crane.t < PAUSE) break;
      const k = Math.min(1, (crane.t - PAUSE) / m.homeTime); const e = k * k * (3 - 2 * k);
      crane.x = crane.startX + (dropXZ.x - crane.startX) * e; crane.z = crane.startZ + (dropXZ.z - crane.startZ) * e; crane.y = m.home.y; // height stays fixed during the carry
      if (k >= 1) { crane.phase = "release"; crane.t = 0; zoomTarget = 0.86; void sfx("claw.open"); }
      break;
    }
    case "release": {
      // open the cage slowly over the plate; caged balls drop out and roll
      const C = TAKO.claw; const k = Math.min(1, crane.t / m.releaseTime); takoTilt = C.closeAng + (C.openAng * 1.6 - C.closeAng) * (k * k * (3 - 2 * k)); // slow smooth opening: balls drop, not get flicked
      // a ball resting on the tips is asleep and is not woken when the tips swing away from it → wake everything near the cage while opening
      for (const b of balls) { const t = b.body.translation(); if (Math.hypot(t.x - crane.x, t.z - crane.z) < C.headR + 0.4 && t.y > crane.y - 2.2 && b.body.isSleeping()) b.body.wakeUp(); }
      if (k >= 1) { crane.phase = "settle"; crane.t = 0; }
      break;
    }
    case "settle": {
      const moving = balls.some(b => { if (b.inCup >= 0) return false; const t = b.body.translation(); if (t.x < TAKO.pool.x1 + 0.2) return false; const v = b.body.linvel(); return Math.hypot(v.x, v.y, v.z) > 0.08; });
      if ((crane.t > 1.2 && !moving) || crane.t > m.settleMax) {
        const res = takoJudge(); zoomTarget = 1; $("flash").classList.add("hidden");
        if (res === "get") { onTakoGet(); } else { crane.phase = "back"; crane.t = 0; }
      }
      break;
    }
    case "back": {
      const k = Math.min(1, crane.t / 1.2); const e = ease(k);
      crane.x = dropXZ.x + (m.home.x - dropXZ.x) * e; crane.z = dropXZ.z + (m.home.z - dropXZ.z) * e; crane.y = m.home.y;
      if (k >= 1) { crane.phase = "fail"; takoSweep(); onMiss(); }
      break;
    }
    case "ready": case "fail": case "get": takoTilt = TAKO.claw.openAng * 0.6; break;
  }
  spoonPose();
}
function onTakoGet() {
  noteGet(currentMachine.id); afterPlayBusyCheck();
  const m = currentMachine; crane.phase = "get"; updateStep(); crane.x = m.home.x; crane.y = m.home.y; crane.z = m.home.z; spoonPose();
  const st = takoState(); st.got = Math.min(TAKO.stock, st.got + 1); updateTakoStock();
  const id = m.prizeId; const isNew = !(save.gotCounts[id] ?? 0);
  save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; save.stock[id] = (save.stock[id] ?? 0) + 1;
  if (isNew) save.firstGot[id] = new Date().toISOString().slice(0, 10);
  takoResetPlate(); persist(); updateLeftTag();
  const gp2 = takoGetPos(); fxGet({ x: gp2.x, y: TAKO.plate.top + 0.2, z: gp2.z });
  const allDone = st.got >= TAKO.stock;
  getPending = window.setTimeout(() => {
    void sfx("prize.get"); if (allDone) setTimeout(() => void sfx("result.fanfare"), 900);
    $("getIcon").innerHTML = prizeImgP(id, 150); $("newTag").classList.toggle("hidden", !isNew);
    $("getMsg").textContent = T("gotFmt").replace("{name}", prizeName(id));
    $("allClear").textContent = T("noMoreHere"); $("allClear").classList.toggle("hidden", !allDone);
    $("getAgain").textContent = allDone ? T("refill") : T("playAgain");
    $("getOverlay").classList.remove("hidden"); spawnConfetti();
  }, 500);
}
// ================= BIG CUDDLE PILLOW =================
// Long soft animal pillow. Physics: a chain of 4 spheres along the long axis (+X = tail, -X = head) + head bulge + tail nub, so the
// claw can pinch the middle, hook an end (it tilts / lifts one side) and the body rolls a little when dropped. Visual: the user's
// product photo mounted on the body as a double-sided cutout card (both faces), plus a plush-coloured underbody so it reads as a
// stuffed pillow from every angle. No new art is generated: the photo IS the prize.
const PILLOW_ART                                                                = {
  pillow_pig: { img: "assets/pillow-pig.webp", tint: 0xf6bfc3, aspect: 1536 / 1024 },
  pillow_rabbit: { img: "assets/pillow-rabbit.webp", tint: 0xf5e9d8, aspect: 1536 / 1024 },
  pillow_dog: { img: "assets/pillow-dog.webp", tint: 0xd9b48c, aspect: 1536 / 1024 },
};
const pillowMats                                             = {};
function pillowFaceMat(id        ) {
  if (!pillowMats[id]) {
    const a = PILLOW_ART[id]; const mat = new THREE.MeshStandardMaterial({ color: a.tint, roughness: 1, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }); pillowMats[id] = mat;
    texLoader.load(a.img, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; });
  }
  return pillowMats[id];
}
const PILLOW_LEN = 1.9, PILLOW_R = 0.42; // ≈ BIG bear volume; long axis along local X, head at -X
function buildPillowPrize(def          )        {
  const id = def.pillow ; const art = PILLOW_ART[id]; const s = def.scale;
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rot[0], def.rot[1], def.rot[2]));
  // soft plush: heavier damping than the bear so it never bounces or flies, but still tips and rolls
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(def.pos[0], def.pos[1], def.pos[2]).setRotation({ x: q0.x, y: q0.y, z: q0.z, w: q0.w })
    .setLinearDamping(0.9).setAngularDamping(1.6).setCcdEnabled(true).setCanSleep(true));
  const parts              = []; const handles = new Set        (); const colliders                    = [];
  const mesh = new THREE.Group(); const dbg = new THREE.Group(); dbg.userData.follow = mesh; debugGroup.add(dbg);
  const dens = 1.1 * def.weight;
  const add = (r        , x        , y        , z        , d        ) => {
    const desc = RAPIER.ColliderDesc.ball(r * s).setTranslation(x * s, y * s, z * s).setDensity(d).setFriction(def.friction).setRestitution(0.02)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW));
    const col = world.createCollider(desc, body); handles.add(col.handle); colliders.push(col);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), matDebug); dm.position.set(x, y, z).multiplyScalar(s); dm.scale.setScalar(s); dbg.add(dm);
    const c = new THREE.Vector3(x, y, z).multiplyScalar(s); parts.push({ a: c.clone(), b: c.clone(), r: r * s });
  };
  const hx = -PILLOW_LEN / 2 + PILLOW_R * 1.05;
  add(PILLOW_R * 1.05, hx, 0.02, 0, dens * 1.1);                       // head (slightly bigger, centre of mass a touch forward)
  add(PILLOW_R, hx + 0.5, 0, 0, dens); add(PILLOW_R * 0.98, hx + 0.95, 0, 0, dens); add(PILLOW_R * 0.9, hx + 1.35, -0.02, 0, dens * 0.9); // body chain
  add(0.17, PILLOW_LEN / 2 - 0.05, 0.28, 0, dens * 0.4);              // tail nub (hookable)
  add(0.16, hx - 0.05, -0.3, 0.3, dens * 0.5); add(0.16, hx - 0.05, -0.3, -0.3, dens * 0.5); // front paws (keep the head from rolling face-down)
  // visual: plush underbody (soft tinted spheres) + the product photo as a two-sided card along the long axis
  const plush = new THREE.MeshStandardMaterial({ color: art.tint, roughness: 1 });
  const sph = new THREE.SphereGeometry(1, 20, 14);
  for (const [r, x, y, z, sy] of [[PILLOW_R * 1.0, hx, 0.02, 0, 0.9], [PILLOW_R * 0.96, hx + 0.5, 0, 0, 0.88], [PILLOW_R * 0.94, hx + 0.95, 0, 0, 0.86], [PILLOW_R * 0.86, hx + 1.35, -0.02, 0, 0.82]]              ) {
    const b = new THREE.Mesh(sph, plush); b.position.set(x, y, z).multiplyScalar(s); b.scale.set(r * s * 0.98, r * s * sy, r * s * 0.55); b.castShadow = b.receiveShadow = true; mesh.add(b);
  }
  const cardH = 1.15 * s, cardW = cardH * art.aspect;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), pillowFaceMat(id)); card.position.set(0.0, 0.08 * s, 0.24 * s); card.castShadow = true; mesh.add(card);
  const back = card.clone(); back.rotation.y = Math.PI; back.position.z = -0.24 * s; mesh.add(back); // photo faces the player from both sides (mirrored) so a flipped pillow still shows the character
  scene.add(mesh);
  return { sweetType: id, def, body, mesh, parts, got: false, safe: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]), safeQ: q0.clone(), inChuteT: 0, prevVel: 0, colliderHandles: handles, colliders, safeT: 0 };
}

// A pile of light snack boxes/bags (real rigid bodies) behind a low step; the standard claw nudges, hooks and topples them
// toward a wide front chute. GET = object centre inside the chute zone (instant). Layout persists like the other machines.
;                                                                                                           
const SWEETS             = [
  { id: "sweet_chips", size: [0.66, 0.72, 0.2], img: "assets/sweet-chips.webp", tint: 0xfff0b8, weight: 0.35 },
  { id: "sweet_choco", size: [0.6, 0.48, 0.16], img: "assets/sweet-choco.webp", tint: 0x7a2e2e, weight: 0.6 },
  { id: "sweet_gummy", size: [0.5, 0.58, 0.18], img: "assets/sweet-gummy.webp", tint: 0xf3e9d8, weight: 0.3 },
  { id: "sweet_cookie", size: [0.54, 0.46, 0.3], img: "assets/sweet-cookie.webp", tint: 0xf3e6d0, weight: 0.7 },
];
// a real heap: ~400 smaller snacks in ~8 layers (light bodies, high damping keeps the sim calm)
const SWEET_PILE = { n: 320, x0: -1.9, x1: 1.9, z0: -1.55, z1: 0.35, stepZ: 0.7, scale: 0.74, perLayer: 40, layerH: 0.5 };
// textures are attached to materials only once loaded (an unloaded map renders nothing); until then the tinted colour shows
const sweetMats                                             = {};
function sweetFaceMat(sd          ) {
  if (!sweetMats[sd.id]) {
    const mat = new THREE.MeshStandardMaterial({ color: sd.tint, roughness: 0.6 }); sweetMats[sd.id] = mat;
    texLoader.load(sd.img, t => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.color.set(0xffffff); mat.transparent = true; mat.alphaTest = 0.3; mat.needsUpdate = true; });
  }
  return sweetMats[sd.id];
}
function buildSweetPrize(def          , sd          )        {
  const [w, h, d] = sd.size.map(v => v * SWEET_PILE.scale)                            ;
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rot[0], def.rot[1], def.rot[2]));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(def.pos[0], def.pos[1], def.pos[2]).setRotation({ x: q0.x, y: q0.y, z: q0.z, w: q0.w })
    .setLinearDamping(1.6).setAngularDamping(3.0).setCcdEnabled(true).setCanSleep(true));
  const col = world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setDensity(1.2 * sd.weight).setFriction(0.95).setRestitution(0.0)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW)), body);
  const face = sweetFaceMat(sd);
  const plain = face;
  const mesh = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [face, face, plain, plain, face, face]); /* printed on 4 faces so a tumbled heap stays colourful */ box.castShadow = box.receiveShadow = true; mesh.add(box); scene.add(mesh);
  return { sweetType: sd.id, def, body, mesh, parts: [], got: false, safe: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]), safeQ: q0.clone(), inChuteT: 0, prevVel: 0, colliderHandles: new Set([col.handle]), colliders: [col], safeT: 0 };
}
// deterministic pile layout: seeded so first entry looks the same for everyone; later plays are persisted via layouts
function sweetDefs()                                    {
  let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out                                    = []; const S = SWEET_PILE;
  for (let i = 0; i < S.n; i++) {
    const sd = SWEETS[i % SWEETS.length]; const layer = Math.floor(i / S.perLayer), k = i % S.perLayer;
    // grid cells (10×5 per layer) with small jitter: pieces never spawn inside each other, so the heap settles instead of exploding
    const cols = 8, rows = 5; const cellW = (S.x1 - S.x0) / cols, cellD = (S.z1 - S.z0) / rows;
    const shrink = Math.min(0.45, layer * 0.06);
    const x = S.x0 + cellW * ((k % cols) + 0.5) + (rnd() - 0.5) * cellW * 0.25, z = S.z0 + cellD * (Math.floor(k / cols) + 0.5) + (rnd() - 0.5) * cellD * 0.25;
    const xs = S.x0 + (x - S.x0) * (1 - shrink) + (S.x1 - S.x0) * shrink / 2;
    out.push({ sd, def: { weight: sd.weight, friction: 0.95, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [xs, 0.55 + layer * S.layerH + rnd() * 0.05, z], rot: [(rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5] } });
  }
  return out;
}
function buildSweetsStage(m               , g             ) {
  // low step between the pile shelf and the chute: the pile sits on a raised deck (y 0.3) that slopes down toward the chute
  const S = SWEET_PILE; const D = m.caseD;
  fixedBox(m.caseW / 2, 0.15, (S.z1 - S.z0) / 2 + 0.2, 0, 0.15, (S.z0 + S.z1) / 2 - 0.1, 0.85);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(m.caseW, 0.3, S.z1 - S.z0 + 0.4), new THREE.MeshStandardMaterial({ color: 0xfff7fa, roughness: 0.6 })); deck.position.set(0, 0.15, (S.z0 + S.z1) / 2 - 0.1); deck.receiveShadow = true; g.add(deck);
  // slope from deck edge (z=S.z1+0.1, y .3) down to floor at z = stepZ+0.35
  const len = Math.hypot(0.3, 0.55), ang = Math.atan2(0.3, 0.55);
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.15, S.z1 + 0.1 + 0.275)); const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang); rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  world.createCollider(RAPIER.ColliderDesc.cuboid(m.caseW / 2, 0.02, len / 2).setFriction(0.25), rb);
  fixedBox(m.caseW / 2, 0.22, 0.03, 0, 0.3 + 0.22, S.z1 + 0.1, 0.8); // front lip: the heap settles behind it, sweets have to be pushed over
  const lipV = new THREE.Mesh(new THREE.BoxGeometry(m.caseW, 0.44, 0.06), new THREE.MeshStandardMaterial({ color: 0xffb8d0, roughness: 0.5 })); lipV.position.set(0, 0.52, S.z1 + 0.1); g.add(lipV);
  const slope = new THREE.Mesh(new THREE.BoxGeometry(m.caseW, 0.04, len), new THREE.MeshStandardMaterial({ color: 0xffe3ee, roughness: 0.5 })); slope.position.set(0, 0.15, S.z1 + 0.1 + 0.275); slope.quaternion.copy(q); g.add(slope);
  void D;
}
function mascotRefill() {
  let seed = Date.now() >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const p of prizes) { if (!p.got) continue; unparkPrize(p); p.body.setTranslation({ x: -1.4 + rnd() * 2.8, y: 2.6 + rnd() * 0.6, z: -1.2 + rnd() * 1.2 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp(); }
  saveLayout(); updateLeftTag();
}
function sweetsLeft() { return prizes.filter(p => !p.got).length; }
function sweetsRefill() {
  // top up: re-add got sweets to the top of the pile (they were parked), keep everything else where it is
  let seed = Date.now() >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const p of prizes) { if (!p.got) continue; unparkPrize(p); const S = SWEET_PILE; p.body.setTranslation({ x: S.x0 + 0.4 + rnd() * (S.x1 - S.x0 - 0.8), y: 3.6 + rnd() * 0.8, z: S.z0 + 0.4 + rnd() * (S.z1 - S.z0 - 0.8) }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp(); }
  saveLayout(); updateLeftTag();
}
let sweetsSettling = false; let sweetsArmed = false; let sweetHaul                         = {};
// instant GET when a sweet's centre is inside the chute zone (a little below the deck so it is really falling in)
function sweetInChute(p       , m               )          {
  const t = p.body.translation(), ch = m.chute;
  return t.y < 0.15 && Math.abs(t.x - ch.cx) < ch.w / 2 + 0.05 && Math.abs(t.z - ch.cz) < ch.d / 2 + 0.05;
}
function onSweetGet(p       ) {
  chuteFlash(); p.got = true; parkPrize(p); const id = p.sweetType ;
  // sweets: one inventory row per kind, quantity accumulates (never one card per piece)
  const inv = save.snacks ?? (save.snacks = {}); const row = inv[id] ?? (inv[id] = { snackId: id, quantity: 0, firstAt: new Date().toISOString().slice(0, 10) }); row.quantity++;
  const isNew = !(save.gotCounts[id] ?? 0); save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; save.stock[id] = (save.stock[id] ?? 0) + 1;
  if (isNew) save.firstGot[id] = new Date().toISOString().slice(0, 10);
  sweetHaul[id] = (sweetHaul[id] ?? 0) + 1; noteGet(currentMachine.id);
  fxGet({ x: currentMachine.chute.cx, y: 0.6, z: currentMachine.chute.cz }); void sfx("prize.get");
  saveLayout(); updateLeftTag(); persist();
  // the haul is tallied here; the summary appears only once the play has finished and the pile has stopped moving (showSweetHaul)
}
function showSweetHaul() {
  {
    const items = Object.entries(sweetHaul); sweetHaul = {}; if (!items.length) return; afterPlayBusyCheck();
    crane.phase = "get"; updateStep();
    const total = items.reduce((s, [, n]) => s + n, 0);
    $("getIcon").innerHTML = items.map(([id]) => prizeImg(id, items.length > 1 ? 70 : 150)).join("");
    $("newTag").classList.add("hidden");
    $("getMsg").innerHTML = items.map(([id, n]) => `${prizeName(id)} ×${n}`).join("<br>") + (total > 1 ? `<br><b>${T("gotMany").replace("{n}", `${total}`)}</b>` : "");
    $("allClear").classList.add("hidden"); $("getAgain").textContent = T("playAgain");
    $("getOverlay").classList.remove("hidden"); spawnConfetti(); if (total > 1) void sfx("result.fanfare");
  }
}
function sweetsStillMoving() { return prizes.some(p => { if (p.got) return false; if (p.body.isSleeping()) return false; const v = p.body.linvel(); return Math.hypot(v.x, v.y, v.z) > 0.12; }); }
function buildArcadeSurround(m               , g             ) {
  const W = m.caseW, D = m.caseD, H = m.caseH, cd = m.chute.depth + 0.6;
  const floorY = -cd - 0.04;
  const matArcadeFloor = new THREE.MeshStandardMaterial({ color: 0xe9dff2, roughness: 0.35, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), matArcadeFloor); floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true; g.add(floor);
  for (let i = -6; i <= 6; i++) { const tile = new THREE.Mesh(new THREE.BoxGeometry(60, 0.01, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); tile.position.set(0, floorY + 0.005, i * 2.5 - 1); g.add(tile); }
  // far backdrop (blurred arcade image) + side backdrops
  texLoader.load("assets/arcade-backdrop.webp", tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), mat); back.position.set(0, floorY + 10, -D / 2 - 9); g.add(back);
    for (const sd of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), mat); side.position.set(sd * 14, floorY + 10, -2); side.rotation.y = -sd * Math.PI / 2; g.add(side); }
  });
  // ceiling with light panels
  const ceilY = H + 4.2;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xfdf8ff, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = ceilY; g.add(ceil);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 2.2 });
  for (let i = -3; i <= 3; i++) for (const z of [-6, -1, 4]) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.6), lampMat); l.position.set(i * 4.5, ceilY - 0.05, z); g.add(l); }
  // pastel neon strips along the ceiling edge
  for (const [col, y] of [[PALETTE.pink, ceilY - 0.5], [0x8fd8ff, ceilY - 0.7]]                      ) { const n = new THREE.Mesh(new THREE.BoxGeometry(40, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.8 })); n.position.set(0, y, -D / 2 - 7); g.add(n); }
  // neighbour cabinets (left/right and a row behind)
  const neighbor = (x        , z        , led        , popPath        , ry = 0) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, cd, D + 0.6), matCabinet); base.position.y = -cd / 2 - 0.02; base.castShadow = true; grp.add(base);
    const ledMat = new THREE.MeshStandardMaterial({ color: led, emissive: led, emissiveIntensity: 1.4 });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.64, 0.05, D + 0.64), ledMat); bl.position.y = -0.3; grp.add(bl);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matFloor); fl.rotation.x = -Math.PI / 2; grp.add(fl);
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matBackWall); bw.position.set(0, H / 2, -D / 2 + 0.01); grp.add(bw);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matAcrylic); glass.position.y = H / 2; grp.add(glass);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, H + 0.3, 0.14), matCabinet); p.position.set(px * (W / 2 + 0.07), H / 2, pz * (D / 2 + 0.07)); grp.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), matCabinet); top.position.y = H + 0.25; grp.add(top);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.64, 0.04, D + 0.64), ledMat); tl.position.y = H + 0.05; grp.add(tl);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: led, roughness: 0.4 })); sign.position.set(0, H + 0.9, D / 2 + 0.2); grp.add(sign);
    // a few generic plush blobs inside
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: [0xffc9d9, 0xc9e6ff, 0xfff0b0, 0xd7f5ee][i], roughness: 1 })); b.position.set(-1.2 + i * 0.85, 0.42, -0.6 + (i % 2) * 0.9); b.castShadow = true; grp.add(b); }
    texLoader.load(popPath, tex => { tex.colorSpace = THREE.SRGBColorSpace; const img = tex.image                                     ; const w = W * 0.7, h = w * img.height / img.width; const pm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); pm.position.set(0, H * 0.6, -D / 2 + 0.03); grp.add(pm); });
  };
  neighbor(-(W + 1.3), 0, 0x8fd8ff, POP_LIBRARY.neighborA);
  neighbor(W + 1.3, 0, 0xffd166, POP_LIBRARY.neighborB);
  for (let i = -2; i <= 2; i++) neighbor(i * (W + 1.3) + (W + 1.3) / 2, -(D + 5.5), [0xffb3cf, 0x8fd8ff, 0xffd166, 0xc9b8ff, 0xa8f0e4][i + 2], i % 2 ? POP_LIBRARY.neighborB : POP_LIBRARY.neighborA, Math.PI);
  // this cabinet: rounded header sign with LED lines (name plate area)
  const header = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, W + 0.6, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); header.rotation.z = Math.PI / 2; header.position.set(0, H + 0.55, D / 2 + 0.25); g.add(header);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: m.led ? m.led.b : PALETTE.pink, roughness: 0.4 })); plate.position.set(0, H + 0.9, D / 2 + 0.5); g.add(plate);
  const plateGlow = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.05, 0.08), glowMint); plateGlow.position.set(0, H + 0.6, D / 2 + 0.52); g.add(plateGlow);
  for (const sd of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, H + 0.2, 0.05), sd < 0 ? glowPink : glowMint); strip.position.set(sd * (W / 2 + 0.16), H / 2, D / 2 + 0.1); g.add(strip); }
}

// yaw = rotation of the finger's swing plane about Y (0 → the classic left/right pair; 3-claw machines use 0 / ±120°)
function buildFinger(m               , side        , g             , yaw = 0) {
  const L = m.fingerLen, r = 0.045, tipL = 0.3, bend = 0.95;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const hx = m.home.x + side * m.armWidth * cy, hy = m.home.y - 0.15, hz = m.home.z - side * m.armWidth * sy;
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  void qYaw; // the revolute joint keeps the finger body aligned with the head, so the yaw is baked into the finger geometry below
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(hx, hy, hz).setLinearDamping(2).setAngularDamping(2).setCanSleep(false).setCcdEnabled(true));
  const handles = new Set        ();
  const fingerFriction = m.kind === "bridge" ? 0.5 : 1.4;
  if (m.claws === 3) {
    // compact kawaii 3-claw finger: ONE smooth continuous curved steel piece (tube along a spline), short and thick, no joints.
    // Local frame: +X radially outward, -Y down. Physics = a row of spheres sampled along the same curve (invisible; the tube is the visual).
    // curve in the finger's radial plane, then rotated about Y by the finger's yaw so its hook points at the head centre
    const rotY = (x        , y        ) => new THREE.Vector3(x * cy, y, -x * sy);
    const K = m.fingerLen / 0.75; // curve authored for the mascot claw (fingerLen 0.75); larger machines scale the same hook shape
    const curve = new THREE.CatmullRomCurve3([rotY(0, 0.02), rotY(0.13 * K, -0.2 * K), rotY(0.15 * K, -0.45 * K), rotY(0.02 * K, -0.66 * K), rotY(-0.17 * K, -0.72 * K)]);
    const R = 0.075 * Math.sqrt(K); const steel = new THREE.MeshStandardMaterial({ color: 0xe4e8f0, roughness: 0.25, metalness: 0.85 });
    const mesh0 = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, R, 14, false), steel); tube.castShadow = true; mesh0.add(tube);
    const tipPt = curve.getPoint(1); const tipCap = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 12), steel); tipCap.position.copy(tipPt); mesh0.add(tipCap);
    const rootCap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.25, 14, 12), new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.5 })); mesh0.add(rootCap);
    for (let s = 0; s <= 9; s++) {
      const p = curve.getPoint(s / 9);
      const col = world.createCollider(RAPIER.ColliderDesc.ball(R).setTranslation(p.x, p.y, p.z).setDensity(6).setFriction(fingerFriction).setRestitution(0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      col.setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE)); clawColliders.push(col); handles.add(col.handle);
    }
    const jd3 = RAPIER.JointData.revolute({ x: side * m.armWidth * cy, y: -0.15, z: -side * m.armWidth * sy }, { x: 0, y: 0, z: 0 }, { x: sy, y: 0, z: cy });
    const joint3 = world.createImpulseJoint(jd3, clawHead, body, true)                               ;
    const wide3 = m.openAngle + 0.4; joint3.setLimits(Math.min(side * wide3, side * m.closedAngle), Math.max(side * wide3, side * m.closedAngle));
    try { (joint3                                                            ).setContactsEnabled?.(false); } catch { /* */ }
    joint3.configureMotorModel(RAPIER.MotorModel.ForceBased); joint3.configureMotorPosition(side * m.openAngle, 60, 8);
    g.add(mesh0); fingers.push({ body, joint: joint3, mesh: mesh0, side, handles, yaw });
    return;
  }
  const c1 = world.createCollider(RAPIER.ColliderDesc.capsule(L / 2 - r, r).setTranslation(0, -L / 2, 0).setDensity(6).setFriction(fingerFriction).setRestitution(0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
  const tipDir = new THREE.Vector3(-side * Math.sin(bend), -Math.cos(bend), 0);
  const tipC = tipDir.clone().multiplyScalar(tipL / 2).add(new THREE.Vector3(0, -L, 0));
  const c2 = world.createCollider(RAPIER.ColliderDesc.capsule(tipL / 2 - r, r).setTranslation(tipC.x, tipC.y, tipC.z).setRotation(qz(-side * bend)).setDensity(6).setFriction(fingerFriction).setRestitution(0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
  c1.setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE)); c2.setCollisionGroups(grp(GROUP_CLAW, GROUP_STATIC | GROUP_PRIZE));
  clawColliders.push(c1, c2);
  handles.add(c1.handle); handles.add(c2.handle);
  // joint axis and anchor are expressed in the head frame → rotate them by the finger yaw; finger local frame keeps its own Z axis
  const jd = RAPIER.JointData.revolute({ x: side * m.armWidth * cy, y: -0.15, z: -side * m.armWidth * sy }, { x: 0, y: 0, z: 0 }, { x: sy, y: 0, z: cy });
  const joint = world.createImpulseJoint(jd, clawHead, body, true)                               ;
  const wide = m.openAngle + 0.4;
  const lo = Math.min(side * wide, side * m.closedAngle), hi = Math.max(side * wide, side * m.closedAngle);
  joint.setLimits(lo, hi);
  try { (joint                                                            ).setContactsEnabled?.(false); } catch { /* */ }
  joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
  joint.configureMotorPosition(side * m.openAngle, 60, 8);
  const mesh = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - 2 * r, 6, 12), matSteel); seg.position.set(0, -L / 2, 0); seg.castShadow = true; mesh.add(seg);
  const tip = new THREE.Mesh(new THREE.CapsuleGeometry(r, tipL - 2 * r, 6, 12), matSteel); tip.position.copy(tipC); tip.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -side * bend); tip.castShadow = true; mesh.add(tip);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), glowMint); mesh.add(cap);
  // debug wire copies
  const d1 = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - 2 * r, 4, 8), matDebug); d1.position.copy(seg.position); const d2 = new THREE.Mesh(new THREE.CapsuleGeometry(r, tipL - 2 * r, 4, 8), matDebug); d2.position.copy(tip.position); d2.quaternion.copy(tip.quaternion);
  const dbg = new THREE.Group(); dbg.add(d1, d2); dbg.userData.follow = mesh; debugGroup.add(dbg);
  g.add(mesh);
  fingers.push({ body, joint, mesh, side, handles, yaw });
}

// Visual teddy: plump, big round head, small ears, short stubby limbs, all overlapping so the joins read as one plush.
function buildBearVisual(furColor        )              {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: furColor, roughness: 1 });
  const light = new THREE.MeshStandardMaterial({ color: 0xfff1de, roughness: 1 });
  const cheek = new THREE.MeshStandardMaterial({ color: 0xffc2cf, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33262a, roughness: 0.45 });
  const put = (geo                      , mat                , x        , y        , z        , sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 28, 20);
  put(sph, fur, 0, -0.05, 0, 0.42, 0.40, 0.38);                 // plump body
  put(sph, light, 0, -0.08, 0.2, 0.26, 0.26, 0.2);               // belly patch
  put(sph, fur, 0, 0.38, 0, 0.16, 0.14, 0.16);                   // neck fill (hidden in overlap)
  put(sph, fur, 0, 0.62, 0.02, 0.40, 0.38, 0.38);                // big round head
  put(sph, fur, -0.27, 0.9, -0.02, 0.12, 0.12, 0.09);            // ears
  put(sph, fur, 0.27, 0.9, -0.02, 0.12, 0.12, 0.09);
  put(sph, light, -0.27, 0.9, 0.03, 0.065, 0.065, 0.04);         // inner ear
  put(sph, light, 0.27, 0.9, 0.03, 0.065, 0.065, 0.04);
  put(sph, light, 0, 0.53, 0.30, 0.17, 0.13, 0.13);              // muzzle
  put(sph, dark, 0, 0.58, 0.45, 0.055, 0.04, 0.04);              // nose
  put(sph, dark, -0.13, 0.68, 0.40, 0.05, 0.055, 0.04);        // eyes (on the head surface)
  put(sph, dark, 0.13, 0.68, 0.40, 0.05, 0.055, 0.04);
  put(sph, light, -0.115, 0.70, 0.435, 0.015, 0.015, 0.01);      // eye highlights
  put(sph, light, 0.145, 0.70, 0.435, 0.015, 0.015, 0.01);
  put(sph, cheek, -0.23, 0.56, 0.35, 0.07, 0.05, 0.03);         // cheeks
  put(sph, cheek, 0.23, 0.56, 0.35, 0.07, 0.05, 0.03);
  const mouth = new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI);
  put(mouth, dark, 0, 0.515, 0.445, 1, 1, 1, Math.PI, 0, 0);      // small smile
  put(sph, fur, -0.40, 0.05, 0.08, 0.15, 0.13, 0.13);            // stubby arms
  put(sph, fur, 0.40, 0.05, 0.08, 0.15, 0.13, 0.13);
  put(sph, fur, -0.32, 0.12, 0.04, 0.14, 0.14, 0.12);            // shoulders (join arms to body)
  put(sph, fur, 0.32, 0.12, 0.04, 0.14, 0.14, 0.12);
  put(sph, fur, -0.22, -0.38, 0.22, 0.17, 0.14, 0.2);            // short legs, forward (seated)
  put(sph, fur, 0.22, -0.38, 0.22, 0.17, 0.14, 0.2);
  put(sph, light, -0.22, -0.38, 0.4, 0.09, 0.08, 0.04);          // paw pads
  put(sph, light, 0.22, -0.38, 0.4, 0.09, 0.08, 0.04);
  return g;
}

// ---- mini mascots (same series look: bear body plan, species = fur colour + ears + markings + bow)
;                                                                                                                                                                                    
const MASCOTS              = [
  { id: "mascot_bear", fur: 0xd9b48c, belly: 0xfff1de, ears: "round", bow: 0x7fb2ff },
  { id: "mascot_rabbit", fur: 0xfff6f6, belly: 0xffe9ee, ears: "long", bow: 0xffa6c9 },
  { id: "mascot_cat", fur: 0x9a9aa6, belly: 0xffffff, ears: "point", patch: 0xffffff, bow: 0xc9a9ff },
  { id: "mascot_dog", fur: 0xe5c9a8, belly: 0xfff6ea, ears: "floppy", patch: 0xffffff, bow: 0xa5e6a1 },
  { id: "mascot_chick", fur: 0xfff0a6, belly: 0xfff7cc, ears: "none", beak: true, bow: 0x7fb2ff },
  { id: "mascot_panda", fur: 0xffffff, belly: 0xffffff, ears: "round", eyePatch: true, bow: 0xff8fa3 },
];
function buildMascotVisual(md           )              {
  const g = buildBearVisual(md.fur);
  const sph = new THREE.SphereGeometry(1, 20, 14);
  const mat = (c        , r = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const put = (m                , x        , y        , z        , sx        , sy        , sz        , rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(sph, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const dark = mat(0x33262a, 0.45); const furM = mat(md.fur);
  // ears: the bear builder already has round ears; species swap
  if (md.ears !== "round") { g.children.filter(o => Math.abs(o.position.y - 0.9) < 0.01 && Math.abs(Math.abs(o.position.x) - 0.27) < 0.01).forEach(o => { o.visible = false; }); }
  if (md.ears === "long") { put(furM, -0.22, 0.95, -0.05, 0.11, 0.34, 0.09, 0, 0, 0.25); put(furM, 0.22, 0.95, -0.05, 0.11, 0.34, 0.09, 0, 0, -0.25); put(mat(0xffc2cf), -0.22, 0.95, 0.0, 0.05, 0.22, 0.05, 0, 0, 0.25); put(mat(0xffc2cf), 0.22, 0.95, 0.0, 0.05, 0.22, 0.05, 0, 0, -0.25); }
  if (md.ears === "point") { const cone = new THREE.ConeGeometry(0.11, 0.22, 10); for (const sx of [-1, 1]) { const e = new THREE.Mesh(cone, furM); e.position.set(sx * 0.26, 0.95, -0.02); e.rotation.z = -sx * 0.3; e.castShadow = true; g.add(e); } }
  if (md.ears === "floppy") { for (const sx of [-1, 1]) put(mat(0xb98a5f), sx * 0.34, 0.62, -0.02, 0.11, 0.24, 0.09, 0, 0, -sx * 0.15); }
  if (md.patch) { put(mat(md.patch), 0, 0.66, 0.34, 0.16, 0.2, 0.08); }
  if (md.beak) { put(mat(0xffa14a, 0.6), 0, 0.57, 0.44, 0.07, 0.045, 0.06); g.children.filter(o => Math.abs(o.position.z - 0.45) < 0.01 && Math.abs(o.position.y - 0.58) < 0.01).forEach(o => { o.visible = false; }); }
  if (md.eyePatch) { put(dark, -0.15, 0.68, 0.36, 0.1, 0.09, 0.05); put(dark, 0.15, 0.68, 0.36, 0.1, 0.09, 0.05); put(mat(0x33262a), -0.27, 0.9, -0.02, 0.12, 0.12, 0.09); put(mat(0x33262a), 0.27, 0.9, -0.02, 0.12, 0.12, 0.09); put(dark, -0.40, 0.05, 0.08, 0.15, 0.13, 0.13); put(dark, 0.40, 0.05, 0.08, 0.15, 0.13, 0.13); put(dark, -0.22, -0.38, 0.22, 0.17, 0.14, 0.2); put(dark, 0.22, -0.38, 0.22, 0.17, 0.14, 0.2); }
  // gingham-ish bow at the neck (series signature)
  const bowM = mat(md.bow, 0.8); put(bowM, -0.1, 0.3, 0.32, 0.09, 0.06, 0.04, 0, 0, 0.3); put(bowM, 0.1, 0.3, 0.32, 0.09, 0.06, 0.04, 0, 0, -0.3); put(bowM, 0, 0.3, 0.34, 0.035, 0.035, 0.03);
  const charm = new THREE.Mesh(sph, mat(0xf2c14e, 0.3)); charm.position.set(0, 0.22, 0.36); charm.scale.set(0.03, 0.03, 0.02); g.add(charm);
  return g;
}
const MASCOT_SCALE = 0.48;
function mascotDefs()                                     {
  let seed = 777; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out                                     = []; const N = 48;
  for (let i = 0; i < N; i++) {
    const md = MASCOTS[i % MASCOTS.length]; const layer = Math.floor(i / 12), k = i % 12;
    // 6×2 grid per layer with jitter (no initial interpenetration), random tumble orientation; 4 layers → a heaped pool
    // heap sits behind the chute (front-left): rows at z≈-1.5/-0.7, front row starts right of the chute's x-range
    const row = Math.floor(k / 6), x = (row === 1 ? -0.5 : -1.6) + (k % 6) * (row === 1 ? 0.48 : 0.64) + (rnd() - 0.5) * 0.2, z = -1.5 + row * 0.8 + (rnd() - 0.5) * 0.25;
    out.push({ md, def: { weight: 0.9 + rnd() * 0.2, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: MASCOT_SCALE / BEAR_GLOBAL, pos: [x, 0.45 + layer * 0.7, z], rot: [(rnd() - 0.5) * 1.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.2] } });
  }
  return out;
}
function buildPrize(def          , idx        , md            )        {
  if (def.pillow) return buildPillowPrize(def);
  const s = def.scale * BEAR_GLOBAL;
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rot[0], def.rot[1], def.rot[2]));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(def.pos[0], def.pos[1], def.pos[2])
    .setRotation({ x: q0.x, y: q0.y, z: q0.z, w: q0.w })
    .setLinearDamping(0.35).setAngularDamping(0.8).setCcdEnabled(true).setCanSleep(true));
  const dBase = 1.6 * def.weight;
  const dHead = dBase * (1 - def.centerOfMass * 0.5), dLeg = dBase * (1 + def.centerOfMass * 0.5);
  const parts              = [];
  const handles = new Set        (); const colliders                    = [];
  const mesh = new THREE.Group();
  const visual = md ? buildMascotVisual(md) : buildBearVisual(BEAR_FUR[idx % BEAR_FUR.length]); visual.scale.setScalar(s); mesh.add(visual);
  const dbg = new THREE.Group(); dbg.userData.follow = mesh; debugGroup.add(dbg);
  // rigid collider set (kept simple and rounded so the plush never "deforms": the visual is a single rigid group)
  const add = (desc                     , geo                      , off               , r        , q                   , halfLen = 0, isBox = false) => {
    desc.setTranslation(off.x * s, off.y * s, off.z * s).setFriction(def.friction).setRestitution(0.04).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW));
    if (q) desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const col = world.createCollider(desc, body); handles.add(col.handle); colliders.push(col);
    const dm = new THREE.Mesh(geo, matDebug); dm.position.copy(off).multiplyScalar(s); if (q) dm.quaternion.copy(q); dm.scale.setScalar(s); dbg.add(dm);
    const axis = new THREE.Vector3(0, halfLen * s, 0); if (q) axis.applyQuaternion(q);
    const c = off.clone().multiplyScalar(s);
    if (!isBox) parts.push({ a: c.clone().add(axis), b: c.clone().sub(axis), r: r * s });
  };
  const V = (x        , y        , z        ) => new THREE.Vector3(x, y, z);
  add(RAPIER.ColliderDesc.ball(0.40 * s).setDensity(dBase), new THREE.SphereGeometry(0.40, 12, 8), V(0, -0.05, 0), 0.40);            // body
  add(RAPIER.ColliderDesc.ball(0.38 * s).setDensity(dHead), new THREE.SphereGeometry(0.38, 12, 8), V(0, 0.62, 0.02), 0.38);           // head
  add(RAPIER.ColliderDesc.ball(0.11 * s).setDensity(dHead), new THREE.SphereGeometry(0.11, 8, 6), V(-0.27, 0.9, -0.02), 0.11);        // ears
  add(RAPIER.ColliderDesc.ball(0.11 * s).setDensity(dHead), new THREE.SphereGeometry(0.11, 8, 6), V(0.27, 0.9, -0.02), 0.11);
  add(RAPIER.ColliderDesc.ball(0.15 * s).setDensity(dBase), new THREE.SphereGeometry(0.15, 8, 6), V(-0.40, 0.05, 0.08), 0.15);        // arms
  add(RAPIER.ColliderDesc.ball(0.15 * s).setDensity(dBase), new THREE.SphereGeometry(0.15, 8, 6), V(0.40, 0.05, 0.08), 0.15);
  add(RAPIER.ColliderDesc.ball(0.16 * s).setDensity(dLeg), new THREE.SphereGeometry(0.16, 8, 6), V(-0.22, -0.38, 0.22), 0.16);        // legs
  add(RAPIER.ColliderDesc.ball(0.16 * s).setDensity(dLeg), new THREE.SphereGeometry(0.16, 8, 6), V(0.22, -0.38, 0.22), 0.16);
  add(RAPIER.ColliderDesc.cuboid(0.3 * s, 0.05 * s, 0.24 * s).setDensity(dLeg), new THREE.BoxGeometry(0.6, 0.1, 0.48), V(0, -0.47, 0.06), 0.05, undefined, 0, true); // seat pad
  scene.add(mesh);
  return { sweetType: md?.id, def, body, mesh, parts, got: false, safe: new THREE.Vector3(def.pos[0], def.pos[1], def.pos[2]), safeQ: q0.clone(), inChuteT: 0, prevVel: 0, colliderHandles: handles, colliders, safeT: 0 };
}
function applyTune() {
  for (const p of prizes) {
    const wBase = 1.6 * p.def.weight * tune.weight;
    if (p.colliders.length === 1) { p.colliders[0].setDensity(4.0 * p.def.weight * tune.weight); p.colliders[0].setFriction(Math.min(2, p.def.friction * tune.friction)); continue; }
    p.colliders.forEach((c, i) => {
      const headish = i >= 1 && i <= 3, leg = i >= 6;
      c.setDensity(wBase * (headish ? 1 - p.def.centerOfMass * 0.5 : leg ? 1 + p.def.centerOfMass * 0.5 : 1));
      c.setFriction(Math.min(2, p.def.friction * tune.friction));
    });
  }
}

// ---------- prize thumbnail (rendered from the same 3D model so list and play match) ----------
let bearThumb = "", figureThumb = "", figureProduct = "";
function renderFigureThumb()                {
  return new Promise(res => {
    const m = MACHINES.find(x => x.kind === "bridge") ; const b = m.bridge ;
    const t = boxTextures(); let pending = 2; const done = () => { if (--pending) return;
      const sc = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0.9, 1.5, 3.4); cam.lookAt(0, 0.05, 0);
      sc.add(new THREE.HemisphereLight(PALETTE.cream, PALETTE.lavender, 1.2)); const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(2, 4, 3); sc.add(k);
      const box = buildBoxVisual(b.box.w, b.box.h, b.box.d); box.rotation.z = Math.PI / 2; box.rotation.y = 0.25; box.position.y = 0.25; sc.add(box);
      const matBar = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.3, metalness: 0.75 });
      for (const sd of [-1, 1]) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 16), matBar); bar.rotation.z = Math.PI / 2; bar.position.set(0, -0.06, sd * 0.36); sc.add(bar); }
      const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false }); r2.setSize(256, 256); r2.toneMapping = THREE.ACESFilmicToneMapping; r2.setClearColor(0, 0); r2.render(sc, cam);
      const c2 = document.createElement("canvas"); c2.width = c2.height = 256; c2.getContext("2d") .drawImage(r2.domElement, 0, 0); figureThumb = c2.toDataURL("image/png");
      // market/product shot: the box standing upright, no bars
      for (const bar of sc.children.filter(o => o !== box && (o              ).isMesh)) sc.remove(bar);
      box.rotation.set(0, 0.35, 0); box.position.y = 0; cam.position.set(0.9, 0.9, 3.2); cam.lookAt(0, 0, 0); r2.render(sc, cam);
      const c3 = document.createElement("canvas"); c3.width = c3.height = 256; c3.getContext("2d") .drawImage(r2.domElement, 0, 0); figureProduct = c3.toDataURL("image/png"); r2.dispose(); res(); };
    const wait = (tex               ) => { if (tex.image) done(); else { const iv = setInterval(() => { if (tex.image) { clearInterval(iv); done(); } }, 50); setTimeout(() => { clearInterval(iv); done(); }, 4000); } };
    wait(t.front); wait(t.side);
  });
}
function renderBearThumb()         {
  if (bearThumb) return bearThumb;
  const sc = new THREE.Scene(); sc.background = null;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0.6, 0.9, 3.2); cam.lookAt(0, 0.3, 0);
  sc.add(new THREE.HemisphereLight(PALETTE.cream, PALETTE.lavender, 1.2));
  const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(2, 4, 3); sc.add(k);
  const b = buildBearVisual(BEAR_FUR[0]); b.rotation.y = -0.25; b.rotation.x = -0.05; sc.add(b);
  const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false }); r2.setSize(256, 256); r2.toneMapping = THREE.ACESFilmicToneMapping; r2.setClearColor(0x000000, 0);
  r2.render(sc, cam);
  const c2 = document.createElement("canvas"); c2.width = c2.height = 256; c2.getContext("2d") .drawImage(r2.domElement, 0, 0);
  bearThumb = c2.toDataURL("image/png"); r2.dispose();
  return bearThumb;
}
// Lumiere figure: user-supplied key visual, cropped to the figure on its right side (object-position), shown everywhere the prize is listed
const figurePreload = new Image(); figurePreload.src = A("assets/lumiere-figure.webp"); // kept decoded in cache: rebuilt cards never show a blank frame
const noctisPreload = new Image(); noctisPreload.src = A("assets/noctis-figure.webp");
const figureImgOf = (src        , size        ) => `<img src="${imgSrc(src)}" style="width:${size}px;height:${size}px;object-fit:contain" alt="">`;
const figureImg = (size        ) => `<img src="${imgSrc("assets/lumiere-figure.webp")}" style="width:${size}px;height:${size}px;object-fit:contain" alt="">`;
const FIGURE_IMG                         = { bear: "assets/bigbear-plush.webp", pillow_pig: "assets/pillow-pig.webp", pillow_rabbit: "assets/pillow-rabbit.webp", pillow_dog: "assets/pillow-dog.webp", figure: "assets/lumiere-figure.webp", noctis: "assets/noctis-figure.webp", cake_set: "assets/cake-plate-front.webp", cake_parfait: "assets/cake-parfait-front.webp", sweet_chips: "assets/sweet-chips.webp", sweet_choco: "assets/sweet-choco.webp", sweet_gummy: "assets/sweet-gummy.webp", sweet_cookie: "assets/sweet-cookie.webp", mascot_bear: "assets/mascot-bear.webp", mascot_rabbit: "assets/mascot-rabbit.webp", mascot_cat: "assets/mascot-cat.webp", mascot_dog: "assets/mascot-dog.webp", mascot_chick: "assets/mascot-chick.webp", mascot_panda: "assets/mascot-panda.webp" };
const snackBoxImg = (size        ) => `<div class="sweetPile" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle">${SWEETS.map(s => `<img src="${imgSrc(s.img)}" alt="">`).join("")}</div>`;
const prizeImgP = (id        , size        ) => id === "snackbox" ? snackBoxImg(size) : FIGURE_IMG[id] ? figureImgOf(FIGURE_IMG[id], size) : prizeImg(id, size);
const MASCOT_HUE                         = { mascot_bear: "hue-rotate(0deg)", mascot_rabbit: "saturate(.2) brightness(1.35)", mascot_cat: "saturate(.15) brightness(.95)", mascot_dog: "hue-rotate(10deg) brightness(1.15)", mascot_chick: "hue-rotate(20deg) saturate(1.6) brightness(1.2)", mascot_panda: "saturate(0) brightness(1.4) contrast(1.3)" };
const prizeImg = (id        , size        ) => id === "snackbox" ? snackBoxImg(size) : FIGURE_IMG[id] ? figureImgOf(FIGURE_IMG[id], size) : MASCOT_HUE[id] && bearThumb ? `<img src="${bearThumb}" style="width:${size}px;height:${size}px;object-fit:contain;filter:${MASCOT_HUE[id]}" alt="">` : FIGURE_IMG[id] ? figureImgOf(FIGURE_IMG[id], size) : id === "figure" && figureThumb ? `<img src="${figureThumb}" style="width:${size}px;height:${size}px;object-fit:contain" alt="">` : id === "bear" && bearThumb ? `<img src="${bearThumb}" style="width:${size}px;height:${size}px;object-fit:contain" alt="">` : PRIZE_ICON[id];

// ---------- layout persistence ----------
function saveLayout() {
  save.layouts[currentMachine.id] = prizes.map(p => { const t = p.body.translation(), r = p.body.rotation(); return { pos: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w], got: p.got, box: p.sweetType }; });
  persist();
}
function restoreLayout() {
  const L = save.layouts[currentMachine.id];
  if (!L || L.length !== prizes.length) return;
  prizes.forEach((p, i) => {
    const s = L[i];
    if (s.box && currentMachine.kind === "bridge" && s.box !== p.sweetType) { p.sweetType = s.box; reboxMesh(p, s.box); }
    p.body.setTranslation({ x: s.pos[0], y: s.pos[1], z: s.pos[2] }, true);
    p.body.setRotation({ x: s.rot[0], y: s.rot[1], z: s.rot[2], w: s.rot[3] }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (s.got) { p.got = true; parkPrize(p); }
    else if (s.pos[1] < -35) { p.body.setEnabled(false); for (const c of p.colliders) c.setEnabled(false); p.mesh.visible = false; }
    else if (currentMachine.kind === "bridge") {
      // migration: an untouched box saved by an older version lay back-face-up; snap it to the machine's (front-up) start pose
      const d = p.def; const q = new THREE.Quaternion(s.rot[0], s.rot[1], s.rot[2], s.rot[3]); const fn = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const nearStart = Math.hypot(s.pos[0] - d.pos[0], s.pos[1] - d.pos[1], s.pos[2] - d.pos[2]) < 0.2;
      if (nearStart && fn.y < -0.5) placeOnBridge(p);
    }
  });
}

// ---------- crane state machine ----------
;                                                                                                                                                                                                                 
const crane = { phase: "ready"         , x: 0, y: 0, z: 0, vx: 0, vz: 0, t: 0, startX: 0, startZ: 0, motorT: 0, liftFx: false, gripped: false, contactY: 0, descendTarget: 0, released: false, releaseSuccess: false, guideT: 0, guideFrom: { x: 0, y: 0, z: 0 }, guidePrize: null                 };
const input = { x: false, z: false };
let inMachine = false;
let missN = 0;

const isOperating = () => !["ready", "fail", "get"].includes(crane.phase);

function resetCrane(m               ) {
  crane.phase = "ready"; crane.x = m.home.x; crane.y = m.home.y; crane.z = m.home.z; crane.vx = 0; crane.vz = 0; crane.t = 0; crane.liftFx = false; crane.gripped = false; crane.releaseSuccess = false; crane.guidePrize = null; setClawPassThrough(false);
  setHeadNow();
  for (const f of fingers) {
    f.body.setTranslation({ x: m.home.x + f.side * m.armWidth * Math.cos(f.yaw), y: m.home.y - 0.15, z: m.home.z - f.side * m.armWidth * Math.sin(f.yaw) }, true); f.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    f.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); f.body.setLinvel({ x: 0, y: 0, z: 0 }, true); f.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    f.joint.configureMotorPosition(f.side * m.openAngle, 60, 8);
  }
  if (spoonBody) { takoTilt = TAKO.claw.openAng * 0.6; spoonPose(); }
  input.x = input.z = false;
  btnX.classList.remove("down"); btnZ.classList.remove("down");
  $("getOverlay").classList.add("hidden"); $("missTag").classList.add("hidden");
  updateStep();
}
function setHeadNow() { clawHead.setTranslation({ x: crane.x, y: crane.y, z: crane.z }, true); clawHead.setNextKinematicTranslation({ x: crane.x, y: crane.y, z: crane.z }); }

function resetPrizes() {
  if (currentMachine.kind === "takoyaki") { takoResetPlate(); takoState().got = 0; updateTakoStock(); persist(); updateLeftTag(); return; }
  suck = null; if (restock) { scene.remove(restock.box); restock = null; if (staffHand) scene.remove(staffHand); } restockHold = null;
  for (const p of prizes) {
    const d = p.def;
    if (p.got) unparkPrize(p);
    p.body.setTranslation({ x: d.pos[0], y: d.pos[1], z: d.pos[2] }, true);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d.rot[0], d.rot[1], d.rot[2]));
    p.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp();
    p.inChuteT = 0; p.safe.set(d.pos[0], d.pos[1], d.pos[2]); p.safeQ.copy(q);
  }
  if (currentMachine.kind === "bridge") bridgeSetup();
  saveLayout(); updateLeftTag();
}

function updateStep() {
  const ph = crane.phase;
  const s1 = ph === "idle_x" || ph === "moving_x", s2 = ph === "idle_z" || ph === "moving_z";
  const ready = ph === "ready" || ph === "fail";
  btnPlay.classList.toggle("hidden", !ready); btnX.classList.toggle("hidden", !s1); btnZ.classList.toggle("hidden", !s2);
  const auto = !ready && ph !== "get" && ph !== "restock";
  $("step").textContent = s1 ? T("step1") : s2 ? T("step2") : auto ? T("stepAuto") : "";
  $("step").style.visibility = s1 || s2 || auto ? "visible" : "hidden";
  $("hint").textContent = s1 || s2 ? T("holdHint") : "";
  $("hint").style.visibility = s1 || s2 ? "visible" : "hidden";
  const canPay = wallet.canPlay();
  // ⚠️ 没钱时**不能** disabled：disabled 的按钮连 click 事件都不发，新玩家会卡在
  // 「余额不足」上永远走不到买币面板（实测：点一下毫无反应，看起来像按钮坏了）。
  // 改成按钮文字变「买娃娃机币」，点进去就是买币面板。
  btnPlay.disabled = false;
  $("noCoins").classList.toggle("hidden", !(ready && !canPay)); $("noCoins").textContent = T("coinsShort");
  btnPlay.innerHTML = !canPay
    ? `${T("buyCoins")} <small>${COIN.emoji} ${wallet.coins}</small>`
    : ph === "fail" ? `${T("again")} <small>${currentMachine.price} ${COIN.emoji}</small>` : `${T("playBtn")} <small>${currentMachine.price} ${COIN.emoji}</small>`;
}

let paying = false;
/**
 * 开一局。
 *
 * ⚠️ 是 async 的，因为扣币要等宿主的事务（IndexedDB 写入，几毫秒）。
 * 这中间有一个真实的竞态窗口：`crane.phase` 还是 "ready"，连点两下会两次都过守卫。
 * 所以两道锁：这里的 `paying`，和钱包内部的 `serial`。
 */
async function startPlay() {
  void startMusic(); reassertMusic(); // PLAY tap is a real gesture: unlock + (re)assert the play BGM in the same tap, idempotent (runtime swaps state, never stacks)
  if (!inMachine || !(crane.phase === "ready" || crane.phase === "fail")) return;
  if (paying) return;
  if (!wallet.canPlay()) { void sfx("ui.tap"); openBuySheet(); return; }

  paying = true;
  let paid = false;
  try { paid = await wallet.pay(currentMachine.price); } finally { paying = false; }
  if (!alive) return;
  if (!paid) { void sfx("ui.tap"); openBuySheet(); return; }
  if (!inMachine) return;   // 付完这几毫秒里玩家退出了机台

  notePlay(currentMachine.id); sweetsArmed = true; persist(); refreshTexts();
  $("missTag").classList.add("hidden");
  void sfx("play.start");
  crane.phase = "idle_x"; crane.t = 0; updateStep();
}
function openBuySheet() {
  const can = wallet.affordable();
  const n = Math.min(5, can);
  const cost = n * POINTS_PER_COIN;
  const sh = $("paySheet");
  sh.innerHTML = `<h3>${COIN.emoji} ${T("buyCoins")}</h3>
    <div class="dim">${T("coinsShort")} · ${T("owned")} ${COIN.emoji} ${wallet.coins}</div>
    <div class="calc"><div><span>${T("pointsLeft")}</span><span>🪙 ${wallet.points}</span></div><div><span>${T("buyN").replace("{n}", String(n))}</span><span>${COIN.emoji} +${n} · 🪙 -${cost}</span></div></div>
    <div class="row"><button class="pill" id="buyNo">${T("cancel")}</button><button class="pill pink" id="buyYes" ${n <= 0 ? "disabled" : ""}>${T("buyN").replace("{n}", String(n))}</button></div>`;
  $("payModal").classList.remove("hidden");
  $("buyNo").addEventListener("click", () => { void sfx("ui.tap"); $("payModal").classList.add("hidden"); });
  $("buyYes").addEventListener("click", async () => {
    if (n <= 0) return;
    const ok = await wallet.buy(n);
    $("payModal").classList.add("hidden");
    if (!ok) { toast(T("buyFail")); return; }
    void sfx("prize.get"); toast(`${COIN.emoji} +${n}`); refreshTexts();
  });
}

function smoothVel(v        , target        , m               , dt        , max        ) {
  const rate = target > 0 ? max / m.accelTime : max / m.decelTime;
  return v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt);
}
const ease = (k        ) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function showFlash(txt        ) { const f = $("flash"); f.textContent = txt; f.classList.remove("hidden", "pop"); void f.offsetWidth; f.classList.add("pop"); }
function clawTipY() { let y = Infinity; for (const f of fingers) { const t = f.body.translation(), r = f.body.rotation(); tmpQ.set(r.x, r.y, r.z, r.w); tmpV.set(0, -currentMachine.fingerLen, 0).applyQuaternion(tmpQ).add(t       ); y = Math.min(y, tmpV.y); } return y; }

function craneTick(dt        ) {
  if (!clawHead) return;
  const m = currentMachine;
  if (m.kind === "takoyaki") { takoTick(dt); clawHead.setNextKinematicTranslation({ x: crane.x, y: crane.y, z: crane.z }); return; }
  crane.t += dt;
  switch (crane.phase) {
    case "idle_x":
      if (input.x) { crane.phase = "moving_x"; updateStep(); void sfx("crane.motor"); crane.motorT = 0; }
      break;
    case "moving_x": {
      crane.vx = smoothVel(crane.vx, input.x ? m.speedX : 0, m, dt, m.speedX);
      crane.x = Math.min(m.limits.xMax, crane.x + crane.vx * dt);
      if (input.x) { crane.motorT += dt; if (crane.motorT > 1.4) { crane.motorT = 0; void sfx("crane.motor"); } }
      if (!input.x && crane.vx <= 0.001) { crane.vx = 0; crane.phase = "idle_z"; updateStep(); void sfx("crane.confirm"); }
      break;
    }
    case "idle_z":
      if (input.z) { crane.phase = "moving_z"; updateStep(); void sfx("crane.motor"); crane.motorT = 0; }
      break;
    case "moving_z": {
      crane.vz = smoothVel(crane.vz, input.z ? m.speedZ : 0, m, dt, m.speedZ);
      crane.z = Math.max(m.limits.zMin, crane.z - crane.vz * dt);
      if (input.z) { crane.motorT += dt; if (crane.motorT > 1.4) { crane.motorT = 0; void sfx("crane.motor"); } }
      if (!input.z && crane.vz <= 0.001) { crane.vz = 0; crane.phase = "catchgo"; crane.t = 0; updateStep(); void sfx("crane.confirm"); showFlash(T("catchGo")); void sfx("catch.go"); }
      break;
    }
    case "catchgo":
      if (crane.t >= 0.8) { crane.phase = "open"; crane.t = 0; $("flash").classList.add("hidden"); void sfx("claw.open"); }
      break;
    case "open": {
      crane.gripped = false;
      // arms spread to full open (they are already open; this is the visible "arms open" beat)
      const a = m.openAngle - 0.18 * (1 - Math.sin(Math.min(1, crane.t / 0.5) * Math.PI / 2));
      for (const f of fingers) f.joint.configureMotorPosition(f.side * a, 60, 8);
      if (crane.t >= 0.5) { crane.phase = "descend"; crane.t = 0; setClawPassThrough(false); crane.descendTarget = m.home.y - m.descentDistance; void sfx("crane.descend"); }
      break;
    }
    case "descend": {
      // constant-speed descent that stops when the claw tips touch a prize or the floor
      const speed = m.descentDistance / m.descentTime;
      crane.y = Math.max(crane.descendTarget, crane.y - speed * dt * (crane.t < 0.3 ? crane.t / 0.3 : 1));
      const tipY = clawTipY();
      let touching = false;
      for (const f of fingers) for (const c of [f.body.collider(0), f.body.collider(1)]) world.contactPairsWith(c, other => { if (prizes.some(p => !p.got && p.colliderHandles.has(other.handle))) touching = true; });
      const floorStop = tipY < 0.06;
      // bridge claw: after first touching the box it keeps pressing another 0.2 then stalls (a real motor stalls under load) — enough to tilt, not to slam
      // after first touching a prize the claw keeps descending a little so the fingers wrap below the widest part instead of pinching the very top
      if (touching && crane.t > 0.4 && !crane.gripped) { crane.gripped = true; crane.contactY = crane.y; }
      const pushDepth = 0.42;
      // bridge: touching the box is NOT a stop condition — the claw runs down until the tips reach bar level (slightly below the bar top) so they can slide under the box
      const barStop = m.minClawY !== undefined && crane.y <= m.minClawY;
      const contactStop = m.kind !== "bridge" && crane.gripped && crane.y < crane.contactY - pushDepth;
      if (crane.y <= crane.descendTarget + 0.001 || floorStop || barStop || (contactStop && crane.t > 0.4)) { crane.phase = "close"; crane.t = 0; crane.contactY = crane.y; void sfx("claw.close"); }
      break;
    }
    case "close": {
      const k = Math.min(1, crane.t / m.closeTime);
      const a = m.openAngle + (m.closedAngle - m.openAngle) * k;
      const strength = 60 * m.armPower * tune.armPower;
      for (const f of fingers) f.joint.configureMotorPosition(f.side * a, strength, 8);
      if (k >= 1) { crane.phase = "hold"; crane.t = 0; }
      break;
    }
    case "hold":
      if (crane.t >= m.holdTime) { crane.phase = "lift"; crane.t = 0; crane.liftFx = false; void sfx("crane.descend"); }
      break;
    case "lift": {
      const k = Math.min(1, crane.t / m.liftTime);
      crane.y = crane.contactY + (m.home.y - crane.contactY) * ease(k);
      gripTick();
      if (!crane.liftFx) for (const p of prizes) if (!p.got && p.body.translation().y > 1.35 && p.body.linvel().y > 0.15) { crane.liftFx = true; zoomTarget = 0.94; }
      if (k >= 1) { crane.phase = "home"; crane.t = 0; crane.startX = crane.x; crane.startZ = crane.z; void sfx("crane.motor"); }
      break;
    }
    case "home": {
      const k = Math.min(1, crane.t / m.homeTime);
      const e = ease(k);
      crane.x = crane.startX + (m.home.x - crane.startX) * e; crane.z = crane.startZ + (m.home.z - crane.startZ) * e;
      // gantry sway: small vertical bob while travelling — the hanging prize swings and may slip
      crane.y = m.home.y - 0.03 * Math.sin(k * Math.PI * 3);
      gripTick();
      if (k >= 1) { crane.y = m.home.y; if (m.kind === "grab" && heldPrize()) { crane.phase = "align"; crane.t = 0; } else { crane.phase = "release"; crane.t = 0; zoomTarget = 1; void sfx("claw.open"); } }
      break;
    }
    case "align": {
      // GRAB machines: a prize still held at the release point is the player's success. Lock it in (releaseSuccess),
      // drop claw contacts so nothing can hook it, and guide the prize's centre over the chute with a short 0.25s glide.
      const held = heldPrize();
      if (!held) { crane.phase = "release"; crane.t = 0; zoomTarget = 1; void sfx("claw.open"); break; }
      if (!crane.releaseSuccess) {
        crane.releaseSuccess = true; crane.guidePrize = held; crane.guideT = 0;
        const t = held.body.translation(); crane.guideFrom = { x: t.x, y: t.y, z: t.z };
        setClawPassThrough(true);
        held.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      }
      const ch = m.chute; const p = crane.guidePrize ;
      crane.guideT = Math.min(1, crane.guideT + dt / 0.25);
      const e = ease(crane.guideT); const gy = Math.max(crane.guideFrom.y, 1.6);
      p.body.setNextKinematicTranslation({ x: crane.guideFrom.x + (ch.cx - crane.guideFrom.x) * e, y: crane.guideFrom.y + (gy - crane.guideFrom.y) * e, z: crane.guideFrom.z + (ch.cz - crane.guideFrom.z) * e });
      if (crane.guideT >= 1 && crane.t > 0.3) { crane.phase = "release"; crane.t = 0; zoomTarget = 1; void sfx("claw.open"); }
      break;
    }
    case "release": {
      // gantry fully stopped; open both fingers to the maximum (past the normal idle angle) and never move sideways while a prize is near
      const k = Math.min(1, crane.t / m.releaseTime);
      // BIG Bear gets a firm physical release: the opening motor must overcome plush friction
      // instead of leaving the bear hanging between the fingers. Other grab machines keep their tuned opening.
      const target = m.kind === "grab" ? m.openAngle + (m.id === "big-bear" ? 0.5 : 0.35) : m.openAngle;
      const a = m.closedAngle + (target - m.closedAngle) * k;
      const releaseStrength = m.id === "big-bear" ? 110 : 80;
      for (const f of fingers) f.joint.configureMotorPosition(f.side * a, releaseStrength, 10);
      if (k >= 1) {
        crane.phase = "settle"; crane.t = 0; crane.released = false;
        const gp = crane.guidePrize;
        if (gp && crane.releaseSuccess) { gp.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); gp.body.setLinvel({ x: 0, y: 0, z: 0 }, true); gp.body.setAngvel({ x: 0, y: 0, z: 0 }, true); gp.body.wakeUp(); }
      }
      break;
    }
    case "settle": {
      const allSleep = prizes.every(p => p.got || p.body.isSleeping() || (Math.hypot(p.body.linvel().x, p.body.linvel().y, p.body.linvel().z) < 0.05));
      const hanging = prizes.filter(p => !p.got && p !== suck?.p && p.body.translation().y > 2.2);
      if (m.kind === "grab") {
        // no shaking: after a 0.3s pause the claw only retreats straight UP a few cm and waits; a prize still hung after 1.2s is released by dropping claw contacts
        const lift = crane.t < 0.3 ? 0 : Math.min(0.05, (crane.t - 0.3) * 0.08);
        crane.y = m.home.y + lift;
        const releaseStrength = m.id === "big-bear" ? 110 : 80;
        const releaseAngle = m.openAngle + (m.id === "big-bear" ? 0.5 : 0.35);
        for (const f of fingers) f.joint.configureMotorPosition(f.side * releaseAngle, releaseStrength, 10);
        if (hanging.length) { for (const p of hanging) p.body.wakeUp(); if (crane.t > 1.2 && !crane.released) { crane.released = true; setClawPassThrough(true); } }
        else if (!crane.released) crane.released = true; // prize has left the claw
        // return home only after the prize is clear of the claw and at rest (or after the timeout)
        if ((crane.t > 1.0 && allSleep && !hanging.length) || crane.t >= m.settleMax + 2) { crane.y = m.home.y; crane.x = m.home.x; crane.z = m.home.z; setClawPassThrough(false); crane.phase = "back"; crane.t = 0; }
      } else {
        if (hanging.length && crane.t > 0.5) {
          crane.y = m.home.y + Math.sin(crane.t * 28) * 0.05; crane.x = m.home.x + Math.sin(crane.t * 19) * 0.04;
          for (const p of hanging) p.body.wakeUp();
          if (crane.t > 1.2) setClawPassThrough(true);
        } else { crane.y = m.home.y; crane.x += (m.home.x - crane.x) * Math.min(1, dt * 3); crane.z += (m.home.z - crane.z) * Math.min(1, dt * 3); }
        if ((crane.t > 0.8 && allSleep && !hanging.length) || crane.t >= m.settleMax + 2) { crane.y = m.home.y; crane.x = m.home.x; setClawPassThrough(false); crane.phase = "back"; crane.t = 0; }
      }
      break;
    }
    case "ready": case "fail": {
      for (const f of fingers) { const p = f.body.translation(); const tx = crane.x + f.side * m.armWidth * Math.cos(f.yaw), ty = crane.y - 0.15; if (Math.abs(p.x - tx) > 0.05 || Math.abs(p.y - ty) > 0.05) { f.body.setTranslation({ x: tx, y: ty, z: crane.z }, true); f.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); f.body.setLinvel({ x: 0, y: 0, z: 0 }, true); f.body.setAngvel({ x: 0, y: 0, z: 0 }, true); } f.joint.configureMotorPosition(f.side * m.openAngle, 60, 8); }
      break;
    }
    case "back":
      // crane is already home; short beat before the miss message. Sweets: wait until the pile has finished sliding (max 4s), then one summary
      if (m.kind === "sweets") { if ((crane.t >= 0.8 && !sweetsStillMoving()) || crane.t >= 4) { if (Object.keys(sweetHaul).length) showSweetHaul(); else { crane.phase = "fail"; onMiss(); } } break; }
      if (m.mascot && mascotPendingGets > 0) {
        const allSleep = prizes.every(p => p.got || p.body.isSleeping() || Math.hypot(p.body.linvel().x, p.body.linvel().y, p.body.linvel().z) < 0.05);
        if ((crane.t >= 0.8 && !suck && allSleep) || crane.t >= 4) {
          const haul = mascotHaul; mascotPendingGets = 0; mascotLastGet = null; mascotHaul = [];
          crane.phase = "get"; updateStep();
          const counts                         = {}; let anyNew = false;
          for (const h of haul) { counts[h.id] = (counts[h.id] ?? 0) + 1; if (h.isNew) anyNew = true; }
          const items = Object.entries(counts); const total = haul.length;
          fxGet({ x: m.chute.cx, y: 0.8, z: m.chute.cz }); void sfx("prize.get");
          $("getIcon").innerHTML = items.map(([id]) => prizeImg(id, items.length > 1 ? 70 : 150)).join("");
          $("newTag").classList.toggle("hidden", !anyNew);
          if (total <= 1) $("getMsg").textContent = T("gotFmt").replace("{name}", prizeName(items[0][0]));
          else $("getMsg").innerHTML = items.map(([id, n]) => `${prizeName(id)} ×${n}`).join("<br>") + `<br><b>${T("gotMany").replace("{n}", `${total}`)}</b>`;
          $("allClear").classList.add("hidden"); $("getAgain").textContent = T("playAgain");
          $("getOverlay").classList.remove("hidden"); spawnConfetti(); if (total > 1) void sfx("result.fanfare");
        }
        break;
      }
      if (crane.t >= 0.5 && !suck) { crane.phase = "fail"; onMiss(); }
      break;
  }
  clawHead.setNextKinematicTranslation({ x: crane.x, y: crane.y, z: crane.z });
}
// grip strength decays with load: heavy / off-centre prizes overpower the motors and slip
function heldPrize()               {
  let best               = null;
  for (const p of prizes) { if (p.got) continue; const t = p.body.translation(); if (t.y > 2.2 && Math.abs(t.x - crane.x) < 0.7 && Math.abs(t.z - crane.z) < 0.7) best = p; }
  return best;
}
function gripTick() {
  const m = currentMachine;
  if (m.kind === "bridge") return; // bridge claw: weak fixed squeeze, boxes are nudged not carried
  let load = 0, gripped               = null;
  for (const p of prizes) {
    if (p.got) continue;
    const t = p.body.translation();
    if (t.y > 0.9 && Math.abs(t.x - crane.x) < 0.7 && Math.abs(t.z - crane.z) < 0.7) { gripped = p; load = p.body.mass(); }
  }
  if (!gripped) return;
  const mod = gripped.def.grabPowerModifier;
  // lift/carry grip runs 10% below the closing squeeze: the prize hangs a little looser while being carried
  const strength = 60 * m.armPower * tune.armPower * mod * 0.9;
  // the further the prize's centre hangs from the claw axis, the weaker the effective pinch
  const t = gripped.body.translation();
  const off = Math.hypot(t.x - crane.x, t.z - crane.z);
  // centred, two-finger holds keep full strength; only clearly off-axis (one-sided) holds weaken and may slip
  const eff = strength * Math.max(0.35, 1 - Math.max(0, off - 0.25) * 1.2) / Math.max(0.6, load / 1.8);
  for (const f of fingers) f.joint.configureMotorPosition(f.side * m.closedAngle, eff, 8);
}
function onMiss() {
  missN++; afterPlayBusyCheck(); crane.releaseSuccess = false; crane.guidePrize = null;
  const tag = $("missTag"); tag.textContent = missN % 2 ? T("miss1") : T("miss2"); tag.classList.remove("hidden"); void tag.offsetWidth;
  void sfx("result.miss");
  saveLayout(); updateStep();
}

// ---------- GET / safety ----------
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
function prizeInChute(p       , m               )          {
  const t = p.body.translation(), r = p.body.rotation();
  if (crane.releaseSuccess && p === crane.guidePrize && t.y < -0.2 && Math.abs(t.x - m.chute.cx) < m.chute.w / 2 && Math.abs(t.z - m.chute.cz) < m.chute.d / 2) return true;
  tmpQ.set(r.x, r.y, r.z, r.w);
  const ch = m.chute;
  const tol = 0.03;
  for (const part of p.parts) {
    for (const e of [part.a, part.b]) {
      tmpV.copy(e).applyQuaternion(tmpQ).add(t       );
      if (tmpV.x - part.r < ch.cx - ch.w / 2 - tol || tmpV.x + part.r > ch.cx + ch.w / 2 + tol) return false;
      if (tmpV.z - part.r < ch.cz - ch.d / 2 - tol || tmpV.z + part.r > ch.cz + ch.d / 2 + tol) return false;
      if (tmpV.y + part.r > 0) return false;
    }
  }
  return true;
}
let getPending = 0;
let mascotPendingGets = 0;
let mascotLastGet                                        = null;
let mascotHaul                                   = [];
// a "got" prize leaves the world: disabled colliders still register contacts in this rapier build, so also park it far below the cabinet
function parkPrize(p       ) { p.mesh.visible = false; for (const c of p.colliders) c.setEnabled(false); p.body.setTranslation({ x: 0, y: -30 - 3 * prizes.indexOf(p), z: 0 }, false); p.body.setLinvel({ x: 0, y: 0, z: 0 }, false); p.body.setAngvel({ x: 0, y: 0, z: 0 }, false); p.body.setEnabled(false); }
function unparkPrize(p       ) { p.got = false; p.mesh.visible = true; p.body.setEnabled(true); for (const c of p.colliders) { c.setEnabled(true); c.setCollisionGroups(grp(GROUP_PRIZE, GROUP_STATIC | GROUP_PRIZE | GROUP_CLAW)); } if (p.body.bodyType() !== RAPIER.RigidBodyType.Dynamic) p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); setPrizeOpacity(p, 1); }
function setPrizeOpacity(p       , a        ) {
  p.mesh.traverse(o => { const mm = (o              ).material                                          ; if (!mm || !("opacity" in mm)) return; mm.transparent = a < 1; mm.opacity = a; mm.depthWrite = a >= 1; mm.needsUpdate = false; });
}
// GRAB machines: the chute is not a final obstacle. Once the prize's centre of mass is inside the (slightly widened) GET zone
// physics stops for it: contacts with the claw and the chute rim are dropped and the prize glides into the hole centre and fades.
let suck                                                                                                 = null;
const SUCK_TIME = 0.35;
function grabCentreInZone(p       , m               )          {
  // only after the claw has let go (never while descending/gripping over the hole); a bear resting on the rim has its centre at ~0.5
  if (!(crane.phase === "release" || crane.phase === "settle" || crane.phase === "back" || crane.phase === "fail" || crane.phase === "ready")) return false;
  const t = p.body.translation(), ch = m.chute, pad = 0.18;
  return t.y < 0.75 && t.y < crane.y - 1.2 && Math.abs(t.x - ch.cx) < ch.w / 2 + pad && Math.abs(t.z - ch.cz) < ch.d / 2 + pad;
}
function startSuck(p       ) {
  const t = p.body.translation(), r = p.body.rotation();
  suck = { p, t: 0, from: { x: t.x, y: t.y, z: t.z }, q: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
  p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  for (const c of p.colliders) c.setCollisionGroups(grp(GROUP_PRIZE, 0));
  setClawPassThrough(true); crane.releaseSuccess = true; crane.released = true;
  p.inChuteT = 0;
}
function suckTick(dt        , m               ) {
  if (!suck) return;
  const s = suck; s.t += dt; const k = Math.min(1, s.t / SUCK_TIME); const e = ease(k);
  const ch = m.chute; const ty = Math.min(s.from.y, 0.1) - 0.95;
  s.p.body.setNextKinematicTranslation({ x: s.from.x + (ch.cx - s.from.x) * e, y: s.from.y + (ty - s.from.y) * e, z: s.from.z + (ch.cz - s.from.z) * e });
  setPrizeOpacity(s.p, k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.55));
  if (k >= 1) { const p = s.p; suck = null; setPrizeOpacity(p, 1); p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); onGet(p); }
}
function onGet(p       ) {
  chuteFlash(); p.got = true; const prizeTypeId = p.sweetType ?? currentMachine.prizeId; noteGet(currentMachine.id); afterPlayBusyCheck();
  parkPrize(p);
  const m = currentMachine;
  if (m.mascot) { mascotPendingGets++; mascotLastGet = { id: prizeTypeId, isNew: !(save.gotCounts[prizeTypeId] ?? 0) }; mascotHaul.push(mascotLastGet); crane.phase = "back"; crane.t = 0; updateStep(); }
  else { crane.phase = "get"; updateStep(); }
  crane.x = m.home.x; crane.y = m.home.y; crane.z = m.home.z; setClawPassThrough(false); crane.releaseSuccess = false; crane.guidePrize = null;
  for (const f of fingers) f.joint.configureMotorPosition(f.side * m.openAngle, 60, 8);
  const id = prizeTypeId;
  const isNew = !(save.gotCounts[id] ?? 0);
  save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; save.stock[id] = (save.stock[id] ?? 0) + 1;
  if (isNew) save.firstGot[id] = new Date().toISOString().slice(0, 10);
  // `refreshBar()` 必须在抓到的当场就调：动作条以前只在首页，抓到娃娃时玩家
  // 已经不在首页了，所以漏调也看不出来；现在它就摆在娃娃界面底部，
  // 角标不动 = 玩家以为没抓到（实测：stock.bear 已是 1，角标还写着 0）。
  saveLayout(); updateLeftTag(); updateStock(); refreshBar();
  const allDone = prizes.every(q => q.got);
  getPending = window.setTimeout(() => {
    if (m.mascot) return;
    fxGet({ x: m.chute.cx, y: 0.8, z: m.chute.cz });
    void sfx("prize.get");
    if (allDone) setTimeout(() => void sfx("result.fanfare"), 900);
    $("getIcon").innerHTML = prizeImg(id, 150);
    $("newTag").classList.toggle("hidden", !isNew);
    $("getMsg").textContent = T("gotFmt").replace("{name}", prizeName(id));
    $("allClear").textContent = m.kind === "bridge" && allDone ? T("noMoreHere") : T("allClear"); $("allClear").classList.toggle("hidden", !allDone);
    $("getAgain").textContent = allDone ? T("refill") : T("playAgain");
    const ov = $("getOverlay"); ov.classList.remove("hidden");
    spawnConfetti();
  }, 500);
}
function spawnConfetti() {
  const c = $("confetti"); c.innerHTML = "";
  const cols = [hex(PALETTE.pink), hex(PALETTE.lavender), hex(PALETTE.mint), hex(PALETTE.cream), "#ffd166"];
  for (let i = 0; i < 70; i++) {
    const d = document.createElement("div"); d.className = "cf";
    d.style.left = `${(i * 37) % 100}%`; d.style.background = cols[i % cols.length];
    d.style.animationDuration = `${2.2 + (i % 5) * 0.35}s`; d.style.animationDelay = `${(i % 7) * 0.12}s`;
    d.style.transform = `rotate(${(i * 53) % 360}deg)`;
    c.appendChild(d);
  }
}
function safetyTick(p       , m               , dt        ) {
  if (p === crane.guidePrize && crane.releaseSuccess && crane.phase === "align") return;
  if (suck && suck.p === p) return;
  const t = p.body.translation();
  const out = Math.abs(t.x) > m.caseW / 2 + 0.6 || Math.abs(t.z) > m.caseD / 2 + 0.6 || t.y < -m.chute.depth - 1 || t.y > m.caseH + 1;
  if (out) {
    p.body.setTranslation({ x: p.safe.x, y: p.safe.y + 0.3, z: p.safe.z }, true);
    p.body.setRotation({ x: p.safeQ.x, y: p.safeQ.y, z: p.safeQ.z, w: p.safeQ.w }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    return;
  }
  p.safeT += dt;
  if (p.safeT > 0.5 && t.y > 0.2 && Math.abs(t.x) < m.caseW / 2 - 0.3 && Math.abs(t.z) < m.caseD / 2 - 0.3) { p.safeT = 0; p.safe.set(t.x, t.y, t.z); const r = p.body.rotation(); p.safeQ.set(r.x, r.y, r.z, r.w); }
}

// ---------- FX ----------
let fxImpulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
// the single FX frontend; created at boot right after the first paint (before the frame loop starts)
function fxSpark(pos     , power        ) {
  fx.play("light-hit", { pos: new THREE.Vector3(pos.x, pos.y, pos.z), power });
}
function fxDust(pos     , power        ) {
  fx.play("land-dust", { pos: new THREE.Vector3(pos.x, pos.y, pos.z), power });
}
function fxGet(pos     ) {
  fx.play("legendary-reward", { pos: new THREE.Vector3(pos.x, pos.y, pos.z), power: 0.9 });
}

// ---------- home ----------
/**
 * 底部动作条的标签与角标（照农场「种子 / 动物 / 市场」那一排）。
 *
 * 标签**没进 i18n.js**：那张表是原版游戏的，一动就是三个语言对象、每个几千字一行，
 * 风险比收益大。三个词跟着这一排磁贴走，改文案只改这里。
 *
 * 两个角标故意不是同一个数：
 *   🎁 背包 = 你**有几种**娃娃（灰底，纯信息）
 *   ♻️ 回收 = 能卖**几个**（红底，是「有东西可做」的提示 —— 对应农场「市场」那颗红点）
 * 同一个数出现两次会让人以为算错了。
 */
const BAR_TXT = {
  ja: { col: "もちもの", rank: "ランキング" },
  en: { col: "Bag", rank: "Rank" },
  zh: { col: "背包", rank: "排行" },
};
function refreshBar() {
  if (!alive) return;
  const lb = BAR_TXT[lang] ?? BAR_TXT.zh;
  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  set("colLbl", lb.col); set("rankLbl", lb.rank);

  // 背包只有一个格子了 ⇒ 角标显示「能卖几件」（原来是回收格子的数）。
  // 「有几种」那个数已经没用：种类在背包里一眼就看得见，件数才是「有东西可做」。
  let units = 0;
  for (const n of Object.values(save.stock ?? {})) { if ((n ?? 0) > 0) units += n; }
  for (const sd of SWEETS) { const q = save.snacks?.[sd.id]?.quantity ?? 0; if (q > 0) units += q; }

  const cc = $("colCnt");
  if (cc) { cc.textContent = String(units); cc.classList.toggle("zero", units <= 0); }
}
$("settingsBtn").addEventListener("click", () => { void sfx("ui.tap"); void startMusic(); openSettings(); });
function openSettings() {
  const a = audioPrefs(); const sh = $("settingsSheet");
  sh.innerHTML = `<h3>${T("settings")}</h3>
    <div class="setRow"><span>${T("bgm")}</span><button class="pill tog ${a.bgm ? "on" : ""}" id="setBgm">${a.bgm ? T("bgmOn") : T("bgmOff")}</button></div>
    <div class="setRow"><span>${T("volBgm")}</span><input type="range" id="setMusic" min="0" max="100" value="${Math.round(a.music * 100)}"></div>
    <div class="setRow"><span>${T("volSfx")}</span><input type="range" id="setSfx" min="0" max="100" value="${Math.round(a.sfx * 100)}"></div>
    <div class="setRow"><span>${T("lang")}</span><button class="pill" id="setLang">${lang.toUpperCase()}</button></div>
    <button class="pill" id="setClose">${T("close2")}</button>`;
  $("settingsModal").classList.remove("hidden");
  const bgmBtn = $("setBgm");
  bgmBtn.addEventListener("click", () => { a.bgm = !a.bgm; bgmBtn.textContent = a.bgm ? T("bgmOn") : T("bgmOff"); bgmBtn.classList.toggle("on", a.bgm); applyAudioPrefs(); persist(); void sfx("ui.tap"); });
  ($("setMusic")                    ).addEventListener("input", e => { a.music = Number((e.target                    ).value) / 100; applyAudioPrefs(); persist(); });
  ($("setSfx")                    ).addEventListener("input", e => { a.sfx = Number((e.target                    ).value) / 100; applyAudioPrefs(); persist(); });
  ($("setSfx")                    ).addEventListener("change", () => { void sfx("ui.tap"); });
  $("setLang").addEventListener("click", () => { const ks = Object.keys(LANGS)             ; lang = ks[(ks.indexOf(lang) + 1) % ks.length]; persist(); refreshTexts(); void sfx("ui.tap"); openSettings(); });
  $("setClose").addEventListener("click", () => { $("settingsModal").classList.add("hidden"); void sfx("ui.tap"); });
}

// ---------- 回收站（卖掉娃娃换兑换券）----------
// 这里原来是「跳蚤市场」：自己挂价 → 假买家每 6 秒逛一次 → 卖掉进「销售额」钱包，
// 而那个钱包还能直接付游玩费。三件事一起坏：
//   ① 价格是玩家自己定的 ⇒ 自己挂 1 万卖给自己，任何闸门都拦不住；
//   ② 卖出能换游玩费 ⇒ 抓娃娃本身能赚钱 = 印钞机（原版没有期望值不变量）；
//   ③ 200 行假买家 / 点赞 / 行情漂移，玩家既看不懂也改不了（行情不归他管）。
// 现在：**固定回收价**（只由稀有度决定，见 recycle.js）+ 一键回收 → 直接发兑换券。
// ⚠️ 出口是**券**不是币（2026-10-23 改）。给币的话币就有了第二个来源，而币能直接开局
// ⇒ 抓娃娃本身能续玩，回收价调到多低都拦不住（1 币 + 100% 抓到 = 永动机）。
// 玩家剩下的唯一决策是「现在卖还是留着看」，这正是我们要的那个决策。

/** 手上还有几个。⚠️ 不是 `gotCounts` —— 那个是「一共抓到过几个」，只增不减，
 *  它同时是图鉴进度（`compRate()` 拿它算收集率）。卖掉娃娃不该让图鉴倒退。 */
function stockOf(id) { return save.stock?.[id] ?? 0; }


/* ---------------- 游戏币 → 兑换券（「积分 → 币 → 券」的最后一跳） ---------------- */

/**
 * 这三行文案**没有进 i18n.js**：那张表是原版游戏的，改它要动三个语言对象
 * （每个都是一整行几千字），风险比收益大。这里单独一小份，跟着这个功能走。
 */
const REDEEM_TXT = {
  ja: { tip: "コイン", rate: "枚でクーポン1枚", btn: "クーポンに交換", empty: "ポイントでコインを買おう", ok: "クーポン +{n}", fail: "交換できませんでした" },
  en: { tip: "coins", rate: "coins = 1 coupon", btn: "Convert to coupons", empty: "Buy some coins with points first", ok: "Coupons +{n}", fail: "Couldn't convert" },
  zh: { tip: "币", rate: "币 = 1 张兑换券", btn: "换成兑换券", empty: "先用积分换几个币吧", ok: "兑换券 +{n}", fail: "没能换成兑换券" },
};
const rt = (k) => (REDEEM_TXT[lang] ?? REDEEM_TXT.zh)[k] ?? k;

/**
 * 重画「换成兑换券」那一行。
 *
 * ⚠️ 按钮**不 disabled**。0 币时它仍然可点，点了给一句「先去抓娃娃换几个币吧」——
 *    `disabled` 的按钮连 click 都不发，孩子只会觉得「这个按钮坏了」
 *    （`sellBtn` 的注释里记过同一条）。
 */
function refreshRedeemBar() {
  const tip = $("rcTip"), btn = $("rcVoucher");
  if (!tip || !btn) return;
  if (!(voucherPerCoin > 0)) { tip.textContent = ""; btn.classList.add("hidden"); return; }
  btn.classList.remove("hidden");
  tip.textContent = `${COIN.emoji} ${wallet.coins} ${rt("tip")} · ${voucherPerCoin} ${rt("rate")}`;
  btn.textContent = wallet.coins > 0 ? `${rt("btn")} ×${wallet.coins}` : rt("btn");
}

/**
 * 把当前所有币换成兑换券。
 *
 * ★ 发多少券**由宿主决定**（它按已安装 manifest 里的汇率算），这里只传「换几个」。
 *   所以界面显示的是**返回值**，不是自己乘出来的数 —— 两边算法不一致时，
 *   玩家看到的就是真的到手多少。
 */
async function redeemAllCoins() {
  const n = wallet.coins;
  if (n <= 0) { toast(rt("empty")); return; }
  let got = 0;
  try {
    got = await host.redeemGameCoin(n, `换成兑换券 ×${n}`);
  } catch (e) {
    console.warn("[pp] 换兑换券失败", e);
  }
  // 不管成没成都要对账：失败时内存里的币可能已经和账本不一致了
  await wallet.refresh();
  if (!alive) return;
  if (got > 0) {
    void sfx("prize.get");
    toast(rt("ok").replace("{n}", String(got)));
    refreshTexts();
    buildCollection();
  } else {
    toast(rt("fail"));
    refreshRedeemBar();
  }
}

/**
 * 真的卖。返回**宿主实际发出的兑换券数**（`0` = 没卖成）。
 *
 * ⚠️ 顺序固定：**先扣库存，再发券**。
 * 反过来的话，进账成功、扣库存失败（比如中途抛错）就是「娃娃还在、币已经到」，
 * 可以无限重复卖 —— 那是一条印钞机。先扣库存最坏是「娃娃没了、币没到」，
 * 那是玩家吃亏，会来投诉；重复铸币则是**静默通胀**，没人会发现。
 */
async function sellStock(id, n) {
  const isSweet = id.startsWith("sweet_");
  const have = isSweet ? (save.snacks?.[id]?.quantity ?? 0) : stockOf(id);
  const qty = Math.max(0, Math.min(have, Math.round(n) || 0));
  if (qty <= 0) return false;
  const gain = recycleValue(id) * qty;

  if (isSweet) { const row = save.snacks?.[id]; if (row) row.quantity = Math.max(0, row.quantity - qty); }
  else save.stock[id] = Math.max(0, stockOf(id) - qty);
  save.soldCount = (save.soldCount ?? 0) + qty;
  persist();

  // 娃娃 → **兑换券**，不经过币（币是买来的入场券，娃娃不该产币）。
  // 返回值是宿主实际发出的券数，界面显示这个数，不自己乘。
  const got = await wallet.redeemPrize(gain, `回收 ${prizeName(id)} ×${qty}`);
  bagSig = ""; comboSig = "";
  if (alive) { refreshTexts(); buildCollection(); }
  return got;
}

function openRecycleSheet(id) {
  const isSweet = id.startsWith("sweet_");
  const have = isSweet ? (save.snacks?.[id]?.quantity ?? 0) : stockOf(id);
  const each = recycleValue(id);
  const sh = $("sellSheet");
  sh.className = "sheet";
  const meta = PRIZE_META[id];
  sh.innerHTML = `<div class="big">${prizeImg(id, 110)}</div><h3>${prizeName(id)}</h3>
    <div>${T("rarity")} <span style="color:${hex(PALETTE.pink)}">${stars(meta?.rarity ?? 1)}</span></div>
    <div class="dim">${T("recycleEach")} ${VOUCHER.emoji} <b>${each}</b> · ${T("owned")} ×${have}</div>
    <div class="calc"><div class="tot"><span>${T("sellTotal")} ×${have}</span><span>${VOUCHER.emoji} ${each * have}</span></div></div>
    <div class="row"><button class="pill" id="rcCancel">${T("cancel")}</button><button class="pill pink" id="rcOne">${T("sellOne")} · ${VOUCHER.emoji}${each}</button></div>
    <button class="pill mint" id="rcAll" style="width:100%">${T("sellAll")} ×${have} · ${VOUCHER.emoji}${each * have}</button>`;
  $("sellModal").classList.remove("hidden");
  $("rcCancel").addEventListener("click", () => { void sfx("ui.tap"); $("sellModal").classList.add("hidden"); });
  const finish = async (n) => {
    void sfx("crane.confirm");
    const got = await sellStock(id, n);
    if (!(got > 0)) { toast(T("recycleFail")); $("sellModal").classList.add("hidden"); return; }
    if (!alive) return;
    // 显示**宿主实际发出的券数**（`got`），不是自己乘出来的 `each * n` ——
    // 两边算法一旦不一致，玩家看到的就是假数。
    sh.innerHTML = `<h3 style="font-size:26px">✓ ${T("recycled")}</h3><div style="font-size:34px;font-weight:900;color:${hex(PALETTE.pink)}">${VOUCHER.emoji} +${got}</div>`;
    void sfx("prize.get");
    spawnConfettiIn($("sellModal"));
    setTimeout(() => { if (alive) $("sellModal").classList.add("hidden"); }, 900);
  };
  $("rcOne").addEventListener("click", () => { void finish(1); });
  $("rcAll").addEventListener("click", () => { void finish(have); });
}

function spawnConfettiIn(host) {
  const c = document.createElement("div"); c.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20"; host.appendChild(c);
  const cols = [hex(PALETTE.pink), hex(PALETTE.lavender), hex(PALETTE.mint), hex(PALETTE.cream), "#ffd166"];
  for (let i = 0; i < 40; i++) { const d = document.createElement("div"); d.className = "cf"; d.style.left = `${(i * 37) % 100}%`; d.style.background = cols[i % cols.length]; d.style.animationDuration = `${1.8 + (i % 5) * 0.3}s`; d.style.animationDelay = `${(i % 7) * 0.1}s`; c.appendChild(d); }
  setTimeout(() => c.remove(), 4000);
}

$("rcVoucher").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); void redeemAllCoins(); });

// ---------- sound ----------
/**
 * 音频预热。**故意不 await** —— 它只该是「顺手把 AudioContext 解个锁」。
 *
 * 实测（headless Chrome）：`sound.unlock()` 没有音频设备时**永远不 resolve**，
 * 而首页几个磁贴原来写的是 `await sound.unlock(); ... show(el)`，
 * 于是点一下磁贴什么都不发生（对照组：`colBtn` / `sellBtn` 都是这个症状，
 * 报错为零 —— 因为根本没有异常，只是那行 await 永远不返回）。
 * 导航绝不该依赖音频。
 */
function audioWarmup(preload) {
  if (!sound) return;
  try {
    if (preload) void Promise.resolve(sound.preload(preload)).catch(() => {});
    void Promise.resolve(sound.unlock()).catch(() => {});
  } catch { /* 没有音频设备就静默 */ }
}

let sound                          = null;
let sfxN = 0;
                                                                                                                                                                                                                                      
async function sfx(id         ) {
  if (!sound) return;
  const eventId = `${id}:${sfxN++}`;
  try {
    switch (id) {
      case "ui.tap": await sound.playCue("ui.tap", { eventId }); break;
      case "crane.motor": await sound.playCue("crane.motor", { eventId }); break;
      case "crane.confirm": await sound.playCue("crane.confirm", { eventId }); break;
      case "claw.contact": await sound.playCue("claw.contact", { eventId, pitchSemitones: (sfxN % 3) - 1 }); break;
      case "prize.drop": await sound.playCue("prize.drop", { eventId, pitchSemitones: (sfxN % 5) - 2 }); break;
      case "prize.get": await sound.playCue("prize.get", { eventId }); break;
      case "play.start": await sound.playCue("play.start", { eventId }); break;
      case "crane.descend": await sound.playCue("crane.descend", { eventId }); break;
      case "claw.close": await sound.playCue("claw.close", { eventId }); break;
      case "claw.open": await sound.playCue("claw.open", { eventId }); break;
      case "prize.chute": await sound.playCue("prize.chute", { eventId }); break;
      case "result.miss": await sound.playCue("result.miss", { eventId }); break;
      case "catch.go": await sound.playCue("catch.go", { eventId }); break;
      case "result.fanfare": await sound.playCue("result.fanfare", { eventId }); break;
    }
  } catch { /* ignore */ }
}
let musicOn = false; let musicState                  = "home";
function audioPrefs() { return save.audio ?? (save.audio = { bgm: true, music: 0.8, sfx: 1 }); }
function applyAudioPrefs() {
  if (!sound) return; const a = audioPrefs();
  try { sound.settings.setVolumes({ music: a.bgm ? a.music : 0, sfx: a.sfx }); } catch { /* */ }
}
// BGM follows the screen: home/list/collection/sell → "home", inside a machine → "play". Unlock happens on the first tap.
// single serialized applier: every state change funnels through here, so a slow home→play crossfade can never be overtaken by a stale call
let musicChain                = Promise.resolve(); let musicApplied                       = "";
function applyMusic() {
  if (!sound || !musicOn) return;
  musicChain = musicChain.then(async () => {
    if (!sound || musicApplied === musicState) return;
    const st = musicState; try { await sound.unlock(); if (st === "play") await sound.setMusicState("play", { eventId: "bgm-play" }); else await sound.setMusicState("home", { eventId: "bgm-home" }); musicApplied = st; } catch { /* */ }
  });
}
// re-assert only when the runtime is NOT already playing the wanted state (so a repeated PLAY tap never restarts or stacks the track)
function reassertMusic() { if (!sound || !musicOn) return; try { const cur = sound.inspect().music?.stateId; if (cur !== musicState) { musicApplied = ""; applyMusic(); } } catch { /* */ } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { reassertMusic(); void wallet.refresh(); } });
async function startMusic() { if (!sound || musicOn) return; musicOn = true; applyAudioPrefs(); applyMusic(); }
async function setBgm(st                 ) { if (musicState === st) return; musicState = st; applyMusic(); }

// ---------- collision events ----------
function drainEvents() {
  eventQueue.drainCollisionEvents((h1, h2, started) => {
    if (!started) return;
    const fingerHit = fingers.some(f => f.handles.has(h1) || f.handles.has(h2));
    const prize = prizes.find(p => p.colliderHandles.has(h1)) ?? prizes.find(p => p.colliderHandles.has(h2));
    if (!prize) return;
    if (fingerHit && (crane.phase === "descend" || crane.phase === "close")) {
      const f = fingers.find(f => f.handles.has(h1) || f.handles.has(h2)) ;
      const ft = f.body.translation(), fr = f.body.rotation();
      tmpQ.set(fr.x, fr.y, fr.z, fr.w); tmpV.set(0, -currentMachine.fingerLen, 0).applyQuaternion(tmpQ).add(ft       );
      fxSpark(tmpV, 0.35); void sfx("claw.contact");
      return;
    }
    if (!fingerHit && prize.prevVel > 1.2) {
      const t = prize.body.translation();
      fxDust({ x: t.x, y: t.y - 0.4, z: t.z }, Math.min(1, prize.prevVel / 5));
      void sfx("prize.drop");
    }
  });
}

// ---------- main loop ----------
let last = performance.now();
function loop(now        ) {
  if (!alive) return;
  requestAnimationFrame(loop);
  const realDt = (now - last) / 1000; last = now;
  // FX always receives the true wall-clock delta; gameplay consumes its time scale (hit-stop) and clamps long stalls
  const timeScale = fx.update(realDt);
  const gameplayDt = Math.min(realDt, 0.05) * timeScale;
  simulate(gameplayDt);
  // additive impulse root: offset the camera for this render only, then restore the gameplay baseline
  const impX = fxImpulse.offsetX * 0.02, impY = fxImpulse.offsetY * 0.02;
  camera.position.x += impX; camera.position.y += impY;
  renderer.render(scene, camera);
  camera.position.x -= impX; camera.position.y -= impY;
}
function simulate(dt        ) {
  if (!inMachine || !world) return;
  // gameplay dt (already scaled by FX hit-stop) is split into n near-fixed substeps: h ≈ fixedDt at 60fps, shrinks under hit-stop
  if (!(dt > 0.0005)) return; // zero/NaN dt (first frame, hidden tab, full hit-stop) → a zero timestep panics rapier and poisons the wasm
  const n = Math.min(PHYSICS.maxStepsPerFrame, Math.max(1, Math.round(dt / PHYSICS.fixedDt)));
  const h = Math.min(PHYSICS.fixedDt * 1.5, dt / n);
  world.timestep = h;
  const m = currentMachine;
  for (let step = 0; step < n; step++) {
    if (restock) restockTick(h);
    if (restockHold) restockHoldTick(h);
    craneTick(h);
    for (const p of prizes) {
      if (p.got) continue;
      const lv = p.body.linvel(); const sp = Math.hypot(lv.x, lv.y, lv.z); p.prevVel = sp;
      if (sp > PHYSICS.maxLinVel) { const k = PHYSICS.maxLinVel / sp; p.body.setLinvel({ x: lv.x * k, y: lv.y * k, z: lv.z * k }, true); }
      const av = p.body.angvel(); const asp = Math.hypot(av.x, av.y, av.z);
      if (asp > PHYSICS.maxAngVel) { const k = PHYSICS.maxAngVel / asp; p.body.setAngvel({ x: av.x * k, y: av.y * k, z: av.z * k }, true); }
    }
    if (m.kind === "takoyaki") takoMagnetTick();
    for (const b of balls) { if (b.inCup >= 0) continue; const lv = b.body.linvel(); const sp = Math.hypot(lv.x, lv.y, lv.z); if (sp > 6) { const k = 6 / sp; b.body.setLinvel({ x: lv.x * k, y: lv.y * k, z: lv.z * k }, true); } const t = b.body.translation(); if (t.y < -0.5 || Math.abs(t.x) > m.caseW / 2 + 0.3 || Math.abs(t.z) > m.caseD / 2 + 0.3) { const onPlateSide = Math.hypot(t.x - TAKO.plate.cx, t.z - TAKO.plate.cz) < TAKO.plate.R + 0.4; b.body.setTranslation(onPlateSide ? { x: TAKO.plate.cx, y: TAKO.plate.top + 0.5, z: TAKO.plate.cz } : { x: TAKO.pool.x0 + 0.4, y: 1.2, z: 0 }, true); b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); } }
    world.step(eventQueue);
    drainEvents();
    for (const p of prizes) {
      if (p.got) continue;
      safetyTick(p, m, h);
      if (suck) { if (suck.p === p) suckTick(h, m); continue; }
      if (m.kind === "sweets") { if (!sweetsSettling && sweetsArmed && sweetInChute(p, m)) onSweetGet(p); continue; }
      if (m.kind === "grab") { if (crane.phase !== "get" && grabCentreInZone(p, m)) { startSuck(p); suckTick(h, m); break; } continue; }
      if (crane.phase !== "get" && (m.kind === "bridge" ? boxThroughBridge(p, m) : prizeInChute(p, m))) { p.inChuteT += h; if (p.inChuteT >= PHYSICS.getHoldTime) { onGet(p); break; } }
      else p.inChuteT = 0;
    }
  }
  for (const p of prizes) { if (p.got) continue; const t = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
  for (const f of fingers) { const t = f.body.translation(), r = f.body.rotation(); f.mesh.position.set(t.x, t.y, t.z); f.mesh.quaternion.set(r.x, r.y, r.z, r.w); }
  for (const b of balls) { const t = b.body.translation(); b.mesh.position.set(t.x, t.y, t.z); }
  headMesh.position.set(crane.x, crane.y, crane.z);
  beamMesh.position.z = crane.z;
  const topY = m.caseH - 0.23; cableMesh.position.set(crane.x, (topY + crane.y + 0.13) / 2, crane.z); cableMesh.scale.y = Math.max(0.01, topY - crane.y - 0.13);
  // aim shadow: sits on the highest surface under the claw (floor or a prize top)
  let surf = m.kind === "takoyaki" ? (crane.x > TAKO.pool.x1 ? TAKO.plate.top : 0.75) : 0; for (const p of prizes) { if (p.got) continue; const t = p.body.translation(); if (Math.hypot(t.x - crane.x, t.z - crane.z) < 0.45) surf = Math.max(surf, t.y + 0.35); }
  shadowBlob.position.set(crane.x, surf + 0.008, crane.z);
  const hgt = Math.max(0.2, crane.y - surf); shadowBlob.scale.setScalar(0.55 + 0.12 * hgt); (shadowBlob.material                           ).opacity = 0.34 - 0.04 * hgt;
  shadowBlob.visible = !(crane.phase === "ready" || crane.phase === "fail" || crane.phase === "get") || true;
  if (debugGroup.visible) debugGroup.children.forEach(c => { const fm = c.userData.follow                              ; if (fm) { c.position.copy(fm.position); c.quaternion.copy(fm.quaternion); } });
  if (tune.showParams) {
    const p0 = prizes.find(p => !p.got);
    $("params").textContent = `phase ${crane.phase}\ncrane ${crane.x.toFixed(2)} ${crane.y.toFixed(2)} ${crane.z.toFixed(2)}\narm ${(m.armPower * tune.armPower).toFixed(2)} weight×${tune.weight.toFixed(2)} fric×${tune.friction.toFixed(2)}\n` + prizes.map((p, i) => { const t = p.body.translation(); return `P${i} ${p.got ? "GOT" : `${t.x.toFixed(2)} ${t.y.toFixed(2)} ${t.z.toFixed(2)} m${p.body.mass().toFixed(2)}`}`; }).join("\n") + (p0 ? "" : "");
  }
  if (Math.abs(zoom - zoomTarget) > 0.0005) zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
  camTick(dt); chuteGlowTick(dt);
}
function render() { renderer.render(scene, camera); }

// ---------- input ----------
function bindHold(btn                   , k           ) {
  const down = (e              ) => { if (btn.disabled || btn.classList.contains("hidden")) return; e.preventDefault(); input[k] = true; btn.classList.add("down"); try { btn.setPointerCapture(e.pointerId); } catch { /* */ } };
  const up = () => { input[k] = false; btn.classList.remove("down"); };
  btn.addEventListener("pointerdown", down);
  for (const ev of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) btn.addEventListener(ev, up);
  addEventListener("pointerup", up); addEventListener("blur", up);
}
bindHold(btnX, "x"); bindHold(btnZ, "z");
addEventListener("keydown", e => {
  if (!inMachine || e.repeat) return;
  if (e.code === "ArrowRight" || e.code === "KeyX") { if (!btnX.classList.contains("hidden")) { input.x = true; btnX.classList.add("down"); } }
  if (e.code === "ArrowUp" || e.code === "KeyZ") { if (!btnZ.classList.contains("hidden")) { input.z = true; btnZ.classList.add("down"); } }
  if (e.code === "Space" || e.code === "Enter") void startPlay();
});
addEventListener("keyup", e => {
  if (e.code === "ArrowRight" || e.code === "KeyX") { input.x = false; btnX.classList.remove("down"); }
  if (e.code === "ArrowUp" || e.code === "KeyZ") { input.z = false; btnZ.classList.remove("down"); }
});
btnPlay.addEventListener("pointerdown", () => btnPlay.classList.add("down"));
btnPlay.addEventListener("pointerup", () => btnPlay.classList.remove("down"));
btnPlay.addEventListener("pointerleave", () => btnPlay.classList.remove("down"));
btnPlay.addEventListener("click", () => { void startPlay(); });
$("camFront").addEventListener("click", () => { setCam("front"); void sfx("ui.tap"); });
$("camSide").addEventListener("click", () => { setCam("side"); void sfx("ui.tap"); });

// ---------- staff menu ----------
function openStaff() {
  void sfx("ui.tap");
  const sh = $("staffSheet");
  const low = (currentMachine.kind === "sweets" && sweetsLeft() <= Math.floor(SWEET_PILE.n * 0.4)) || (!!currentMachine.mascot && prizes.filter(p => !p.got).length <= 12 && prizes.some(p => p.got));
  sh.innerHTML = `<h3>🔔 ${T("staff")}</h3>${low ? `<button class="pill pink" id="stRefill">🍬 ${T("staffRefill")}</button>` : ""}<button class="pill" id="stReset">${T("staffReset")}</button><button class="pill" id="stStuck">${T("staffStuck")}</button><button class="pill ghost" style="color:${hex(PALETTE.ink)};background:#eee" id="stCancel">${T("cancel")}</button>`;
  $("staffOverlay").classList.remove("hidden");
  $("stCancel").addEventListener("click", () => { void sfx("ui.tap"); $("staffOverlay").classList.add("hidden"); });
  document.getElementById("stRefill")?.addEventListener("click", () => { void sfx("ui.tap"); $("staffOverlay").classList.add("hidden"); if (currentMachine.mascot) mascotRefill(); else sweetsRefill(); toast(T("staffRefill")); });
  $("stStuck").addEventListener("click", () => {
    void sfx("ui.tap"); $("staffOverlay").classList.add("hidden");
    for (const p of prizes) if (!p.got) { p.body.wakeUp(); const ms = p.body.mass(); p.body.applyImpulse({ x: 0, y: 1.6 * ms, z: 0 }, true); p.body.applyTorqueImpulse({ x: 0.2 * ms, y: 0, z: 0.15 * ms }, true); }
    toast(T("stuckMsg"));
  });
  $("stReset").addEventListener("click", () => {
    void sfx("ui.tap");
    sh.innerHTML = `<h3>${T("confirmReset")}</h3><button class="pill pink" id="stDo">${T("doReset")}</button><button class="pill" id="stNo">${T("dontReset")}</button>`;
    $("stNo").addEventListener("click", () => { void sfx("ui.tap"); $("staffOverlay").classList.add("hidden"); });
    $("stDo").addEventListener("click", () => { void sfx("ui.tap"); $("staffOverlay").classList.add("hidden"); if (isOperating()) resetCrane(currentMachine); resetPrizes(); toast(T("staffReset")); });
  });
}
$("staffBtn").addEventListener("click", openStaff);

// ---------- test menu ----------
function openTest() {
  void sfx("ui.tap");
  const sh = $("testSheet");
  const slider = (id        , label        , v        , min        , max        ) => `<div class="tRow"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="0.05" value="${v}"><span class="val" id="${id}V">${v.toFixed(2)}</span></div>`;
  sh.innerHTML = `<h3>${T("test")}</h3>
    ${slider("tArm", T("tArm"), tune.armPower, 0.3, 3)}${slider("tWeight", T("tWeight"), tune.weight, 0.3, 3)}${slider("tFriction", T("tFriction"), tune.friction, 0.2, 2)}
    <div class="tRow toggle"><button class="pill ${tune.showHit ? "on" : ""}" id="tHit">${T("tHit")}</button><button class="pill ${tune.showParams ? "on" : ""}" id="tParams">${T("tParams")}</button></div>
    <div class="tRow toggle"><button class="pill ${freeCam ? "on" : ""}" id="tFree">${T("tFree")}</button><button class="pill" id="tReset">${T("tReset")}</button></div>
    ${currentMachine.kind === "bridge" ? slider("tGap", T("tBridgeGap"), currentMachine.bridge .gap, 0.3, 1.2) + `<div class="tRow"><label>${T("tBoxAngle")}</label><span class="val" id="tAngle" style="width:auto">-</span></div>` : ""}
    <button class="pill" id="tPop">${T("tPop")}</button>
    <button class="pill pink" id="tForce">${T("tForce")}</button>
    <button class="pill" id="tClose">${T("close")}</button>`;
  $("testOverlay").classList.remove("hidden");
  $("tClose").addEventListener("click", () => { void sfx("ui.tap"); $("testOverlay").classList.add("hidden"); });
  for (const [id, key] of [["tArm", "armPower"], ["tWeight", "weight"], ["tFriction", "friction"]]         ) {
    $                  (id).addEventListener("input", e => { const v = parseFloat((e.target                    ).value); tune[key] = v; $(id + "V").textContent = v.toFixed(2); applyTune(); });
  }
  if (currentMachine.kind === "bridge") {
    $                  ("tGap").addEventListener("input", e => { const v = parseFloat((e.target                    ).value); currentMachine.bridge .gap = v; $("tGapV").textContent = v.toFixed(2); setBridgeGap(v); });
    const upd = () => { const p = activeBox(); if (!p) return; const r = p.body.rotation(); const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)); $("tAngle").textContent = `x${(e.x * 57.3).toFixed(0)}° y${(e.y * 57.3).toFixed(0)}° z${(e.z * 57.3).toFixed(0)}°`; };
    upd(); const iv = setInterval(() => { if ($("testOverlay").classList.contains("hidden")) clearInterval(iv); else upd(); }, 200);
  }
  $("tHit").addEventListener("click", () => { tune.showHit = !tune.showHit; debugGroup.visible = tune.showHit; $("tHit").classList.toggle("on", tune.showHit); });
  $("tParams").addEventListener("click", () => { tune.showParams = !tune.showParams; $("params").classList.toggle("hidden", !tune.showParams); $("tParams").classList.toggle("on", tune.showParams); });
  $("tFree").addEventListener("click", () => {
    if (freeCam) { freeCam.dispose(); freeCam = null; camTween = 1; fitCamera(); camPos.copy(camGoalPos); camTarget.copy(camGoalTarget); }
    else { freeCam = new OrbitControls(camera, renderer.domElement); freeCam.target.copy(camTarget); freeCam.enableDamping = true; }
    $("tFree").classList.toggle("on", !!freeCam);
  });
  $("tReset").addEventListener("click", () => { void sfx("ui.tap"); if (isOperating()) resetCrane(currentMachine); resetPrizes(); });
  $("tPop").addEventListener("click", () => {
    void sfx("ui.tap");
    const keys = ["bigbear", "bridge", "takoyaki", "sweets"]; popTestIdx = (popTestIdx + 1) % (keys.length + 1);
    const base = currentMachine.pops ?? {};
    const pops                     = popTestIdx === keys.length ? undefined : { ...base, main: { image: POP_LIBRARY[keys[popTestIdx]], x: 0.5, y: 0.62, width: 0.55 } };
    applyPops(pops); toast(`POP: ${popTestIdx === keys.length ? "none" : keys[popTestIdx]}`);
  });
  $("tForce").addEventListener("click", () => {
    void sfx("ui.tap"); $("testOverlay").classList.add("hidden");
    const p = prizes.find(p => !p.got); if (!p) return;
    if (isOperating()) resetCrane(currentMachine);
    const ch = currentMachine.chute; p.body.setTranslation({ x: ch.cx, y: 2.4, z: ch.cz }, true); p.body.setRotation({ x: 0.2, y: 0.3, z: 0, w: 0.93 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp();
  });
}
$("testBtn").addEventListener("click", openTest);

// ---------- screens ----------
const rankEl = $("rank");
/**
 * 切屏。**没有底部导航要同步了** —— `.bnav` 已删（宿主自己的 TabBar 就是导航，
 * 插件再挂一条 5 格底栏等于两条导航叠着，白吃掉 62px）。
 * 现在每个子页自己带返回键，首页（机台列表）是根，没有返回。
 */
/**
 * 动作条**只有一个实例，跟着当前屏搬**。
 *
 * 不复制 markup：复制就得复制 id，`#colBtn` 出现两份，`$()` 只拿得到第一份 ——
 * 另一份点了没反应，而控制台零报错。
 * 图鉴 / 回收 / 排行三屏自己带返回键，不放动作条。
 */
const barEl = $("ppBar");
function placeBar(el) {
  const on = el === listEl || el === playEl;
  barEl.classList.toggle("compact", el === playEl);
  barEl.classList.toggle("hidden", !on);
  if (on && barEl.parentElement !== el) el.appendChild(barEl);
}
function show(el             ) {
  for (const s of [listEl, playEl, colEl, rankEl]) s.classList.toggle("hidden", s !== el);
  placeBar(el);
  refreshTexts(); void setBgm(el === playEl ? "play" : "home");
}
let builtFor = "";
function enterMachine(m               ) {
  currentMachine = m; inMachine = true; show(playEl);
  if (builtFor !== m.id) {
    builtFor = m.id; teardownMachine(); buildMachine(m);
    if (m.kind === "sweets") { for (const { def, sd } of sweetDefs()) prizes.push(buildSweetPrize(def, sd)); }
    else if (m.mascot) { mascotDefs().forEach(({ def, md }, i) => prizes.push(buildPrize(def, i, md))); }
    else m.prizes.forEach((d, i) => prizes.push(m.kind === "bridge" ? buildBoxPrize(d, m) : buildPrize(d, i)));
    restoreLayout(); if (m.kind === "bridge") bridgeSetup(); resetCrane(m);
    if (m.mascot) { for (let i = 0; i < 1100; i++) world.step(); for (const p of prizes) { p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.sleep(); } }
    if (m.kind === "sweets") { sweetsSettling = true; for (let i = 0; i < 1400; i++) world.step(); for (const p of prizes) { if (!p.got) { const t = p.body.translation(); if (t.z > SWEET_PILE.z1 - 0.05 || t.y < 0.25) p.body.setTranslation({ x: t.x * 0.8, y: 3.2, z: SWEET_PILE.z0 + 0.6 + Math.random() * 0.8 }, true); } } for (let i = 0; i < 500; i++) world.step(); for (const p of prizes) { p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.sleep(); } sweetsSettling = false; sweetsArmed = false; }
  }
  if (isOperating()) resetCrane(m);
  refreshTexts(); void startMusic();
  // machine "power-on" sparkle on the claw head when the player steps up to the cabinet
  fx.play("teleport-light", { pos: new THREE.Vector3(m.home.x, m.home.y - 0.4, m.home.z), power: 0.5 });
  setTimeout(() => { resize(); camTween = 1; camPos.copy(camGoalPos); camTarget.copy(camGoalTarget); last = performance.now(); }, 0);
}
function totalGets() { return Object.values(save.gotCounts).reduce((a, n) => a + n, 0); }
function compRate() { const n = Object.values(save.gotCounts).filter(v => v > 0).length; const total = Object.keys(PRIZE_META).length; return total ? Math.round(100 * n / total) : 0; }
function mySales() { return Math.round(save.soldCount ?? 0); }
let lastSubmit = 0;
async function submitRank() {
  if (!gp.player.user) return;
  const t = totalGets(); if (t <= 0 || t === lastSubmit) return; lastSubmit = t;
  try { await gp.player.submitScore(t); } catch { /* offline */ }
}
async function buildRanking() {
  const lb = $("rankList"); lb.innerHTML = `<div class="rankNote">${T("loading")}</div>`;
  $("rankYouLine").textContent = `${gp.player.user?.name ?? T("rankYou")}`;
  $("rankYouGet").textContent = `${totalGets()}${T("unitGet")}`;
  $("rankYouComp").textContent = `${compRate()}%`;
  $("rankYouSales").textContent = `×${mySales().toLocaleString()}`;
  let rows                                                                    = [];
  try { rows = await gp.player.topScores(20) ?? []; } catch { rows = []; }
  if (!rows.length && !gp.player.user) { lb.innerHTML = `<div class="rankNote">${T("rankNeedLogin")}</div>`; return; }
  if (!rows.length) { lb.innerHTML = `<div class="rankNote">${T("rankEmpty")}</div>`; return; }
  lb.innerHTML = rows.map((r, i) => `<div class="rankRow${r.isMe ? " me" : ""}"><span class="rankNo">${i + 1}</span><span class="rankName">${r.isMe ? `👤 ${r.name}` : r.name}</span><span class="rankScore">${r.score}${T("unitGet")}</span></div>`).join("");
}
function leaveMachine(to              = listEl) { if (inMachine) saveLayout(); inMachine = false; applyPendingBusy(); input.x = input.z = false; if (isOperating()) resetCrane(currentMachine); $("getOverlay").classList.add("hidden"); show(to); buildCards(); if (to === colEl) buildCollection(); }
document.querySelectorAll                   ("#collection .cat").forEach(b => b.addEventListener("click", () => { void sfx("ui.tap"); colCat = b.dataset.cc                 ; buildCollection(); }));
makeScroller($("snackList"));
// 动作条现在在娃娃界面也有 ⇒ 三个入口都要先「离开机台」。
// 不离开的话 3D 场景还在后台跑 rAF、机台还挂着占用状态，而玩家已经看不到它了。
$("colBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); buildCollection(); refreshRedeemBar(); if (inMachine) { leaveMachine(colEl); } else { show(colEl); } });
document.querySelectorAll                   ("[data-wip]").forEach(b => b.addEventListener("click", () => { void sfx("ui.tap"); }));
$                  ("lstSearch").addEventListener("input", e => { lstQuery = (e.target                    ).value; buildCards(); });
$("rankBack").addEventListener("click", () => { void sfx("ui.tap"); show(listEl); });
$("rankBtn").addEventListener("click", () => { void sfx("ui.tap"); void submitRank(); void buildRanking(); if (inMachine) { leaveMachine(rankEl); } else { show(rankEl); } });
$("colBack").addEventListener("click", () => { void sfx("ui.tap"); show(listEl); });
$("backBtn").addEventListener("click", () => { void sfx("ui.tap"); leaveMachine(); });
// 顶栏那颗币 = 换币。`audioWarmup()` 要在真手势里发（headless 里 unlock 永不 resolve，只发不等）。
$("pCoinsBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); openBuySheet(); });
$("getToList").addEventListener("click", () => { void sfx("ui.tap"); crane.phase = "ready"; leaveMachine(); });
$("getCol").addEventListener("click", () => { void sfx("ui.tap"); crane.phase = "ready"; leaveMachine(colEl); });
$("getAgain").addEventListener("click", () => {
  void sfx("ui.tap"); $("getOverlay").classList.add("hidden");
  if (currentMachine.kind === "takoyaki") { if (takoState().got >= TAKO.stock) { takoState().got = 0; updateTakoStock(); updateLeftTag(); toast(T("refill")); } takoSweep(); persist(); }
  else if (prizes.every(p => p.got)) { resetPrizes(); toast(T("refill")); }
  else if (currentMachine.kind === "bridge") { const next = prizes.find(p => !p.got && !p.body.isEnabled()); if (next && !activeBox()) { startRestock(next); return; } bridgeSetup(); saveLayout(); }
  crane.phase = "ready"; crane.t = 0; updateStep();
});

// ---------- boot ----------
loadSave();
/* 组合表写错一个 id 的症状是「一张破图 + 一个永远凑不齐的组合」，而且不报错 ⇒ 启动时查一次。 */
{
  const bad = validateCombos();
  if (bad.length) console.warn("[pp] 组合表有无效 id / 加成：", bad);
}
refreshTexts();
// 进 Tab 直接就是「今天玩哪台」—— 首页 = 机台列表，没有标题页那一道门。
show(listEl);
window.__gpReady = true;

// the single FX frontend (referenceSpan = bear width in world units) first, so the frame loop is live right after the first paint
const fx = await createThreeFx({
  THREE, renderer, world: scene, camera,
  viewport: () => ({ width: viewportEl.clientWidth || innerWidth, height: viewportEl.clientHeight || innerHeight }),
  referenceSpan: 0.6,
  onImpulse: next => { fxImpulse = next; },
});
// no FX sky system: it tinted every cabinet red-brown; cabinets stay on the shared white/pastel materials + neutral clear color
last = performance.now(); requestAnimationFrame(loop);
try { renderBearThumb(); void renderFigureThumb().then(() => refreshTexts()); } catch (e) { console.warn("thumb", e); }


(async () => {
  try {
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = PHYSICS.fixedDt;
    eventQueue = new RAPIER.EventQueue(true);
    currentMachine = MACHINES[0];
    try { sound = await loadSoundSystem({ manifestUrl: A("./sound.manifest.json") })                    ; } catch (e) { console.warn("sound unavailable", e); }
    addEventListener("pagehide", () => { if (inMachine) saveLayout(); void sound?.dispose(); fx.dispose(); }, { once: true });
    gp.player.ready.then(({ user }) => { if (user?.locale && !save.lang) { lang = pick(user.locale); refreshTexts(); } }).catch(() => { });
    refreshTexts();
    window.__gpPlayable = true;
  } catch (e) { console.error(e); }
})();

// read-only debug hooks for self-testing
(window                                   ).__debug = {
  get fxDiag() { try { return fx.diagnostics(); } catch (e) { return String(e); } },
  get phase() { return crane.phase; }, get crane() { return { x: crane.x, y: crane.y, z: crane.z }; },
  get prizes() { return prizes.map(p => ({ ...p.body.translation(), type: p.sweetType ?? null, frontUp: +new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().copy(p.body.rotation()                    )).y.toFixed(2), got: p.got, sleeping: p.body.isSleeping(), enabled: p.body.isEnabled(), vy: p.body.linvel().y, mass: p.body.mass() })); },
  get balls() { return balls.map(b => { const t = b.body.translation(); return { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2), cup: b.inCup }; }); }, get spoonN() { return ballsInSpoon(); }, get tilt() { return takoTilt; }, get tf() { return takoFingers.map(f => { const t = f.body.translation(), r = f.body.rotation(); return [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2), +r.x.toFixed(2), +r.y.toFixed(2), +r.z.toFixed(2), +r.w.toFixed(2)]; }); },
  get fingers() { return fingers.map(f => ({ ...f.body.translation(), rot: f.body.rotation().z })); },
  get cam() { return camMode; }, get camPos() { return camera.position.toArray(); }, get coins() { return wallet.coins; }, get points() { return wallet.points; }, get stock() { return save.stock; }, get save() { return save; }, get lang() { return lang; },
  enter(id) { const m = MACHINES.find(x => x.id === id); if (m) enterMachine(m); }, leave() { leaveMachine(); }, get inMachine() { return inMachine; },
  get snd() { try { return { musicOn, musicState, musicApplied, inspect: sound?.inspect(), settings: sound?.settings.get() }; } catch (e) { return String(e); } },
  get screen() { return [listEl, playEl, colEl, rankEl].find(s => !s.classList.contains("hidden"))?.id; },
  aim(x        , z        ) { if (crane.phase !== "idle_x") return; crane.x = x; crane.z = z; crane.phase = "catchgo"; crane.t = 0; updateStep(); },
  // test hook: advance physics synchronously (headless browsers run too slowly for real-time checks)
  step(n        ) { if (!clawHead || !world) return; for (let i = 0; i < n; i++) simulate(PHYSICS.fixedDt); render(); },
  ballContacts() { const out           = []; for (const b of balls) { const t = b.body.translation(); if (t.x < -0.5) continue; world.contactPairsWith(b.body.collider(0), o => { const p = o.parent(); out.push(`${o.handle}:${p ? p.bodyType() : "?"}@${JSON.stringify(o.translation())} shape=${o.shapeType()}`); }); } return out; },
  contacts(i        ) { const out           = []; const p = prizes[i]; for (const c of p.colliders) world.contactPairsWith(c, o => { const b = o.parent(); out.push(`${o.handle}:${b ? b.bodyType() : '?'}@${JSON.stringify(o.translation())}`); }); return out; },
  forceGet(i        ) { onGet(prizes[i]); },
  /**
   * 测试用：直接给库存。
   *
   * 组合要凑齐 2~6 只**不同的**娃娃，靠 `forceGet` 一个个抓既慢又不稳定
   * （每台机器的奖品不一样）。这里只改内存 + 落盘，不经过任何闸门 ——
   * 和「玩家自己在控制台改 localStorage」等价，不构成新的作弊面
   * （真正要防的「必定 GET」是 UI 上的调试按钮，那个仍然是关的）。
   */
  grant(id        , n = 1) {
    if (!PRIZE_META[id]) return false;
    save.stock[id] = Math.max(0, (save.stock[id] ?? 0) + n);
    /*
     * ⚠️ **必须同时补 `gotCounts`**。正常玩法里 `onGet` 两个一起加，
     * 「有库存但没抓到过」是**不可能状态**；只加 stock 的话背包格子会渲染成
     * 「??? + 黑色剪影 + ×1」，走查图看起来像产品坏了，而实际是钩子造出了假状态。
     */
    save.gotCounts[id] = Math.max(1, save.gotCounts[id] ?? 0);
    save.firstGot[id] ??= new Date().toISOString().slice(0, 10);
    persist();
    return save.stock[id];
  },
  /** 组合表的只读视图（测试要断言「基础 + 加成 = 合计」和宿主申报对得上）。 */
  get combos() { return COMBOS.map(c => ({ id: c.id, ids: c.ids.slice(), bonus: c.bonus, base: comboBase(c), total: comboTotal(c) })); },
  teleport(i        , x        , y        , z        ) { const p = prizes[i]; p.body.setTranslation({ x, y, z }, true); p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); p.body.setAngvel({ x: 0, y: 0, z: 0 }, true); p.body.wakeUp(); },
};

// ---------- teardown ----------
/**
 * 宿主切走这个页面时调用。**必须做全**，漏一样就会出现「进出几次就白屏」：
 *  - WebGL context 不释放：浏览器上限约 16 个，反复进出必然报
 *    "Too many active WebGL contexts. Oldest context will be lost."，然后画不出东西
 *  - Rapier 的 world 不 free：wasm 堆内存不会回收，越积越多
 *  - rAF 不停止：destroy 之后循环还在跑，闭包里全是已释放的对象
 *  - 存档不 flush：刚抓到的娃娃会丢（写入是 400ms 防抖的）
 */
async function destroy() {
  alive = false;
  stopTimers();
  try { if (inMachine) saveLayout(); } catch { /* 场景可能已经没了 */ }
  try { await gp.flush(); } catch { /* 存档尽力而为 */ }
  try { await sound?.dispose?.(); } catch { /* */ }
  try { fx?.dispose?.(); } catch { /* */ }
  try { world?.free?.(); } catch { /* */ }
  try { renderer?.dispose?.(); renderer?.forceContextLoss?.(); } catch { /* */ }
  try { style.remove(); } catch { /* */ }
  try { appEl.replaceChildren(); } catch { /* */ }
  try {
    delete window.__debug; delete window.__gpPlayable; delete window.__gpReady;
  } catch { /* */ }
}

return { destroy };
}   // createGame
