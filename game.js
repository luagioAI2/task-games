import * as PIXI from "pixi.js";
import RAPIER from "@dimforge/rapier2d-compat";
import { mountDisplay } from "@makeplay/display";
import { createPixiFx } from "@makeplay/fx";
import { loadSoundSystem } from "@makeplay/sound";
                                                           
import { T, LANGS, pickLang, setLang, currentLang,           } from "./i18n.js";
import { installGp, makeLocalStore } from "./src/host.js";
import { scopeCss } from "./scope-css.js";
import {
  UPGRADES, CONSUMABLES, consumDef, emptyMeta, normalizeMeta, gemReward, nextCost,
  dailyKey, seedFrom, mulberry32,
                                             
} from "./meta.js";

/* ---------- 常量 ---------- */
const W = 390, H = 844, CX = W / 2;
const JAR_SCALE = 0.7002;
// 罐子已到极限:贴图内容高 587px(可用内高恒为 386px),宽 384/屏宽 390——挪位置不增容量,
// 再放大就出屏。下列常量按贴图实测标定,改前先跑 .tmp/jar.mjs 核对。
const JAR_FLOOR = 729;      // 内底顶面(gameY)
const JAR_TOP_Y = 216;      // 贴图内容顶(gameY)
const WARN_Y = 300, DROP_Y = 165;
const WARN_SECONDS = 10;
// 低于警戒线时计时回退的倍速:3 = 退 1 秒只需 0.33 秒“安全时间”。
// 越大越严(调到很大就退化为“一降回线下就清零”,即旧行为——玩家认为那像作弊)。
const WARN_DECAY = 3;
// 升级「加高警戒线」按等级抬高警戒线(索引 = 升级等级)
// 警戒线按内底下移同步下移(保持与罐口的相对距离)
const WARN_Y_BY_LEVEL = [316, 292, 268, 242];
// 升级「起手水果」按等级抬高可落水果上限(0→1..5,1→1..6,2→1..7)
const STARTER_CAP = [5, 6, 7];
// 玻璃罐内壁在游戏坐标中的半宽:罐口最窄,罐身最宽(实测贴图内缘换算得出)
const MOUTH_HALF = 150;
const BODY_HALF = 178;
const STEP = 1 / 60;
// 半径曲线 = 原始值(用户要求“瓶子回到原来大小”)。
// 曾为抬高上限放缓到 ×1.21/顶级 106px,但水果变小、罐子显得空:
// 前期无聊、后期也不会想买摇一摇/复活——压力才是付费动机。
const RADII = [16, 22, 30, 38, 48, 60, 74, 88, 104, 118, 132];
// 每张 1024 贴图的内容盒:cw=果体宽度(px,不含梗/叶/冠),ay=果体质心 y/1024(anchor.y)
// 按果体宽度缩放到直径 2r —— 梗/叶等细小部分允许伸到碰撞圆外,果体正好填满圆
const FIT = [
  { cw: 416, ay: 0.5508 }, { cw: 410, ay: 0.5703 }, { cw: 451, ay: 0.5054 },
  { cw: 435, ay: 0.5200 }, { cw: 472, ay: 0.5068 }, { cw: 485, ay: 0.5415 },
  { cw: 497, ay: 0.5034 }, { cw: 522, ay: 0.6309 }, { cw: 525, ay: 0.5015 },
  { cw: 594, ay: 0.5000 }, { cw: 597, ay: 0.5347 },
];

/**
 * 纹理相对**设计稿**的缩放系数。
 *
 * 原始素材是 1024²，压资源时缩到 512²（14.1 MB → 402 KB）。`FIT.cw` 记的是
 * **设计稿像素宽**（416~597），而 `scale = 目标宽 / 纹理实际宽` —— 纹理缩了一半
 * 就必须把分母也乘 0.5，否则精灵**小一半**，而且一个错都不报（只有看截图能发现）。
 * 判据：`scale × texture.width` 才是屏幕上的宽度。
 */
const ART_SCALE = 0.5;
const DROP_WEIGHTS = [30, 26, 20, 14, 10];
const FONT_STACK = '"MpFontDisplay","SmileySans",system-ui,sans-serif';

/**
 * 资源根。独立网页是 `""`（相对 `index.html`），插件里由 `start({ assetBase })` 注入。
 *
 * ★ 为什么不能在插件里继续用相对路径：插件的模块是 `blob:` URL，但 `img.src` /
 *   `fetch()` 的基准是**文档**（宿主页面）而不是模块 —— 于是 `assets/…` 会解析到
 *   宿主根目录 ⇒ 全部 404，而 404 的响应体是 HTML，`res.json()` 抛的是
 *   `Unexpected token '<'`，看着完全不像「路径错了」。
 */
