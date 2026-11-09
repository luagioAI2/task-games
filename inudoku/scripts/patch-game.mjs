#!/usr/bin/env node
/**
 * 把镜像里的 `game.js` / `ui.js` 改成「能在宿主里跑」的形态。
 *
 * 用法：`node scripts/patch-game.mjs`（幂等：已经打过就跳过）
 *
 * ## 为什么要写成脚本，而不是手工改
 *
 * `game.js` / `ui.js` 是原版**压缩代码**（各 1 行）。手工改有两个后果：
 *   1. 下次从镜像重拷一份，补丁**静默消失**，而症状各不相同
 *      （没声音 / 图 404 / 切走 tab 还在跑 rAF / 不扣积分）；
 *   2. 改坏了看不出来 —— 压缩代码没有语法提示，只能靠真跑。
 *
 * 所以这里逐条做**字符串替换 + 命中次数校验**：任何一条锚点命中数不对就
 * `exit 1` 并打印锚点。`scripts/build-plugin.mjs` 还会再 grep 一遍关键标记。
 *
 * ## 前提
 *
 * `assets/` 里的 png 已经压成 webp（`compress-assets.py`）。本脚本顺手把
 * 引用后缀改过去 —— 漏改的症状是「一片 404」，而报错长得像「打包坏了」。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/** 已经打过补丁的标记 —— 有它就整体跳过（幂等） */
const MARK = 'export async function boot(){'

const G = 'game.js'
const U = 'ui.js'
const D = 'dogs.js'

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}
function write(rel, s) {
  fs.writeFileSync(path.join(ROOT, rel), s, 'utf8')
}

/**
 * 一条替换。
 * @param {string} file 相对工程根
 * @param {string} from 原文
 * @param {string} to 新文
 * @param {number} count 期望命中次数
 * @param {string} why 这条丢了会怎样
 */
const step = (file, from, to, count, why) => ({ file, from, to, count, why })

function applyAll(file, list, src) {
  let out = src
  for (const s of list) {
    const hit = out.split(s.from).length - 1
    if (hit !== s.count) {
      console.error(`\n✗ 锚点命中 ${hit} 次（要 ${s.count} 次）：${file}`)
      console.error('  锚点：', JSON.stringify(s.from.slice(0, 180)))
      console.error('  影响：', s.why)
      process.exit(1)
    }
    out = out.split(s.from).join(s.to)
  }
  return out
}

/* ============================================================
 * 阶段 0：png → webp（引用侧同步改）
 * ============================================================ */
function renameToWebp(rel) {
  let s = read(rel)
  const before = s
  s = s.replace(/assets\/[A-Za-z0-9_./-]+\.png/g, (p) => {
    const w = p.slice(0, -4) + '.webp'
    if (!fs.existsSync(path.join(ROOT, w))) {
      console.error(`\n✗ 缺 webp：${w}（先跑 compress-assets.py）`)
      process.exit(1)
    }
    return w
  })
  const left = (s.match(/assets\/[A-Za-z0-9_./-]+\.png/g) || []).length
  if (left) {
    console.error(`\n✗ ${rel} 还有 ${left} 处 .png 引用`)
    process.exit(1)
  }
  if (s !== before) {
    write(rel, s)
    return true
  }
  return false
}

/* ============================================================
 * 阶段 1：game.js
 * ============================================================ */
