#!/usr/bin/env python
"""
把「开局收费」接到 sugar 的三个入口上（幂等，重复跑会 SETUP FAIL 而不是叠两层）。

三个入口 = 三条会**从菜单进战斗**的路径：
  1. 标题页「开始游戏」（新玩家走剧情 / 老玩家直接进）
  2. 关卡地图里点某一层
  3. 关卡地图底部「继续」

⚠️ 打通一层自动进下一层（`spawnFloor(floorIndex + 1)`）**不接** —— 那是奖励，
   不是新开一局。判据：这三个入口的共同点是「从菜单发起」。
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
        print("  锚点片段: %r" % (old[:160],))
        sys.exit(2)
    return s.replace(old, new)

s = read(P)
n0 = len(s)

# ---- 1) 闸门函数（紧跟在 chargePlay 声明后面，便于一处看全）
s = sub1(
    s,
    "let chargePlay         = null;  // (opts.chargePlay) 开局收费，插件形态才有\n",
    "let chargePlay         = null;  // (opts.chargePlay) 开局收费，插件形态才有\n"
    "let gatePending = false;\n"
    "\n"
    "/**\n"
    " * 开局收费闸门。\n"
    " *\n"
    " * 没有 `chargePlay`（独立网页）⇒ 直接放行，行为跟改造前一模一样。\n"
    " * `gatePending` 防连点：两次快速点击只扣一次 —— 否则孩子点两下就白丢 40 积分，\n"
    " * 而且**不会报错**（两笔 spendPoints 都合法）。\n"
    " */\n"
    "function gateRun(go         )       {\n"
    "  if (!chargePlay) { go(); return; }\n"
    "  if (gatePending) return;\n"
    "  gatePending = true;\n"
    "  void chargePlay().then(\n"
    "    (ok         ) => { gatePending = false; if (ok) go(); },\n"
    "    () => { gatePending = false; },\n"
    "  );\n"
    "}\n",
    "gateRun",
)

# ---- 2) 标题页「开始游戏」
s = sub1(
    s,
    "  const start = mkOrnateButton(t('startGame'), 276, 66, () => {\n"
    "    clearOverlay();\n"
    "    setStandalonePage(false);\n"
    "    if (LS.getItem('tz_story')) {\n"
    "      if (LS.getItem('tz_tut')) phase = PHASE.Idle;\n"
    "      else startTutorial();\n"
    "    } else {\n"
    "      showStory();\n"
    "    }\n"
    "  }, PAL.red, true, 24);",
    "  const start = mkOrnateButton(t('startGame'), 276, 66, () => {\n"
    "    // 先收费再动画面：付费没成功就停在标题页（清掉遮罩会露出空白棋盘）\n"
    "    gateRun(() => {\n"
    "      clearOverlay();\n"
    "      setStandalonePage(false);\n"
    "      if (LS.getItem('tz_story')) {\n"
    "        if (LS.getItem('tz_tut')) phase = PHASE.Idle;\n"
    "        else startTutorial();\n"
    "      } else {\n"
    "        showStory();\n"
    "      }\n"
    "    });\n"
    "  }, PAL.red, true, 24);",
    "start button",
)

# ---- 3) 关卡地图：点某一层
s = sub1(
    s,
    "      node.on('pointertap', () => {\n"
    "        audio.play('orb-step', 1.1);\n"
    "        mapPulse = null;\n"
    "        clearOverlay();\n"
    "        spawnFloor(i);\n"
    "        showFloorIntro(i);\n"
    "      });",
    "      node.on('pointertap', () => {\n"
    "        audio.play('orb-step', 1.1);\n"
    "        gateRun(() => {\n"
    "          mapPulse = null;\n"
    "          clearOverlay();\n"
    "          spawnFloor(i);\n"
    "          showFloorIntro(i);\n"
    "        });\n"
    "      });",
    "floor node",
)

# ---- 4) 关卡地图：继续
s = sub1(
    s,
    "  const continueBtn = mkPageButton(t('continueBtn'), 286, 54, () => {\n"
    "    mapPulse = null;\n"
    "    clearOverlay();\n"
    "    spawnFloor(nextIndex);\n"
    "    showFloorIntro(nextIndex);\n"
    "  }, PAL.blue, true, 18);",
    "  const continueBtn = mkPageButton(t('continueBtn'), 286, 54, () => {\n"
    "    gateRun(() => {\n"
    "      mapPulse = null;\n"
    "      clearOverlay();\n"
    "      spawnFloor(nextIndex);\n"
    "      showFloorIntro(nextIndex);\n"
    "    });\n"
    "  }, PAL.blue, true, 18);",
    "continue button",
)

write(P, s)
print("game.js: %d -> %d 字节" % (n0, len(s)))

# ---- 复核
g = read(P)
checks = [
    ("gateRun 已定义", g.count("function gateRun(") == 1),
    ("gateRun 被调用 3 次", g.count("gateRun(() => {") == 3),
    ("自动进下一层没被拦", "spawnFloor(floorIndex + 1);" in g),
    ("chargePlay 仍只有一个声明", g.count("let chargePlay         = null;") == 1),
]
bad = [n for n, ok in checks if not ok]
print("\n=== 复核 ===")
for n, ok in checks:
    print(("  ok   " if ok else "  FAIL ") + n)
sys.exit(1 if bad else 0)
