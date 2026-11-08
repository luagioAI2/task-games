// Screen-space DOM UI: HUD, bottom rail, sheets, toasts, coach marks. Reads Farm state, emits named actions.
                                               
                                           
import { WUTONG_COST, WUTONG_LEVEL, WUTONG_STAGE_MIN, wutongStage } from "./farm.js";
import { CROPS, ANIMALS, cropById, animalById, ITEM_TEX, ITEM_PRICE, MS_PER_FARM_MIN, PER_YIELD, capCrop, capAnimal, SELLABLE } from "./data/catalog.js";
import { FIELD_TOP, POND_TOP } from "./world.js";
import { t, nm, itemName, unitOf, qty, logText, fmtDur, getLang, LANGS,           } from "./i18n.js";

            
                                                                                                                
                                                                                     
                                                                                                        
                                                                                    
  

// v57 方向：结构和层次学 iOS（扁平色块 + 柔和大半径分层投影 + 毛玻璃通透 + 圆角留白 + 通栏/底部 sheet + 可收起），
// 外观是可爱的农场游戏：奶油/木色/嫩绿/暖黄/天空蓝，圆体字（Open Huninn：拉丁/数字全语言，日文全字；简中按字回落系统圆体），插画游戏图标，胶囊按钮。
const C = {
  background: "#FFF6E6", surface: "#FFFCF5", border: "#F0E2C8", sep: "rgba(138,90,43,.16)", text: "#4A3220", muted: "#8A6B50", gray: "#A58C74",
  accent: "#FFC23D", accentSoft: "#FFF0C7", harvest: "#4FA83A", harvestDark: "#3B8A2A", harvestSoft: "#E3F4D6", info: "#3FA4E8",
  grape: "#4FA83A", danger: "#EE6B4D", success: "#5DBB46", wood: "#B9844E", scrim: "#3A2614", disabled: "#EFE4D2", fill: "rgba(185,132,78,.12)",
};
const R = 14, RL = 22;
const FONT = '"FarmLatin","PingFang SC","Hiragino Maru Gothic ProN","Yuanti SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans CJK JP",system-ui,sans-serif';
const FONT_JA = '"FarmLatin","FarmJa","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans CJK JP",system-ui,sans-serif';
const SH1 = "0 2px 6px rgba(90,56,20,.10)";            // 一层：小元件
const SH2 = "0 4px 16px rgba(90,56,20,.14)";           // 二层：栏/卡片
const SH3 = "0 12px 36px rgba(90,56,20,.22)";          // 三层：弹窗
const GLASS = "rgba(255,248,232,.52)";                  // 通透奶油玻璃
const GLASS_SOLID = "rgba(255,248,232,.88)";            // 不支持模糊时兜底
const BLUR = "saturate(170%) blur(20px)";
const TXT_SH = "0 1px 0 rgba(255,255,255,.7)";
// 圆体：Open Huninn（OFL，平台字体库）。拉丁/数字所有语言都用；日文全字形覆盖；简中缺约 1/4 常用字，故中文正文走系统圆体/苹方，避免一句话里混两种字形。
//
// ★ 移植改动：原版走 `gp.fonts.url()`（MakePlay 的字体 CDN）。这里改成可注入的
//   `globalThis.__cfFontBase`。
//
// ⚠️ 现状（2026-10-24）：**字体还没随包发布** —— `assets/` 下没有 fonts 目录，
//   `plugin.js` 也不再设 `__cfFontBase`（它是在 `mount()` 里设的，而这段是模块
//   求值期的 IIFE，设了也晚一步）。所以实际生效的一直是下面的 CDN，
//   拿不到就用系统圆体。别看着这段代码就以为本地字体在起作用。
//   将来随包发字体：build 脚本拷进 `assets/fonts/` + 把这段改成 `installUi()`
//   里惰性注册、URL 用 `asset("fonts/…")`（已走 `__cfAsset`）。
(() => {
  try {
    const base = (globalThis       ).__cfFontBase;
    const url = (base ? base + "OpenHuninn.woff2" : null) ?? "https://static.makeplay.ai/fonts/v1/open-huninn/OpenHuninn.woff2";
    if (typeof FontFace === "undefined") return;
    const a = new FontFace("FarmLatin", `url("${url}")`, { unicodeRange: "U+0020-024F,U+2000-206F,U+2190-21FF,U+00D7", display: "swap" }       );
    const b = new FontFace("FarmJa", `url("${url}")`, { display: "swap" }       );
    document.fonts.add(a); document.fonts.add(b); void a.load().catch(() => {});
  } catch { /* 无 FontFace：系统字体 */ }
})();
const ico = (k        , sz = 24) => `<img class="ic" src="${asset(`ui/${k}.webp`)}" width="${sz}" height="${sz}" alt="">`;

/**
 * 资源地址。
 *
 * UI 里到处是 `<img src="assets/...">`，相对**文档**解析。插件跑在
 * `blob:` 模块里，相对路径会以 blob: 为基准 ⇒ 全 404（图标全成空框）。
 * 所以一律走这个函数：独立网页返回 "assets/" + rel，插件走宿主的 `assetUrl`。
 */
const asset = (rel) => (globalThis       ).__cfAsset ? (globalThis       ).__cfAsset(rel) : "assets/" + rel;

/**
 * 给没带 `#ui` 前缀的选择器补上作用域（只在插件形态调用）。
 *
 * ## 为什么必须做
 *
 * 这份 CSS 有 100+ 个裸选择器：`.row` `.grid` `.item` `.info` `.badge`
 * `.modal` `.btn` `.log` `.tags` `.tip` `.empty` `.cell` `.thumb` …
 * 独立网页里它们没人抢，**但宿主的 UI 是 Tailwind**，`.grid` / `.item`
 * 这类名字必然撞车 —— 直接插进 `document.head` 就是一次静默的全局污染
 * （宿主的格子布局突然变成游戏的样子，而且没人会联想到插件）。
 *
 * ## 规则
 *
 * - 已经以 `#ui` 开头的选择器：原样保留。
 * - `html[lang=ja] #ui …`：保留（它自带作用域）。
 * - `@keyframes` / `@media` / `@font-face`：**不前缀**（keyframes 名是全局的，
 *   加了反而失效）；只对 `@media` / `@supports` 内部再递归一层。
 * - 其余每个逗号分隔的选择器补 `#ui `。
 *
 * ⚠️ 这个函数是纯字符串处理，**不做 CSS 解析**。它依赖这份 CSS 的书写风格
 *   （一行一条规则、逗号分隔、没有嵌套）。将来若有人把 CSS 改成 SCSS 风格，
 *   这里会静默失效 —— `scripts/check-css-scope.mjs` 会拦。
 */
function scopeCss(css) {
  const out = []
  let i = 0
  const n = css.length
  while (i < n) {
    // 跳过空白
    while (i < n && /\s/.test(css[i])) i++
    // ★ 注释要**先原样吐出去**，不能让它参与「这条规则的选择器」的判断。
    //   踩过（2026-10-24）：注释紧挨在 `@media` 前面时，`head` 变成
    //   `/* … */\n@media (max-width:380px)`，不以 `@` 开头 ⇒ 被当成普通规则 ⇒
    //   拼出 `#ui /* … */ @media (…)` ⇒ 浏览器把**整块媒体查询丢掉**。
    //   症状是「窄屏适配就是不生效」，控制台一句错都没有 —— 只能靠
    //   「媒体查询里的规则到底在不在 CSSOM 里」这种探针才看得见。
    while (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      if (end < 0) { out.push(css.slice(i)); i = n; break }
      out.push(css.slice(i, end + 2))
      i = end + 2
      while (i < n && /\s/.test(css[i])) i++
    }
    if (i >= n) break
    // 找到这条规则的 `{`（同层，忽略字符串/注释里的大括号——这份 CSS 没有，
    // 但保持简单：先找第一个 `{`）
    const brace = css.indexOf('{', i)
    if (brace < 0) { out.push(css.slice(i)); break }
    const head = css.slice(i, brace)
    if (head.trim().startsWith('@')) {
      // at-rule：取配对的块
      let depth = 0
      let j = brace
      for (; j < n; j++) {
        if (css[j] === '{') depth++
        else if (css[j] === '}') { depth--; if (depth === 0) { j++; break } }
      }
      out.push(scopeAtRule(css.slice(i, j)))
      i = j
      continue
    }
    // 普通规则：取配对的块（CSS 规则不能嵌套，但 @media 内部会递归到这里）
    let depth = 0
    let j = brace
    for (; j < n; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') { depth--; if (depth === 0) { j++; break } }
    }
    out.push(scopeRule(css.slice(i, j)))
    i = j
  }
  return out.join('\n')
}

function scopeAtRule(block) {
  const brace = block.indexOf('{')
  if (brace < 0) return block
  const head = block.slice(0, brace + 1)
  const body = block.slice(brace + 1, block.lastIndexOf('}'))
  const tail = block.slice(block.lastIndexOf('}'))
  // keyframes / font-face 里的「选择器」是 0% / from / to 或字体描述符，不能加前缀
  if (/@(keyframes|-webkit-keyframes|font-face)/.test(head)) return block
  // @media / @supports / @layer：内部继续按规则处理
  return head + '\n' + scopeCss(body) + '\n' + tail
}

function scopeRule(rule) {
  const brace = rule.indexOf('{')
  if (brace < 0) return rule
  const selPart = rule.slice(0, brace)
  const body = rule.slice(brace)
  const sels = selPart.split(',')
  const mapped = sels.map((raw) => {
    const s = raw.trim()
    if (!s) return s
    if (s.startsWith('#ui')) return s
    if (s.startsWith('html')) return s          // html[lang=ja] #ui … 自带作用域
    if (s.startsWith(':root')) return '#ui'
    return '#ui ' + s
  })
  return mapped.join(',') + body
}

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:${FONT};color:${C.text};z-index:10;-webkit-user-select:none;user-select:none;-webkit-font-smoothing:antialiased}
html[lang=ja] #ui{font-family:${FONT_JA}}
#ui *{box-sizing:border-box}
#ui [hidden]{display:none!important}
#ui .col{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);pointer-events:none}
/* ---- 宽屏两侧舞台（平板横屏）----
   ★ 原来两侧画的是「同一个世界放大 + blur(10) + alpha .75」。在 iPad 上量下来
     缩放比 sb = max(vw/750, vh/WORLD_H) ≈ 1.37，等于把 750 宽的世界拉满 1024 再糊
     20px —— 糊成一片荧光绿，用户的原话是「中间有内容，两侧[很怪]」。
   现在改成奶油底 + 上下两团暖光，边缘一道内阴影把游戏列「框」出来。
   好处有两个：① 看起来是有意为之的舞台，不是渲染坏了；② PIXI 那层全屏
   BlurFilter 可以关掉（view.layout 的 showBackdrop=false），平板省一大笔 GPU。 */