const G_STEPS = [
  /* ---- 1) 根节点：原版所有东西都往 `#app` 里塞 ---- */
  step(G, 'document.getElementById("app")', 'window.__inudokuRoot', 2, '舞台找不到 ⇒ 整屏空白'),

  /* ---- 1b) 把 display 句柄交出来，卸载时才能断 ResizeObserver ---- */
  step(
    G,
    '});Ut.attachPixi(p);',
    '});window.__inudokuDisplay=Ut;Ut.attachPixi(p);',
    1,
    '卸载后 RO 还活着 ⇒ 退出游戏再转屏就抛 `reading screen`（Pixi renderer 已为 null）',
  ),

  /* ---- 2) 资源绝对地址（插件在 blob: 里跑，相对路径必 404） ---- */
  step(G, 'c.Assets.load("assets/paper.webp")', 'c.Assets.load(window.__inudokuAsset("assets/paper.webp"))', 1, '纸纹背景 404'),
  step(G, 'c.Assets.load("assets/pencil-tile.webp")', 'c.Assets.load(window.__inudokuAsset("assets/pencil-tile.webp"))', 1, '格子底纹 404 ⇒ 棋盘全白'),
  step(G, 'c.Assets.load(i.sheet)', 'c.Assets.load(window.__inudokuAsset(i.sheet))', 1, '狗耳朵精灵图 404 ⇒ 狗狗画不出来'),
  step(G, 'fetch(i.manifest)', 'fetch(window.__inudokuAsset(i.manifest))', 1, '狗耳朵帧清单 404 ⇒ Pe() 抛 Dog unavailable'),
  step(G, 'manifestUrl:"./sound.manifest.json"', 'manifestUrl:window.__inudokuAsset("sound.manifest.json")', 1, '音频清单 404 ⇒ 全程无声'),
  step(
    G,
    'coinIcon:()=>"assets/ui/icon_coin_selected.svg"',
    'coinIcon:()=>window.__inudokuAsset("assets/ui/icon_coin_selected.svg")',
    1,
    '金币图标 404（少一枚小图，不报错）',
  ),
  step(G, '()=>Z(t.dog).image', '()=>window.__inudokuAsset(Z(t.dog).image)', 1, '设置页 / 结算页的狗头图 404'),
  step(G, 'secretImage:()=>Z(O).image', 'secretImage:()=>window.__inudokuAsset(Z(O).image)', 1, '秘密皮肤的预览图 404'),

  /* ---- 3) 字体：不再回落 CDN ---- */
  step(
    G,
    'const e=gp.fonts?.url?.("open-huninn/OpenHuninn.woff2")||"https://static.makeplay.ai/fonts/v1/open-huninn/OpenHuninn.woff2";new FontFace("InudokuHand",`url("${e}")`).load().then(n=>document.fonts.add(n)).catch(()=>{})',
    'const e=gp.fonts?.url?.("open-huninn/OpenHuninn.woff2");if(e){try{new FontFace("InudokuHand",`url("${e}")`).load().then(n=>document.fonts.add(n)).catch(()=>{})}catch{}}',
    1,
    '每次开局向 static.makeplay.ai 要 2 MB 字体（离线 / 内网直接卡住）',
  ),

  /* ---- 4) 语言：首次进入用宿主语言 ---- */
  step(
    G,
    'gp.player.saves.latestSync||(t.lang=C(navigator.language))',
    'gp.player.saves.latestSync||(t.lang=gp.__locale||C(navigator.language))',
    1,
    '首次进入按浏览器语言，而不是宿主语言',
  ),

  /* ---- 5) 画面方向 ---- */
  step(
    G,
    'const Ut=Bt({orientation:"portrait",onResize:()=>ot()})',
    'const Ut=Bt({orientation:"both",onResize:()=>ot()})',
    1,
    '声明 portrait 后宽屏会被判「需要旋转」',
  ),

  /* ---- 6) pagehide 与 unmount 双重 dispose ---- */
  step(G, 'e.persisted||(S.dispose(),u.dispose())', 'e.persisted||window.__inudokuDead||(S.dispose(),u.dispose())', 1, 'pagehide 与 unmount 双重 dispose ⇒ 报错'),

  /* ---- 7) 商店：没有支付，改成通关解锁 ---- */
  step(
    G,
    'Ht(n)?Mt(n):s.breedNotice("secretLocked")',
    's.breedNotice("skinLocked")',
    1,
    '点没解锁的狗会走「购买」⇒ 弹「暂时无法购买」',
  ),
  step(
    G,
    'Ae(t.ownedBgm,n)?Ve(n):St(n)',
    'Ae(t.ownedBgm,n)?Ve(n):(s.setMessage("bgmLocked"),s.renderModal())',
    1,
    '点没解锁的曲子会走「购买」⇒ 弹「暂时无法购买」',
  ),

  /* ---- 8) 存档里的 skins 标记 ---- */
  step(
    G,
    'let t=Ye(gp.player.saves.latestSync)||de();',
    'let t=Ye(gp.player.saves.latestSync)||de();t.skins=!0;',
    1,
    'parseSave 会把 skins!==true 的存档当成「所有狗都已拥有」⇒ 解锁进度作废',
  ),

  /* ---- 9) 每帧刷新后跑一次解锁检查 ---- */
  step(G, 'function x(){L(),Ge(),Be()}', 'function x(){__grant(),L(),Ge(),Be()}', 1, '通关不解锁皮肤 / BGM'),
]

