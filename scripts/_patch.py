#!/usr/bin/env python3
"""blockfit · game.js 改造补丁（一次性，跑完即留档）

为什么用脚本而不是十几次手工 Edit：
  · game.js 里大量「被删掉的注释留下的一整行空格」，手工 Edit 的 old_string 极易对不上；
  · 十几处改动分散在 2000 行里，逐处 Edit 容易漏、也容易互相覆盖；
  · 脚本可以对每个锚点**断言只命中一次**，命中 0 次或 2 次直接中止（不写盘）。

用法：python scripts/_patch.py            # 应用
      python scripts/_patch.py --check    # 只检查锚点，不写盘
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "game.js"

src = GAME.read_text(encoding="utf-8")
orig_len = len(src)
applied = []


def sub1(name, pattern, repl, flags=0):
    """断言 pattern 在全文恰好命中 1 次，然后替换。"""
    global src
    hits = len(re.findall(pattern, src, flags))
    if hits != 1:
        print(f"✗ [{name}] 锚点命中 {hits} 次（要求 1 次）")
        sys.exit(1)
    src = re.sub(pattern, lambda m: repl, src, count=1, flags=flags)
    applied.append(name)


def cut_fn(name, header):
    """按大括号配平删掉一个顶层函数（含前面的 JSDoc 注释）。"""
    global src
    i = src.find(header)
    if i < 0:
        print(f"✗ [{name}] 找不到 {header!r}")
        sys.exit(1)
    if src.count(header) != 1:
        print(f"✗ [{name}] {header!r} 出现 {src.count(header)} 次")
        sys.exit(1)
    j = src.index("{", i + len(header))
    depth = 0
    k = j
    while k < len(src):
        c = src[k]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    end = k + 1
    while end < len(src) and src[end] == "\n":
        end += 1
    src = src[:i] + src[end:]
    applied.append(name)


# ============================================================ 1. 分享（整块删）
sub1(
    "删 gpShare 常量",
    r"// ---------- share \(gp\.share is not in the typed contract yet\) ----------\n(?:.*\n)*?const gpShare.*\n\n",
    "// 分享（`gp.share`）与在线排行榜已删：宿主里既没有分享目标，也没有账号体系。\n"
    "// 相关按钮整块拆掉，不留「点了必然失败」的入口。\n\n",
)
cut_fn("删 captureShare()", "async function captureShare()")
cut_fn("删 addShareRow()", "function addShareRow(")

sub1(
    "结局页去掉分享按钮",
    r"  if \(gpShare && gpShare\.available !== false && typeof gpShare\.image === \"function\"\) \{\n"
    r".*?\n  \} else \{\n    menuB\.position\.set\(\(W - bw\) / 2, H \* 0\.87\);\n  \}\n",
    "  // 没有分享按钮 ⇒ 「菜单」居中\n"
    "  menuB.position.set((W - bw) / 2, H * 0.87);\n",
    re.S,
)

sub1("删 addShareRow 调用", r"  addShareRow\(panel, 296 - 8, T\.shareClear\(qIndex \+ 1, moves\)\);\n", "")

sub1(
    "计时结算页去掉分享按钮",
    r"  if \(gpShare\?\.image && gpShare\.available !== false\) \{\n"
    r".*?\n  \}\n  openOverlay\(panel\);\n\}\n",
    "  openOverlay(panel);\n}\n",
    re.S,
)

# ============================================================ 2. 在线排行榜
sub1(
    "删在线成绩提交",
    r"  const rankT = text\(\"\", 14, left, wide \? 193 : 402\);\n"
    r"  const shouldSubmit = !taRun\.submitted;\n"
    r"  taRun\.submitted = true;\n"
    r"  void \(async \(\) => \{\n.*?\n  \}\)\(\);\n",
    "  // 在线成绩提交已删（宿主里没有账号体系）\n",
    re.S,
)

sub1(
    "排行榜去掉两个页签",
    r"  const tabW = Math\.min\(180, \(W - 44\) / 2\);\n"
    r"  const tl = mkButton\(T\.localRanking.*?\n  sceneRoot\.addChild\(tl, to\);\n",
    "  // 只剩「本机排行榜」一个榜，不再有页签（在线榜已删）\n"
    "  const tabW = Math.min(220, W - 44);\n"
    "  const tl = mkButton(T.localRanking, tabW, 48, () => { rankTab = \"local\"; buildRanking(); }, { small: true, fill: 0xdcf1ec });\n"
    "  tl.position.set((W - tabW) / 2, 116);\n"
    "  sceneRoot.addChild(tl);\n",
    re.S,
)

sub1(
    "榜说明文案固定为本机",
    r"const scope = mkText\(rankTab === \"local\" \? T\.taScope : T\.taOnlineNote, 14\);",
    "const scope = mkText(T.taScope, 14);",
)

sub1(
    "删在线榜分支",
    r"  if \(rankTab === \"local\"\) \{\n    const ranked = localRanking\(\).*?\n  \}\n\}\n\n/\*\* entry from the title:",
    "  const ranked = localRanking().filter((p) => p.ta1Best !== null).slice(0, 10);\n"
    "  if (!ranked.length) {\n"
    "    const t = mkText(T.noRuns, 15, 0x9a958a);\n"
    "    t.anchor.set(0.5); t.position.set(W / 2, ly + rowH * 1.5);\n"
    "    sceneRoot.addChild(t);\n"
    "  } else ranked.forEach((p, i) => addRow(i, p.name, fmtTime(p.ta1Best ?? 0), p.id === save.curProfile, `${p.ta1Runs.length} ${T.runs}`));\n"
    "}\n\n/** entry from the title:",
    re.S,
)

# ============================================================ 3. 宿主适配
sub1(
    "boot() → start(opts)",
    r"async function boot\(\)                \{\n"
    r"  const host = document\.getElementById\(\"app\"\)               ;\n"
    r"  app = new PIXI\.Application\(\);\n",
    "/**\n"
    " * 启动。独立网页（`index.html`）和插件调的是**同一个函数**，差别全部通过 `opts` 注入 ——\n"
    " * 所以这里没有任何 `if (isPlugin)` 分支（那种分支会随版本漂移，且两种形态永远只有一种被跑到）。\n"
    " *\n"
    " * @param {{ container?: HTMLElement, store?: any, assetBase?: string, chargePlay?: () => Promise<boolean> }} [opts]\n"
    " * @returns {Promise<() => void>} 卸载函数\n"
    " */\n"
    "export async function start(opts = {}) {\n"
    "  const container = opts.container ?? document.getElementById(\"app\");\n"
    "\n"
    "  // 插件形态才有的两件事：资源前缀（blob: 模块里相对路径会失效）与「开局收费」钩子。\n"
    "  ASSET = typeof opts.assetBase === \"string\" ? opts.assetBase : \"\";\n"
    "  chargeRun = typeof opts.chargePlay === \"function\" ? opts.chargePlay : null;\n"
    "\n"
    "  // 存档：宿主 storage（或独立网页的 localStorage）→ 内存缓存 → 本地 gp。\n"
    "  // ★ 必须 await 完 preload 再往下走：`gp.player.saves.latestSync` 读的就是这份缓存，\n"
    "  //   不 await 的话读到的永远是空档，症状是「进度从来没被恢复过」且不报错。\n"
    "  const store = opts.store ?? makeLocalStore();\n"
    "  try { await store.preload(); } catch (e) { console.warn(\"[blockfit] 读存档失败，按新档开始\", e); }\n"
    "  installGp(store);\n"
    "\n"
    "  app = new PIXI.Application();\n",
)

sub1("resizeTo 用容器", r"    resizeTo: host, background: PAL\.bg, antialias: true,", "    resizeTo: container, background: PAL.bg, antialias: true,")
sub1("canvas 挂到容器", r"  host\.appendChild\(app\.canvas\);", "  container.appendChild(app.canvas);")

sub1(
    "语言取存档 + 删 document 改动",
    r"  save = parseSave\(gp\.player\.saves\.latestSync\) \?\? defaultSave\(\);\n"
    r"  lang = pickLang\(save\.lang \?\? navigator\.language\);\n"
    r"  document\.title = \"四角にハマる\";\n"
    r"  document\.documentElement\.lang = lang;\n"
    r"  document\.documentElement\.dir = \"ltr\";\n"
    r"  T = LANGS\[lang\];\n"
    r"  migrateLegacyBest\(\);\n"
    r"  loadT\.text = T\.loading;\n"
    r"  let uiReady = false;\n"
    r"  void gp\.player\.ready\.then\(\(\{ user \}\) => \{\n"
    r".*?\n  \}\);\n",
    "  save = parseSave(gp.player.saves.latestSync) ?? defaultSave();\n"
    "  // ★ 默认 **zh**：宿主是中文 App。原版按 `navigator.language` 走，在这台机器上会落到\n"
    "  //   ja（日文界面），孩子看不懂。存档里选过语言就以存档为准。\n"
    "  lang = save.lang ?? \"zh\";\n"
    "  T = LANGS[lang];\n"
    "  migrateLegacyBest();\n"
    "  loadT.text = T.loading;\n",
    re.S,
)

for rel in ["paper-fiber.png", "bg-paper.png", "stamp.png", "prop-pencil.png", "prop-eraser.png"]:
    sub1(f"资源前缀 {rel}", rf'PIXI\.Assets\.load\("assets/{re.escape(rel)}"\)', f'PIXI.Assets.load(A("assets/{rel}"))')

sub1(
    "音频清单走资源前缀",
    r'loadSoundSystem\(\{ manifestUrl: "\./sound\.manifest\.json" \}\)',
    'loadSoundSystem({ manifestUrl: A("sound.manifest.json") })',
)

sub1(
    "__debug.sizes 读容器而不是 document",
    r"        host: \[\(document\.getElementById\(\"app\"\)               \)\.clientWidth, \(document\.getElementById\(\"app\"\)               \)\.clientHeight\],",
    "        host: [container.clientWidth, container.clientHeight],",
)

sub1("删 uiReady 赋值", r"\n  uiReady = true;", "")

sub1(
    "pagehide 用具名函数",
    r'  window\.addEventListener\("pagehide", \(\) => \{ try \{ void sound\.dispose\(\); fx\?\.dispose\(\); \} catch \{ /\* noop \*/ \} \}, \{ once: true \}\);',
    "  const onHide = () => { try { void sound.dispose(); fx?.dispose(); } catch { /* noop */ } };\n"
    '  window.addEventListener("pagehide", onHide);',
)

# 卸载函数：插在 start() 结尾（__debug 对象闭合的 `};` 之后、`ensureAudio` 之前）
sub1(
    "start() 返回卸载函数",
    r"  \};\n\}\n\nasync function ensureAudio\(\)",
    """  };

  /**
   * 卸载。宿主切走游戏时调它。
   *
   * ★ 必须拆干净：Pixi 应用 / 特效 / 音频 / window 监听 / DOM 输入框 / 调试钩子。
   *   留一个 ⇒ 第二次挂载「看着正常但没声音 / 特效没了 / 立刻判就绪」，且**一个错都不报**。
   * ★★ 调试钩子必须删：`__gpPlayable` 留着会让下一次挂载立刻判「就绪」⇒ 挂载测试假通过。
   * ★★ `texture:false`：纹理来自模块级 `texFiber / texStamp / ...`，
   *   销毁纹理后第二次挂载是**白屏且零报错**。
   */
  return () => {
    try { window.removeEventListener("pointerdown", unlockOnce); } catch { /* ignore */ }
    try { window.removeEventListener("keydown", unlockOnce); } catch { /* ignore */ }
    try { window.removeEventListener("keydown", onKey); } catch { /* ignore */ }
    try { window.removeEventListener("pagehide", onHide); } catch { /* ignore */ }
    try { promptEl?.remove(); promptEl = null; } catch { /* ignore */ }
    try { sound?.dispose?.(); } catch { /* ignore */ }
    try { fx?.dispose?.(); } catch { /* ignore */ }
    try { app?.destroy({ children: true, texture: false, baseTexture: false }); } catch { /* ignore */ }
    try { if (container) container.replaceChildren(); } catch { /* ignore */ }
    try {
      delete window.__gpPlayable;
      delete window.__gpReady;
      delete window.__app;
      delete window.__debug;
    } catch { /* ignore */ }
    tweens.length = 0;
    app = null; sound = null; fx = null;
    ASSET = ""; chargeRun = null;
  };
}