let ASSET = "";
const A = (p) => ASSET + p.replace(/^\.\//, "");
const fruitUrl = (l) => A(`assets/fruits/f${String(l).padStart(2, "0")}.webp`);

/**
 * 一局的票钱。宿主（插件形态）会注入 `chargePlay`；独立网页不注入 = 免费。
 *
 * ★ 收费点选在「开始游戏 / 再来一局 / 每日挑战」这三个**明确的开局动作**上 ——
 *   这款有清晰的「一局」边界（罐口溢出就结算），所以按局收，不设宽限期。
 * ★ 扣款失败一律**不放行**（否则就是白玩），但也不让界面崩掉。
 */
let chargeRun = null;
async function payForRun() {
  if (!chargeRun) return true;
  try {
    return (await chargeRun()) !== false;
  } catch (e) {
    console.error("[melonjar] 开局扣分失败", e);
    return false;
  }
}
/** 把「先收费、再开局」包成事件处理器 */
const gate = (fn) => async () => {
  if (!(await payForRun())) return;
  fn();
};

/* ---------- 状态 ---------- */
                                       
                 
                                                             
                                                                 
                                                                
 
                                                         
                                                

let phase        = "title";
let app                  ;
let world              ;
let eventQueue                   ;
let sound                  ;
let fx                                          ;
// 输入层挂在 **window** 上的三个监听（pointerup / pointercancel / blur）的摘除函数。
// ★ 它们必须跟着卸载一起摘：`release()` 会走到 `dropCurrent()`，而那条路最终读 `app.stage`。
//   卸载后 `app = null`，宿主随后随便一次点按就报 `Cannot read properties of null (reading 'stage')`
//   —— 是**宿主**在切 tab 时的正常点击触发的，看着像宿主坏了。
let detachInput                                  = null;
let impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
// 庆典震屏增幅:只是把 FX 镜头冲击放大,不另写第二套震屏
let impactPunch = 0;

let board                , fxWorld                , fxScreen                ;
let bgSprite             ;
let fruitLayer                , aimLayer                , floatLayer                ;
let aimSprite             , aimGfx               , warnGfx               , warnText           ;
let fruitTex                 = [];

let vw = 0, vh = 0, boardScale = 1, baseX = 0, baseY = 0;

let fruits          = [];
const fruitByHandle = new Map               ();
let fruitSeq = 1, dropSeq = 1;
let lastDrop               = null;
const pendingAnnih                   = [];

let score = 0, best = 0, mergeCount = 0, biggest = 0;
// 【改造】原版这两项花的是**平台金币**(gp.pay),宿主插件不允许在游戏内花平台币
// (插件没有任何 HostApi 能扣正数),所以统一改成**宝石**——宝石只能靠玩挣,
// 于是「便利」依旧是挣来的,而不是白送,也没有任何跨进程扣款。
// 价格按 gemReward 的量级定:一局普通成绩约 10~14 宝石,所以 12 宝石≈一局。
const SHAKE_GEMS = 12;
const REVIVE_GEMS = 25;
// 上抛高度 = ky²/(2g),重力从 3200 提到 3840 后冲量需乘 √1.2 才能保持同样幅度
const SHAKE_G_SCALE = 1.0954;
let buying = false, payOff = false, lastSellable = false;
let tipTimer = 0;
let current = 1, nextLv = 1;
let chain = 0, chainPop = 0, warnT = 0, warnTick = 0;
// 合成节拍:碰撞只排队,每拍结算一段;链条越长拍越密,越连越快
let beat = 0, beatGap = 0, settleTimer = 0;
const mergeQueue                   = [];
// 连击节拍(秒/段):每一段都留出看得清“长大一颗”的间隔,再逐段加快
const CHAIN_GAPS = [0.34, 0.30, 0.265, 0.235, 0.205, 0.18, 0.16, 0.145, 0.132, 0.122];
// 首段前的停顿:落果先看清落点,再响起第一拍
const FIRST_BEAT = 0.18;
let aimReady = false, aimX = CX, dropWait = 0;
let slowmoT = 0, slowmoScale = 1;
let physAcc = 0, time = 0;
let pendingSave      = null;
let needLoginFlag = false;
let lastRank = 0;

/* ---------- 局外成长 / 每日挑战 ---------- */
let meta            = emptyMeta();
// localMode = 本局来源:普通无尽 / 每日挑战(决定种子与“一天一次”限制)
let runMode                      = "endless";
// 每日挑战的固定随机流(落果等级全部由它决定,全服同副牌局)
let dailyRand                        = null;
let gemsThisRun = 0;
let scoreAt10k = false, scoreAt50k = false;
const pops        = [];
const floaters            = [];

/* DOM refs */
let rootEl = null;
let hud             , scoreVal             , bestVal             , nextImg                  ;
let titleEl             , startBtn                   , freshBtn                   ;
let resultsEl             , finalScoreEl             , finalBestEl             ,
  finalMergesEl             , finalBiggestEl             , newRecordEl             ,
  finalRankEl             ,
  retryBtn                   , shareBtn                   , loginBtn                   ;
let bannerEl             , muteImg                  ;
let rulesBtn                   , rulesList             ;
let shakeBtn                   , coinTip             , shakeCostEl             , shakeRing             ;
let boardEl             , boardList             , boardNote             ;
let gemVal             , upGems             , dailyDot             ;
let dailyEl             , dailyBestEl             , dailyStreakEl             , dailyNote             ;
let dailyStart                   ;
let upEl             , upList             ;
let shopEl             , shopList             ;
let achEl             , achList             ;
let reviveBtn                   , finalGemsEl             ;
let rankBtn                   , rankBtn2                   ;
let shareBlob              = null, sharing = false, bannerTimer = 0, muted = false;
let resumeGrace = 0;

// 音效调用统一走这里:playCue 同步返回 receipt(不是 Promise),
// 而且不能让它抛错打断调用方后续的 UI 逻辑。
//
// ★ 实测会抛:音频**没解锁**时 `playCue` 同步抛
//   `SoundRuntimeError: sound runtime must be unlocked from a user gesture`。
//   解锁要真实手势,而宿主里「切进游戏先点一下强化 / 成就」这种顺序很常见 ——
//   不包 try/catch 的话整块面板的事件处理器当场中断,画面却看着好好的。
function cue(id, opts) {
  if (!sound) return;
  try {
    // ★ `playCue` 是 **async**：没解锁时它返回的是**被 reject 的 Promise**，
    //   不是同步抛 —— 所以 try/catch 抓不到，必须在返回值上挂 catch，
    //   否则每次点击都会冒一条未捕获 rejection（画面正常，只有控制台红）。
    const p = sound.playCue(id, opts);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* 没解锁 / 该 cue 不存在:不响就是了 */ }
}

function tap(eventId = "tap") { cue("sfx.tap", { eventId }); }

// 音效运行时在素材加载完才就绪;未就绪时调用方用 `if (sound)` 跳过。

// 真实手势里解锁音频;若运行时还没就绪,先记下“已收到手势”等就绪后补解锁
let unlocked = false, gestureSeen = false;
// 场景(精灵/物理/FX)是否已就绪:未就绪时不能开局,否则 newRun 会砸在未创建的精灵上
let sceneReady = false;
function unlockAudio()       {
  gestureSeen = true;
  if (!sound || unlocked) return;
  unlocked = true;
  // ★ 三个都是 async：`.catch` 必须挂，否则解锁失败会变成未捕获 rejection
  sound.unlock().catch(() => {});
  sound.preload("gameplay").catch(() => {});
  sound.setMusicState("bgm", { eventId: "session-start" }).catch(() => {});
}

/* ---------- CSS ---------- */
function injectCss() {
  const css = `
/* ★ absolute 而不是 fixed：UI 根节点在宿主容器里，fixed 会以视口定位，
   把 HUD 和面板铺到宿主的顶栏底栏上去。 */
#ui-root{position:absolute;inset:0;pointer-events:none;z-index:10;
  font-family:'MpFontDisplay','SmileySans',system-ui,sans-serif;
  -webkit-user-select:none;user-select:none;color:#eaf7fb}
#ui-root button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation}
[hidden]{display:none !important}
#hud{position:absolute;top:10px;left:50%;
  transform:translateX(-50%) translate3d(var(--sx,0px),var(--sy,0px),0);
  width:min(calc(var(--cw)*.94),calc(var(--ch)*.43));display:flex;align-items:center;gap:8px;visibility:hidden}
.chip{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:48px;
  background:#0b222c;border:1px solid #2e5a68;border-radius:14px;color:#9fc3cf;font-size:13px;white-space:nowrap}
.chip b{color:#ffd76a;font-size:20px;line-height:1}
.chip img{width:20px;height:20px}
#next-chip img{width:36px;height:36px}
.gold{filter:sepia(1) saturate(4) hue-rotate(2deg) brightness(1.05)}
.icon-btn{flex:none;width:48px;height:48px;border-radius:14px;background:#0b222c;border:1px solid #2e5a68;
  display:flex;align-items:center;justify-content:center;padding:0}
.icon-btn img{width:24px;height:24px}
.icon-btn:active{transform:scale(.94)}
.panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(calc(var(--cw)*.88),340px);
  max-height:calc(var(--ch)*.94);overflow-y:auto;background:#0b222c;border:1px solid #2e5a68;border-radius:22px;padding:28px 24px;
  text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.5);pointer-events:auto;z-index:1}
/* 榜单必须在其他面板之上:否则从结算屏点开会“打开但被盖住”,看起来像点不开 */
/* 二级面板(商店/强化/成就/每日)必须在结算屏之上:否则从结算屏点开会“打开但被盖住”,看起来像点不开 */
#board-screen,#shop-screen,#up-screen,#ach-screen,#daily-screen{z-index:6}
/* ★ 弹层面板底下压一层暗色。
   原版没有这一层:面板和标题屏都用 panel 类、都 top:50%,于是打开「强化」时
   标题那行大字从面板上下各露出一截,看着像排版坏了。
   ★ 这段注释在**模板字符串**里,不能出现反引号(会把模板提前闭合,
     而 node --check 居然还能过,只有打包器报 PARSE_ERROR)。
   0 0 0 100vmax 是画在**边框盒外面**的一圈巨大阴影 —— 容器 overflow:hidden
   会把它裁到容器内,正好当遮罩用,不用多加一个 DOM 节点。
   （只给弹层,不给标题屏:标题屏要透出罐子背景。） */
#board-screen,#shop-screen,#up-screen,#ach-screen,#daily-screen{box-shadow:0 0 0 100vmax rgba(4,12,16,.82)}
.panel h1{margin:0 0 10px;font-size:42px;color:#ffd76a;line-height:1.15;
  text-shadow:0 3px 0 rgba(122,74,0,.55),0 8px 24px rgba(0,0,0,.45)}
.panel h2{margin:0 0 6px;font-size:30px;color:#eaf7fb}
.panel .sub{margin:0 0 6px;font-size:15px;color:#9fc3cf;line-height:1.5}
.panel .howto{margin:14px 0 4px;font-size:13px;color:#9fc3cf}
.btn.small{min-height:48px;font-size:15px;color:#9fc3cf;margin-top:10px}
.rules{margin:10px 0 0;padding:0 0 0 18px;text-align:left;font-size:12.5px;line-height:1.55;color:#9fc3cf}
.rules li{margin-bottom:3px}
.btn{display:block;width:100%;min-height:52px;margin-top:12px;border-radius:16px;
  border:1px solid #2e5a68;background:#0e2f38;color:#eaf7fb;font-size:19px;line-height:1}
.btn.primary{background:#ffd76a;border:none;color:#4a2f00;font-weight:700;font-size:21px}
.btn.ghost{background:transparent}
.gold-btn{background:#1a3b47;border-color:#ffd76a;color:#ffd76a;font-weight:700}
.board{margin:12px 0 4px;text-align:left}
#board-list{max-height:min(calc(var(--ch)*.56),360px);overflow-y:auto;overscroll-behavior:contain}
.board .br{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid rgba(46,90,104,.5);font-size:15px}
.board .br:last-child{border-bottom:none}
.board .pos{flex:none;width:26px;text-align:center;color:#9fc3cf;font-weight:700;font-size:15px}
.board .br.top1 .pos{color:#ffd76a}
.board .br.top1 .nm{color:#ffd76a}
.board .av{flex:none;width:30px;height:30px;border-radius:50%;background:#123240;object-fit:cover}
.board .nm{flex:1;color:#eaf7fb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.board .sc{flex:none;color:#ffd76a;font-weight:700;font-variant-numeric:tabular-nums}
.board .br.me{background:rgba(255,215,106,.12);border-radius:10px;padding-left:8px;padding-right:8px}
.board .me-tag{flex:none;font-size:12px;color:#4a2f00;background:#ffd76a;border-radius:8px;padding:1px 6px}
.board-note{margin:12px 0 2px;font-size:13.5px;color:#9fc3cf;line-height:1.5}
.board-empty{padding:18px 0;color:#9fc3cf;font-size:15px;text-align:center}
/* 宝石与局外成长面板 */
.gem-chip b{color:#8fd4e8}
.gem-ico{width:14px;height:14px;border-radius:4px;background:linear-gradient(#cfeef7,#4fb9d8);
  transform:rotate(45deg);display:inline-block}
.gem-mini{margin-left:8px;font-size:13px;color:#4a2f00;background:#8fd4e8;border-radius:9px;padding:2px 8px;font-weight:700}
.gem-mini.poor{background:#2e5a68;color:#9fc3cf}
#daily-btn b{width:9px;height:9px;border-radius:50%;background:#ff4d5e;margin-left:8px;display:inline-block}
.up-list,.ach-list{margin:10px 0 4px;text-align:left}
#up-list,#ach-list{max-height:min(calc(var(--ch)*.68),520px);overflow-y:auto;overscroll-behavior:contain}
.up-row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(46,90,104,.5)}
.up-row:last-child{border-bottom:none}
.up-info{flex:1;min-width:0}
.up-name{color:#eaf7fb;font-size:15px;font-weight:700}
.up-desc{color:#9fc3cf;font-size:12.5px;line-height:1.35;margin-top:2px}
.up-lv{color:#8fd4e8;font-size:12px;margin-top:2px}
.up-buy{flex:none;min-width:88px;min-height:48px;border-radius:12px;border:1px solid #8fd4e8;
  background:#123240;color:#8fd4e8;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer}
.up-buy:disabled{filter:grayscale(.8) brightness(.75);border-color:#2e5a68;color:#9fc3cf}
.up-buy.max{border-color:#2e5a68;color:#9fc3cf;background:transparent}
/* 支付不可用:仍可点(点了会提示原因),只变灰 */
.up-buy.off{filter:grayscale(.85) brightness(.8);border-color:#2e5a68;color:#9fc3cf}
.ach-row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(46,90,104,.5)}
.ach-row:last-child{border-bottom:none}
.ach-ico{flex:none;width:40px;height:40px;border-radius:10px;object-fit:cover;background:#123240}
.ach-ico.locked{filter:grayscale(1) brightness(.45)}
.ach-info{flex:1;min-width:0}
.ach-name{color:#eaf7fb;font-size:14.5px;font-weight:700}
.ach-desc{color:#9fc3cf;font-size:12.5px;line-height:1.35;margin-top:2px}
.ach-state{flex:none;font-size:12px;color:#7ed957;font-weight:700}
.ach-state.locked{color:#9fc3cf;font-weight:400}
/* 摇一摇:在顶部 HUD 里,不再遮挡罐子。长按蓄力 1.2s 才触发。 */
.shake-ico-btn{position:relative;overflow:hidden;border-color:#ffd76a;color:#ffd76a;
  background:linear-gradient(#1c4a58,#123240);flex-direction:column;gap:0}
/* ★ 图标用**内联 SVG**，不用 emoji：🫙 是 Unicode 14（2021）才有的字形，
   Android 11 及更早的系统字体里没有 ⇒ 直接显示成一个空心方框（豆腐块），
   而且**截图里也一样**，商城详情页会带着豆腐块发出去。 */
.shake-ico-btn .sk-ico{display:block;width:24px;height:24px;color:#9fc3cf}
.shake-ico-btn .sk-ico svg{display:block}
.shake-ico-btn .sk-cost{position:absolute;right:2px;bottom:1px;display:inline-flex;align-items:center;gap:1px;
  font-size:11px;font-weight:700;color:#4a2f00;background:#ffd76a;border-radius:8px;padding:0 4px 0 3px}
.shake-ico-btn .sk-cost img{width:13px;height:13px}
.shake-ico-btn .sk-cost .sk-free{font-size:10px;letter-spacing:-.2px}
/* 长按蓄力:环形进度由 conic-gradient 驱动 */
.shake-ico-btn .sk-ring{position:absolute;inset:0;border-radius:14px;pointer-events:none;
  background:conic-gradient(#ffd76a 0turn, transparent 0turn);opacity:0;transition:opacity .12s ease}
.shake-ico-btn.charging .sk-ring{opacity:.55}
.shake-ico-btn.busy{filter:brightness(.75);pointer-events:none}
.shake-ico-btn.off{filter:grayscale(.85) brightness(.8);border-color:#2e5a68}
.shake-ico-btn.ready{border-color:#7ed957}
#coin-tip{position:absolute;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:13;
  transform:translate(-50%,8px);opacity:0;transition:opacity .18s ease,transform .18s ease;
  background:#0b222c;border:1px solid #ffd76a;color:#ffd76a;border-radius:14px;
  padding:9px 16px;font-size:15px;font-weight:700;line-height:1.35;text-align:center;
  width:max-content;max-width:min(calc(var(--cw)*.86),360px);pointer-events:none;
  box-shadow:0 8px 22px rgba(0,0,0,.5)}
#coin-tip.show{opacity:1;transform:translate(-50%,0)}
/* 矮窗口(手机横屏/小屏):压缩标题面板,保证内容完整放下、不出滚动条 */
@media (max-height:600px){
  .panel{width:min(calc(var(--cw)*.92),620px);padding:16px 20px;border-radius:18px;max-height:calc(var(--ch)*.92)}
  .panel h1{font-size:28px;margin-bottom:5px}
  .panel h2{font-size:24px}
  .panel .sub{font-size:13px;margin-bottom:4px}
  .panel .howto{display:none}
  .panel .big-score{font-size:40px;margin:0 0 4px}
  .lang-row{margin-bottom:8px}
  .lang-btn{min-height:48px;font-size:14px}
  /* 横屏本就宽:按钮排成一行,既瘦又不牺牲 48px 触摸区 */
  #title-screen .btn{display:inline-block;width:auto;min-width:150px;margin:7px 5px 0;
    min-height:48px;font-size:17px;border-radius:14px}
  .btn.small{min-height:48px;font-size:14px;margin-top:5px}
  .rules{margin-top:6px;font-size:12px;line-height:1.5;max-height:calc(var(--ch)*.24);overflow-y:auto;overscroll-behavior:contain}
  .board{margin:8px 0 2px}
  #board-list{max-height:calc(var(--ch)*.44)}
  .board .br{padding:4px 4px;font-size:14px}
  .board .av{width:26px;height:26px}
  .board-empty{padding:12px 0;font-size:14px}
  .board-note{font-size:12.5px;margin:6px 0 2px}
  #results-screen .row{margin-top:6px;font-size:14px}
}
.btn:active{transform:scale(.97)}
.big-score{font-size:56px;color:#ffd76a;line-height:1.1;margin:2px 0 8px}
.badge{display:inline-block;font-size:15px;color:#7ed957;border:1px solid #7ed957;
  border-radius:999px;padding:3px 14px;margin-bottom:4px}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:9px;font-size:15px;color:#9fc3cf}
.row b{color:#eaf7fb;font-size:17px}
.row img{width:24px;height:24px;vertical-align:-6px}
#banner{position:absolute;left:50%;top:31%;transform:translate(-50%,-50%) scale(.6);
  font-size:46px;color:#ffd76a;white-space:nowrap;
  text-shadow:0 4px 0 rgba(122,74,0,.6),0 10px 30px rgba(0,0,0,.55);
  opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none}
#banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
#loading{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:20px;
  background:linear-gradient(#0e2f38,#071a24);
  font-family:'MpFontDisplay','SmileySans',system-ui,sans-serif}
.load-ball{width:46px;height:46px;border-radius:50%;
  background:radial-gradient(circle at 32% 28%,#ffd9e2,#ff7a9e 58%,#d94f70);
  box-shadow:0 10px 26px rgba(255,122,158,.35);
  animation:mj-bob .85s ease-in-out infinite alternate}
/* ★ 关键帧名是**全局**的（作用域化管不到），必须加前缀：bob 这种名字撞上宿主
   或别的插件时，后注入的那份会赢，而症状是「别人家的动画变怪了」。
   ⚠️ 这段注释在模板字符串里，不能出现反引号（会把 CSS 字符串提前闭合）。 */
@keyframes mj-bob{from{transform:translateY(-18px) scale(1.06,.94)}to{transform:translateY(14px) scale(.94,1.06)}}
.load-track{width:200px;height:10px;border-radius:5px;background:#071a24;border:1px solid #2e5a68;overflow:hidden}
#load-fill{height:100%;width:0%;background:#ffd76a;border-radius:5px;transition:width .2s}
.load-txt{color:#9fc3cf;font-size:14px}
.lang-row{display:flex;justify-content:center;gap:10px;margin-bottom:16px}
.lang-btn{min-width:52px;min-height:48px;padding:0 12px;border-radius:12px;font-size:15px;
  background:transparent;border:1px solid #2e5a68;color:#9fc3cf;line-height:1}
.lang-btn.on{background:#ffd76a;border-color:#ffd76a;color:#4a2f00;font-weight:700}
`;
  const style = document.createElement("style");
  // ★ 给个 id：卸载时要能把自己那份样式摘掉（切几次游戏会叠十几份，选择器互相覆盖）
  style.id = "mj-style";
  // ★★ 必须**收进 #ui-root**：这份样式里全是 `.btn` / `.chip` / `.panel` / `[hidden]`
  //    这种通用类名，直接进 `document.head` 会盖掉宿主的 Tailwind（未分层的样式
  //    胜过 `@layer`）—— 症状是**宿主别的页面排版全乱**，而游戏自己看着好好的。
  style.textContent = scopeCss(css, "#ui-root");
  document.head.appendChild(style);
}

/* ---------- DOM ---------- */
/**
 * ★ UI 根节点挂在**容器里**，不是 `document.body`。
 *
 * 挂 body 的话，`position:fixed` 的 HUD 与各个面板会盖住宿主的顶栏底栏
 * （`z-index` 再高也没用，它根本不在容器那棵树里），而且卸载时
 * `container.replaceChildren()` 清不掉它 —— 切两次游戏就有两份 UI 叠着。
 */
function buildDom(container) {
  const root = document.createElement("div");
  root.id = "ui-root";
  // ★ 留着引用：`relayout()` 要往它身上写 `--cw/--ch`（样式里所有尺寸都按容器算，
  //   不按视口 —— 宿主里容器比视口小，用 vw/vh 会让面板顶到宿主的顶栏底栏上）
  rootEl = root;
  container.appendChild(root);
  root.innerHTML = `
  <div id="hud">
    <div class="chip"><span data-i18n="score">${T.score}</span><b id="score-val">0</b></div>
    <div class="chip" id="next-chip"><span data-i18n="next">${T.next}</span><img id="next-img" src="${fruitUrl(1)}" alt=""></div>
    <div class="chip"><img class="gold" src="${A("assets/lib/kenney-game-icons/icons/trophy.webp")}" alt=""><b id="best-val">0</b></div>
    <div class="chip gem-chip"><span class="gem-ico"></span><b id="gem-val">0</b></div>
    <button class="icon-btn shake-ico-btn" id="shake-btn" hidden aria-label="">
      <span class="sk-ring" id="shake-ring"></span>
      <span class="sk-ico"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <rect x="7" y="7.4" width="10" height="12.6" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="6" y="4" width="12" height="3" rx="1.2" fill="currentColor" opacity=".85"/>
        <path d="M4.2 11.6c-.9 1.2-.9 2.9 0 4.1M19.8 11.6c.9 1.2.9 2.9 0 4.1"
          fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg></span>
      <span class="sk-cost" id="shake-cost"></span>
    </button>
    <button class="icon-btn" id="mute-btn" aria-label="sound"><img id="mute-img" src="${A("assets/lib/kenney-game-icons/icons/audioOn.webp")}" alt=""></button>
  </div>
  <div id="coin-tip"></div>
  <div id="banner" data-i18n="watermelon">${T.watermelon}</div>
  <div class="panel" id="title-screen" hidden>
    <div class="lang-row" id="lang-row"></div>
    <h1>${T.title}</h1>
    <p class="sub" data-i18n="blurb">${T.blurb}</p>
    <p class="howto" data-i18n="howto">${T.howto}</p>
    <button class="btn ghost small" id="rules-btn" data-i18n="rulesTitle">${T.rulesTitle}</button>
    <ul class="rules" id="rules-list" data-mp-scroll hidden></ul>
    <button class="btn primary" id="start-btn">${T.start}</button>
    <button class="btn" id="fresh-btn" hidden>${T.newGame}</button>
    <button class="btn gold-btn" id="rank-btn" hidden data-i18n="rank">${T.rank}</button>
    <button class="btn" id="daily-btn"><span data-i18n="daily">${T.daily}</span><b id="daily-dot" hidden></b></button>
    <button class="btn" id="up-btn"><span data-i18n="upgrade">${T.upgrade}</span><b class="gem-mini" id="up-gems">0</b></button>
    <button class="btn" id="ach-btn" data-i18n="achievements">${T.achievements}</button>
  </div>
  <div class="panel" id="daily-screen" hidden>
    <h2 data-i18n="dailyTitle">${T.dailyTitle}</h2>
    <p class="sub" data-i18n="dailyDesc">${T.dailyDesc}</p>
    <div class="row"><span data-i18n="dailyBest">${T.dailyBest}</span><b id="daily-best">—</b></div>
    <div class="row"><span data-i18n="dailyStreak">${T.dailyStreak}</span><b id="daily-streak">0</b></div>
    <div class="board-note" id="daily-note" hidden></div>
    <button class="btn primary" id="daily-start">${T.dailyStart}</button>
    <button class="btn" id="daily-close" data-i18n="close">${T.close}</button>
  </div>
  <div class="panel" id="up-screen" hidden>
    <h2 data-i18n="upgradeTitle">${T.upgradeTitle}</h2>
    <div class="up-list" id="up-list" data-mp-scroll></div>
    <button class="btn" id="up-close" data-i18n="close">${T.close}</button>
  </div>
  <div class="panel" id="ach-screen" hidden>
    <h2 data-i18n="achievementsTitle">${T.achievementsTitle}</h2>
    <div class="ach-list" id="ach-list" data-mp-scroll></div>
    <button class="btn" id="ach-close" data-i18n="close">${T.close}</button>
  </div>
  <div class="panel" id="board-screen" hidden>
    <h2 data-i18n="rankTitle">${T.rankTitle}</h2>
    <div class="board" id="board-list" data-mp-scroll></div>
    <div class="board-note" id="board-note" hidden></div>
    <button class="btn" id="board-close">${T.close}</button>
  </div>
  <div class="panel" id="results-screen" hidden>
    <h2 data-i18n="gameOver">${T.gameOver}</h2>
    <div class="badge" id="new-record" hidden data-i18n="newRecord">${T.newRecord}</div>
    <div class="big-score" id="final-score">0</div>
    <div class="row"><span data-i18n="bestScore">${T.bestScore}</span><b id="final-best">0</b></div>
    <div class="row"><span data-i18n="biggest">${T.biggest}</span><b id="final-biggest">—</b></div>
    <div class="row"><span data-i18n="mergeCount">${T.mergeCount}</span><b id="final-merges">0</b></div>
    <div class="row"><span data-i18n="gems">${T.gems}</span><b id="final-gems">+0</b></div>
    <div class="row" id="final-rank" hidden></div>
    <button class="btn primary" id="retry-btn">${T.retry}</button>
    <button class="btn gold-btn" id="revive-btn" hidden>${T.revive}</button>
    <button class="btn" id="share-btn" hidden>${T.share}</button>
    <button class="btn gold-btn" id="rank-btn2" hidden data-i18n="rank">${T.rank}</button>
    <button class="btn ghost" id="login-btn" hidden data-i18n="loginToRank">${T.loginToRank}</button>
  </div>
  <div id="loading">
    <div class="load-ball"></div>
    <div class="load-track"><div id="load-fill"></div></div>
    <div class="load-txt" data-i18n="loading">${T.loading}</div>
  </div>`;
  hud = root.querySelector("#hud") ;
  scoreVal = root.querySelector("#score-val") ;
  bestVal = root.querySelector("#best-val") ;
  nextImg = root.querySelector("#next-img") ;
  titleEl = root.querySelector("#title-screen") ;
  startBtn = root.querySelector("#start-btn") ;
  freshBtn = root.querySelector("#fresh-btn") ;
  resultsEl = root.querySelector("#results-screen") ;
  finalScoreEl = root.querySelector("#final-score") ;
  finalBestEl = root.querySelector("#final-best") ;
  finalMergesEl = root.querySelector("#final-merges") ;
  finalBiggestEl = root.querySelector("#final-biggest") ;
  finalRankEl = root.querySelector("#final-rank") ;
  newRecordEl = root.querySelector("#new-record") ;
  retryBtn = root.querySelector("#retry-btn") ;
  shareBtn = root.querySelector("#share-btn") ;
  loginBtn = root.querySelector("#login-btn") ;
  rulesBtn = root.querySelector("#rules-btn") ;
  rulesList = root.querySelector("#rules-list") ;
  boardEl = root.querySelector("#board-screen") ;  boardList = root.querySelector("#board-list") ;
  boardNote = root.querySelector("#board-note") ;
  gemVal = root.querySelector("#gem-val") ;
  upGems = root.querySelector("#up-gems") ;
  dailyDot = root.querySelector("#daily-dot") ;
  dailyEl = root.querySelector("#daily-screen") ;
  dailyBestEl = root.querySelector("#daily-best") ;
  dailyStreakEl = root.querySelector("#daily-streak") ;
  dailyNote = root.querySelector("#daily-note") ;
  dailyStart = root.querySelector("#daily-start") ;
  upEl = root.querySelector("#up-screen") ;
  upList = root.querySelector("#up-list") ;
  achEl = root.querySelector("#ach-screen") ;
  achList = root.querySelector("#ach-list") ;
  reviveBtn = root.querySelector("#revive-btn") ;
  finalGemsEl = root.querySelector("#final-gems") ;
  root.querySelector("#daily-btn") .addEventListener("pointerdown", () => { openDaily(); });
  root.querySelector("#up-btn") .addEventListener("pointerdown", () => { upEl.hidden = false; renderUpgrades(); tap("tap-up"); });
  root.querySelector("#ach-btn") .addEventListener("pointerdown", () => { achEl.hidden = false; void renderAchievements(); tap("tap-ach"); });
  root.querySelector("#up-close") .addEventListener("pointerdown", () => { upEl.hidden = true; tap(); });
  root.querySelector("#ach-close") .addEventListener("pointerdown", () => { achEl.hidden = true; tap(); });
  root.querySelector("#daily-close") .addEventListener("pointerdown", () => { dailyEl.hidden = true; tap(); });
  dailyStart.addEventListener("pointerdown", gate(() => {
    if (meta.daily.date === dailyKey()) return;
    dailyEl.hidden = true; titleEl.hidden = true; hud.style.visibility = "visible";
    beginDaily(); phase = "play"; updateHud(); unlockAudio(); tap("tap-daily");
  }));
  reviveBtn.addEventListener("pointerdown", () => { doRevive(); });
  rankBtn = root.querySelector("#rank-btn") ;
  rankBtn2 = root.querySelector("#rank-btn2") ;
  const openBoard = () => {
    // UI 先切换:音效调用不能挡在面板打开之前(playCue 返回 receipt 而非 Promise)
    boardEl.hidden = false;
    void refreshBoard();
    tap();
  };
  rankBtn.addEventListener("pointerdown", openBoard);
  rankBtn2.addEventListener("pointerdown", openBoard);
  root.querySelector("#board-close") .addEventListener("pointerdown", () => {
    boardEl.hidden = true;
    tap();
  });
  rulesBtn.addEventListener("pointerdown", () => {
    rulesList.hidden = !rulesList.hidden;
    fillRules();
    tap();
  });
  bannerEl = root.querySelector("#banner") ;
  coinTip = root.querySelector("#coin-tip") ;
  shakeBtn = root.querySelector("#shake-btn") ;
  shakeCostEl = root.querySelector("#shake-cost") ;
  shakeRing = root.querySelector("#shake-ring") ;
  wireShakeButton();
  muteImg = root.querySelector("#mute-img") ;
  root.querySelector("#mute-btn") .addEventListener("pointerdown", () => {
    muted = !muted;
    void (sound ? sound.settings.setMuted(muted) : undefined);
    muteImg.src = muted
      ? A("assets/lib/kenney-game-icons/icons/audioOff.webp")
      : A("assets/lib/kenney-game-icons/icons/audioOn.webp");
  });
  // 开局收费：三个开局动作（开始 / 再来一局 / 每日挑战）都过 gate
  startBtn.addEventListener("pointerdown", gate(() => { startGame(true); }));
  freshBtn.addEventListener("pointerdown", gate(() => { startGame(false); }));
  retryBtn.addEventListener("pointerdown", gate(() => {
    cue("sfx.tap", { eventId: "tap-retry" });
    fx.clear();
    resultsEl.hidden = true;
    // 从每日挑战出来的,回到普通无尽模式
    if (runMode === "daily") { runMode = "endless"; dailyRand = null; }
    newRun();
    phase = "play";
    updateHud();
  }));
  shareBtn.addEventListener("pointerdown", () => {
    cue("sfx.tap", { eventId: "tap-share" });
    const sh = (gp       ).share;
    if (!shareBlob || sharing || !sh) return;
    sharing = true;
    sh.image(shareBlob, { text: T.shareText(score, best) })
      .then((ok         ) => { sharing = false; if (!ok) return; });
  });
  loginBtn.addEventListener("pointerdown", () => { gp.player.requestLogin(); });
  buildLangRow(root.querySelector("#lang-row")               );
  refreshTexts();
}

/* ---------- 语言 ---------- */
const LANG_LABEL                         = { zh: "中文", en: "EN", ja: "日本語" };

function buildLangRow(host             ) {
  host.innerHTML = "";
  for (const k of Object.keys(LANGS)) {
    const b = document.createElement("button");
    b.className = "lang-btn";
    b.dataset.lang = k;
    b.textContent = LANG_LABEL[k] ?? k;
    b.addEventListener("pointerdown", () => { applyLang(k        ); });
    host.appendChild(b);
  }
}

function applyLang(k      ) {
  if (k === currentLang()) return;
  setLang(k);
  refreshTexts();
  updateNextPreview();
  fillRules();
}

// 规则列表从字典渲染(不能靠 data-i18n 单串写入)
function fillRules() {
  const items = (T       ).rules                        ;
  if (!items) { rulesList.innerHTML = ""; return; }
  rulesList.innerHTML = items.map((s) => `<li>${s}</li>`).join("");
}

function refreshTexts() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = (el               ).dataset.i18n ;
    const v = (T       )[key];
    if (typeof v === "string") el.textContent = v;
  });
  startBtn.textContent = phase === "title" && pendingSave ? T.resume : T.start;
  freshBtn.textContent = T.newGame;
  retryBtn.textContent = T.retry;
  shareBtn.textContent = T.share;
  loginBtn.textContent = T.loginToRank;
  fillRules();
  refreshMetaUI();
  document.querySelectorAll("#lang-row .lang-btn").forEach((el) => {
    el.classList.toggle("on", (el               ).dataset.lang === currentLang());
  });
}