/* ---- 10) 扣分闸：qe（换关 / 下一关 / 重来） ---- */
const CHARGE_FROM =
  '(e==="retry"||e==="level"||e==="next")&&(ke(),t=de(e==="next"?Math.min(Q.length-1,t.level+1):e==="level"?i:t.level,t)),x()'
const CHARGE_TO = [
  'await (async()=>{',
  '  if(!(e==="retry"||e==="level"||e==="next"))return;',
  '  const __lv=e==="next"?Math.min(Q.length-1,t.level+1):e==="level"?i:t.level;',
  '  if(e!=="retry"&&!await __payFor(__lv))return;',
  '  ke(),t=de(__lv,t),x();',
  '})()',
].join('\n')

/* ---- 11) 扣分闸：标题页那颗「关卡 N」按钮走的是 `play`，不是 `qe` ---- */
const PLAY_FROM = 'if(e==="play"){be(!1),y=!1,u.playCue("paper.tap")'
const PLAY_TO = 'if(e==="play"){if(!await __payFor(t.level))return;be(!1),y=!1,u.playCue("paper.tap")'

/* ---- 12) 解锁函数 + 扣分函数（插在 boot 开头） ---- */
const HEAD = `
/* 回收 window 监听：每次挂载 8 个，不摘就会越积越多 */
const __wins=[];
const __addW=function(){const __a=Array.prototype.slice.call(arguments);window.addEventListener(__a[0],__a[1],__a[2]);__wins.push(__a)};

/**
 * 新开一关要不要扣积分。返回 false = 不开局。
 *
 * 三条豁免：
 *   · 已通关的关卡重玩（cleared 里有）
 *   · 这一关已经付过（t.paid 里的 lv:<n>）
 *   · 失败重来走的是 retry，根本不进这里
 */
async function __payFor(lv){
  const key="lv:"+lv;
  const paid=Array.isArray(t.paid)?t.paid:[];
  if(paid.includes(key))return true;
  if(Array.isArray(t.cleared)&&t.cleared.includes(lv))return true;
  const ok=window.__inudokuCharge?await window.__inudokuCharge(lv):true;
  if(!ok)return false;
  t.paid=[...paid,key].slice(-80);
  return true;
}

/* 通关解锁：主线 + 进阶都算。判据只看「已通关数」—— 这款没有内购。 */
function __grant(){
  const __c=Array.isArray(t.cleared)?t.cleared:[];
  const __a=Array.isArray(t.advCleared)?t.advCleared:[];
  const __done=new Set([...__c,...__a]).size;
  const __dogs=[["maltese",5],["poodle",10],["dachshund",15],["pug",20],["schnauzer",25],["doberman",30]];
  for(const __p of __dogs){
    if(__done>=__p[1]&&!(t.owned||[]).includes(__p[0])) t.owned=[...(t.owned||[]),__p[0]].slice(-40);
  }
  const __bgms=[["paperwalk",4],["dusk",8],["sunny",12]];
  for(const __p of __bgms){
    if(__done>=__p[1]&&!(t.ownedBgm||[]).includes(__p[0])) t.ownedBgm=[...(t.ownedBgm||[]),__p[0]].slice(-10);
  }
}
`

