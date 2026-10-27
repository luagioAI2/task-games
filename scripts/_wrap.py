#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""一次性：把 game.js 的模块体整个包进 `export async function start(opts)`。

为什么不是手改：文件 800 行全是模块顶层语句（`document.getElementById('app')`、
`requestAnimationFrame(frame)`、监听器、贴图加载都在顶层）。逐行手改必错，
机械包裹 + 断言更可靠。

包裹之后再做这几处「形态注入」的替换（都带唯一性断言）：
  1. 根节点 `#app` → `opts.mountTo`；`mountDisplay` 显式给 `host`（不给就量整个视口）
  2. 存档 `gp.player.saves` → `store`（宿主 storage / localStorage 同一接口）
  3. 音频清单走 `asset()` + `baseUrl`（清单在包根，不在 assets/）
  4. 贴图 `im.src = asset(src)`
  5. `startLevel` 变 async：进一关扣一次票（同一关重玩不再扣）
  6. rAF / 监听器 / 定时器加 `alive` 守卫；`return unmount`
  7. `__gpReady` / `__gpPlayable` → 只读调试桥 `window.__sweetspin`
"""
import io
import re

P = 'game.js'
src = io.open(P, encoding='utf-8', newline='').read()
assert 'export async function start' not in src, '已经包过了，别重复跑'

# ---------- 0. 头部 import：补 i18n 的开关 + 存档适配层 ----------
src = src.replace(
    "import { t, setLang, getLang, detectLang,           } from './i18n.js';",
    "import { t, setLang, getLang, detectLang, setDocumentSideEffects,           } from './i18n.js';\nimport { makeLocalStore } from './src/host.js';",
    1,
)
assert 'makeLocalStore' in src, 'import 没插进去'

DOC = '''
/**
 * 旋转灯泡 · 游戏本体（原版 Sweet Spin）
 *
 * ## 为什么整个文件是一个函数
 *
 * 原版是「一个网页」：模块顶层直接取 `#app`、建 canvas、挂监听、起 rAF。
 * 插件形态下这套不成立 —— 宿主只 `import()` 一次这个模块，然后**反复调用 `mount()`**
 * （切 tab / StrictMode 双挂载）。模块顶层的状态会跨挂载泄漏：第二个 canvas 挂在
 * 已经摘掉的容器旁边、监听器翻倍（点一下转两格）、存档是上一次的内存快照。
 *
 * 所以：**一次挂载 = 一次 `start()` 调用**，所有状态都是这次调用的局部变量。
 * 返回值是卸载函数，宿主会 `await` 它。
 *
 * ## 两种形态的差别全部从 `opts` 注入
 *
 * | | `index.html` | `plugin.js` |
 * | --- | --- | --- |
 * | 容器 | 不传（`#app`） | `mount(container)` 给的那个 |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl()` |
 * | 音频 | 不传（默认 `./sound.manifest.json`） | `manifestUrl` + `baseUrl`（清单在**包根**） |
 * | 存档 | 不传（`localStorage`） | `host.storage` → `makeHostStore()` |
 * | 进关收费 | 不传（不收费） | `chargePlay()` |
 * | `<html lang>` | 跟着语言改 | **不改**（那是宿主的） |
 *
 * 于是这里没有任何 `if (isPlugin)` 分支 —— 那种分支会随版本漂移，
 * 而且两种形态的测试永远只有一种被跑到。
 *
 * ## 经济：C 型（纯玩），收费点在「进一关」
 *
 * ```
 *   积分 ──进一关 10 分──▶ 一关 ──▶ 星星（游戏存档里，换不成任何东西）
 * ```
 *
 * · 关卡盘上点一个没打过的格子 / 点「下一关」 ⇒ 扣 10
 * · 同一关点「再玩一次」⇒ **不扣**（这一关在本局已经买过）
 * · 从关卡盘退出来再点同一关 ⇒ 也不扣（同一个 `paidLevel`）
 * · 通关不发兑换券（`expectedPayout: 0`）：星星是「三星/关」的评级，
 *   硬接一条产出线会把它变成刷分工具
 *
 * ## 原版删掉的两块（见 `scripts/_strip.py`）
 *
 * 1. **提示内购**（`gp.pay.purchase`，1 平台币 = 5 次提示）：宿主没有能写正数的接口。
 *    提示本身保留（开局 3 次 / 首次通关 +1 / 上限 9），它是纯游戏内资源。
 * 2. **在线排行榜**（`gp.player.topScores` + 头像 + 登录）：要账号、要服务端，宿主都没有。
 *    结算面板那一行改成「总星星 n」。
 */

'''

PROLOGUE = '''  // ---------- 形态注入 ----------
  /** 挂到哪儿：插件给容器，独立网页退回 `#app` */
  const mountTo = opts.mountTo || document.getElementById('app') || document.body;
  const isPlugin = !!opts.mountTo;
  /** 包内相对路径 → 可加载的绝对地址（插件里是 `<包根>/assets/…`） */
  const asset = typeof opts.asset === 'function' ? opts.asset : (p) => p;
  /** 包根（带尾斜杠），`sound-1.js` 的 `baseUrl` 用 */
  const assetBase = typeof opts.assetBase === 'string' ? opts.assetBase : '';
  /** 同步接口的存档（`getItem` / `setItem` / `flush`） */
  const store = opts.store || makeLocalStore('sweetspin');
  /** 进一关的扣费闸门；独立网页形态直接放行 */
  const chargePlay = typeof opts.chargePlay === 'function' ? opts.chargePlay : async () => true;

  // 插件形态下不许动宿主的 <html lang>（那是宿主页面的）
  setDocumentSideEffects(!isPlugin);

  // ---------- 卸载守卫 ----------
  let alive = true;
  /** 扣费进行中（防连点扣两次） */
  let charging = false;
  /** 本次挂载挂上的监听，卸载时逐个摘 */
  const listeners = [];
  const on = (t2, f, o) => { t2.addEventListener(f, o); listeners.push([t2, f, o]); };
  /** 本次挂载起的定时器（过关面板那 650ms 的延迟） */
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
  /** 本局已经付过钱的那一关（同一关重玩不再扣） */
  let paidLevel = 0;

'''

NEW_SAVE = '''// ---------- save ----------
/**
 * 存档形状：`unlocked` / `stars[100]` / `hints` / `lang` / `muted` / `cur`（未完成的一关）。
 *
 * ★ `store` 是**同步**接口（内存缓存 + `flush()` 落盘），所以这里到处同步调 `persist()`
 *   不会把「点一下按钮」拆成两帧。卸载时 `await store.flush()` 一次。
 */
function defaultSave()       {
  return { v: 1, unlocked: 1, stars: new Array(TOTAL).fill(0), hints: 3, lang: null, muted: false, cur: null };
}
let save       = defaultSave();
try {
  const raw = store.getItem('save');
  const s = raw ? JSON.parse(raw) : null;
  if (s && s.v === 1 && Array.isArray(s.stars)) save = { ...defaultSave(), ...s };
} catch { /* 存档坏了就当新档，不要卡住挂载 */ }
function persist() {
  try { store.setItem('save', JSON.stringify(save)); } catch { /* ignore */ }
}
/** 累计星星（0~300）：结算面板与调试桥都用它 */
function totalStars() { return save.stars.reduce((a, b) => a + b, 0); }
setLang(save.lang ?? detectLang());

'''

NEW_BOOT = '''// ---------- boot ----------
render(0);
const rafId = requestAnimationFrame(frame);
void ready;

// 贴图全部落地后才从「加载中」切到关卡盘（原版就是这一步，包裹时别丢）
Promise.all(Object.entries(IMG_SRC).map(([key, src]) => new Promise((res) => {
  const im = new Image();
  im.onload = im.onerror = () => { loaded++; res(); };
  im.src = asset(src); imgs[key] = im;
}))).then(() => {
  if (!alive) return;
  ready = true;
  // 永远从关卡盘进；没打完的那一关等孩子点它才恢复
  const focus = save.cur && save.cur.level >= 1 && save.cur.level <= save.unlocked ? save.cur.level : Math.min(save.unlocked, TOTAL);
  page = Math.floor((focus - 1) / 20); screen = 'levels';
  render(0);
});
'''

UNMOUNT = '''
  // ---------- 只读调试桥 ----------
  /**
   * e2e / 截图脚本用：整屏都是 canvas 画的，没有选择器可点。
   * `buttons()` 给的是**容器内 CSS 像素**（`mountDisplay` 把 canvas 的样式尺寸
   * 定成容器尺寸、绘制时再乘 resolution），所以 e2e 直接 `box.x + b.x` 就能点。
   *
   * ★ 卸载时必须删掉（比对对象同一性），否则第二次挂载的「已就绪」判据
   *   会被上一次留下的对象骗过去。
   */
  const debugBridge = {
    ready: true,
    state: () => ({
      screen, level, moves, won, showWin, hints: save.hints, unlocked: save.unlocked,
      stars: save.stars.slice(), totalStars: totalStars(), page, muted: save.muted,
      lang: getLang(), tiles: tiles.map((tl) => ({ x: tl.x, y: tl.y, kind: tl.def.kind, powered: !!tl.powered })),
    }),
    buttons: () => btns.map((b) => ({ label: b.label || '', x: b.x, y: b.y, w: b.w, h: b.h })),
    /** e2e 想直接进某一关时用（会走同一道扣费闸门） */
    startLevel: (n) => startLevel(n, true),
  };
  window.__sweetspin = debugBridge;

  return async function unmount() {
    alive = false;
    if (rafId) cancelAnimationFrame(rafId);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const [t2, f, o] of listeners) { try { t2.removeEventListener(f, o); } catch { /* ignore */ } }
    listeners.length = 0;
    try { display.dispose(); } catch { /* ignore */ }
    try { await sound?.dispose?.(); } catch { /* ignore */ }
    if (window.__sweetspin === debugBridge) delete window.__sweetspin;
    try { canvas.remove(); } catch { /* ignore */ }
    await store.flush?.();
  };
}
'''

lines = src.split('\n')
last_import = max(i for i, l in enumerate(lines) if l.startswith('import '))
head = lines[: last_import + 1]
body = lines[last_import + 1:]
while body and body[-1] == '':
    body.pop()
for l in body:
    assert not l.startswith('import '), 'body 里还有 import：' + l
    assert not re.match(r'^export\s', l), 'body 里还有 export：' + l

ind = [('  ' + l) if l.strip() else l for l in body]
wrapped = '\n'.join(ind)

# ---------- 形态注入的替换（在缩进后的文本上做，锚点带 2 空格前缀） ----------
def sub(a, b, label):
    global wrapped
    assert wrapped.count(a) == 1, '锚点出现 %d 次（应为 1）：%s' % (wrapped.count(a), label)
    wrapped = wrapped.replace(a, b)


sub('  const host = document.getElementById(\'app\') ;',
    '  const host = mountTo ;', 'root')

sub("  const display = mountDisplay({ orientation: 'portrait', onResize:",
    "  const display = mountDisplay({ orientation: 'portrait', host, onResize:", 'display-host')

sub("  loadSoundSystem({ manifestUrl: './sound.manifest.json' })",
    "  loadSoundSystem({ manifestUrl: asset('sound.manifest.json'), baseUrl: assetBase })", 'sound')

sub('    im.src = src; imgs[key] = im;', '    im.src = asset(src); imgs[key] = im;', 'img-src')

# 存档块整段替换（用两个分节标记夹住，避免去猜那些带空格的类型残留）
i = wrapped.find('  // ---------- save ----------')
j = wrapped.find('  // ---------- sound ----------')
assert 0 <= i < j, 'save 分节标记找不到'
wrapped = wrapped[:i] + '\n'.join(('  ' + l) if l.strip() else l for l in NEW_SAVE.split('\n')) + wrapped[j:]

# 启动尾巴整段替换
i = wrapped.find('  // ---------- boot ----------')
assert i > 0, 'boot 分节标记找不到'
wrapped = wrapped[:i] + '\n'.join(('  ' + l) if l.strip() else l for l in NEW_BOOT.split('\n'))

# 监听器改走 on()，卸载时才能摘
sub("  window.addEventListener('pagehide', () => { void sound?.dispose(); }, { once: true });",
    "  on(window, 'pagehide', () => { void sound?.dispose(); });", 'pagehide')
sub('  canvas.addEventListener(\'pointerdown\', onPointerDown);',
    "  on(canvas, 'pointerdown', onPointerDown);", 'pointerdown')
sub("  window.addEventListener('keydown', (e) => {",
    "  on(window, 'keydown', (e) => {", 'keydown')

# 进关扣费：startLevel 变 async，同一关只扣一次
sub('  function startLevel(n        , resume = false) {',
    '''  /**
   * 进一关。**扣费就在这里** —— 关卡盘点格子、「下一关」、「再玩一次」都过这一个函数。
   *
   * `n !== paidLevel` 才扣：同一关在本局重玩不再收（`再玩一次` 走的就是这条），
   * 换一关就重新收一次。`charging` 挡住连点（`await` 期间再点不会扣两次）。
   */
  async function startLevel(n        , resume = false) {
    if (n !== paidLevel) {
      if (charging) return;
      charging = true;
      let ok = false;
      try { ok = await chargePlay(); } catch { ok = false; }
      charging = false;
      if (!alive || !ok) return;
      paidLevel = n;
    }''', 'startLevel')

# 过关面板的 650ms 延迟改走 later()（卸载后不许再弹）
sub("    setTimeout(() => { showWin = true; for (let i = 0; i < 3; i++) burst(W / 2 + (i - 1) * 90, H * 0.35, 24, ['#ff8fb8', '#ffd25e', '#6ec3ff', '#8be38a', '#b896ff']); }, 650);",
    "    later(() => { showWin = true; for (let i = 0; i < 3; i++) burst(W / 2 + (i - 1) * 90, H * 0.35, 24, ['#ff8fb8', '#ffd25e', '#6ec3ff', '#8be38a', '#b896ff']); }, 650);", 'win-timer')

# 关卡盘里的局部变量改名，别和外层的 totalStars() 撞名（TDZ 会炸得很隐蔽）
sub('  const totalStars = save.stars.reduce((a, b) => a + b, 0);',
    '  const starsTotal = save.stars.reduce((a, b) => a + b, 0);', 'levels-local-stars')
sub('  inkText(`${totalStars} / 300`', '  inkText(`${starsTotal} / 300`', 'levels-local-stars-use')

# 帧循环加守卫
sub('  function frame(now        ) {',
    '  function frame(now        ) {\n    if (!alive) return;', 'frame-guard')

out = '\n'.join(head) + '\n' + DOC + 'export async function start(opts = {}) {\n' + PROLOGUE + wrapped + UNMOUNT

io.open(P, 'w', encoding='utf-8', newline='').write(out)
print('包裹完成：%d 行 → %d 行' % (len(lines), out.count('\n') + 1))
