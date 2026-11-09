#!/usr/bin/env python
"""
一次性把 sugar 的源码改成「能被宿主挂载」的形态（幂等，重复跑不叠加）。

为什么用脚本而不是一堆 Edit：
  同一个文件改 10 处，逐个 Edit 会互相覆盖（后写的基于旧内容），
  而且工具还报成功。所以这里一次性写完，并且**每处都断言锚点唯一**——
  锚点找不到就整个中止，绝不留半改状态。

改完要立刻 grep 复核（见脚本末尾的 self-check）。
"""
import io
import re
import sys

ROOT = "E:/plan/test25/task-games/sugar"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def sub1(s, old, new, what):
    """替换**恰好一处**；0 处或 >1 处都中止。"""
    n = s.count(old)
    if n != 1:
        print("SETUP FAIL [%s]: 锚点出现 %d 次（要求 1）" % (what, n))
        print("  锚点片段: %r" % (old[:120],))
        sys.exit(2)
    return s.replace(old, new)

# ============================================================ game.js
p = ROOT + "/game.js"
s = read(p)
orig_len = len(s)

# --- 1) 引入 host 层
s = sub1(
    s,
    "import { AudioMan } from './src/audio.js';",
    "import { AudioMan } from './src/audio.js';\nimport { LS, asset, installHost } from './src/host.js';",
    "import host",
)

# --- 2) 模块顶层不许读存档：语言
s = sub1(
    s,
    "let LANG         = localStorage.getItem('tz_lang') || '';",
    "// start() 里从 LS 重读 —— 模块顶层跑在 installHost() 之前，那时读不到宿主的存档\nlet LANG         = '';",
    "LANG",
)

# --- 3) localStorage -> LS（业务侧一字不改，只换标识符）
n_ls = s.count("localStorage.")
s = s.replace("localStorage.", "LS.")
if n_ls < 25:
    print("SETUP FAIL [LS 替换]: 只换到 %d 处，比预期少（源码变过？）" % n_ls)
    sys.exit(2)

# --- 4) 成长存档不能在顶层读
s = sub1(
    s,
    "const growthState = loadGrowthState();\nlet partyStages = growthState.stages;\nlet evolutionExp = growthState.exp;",
    "// start() 里重读（同上：顶层读会在注入之前）\nlet growthState = { stages: [0, 0, 0, 0, 0], exp: 0 };\nlet partyStages = growthState.stages;\nlet evolutionExp = growthState.exp;",
    "growthState",
)

# --- 5) 进化提示同理
s = sub1(
    s,
    "let evolutionReadyNoticePending = canAnyHeroEvolve() && LS.getItem(EVOLUTION_NOTICE_KEY) !== '1';",
    "let evolutionReadyNoticePending = false; // start() 里算",
    "notice",
)

# --- 6) 容器 + 尺寸基准：resizeTo 窗口 = 在宿主里画到 tab 栏底下
s = sub1(
    s,
    "async function boot()                {",
    "async function boot(mountTo        )                 {",
    "boot signature",
)
s = sub1(
    s,
    "  await app.init({ resizeTo: window, background: 0xfdf3e7, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true });\n  document.getElementById('app')?.appendChild(app.canvas);",
    "  // resizeTo 必须是**容器**，不是 window：宿主里容器比窗口小（底下有 tab 栏），\n"
    "  // 按 window 铺会画到 tab 栏底下、被裁掉一截。\n"
    "  await app.init({ resizeTo: mountTo, background: 0xfdf3e7, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true });\n"
    "  mountTo.appendChild(app.canvas);",
    "app.init",
)

# --- 7) 字体 URL 走 asset()
s = sub1(
    s,
    "new FontFace('SmileySans', \"url('assets/lib/smiley-sans/SmileySans-Oblique.woff2')\"),",
    "new FontFace('SmileySans', `url('${asset('assets/lib/smiley-sans/SmileySans-Oblique.woff2')}')`),",
    "font",
)

# --- 8) 贴图 URL 走 asset()
s = sub1(
    s,
    "aliases.forEach((a) => Assets.add({ alias: a, src: IMG[a] }));",
    "aliases.forEach((a) => Assets.add({ alias: a, src: asset(IMG[a]) }));",
    "textures",
)

# --- 9) 音频 URL 走 asset()
s = sub1(
    s,
    "  void audio.load(SND).catch((e) => console.warn('audio init failed', e));",
    "  void audio.load(SND.map((s) => ({ ...s, url: asset(s.url) }))).catch((e) => console.warn('audio init failed', e));",
    "audio urls",
)