/* ---- 13) teardown（追加在 boot 末尾） ---- */
/*
 * ★ 顺序是「先断回调、再销毁」：
 *   `mountDisplay` 挂了一个 `ResizeObserver`，它 `kick` 到 `onResize`，
 *   而 `onResize` 里是 `ot()`（后来被赋成 `Te`，`Te` 会读 `p.screen`）。
 *   `p.destroy()` 之后 Pixi 的 `renderer` 变 null ⇒ `p.screen` 抛
 *   `Cannot read properties of null (reading 'screen')`。
 *   触发时机是「退出游戏之后再拖窗口 / 转屏」—— 这时候游戏已经不在屏幕上，
 *   报错落在宿主页面里，看着像宿主坏了。
 *   ⇒ ① `ot` 换回空函数 ② `display.dispose()` 断掉 RO 和 visualViewport 监听
 *     ③ 最后才销毁 Pixi。
 */
const TAIL = `
window.__inudokuTeardown=function(){
  window.__inudokuDead=!0;
  try{for(const __a of __wins)window.removeEventListener(__a[0],__a[1],__a[2])}catch(e){}
  try{ot=()=>{}}catch(e){}
  try{window.__inudokuDisplay?.dispose()}catch(e){}
  try{window.__inudokuDisplay=null}catch(e){}
  try{S.dispose()}catch(e){}
  try{u.dispose()}catch(e){}
  try{p.destroy(true,{children:!0,texture:!1,textureSource:!1})}catch(e){}
};
`

/* ============================================================
 * 阶段 2：ui.js
 * ============================================================ */
const U_STEPS = [
  /*
   * 3 处 `document.getElementById("app")`：
   *   ① `.notebook` 那一层  ② 首页 `.home-screen`  ③ 弹窗 `.backdrop`
   * 漏掉 ②③ 的症状很怪：标题页能出来，一进关卡 / 一开设置就 TypeError
   * —— 因为那时才第一次去取 `#app`。所以按 3 次校验。
   */
  step(U, 'document.getElementById("app")', 'window.__inudokuRoot', 3, 'ui.js 的 UI 层 / 首页 / 弹窗挂到宿主节点上'),
  /*
   * 自带 CSS 要收进自己的根节点（`css-scope.js`）。
   * 不收的症状：`:root` 改掉宿主变量、`body` 换掉整个 App 的字体和字色，
   * 而且这份 <style> 排在宿主样式**之后**，同优先级下它赢 ⇒ 一进游戏整个 App 变样。
   */
  step(U, 'V.textContent=`', 'V.textContent=window.__inudokuScopeCss(`', 1, '自带 CSS 会污染宿主（:root / body / 通用类名）'),
  step(U, '\n`,document.head.appendChild(V)', '\n`),document.head.appendChild(V)', 1, '自带 CSS 会污染宿主（模板串没收尾）'),
  step(
    U,
    "url('assets/paper.webp')",
    "url('${window.__inudokuAsset(\"assets/paper.webp\")}')",
    1,
    '弹窗纸纹 404（弹窗变纯色，不报错）',
  ),
  step(
    U,
    'src="assets/lib/kenney-new-platformer/tiles/hud_heart.webp"',
    'src="${window.__inudokuAsset("assets/lib/kenney-new-platformer/tiles/hud_heart.webp")}"',
    1,
    '三颗心的图标 404 ⇒ 生命条空着',
  ),
  step(U, '$=c=>x[c.key]||c.icon||""', '$=c=>window.__inudokuAsset(x[c.key]||c.icon||"")', 1, '成就图标 404 ⇒ 全是「?」'),
  step(
    U,
    'document.documentElement.lang=C(t.lang),document.documentElement.dir="ltr",document.title="犬独 ～INUDOKU～",',
    'window.__inudokuStandalone&&(document.documentElement.lang=C(t.lang),document.documentElement.dir="ltr",document.title="犬独 ～INUDOKU～"),',
    1,
    '宿主的 <html lang> 和标题被游戏改掉，卸载后也不还原',
  ),
]

