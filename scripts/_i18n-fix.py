# -*- coding: utf-8 -*-
"""补一个原站就漏掉的 i18n 键：`rob.reported`（报警后的 toast）。

`main.js:637` 调 `t("rob.reported")`，但三张语言表里都没有这个键 ——
按下「立即报警」之后 toast 会直接显示 **`rob.reported`** 这串英文。
原站就是这样（不是我改坏的），顺手补上。

用法：python scripts/_i18n-fix.py   （幂等：已经有这个键就什么都不做）
"""
import io
import sys

PATH = "i18n.js"
ADD = {
    "今すぐ通報": "通報しました。特殊部隊が向かっています",
    "立即报警": "已报警，特警正在赶来",
    "Call the police now": "Reported — the squad is on the way",
}

src = io.open(PATH, encoding="utf-8").read()
if '"rob.reported"' in src:
    print("已经存在 rob.reported，跳过")
    sys.exit(0)

lines = src.split("\n")
out = []
hits = 0
for line in lines:
    out.append(line)
    s = line.strip()
    for anchor, text in ADD.items():
        if s == '"rob.report": "%s",' % anchor:
            indent = line[: len(line) - len(line.lstrip())]
            out.append('%s"rob.reported": "%s",' % (indent, text))
            hits += 1
            break
if hits != 3:
    print("锚点命中 %d 次（期望 3）—— 什么都没写" % hits)
    sys.exit(1)

io.open(PATH, "w", encoding="utf-8", newline="\n").write("\n".join(out))
print("已补 3 处 rob.reported")