async function ensureAudio()""",
)

# ============================================================ 4. 开局收费
sub1(
    "加 chargeRun 与 gate()",
    r"let ASSET = \"\";\nconst A = \(p\) => ASSET \+ p\.replace\(/\^\\.\\//, \"\"\);\n",
    "let ASSET = \"\";\nconst A = (p) => ASSET + p.replace(/^\\.\\//, \"\");\n"
    "/** 插件形态注入的「扣一局积分」；独立网页是 `null`（免费） */\n"
    "let chargeRun = null;\n"
    "\n"
    "/**\n"
    " * 开局收费（一局 10 积分）。\n"
    " *\n"
    " * ★ 收费点就在这里 —— 两个入口（选题卡 / 计时挑战·开始）都过这一个函数，\n"
    " *   所以不会漏掉某一条路。**每一局都扣，不设宽限期**：本作有清晰的「一局」边界\n"
    " *   （一道题填满 = 一局），不像放置类那样「进去就一直待着」。\n"
    " * ★ 独立网页没有 `chargePlay` ⇒ 直接放行（`npm run dev` 时不用攒积分）。\n"
    " */\n"
    "async function gate() {\n"
    "  if (!chargeRun) return true;\n"
    "  const ok = await chargeRun();\n"
    "  return ok !== false;\n"
    "}\n",
)

sub1(
    "startMain 过闸门",
    r"function startMain\(i        \)       \{\n  mode = \"main\"; qIndex = i; taRun = null;",
    "async function startMain(i        )       {\n  if (!(await gate())) return;\n  mode = \"main\"; qIndex = i; taRun = null;",
)

sub1(
    "startTa 过闸门",
    r"function startTa\(\)       \{\n  const prof = curProfile\(\);\n  if \(!prof\) \{ openTaIntro\(\); return; \}\n",
    "async function startTa()       {\n  const prof = curProfile();\n  if (!prof) { openTaIntro(); return; }\n  if (!(await gate())) return;\n",
)

# ============================================================ 5. 入口
sub1(
    "删模块级自动启动",
    r"// =+\nvoid boot\(\)\.catch\(\(err\) => \{\n  console\.error\(\"boot failed\", err\);\n\}\);\n",
    "",
)

sub1(
    "设置里不再改 documentElement.lang",
    r"    T = LANGS\[lang\];\n    document\.documentElement\.lang = lang;\n    save\.lang = lang;",
    "    T = LANGS[lang];\n    save.lang = lang;",
)

# ============================================================ 写盘
if "--check" in sys.argv:
    print(f"✓ 全部 {len(applied)} 个锚点各命中 1 次（未写盘）")
    for n in applied:
        print("   ·", n)
    sys.exit(0)

GAME.write_text(src, encoding="utf-8")
print(f"✓ 应用 {len(applied)} 处补丁：{orig_len} → {len(src)} 字节")
for n in applied:
    print("   ·", n)