/* ---------- 字体 ---------- */
function setupFont() {
  const g      = (globalThis       ).gp;
  const id = "smiley-sans/SmileySans-Oblique.woff2";
  if (g?.fonts?.use) {
    void g.fonts.use({ display: id, body: id, lang: "zh" });
  } else {
    const url = "https://static.makeplay.ai/fonts/v1/smiley-sans/SmileySans-Oblique.woff2";
    const f = new FontFace("SmileySans", `url("${url}")`);
    void f.load().then((ff) => document.fonts.add(ff)).catch(() => {});
  }
}

/* ---------- 布局 ---------- */
function layout(width        , height        ) {
  vw = width; vh = height;
  boardScale = Math.min(vw / W, vh / H);
  baseX = (vw - W * boardScale) / 2;
  baseY = (vh - H * boardScale) / 2;
  if (board) {
    board.scale.set(boardScale);
    board.position.set(baseX, baseY);
  }
  if (bgSprite && bgSprite.texture.width > 1) {
    const t = bgSprite.texture;
    const s = Math.max(vw / t.width, vh / t.height);
    bgSprite.scale.set(s);
    bgSprite.position.set(vw / 2, vh / 2);
  }
  app.stage.hitArea = app.screen;
}

/* ---------- 物理 ---------- */
// 罐身实测:内壁在罐口约 ±150、罐底约 ±170,罐内底面 gameY≈714。
// 碰撞壁与可见玻璃对齐,否则水果堆会浮在罐子中间或陷进玻璃底座。
function wallXAt(y        , side        ) {
  const t = Math.min(1, Math.max(0, (y - 110) / (JAR_FLOOR - 110)));
  const half = MOUTH_HALF + (BODY_HALF - MOUTH_HALF) * t;
  return CX + side * half;
}