/* ============================================================
 * 执行
 * ============================================================ */
const g0 = read(G)
if (g0.includes(MARK)) {
  console.log('已经打过补丁（game.js 里已有 boot()），跳过。')
  process.exit(0)
}

/* 0) 后缀 */
for (const f of [G, U, D]) {
  if (renameToWebp(f)) console.log(`· ${f} 的图片引用已改到 .webp`)
}

/* 1) 逐条替换 */
let g = applyAll(G, G_STEPS, read(G))
let u = applyAll(U, U_STEPS, read(U))

/* 2) 扣分闸（qe） */
{
  const hit = g.split(CHARGE_FROM).length - 1
  if (hit !== 1) {
    console.error(`\n✗ 扣分闸锚点命中 ${hit} 次（要 1 次）`)
    console.error('  锚点：', JSON.stringify(CHARGE_FROM))
    process.exit(1)
  }
  g = g.split(CHARGE_FROM).join(CHARGE_TO)

  const fn = 'function qe(e,i){'
  if (g.split(fn).length - 1 !== 1) {
    console.error('\n✗ 找不到 `function qe(e,i){`（要 1 次）')
    process.exit(1)
  }
  g = g.split(fn).join('async function qe(e,i){')
}

/* 3) 扣分闸（play）—— 标题页那颗「关卡 N」 */
{
  const hit = g.split(PLAY_FROM).length - 1
  if (hit !== 1) {
    console.error(`\n✗ play 闸锚点命中 ${hit} 次（要 1 次）`)
    console.error('  锚点：', JSON.stringify(PLAY_FROM))
    process.exit(1)
  }
  g = g.split(PLAY_FROM).join(PLAY_TO)

  /* `rn` 里 await 了，它本身必须是 async */
  const fn = 'function rn(e,i){'
  if (g.split(fn).length - 1 !== 1) {
    console.error('\n✗ 找不到 `function rn(e,i){`（要 1 次）')
    process.exit(1)
  }
  g = g.split(fn).join('async function rn(e,i){')
}

/* 4) window 监听改可回收 */
{
  const n = g.split('window.addEventListener(').length - 1
  if (n !== 8) {
    console.error(`\n✗ window.addEventListener 有 ${n} 处（要 8 处）`)
    process.exit(1)
  }
  g = g.split('window.addEventListener(').join('__addW(')
}

/* 5) 包进 boot() */
const IMP_END = 'from"./dog-metrics.js";'
{
  const at = g.indexOf(IMP_END)
  if (at < 0) {
    console.error('\n✗ 找不到 import 段结尾 `from"./dog-metrics.js";`')
    process.exit(1)
  }
  const cut = at + IMP_END.length
  const imports = g.slice(0, cut)
  const body = g.slice(cut)
  if (/\bimport\s*[({]/.test(body) || /\bimport\s+["']/.test(body)) {
    console.error('\n✗ 函数体里还有 import（只能在顶层）')
    process.exit(1)
  }
  g = `${imports}\n${MARK}\n${HEAD}${body}${TAIL}}\n`
}

write(G, g)
write(U, u)

console.log('✓ game.js 已改造（boot() 包裹 + 根节点 / 资源 / 扣分闸 / 解锁 / teardown）')
console.log('✓ ui.js 已改造（根节点 ×3 / 纸纹 / 心形 / 成就图标 / 不改宿主标题）')
