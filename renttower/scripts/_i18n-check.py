# -*- coding: utf-8 -*-
"""i18n 体检：代码里 t("x.y") 用到的键，在 zh 表里是否都有；以及 zh 里没人用的死键。

用法：python scripts/_i18n-check.py
退出码 0 = 没有缺失键（死键只报告，不报错）。
"""
import glob
import re
import sys

SRC = open("i18n.js", encoding="utf-8").read()

# 三种语言块都是 `  zh: {` 起头，用逐行定位代替正则（正则里的 \s 在本机 bash 里会被吃掉）
lines = SRC.split("\n")
blocks = {}
start = None
name = None
for i, line in enumerate(lines):
    m = re.match(r"^  ([a-z]{2}): \{", line)
    if m:
        if start is not None:
            blocks[name] = "\n".join(lines[start:i])
        name, start = m.group(1), i + 1
if start is not None:
    blocks[name] = "\n".join(lines[start:])
print("语言块", list(blocks))

zh = blocks.get("zh", "")
keys = set(re.findall(r'"([A-Za-z0-9_.]+)"\s*:', zh))
print("zh 键数", len(keys))

used = set()
for f in glob.glob("game/*.js"):
    src = open(f, encoding="utf-8").read()
    used |= set(re.findall(r'\bt\(\s*"([A-Za-z0-9_.]+)"', src))
print("代码里用到", len(used))

missing = sorted(used - keys)
print("缺失", len(missing), missing[:20])
dead = sorted(keys - used)
print("没用到", len(dead))
for k in dead:
    print("   ", k)
sys.exit(1 if missing else 0)