# --- 10) resize 监听要能摘；再加 ResizeObserver（宿主里窗口不变、容器会变）
s = sub1(
    s,
    "  window.addEventListener('resize', layout);",
    "  onResize = layout;\n"
    "  window.addEventListener('resize', onResize);\n"
    "  // 宿主切 tab / 旋转屏幕时窗口未必触发 resize，但容器一定变 —— 只靠 window 会漏。\n"
    "  if (typeof ResizeObserver !== 'undefined') {\n"
    "    ro = new ResizeObserver(() => {\n"
    "      if (disposed || !app) return;\n"
    "      try { app.resize(); layout(); } catch { /* 正在销毁 */ }\n"
    "    });\n"
    "    ro.observe(mountTo);\n"
    "  }",
    "resize",
)

# --- 11) keydown 监听要能摘
s = sub1(
    s,
    "  window.addEventListener('keydown', (e) => {\n"
    "    if (e.key === 'Escape' && evolutionTabOpen) {\n"
    "      closeEvolutionTab(evolutionTabOrigin);\n"
    "      return;\n"
    "    }\n"
    "    if (e.key === 'Escape' && standalonePageOpen) return;\n"
    "    if (e.key === 'Escape' && phase !== PHASE.Title && phase !== PHASE.Over) togglePause(!paused);\n"
    "  });",
    "  onKeydown = (e) => {\n"
    "    if (e.key === 'Escape' && evolutionTabOpen) {\n"
    "      closeEvolutionTab(evolutionTabOrigin);\n"
    "      return;\n"
    "    }\n"
    "    if (e.key === 'Escape' && standalonePageOpen) return;\n"
    "    if (e.key === 'Escape' && phase !== PHASE.Title && phase !== PHASE.Over) togglePause(!paused);\n"
    "  };\n"
    "  window.addEventListener('keydown', onKeydown);",
    "keydown",
)

# --- 12) 入口：boot().then(...) -> export start(opts) + unmount
s = sub1(
    s,
    "boot().then(() => {\n  window.__debug = {",
    "// ---------- 宿主注入用的可变句柄 ----------\n"
    "let chargePlay         = null;  // (opts.chargePlay) 开局收费，插件形态才有\n"
    "let onResize         = null;\n"
    "let onKeydown         = null;\n"
    "let ro         = null;\n"
    "let disposed = false;\n"
    "\n"
    "/**\n"
    " * 挂载入口（独立网页也走它 —— `index.html` 里是 `start({ mountTo: #app })`）。\n"
    " *\n"
    " * 顺序不能改：**先装宿主，再读存档**。反过来的话 `LANG` / 成长存档 /\n"
    " * 音频偏好读到的全是默认值（模块顶层已经读过一次空存档了）。\n"
    " */\n"
    "export async function start(opts         = {})                 {\n"
    "  disposed = false;\n"
    "  installHost({ asset: opts.asset, store: opts.store });\n"
    "  LANG = LS.getItem('tz_lang') || '';\n"
    "  growthState = loadGrowthState();\n"
    "  partyStages = growthState.stages;\n"
    "  evolutionExp = growthState.exp;\n"
    "  evolutionReadyNoticePending = canAnyHeroEvolve() && LS.getItem(EVOLUTION_NOTICE_KEY) !== '1';\n"
    "  audio.reloadPrefs();\n"
    "  chargePlay = typeof opts.chargePlay === 'function' ? opts.chargePlay : null;\n"
    "\n"
    "  await boot(opts.mountTo);\n"
    "\n"
    "  window.__debug = {",
    "start()",
)

# 收尾：把 `.then()` 的 `});` 换成 return unmount
tail_old = "    lang: () => LANG,\n  };\n});"
tail_new = (
    "    lang: () => LANG,\n"
    "  };\n"
    "\n"
    "  return unmount;\n"
    "}\n"
    "\n"
    "/**\n"
    " * 卸载。**幂等**（孩子秒切 tab 时宿主会在 mount 落地的同一拍调它）。\n"
    " *\n"
    " * WebGL context 不会自己释放：不销毁的话切几次 tab 就把浏览器的\n"
    " * context 配额（通常 8~16 个）耗光，之后整个 App 白屏而且**不报错**。\n"
    " *\n"
    " * 顺序：先摘监听 → 停 ticker → 关音频 → 销毁 renderer。\n"
    " */\n"
    "async function unmount()                {\n"
    "  if (disposed) return;\n"
    "  disposed = true;\n"
    "  try { if (onKeydown) window.removeEventListener('keydown', onKeydown); } catch { /* 已摘 */ }\n"
    "  try { if (onResize) window.removeEventListener('resize', onResize); } catch { /* 已摘 */ }\n"
    "  try { ro?.disconnect(); } catch { /* 已断 */ }\n"
    "  ro = null;\n"
    "  onKeydown = null;\n"
    "  onResize = null;\n"
    "  try { app?.ticker?.stop(); } catch { /* 已停 */ }\n"
    "  try { audio.dispose(); } catch { /* 已关 */ }\n"
    "  try {\n"
    "    // 不销毁贴图：模块实例在宿主里是复用的，Assets 缓存里还是这批 Texture，\n"
    "    // 销毁了第二次挂载就会拿到「已销毁的纹理」（画面全白，且不报错）。\n"
    "    app?.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });\n"
    "  } catch { /* 已销毁 */ }\n"
    "  // ★ 调试钩子必须摘。留着的话外部判不出「卸载到底跑没跑」：\n"
    "  //   `window.__gpReady` 仍是 true ⇒ 第二次挂载的任何「等它就绪」判据立刻假通过。\n"
    "  try { delete window.__gpReady; } catch { /* 只读 */ }\n"
    "  try { delete window.__debug; } catch { /* 只读 */ }\n"
    "}"
)
s = sub1(s, tail_old, tail_new, "tail")