#ui .gut{position:absolute;top:0;bottom:0;display:none;pointer-events:none;overflow:hidden;background:radial-gradient(120% 46% at 50% 0%,rgba(255,224,150,.34),rgba(255,246,230,0) 64%),radial-gradient(90% 40% at 50% 100%,rgba(198,232,170,.26),rgba(255,246,230,0) 62%),linear-gradient(180deg,#FFF6E8,#FFFAF2 46%,#F7FAF0)}
#ui.wide .gut{display:block}
#ui .gut.l{left:0}
#ui .gut.r{right:0}
#ui .gut.l::after,#ui .gut.r::after{content:"";position:absolute;top:0;bottom:0;width:22px}
#ui .gut.l::after{right:0;background:linear-gradient(90deg,rgba(90,56,20,0),rgba(90,56,20,.11))}
#ui .gut.r::after{left:0;background:linear-gradient(270deg,rgba(90,56,20,0),rgba(90,56,20,.11))}
#ui button{font-family:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s cubic-bezier(.3,1.6,.5,1),background-color .15s,box-shadow .15s}
#ui button:active{transform:scale(.92)}
#ui button:disabled{cursor:default}
.ic{display:block;flex:none;object-fit:contain}
.glass{background:${GLASS_SOLID}}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.glass{background:${GLASS};-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR}}}
/* ---- 顶部通栏（一行）+ 浮动分区胶囊 ---- */
.hud{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;align-items:stretch;gap:6px;pointer-events:none;transition:transform .32s cubic-bezier(.2,.9,.3,1),opacity .25s}
.topbar{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:calc(2px + env(safe-area-inset-top)) 8px 2px 8px;height:calc(46px + env(safe-area-inset-top));border-radius:0 0 ${RL}px ${RL}px;box-shadow:${SH2};border-bottom:1px solid rgba(255,255,255,.45)}
.row{display:flex;align-items:center;gap:6px}
.lv{flex:none;position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:42px;border-radius:14px;background:linear-gradient(180deg,#7CCB5C,${C.harvest});color:#fff;box-shadow:${SH1};overflow:hidden}
.lv .lvt{font-weight:800;font-size:15px;letter-spacing:-.02em;text-shadow:0 1px 0 rgba(0,0,0,.18);position:relative;z-index:1}
.lv .bar{position:absolute;left:5px;right:5px;bottom:5px;height:4px;background:rgba(255,255,255,.35);border-radius:2px;overflow:hidden}
.lv .bar i{display:block;height:100%;background:#FFE58A;border-radius:2px}
.lv .exp{display:none}
.stat{display:flex;align-items:center;gap:3px;height:36px;padding:0 10px 0 4px;border-radius:999px;background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 1px rgba(185,132,78,.18);font-weight:800;font-size:15px;white-space:nowrap;flex:none;font-variant-numeric:tabular-nums;color:${C.text}}
.stat img{width:24px;height:24px;object-fit:contain}
.stat.coin{padding-right:2px}
.stat.harv{color:${C.harvestDark}}
.stat.bump{animation:bump .35s}
@keyframes bump{40%{transform:scale(1.12)}}
#ui .plus{pointer-events:auto;position:relative;width:30px;height:30px;border:none;border-radius:50%;background:linear-gradient(180deg,#FFD563,${C.accent});color:${C.text};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;line-height:1;margin-left:2px;box-shadow:0 2px 0 #E0A22A}
#ui .plus::after,#ui .hit::after{content:"";position:absolute;inset:-9px}
.vsep{display:none}
.spacer{flex:1;min-width:0}
#ui .iconbtn{position:relative;width:40px;height:40px;border:none;border-radius:13px;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(185,132,78,.16);display:flex;align-items:center;justify-content:center;flex:none;padding:0}
#ui .iconbtn::after{content:"";position:absolute;inset:-4px}
#ui .iconbtn .ic{width:28px;height:28px}
.dot{position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:${C.danger};box-shadow:0 0 0 2px #fff}
.seg{pointer-events:auto;display:flex;gap:2px;padding:3px;border-radius:999px;box-shadow:${SH1};flex:none}
#ui .seg button{position:relative;min-width:52px;height:30px;padding:0 12px;border:none;border-radius:999px;background:transparent;font-size:13px;font-weight:800;color:${C.muted};display:flex;align-items:center;justify-content:center;white-space:nowrap;text-shadow:${TXT_SH}}
#ui .seg button::after{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}
#ui .seg button.on{background:linear-gradient(180deg,#7CCB5C,${C.harvest});color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.15);box-shadow:0 2px 0 ${C.harvestDark}}
#ui .fold{pointer-events:auto;position:relative;width:36px;height:30px;border:none;border-radius:999px;box-shadow:${SH1};display:flex;align-items:center;justify-content:center;color:${C.wood};flex:none;padding:0}
#ui .fold::after{content:"";position:absolute;inset:-9px -6px}
#ui .fold svg{width:18px;height:18px}
/* ---- 底部标签栏 ---- */
.rail{position:absolute;left:8px;right:8px;bottom:calc(6px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:2px;pointer-events:auto;border-radius:${RL}px;box-shadow:${SH2};border:1px solid rgba(255,255,255,.45);transition:transform .32s cubic-bezier(.2,.9,.3,1),opacity .25s}
#ui .rbtn{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;min-height:44px;border:none;border-radius:16px;background:transparent;font-weight:800;font-size:11px;padding:2px 0;color:${C.text};text-shadow:${TXT_SH}}
#ui .rbtn .ic{width:26px;height:26px}
#ui .rbtn::after{content:"";position:absolute;left:0;right:0;top:-3px;bottom:-3px}
#ui .rbtn.on{background:rgba(255,255,255,.7);box-shadow:${SH1};color:${C.harvestDark}}
.rbtn span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px;line-height:1.1}
.badge{position:absolute;top:1px;left:calc(50% + 6px);min-width:18px;height:18px;border-radius:9px;background:${C.danger};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 0 0 2px #fff}
/* ---- 宽屏：底栏改成左侧竖排 ----
   ★ 横屏平板上，这条底栏正好压在宿主底栏的上方，两条栏叠着，还吃掉一整行画面。
     两侧本来就有空（iPad 4:3 横屏每侧 130~178px），搬过去正好。
     竖排时不再需要那层通栏玻璃底，玻璃挪到每个按钮自己身上。 */
#ui.wide .rail{left:12px;right:auto;top:0;bottom:0;grid-template-columns:1fr;grid-auto-rows:min-content;align-content:center;gap:6px;padding:0;background:transparent;border:none;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
#ui.wide .rbtn{min-height:58px;padding:7px 0;background:rgba(255,252,245,.74);border:1px solid rgba(255,255,255,.72);box-shadow:${SH1};border-radius:18px}
#ui.wide .rbtn.on{background:#fff;box-shadow:${SH2}}
#ui.wide .rbtn .ic{width:28px;height:28px}
#ui.wide .rbtn span{font-size:11px}
/* ---- 收起状态 ---- */
#ui.bars-off .hud{transform:translateY(calc(-100% - 12px));opacity:0}
#ui.bars-off .rail{transform:translateY(calc(100% + 16px));opacity:0;pointer-events:none}
#ui.wide.bars-off .rail{transform:translateX(calc(-100% - 18px));opacity:0;pointer-events:none}
#ui .unfold{position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;display:flex;align-items:center;gap:4px;height:48px;padding:0 6px 0 10px;border:none;border-radius:999px;box-shadow:${SH2};pointer-events:auto;font-weight:800;font-size:14px;color:${C.text};font-variant-numeric:tabular-nums;opacity:0;transform:translateY(-8px) scale(.9);transition:opacity .25s,transform .3s cubic-bezier(.2,.9,.3,1);visibility:hidden}
#ui .unfold img{width:22px;height:22px}
#ui .unfold svg{width:18px;height:18px;color:${C.wood}}
#ui .unfold.solo{padding:0 9px}
#ui.bars-off .unfold{opacity:1;transform:none;visibility:visible}
/* ---- 播种提示条 ---- */
.guide{position:absolute;left:8px;right:8px;display:flex;align-items:center;gap:8px;padding:4px 4px 4px 12px;border-radius:999px;pointer-events:auto;font-weight:700;font-size:15px;box-shadow:${SH2};animation:bin .3s}
.guide img{width:32px;height:32px;object-fit:contain}
.guide .gt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ui .xbtn{width:48px;height:48px;flex:none;border:none;border-radius:50%;background:radial-gradient(circle,rgba(185,132,78,.16) 16px,transparent 16.5px);font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;color:${C.muted}}
@keyframes bin{0%{transform:translateY(12px);opacity:0}100%{transform:none;opacity:1}}
.scrim{position:absolute;inset:0;background:rgba(58,38,20,.22);pointer-events:auto;animation:fade .2s}
@keyframes fade{from{opacity:0}}
/* ---- 底部 sheet ---- */
.sheet{position:absolute;left:0;right:0;bottom:0;max-height:84%;display:flex;flex-direction:column;background:rgba(255,246,230,.86);-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};border:none;border-radius:${RL}px ${RL}px 0 0;pointer-events:auto;animation:up .28s cubic-bezier(.2,.9,.3,1);padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -6px 24px rgba(90,56,20,.18);border-top:1px solid rgba(255,255,255,.6)}
.sheet::before{content:"";display:block;width:40px;height:5px;border-radius:3px;background:rgba(138,90,43,.28);margin:7px auto 0}
@keyframes up{from{transform:translateY(100%)}}
.sh-h{display:flex;align-items:center;gap:8px;padding:2px 6px 6px 14px}
.sh-h > img{width:34px;height:34px;object-fit:contain}
.sh-h h2{margin:0;font-size:20px;font-weight:900;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-h .stat{height:34px}
.sh-b{overflow-y:auto;padding:4px 12px 16px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}
.group{background:${C.surface};border-radius:${RL - 4}px;overflow:hidden;display:flex;flex-direction:column;box-shadow:${SH1}}
.group > .item{border-radius:0;position:relative;box-shadow:none}
.group > .item + .item::before,.group > .set + .set::before{content:"";position:absolute;top:0;left:14px;right:14px;height:1px;background:${C.sep}}
.group > .item + .item::before{left:80px}
.dt{width:100%;border-collapse:collapse;font-size:13px;margin:4px 0 10px}
.dt th{font-size:12px;color:${C.muted};font-weight:700;text-align:left;padding:2px 4px;border-bottom:1px solid ${C.sep}}
.dt td{padding:4px;border-bottom:1px solid ${C.sep};vertical-align:middle;white-space:nowrap}
.dt img{width:22px;height:22px;object-fit:contain;vertical-align:middle}
.hlrow{grid-column:1/-1}
.sh-b.dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start;padding:12px}
.sh-b.dgrid .dsec{min-width:0}
.sh-b.dgrid .dsec.open{grid-column:1/-1}
.tabs{display:flex;gap:3px;margin:2px 12px 0;padding:3px;background:rgba(185,132,78,.14);border-radius:999px}
#ui .tab{flex:1;min-height:44px;border-radius:999px;border:none;background:transparent;font-weight:800;font-size:15px;color:${C.muted}}
#ui .tab.on{background:#fff;color:${C.harvestDark};box-shadow:${SH1}}
.item{display:flex;align-items:center;gap:12px;padding:12px 14px;background:${C.surface};border:none;border-radius:${R}px;box-shadow:${SH1}}
.item.off{opacity:.5}
.thumb{width:54px;height:54px;flex:none;object-fit:contain;background:${C.accentSoft};border-radius:16px;padding:4px}
.info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.info b{font-size:17px;font-weight:800}
.info .s{font-size:13px;color:${C.muted};line-height:1.35}
.info .ward{font-size:13px;color:${C.harvestDark};font-weight:700;line-height:1.35}
.tags{display:flex;gap:4px;flex-wrap:wrap}
.tg{font-size:12px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
.tg.c{background:${C.accentSoft};color:#8A5A00}
.tg.h{background:${C.harvestSoft};color:#2F6E22}
.tg.d{background:#FDE3DA;color:#B4391E}
.tg.g{background:#E2F1FB;color:#1F6FA3}
/* 按钮：胶囊、轻立体底边（扁平色块 + 2px 同色深边）、按下缩放 */
#ui .btn{min-height:48px;min-width:64px;padding:4px 18px;border-radius:999px;border:none;font-weight:800;font-size:15px;line-height:1.15;flex:none}
#ui .btn.g,#ui .btn.p{background:linear-gradient(180deg,#6CC24F,${C.harvest});color:#fff;box-shadow:0 3px 0 ${C.harvestDark};text-shadow:0 1px 0 rgba(0,0,0,.15)}
#ui .btn.y{background:linear-gradient(180deg,#FFD563,${C.accent});color:${C.text};box-shadow:0 3px 0 #DE9B22}
#ui .btn.b{background:linear-gradient(180deg,#67BDF2,${C.info});color:#fff;box-shadow:0 3px 0 #2A82C2;text-shadow:0 1px 0 rgba(0,0,0,.15)}
#ui .btn.r{background:linear-gradient(180deg,#F58A6D,${C.danger});color:#fff;box-shadow:0 3px 0 #C84E33}
#ui .btn.w{background:#fff;color:${C.harvestDark};box-shadow:0 2px 0 rgba(185,132,78,.28),inset 0 0 0 1.5px rgba(185,132,78,.22)}
#ui .btn.t{background:transparent;color:${C.harvestDark};padding:4px 8px}
#ui .btn:disabled{background:${C.disabled};color:#A8957F;box-shadow:none;text-shadow:none}
#ui .btn:active{box-shadow:none;transform:translateY(2px) scale(.96)}
.btn small{display:block;font-size:12px;font-weight:700;opacity:.9}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.prog{height:6px;background:${C.border};border-radius:3px;overflow:hidden;margin-top:2px}
.prog i{display:block;height:100%;background:${C.harvest};border-radius:3px}
.empty{text-align:center;padding:28px 8px;color:${C.muted};font-size:15px;font-weight:700}
.tip{font-size:13px;color:${C.muted};padding:0 6px;line-height:1.45}
.idx{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;padding:12px 14px;background:${C.surface};border-radius:${RL - 4}px;box-shadow:${SH1}}
.up{color:${C.harvest}} .down{color:${C.danger}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
#ui .cell{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;background:${C.surface};border:none;border-radius:18px;font-size:13px;font-weight:800;text-align:center;min-height:48px;box-shadow:${SH1}}
.cell img{width:46px;height:46px;object-fit:contain}
.cell .n{font-size:15px;font-weight:900;color:${C.wood}}
.quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.inrow{display:flex;gap:8px;align-items:center}
.inrow input{flex:1;min-width:0;height:48px;border-radius:999px;border:none;background:#fff;font-size:17px;font-weight:700;padding:0 16px;color:${C.text};font-family:inherit;outline:none;box-shadow:inset 0 0 0 1.5px rgba(185,132,78,.25)}
.inrow input:focus{box-shadow:inset 0 0 0 2px ${C.harvest}}
.big2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#ui .big2 .btn{min-height:72px;font-size:16px;border-radius:20px}
.log{display:flex;gap:10px;font-size:15px;line-height:1.45;padding:10px 14px;background:${C.surface};position:relative}
.log + .log::before{content:"";position:absolute;top:0;left:14px;right:14px;height:1px;background:${C.sep}}
.log time{color:${C.gray};font-size:13px;flex:none;font-variant-numeric:tabular-nums;padding-top:1px;font-weight:700}
.set{display:flex;align-items:center;gap:12px;font-weight:700;font-size:16px;flex-wrap:wrap;background:${C.surface};padding:6px 14px;min-height:56px;position:relative}
.set label{min-width:72px;flex:none}
.set input[type=range]{flex:1;min-width:120px;height:44px;accent-color:${C.harvest}}
.set2{background:transparent;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px}
#ui .set2 .btn{width:100%}
#ui .sw{width:64px;height:48px;border:none;background:transparent;position:relative;flex:none;margin-left:auto}
.sw::before{content:"";position:absolute;right:0;top:8.5px;width:52px;height:31px;border-radius:16px;background:#E9DCC6;transition:background .2s}
.sw::after{content:"";position:absolute;right:23px;top:10.5px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(90,56,20,.25);transition:right .22s cubic-bezier(.3,1.5,.5,1)}
.sw[aria-checked=true]::before{background:${C.harvest}}
.sw[aria-checked=true]::after{right:2px}
.langs{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;padding:3px;background:rgba(185,132,78,.14);border-radius:999px}
#ui .lang{position:relative;min-height:48px;min-width:80px;padding:0 14px;border-radius:999px;border:none;background:transparent;font-weight:800;font-size:15px;color:${C.muted}}
#ui .lang[aria-pressed=true]{background:#fff;color:${C.harvestDark};box-shadow:${SH1}}
.toasts{position:absolute;left:12px;right:12px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.toast{max-width:100%;background:rgba(74,50,32,.82);-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};color:#FFF6E6;border:none;border-radius:999px;padding:10px 18px;font-weight:700;font-size:15px;animation:bin .25s;text-align:center;overflow-wrap:anywhere;box-shadow:${SH2}}
.cap{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,248,232,.84);-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};border:none;border-radius:${RL}px;padding:14px 22px;box-shadow:${SH3};pointer-events:none;animation:pop .32s cubic-bezier(.3,1.5,.5,1);max-width:92%;text-align:center}
.cap .m{display:flex;align-items:center;gap:8px;font-size:28px;font-weight:900}
.cap .m img{width:42px;height:42px;object-fit:contain}
.cap .e{font-size:14px;font-weight:700;color:${C.muted}}
.cap .hv{font-size:18px;font-weight:900;color:${C.harvestDark}}
@keyframes pop{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}100%{transform:translate(-50%,-50%) scale(1)}}
.modal{position:absolute;left:24px;right:24px;top:50%;transform:translateY(-50%);background:rgba(255,248,232,.9);-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};border:1px solid rgba(255,255,255,.6);border-radius:26px;padding:20px 16px 18px;display:flex;flex-direction:column;align-items:center;gap:12px;pointer-events:auto;box-shadow:${SH3};animation:fade .2s;text-align:center;max-width:420px;margin:0 auto}
.modal h1{margin:0;font-size:28px;font-weight:900;color:${C.harvestDark}}
.modal h3{margin:0;font-size:22px;font-weight:900}
.modal p{margin:0;font-size:15px;color:${C.muted};line-height:1.45;font-weight:600}
.modal .hero{width:112px;height:84px;object-fit:contain}
#ui .modal .btn{min-width:200px}
.fly{position:absolute;width:40px;height:40px;object-fit:contain;pointer-events:none;transition:transform .55s cubic-bezier(.5,-.3,.7,1),opacity .55s;z-index:5}
.ring{position:absolute;border:3px solid ${C.accent};border-radius:18px;box-shadow:0 0 0 5px rgba(255,194,61,.3);pointer-events:none;animation:ring 1.1s infinite}
@keyframes ring{50%{transform:scale(1.05)}}
.coach{position:absolute;left:12px;right:12px;background:rgba(255,248,232,.9);-webkit-backdrop-filter:${BLUR};backdrop-filter:${BLUR};border:1px solid rgba(255,255,255,.6);border-radius:${RL}px;padding:14px 16px 12px;display:flex;flex-direction:column;gap:10px;pointer-events:auto;box-shadow:${SH3};font-weight:700;font-size:15px;line-height:1.45;animation:bin .3s}
.coach .acts{justify-content:flex-end;margin:0}
@media (max-height:520px){#ui .rbtn span{display:none}.sh-b.dgrid{grid-template-columns:repeat(6,1fr);gap:4px;padding:8px}.sh-b.dgrid .dhdr{min-height:48px;font-size:12px;padding:3px 5px}}
@media (prefers-reduced-motion:reduce){#ui *{animation:none!important;transition:none!important}}

/* ===== v58 上边栏重做：一条悬浮圆角栏 + 居中分段胶囊；统一 48px 高、22px 图标、等宽数字、单层投影 ===== */
.hud{top:calc(8px + env(safe-area-inset-top));left:10px;right:10px;gap:8px;align-items:center}
/* ★ 2026-10-24：上栏**不再画通栏底**。
   里面只剩「等级徽章 + 两个图标钮」，通栏底会留出一大片空白
   （390 上量到 170px 的空档，平板上更宽）。改成两簇各自带底，
   中间直接是场景 —— 不再有"空着的一条"。 */
.topbar{align-self:stretch;height:48px;padding:0;gap:8px;border-radius:16px;box-shadow:none;border:none;position:relative;overflow:visible;background:none}
.ssep{width:1px;height:22px;background:rgba(138,90,43,.16);flex:none;margin:0 6px}
.topbar .lv{width:auto;height:48px;background:none;box-shadow:none;border-radius:0;color:${C.text};padding:0 6px;overflow:visible}
.topbar .lv .lvt{font-size:15px;font-weight:800;text-shadow:none;letter-spacing:0;color:${C.harvestDark}}
.sh-h .stat .vico{font-size:18px;line-height:1}
#ui .topbar .iconbtn{width:44px;height:44px;border-radius:14px;background:${GLASS_SOLID};box-shadow:0 3px 10px rgba(90,56,20,.16)}
#ui .topbar .iconbtn .ic{width:22px;height:22px}
#ui .topbar .iconbtn::after{inset:-2px}
.topbar .dot{top:5px;right:5px;width:9px;height:9px;box-shadow:0 0 0 1.5px #FFF8E8}
/* 方案 A：等级做成带进度外圈的小圆徽章（进度 = 外圈那道 conic 环） */
.tv-a .topbar .lv{width:40px;height:40px;padding:0;margin:0;border-radius:50%;background:conic-gradient(${C.harvest} var(--p,0%),rgba(79,168,58,.18) 0);box-shadow:0 3px 10px rgba(90,56,20,.16);display:flex;align-items:center;justify-content:center}
.tv-a .topbar .lv::before{content:"";position:absolute;inset:4px;border-radius:50%;background:#FFF8E8}
.tv-a .topbar .lv .lvt{position:relative;font-size:12px}
/* 分段胶囊（天气 + 分区 + 收起）**住在顶栏里**，替掉那条 spacer。
   横向账：badge 40 + 8 + 胶囊 + 8 + 44 + 8 + 44 = 152 + 胶囊，
   390 上胶囊最多 218，所以内部按 212 收：
   6(padding) + 28(天气) + 5(分隔) + 3×44 + 5 + 30(收起) = 212。 */
/* 胶囊**占满中间那段**（flex:1），不再按内容宽度靠左/居中摆。
   ⚠️ 这段注释在 CSS 的**模板字符串里**，不能写反引号 —— 会把字符串提前闭合，
      报的错是「Expected a semicolon … at 这一行」，看着像别处的语法错。
   为什么要占满：左边一簇 40、右边一簇 96，只按内容居中会**偏左 28px**
   （390 上实测胶囊中心 167、屏幕中心 195）—— 看上去就是「没在正中」。
   占满之后两条缝都是 8px，左右对称，分区自然落在中间。
   上限 260 是给平板的：不限的话 966 宽下会拉成一整条空胶囊。 */
.topbar .seg{flex:1 1 auto;min-width:0;max-width:260px;margin:0 auto;justify-content:center;height:36px;padding:3px;gap:0;align-items:center;border-radius:999px;box-shadow:0 4px 14px rgba(90,56,20,.14)}
.topbar .seg .ssep{height:16px;margin:0 2px}
#ui .topbar .seg button{height:30px;min-width:0;padding:0 9px;font-size:13px;color:${C.text};text-shadow:none}
#ui .topbar .seg button.on{background:${C.harvest};box-shadow:none;text-shadow:none}
.topbar .seg .wx{display:flex;align-items:center;justify-content:center;width:28px;height:30px;font-size:14px;flex:none}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#ui .topbar .seg .fold{width:30px;min-width:30px;height:30px;padding:0;border-radius:999px;box-shadow:none;background:none;color:${C.wood};flex:none}
#ui .topbar .seg .fold svg{width:16px;height:16px}
/* 窄屏放不下：先让掉天气图标（分区与收起是**控件**，不能让）。 */
@media (max-width:380px){
  .topbar .seg .wx,.topbar .seg .wx+.ssep{display:none}
  .tv-a .topbar .lv{width:36px;height:36px}
  .tv-a .topbar .lv .lvt{font-size:11px}
}
/* 320 这种更窄的屏：让掉分隔线、再压一点内边距（分区和收起都是控件，不能让）。
   320 的账：300 可用 - (36 badge + 8 + 8 + 44 + 8 + 44) = 152 给胶囊，
   胶囊内部 6 + 3×36 + 28 = 142 —— 按钮保住 36（26 字宽 + 10 内边距），一个字都不裁。 */
@media (max-width:340px){
  .topbar .seg .ssep{display:none}
  #ui .topbar .seg button{padding:0 5px}
  #ui .topbar .seg .fold{width:28px;min-width:28px}
}
`;
const CHEV_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const CHEV_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

const esc = (s                 ) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ));
const pad = (n        ) => String(n).padStart(2, "0");
const itemImg = (item        ) => asset(`items/i${pad(ITEM_TEX[item])}.webp`);
const cropImg = (id        ) => asset(`crops/m${pad(cropById(id).tex)}.webp`);
const fmtP = (p        ) => p < 10 ? p.toFixed(1) : String(Math.round(p));
const durMin = (min        ) => fmtDur(min * MS_PER_FARM_MIN);

/**
 * 卸载上一轮 `installUi` 装上去的所有东西。
 *
 * 插件形态必须能干净地拆：宿主的 tab 一切走，这些东西就得消失 ——
 * 包括那个 `<style>`（**留着它比留着 DOM 更糟**：宿主页面会一直被
 * 这份样式影响，而且看不出是谁干的）。
 */
let uiTeardown = null;
export function uninstallUi() {
  if (!uiTeardown) return;
  try { uiTeardown() } finally { uiTeardown = null }
}

export function installUi(api     ) {
  // ---- 挂载点：独立网页挂 body；插件形态挂宿主给的容器 ----
  //
  // 原版写死 `document.body` + `position:fixed`（整屏）。插件里那样会把
  // 宿主的顶栏/底栏一起盖住。所以 `api.mountTo` 给出容器时：
  //   ① root 改成 `position:absolute`，贴着容器铺满（容器自己是 relative）；
  //   ② CSS 里那 100+ 个**没有 `#ui` 前缀**的裸选择器（`.row` / `.grid` /
  //      `.item` / `.modal` / `.btn` …）会被加上 `#ui` 作用域前缀 ——
  //      不加的话它们会污染宿主（宿主是 Tailwind，`.grid` / `.item` 必撞）。
  const mountTo = api.mountTo || document.body;
  const scoped = mountTo !== document.body;
  const cssText = scoped ? scopeCss(CSS) : CSS;
  // `#ui{position:fixed}` 是给**整屏**用的。插件里容器才是坐标系：
  // fixed 会以视口为基准（跑出容器、压住宿主底栏），z-index:10 还会跟宿主抢层。
  // 所以插件形态下把这条改写成 absolute + z-index:1（容器内部自己的层级）。
  const finalCss = scoped
    ? cssText.replace(
        '#ui{position:fixed;inset:0;pointer-events:none;',
        '#ui{position:absolute;inset:0;pointer-events:none;z-index:1;'
      )
    : cssText;
  const style = document.createElement("style"); style.textContent = finalCss; document.head.appendChild(style);
  const root = document.createElement("div"); root.id = "ui";
  if (scoped) root.style.position = "absolute";
  /* 宽屏两侧的「舞台」（见 layout() 里 wide 的说明）。放在 col **之前** ⇒ 天然压在游戏列下面。 */
  const gutL = document.createElement("div"); gutL.className = "gut l";
  const gutR = document.createElement("div"); gutR.className = "gut r";
  const col = document.createElement("div"); col.className = "col";
  root.append(gutL, gutR, col); mountTo.appendChild(root);

  // 容器尺寸变化（旋转 / 宿主布局变动）都要重排。原版只监听 window resize。
  let ro = null;
  if (scoped && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => { try { api.ui.layout(); } catch { /* 还没就绪，忽略 */ } });
    ro.observe(mountTo);
  }

  /** 量可用宽高：独立网页用视口；插件用容器实际尺寸。 */
  const viewport = () => {
    if (!scoped) return { vw: window.innerWidth, vh: window.innerHeight };
    const r = mountTo.getBoundingClientRect();
    return { vw: r.width || window.innerWidth, vh: r.height || window.innerHeight };
  };
  /**
   * 世界列宽 —— 平板适配的唯一旋钮。
   *
   * ★ 世界是**固定 750 单位宽的竖条**（`WORLD_W`），所以列宽不是「越大越好」：
   *   列越宽 ⇒ scale = colW/750 越大 ⇒ **可见的世界高度 = vh/scale 越少**。
   *   1024 宽拉满只剩 562 单位，连一个田地分区（860 高）都装不下 ——
   *   那会变成「放大到只看见三块地」。
   *
   * 所以横屏的上限取「**一个分区刚好装得下**」：colW ≤ vh × 750/860 ≈ vh×0.87。
   * 4:3 的 iPad 横屏因此稳定落在 **65% 宽**（1024→668、1366→891），
   * 两侧留出来的是同一个世界的模糊放大版（`backdrop`，blur+alpha .75）。
   *
   * 竖屏沿用原来的 `vh×0.62`，只把硬上限从 600 提到 680 ——
   * 平板竖屏从 72% 提到 82%，而**手机一像素不变**：
   * 390×844 的 `vw` 永远小于任何上限，`min(vw, …)` 直接取 390。
   */
  const colWidth = () => {
    const { vw, vh } = viewport();
    const landscape = vw > vh * 1.05;
    // 竖屏上限 780 而不是 680：780 时 scale = 780/750 ≈ 1.04，画面基本是 1:1 渲染；
    // 再大就开始把小图放大（糊），再小就白留两溜边。
    // 实测 iPad Pro 竖屏（宿主 896×1220）从 680（76%）提到 756（84%），
    // 侧边留白从 108px 收到 70px —— 手机不受影响（vw=390 永远更小）。
    const cap = landscape ? 900 : 780;
    const bySection = vh * 0.87; // 一个分区（FIELD_H 860 / WORLD_W 750）装得下的最大列宽
    const byPortrait = vh * 0.62; // 竖屏：可见世界高度固定 ≈ 750/0.62 ≈ 1210 单位，跟屏幕多大无关
    return Math.min(vw, Math.max(360, Math.min(cap, landscape ? bySection : byPortrait)));
  };
  const railEl = document.createElement("div"); railEl.className = "rail glass";
  const hud = document.createElement("div"); hud.className = "hud";
  const toasts = document.createElement("div"); toasts.className = "toasts";
  const layer = document.createElement("div"); layer.style.cssText = "position:absolute;inset:0;pointer-events:none";
  const overlay = document.createElement("div"); overlay.style.cssText = "position:absolute;inset:0;pointer-events:none";
  const unfold = document.createElement("button"); unfold.className = "unfold glass"; unfold.id = "unfoldBtn";
  /* ★ rail 挂 root 不挂 col：宽屏时它要落到左侧「舞台」里，而 `.rail` 是 absolute，
     挂在 col 下的话 left:12px 是从游戏列左边算起 —— 会压在田地上。 */
  col.append(hud, unfold, toasts, layer, overlay); root.appendChild(railEl);
  // v57：上下栏可收起——收起后只留右上角一个小胶囊（金币 + 展开箭头）；偏好存 __sys 设置槽（不进玩法存档）
  let barsHidden = !!api.audioPrefs().barsHidden;
  function syncBars() {
    root.classList.toggle("bars-off", barsHidden);
    unfold.setAttribute("aria-label", t("a11y.showBars")); unfold.title = t("a11y.showBars");
    unfold.setAttribute("aria-hidden", String(!barsHidden)); unfold.tabIndex = barsHidden ? 0 : -1;
    hud.toggleAttribute("inert", barsHidden); railEl.toggleAttribute("inert", barsHidden);
  }
  function setBarsHidden(h         , persist = true) {
    if (h === barsHidden) return;
    barsHidden = h; syncBars();
    // ★ 立刻把胶囊填好：`renderUnfold()` 原来只在 `refreshHud()`（每秒一次）里跑，
    //   于是点「收起」之后最多有 1 秒是一个**空的玻璃圈**（看起来像按钮坏了）。
    //   2026-10-24 由 e2e 抓到（同一段代码时绿时红，红的原因是读得太早）。
    if (h) renderUnfold();
    G?.cue("sfx.tap"); try { (globalThis       ).__cfHaptic?.(); } catch { /* 无震动 */ }
    if (persist) api.setPrefs({ barsHidden: h });
    setTimeout(() => { G?.relayout(); coachUpdate(); }, 340);
  }
  unfold.addEventListener("click", () => setBarsHidden(false));
  api.onPrefs(p => { if (typeof p.barsHidden === "boolean" && p.barsHidden !== barsHidden) { barsHidden = p.barsHidden; syncBars(); G?.relayout(); } });
  // 收起状态的小胶囊。**宿主形态只留一个箭头**：🪙 由宿主顶栏常驻显示，
  // 这里再画一遍就是同一个数画两遍（和 HUD 上删掉 🪙 是同一条理由）。
  // 独立网页没有宿主顶栏，所以照旧显示余额 —— 那是它唯一的余额入口。
  function renderUnfold() {
    const hosted = !!G?.farm?.wallet?.enabled;
    unfold.innerHTML = hosted
      ? CHEV_DOWN
      : `<img src="${itemImg("coin")}" alt=""><span>${G ? G.farm.s.points : ""}</span>${CHEV_DOWN}`;
    unfold.classList.toggle("solo", hosted);
  }
  syncBars();
  // v55：右侧悬浮的事件调试按钮已移除——入口改在「设置」里（新手引导旁边）。
  let guideEl                        = null;

  /**
   * 两侧各留多宽才值得把底栏搬到左边。
   *
   * 实测（宿主容器尺寸）：手机 390 两侧 0、iPad 竖屏 70~72、iPad 4:3 横屏 130~178。
   * 104 这个门槛刚好把「横屏」圈进来、把「竖屏」留在外面 —— 竖屏那 70px 放不下
   * 一条能点的竖栏（按钮要 44px 起），硬搬过去只会挤。
   */
  const GUT_MIN = 104;
  api.ui.layout = () => {
    const { vw } = viewport();
    const w = colWidth();
    col.style.width = w + "px";
    col.classList.toggle("narrow", w < 380);
    const gut = Math.max(0, Math.round((vw - w) / 2));
    const wide = gut >= GUT_MIN;
    root.classList.toggle("wide", wide);
    if (wide) {
      // +1 是为了盖住半像素缝：vw-w 是奇数时 round 会在列边留一道 0.5px 亮线。
      gutL.style.width = gut + 1 + "px";
      gutR.style.width = gut + 1 + "px";
      // 竖栏在留白里**居中**，两侧各留 20px 呼吸 —— 贴死游戏列会显得像被挤出来的。
      const rw = Math.max(76, Math.min(gut - 40, 112));
      railEl.style.left = Math.round((gut - rw) / 2) + "px"; railEl.style.right = "auto";
      railEl.style.width = rw + "px";
    } else {
      // 竖栏还原成「贴在游戏列里的底栏」：列是居中的，所以左右各让出 gut。
      railEl.style.left = gut + 8 + "px"; railEl.style.right = gut + 8 + "px";
      railEl.style.width = "";
    }
    const rh = wide ? 0 : railEl.getBoundingClientRect().height;
    const bottom = barsHidden ? 0 : rh + 10;
    toasts.style.bottom = bottom + 8 + (guideEl ? 60 : 0) + "px";
    if (guideEl) guideEl.style.bottom = bottom + 6 + "px";
    return { colW: w, top: 0, bottom, wide, gut };
  };

  let G       ;
  void api.gameReady.then(g => { G = g; start(); });

  // ---------------- HUD ----------------
  function buildHud() {
    // v56：一条贴顶通栏（等级+经验 | 金币 ＋ | 产出）+ 栏下分段控件（牧场/田地/鱼塘）与天气、日志、设置
    // v57：一行通栏（等级徽章 | 金币＋ | 丰收币 | 日志 | 设置）+ 下方浮动小胶囊（分区 / 天气 / 收起），减少遮挡
    //
    // ★ v58（接进宿主后）：**HUD 上不再有 🪙 积分胶囊，也没有「＋」按钮**。
    //   两个理由，都是硬的：
    //   ① 宿主顶栏就在这块画布上方 40px，那里常驻显示 🪙 积分 ——
    //      再画一个一模一样的胶囊，孩子会以为屏幕上有两个余额（娃娃机踩过）。
    //   ② 积分是 App 的账本，游戏**不能自己加**（`host.spendPoints` 只能减）。
    //      那个「＋」按钮以前是给玩具版打钱用的，现在点它只能是假的。
    //   ③ 兑换券也**不在这里画**（2026-10-24）：`mintVoucher` 落的是宿主那张
    //      `db.harvestLedger`，和内置农场**同一个账本**，所以宿主顶栏现在
    //      对所有游戏都显示 🎟️。插件再画一枚就是同一个数画两遍。
    //   结果：顶栏只剩「等级 + 两个按钮」。原来那条通栏玻璃底会留出一大片
    //   空白（390 上量到 170px、平板上更宽），所以不再画通栏底 ——
    //   左边一枚等级徽章、右边两枚图标钮，各自带自己的底，中间直接是场景。
    //
    // ★ 2026-10-24 第二轮（用户：「牧场 田地 鱼塘 是不是现在可以移上去。现在上面空了一块。」）：
    //   分区切换（牧场/田地/鱼塘）原来单独占一行 `.subbar`，而顶栏中间那条 spacer
    //   实测还有 **218px** 空着 —— 两件事叠在一起就是「上面空了一块」。
    //   现在把整枚分段胶囊（天气 + 三个分区 + 收起）搬进顶栏，替掉那条 spacer：
    //   上栏高度 92 → 48，少掉一整行，空档也填上了。
    //   ⚠️ 窄屏（≤380）放不下，就把天气那个小图标让掉（分区和收起都是控件，不让）。
    hud.innerHTML = `
      <div class="topbar">
        <div class="lv" id="lvBadge" title="${esc(t("hud.lv", { n: G.farm.level.level }))}"><span class="lvt" id="lvt"></span><span class="exp" id="exp"></span></div>
        <div class="seg glass" role="tablist">
          <span class="wx" id="weatherChip"><span id="wicon"></span><span class="vh" id="wname"></span></span><i class="ssep"></i>
          <button data-zone="ranch" role="tab">${esc(t("hud.ranch"))}</button><button data-zone="field" role="tab">${esc(t("hud.field"))}</button><button data-zone="pond" role="tab">${esc(t("hud.pond"))}</button>
          <i class="ssep"></i><button class="fold" id="foldBtn" aria-label="${esc(t("a11y.hideBars"))}" title="${esc(t("a11y.hideBars"))}">${CHEV_UP}</button>
        </div>
        <button class="iconbtn" id="logBtn" aria-label="${esc(t("a11y.log"))}">${ico("log", 22)}<i class="dot" id="logDot" hidden></i></button>
        <button class="iconbtn" id="setBtn" aria-label="${esc(t("a11y.settings"))}">${ico("gear", 22)}</button>
      </div>`;
    hud.classList.add("tv-a"); // v58：两版比稿后选 A（等级圆徽章带进度外圈）
    hud.querySelector("#foldBtn") .addEventListener("click", () => setBarsHidden(true));
    hud.querySelector("#logBtn") .addEventListener("click", () => { G.cue("sfx.tap"); openSheet("log"); });
    hud.querySelector("#setBtn") .addEventListener("click", () => { G.cue("sfx.tap"); openSheet("settings"); });
    hud.querySelectorAll                   ("[data-zone]").forEach(b => b.addEventListener("click", () => { G.cue("sfx.tap"); G.scrollToZone(b.dataset.zone           ); setTimeout(syncZoneSeg, 400); }));
    hudCache = {}; segZone = ""; setTimeout(syncZoneSeg, 0);
  }
  // 分段控件选中态 = 当前可视中心所在区域
  let segZone = "";
  function syncZoneSeg() {
    if (!G?.view) return;
    const v = G.view       ; const cy = v.scrollY + (v.viewH / Math.max(0.01, v.scale)) / 2;
    const z = cy < FIELD_TOP + 80 ? "ranch" : cy < POND_TOP + 60 ? "field" : "pond";
    if (z === segZone) return; segZone = z;
    hud.querySelectorAll                   ("[data-zone]").forEach(b => { const on = b.dataset.zone === z; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  }
  // ★ 插件形态要能卸载：所有定时器登记下来，unmount 时统一 clear。
  //   不登记的话它们会继续跑、继续读已经销毁的 view，报一堆 null 错。
  const timers = [];
  const track = (id) => { timers.push(id); return id };
  track(setInterval(() => syncZoneSeg(), 300));
  let vol = { music: 0.8, sfx: 1 }, muted = false; // 从 __sys_settings 恢复的初始值见下方 gameReady 前初始化
  function syncMuteBtn() { /* v55：HUD 上的声音图标已移除，静音只在设置里切换 */ }
  function refreshWeather() {
    const night = G.view && G.view.nightness > 0.5;
    const w = G.farm.weather();
    setTxt("wicon", night ? "🌙" : w === "rain" ? "🌧️" : w === "cloud" ? "☁️" : "☀️");
    setTxt("wname", night ? t("weather.night") : t("weather." + w)); const wc = document.getElementById("weatherChip"); if (wc && wc.title !== (hudCache.wname ?? "")) { wc.title = hudCache.wname ?? ""; wc.setAttribute("aria-label", wc.title); }
  }
  function buildRail() {
    const btns                             = [["seeds", "seeds", "rail.seeds"], ["ranch", "animals", "rail.animals"], ["pond", "fish", "rail.pond"], ["market", "market", "rail.market"], ["bag", "bag", "rail.bag"]];
    railEl.innerHTML = btns.map(([k, ic, lbl]) => `<button class="rbtn" data-open="${k}" id="rail-${k}">${ico(ic, 28)}<span>${esc(t(lbl))}</span>${k === "market" ? '<i class="badge" id="mkBadge" hidden></i>' : ""}</button>`).join("");
    railEl.querySelectorAll                   ("[data-open]").forEach(b => b.addEventListener("click", () => { G.cue("sfx.tap"); openSheet(b.dataset.open ); }));
  }
  function syncRail() { const k = sheet && ["seeds", "ranch", "pond", "market", "bag"].includes(sheet.kind) ? sheet.kind : ""; railEl.querySelectorAll             ("[data-open]").forEach(b => b.classList.toggle("on", b.dataset.open === k)); }

  let hudCache                         = {};
  const setTxt = (id        , v        ) => { if (hudCache[id] !== v) { hudCache[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; } };
  function refreshHud() {
    if (!G) return;
    const f = G.farm; const L = f.level;
    setTxt("lvt", t("hud.lv", { n: L.level })); setTxt("exp", `${L.into}/${L.need}`);
    // 进度只画在徽章外圈那道 conic 环上（`--p`）。原来还有一条 `.xpline` 细线，
    // 但 tv-a 这一版 `display:none` 掉了 —— 一并删掉，别留一个没人看的元素。
    const pct = Math.round(L.into / L.need * 100);
    document.getElementById("lvBadge")?.style.setProperty("--p", pct + "%");
    // 积分镜像是**宿主账本的缓存**：每秒（和每次 change）重算一次，
    // 孩子看到的数就不会停在旧值上（比如家长刚在设置页改了积分）。
    // HUD 上不显示积分/兑换券（宿主顶栏都有），但收起状态的小胶囊、种子/市场面板要用。
    f.wallet.commit();
    if (barsHidden) renderUnfold();
    refreshWeather();
    const dot = document.getElementById("logDot"); if (dot) dot.hidden = f.unreadLog() === 0;
    const mk = document.getElementById("mkBadge"); const n = f.sellableCount();
    if (mk) { mk.hidden = n === 0; mk.textContent = String(n); }
  }
  function bump(id        ) { const el = document.getElementById(id); if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  // ---------------- planting guide ----------------
  function refreshGuide() {
    const id = G.selectedSeed;
    if (!id) { if (guideEl) { guideEl.remove(); guideEl = null; G.relayout(); } return; }
    if (!guideEl) { guideEl = document.createElement("div"); guideEl.className = "guide"; col.appendChild(guideEl); }
    const c = cropById(id);
    guideEl.innerHTML = `<img src="${cropImg(id)}" alt=""><span class="gt">${esc(t("guide.plant", { name: nm(id), n: c.seed }))}</span><button class="xbtn" aria-label="${esc(t("a11y.cancelSeed"))}">✕</button>`;
    guideEl.querySelector("button") .addEventListener("click", () => { G.selectSeed(null); refreshGuide(); });
    G.relayout();
  }

  // ---------------- sheets ----------------
  { const p = api.audioPrefs(); vol = { music: p.music, sfx: p.sfx }; muted = p.muted; }
  ;                                                                                                                                         
  let sheet                                                                                                                = null;
  let pressing = false;
  let openedAt = 0; // 弹窗打开时刻：用来防“幽灵点击”

  function openSheet(kind        , arg                  , tab                   ) {
    closeSheet(true);
    G.cue("sfx.open");
    pendingPlantPlot = null; // 非“为某块地选种”的打开路径一律清掉待种地块
    const scrim = document.createElement("div"); scrim.className = "scrim";
    const el = document.createElement("div"); el.className = "sheet"; el.setAttribute("role", "dialog");
    const wrap = document.createElement("div"); wrap.style.cssText = "position:absolute;inset:0;pointer-events:none";
    wrap.append(scrim, el); layer.appendChild(wrap);
    openedAt = performance.now();
    // 有些浏览器会在轻点后补发一个迟到几百毫秒的 click（幽灵点击），恰好落在刚打开的
    // 弹窗上把它瞬间关掉或误点按钮（表现为“点了没反应”）。刚打开的一小段时间忽略这类误触。
    scrim.addEventListener("click", () => { if (performance.now() - openedAt > 600) closeSheet(); });
    let sy = 0, dragging = false;
    el.addEventListener("pointerdown", e => { pressing = true; sy = e.clientY; dragging = (e.target               ).closest(".sh-h") != null; });
    el.addEventListener("pointerup", e => { pressing = false; if (dragging && e.clientY - sy > 70) closeSheet(); dragging = false; });
    el.addEventListener("pointercancel", () => { pressing = false; dragging = false; });
    el.addEventListener("click", e => {
      if (performance.now() - openedAt < 600) return; // 防幽灵点击误点按钮
      const b = (e.target               ).closest             ("[data-act]");
      if (b && !(b                     ).disabled) act(b.dataset.act , b.dataset.arg ?? "", b);
    });
    const body = document.createElement("div");
    sheet = { kind: kind             , arg, tab: tab ?? "adopt", el: wrap, body };
    renderSheet(); syncRail();
    if (kind === "log") { G.farm.s.logSeenAt = G.farm.now(); refreshHud(); }
    if (kind === "seeds" && G.farm.s.onboard === 0) { G.farm.s.onboard = 1; G.farm.emit({ type: "change" }); }
    coachUpdate();
  }
  // 性能指示：调试面板开着时每 0.5s 刷新一次 FPS / DrawCall（v49）
  track(setInterval(() => {
    const el = layer.querySelector             (".dbg-perf"); if (!el || !G) return;
    const f = G.view.fps(); el.textContent = `FPS ${f.fps} · DC ${f.dc}`;
  }, 500));
  function closeSheet(silent = false) {
    if (!sheet) return;

    sheet.el.remove(); sheet = null; pressing = false; pendingPlantPlot = null; syncRail();
    if (!silent) { G.cue("sfx.close"); coachUpdate(); }
  }
  // 弹层头部的币种胶囊。**有宿主时 🎟️ 不画**（2026-10-24）：
  //   宿主顶栏现在常驻显示兑换券（`mintVoucher` 落的 `db.harvestLedger` 就是它读的表），
  //   弹层再画一枚 = 同一个数在屏幕上下各出现一次 —— HUD 上刚为这个理由删过一次，
  //   弹层里不能换个地方又长回来。独立网页没有宿主顶栏，所以照画。
  //   🪙 保留：种子 / 动物 / 鱼这三个面板是**花钱**的地方，价格旁边就地给一个余额参照，
  //   孩子不用来回抬头看；而且它在模态层里，不和顶栏并排抢注意力。
  function header(icon        , title        , pill                  ) {
    const hosted = !!G.farm.wallet?.enabled;
    const p = pill === "coin" ? `<div class="stat"><img src="${itemImg("coin")}" alt=""><span>${G.farm.s.points}</span></div>`
      : pill === "harv" && !hosted ? `<div class="stat harv"><span class="vico">🎟️</span><span>${G.farm.s.harvest}</span></div>` : "";
    return `<div class="sh-h"><img src="${icon}" alt=""><h2>${esc(title)}</h2>${p}<button class="xbtn" data-act="close" aria-label="${esc(t("a11y.close"))}">✕</button></div>`;
  }

  function renderSheet() {
    if (!sheet) return;
    const s = sheet; const inner = s.el.querySelector(".sheet")               ;
    const prevScroll = inner.querySelector(".sh-b")?.scrollTop ?? 0;
    let html = "";
    switch (s.kind) {
      case "seeds": html = header(asset("ui/seeds.webp"), t("seed.title"), "coin") + `<div class="sh-b" data-mp-scroll><div class="group">${seedList()}</div></div>`; break;
      case "ranch": case "pond": html = header(s.kind === "ranch" ? asset("ui/animals.webp") : asset("ui/fish.webp"), t(s.kind === "ranch" ? "shop.ranch" : "shop.pond"), "coin") + tabs(s.kind) + `<div class="sh-b" data-mp-scroll><div class="group">${s.tab === "mine" ? mineList(s.kind) : adoptList(s.kind)}</div></div>`; break;
      case "animal": { const an = G.farm.animal(Number(s.arg)); if (!an) { closeSheet(); return; } html = header(asset(`animals/${an.kind}.webp`), nm(an.kind)) + `<div class="sh-b">${animalRow(an.uid)}</div>`; break; }
      case "market": html = header(asset("ui/market.webp"), t("market.title"), "harv") + `<div class="sh-b" data-mp-scroll>${marketList()}</div>`; break;
      case "bag": html = header(asset("ui/bag.webp"), t("bag.title")) + `<div class="sh-b" data-mp-scroll>${bagList()}</div>`; break;
      case "harvest": html = harvestSheet(Number(s.arg)); break;
      case "log": html = header(asset("ui/log.webp"), t("log.title")) + `<div class="sh-b" data-mp-scroll><div class="group">${logList()}</div></div>`; break;
      case "settings": html = header(asset("ui/gear.webp"), t("settings.title")) + `<div class="sh-b" data-mp-scroll>${settingsBody()}</div>`; break;
      case "dbg": html = header(asset("ui/gear.webp"), t("dbg.title")) + `<div class="sh-b">${dbgBody()}</div>`; break;
      case "fishing": html = header(asset("ui/fish.webp"), t("fishing.title")) + `<div class="sh-b" data-mp-scroll>${fishingBody()}</div>`; break;
    }
    inner.innerHTML = html;
    const b = inner.querySelector(".sh-b"); if (b) b.scrollTop = prevScroll;
    if (s.kind === "settings") wireSettings(inner);
  }
  const tabs = (zone                  ) => `<div class="tabs"><button class="tab ${sheet .tab !== "mine" ? "on" : ""}" data-act="tab" data-arg="adopt">${esc(t("tab.adopt"))}</button><button class="tab ${sheet .tab === "mine" ? "on" : ""}" data-act="tab" data-arg="mine">${esc(t("tab.mine", { n: G.farm.zoneCount(zone), m: G.farm.zoneCap(zone) }))}</button></div>`;

  function seedList() {
    const lvl = G.farm.level.level;
    return CROPS.map(c => {
      const why = G.farm.canPlant(c.id);
      const btn = why === "level" ? `<button class="btn w" disabled>${esc(t("btn.lockLv", { n: c.level }))}</button>`
        : why === "points" ? `<button class="btn w" disabled>${esc(t("btn.noPoints"))}</button>`
        : `<button class="btn y" data-act="pick" data-arg="${c.id}" id="pick-${c.id}">${esc(t("btn.pick"))}</button>`;
      return `<div class="item ${c.level > lvl ? "off" : ""}"><img class="thumb" src="${cropImg(c.id)}" alt=""><div class="info"><b>${esc(nm(c.id))}</b>
        <span class="s">${esc(t("seed.info", { t: durMin(c.growMin), n: c.times }))}</span>
        <div class="tags">${c.perennial ? `<span class="tg g">${esc(t("seed.tree"))}</span>` : ""}<span class="tg c">${esc(t("seed.price", { n: c.seed }))}</span><span class="tg h">${esc(t("seed.cap", { n: capCrop(c) }))}</span></div></div>${btn}</div>`;
    }).join("") + wutongCard(); // v55：神圣梧桐排在种子列表最后
  }
  function adoptList(zone                  ) {
    const lvl = G.farm.level.level;
    return ANIMALS.filter(a => a.zone === zone).map(a => {
      const why = G.farm.canAdopt(a.id);
      const cap = G.farm.speciesCap(a.id), have = G.farm.speciesCount(a.id);
      const btn = why === "level" ? `<button class="btn w" disabled>${esc(t("btn.lockLv", { n: a.level }))}</button>`
        : why === "species" ? `<button class="btn w capped" aria-disabled="true" data-act="adoptcap" data-arg="${a.id}" id="adopt-${a.id}" style="opacity:.55;filter:grayscale(.6)">${esc(t("adopt.capped", { h: have, n: cap }))}</button>`
        : why === "full" ? `<button class="btn w" disabled>${esc(t("adopt.full"))}</button>`
        : why === "points" ? `<button class="btn w" disabled>${esc(t("btn.noPoints"))}</button>`
        : `<button class="btn p" data-act="adopt" data-arg="${a.id}" id="adopt-${a.id}">${esc(t("btn.adopt"))}</button>`;
      const ward = a.ward ? `<span class="ward">${esc(t("ward." + a.id, { p: Math.round(a.ward.p * 100) }))}</span>` : a.id === "yulong" ? `<span class="ward">${esc(t("ward.yulong"))}</span>` : "";
      return `<div class="item ${a.level > lvl ? "off" : ""}"><img class="thumb" src="${asset(`${a.noBaby ? "animals" : "babies"}/${a.id}.webp`)}" alt=""><div class="info"><b>${esc(nm(a.id))}</b>
        <span class="s">${esc(t(a.permanent ? "adopt.infoInf" : "adopt.info", { t: durMin(a.matureMin), i: durMin(a.intervalMin), item: qty(a.item, PER_YIELD), k: a.times }))}</span>${ward}
        <div class="tags"><span class="tg c">${esc(t("adopt.cost", { n: a.cost }))}</span><span class="tg h">${esc(t("seed.cap", { n: capAnimal(a) }))}</span><span class="tg ${have >= cap ? "d" : "g"}">${esc(t("adopt.capTag", { n: cap }))} · ${have}/${cap}</span></div></div>${btn}</div>`;
    }).join("");
  }
  // v52：神圣梧桐卡移到种子面板顶部（用户反馈：它是种子类）。专属种植流程：buyWutong 直接种到池塘右侧河岸（v53），从不进普通地块（不走 pick/pendingPlantPlot）
  // v51：神圣梧桐卡：L6 一次性 20000、永久一颗、三阶段成长；买后显示当前阶段与下次阶段倒计时
  function wutongCard() {
    const w = G.farm.s.wutong; const why = G.farm.canBuyWutong(); const lvl = G.farm.level.level;
    let cur = -1, sline = "";
    if (w) {
      cur = wutongStage(Math.max(0, G.farm.now() - w.plantedAt)); sline = t("tree.stage" + cur);
      if (cur < 2) sline += " · " + t("tree.next", { k: t("tree.stage" + (cur + 1)), t: fmtDur(WUTONG_STAGE_MIN[cur + 1] * MS_PER_FARM_MIN - (G.farm.now() - w.plantedAt)) });
      else sline += " · ∞";
    } else sline = t("adopt.treeInfo", { a: durMin(WUTONG_STAGE_MIN[1]), b: durMin(WUTONG_STAGE_MIN[2]) });
    const btn = why === "done" ? `<button class="btn w" disabled>${esc(t("tree.planted"))}</button>`
      : why === "level" ? `<button class="btn w" disabled>${esc(t("btn.lockLv", { n: WUTONG_LEVEL }))}</button>`
      : why === "points" ? `<button class="btn w" disabled>${esc(t("btn.noPoints"))}</button>`
      : `<button class="btn y" data-act="wutongbuy" id="buy-wutong">${esc(t("tree.plantBtn"))}</button>`;
    return `<div class="item ${WUTONG_LEVEL > lvl && !w ? "off" : ""}"><img class="thumb" src="${asset(`sprites/wutong-${cur >= 0 ? cur : 2}.webp`)}" alt=""><div class="info"><b>${esc(t("n.wutong"))}</b>
      <span class="s">${esc(sline)}</span><span class="ward">${esc(t("ward.wutong"))}</span>
      <div class="tags"><span class="tg g">${esc(t("tree.riverTag"))}</span><span class="tg c">${esc(t("seed.price", { n: WUTONG_COST }))}</span><span class="tg h">∞</span></div></div>${btn}</div>`;
  }
  function mineList(zone                  ) {
    const list = G.farm.s.animals.filter(a => animalById(a.kind).zone === zone);
    if (!list.length) return `<div class="empty">${esc(t("mine.empty"))}</div>`;
    return list.map(a => animalRow(a.uid)).join("");
  }
  const MOOD                         = { basking: "☀️", happy: "😊", normal: "😐", hungry: "😫", sick: "🤒", poop: "💩", old: "🧓", spent: "🧺", deceased: "🕊️" };
  function animalRow(uid        ) {
    const an = G.farm.animal(uid) ; const info = G.farm.animalInfo(an); const d = info.def;
    let status = "", prog = 0;
    if (an.dead) status = t("st.dead");
    else if (an.sickSince != null) status = t("st.sick");
    else if (an.poopSince != null) status = t("st.poop");
    else if (!info.mature) { status = t("st.baby", { t: fmtDur(info.nextAt) }); prog = info.growP; }
    else if (G.farm.isBasking(an)) { status = t("st.bask", { t: fmtDur((an.baskUntil ?? 0) - G.farm.now()) }); prog = 0; }
    else if (info.spent) status = t("st.spent");
    else if (an.kind === "dog") status = G.isSleeping(uid) ? t("st.dogSleep") : t("st.patrol");
    else if (an.kind === "polarbear" && G.isNapping(uid)) status = t("st.bearSleep");
    else if (info.ready > 0) status = t("st.ready", { n: info.ready });
    else { status = t("st.next", { t: fmtDur(info.nextAt) }) + " · " + (d.permanent ? t("st.leftInf", { n: Math.max(0, d.times - an.rounds) }) : t("st.left", { n: d.times - an.rounds })); prog = info.cycleP; }
    const img = !info.mature && !d.noBaby ? asset(`babies/${an.kind}.webp`) : asset(`animals/${an.kind}.webp`);
    const pond = d.zone === "pond";
    const feedLbl = !pond ? t("btn.feed") : an.kind === "turtle" ? t("btn.feedTurtle") : t("btn.feedFish");
    let dispBtn = "";
    let balloonBtn = "";
    if (sheet .kind !== "animal" && animalById(an.kind).zone === "ranch" && !an.dead && info.spent) {
      balloonBtn = `<button class="btn y" data-act="balloonpop" data-arg="${uid}">${esc(t("btn.balloonPop"))}<small>1~2 🧪</small></button>`;
    }
    if (an.kind === "peacock" && !an.dead && info.mature) {
      dispBtn = G.displayState(uid).displaying
        ? `<button class="btn w" disabled>🦚 ${esc(t("btn.displaying"))}</button>`
        : `<button class="btn w" id="disp-${uid}" data-act="display" data-arg="${uid}">🦚 ${esc(t("btn.display"))}</button>`;
    }
    let baskBtn = "", baskTip = "";
    if (an.kind === "turtle" && !an.dead) {
      const why = G.farm.canBask(uid);
      baskBtn = why === "ok" ? `<button class="btn y" data-act="bask" data-arg="${uid}" id="bask-${uid}">${esc(t("btn.bask"))}</button>`
        : why === "basking" ? `<button class="btn w" disabled>${esc(t("btn.baskOn"))}</button>`
        : why === "cooldown" ? `<button class="btn w" disabled>${esc(t("btn.baskCd", { t: fmtDur(G.farm.baskCooldown(an)) }))}</button>`
        : `<button class="btn w" disabled>${esc(t("btn.baskFull"))}</button>`;
      if (why === "ok") { const b = G.farm.baskBoost(an); baskTip = `<span class="s">${esc(b > 0 ? t("bask.tip", { t: fmtDur(b) }) : t("bask.tipSpent"))}</span>`; }
    }
    const acts = an.dead ? `<button class="btn r" data-act="goodbye" data-arg="${uid}">${esc(t("btn.goodbye"))}</button>`
      : `${an.sickSince != null ? `<button class="btn g" data-act="disinfect" data-arg="${uid}">${esc(t("btn.disinfect"))}</button>` : ""}${an.poopSince != null ? `<button class="btn g" data-act="cleanup" data-arg="${uid}">${esc(t("btn.cleanup"))}</button>` : ""}<button class="btn w" data-act="feed" data-arg="${uid}" id="feed-${uid}">${esc(feedLbl)}</button>${baskBtn}${dispBtn}${balloonBtn}<button class="btn w" data-act="pet" data-arg="${uid}">${esc(t("btn.pet"))}</button>${info.ready > 0 ? `<button class="btn y" data-act="collect" data-arg="${uid}">${esc(t("btn.collect"))} <small>+${info.ready} ×${PER_YIELD}</small></button>` : ""}`;
    return `<div class="item"><img class="thumb" src="${img}" alt=""><div class="info"><b>${esc(nm(an.kind))} ${MOOD[info.mood] ?? ""} ${an.sickSince != null ? `<span class="tg d">🤒</span>` : ""}</b>
      <span class="s">${esc(status)}</span>${baskTip}${prog > 0 ? `<div class="prog"><i style="width:${Math.round(prog * 100)}%"></i></div>` : ""}<div class="acts">${acts}</div></div></div>`;
  }
  function spark(item        ) {
    const h = G.farm.history(item, 7); const base = ITEM_PRICE[item];
    const lo = base * 0.5, hi = base * 1.02; const W = 110, H = 34;
    const pts = h.map((p, i) => `${(i / (h.length - 1) * (W - 6) + 3).toFixed(1)},${(H - 3 - (p - lo) / (hi - lo) * (H - 6)).toFixed(1)}`);
    const last = pts[pts.length - 1].split(",");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="${esc(t("market.7d"))}"><line x1="0" x2="${W}" y1="${(H - 3 - (base - lo) / (hi - lo) * (H - 6)).toFixed(1)}" y2="${(H - 3 - (base - lo) / (hi - lo) * (H - 6)).toFixed(1)}" stroke="${C.border}" stroke-dasharray="3 3" stroke-width="1"/><polyline points="${pts.join(" ")}" fill="none" stroke="${C.harvest}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${C.accent}" stroke="${C.text}" stroke-width="1.5"/></svg>`;
  }
  function marketList() {
    const f = G.farm; const idx = f.marketIndex(), y = f.marketIndexYesterday();
    const up = idx >= y;
    let html = `<div class="idx"><span>${esc(t("market.index", { q: t(idx >= 95 ? "market.good" : "market.ok"), a: up ? "↑" : "↓", n: Math.round(idx) }))}</span></div>`;
    const held = SELLABLE.filter(it => (f.s.bag[it] ?? 0) > 0);
    if (!held.length) return html + `<div class="empty">${esc(t("market.empty"))}</div><div class="tip">${esc(t("market.tip"))}</div>`;
    html += `<div class="group">` + held.map(it => {
      const have = f.s.bag[it]; const p = f.priceNow(it); const tag = f.priceTag(it);
      const n1 = f.maxSellable(it, 1), nh = f.maxSellable(it, Math.ceil(have / 2)), na = f.maxSellable(it, have);
      const u = unitOf(it);
      const b = (n        , lbl        , cls        , id        ) => `<button class="btn ${cls}" data-act="sell" data-arg="${it}:${n}" id="${id}" ${n <= 0 ? "disabled" : ""}>${esc(lbl)}<small>+${f.quote(it, n)} 🌾</small></button>`;
      return `<div class="item" style="flex-wrap:wrap"><img class="thumb" src="${itemImg(it)}" alt="" style="width:52px;height:52px"><div class="info"><b>${esc(itemName(it))} <span class="tg ${tag === "good" ? "h" : tag === "cheap" ? "d" : "c"}">${esc(t("tag." + tag))}</span></b>
        <span class="s">${esc(t("market.have", { n: have, u }))} · ${esc(t("market.price", { p: fmtP(p), u }))}</span><span class="s">${esc(t("market.quota", { n: f.remainingQuota(it) }))}</span></div>${spark(it)}
        <div class="acts" style="width:100%">${b(n1, t("market.sell1", { u }), "w", "sell1-" + it)}${b(nh, t("market.sellHalf"), "w", "sellh-" + it)}${b(na, t("market.sellAll"), "g", "sella-" + it)}</div></div>`;
    }).join("") + `</div>`;
    return html + `<div class="tip">${esc(t("market.tip"))}</div>`;
  }
  function bagList() {
    const f = G.farm; const items = Object.keys(f.s.bag).filter(k => f.s.bag[k] > 0);
    if (!items.length) return `<div class="empty">${esc(t("bag.empty"))}</div>`;
    const cells = items.map(it => {
      const sellable = it in ITEM_PRICE;
      return `<button class="cell" ${sellable ? `data-act="toMarket" data-arg="${it}"` : `data-act="noop"`}><img src="${itemImg(it)}" alt=""><span>${esc(itemName(it))}</span><span class="n">×${f.s.bag[it]}</span></button>`;
    }).join("");
    return `<div class="grid">${cells}</div>${(f.s.bag.fertilizer ?? 0) > 0 ? `<div class="tip">💩 ${esc(itemName("fertilizer"))}：${esc(t("bag.fert"))}</div>` : ""}`;
  }
  function harvestSheet(i        ) {
    const cs = G.farm.s.plots[i]?.crop; if (!cs) { setTimeout(() => closeSheet(), 0); return ""; }
    const c = cropById(cs.id); const p = G.farm.priceNow(c.item);
    return header(cropImg(cs.id), `${nm(cs.id)} · ${t("plot.ready")}`) + `<div class="sh-b"><div class="big2">
      <button class="btn b" data-act="hstore" data-arg="${i}" id="hstore">${esc(t("harvest.store"))}<small>${esc(t("harvest.storeSub"))}</small></button>
      <button class="btn g" data-act="hsell" data-arg="${i}" id="hsell">${esc(t("harvest.sell"))}<small>${esc(t("harvest.sellSub", { p: fmtP(p), u: unitOf(c.item) }))}</small></button></div>
      <div class="tip" style="text-align:center">${esc(t("harvest.note"))}</div></div>`;
  }
  function fishingBody() {
    const cost = G.fishCost();
    const busy = G.fishingActive();
    const can = !busy && G.farm.s.points >= cost;
    let h = '<div class="row" style="margin:2px 0 6px">'
      + '<button class="btn b" data-act="startfishing"' + (can ? ">" : " disabled>")
      + esc(t("fishing.cast", { n: cost })) + (busy ? "<small>" + esc(t("fishing.casting")) + "</small>" : "") + "</button></div>";
    h += '<div class="tip">' + esc(t("fishing.desc", { n: cost })) + "</div>";
    h += '<div class="tip">' + esc(t("fishing.odds")) + "</div>";
    return h;
  }

  let creekSpot                                  = null;
  let pendingPlantPlot                = null; // “为这块地选种”模式：openSeedsForPlot 开种子面板，点"选这个"立刻种到这块地
  function logList() {
    const L = G.farm.s.log.filter(l => l.ev === true); if (!L.length) return `<div class="empty">${esc(t("log.empty"))}</div>`;
    return L.map(l => { const d = new Date(l.t); return `<div class="log"><time>${pad(d.getHours())}:${pad(d.getMinutes())}</time><span>${esc(logText(l.k, l.p))}</span></div>`; }).join("");
  }


  function langButtons() {
    const cur = getLang();
    return `<div class="langs">${(Object.keys(LANGS)          ).map(l => `<button class="lang" lang="${l === "zh" ? "zh-Hans" : l}" data-lang="${l}" aria-pressed="${l === cur}">${esc(LANGS[l]["lang." + l])}</button>`).join("")}</div>`;
  }
  function settingsBody() {
    return `<div class="group"><div class="set" style="flex-direction:column;align-items:stretch;padding:12px 16px"><label>${esc(t("settings.lang"))}</label>${langButtons()}</div></div>
      <div class="group">
        <div class="set"><label for="vm">${esc(t("settings.music"))}</label><input id="vm" type="range" min="0" max="1" step="0.05" value="${vol.music}"></div>
        <div class="set"><label for="vs">${esc(t("settings.sfx"))}</label><input id="vs" type="range" min="0" max="1" step="0.05" value="${vol.sfx}"></div>
        <div class="set"><label id="muteLbl">${esc(t("settings.mute"))}</label><button class="sw" role="switch" aria-labelledby="muteLbl" aria-checked="${muted}" data-act="mute" id="muteSw"></button></div>
      </div>
      <div class="set2"><button class="btn w" data-act="replay">${esc(t("settings.replay"))}</button><button class="btn w" data-act="opendbg" id="openDbg">${esc(t("dbg.title"))}</button></div>`;
  }

  function wireSettings(inner             ) {
    wireLangs(inner);
    inner.querySelector                  ("#vm") .addEventListener("input", e => { vol.music = Number((e.target                    ).value); api.setVolumes(vol); });
    inner.querySelector                  ("#vs") .addEventListener("input", e => { vol.sfx = Number((e.target                    ).value); api.setVolumes(vol); });
  }
  // 事件调试按钮面板式7种触发：生虫/干旱/生病/拉粑粑（抵达 farm 模拟层，确定性、进日志），
  // 天气/昼夜（表现层循环点击，明确状态），鱼跃（同 ?dbg=leap 触发）。
  function dbgBody() {
    const view = G.view;
    const wx = view.debugWx ?? "auto";
    const hr = view.debugHour == null ? "auto" : String(Math.round(view.debugHour));
    const wxLbl = wx === "auto" ? t("dbg.auto") : t("weather." + wx);
    const hrLbl = hr === "auto" ? t("dbg.auto") : `${hr}:00`;
    const sl = view.debugSleep;
    const slLbl = sl === "auto" ? t("dbg.auto") : t(sl === "sleep" ? "dbg.sleepAll" : "dbg.wakeAll");
    const rows                             = [
      ["dbg.pest", "pest", asset("ui/log.webp")],
      ["dbg.dry", "dry", asset("ui/seeds.webp")],
      ["dbg.sick", "sick", asset("ui/animals.webp")],
      ["dbg.poop", "poop", asset("ui/bag.webp")],
      ["dbg.weather", "weather", asset("ui/hat.webp")],
      ["dbg.hour", "hour", asset("ui/log.webp")],
      ["dbg.leap", "leap", asset("ui/fish.webp")],
      ["dbg.sleep", "sleep", asset("ui/animals.webp")],
    ];
    return `<div class="dbg-perf" style="font-size:13px;color:#6C6C70;text-align:center;font-variant-numeric:tabular-nums">FPS -- · DC --</div><div class="group">${rows.map(([k, act, icon]) => `
      <button class="set" data-act="dbg_${act}" data-arg="act" style="border:none;width:100%;text-align:left;justify-content:space-between;flex-wrap:nowrap">
        <span style="display:flex;align-items:center;gap:12px;font-size:16px"><img src="${icon}" alt="" style="width:26px;height:26px;object-fit:contain">${esc(t(k       ))}</span>
        <span class="dbg-cur" style="color:#8E8E93;font-size:15px">${act === "weather" ? esc(wxLbl) : act === "hour" ? esc(hrLbl) : act === "sleep" ? esc(slLbl) : ""} ›</span>
      </button>`).join("")}</div>`;
  }
  function wireLangs(scope             ) {
    scope.querySelectorAll                   ("[data-lang]").forEach(b => b.addEventListener("click", () => { api.setLang(b.dataset.lang        , true); }));
  }

  // ---------------- actions ----------------
  function act(a        , arg        , el             ) {
    const f = G.farm;
    switch (a) {
      case "close": G.cue("sfx.tap"); closeSheet(); return;
      case "tab": G.cue("sfx.tap"); sheet .tab = arg           ; renderSheet(); return;
      case "pick": {
        G.cue("sfx.tap");
        const pi = pendingPlantPlot; pendingPlantPlot = null;
        if (pi != null) { // 点空地进来的：选完即种
          if (G.farm.plant(pi, arg)) { closeSheet(); return; }
          pendingPlantPlot = pi; renderSheet(); return; // 失败（分数/等级不够）：farm 已发 toast，面板刷新按钮状态，保持待种模式
        }
        G.selectSeed(arg); closeSheet(); refreshGuide(); G.scrollToZone("field"); return;
      }
      case "wutongbuy": { if (f.buyWutong()) { closeSheet(); G.scrollToZone("field"); } else renderSheet(); return; }
      case "adoptcap": { f.adopt(arg); return; } // v53：到上限的卡片——不扣分，只弹三语提示
      case "adopt": { const an = f.adopt(arg); if (an) { const zone = animalById(arg).zone; closeSheet(); G.scrollToZone(zone === "ranch" ? "ranch" : "pond"); } else renderSheet(); return; }
      case "feed": {
        const uid = Number(arg); const an = f.animal(uid);
        const pond = !!an && animalById(an.kind).zone === "pond";
        if (f.feed(uid) && pond) { closeSheet(); G.scrollToZone("pond"); } else renderSheet();
        return;
      }
      case "pet": f.pet(Number(arg)); renderSheet(); return;
      case "startfishing": {
        if (creekSpot && G.startFishing(creekSpot.x, creekSpot.y)) closeSheet();
        else renderSheet();
        return;
      }
      case "bask": { const uid = Number(arg); if (f.bask(uid)) { closeSheet(); G.scrollToZone("pond"); } else renderSheet(); return; }
      case "display": {
        const uid = Number(arg);
        if (G.display(uid)) { closeSheet(); G.scrollToZone("ranch"); }
        else renderSheet();
        return;
      }
      case "collect": f.collect(Number(arg)); renderSheet(); return;
      case "balloonpop": { const r = f.popBalloon(Number(arg)); if (r) { G.cue("sfx.pop"); f.emit({ type: "change" }); } renderSheet(); return; }
      case "disinfect": {
        const b = f.disinfect(Number(arg));
        if (b > 0) { G.cue("sfx.spray"); toast(t("toast.disinfect", { n: b })); }
        renderSheet(); return;
      }
      case "cleanup": { f.cleanPoop(Number(arg)); renderSheet(); return; } // 音效由 farm 的 poopClean 事件统一放（sfx.sweep），避免双响
      case "goodbye": f.goodbye(Number(arg)); G.cue("sfx.tap"); renderSheet(); return;
      case "sell": { const [it, n] = arg.split(":"); const r = f.sell(it, Number(n)); if (r.count > 0) { toast(t("toast.sold", { n: r.count, u: unitOf(it), e: r.earned })); flyFrom(el, itemImg("harvest"), "host"); } renderSheet(); return; }
      case "toMarket": G.cue("sfx.tap"); openSheet("market"); return;
      case "hstore": case "hsell": {
        const i = Number(arg); closeSheet(true);
        f.harvest(i, a === "hsell" ? "sell" : "store");
        coachUpdate(); return;
      }
      case "opendbg": openSheet("dbg"); return; // v55：事件调试从设置进入
      case "mute": muted = !muted; api.setMuted(muted); syncMuteBtn(); renderSheet(); return;
      case "replay": f.s.onboard = 0; f.emit({ type: "change" }); closeSheet(); coachUpdate(); return;
      // ---- 事件调试 ----
      // debug 事件成功时由 farm 发出的 toast 事件负责提示，这里仅处理失败情形（防止重复出现）。
      case "dbg_pest": G.cue("sfx.tap"); if (!f.debugPest()) toast(t("dbg.pestNone")); return;
      case "dbg_dry": G.cue("sfx.tap"); if (!f.debugDry()) toast(t("dbg.dryNone")); return;
      case "dbg_sick": G.cue("sfx.tap"); if (!f.debugSick()) toast(t("dbg.sickNone")); return;
      case "dbg_poop": G.cue("sfx.tap"); if (f.debugPoop() <= 0) toast(t("dbg.poopNone")); return;
      case "dbg_weather": G.cue("sfx.tap"); { const cur = G.view.debugWx; let next                                  = "sun"; if (cur === "sun") next = "cloud"; else if (cur === "cloud") next = "rain"; else if (cur === "rain") next = null; G.view.debugWx = next; renderSheet(); } return;
      case "dbg_hour": G.cue("sfx.tap"); { const cur = G.view.debugHour; const seq = [0, 6, 12, 18, 21]; const idx = cur == null ? -1 : seq.findIndex(h => Math.abs(h - cur) < 1); const next = idx < 0 ? 0 : idx + 1 < seq.length ? seq[idx + 1] : null; G.view.debugHour = next; renderSheet(); } return;
      case "dbg_leap": G.cue("sfx.tap"); G.view.forceLeap(); return;
      case "dbg_sleep": G.cue("sfx.tap"); { const cur = G.view.debugSleep; G.view.debugSleep = cur === "auto" ? "sleep" : cur === "sleep" ? "wake" : "auto"; renderSheet(); } return;
    }
  }

  // ---------------- feedback ----------------
  function toast(msg        ) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
    toasts.appendChild(el);
    while (toasts.children.length > 2) toasts.firstElementChild .remove();
    setTimeout(() => el.remove(), 2500);
  }
  let capEl                        = null, capTimer = 0;
  function capsule(item               , amount        , kind        , earned        ) {
    capEl?.remove(); clearTimeout(capTimer);
    const el = document.createElement("div"); el.className = "cap";
    const bad = kind === "pest" || kind === "disease" || kind === "weather_bad";
    let html = "";
    if (amount <= 0) html = `<div class="m">${esc(t("ev.wither"))}</div>`;
    else html = `<div class="m"><img src="${itemImg(item )}" alt="">+${amount}</div>`;
    if (amount > 0 && kind !== "none" && kind !== "wither") html += `<div class="e">${esc(t("ev." + kind, { pct: bad ? Math.round(amount / PER_YIELD * 100) : 100 }))}</div>`;
    if (earned > 0) html += `<div class="hv">+${earned} 🎟️</div>`;
    el.innerHTML = html; overlay.appendChild(el); capEl = el;
    capTimer = window.setTimeout(() => { el.remove(); if (capEl === el) capEl = null; }, 1600);
  }
  /**
   * 把一张小图从 `from` 飞到 `target`。
   *
   * `target` 可以是元素 id，也可以是 `"host"` —— **飞到容器外面、正上方**
   * （宿主顶栏那一排币的位置）。2026-10-24 起兑换券由宿主顶栏显示，
   * 插件 DOM 里没有那枚胶囊了，所以卖出时朝那个方向飞出去、淡掉。
   * ⚠️ 容器是 `overflow:hidden` 的，飞过顶边会被裁掉 —— 那正好是想要的效果
   * （"券飞到上面去了"），别为此去改容器的 overflow。
   */
  function fly(src        , from                          , target                ) {
    const cr = col.getBoundingClientRect();
    let tx = 0, ty = 0;
    if (target === "host") { tx = cr.left + cr.width / 2; ty = cr.top - 20; }
    else {
      const el = document.getElementById(target); if (!el) return;
      const tr = el.getBoundingClientRect(); tx = tr.left + tr.width / 2; ty = tr.top + tr.height / 2;
    }
    const img = document.createElement("img"); img.className = "fly"; img.src = src; img.alt = "";
    const x0 = from.x - cr.left - 20, y0 = from.y - cr.top - 20;
    img.style.left = x0 + "px"; img.style.top = y0 + "px";
    overlay.appendChild(img);
    const dx = tx - cr.left - 20 - x0, dy = ty - cr.top - 20 - y0;
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transform = `translate(${dx}px,${dy}px) scale(.6)`; img.style.opacity = "0.4"; }));
    setTimeout(() => { img.remove(); if (target !== "host") bump(target); }, 600);
  }
  function flyFrom(el             , src        , targetId        ) { const r = el.getBoundingClientRect(); fly(src, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, targetId); }
  function levelCard(level        , unlocked          ) {
    const w = document.createElement("div"); w.style.cssText = "position:absolute;inset:0;pointer-events:auto";
    const names = unlocked.map(id => nm(id)).join("、");
    w.innerHTML = `<div class="scrim"></div><div class="modal" role="dialog"><img class="hero" src="${asset("ui/hat.webp")}" alt=""><h3>${esc(t("level.title", { n: level }))}</h3>${names ? `<p>${esc(t("level.unlocked", { list: names }))}</p>` : ""}<p>💩 ${esc(t("level.gift"))}</p><button class="btn y" data-x="1">${esc(t("btn.gotIt"))}</button></div>`;
    overlay.appendChild(w);
    const close = () => w.remove();
    w.querySelector("[data-x]") .addEventListener("click", close); w.querySelector(".scrim") .addEventListener("click", close);
  }

  function onEvent(e           ) {
    if (!G) return;
    const f = G.farm;
    switch (e.type) {
      case "change": refreshHud(); if (sheet && !pressing && sheet.kind !== "harvest") renderSheet(); break;
      case "toast": toast(t(e.k, { ...(e.p ?? {}), c: typeof e.p?.c === "string" ? nm(e.p.c) : "" })); break;
      case "harvested": {
        capsule(e.item, e.amount, e.kind, e.earned);
        const ps = G.plotScreen(e.plot);
        if (e.amount > 0) {
          if (e.mode === "sell" && e.earned > 0) fly(itemImg("harvest"), ps, "host");
          else fly(itemImg(e.item), ps, "rail-bag");
          if (e.mode === "store") toast(t("toast.stored", { q: qty(e.item, e.amount) }));
        }
        if (f.s.onboard < 3) { f.s.onboard = 3; f.emit({ type: "change" }); toast(t("coach.done")); coachUpdate(); }
        break;
      }
      case "collected": {
        capsule(e.item, e.amount, e.kind, 0);
        const v = G.view.animals.get(e.uid);
        if (v && e.amount > 0) fly(itemImg(e.item), G.view.toScreen(v.x, v.y - v.height()), "rail-bag");
        if (e.warded) { const an = f.animal(e.uid); toast(t("toast.warded", { c: an ? nm(an.kind) : "" })); }
        break;
      }
      case "planted": {
        if (f.s.onboard < 2) { f.s.onboard = 2; f.emit({ type: "change" }); coachUpdate(); }
        const sel = G.selectedSeed;
        if (sel && !f.wallet.canAfford(cropById(sel).seed)) { G.selectSeed(null); refreshGuide(); }
        break;
      }
      case "levelup": levelCard(e.level, e.unlocked); break;
      case "sick": { const an = f.animal(e.uid); if (an) toast(t("toast.sick", { c: nm(an.kind) })); break; }
      case "bask": { const an = f.animal(e.uid); if (an) toast(e.boost > 0 ? t("toast.basked", { c: nm(an.kind), t: fmtDur(e.boost) }) : t("toast.baskedJust", { c: nm(an.kind) })); break; }
    }
  }

  // ---------------- coach marks (onboarding) ----------------
  let coachEl                        = null, ringEl                        = null, startOpen = false;
  function coachUpdate() {
    coachEl?.remove(); coachEl = null; ringEl?.remove(); ringEl = null;
    if (!G || startOpen) return;
    const step = G.farm.s.onboard;
    if (step >= 3) return;
    if (barsHidden) { barsHidden = false; syncBars(); setTimeout(() => { G.relayout(); coachUpdate(); }, 340); return; } // 新手引导要指向栏上按钮：临时展开（不改偏好）
    let text = "", target                     = null, showOk = false;
    // 第一步不再指向 HUD 上的「＋」（那个按钮已经删了 —— 积分只能由 App 发）。
    // 所以这一步是一张**纯说明卡**，没有光圈：讲清「积分哪来的、花在哪」。
    if (step === 0) { text = t("coach.1"); showOk = true; }
    else if (step === 1) {
      text = t("coach.2");
      if (sheet?.kind === "seeds") target = document.getElementById("pick-radish");
      else if (!sheet && !G.selectedSeed) target = document.getElementById("rail-seeds");
    } else if (step === 2) { text = t("coach.3"); }
    if (sheet && sheet.kind !== "seeds") return;
    coachEl = document.createElement("div"); coachEl.className = "coach";
    coachEl.innerHTML = `<div>${esc(text)}</div><div class="acts"><button class="btn w" data-c="skip">${esc(t("btn.skip"))}</button>${showOk ? `<button class="btn y" data-c="ok">${esc(t("btn.gotIt"))}</button>` : ""}</div>`;
    const railTop = railEl.getBoundingClientRect().top - col.getBoundingClientRect().top;
    if (sheet) coachEl.style.top = "128px"; else coachEl.style.top = Math.max(130, railTop - 230) + "px";
    overlay.appendChild(coachEl);
    coachEl.querySelector("[data-c=skip]") .addEventListener("click", () => { G.farm.s.onboard = 3; G.farm.emit({ type: "change" }); coachUpdate(); });
    coachEl.querySelector("[data-c=ok]")?.addEventListener("click", () => { G.farm.s.onboard = 1; G.farm.emit({ type: "change" }); coachUpdate(); });
    if (target) {
      const cr = col.getBoundingClientRect(), r = target.getBoundingClientRect();
      ringEl = document.createElement("div"); ringEl.className = "ring";
      ringEl.style.cssText = `left:${r.left - cr.left - 6}px;top:${r.top - cr.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`;
      overlay.appendChild(ringEl);
    }
  }

  // ---------------- start card ----------------
  function startCard() {
    const f = G.farm; const now = f.now();
    const ripe = f.s.plots.filter(p => p.crop && !p.crop.dead && !p.crop.old && now >= p.crop.readyAt).length;
    const prod = f.s.animals.filter(a => f.animalInfo(a).ready > 0).length;
    const isNew = f.s.totalHarvests === 0 && f.s.animals.length === 0 && f.s.plots.every(p => !p.crop);
    const w = document.createElement("div"); w.style.cssText = "position:absolute;inset:0;pointer-events:auto";
    const render = () => {
      w.innerHTML = `<div class="scrim"></div><div class="modal" role="dialog"><img class="hero" src="${cropImg("carrot")}" alt=""><h1>${esc(t("title"))}</h1>
        <p>${esc(isNew ? t("start.new") : t("start.back"))}</p><p>${esc(isNew ? t("start.blurb") : t("start.away", { n: ripe, m: prod }))}</p>
        ${langButtons()}<button class="btn g" id="enterBtn" style="min-width:180px;font-size:18px">${esc(t("start.enter"))}</button></div>`;
      wireLangs(w);
      w.querySelector("#enterBtn") .addEventListener("click", () => { G.cue("sfx.tap"); w.remove(); startOpen = false; coachUpdate(); });
    };
    render(); startRender = render;
    startOpen = true; overlay.appendChild(w);
  }
  let startRender                      = null;

  // ---------------- hooks ----------------
  api.ui.event = onEvent;
  api.ui.harvestPrompt = (i        ) => openSheet("harvest", i);
  api.ui.needSeed = () => { toast(t("toast.pickSeed")); openSheet("seeds"); };
  api.ui.openSeedsForPlot = (i        ) => { openSheet("seeds"); pendingPlantPlot = i; };
  api.ui.animalTap = (uid        ) => openSheet("animal", uid);
  api.ui.zoneTap = (zone) => openSheet(zone, undefined, "adopt");
  api.ui.creekTap = (x, y) => { creekSpot = { x, y }; openSheet("fishing"); };
  api.onLang(() => {
    if (!G) return;
    buildHud(); buildRail(); refreshHud(); refreshGuide(); renderUnfold();
    if (sheet) renderSheet();
    if (startOpen && startRender) startRender();
    coachUpdate();
  });

  function start() {
    buildHud(); buildRail(); refreshHud(); renderUnfold();
    G.relayout();
    startCard();
    // 调试预览参数（?tod= / ?wx=）生效时给一次性提示，免得误以为游戏坏了（等开始卡片关闭后再弹，否则被遮罩挡住；文案在弹出时按当前语言组装）
    {
      const q = new URLSearchParams(location.search);
      const tod = q.get("tod"), wx = q.get("wx");
      const hasTod = tod != null && tod !== "" && !Number.isNaN(Number(tod));
      const hasWx = wx === "rain" || wx === "cloud" || wx === "sun";
      const firePreview = () => {
        if (startOpen) { setTimeout(firePreview, 700); return; }
        const parts           = [];
        if (hasTod) parts.push(t("debug.previewTod", { h: tod  }));
        if (hasWx) parts.push(t("debug.previewWx", { w: t("weather." + wx) }));
        toast(parts.join(" · "));
      };
      if (hasTod || hasWx) setTimeout(firePreview, 600);
    }
    track(setInterval(() => { refreshHud(); if (sheet && !pressing && ["ranch", "pond", "animal", "market"].includes(sheet.kind)) renderSheet(); }, 1000));
    // 插件形态下容器有 ResizeObserver 兜着，不必再监听 window（那会在宿主页面上留一个没人清的监听）
    if (!scoped) window.addEventListener("resize", () => { G.relayout(); coachUpdate(); });
  }

  // ---- 卸载登记 ----
  // 不在这里登记的话，卸载只会留下 root 节点被 remove 掉，而 style / 定时器 /
  // ResizeObserver 全都还在 —— 下次再挂载就会叠第二份样式。
  uiTeardown = () => {
    for (const id of timers) clearInterval(id);
    timers.length = 0;
    try { ro?.disconnect() } catch { /* 已断 */ }
    try { style.remove() } catch { /* 已移除 */ }
    try { root.remove() } catch { /* 已移除 */ }
  };
}