function buildWalls() {
  const topY = 110, botY = JAR_FLOOR;
  const lx0 = wallXAt(topY, -1), lx1 = wallXAt(botY, -1);
  const rx0 = wallXAt(topY, 1), rx1 = wallXAt(botY, 1);
  const mk = (x0        , x1        ) => {
    const cxm = (x0 + x1) / 2;
    const hy = (botY - topY) / 2 + 30;
    const ang = Math.atan2(x1 - x0, botY - topY);
    const b = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cxm, (topY + botY) / 2).setRotation(ang),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(14, hy).setRestitution(0.02).setFriction(0.45), b);
  };
  mk(lx0, lx1);
  mk(rx0, rx1);
  // 罐底:顶面与贴图内底对齐 (gameY = JAR_FLOOR)
  const floor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(CX, JAR_FLOOR + 20),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 20).setRestitution(0.02).setFriction(0.45), floor);
}

function spawnFruit(level        , x        , y        , opts                                                 = {})        {
  const r = RADII[level - 1];
  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    // 阻尼是“黏滞阻力”,它同样反对下落与沉降——压低它果堆才会往下压实,
    // 调高反而会让水果浮起(这是实测验证过的反直觉点)
    .setLinearDamping(0.05)
    .setAngularDamping(0.2)
    .setCcdEnabled(true);
  if (opts.angle) desc.setRotation(opts.angle);
  const body = world.createRigidBody(desc);
  if (opts.vy) body.setLinvel({ x: 0, y: opts.vy }, true);
  const col = world.createCollider(
    // 摩擦过高会“拱”成骨架、卡住空隙;中等摩擦才能让果堆一层层往下沉
    RAPIER.ColliderDesc.ball(r).setRestitution(0.03).setFriction(0.45).setDensity(1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    body,
  );
  const sprite = new PIXI.Sprite(fruitTex[level - 1]);
  const fit = FIT[level - 1];
  const base = (r * 2) / (fit.cw * ART_SCALE);
  sprite.anchor.set(0.5, fit.ay);
  sprite.scale.set(opts.pop ? base * 0.55 : base);
  sprite.position.set(x, y);
  fruitLayer.addChild(sprite);
  const f        = {
    id: fruitSeq++, level, r, x, y, body, sprite, baseScale: base,
    age: 0, merging: false, dead: false, landed: !opts.vy,
  };
  fruits.push(f);
  fruitByHandle.set(col.handle, f);
  if (opts.pop) pops.push({ s: sprite, base, t: 0 });
  return f;
}

function removeFruit(f       ) {
  f.dead = true;
  fruitByHandle.forEach((v, k) => { if (v === f) fruitByHandle.delete(k); });
  world.removeRigidBody(f.body);
  // 弹入动画可能还引用着这个精灵,先摘掉再销毁,避免拿已销毁对象改 transform
  for (let i = pops.length - 1; i >= 0; i--) if (pops[i].s === f.sprite) pops.splice(i, 1);
  f.sprite.destroy();
  const i = fruits.indexOf(f);
  if (i >= 0) fruits.splice(i, 1);
}

function clearFruits() {
  for (let i = fruits.length - 1; i >= 0; i--) removeFruit(fruits[i]);
  fruits.length = 0;
  fruitByHandle.clear();
  pops.length = 0;
  pendingAnnih.length = 0;
  mergeQueue.length = 0;
  beat = 0; beatGap = 0;
  lastDrop = null;
  for (const fl of floaters) fl.t.destroy();
  floaters.length = 0;
}

function impulseAround(cx        , cy        , nl        , ch = 1) {
  const R = RADII[nl - 1] * 2.6;
  const boost = 1 + Math.min(ch - 1, 8) * 0.22;
  for (const f of fruits) {
    if (f.dead) continue;
    const dx = f.x - cx, dy = f.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R || d < 1) continue;
    // 按质量缩放:否则大果质量大、收到的速度变化小到看不见(原有写法几乎无感)
    const m = f.body.mass();
    const dv = (70 + nl * 24) * Math.sqrt(16 / f.r) * (1 - d / R) * boost;
    f.body.applyImpulse({ x: (dx / d) * dv * m, y: (dy / d) * dv * m - dv * m * 0.3 }, true);
  }
}

/* ---------- 合成 ---------- */
// 碰撞只做判定与排队,真正结算交给节拍器(stepMerges),
// 否则同一次落果引发的连锁会在同一帧全部蜃完,既看不清也没手感。
function drainContacts() {
  eventQueue.drainCollisionEvents((h1, h2, started) => {
    if (!started) return;
    const a = fruitByHandle.get(h1), b = fruitByHandle.get(h2);
    const d = lastDrop;
    if (d && !d.landed && !d.dead && (a === d || b === d)) {
      d.landed = true;
      cue("sfx.drop", { eventId: `land-${dropSeq}` });
      fx.play("pickup-pop", { pos: { x: d.x, y: d.y + d.r * 0.7 }, scale: 0.35 });
    }
    // 结算后不再合成 —— 否则物理继续跑,分数会在结算屏出现后被偷偷改写
    if (phase !== "play") return;
    if (!a || !b || a.dead || b.dead || a.merging || b.merging) return;
    if (a.level !== b.level) return;
    // 立刻占位(merging),保证同一颗果不会被两段连续排队
    a.merging = b.merging = true;
    if (a.level >= 11) pendingAnnih.push([a, b]);
    else {
      mergeQueue.push([a, b]);
      if (mergeQueue.length === 1 && beat <= 0) kickBeat();
    }
  });
  while (pendingAnnih.length) { const [a, b] = pendingAnnih.pop() ; execAnnih(a, b); }
}

// 一段合成之间的间隔:链条越长越短(越来越快)
function chainGap()         {
  return CHAIN_GAPS[Math.min(CHAIN_GAPS.length - 1, chain)];
}
function kickBeat() {
  beat = chain === 0 ? FIRST_BEAT : 0;
  beatGap = chainGap();
}

// 每帧调用:到拍就结算一段合成,并刷新下一拍间隔
function stepMerges(dt        ) {
  if (mergeQueue.length === 0) { settleTimer = 0; return; }
  // 兜底:链条卡住(配对果已销毁等)超过 2s 就强制清空,否则永远不开下一颗
  settleTimer += dt;
  if (settleTimer > 2) {
    mergeQueue.length = 0;
    settleTimer = 0;
    return;
  }
  beat -= dt;
  if (beat > 0) return;
  const next = mergeQueue.shift() ;
  const [a, b] = next;
  if (a.dead || b.dead) { beat = 0.05; return; }
  execMerge(a, b);
  if (phase !== "play") { mergeQueue.length = 0; return; }
  // 读刚自增过的 chain:下一拍直接按新链条长度取更短的间隔
  beat = chainGap();
  if (chainPop < 0.1) chainPop = 0.1;
}

