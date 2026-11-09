#!/usr/bin/env python
"""
第二次挂载会崩 —— 修根因。

症状（`scripts/mount-test.mjs` 第 ⑤ 步抓到的）：
    TypeError: Cannot read properties of null (reading 'set')
    at uN (sugar.plugin.mjs:26223)

真因：宿主里**模块实例是复用的**（blob 模块只 import 一次），所以
`lowerBokeh` / `portraits` / `badges` … 这些模块级数组会**跨挂载累积**。
第一次 `unmount()` 销毁了 app，数组里留着的还是那批已销毁的 Graphics；
第二次 `buildScene()` 再 push 一批新的，`tick()` 遍历到旧的就 `.position` 为 null。

★ 为什么不能靠「卸载时清数组」兜住：挂载失败（异常）时 unmount 不一定跑。
  所以清在 **`buildScene()` 的第一行** —— 每次建场景都从零开始，与上一轮怎么结束无关。
"""
import io
import sys

P = "E:/plan/test25/task-games/sugar/game.js"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def sub1(s, old, new, what):
    n = s.count(old)
    if n != 1:
        print("SETUP FAIL [%s]: 锚点出现 %d 次（要求 1）" % (what, n))
        sys.exit(2)
    return s.replace(old, new)

s = read(P)
n0 = len(s)

ARR = [
    "enemies", "badges", "portraits", "portraitFaces", "hpBars", "hpNums",
    "stageLabels", "portraitGlows", "portraitAuras", "portraitStars",
    "portraitStarBase", "lowerBokeh", "bottomSparkles", "bottomLightDots",
    "evolutionReadySparkles", "badgeFaces", "menuHeroActors", "menuHeroFx",
]
reset_lines = "\n".join("  %s = [];" % a for a in ARR)

block = (
    "/**\n"
    " * 清掉上一次挂载留下的场景引用。\n"
    " *\n"
    " * ★ 宿主里**模块实例是复用的**（blob 模块只 import 一次），所以这些模块级数组\n"
    " *   会跨挂载累积：第一次 unmount 销毁了 app，数组里留着的还是那批**已销毁**的\n"
    " *   Graphics；第二次 buildScene 再 push 一批新的，`tick()` 遍历到旧的就\n"
    " *   `Cannot read properties of null (reading 'set')`。\n"
    " *   崩在**第二帧**而不是挂载时，所以看起来像「进游戏一会儿就白屏」。\n"
    " *\n"
    " * ★ 清在这里而不是 unmount 里：挂载中途抛异常时 unmount 不一定跑得到。\n"
    " */\n"
    "function clearSceneState()       {\n"
    + reset_lines + "\n"
    "  activeOverlay = null;\n"
    "  activeBubble = null;\n"
    "  bubbleTimer = 0;\n"
    "  evolutionTabOpen = false;\n"
    "  standalonePageOpen = false;\n"
    "  menuHeroGroup = null;\n"
    "  menuHeroFxLayer = null;\n"
    "  menuHeroIdleReady = false;\n"
    "  paused = false;\n"
    "  for (const k of Object.keys(bubbleShown)) delete bubbleShown[k];\n"
    "}\n"
    "\n"
)

s = sub1(s, "function buildScene()       {\n", block + "function buildScene()       {\n  clearSceneState();\n", "buildScene")

write(P, s)
print("game.js: %d -> %d 字节" % (n0, len(s)))

g = read(P)
checks = [
    ("clearSceneState 已定义", g.count("function clearSceneState()") == 1),
    ("buildScene 第一行调用它", "function buildScene()       {\n  clearSceneState();" in g),
    ("18 个数组都清了", sum(1 for a in ARR if ("  %s = [];" % a) in g) == len(ARR)),
]
bad = [n for n, ok in checks if not ok]
print("\n=== 复核 ===")
for n, ok in checks:
    print(("  ok   " if ok else "  FAIL ") + n)
sys.exit(1 if bad else 0)