# 模块顶层不能再有裸 boot()
if re.search(r"^boot\(\)", s, re.M):
    print("SETUP FAIL: 还有模块顶层的 boot() 调用")
    sys.exit(2)

write(p, s)
print("game.js: %d -> %d 字节（LS 替换 %d 处）" % (orig_len, len(s), n_ls))

# ============================================================ src/audio.js
p = ROOT + "/src/audio.js"
a = read(p)
a0 = len(a)
a = sub1(
    a,
    "// WebAudio 管理：fetch+decode 预载，首次手势解锁，BGM 循环 + 暂停低通",
    "// WebAudio 管理：fetch+decode 预载，首次手势解锁，BGM 循环 + 暂停低通\nimport { LS } from './host.js';",
    "audio import",
)
n_a = a.count("localStorage.")
a = a.replace("localStorage.", "LS.")
if n_a < 6:
    print("SETUP FAIL [audio LS]: 只换到 %d 处" % n_a)
    sys.exit(2)

a = sub1(
    a,
    "  async load(list                               )                {\n    if (this.loading) return this.loading;",
    "  /** 宿主注入之后重读偏好（构造函数跑在模块顶层，那时还读不到宿主的存档） */\n"
    "  reloadPrefs()       {\n"
    "    this.musicOn = LS.getItem('tz_music') !== '0';\n"
    "    this.sfxOn = LS.getItem('tz_sfx') !== '0';\n"
    "    const v = parseFloat(LS.getItem('tz_sfxvol') || '1');\n"
    "    this.sfxVol = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;\n"
    "  }\n"
    "\n"
    "  /** 卸载：停 BGM、关 AudioContext。不关的话切几次 tab 会攒一堆 ctx。 */\n"
    "  dispose()       {\n"
    "    try { this.bgmSrc?.stop(); } catch { /* 已停 */ }\n"
    "    this.bgmSrc = null;\n"
    "    try { void this.ctx?.close(); } catch { /* 已关 */ }\n"
    "    this.ctx = null;\n"
    "    this.sfxBus = null;\n"
    "    this.bgmBus = null;\n"
    "    this.bgmFilter = null;\n"
    "    this.buffers.clear();\n"
    "    // ★ 必须清 loading：不清的话第二次挂载 load() 直接返回**旧 promise**，\n"
    "    //   音频永远不重载（症状是「切回来之后没声音」，且没有任何报错）。\n"
    "    this.loading = null;\n"
    "    this.unlocked = false;\n"
    "  }\n"
    "\n"
    "  async load(list                               )                {\n    if (this.loading) return this.loading;",
    "audio reload/dispose",
)
write(p, a)
print("audio.js: %d -> %d 字节（LS 替换 %d 处）" % (a0, len(a), n_a))

# ============================================================ 复核
print("\n=== 复核 ===")
g = read(ROOT + "/game.js")
checks = [
    ("game.js 无裸 localStorage", g.count("localStorage") == 0),
    ("game.js 有 LS 用法", g.count("LS.") >= 25),
    ("game.js 有 asset(", g.count("asset(") >= 3),
    ("game.js 导出 start", "export async function start(" in g),
    ("game.js 有 unmount", "async function unmount()" in g),
    ("game.js 不再顶层调 boot", "boot().then" not in g),
    ("game.js 用 mountTo 挂 canvas", "mountTo.appendChild(app.canvas)" in g),
    ("game.js 不再 getElementById('app')", "getElementById('app')" not in g),
    ("game.js resizeTo 容器", "resizeTo: mountTo" in g),
    ("game.js 摘 __gpReady", "delete window.__gpReady" in g),
]
au = read(ROOT + "/src/audio.js")
checks += [
    ("audio.js 无裸 localStorage", au.count("localStorage") == 0),
    ("audio.js 有 reloadPrefs", "reloadPrefs()" in au),
    ("audio.js 有 dispose", "dispose()" in au),
]
bad = [n for n, ok in checks if not ok]
for n, ok in checks:
    print(("  ok   " if ok else "  FAIL ") + n)
sys.exit(1 if bad else 0)