// 链果自然走完(队列空且落果流程已结束):复位连击,并开放下一颗
function chainSettled() {
  // 不在这里抢着结算队列 —— 抢着结算正是“一下子变成超大”的元凶。
  // 队列由 stepMerges 按拍自然走完;若队列非空说明链条还在演,调用方应稍后再试。
  if (mergeQueue.length) return false;
  chain = 0;
  chainPop = 0;
  return true;
}

function execMerge(a       , b       ) {
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const nl = a.level + 1;
  removeFruit(a); removeFruit(b);
  chain++;
  const gain = Math.round(nl * 10 * Math.pow(1.5, chain - 1));
  score += gain; mergeCount++; biggest = Math.max(biggest, nl);
  const nf = spawnFruit(nl, cx, cy, { pop: true });
  nf.age = 0; // 新果享有与落果同样的 1.2s 警戒宽限,避免高位置连锁合成被立刻判违规
  // 连击越靠后:推开力度越大、特效越重、音调越高 —— “越来越爆”
  impulseAround(cx, cy, nl, chain);
  const pos = { x: cx, y: cy };
  const ch = Math.min(chain, 8);
  if (ch >= 4) fx.play("heavy-hit", { pos, power: 0.5 + ch * 0.07 });
  else if (nl <= 4) fx.play("pickup-pop", { pos, scale: 0.7 + nl * 0.25, power: 0.5 + ch * 0.12 });
  else if (nl <= 8) fx.play("pickup-pop", { pos, scale: 1.1 + nl * 0.1, power: 0.6 + ch * 0.12 });
  else fx.play("heavy-hit", { pos, power: 0.55 + nl * 0.06 });
  cue("sfx.merge", {
    eventId: `m${fruitSeq}`,
    // 每段升半音 + 连击再层层升高,耳朵能听出节拍在加速
    pitchSemitones: Math.max(-12, Math.min(24, 11 - nl + (chain - 1) * 2)),
  });
  if (chain >= 2) {
    floater(`×${chain}  +${gain}`, cx, cy - nf.r, 26 + Math.min(chain, 6) * 2);
    chainPop = 0.14;
  } else floater(`+${gain}`, cx, cy - nf.r, 24);
  if (nl === 11) watermelonCeremony(cx, cy);
  // ---- 成就与局外统计 ----
  meta.totalMerges = (meta.totalMerges ?? 0) + 1;
  gp.player.achievements.progress("merges500", meta.totalMerges);
  if (nl === 11) gp.player.achievements.unlock("first_watermelon");
  if (chain >= 5) gp.player.achievements.unlock("chain5");
  if (!scoreAt10k && score >= 10000) { scoreAt10k = true; gp.player.achievements.unlock("score10k"); }
  if (!scoreAt50k && score >= 50000) { scoreAt50k = true; gp.player.achievements.unlock("score50k"); }
  void persistMetaDebounced();
  updateHud(); saveRun();
}

function execAnnih(a       , b       ) {
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  removeFruit(a); removeFruit(b);
  score += 1000; mergeCount++;
  fx.play("explosion-impact", { pos: { x: cx, y: cy }, power: 1 });
  cue("sfx.merge", { eventId: `x${fruitSeq}`, pitchSemitones: -10 });
  floater("+1000", cx, cy - 60);
  impulseAround(cx, cy, 11);
  void gp.player.achievements.unlock("double_watermelon");
  updateHud(); saveRun();
}

function watermelonCeremony(x        , y        ) {
  slowmoT = 0.45;
  // 先用一次 explosion-impact 驱动 FX 镜头冲击,再放大成全屏震屏
  impactPunch = 1.6;
  fx.play("explosion-impact", { pos: { x, y }, power: 1 });
  fx.play("confetti-burst", { pos: { x, y }, power: 1 });
  cue("sfx.watermelon", { eventId: `wm${fruitSeq}` });
  bannerEl.classList.add("show");
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => bannerEl.classList.remove("show"), 1500);
}

/* ---------- 警戒与结算 ---------- */
function updateWarning(dt        ) {
  if (resumeGrace > 0) {
    resumeGrace -= dt; warnT = 0; warnTick = 0;
    for (const f of fruits) if (!f.dead) f.sprite.tint = 0xffffff;
    return;
  }
  let over = false;
  for (const f of fruits) {
    if (f.dead || f.age < 1.2) continue;
    if (f.y - f.r < warnY()) { over = true; break; }
  }
  if (over) {
    warnT += dt; warnTick += dt;
    if (warnTick >= 0.5) {
      warnTick = 0;
      cue("sfx.tick", { eventId: `tk${Math.floor(time * 2)}` });
    }
    if (warnT >= WARN_SECONDS) { gameOver(); return; }
  } else {
    // 低于警戒线时缓慢回落,而不是归零——旧写法一帧低于线就白送满 10 秒(玩家说的“像作弊”)
    warnT = Math.max(0, warnT - dt * WARN_DECAY);
    warnTick = 0;
  }
  for (const f of fruits) {
    if (f.dead) continue;
    const hot = over && f.age >= 1.2 && f.y - f.r < warnY() + 30;
    f.sprite.tint = hot && Math.sin(time * 12) > 0 ? 0xffb3b3 : 0xffffff;
  }
}

function clearAutosave() {
  const s      = gp.player.saves;
  if (typeof s.clearLatest === "function") { void s.clearLatest(); return; }
  // 兼容未暴露 clearLatest 的宿主:按 kind 找自动存档行并删除(绝不按名字判断)
  void s.list(20).then((rows       ) => {
    const auto = (rows ?? []).find((r) => r.kind === "auto");
    if (auto) void s.delete(auto.id);
  });
}

function gameOver() {
  if (phase !== "play") return;
  phase = "over";
  hideAim();
  warnT = 0;
  pendingAnnih.length = 0;
  mergeQueue.length = 0;
  chain = 0; chainPop = 0;
  clearAutosave();
  cue("sfx.gameover", { eventId: `over-${Date.now()}` });
  const isRecord = score > best;
  if (isRecord) { best = score; void persistBest(); }
  void settleMetaRewards();
  updateHud();
  void submitScoreOnce();
  window.setTimeout(() => {
    // 物理在结算屏背后还会继续跑一会儿,延迟取快照能让截图里果堆落定
    if (phase === "over") { showResults(isRecord); void captureShare(); }
  }, 900);
}

function showResults(isRecord         ) {
  finalScoreEl.textContent = String(score);
  finalBestEl.textContent = String(best);
  finalMergesEl.textContent = String(mergeCount);
  finalGemsEl.textContent = `+${gemsThisRun}`;
  finalBiggestEl.innerHTML = biggest > 0
    ? `<img src="${fruitUrl(biggest)}" alt=""> ${T.fruitNames[biggest - 1]}`
    : "—";
  newRecordEl.hidden = !isRecord;
  loginBtn.hidden = !needLoginFlag;
  finalRankEl.hidden = true; // 提交完成后再显示
  // 复活:清掉罐口附近的果继续这一局(每日挑战也允许)
  // 复活改为金币购买:结算屏始终提供(价格在按钮上)
  reviveBtn.hidden = false;
  refreshReviveLabel();
  // 每日挑战一天一次:不提供“再来一局”
  retryBtn.hidden = runMode === "daily";
  if (runMode === "daily") {
    const row = document.createElement("div");
    row.className = "board-note";
    row.textContent = T.dailyPlayed;
  }
  resultsEl.hidden = false;
}

/** 复活:移除罐口附近(警戒线以上)的果,回到对局 */
// 【改造】原版花 4 枚平台金币;现在花 25 宝石,或消耗已存的复活次数
async function doRevive() {
  if (phase !== "over" || buying) return;
  // 已存的次数优先,其次现花宝石
  if (meta.consum.revive > 0) {
    meta.consum.revive--;
  } else if (meta.gems >= REVIVE_GEMS) {
    meta.gems -= REVIVE_GEMS;
  } else {
    flashTip(T.gemsShort);
    return;
  }
  void persistMetaNow();
  refreshMetaUI();
  gp.player.achievements.unlock("revive_used");
  const wy = warnY();
  const doomed = fruits.filter((f) => !f.dead && f.y - f.r < wy + 60);
  for (const f of doomed) removeFruit(f);
  fx.play("explosion-impact", { pos: { x: CX, y: wy }, power: 0.9 });
  cue("sfx.watermelon", { eventId: `revive-${Date.now()}` });
  resultsEl.hidden = true;
  warnT = 0; warnTick = 0;
  resumeGrace = 1.5;
  phase = "play";
  updateHud();
  saveRun();
}

async function submitScoreOnce() {
  const r = await gp.player.submitScore(score);
  if ((r       ).needLogin) { needLoginFlag = true; loginBtn.hidden = resultsEl.hidden; }
  else if (typeof r.best === "number") { best = Math.max(best, r.best); updateHud(); }
  if (typeof r.rank === "number" && r.rank > 0) {
    lastRank = r.rank;
    finalRankEl.hidden = false;
    finalRankEl.innerHTML = `<span>${T.yourRank}</span><b>#${r.rank}</b>`;
  }
  // 提交后榜单已变,若榜单开着就刷新
  if (!boardEl.hidden) void refreshBoard();
}

async function persistBest() {
  const list = await gp.player.saves.list(100);
  const hit = list.find((r) => r.name === "__sys_best");
  const data = { v: 1, best };
  if (hit) await gp.player.saves.update(hit.id, data, "__sys_best");
  else await gp.player.saves.create(data, "__sys_best");
}

/* ---------- 局外成长存档(__sys_meta,独立于 run 自动存档) ---------- */
let metaLoaded = false;
let metaDirty = false;
let metaTimer = 0;

async function loadMeta() {
  try {
    const list = await gp.player.saves.list(100);
    const hit = list.find((r) => r.name === "__sys_meta");
    if (hit) {
      const full = await gp.player.saves.get(hit.id);
      meta = normalizeMeta(full?.data);
    }
  } catch { /* 读失败就从空状态开始 */ }
  metaLoaded = true;
  refreshMetaUI();
}

async function persistMetaNow() {
  if (!metaLoaded) return;
  metaDirty = false;
  try {
    const list = await gp.player.saves.list(100);
    const hit = list.find((r) => r.name === "__sys_meta");
    const data = meta       ;
    if (hit) await gp.player.saves.update(hit.id, data, "__sys_meta");
    else await gp.player.saves.create(data, "__sys_meta");
  } catch { /* 写失败下次再试 */ }
}

// 最小间隔合并器(不是防抖):宝石/成就频率不高,3s 一次足够,
// 并保证离开页面时立即落盘
function persistMetaDebounced() {
  metaDirty = true;
  if (metaTimer) return;
  metaTimer = window.setTimeout(() => { metaTimer = 0; if (metaDirty) void persistMetaNow(); }, 3000);
}

// 结算:按成绩发宝石、记每日成绩、发成就
async function settleMetaRewards() {
  if (!metaLoaded) await loadMeta();
  gemsThisRun = gemReward(score, mergeCount, biggest, meta.up.luck);
  meta.gems += gemsThisRun;

  if (runMode === "daily") {
    const key = dailyKey();
    if (meta.daily.date !== key) {
      const prev = meta.daily.lastDate;
      const y = new Date(); y.setDate(y.getDate() - 1);
      const isConsecutive = prev === dailyKey(y);
      meta.daily = {
        date: key,
        best: Math.max(0, score),
        streak: isConsecutive ? meta.daily.streak + 1 : 1,
        lastDate: key,
      };
    } else {
      meta.daily.best = Math.max(meta.daily.best, score);
    }
    gp.player.achievements.progress("daily7", meta.daily.streak);
  }
  await persistMetaNow();
  refreshMetaUI();
}

/** 买下一级升级;买得起且未满级才生效 */
function buyUpgrade(key       )          {
  const lv = meta.up[key];
  const cost = nextCost(key, lv);
  if (cost == null || meta.gems < cost) return false;
  meta.gems -= cost;
  meta.up[key] = lv + 1;
  void persistMetaNow();
  refreshMetaUI();
  cue("sfx.tap", { eventId: `buy-${key}-${meta.up[key]}` });
  return true;
}

