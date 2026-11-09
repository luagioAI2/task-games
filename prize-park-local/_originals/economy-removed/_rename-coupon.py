# -*- coding: utf-8 -*-
"""
把 coupon 这个币的**显示名**从「商城币」改成「兑换券」。

为什么要有脚本：`currency.ts` 的头注释记过两次改名事故 ——
「名字散着 173 处，漏一处不报错」。手工改必然漏，而且漏了看起来一切正常，
只是某一块界面还写着旧名字。

规则：
  · 只改 .ts / .tsx（不含 .test. 也不排除 —— 测试里断言的是真实文案，一起改）
  · **跳过历史注记**：带年份（2026-xx-xx）、「家长原话」、「改名」、「以前叫」的行
    一律不动 —— 那些是在记录「它以前叫什么」，改掉就把历史抹了，
    以后没人知道 `harvestLedger` 这个名字是哪来的。
  · 改完打印每个文件的命中数，方便逐条复核。
"""
import io
import os
import re
import sys

ROOT = r"E:\plan\test25\kid-quest-farm-2d\src"
OLD, NEW = "商城币", "兑换券"
SKIP = ("2026-", "家长原话", "改名", "以前叫", "原「商城币」", "COUPON_WAS_RENAMED")

changed = {}
for dirpath, _dirs, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith((".ts", ".tsx")):
            continue
        p = os.path.join(dirpath, fn)
        with io.open(p, encoding="utf-8") as f:
            lines = f.read().split("\n")
        n = 0
        for i, line in enumerate(lines):
            if OLD not in line:
                continue
            if any(s in line for s in SKIP):
                continue
            lines[i] = line.replace(OLD, NEW)
            n += line.count(OLD)
        if n:
            with io.open(p, "w", encoding="utf-8", newline="\n") as f:
                f.write("\n".join(lines))
            changed[os.path.relpath(p, ROOT)] = n

total = sum(changed.values())
for k in sorted(changed):
    print("%4d  %s" % (changed[k], k))
print("--- 共 %d 处，%d 个文件 ---" % (total, len(changed)))