async function loadBest() {
  const list = await gp.player.saves.list(100);
  const hit = list.find((r) => r.name === "__sys_best");
  if (hit) {
    const full = await gp.player.saves.get(hit.id);
    if (full?.data?.best) best = Math.max(best, full.data.best);
  }
  if (pendingSave?.best) best = Math.max(best, pendingSave.best);
  updateHud();
}

/* ---------- 摇一摇(花 2 金币) ---------- */
let shaking = 0;

function shakeImpulse() {
  // 真物理:给每颗果一个横向冲量 + 轻微上抛,再让重力把它们福回来
  for (const f of fruits) {
    if (f.dead) continue;
    const m = f.body.mass();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const kx = (1500 + Math.random() * 1900) * dir * SHAKE_G_SCALE;
    const ky = -(1100 + Math.random() * 1700) * SHAKE_G_SCALE;
    // 单位质量速度增量 ≈ kx/ky px/s;上抛高度 = ky²/(2g),因此按 √(g/g₀) 等比缩放
    // 才能在重力加大后保持同样的摇晃幅度(只在 g 变化时改这个常量)
    f.body.applyImpulse({ x: kx * m * 0.06, y: ky * m * 0.06 }, true);
  }
  shaking = 0.55;
  // 镜头也抖一下(走同一套 FX 冲击)
  impactPunch = Math.max(impactPunch, 0.9);
  fx.play("pickup-pop", { pos: { x: CX, y: JAR_FLOOR - 80 }, scale: 1.6 });
}

function playShake() {
  shakeImpulse();
  cue("sfx.shake", { eventId: `shk${Date.now()}` });
}

// 一次点击只发起一次支付;支付弹窗打开期间游戏冻结(buying),避免玩家看弹窗时被判负。
/* ---------- 摇一摇:长按蓄力 ---------- */
// 不再要求“真的摇手机”,也不同即点即用——长按按钮蓄力(HOLD_SECONDS),
// 蓄满才触发,松早了取消且不扣金币。
const HOLD_SECONDS = 1.2;
// 每局送 1 次免费摇罐:先免费用完,再消耗已购次数,最后才弹金币购买。
// 它属于“这一局”的状态,必须进逐局存档,否则关页重开就能刷新白嫆。
const FREE_SHAKE_PER_RUN = 1;
let freeShake = FREE_SHAKE_PER_RUN;
let holdT = 0, holding = false;

function wireShakeButton() {
  const start = (e              ) => {
    e.preventDefault();
    if (phase !== "play" || buying) return;
    // 无论能不能支付都进入蓄力:玩家要能看到进度、有反馈。
    // 旧写法在“无次数且支付不可用”时直接 return,长按完全没反应(用户报的 bug)。
    holding = true; holdT = 0;
    shakeBtn.classList.add("charging");
    // 抓住指针:手指/鼠标略微滑出按钮不会中断蓄力(手机上极易发生)
    try { shakeBtn.setPointerCapture(e.pointerId); } catch { /* 旧浏览器忽略 */ }
  };
  const cancel = () => {
    if (!holding) return;
    holding = false; holdT = 0;
    shakeBtn.classList.remove("charging");
    if (shakeRing) shakeRing.style.background = "conic-gradient(#ffd76a 0turn, transparent 0turn)";
  };
  shakeBtn.addEventListener("pointerdown", start);
  shakeBtn.addEventListener("pointerup", cancel);
  shakeBtn.addEventListener("pointercancel", cancel);
  // 故意不监听 pointerleave:有了 capture 后滑出按钮仍算蓄力中
  // 避免长按弹出右键菜单/文本选择
  shakeBtn.addEventListener("contextmenu", (e) => e.preventDefault());
}

// 每帧推进蓄力;蓄满则触发一次摇罐(优先消耗已购次数,否则走平台支付)
function updateHold(dt        ) {
  if (!holding) return;
  if (phase !== "play") { holdT = 0; return; }
  holdT = Math.min(HOLD_SECONDS, holdT + dt);
  const frac = holdT / HOLD_SECONDS;
  if (shakeRing) {
    shakeRing.style.background = `conic-gradient(#ffd76a ${(frac * 360).toFixed(0)}deg, transparent ${(frac * 360).toFixed(0)}deg)`;
  }
  if (holdT >= HOLD_SECONDS) {
    holding = false; holdT = 0;
    shakeBtn.classList.remove("charging");
    void doShake();
  }
}

async function doShake() {
  if (phase !== "play" || shaking > 0 || buying) return;
  // 1) 本局免费的那一次
  if (freeShake > 0) {
    freeShake--;
    playShake();
    saveRun();
    updateHud();
    return;
  }
  // 2) 已存的次数(宝石早就花过了)
  if (meta.consum.shake > 0) {
    meta.consum.shake--;
    void persistMetaNow();
    playShake();
    updateHud();
    return;
  }
  // 3) 现花宝石摇一次
  if (meta.gems < SHAKE_GEMS) { flashTip(T.gemsShort); return; }
  meta.gems -= SHAKE_GEMS;
  void persistMetaNow();
  refreshMetaUI();
  playShake();
  updateHud();
}

function flashTip(msg        ) {
  if (!coinTip) return;
  coinTip.textContent = msg;
  coinTip.classList.add("show");
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => coinTip.classList.remove("show"), 2600);
}

async function captureShare() {
  const sh = (gp       ).share;
  if (!sh || sh.available === false || typeof sh.image !== "function") { shareBtn.hidden = true; return; }
  shareBlob = typeof sh.snap === "function" ? await sh.snap() : null;
  if (!shareBlob) shareBlob = await manualCapture();
  shareBtn.hidden = !shareBlob;
}

// 旧宿主没有 gp.share.snap() 时的回退:pixi 的 extract 会把舞台重绘一遍,
// 在同一帧内取到已完成渲染的位图。
async function manualCapture()                       {
  try {
    const cv = app.renderer.extract.canvas({
      target: app.stage,
      frame: new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height),
    })                     ;
    const k = Math.min(1, 1280 / Math.max(cv.width, cv.height));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(cv.width * k));
    out.height = Math.max(1, Math.round(cv.height * k));
    out.getContext("2d") .drawImage(cv, 0, 0, out.width, out.height);
    return await new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.85));
  } catch { return null; }
}

/* ---------- 排行榜(前 10) ---------- */
function esc(s        )         {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]          ));
}

async function refreshBoard() {
  boardList.innerHTML = "";
  boardNote.hidden = true;
  // 未登录也能看榜;只提示登录后会出现在榜单上
  if (!gp.player.user) {
    boardNote.textContent = T.rankGuest;
    boardNote.hidden = false;
  }
  let top                     = [];
  try { top = (await gp.player.topScores(10)) ?? []; } catch { top = []; }
  if (!top.length) {
    const d = document.createElement("div");
    d.className = "board-empty";
    d.textContent = T.rankEmpty;
    boardList.appendChild(d);
    return;
  }
  top.slice(0, 10).forEach((e, i) => {
    const row = document.createElement("div");
    row.className = "br" + (i === 0 ? " top1" : "") + (e.isMe ? " me" : "");
    row.innerHTML =
      `<span class="pos">${i + 1}</span>` +
      (e.avatar ? `<img class="av" src="${esc(e.avatar)}" alt="">` : "") +
      `<span class="nm">${esc(e.name)}</span>` +
      `<span class="sc">${Math.round(e.score).toLocaleString()}</span>` +
      (e.isMe ? `<span class="me-tag">${T.rankMe}</span>` : "");
    boardList.appendChild(row);
  });
}

/* ---------- 存档(run 级续局) ---------- */
function saveRun() {
  if (phase !== "play") return;
  const snap = {
    v: 1, score, best, mergeCount, biggest, current, next: nextLv, freeShake,
    fruits: fruits.filter((f) => !f.dead).map((f) => ({
      l: f.level, x: Math.round(f.x), y: Math.round(f.y), a: +f.body.rotation().toFixed(2),
    })),
  };
  void gp.player.saves.putLatest(snap, "kv");
}

function parseSave(d     ) {
  if (!d || typeof d !== "object" || d.v !== 1 || !Array.isArray(d.fruits)) return null;
  if (typeof d.score !== "number" || typeof d.current !== "number" || typeof d.next !== "number") return null;
  return d;
}

function restoreRun(s     ) {
  clearFruits();
  score = s.score; mergeCount = s.mergeCount ?? 0; biggest = s.biggest ?? 0;
  best = Math.max(best, s.best ?? 0);
  current = s.current; nextLv = s.next;
  chain = 0; warnT = 0; warnTick = 0; lastDrop = null;
  // 免费摇罐次数属于本局状态,跟着存档走(不允许关页刷新)
  freeShake = typeof s.freeShake === "number" ? Math.max(0, s.freeShake | 0) : 0;
  for (const fs of s.fruits) {
    if (fs.l < 1 || fs.l > 11) continue;
    const f = spawnFruit(fs.l, fs.x, fs.y, { angle: fs.a ?? 0 });
    f.age = 5;
  }
  // 恢复后给一段宽限:存档时堆尖可能正好在警戒线以上,不能立刻判负
  resumeGrace = 2.5;
  aimReady = true; aimX = CX; dropWait = 0;
  showAim(); updateHud(); updateNextPreview();
}

/* ---------- 局管理 ---------- */
// 落果等级:每日挑战用固定种子流(全服同一副牌局),普通局用 Math.random
// 抽落果等级:由 [0,1) 随机数决定(普通局用 Math.random,每日挑战用固定种子流)
function randLevel()         {
  const cap = STARTER_CAP[Math.min(STARTER_CAP.length - 1, meta.up.starter)];
  const rnd = dailyRand ?? Math.random;
  let r = Math.max(0, Math.min(99.999, rnd() * 100));
  for (let i = 0; i < cap; i++) { r -= DROP_WEIGHTS[i]; if (r < 0) return i + 1; }
  return 1;
}

function newRun() {
  clearFruits();
  score = 0; mergeCount = 0; biggest = 0; chain = 0;
  shaking = 0;
  warnT = 0; warnTick = 0; resumeGrace = 0;
  slowmoT = 0; slowmoScale = 1; physAcc = 0;
  impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
  impactPunch = 0;
  needLoginFlag = false;
  gemsThisRun = 0;
  freeShake = FREE_SHAKE_PER_RUN;
  scoreAt10k = false; scoreAt50k = false;
  current = randLevel(); nextLv = randLevel();
  aimReady = true; aimX = CX; dropWait = 0;
  showAim(); updateHud(); updateNextPreview();
}

/** 开一局普通无尽(或从存档续局) */
function beginEndless(useSave         ) {
  runMode = "endless";
  dailyRand = null;
  if (useSave && pendingSave) restoreRun(pendingSave);
  else { clearAutosave(); newRun(); }
}

/** 开一局每日挑战:同一天全服同一个种子流,罐子从头开始 */
function beginDaily() {
  runMode = "daily";
  dailyRand = mulberry32(seedFrom(dailyKey()));
  clearAutosave();
  newRun();
}

/** 当前警戒线 y(受升级影响) */
const warnY = () => WARN_Y_BY_LEVEL[Math.min(WARN_Y_BY_LEVEL.length - 1, meta.up.warn)];

function startGame(useSave         ) {
  // 素材还在加载:先告诉玩家稍等,不要进一个半成品对局
  if (!sceneReady) { flashTip(T.loading); return; }
  void begin(useSave);
}

async function begin(useSave         ) {
  // 先切界面再碰音频:音效未就绪不能阻断开始流程(曾因此卡在标题屏)
  titleEl.hidden = true;
  hud.style.visibility = "visible";
  beginEndless(useSave);
  phase = "play";
  updateHud();
  unlockAudio();
  cue("sfx.tap", { eventId: "tap-begin" });
}

/* ---------- HUD / 瞄准 ---------- */
/* ---------- 局外面板渲染 ---------- */
function refreshMetaUI() {
  if (gemVal) gemVal.textContent = String(meta.gems);
  if (upGems) {
    upGems.textContent = String(meta.gems);
    const firstAffordable = UPGRADES.some((u) => {
      const c = nextCost(u.key, meta.up[u.key]);
      return c != null && meta.gems >= c;
    });
    upGems.classList.toggle("poor", !firstAffordable);
  }
  if (dailyDot) dailyDot.hidden = meta.daily.date === dailyKey();
  if (upEl && !upEl.hidden) renderUpgrades();
  // 结算屏的复活按钮文案也跟次数/价格走(否则买了次数按钮不更新)
  if (reviveBtn && phase === "over") refreshReviveLabel();
}

/** 复活按钮文案:有已购次数显示“剩余 N”,否则显示金币单价 */
function refreshReviveLabel() {
  const have = meta.consum.revive;
  // 【改造】原来显示的是平台金币价,现在显示宝石价(图标就是 HUD 里那颗钻石)
  reviveBtn.innerHTML = have > 0
    ? `${esc(T.revive)} (${esc(T.reviveLeft)} ${have})`
    : `${esc(T.revive)} · <span class="gem-ico"></span> ${REVIVE_GEMS}`;
}

function renderUpgrades() {
  upList.innerHTML = "";
  for (const u of UPGRADES) {
    const lv = meta.up[u.key];
    const cost = nextCost(u.key, lv);
    const maxed = cost == null;
    const afford = !maxed && meta.gems >= (cost          );
    const row = document.createElement("div");
    row.className = "up-row";
    row.innerHTML =
      `<div class="up-info">` +
      `<div class="up-name">${esc((T       )[u.i18n])}</div>` +
      `<div class="up-desc">${esc((T       )[`${u.i18n}Desc`])}</div>` +
      `<div class="up-lv">Lv ${lv}/${u.max}</div>` +
      `</div>` +
      `<button class="up-buy${maxed ? " max" : ""}">${maxed ? esc(T.upMax) : `${cost}`}</button>`;
    const btn = row.querySelector("button")                     ;
    btn.disabled = maxed || !afford;
    btn.addEventListener("pointerdown", () => { if (buyUpgrade(u.key)) renderUpgrades(); });
    upList.appendChild(row);
  }
}

// 成就面板:以本游戏声明的 8 项为准渲染(试玩环境 list() 可能返回空),
// 再把平台返回的解锁/进度合并进去。
const ACH_KEYS = [
  "first_watermelon", "double_watermelon", "chain5", "score10k",
  "score50k", "merges500", "daily7", "revive_used",
];

async function renderAchievements() {
  achList.innerHTML = "";
  let remote        = [];
  try { remote = (await gp.player.achievements.list()) ?? []; } catch { remote = []; }
  const byKey = new Map(remote.map((a     ) => [a.key, a]));

  for (const key of ACH_KEYS) {
    const r = byKey.get(key);
    const text = (T       ).ach?.[key] ?? { name: key, desc: "" };
    const got = r?.unlocked === true;
    const target = r?.target ?? null;
    const prog = target ? ` (${Math.min(r?.progress ?? 0, target)}/${target})` : "";
    const icon = r?.icon ?? A(`assets/achievements/${key}.webp`);
    const row = document.createElement("div");
    row.className = "ach-row";
    row.innerHTML =
      `<img class="ach-ico${got ? "" : " locked"}" src="${esc(icon)}" alt="">` +
      `<div class="ach-info"><div class="ach-name">${esc(text.name)}</div>` +
      `<div class="ach-desc">${esc(text.desc)}${prog}</div></div>` +
      `<div class="ach-state${got ? "" : " locked"}">${got ? "✓" : esc(T.achLocked)}</div>`;
    achList.appendChild(row);
  }
}

function openDaily() {
  const played = meta.daily.date === dailyKey();
  dailyBestEl.textContent = played ? String(meta.daily.best) : "—";
  dailyStreakEl.textContent = String(meta.daily.streak);
  dailyNote.hidden = !played;
  dailyNote.textContent = played ? T.dailyPlayed : "";
  dailyStart.disabled = played;
  dailyEl.hidden = false;
  tap("tap-daily-open");
}

function updateHud() {
  scoreVal.textContent = String(score);
  bestVal.textContent = String(best);
  if (shakeBtn) {
    // 对局中始终显示(用户曾因按钮被隐藏而"找不到摇一摇");
    // 【改造】宝石不够时变灰,点击说明原因(原来判断的是平台支付可用性)
    const sellable = meta.gems >= SHAKE_GEMS;
    lastSellable = sellable;
    const have = meta.consum.shake;
    const free = freeShake;
    shakeBtn.hidden = phase !== "play";
    // 有免费 或 有已存次数 都算可用(不变灰)
    shakeBtn.classList.toggle("off", !sellable && have <= 0 && free <= 0);
    shakeBtn.classList.toggle("busy", buying || shaking > 0);
    shakeBtn.classList.toggle("ready", free > 0 || have > 0);
    const label = free > 0
      ? `<span class="sk-free">${T.shakeFree}</span>`
      : have > 0
        ? `×${have}`
        : `<span class="gem-ico"></span><span>${SHAKE_GEMS}</span>`;
    if (shakeCostEl.innerHTML !== label) shakeCostEl.innerHTML = label;
    shakeBtn.setAttribute(
      "aria-label",
      free > 0
        ? `${T.shake} · ${T.shakeFree}`
        : have > 0 ? `${T.shake} · ${T.shakeFree} ×${have}` : `${T.shakeTitle} · ${T.shakeCost}`,
    );
  }
}
function updateNextPreview() { nextImg.src = fruitUrl(nextLv); }

function showAim() {
  if (!aimSprite || !aimLayer) return; // 场景还未搭好(如素材加载中就点击开始)
  const fit = FIT[current - 1];
  aimSprite.texture = fruitTex[current - 1];
  aimSprite.anchor.set(0.5, fit.ay);
  aimSprite.scale.set((RADII[current - 1] * 2) / (fit.cw * ART_SCALE));
  aimSprite.x = aimX; aimSprite.y = DROP_Y;
  aimLayer.visible = true;
}
function hideAim() { aimLayer.visible = false; }

function clampAim(x        ) {
  const r = RADII[current - 1];
  return Math.max(wallXAt(DROP_Y, -1) + r, Math.min(wallXAt(DROP_Y, 1) - r, x));
}

function dropCurrent() {
  if (!aimReady || phase !== "play") return;
  aimReady = false;
  chain = 0;
  lastDrop = spawnFruit(current, aimX, DROP_Y, { vy: 380 });
  hideAim();
  current = nextLv; nextLv = randLevel();
  updateNextPreview();
  dropWait = 0.6;
  dropSeq++;
  saveRun();
}

function drawAim() {
  aimGfx.clear();
  const r = RADII[current - 1];
  for (let y = DROP_Y + r + 8; y < JAR_FLOOR - 6; y += 16) {
    aimGfx.rect(aimX - 1.5, y, 3, 9).fill({ color: 0xeaf7fb, alpha: 0.32 });
  }
  // 落点预瞄:在罐底画一段落点范围,让玩家看得到会落在哪里
  const l = wallXAt(JAR_FLOOR - 10, -1), rr = wallXAt(JAR_FLOOR - 10, 1);
  const px = Math.max(l + r, Math.min(rr - r, aimX));
  aimGfx.moveTo(px - r, JAR_FLOOR - 10).lineTo(px + r, JAR_FLOOR - 10)
    .stroke({ color: 0xffd76a, alpha: 0.35, width: 3 });
}

function drawWarn() {
  warnGfx.clear();
  const alarm = warnT > 0;
  const color = alarm ? "#ff4d5e" : "#ffd93b";
  const alpha = alarm ? 0.55 + 0.45 * Math.abs(Math.sin(time * 9)) : 0.75;
  const wy = warnY();
  const l = wallXAt(wy, -1) + 4, r = wallXAt(wy, 1) - 4;
  for (let x = l; x < r - 8; x += 18) {
    warnGfx.rect(x, wy - 2, 10, 4).fill({ color, alpha });
  }
  if (alarm && phase === "play") {
    warnText.visible = true;
    warnText.text = String(Math.max(1, Math.ceil(WARN_SECONDS - warnT)));
  } else warnText.visible = false;
}

/* ---------- 动效小件 ---------- */
function floater(txt        , x        , y        , size = 24) {
  const t = new PIXI.Text({
    text: txt,
    style: { fontFamily: FONT_STACK, fontSize: size, fill: "#ffd76a", stroke: { color: "#0b222c", width: 5 } },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  floatLayer.addChild(t);
  floaters.push({ t, life: 0 });
}
function updateFloaters(dt        ) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life += dt;
    f.t.y -= 34 * dt;
    f.t.alpha = Math.max(0, 1 - f.life / 0.9);
    if (f.life >= 0.9) { f.t.destroy(); floaters.splice(i, 1); }
  }
}
function easeOutBack(x        ) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}
function updatePops(dt        ) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    if (!p.s || (p.s       ).destroyed) { pops.splice(i, 1); continue; }
    p.t += dt / 0.22;
    let k        ;
    if (p.t >= 1) k = 1;
    else if (p.t < 0.55) k = 0.55 + (1.12 - 0.55) * easeOutBack(p.t / 0.55);
    else k = 1.12 + (1 - 1.12) * ((p.t - 0.55) / 0.45);
    p.s.scale.set(p.base * k);
    if (p.t >= 1) pops.splice(i, 1);
  }
}

/* ---------- 帧循环 ---------- */
function frame(ticker             ) {
  const realDt = Math.min(ticker.deltaMS / 1000, 0.05);
  time += realDt;
  const ts = fx.update(realDt);
  if (slowmoT > 0) slowmoT -= realDt;
  slowmoScale += ((slowmoT > 0 ? 0.25 : 1) - slowmoScale) * Math.min(1, realDt * 7);
  const gdt = buying ? 0 : realDt * ts * slowmoScale; // 支付弹窗期间冻结物理与警戒计时

  if (phase !== "title") {
    physAcc += gdt;
    let n = 0;
    while (physAcc >= STEP && n < 4) {
      world.step(eventQueue);
      drainContacts();
      physAcc -= STEP; n++;
    }
    if (n === 4) physAcc = 0;
    syncFruits(gdt);
    if (phase === "play") {
      stepMerges(gdt);
      if (dropWait > 0) dropWait -= gdt;
      // 关键:每帧都检查链条是否走完,而不是只在倒计时归零那一帧看一次
      // (只看一次的话,那帧链条未走完就永远卡住,下一颗水果再也不会出现)
      if (dropWait <= 0 && !aimReady && chainSettled()) { aimReady = true; showAim(); }
      updateWarning(gdt);
    }
  }
  if (chainPop > 0) chainPop -= realDt;
  updateHold(realDt);
  // 摇罐冷却:必须递减,否则第一次之后会被永久锁住
  if (shaking > 0) { shaking = Math.max(0, shaking - realDt); if (shaking === 0) updateHud(); }
  updatePops(realDt);
  updateFloaters(realDt);
  drawWarn();
  if (aimLayer.visible) {
    aimSprite.y = DROP_Y + Math.sin(time * 3.2) * 3;
    drawAim();
  }
  // 全屏震屏:同一个 FX 镜头冲击同时驱动世界层、背景层与 HUD,
  // 三层一起晃才是“全屏”震屏(之前只有 world 层在动)。
  impactPunch = Math.max(0, impactPunch - realDt * 2.6);
  const amp = 7 * (1 + impactPunch * 2.2);
  const ox = impulse.offsetX * amp, oy = impulse.offsetY * amp;
  if (bgSprite) bgSprite.position.set(vw / 2 + ox * 0.55, vh / 2 + oy * 0.55);
  if (hud) {
    hud.style.setProperty("--sx", `${(ox * 0.45).toFixed(2)}px`);
    hud.style.setProperty("--sy", `${(oy * 0.45).toFixed(2)}px`);
  }
  // 连击冲击:每段合成给镜头一个短促的推近回弹,把节拍“敲”出来
  const pop = chainPop > 0 ? chainPop / 0.14 : 0;
  const bs = boardScale * (1 + 0.018 * pop);
  board.scale.set(bs);
  board.position.set(
    baseX + (W * (boardScale - bs)) / 2 + ox,
    baseY + (H * (boardScale - bs)) / 2 + oy,
  );
}

function syncFruits(dt        ) {
  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    if (f.dead) continue;
    const p = f.body.translation();
    f.x = p.x; f.y = p.y;
    f.sprite.position.set(p.x, p.y);
    f.sprite.rotation = f.body.rotation();
    f.age += dt;
    if (f.y > H + 160 || f.x < -120 || f.x > W + 120) removeFruit(f);
  }
}

/* ---------- 场景 ---------- */
function buildScene() {
  // 重力 = 全罐统一值(所有水果同比例受力):3200 × 1.2 = 3840
  // 用户要求:整体加重 20%,让落点选择更能改变格局(实测堆尖比 3200 低约 18px)
  world = new RAPIER.World({ x: 0, y: 3840 });
  // 接触求解迭代:仿真实测 8 次→堆胀 63%,**16 次→46%**(比缩小时间步更有效,且不增加步数开销)
  try { world.integrationParameters.numSolverIterations = 16; } catch { /* 旧宿主忽略 */ }
  eventQueue = new RAPIER.EventQueue(true);
  buildWalls();

  bgSprite = new PIXI.Sprite(PIXI.Texture.from(A("assets/bg.webp")));
  bgSprite.anchor.set(0.5);
  app.stage.addChild(bgSprite);

  board = new PIXI.Container();
  app.stage.addChild(board);

  // 罐身按原图比例摆放(717x709 会把罐子压扁);内容顶对齐到 y=208,内底即 JAR_FLOOR=714
  // 罐身按原图比例摆放(非等比缩放会把罐子压扁);内容顶对齐 JAR_TOP_Y,内底即 JAR_FLOOR
  const jar = new PIXI.Sprite(PIXI.Texture.from(A("assets/jar.webp")));
  // 罐身按原图比例摆放(非等比缩放会把罐子压扁);内容顶对齐 JAR_TOP_Y,内底即 JAR_FLOOR
  jar.anchor.set(0.5, 0);
  jar.scale.set(JAR_SCALE);
  jar.position.set(CX, JAR_TOP_Y - 106 * JAR_SCALE);
  board.addChild(jar);

  fruitLayer = new PIXI.Container(); board.addChild(fruitLayer);
  fxWorld = new PIXI.Container(); board.addChild(fxWorld);
  aimLayer = new PIXI.Container(); aimLayer.visible = false; board.addChild(aimLayer);
  aimGfx = new PIXI.Graphics(); aimLayer.addChild(aimGfx);
  aimSprite = new PIXI.Sprite(fruitTex[0]); aimLayer.addChild(aimSprite);
  warnGfx = new PIXI.Graphics(); board.addChild(warnGfx);
  warnText = new PIXI.Text({
    text: "",
    style: { fontFamily: FONT_STACK, fontSize: 30, fill: "#ff4d5e", stroke: { color: "#0b222c", width: 5 } },
  });
  warnText.anchor.set(0.5);
  warnText.position.set(CX, warnY() - 36);
  warnText.visible = false;
  board.addChild(warnText);
  floatLayer = new PIXI.Container(); board.addChild(floatLayer);

  fxScreen = new PIXI.Container();
  app.stage.addChild(fxScreen);

  layout(app.screen.width, app.screen.height);
}

function wireInput() {
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  const toBoard = (e                            ) => ({
    x: (e.global.x - baseX) / boardScale,
    y: (e.global.y - baseY) / boardScale,
  });
  // 只有在画布上按下开始的瞄准手势,松手才落果——否则点静音/摇一摇等 DOM 按钮也会顺带丢果
  let aiming = false;
  app.stage.on("pointermove", (e) => {
    if (phase !== "play" || buying) return;
    aimX = clampAim(toBoard(e).x);
    if (aimLayer.visible) aimSprite.x = aimX;
  });
  app.stage.on("pointerdown", (e) => {
    if (phase !== "play" || buying) return;
    aiming = true;
    aimX = clampAim(toBoard(e).x);
    if (aimLayer.visible) aimSprite.x = aimX;
  });
  const release = () => {
    if (!aiming) return;
    aiming = false;
    if (phase === "play" && !buying) dropCurrent();
  };
  app.stage.on("pointerup", release);
  app.stage.on("pointerupoutside", release);
  // 指针在画布外释放时的兜底:否则水果会一直挂在罐口不落
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);
  detachInput = () => {
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
    window.removeEventListener("blur", release);
  };
}

/* ---------- 启动 ---------- */
/**
 * 启动。独立网页与插件**调的是同一个函数**，差别全部通过 `opts` 注入 ——
 * 所以这里没有任何 `if (isPlugin)` 分支（那种分支会随版本漂移，而且永远只有一种被跑到）。
 *
 * @param {{ container?: HTMLElement, store?: ReturnType<typeof makeStore> }} [opts]
 * @returns {Promise<() => void>} 卸载函数
 */
export async function start(opts = {}) {
  const container = opts.container ?? document.getElementById("app") ;
  const store = opts.store ?? makeLocalStore();
  // ★ 必须在任何读存档之前 await 完，否则读到的永远是空 Map（症状：进度从没被恢复，且不报错）
  await store.preload();
  installGp(store);

  // 插件形态才有的两件事，独立网页（index.html）两个都不传
  ASSET = opts.assetBase ?? "";
  chargeRun = typeof opts.chargePlay === "function" ? opts.chargePlay : null;

  setLang(pickLang(navigator.language));
  setupFont();
  injectCss();
  buildDom(container);
  const fill = document.getElementById("load-fill") ;
  const host = container;

  app = new PIXI.Application();
  try {
    await app.init({ resizeTo: host, autoDensity: true, antialias: true, backgroundAlpha: 0 });
  } catch (err) {
    console.error("pixi init failed", err);
  }
  host.appendChild(app.canvas);
  /**
   * ★ 布局的唯一依据是**宿主容器**，不是 `window`。
   *
   * `mountDisplay` 的 `onResize` 报的是 window 尺寸（那套运行时本来是给独立网页写的），
   * 而插件里容器比 window 矮（顶栏底栏被宿主拿走了）。照 window 排版 ⇒
   * 逻辑高度算大、整层 UI 往下溢出到容器外：**看得见、点不到、一个错都不报**。
   * 另加 ResizeObserver —— 切 tab / 平板换布局**不会**触发 window resize。
   */
  const box = () => {
    const r = host.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };
  const relayout = () => {
    const b = box();
    // ★ 样式里所有尺寸都读这两个变量（`min(calc(var(--cw)*.94), …)`）：
    //   宿主里容器 ≠ 视口，用 vw/vh 算出来的面板会比容器还高。
    if (rootEl) {
      rootEl.style.setProperty("--cw", b.w + "px");
      rootEl.style.setProperty("--ch", b.h + "px");
    }
    layout(b.w, b.h);
  };
  /*
   * 屏幕适配器。它干两件我们干不了的事：按 dpr 算 renderer 的 resolution、
   * 在尺寸变化时 `renderer.resize()`（★ **renderer 的实际尺寸是它定的**，`layout()` 只算缩放）。
   *
   * ★ `host` 必须显式给容器：默认它量 `document.body`，而宿主里 body ≠ 容器
   *   （上面还有顶栏、下面还有底栏），renderer 会比容器高出一截。
   * ★ `orientation` 给 `'both'`：它声明的 `'portrait'` 会在横屏时往 **document.body**
   *   塞一个 `inset:0` 的「请旋转屏幕」遮罩（z-index 两亿多），
   *   在宿主里那就是**盖住整个 App**，连底栏都点不到 —— 孩子只能硬转回来。
   *   本作是容器自适应的，横屏只是留白多，没必要拦。
   */
  const display = mountDisplay({ orientation: "both", host, onResize: () => relayout() });
  display.attachPixi(app);
  relayout();
  const ro = new ResizeObserver(() => relayout());
  ro.observe(host);
  window.addEventListener("resize", relayout, { passive: true });
  window.addEventListener("orientationchange", relayout, { passive: true });
  window.__gpReady = true;

  const urls = [A("assets/bg.webp"), A("assets/jar.webp")];
  for (let i = 1; i <= 11; i++) urls.push(fruitUrl(i));
  const rapierReady = RAPIER.init();
  await PIXI.Assets.load(urls, (p) => { fill.style.width = `${Math.round(p * 85)}%`; });
  await rapierReady;
  fill.style.width = "92%";
  sound = (await loadSoundSystem({ manifestUrl: A("sound.manifest.json") }))                    ;
  // 若玩家在素材就绪前已经点过屏幕,这里补上解锁(BGM 与音效从这里开始)
  if (gestureSeen) { unlocked = false; unlockAudio(); }
  fill.style.width = "100%";

  for (let i = 1; i <= 11; i++) fruitTex.push(PIXI.Texture.from(fruitUrl(i)));

  buildScene();
  sceneReady = true;
  fx = await createPixiFx({
    PIXI, app,
    world: fxWorld,
    screen: fxScreen,
    referenceSpan: 96,
    onImpulse: (n) => { impulse = n; },
  });
  wireInput();
  app.ticker.add(frame);

  pendingSave = parseSave(gp.player.saves.latestSync);
  if (pendingSave) freshBtn.hidden = false;
  refreshTexts();
  void loadBest();
  void loadMeta();

  // 登录玩家可能晚一步才握手完成:locale 就绪后跟随平台语言,并重读一次自动存档
  gp.player.ready.then(({ user }) => {
    if (user?.locale) {
      const k = pickLang(user.locale);
      if (k !== currentLang()) applyLang(k);
    }
    if (!pendingSave) {
      const late = parseSave(gp.player.saves.latestSync);
      if (late) { pendingSave = late; freshBtn.hidden = false; refreshTexts(); }
    }
  }).catch(() => {});

  // ★ 这个监听是 `{once:true}`，卸载时**摘不掉也不需要摘**，但回调里的 `fx` 可能已经被
  //   卸载 dispose 过了 ⇒ 必须空安全 + try，否则「切走之后再切后台」会冒一个 pageerror。
  window.addEventListener("pagehide", () => {
    try { if (sound) void sound.dispose(); } catch { /* ignore */ }
    try { fx?.dispose?.(); } catch { /* ignore */ }
  }, { once: true });

  document.getElementById("loading")?.remove();
  titleEl.hidden = false;
  window.__gpPlayable = true;

  /**
   * 卸载。宿主切走游戏时会调它。
   *
   * ★ 必须把 Pixi 应用、特效层、音频、DOM 都拆干净，否则第二次挂载会
   *   「空白」或「看着正常但没声音」，而且**一个错都不报**。
   * ★ 调试钩子（`__gpPlayable`）要摘掉：留着会让下一次挂载立刻判「就绪」，假通过。
   */
  return () => {
    try { ro.disconnect(); } catch { /* ignore */ }
    try { window.removeEventListener("resize", relayout); } catch { /* ignore */ }
    try { window.removeEventListener("orientationchange", relayout); } catch { /* ignore */ }
    // ★★ display 适配器自己挂了 resize / orientationchange / visualViewport 三个 window 监听
    //   和一个 ResizeObserver，还会往 document.body 塞旋转遮罩。不 dispose 的话它们活着，
    //   下一次窗口尺寸变化就回调 `relayout()` → `layout()` → `app.stage` ⇒ 一片
    //   `reading 'stage'`，而 `app` 这时候已经是 null 了。
    try { display?.dispose(); } catch { /* ignore */ }
    try { detachInput?.(); } catch { /* ignore */ }
    try { app?.destroy({ children: true, texture: false, baseTexture: false }); } catch { /* ignore */ }
    try { fx?.dispose(); } catch { /* ignore */ }
    try { if (sound) void sound.dispose(); } catch { /* ignore */ }
    try { document.getElementById("mj-style")?.remove(); } catch { /* ignore */ }
    try { if (container) container.replaceChildren(); } catch { /* ignore */ }
    try {
      // 两个都要摘：`__gpReady` 留着会让「挂载测试」在还没加载完时就判就绪，
      // `__gpPlayable` 留着会让第二次挂载立刻「可玩」⇒ 假通过。
      delete window.__gpPlayable;
      delete window.__gpReady;
    } catch { /* ignore */ }
    app = null; sound = null;
    detachInput = null;
    // 下一份挂载会重新注入；留着会让「第二次挂载」用上一次的资源根和收费函数
    chargeRun = null;
    ASSET = "";
  };
}










