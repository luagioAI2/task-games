#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""一次性：给每个按钮挂一个**标签**，供 e2e / 截图脚本按名字点。

整屏都是 canvas 画的，没有选择器。调试桥 `__sweetspin.buttons()` 返回几何，
但「哪个框是开始、哪个是提示」只有标签能说清 —— 按顺序猜第几个按钮，
改一次布局就全错位（而且错得很安静）。

标签只给需要点的那些；背景遮罩之类留空。

⚠️ 锚点**不带行首缩进**（包裹之后整体多缩了 2 格），只匹配语句本身。
"""
import io

P = 'game.js'
s = io.open(P, encoding='utf-8', newline='').read()


def sub1(a, b, label):
    global s
    assert s.count(a) == 1, '锚点出现 %d 次（应为 1）：%s' % (s.count(a), label)
    s = s.replace(a, b, 1)


def nth(a, n, b, label):
    """把第 n 次（1 起）出现的 a 换成 b。"""
    global s
    assert s.count(a) >= n, '锚点只有 %d 次，取不到第 %d 次：%s' % (s.count(a), n, label)
    parts = s.split(a)
    s = a.join(parts[:n]) + b + a.join(parts[n:])


sub1(
    "function addBtn(x        , y        , w        , h        , fn            ) { btns.push({ x, y, w, h, fn }); }",
    "/** `label` 只给 e2e / 截图脚本用（整屏 canvas，没有选择器可点） */\n"
    "  function addBtn(x        , y        , w        , h        , fn            , label = '') { btns.push({ x, y, w, h, fn, label }); }",
    'signature',
)

# 唯一的：直接换
uniq = [
    ("addBtn(x0 + 10, cy - br - 6, br * 2 + 16, br * 2 + 12, () => { sfxTap(); screen = 'levels'; page = Math.floor((level - 1) / 20); });",
     "'back'", 'back'),
    ("addBtn(hx - r2 - 8, byc - r2 - 8, r2 * 2 + 16, r2 * 2 + 30, () => { sfxTap(); useHint(); });",
     "'hint'", 'hint'),
    ("addBtn(rx - r2 - 8, byc - r2 - 8, r2 * 2 + 16, r2 * 2 + 30, () => { sfxTap(); save.cur = null; startLevel(level); });",
     "'replay'", 'replay'),
    ("addBtn(b1x, byy, bw, bh + 6, () => { sfxTap(); startLevel(level); });",
     "'replay-win'", 'replay-win'),
    ("addBtn(b2x, byy, bw, bh + 6, () => { sfxTap(); if (level < TOTAL) startLevel(level + 1); else { screen = 'levels'; } });",
     "'next'", 'next'),
    ("addBtn(cx - s * 0.9, ccy - s * 0.8, s * 1.8, s * 1.6, () => { sfxTap(); startLevel(n, true); });",
     "'L' + n", 'hex'),
    ("addBtn(W / 2 - ax - r2 - 8, by - r2 - 8, r2 * 2 + 16, r2 * 2 + 16, () => { sfxTap(); page--; });",
     "'prev'", 'prev'),
    ("addBtn(W / 2 + ax - r2 - 8, by - r2 - 8, r2 * 2 + 16, r2 * 2 + 16, () => { sfxTap(); page++; });",
     "'nextpage'", 'nextpage'),
    ("addBtn(dx - 11, by - 24, 22, 48, () => { if (page !== p) { sfxTap(); page = p; } });",
     "'page:' + p", 'dot'),
    ("addBtn(0, 0, W, H, () => { settingsOpen = false; });", "'scrim'", 'scrim'),
    ("addBtn(bx, byy, bw, 52, () => { sfxTap(); setLang(l); save.lang = l; persist(); });",
     "'lang:' + l", 'lang'),
    ("addBtn(bx, byy, sw, 52, () => { save.muted = m; sound?.settings.setMuted(save.muted); persist(); sfxTap(); });",
     "'sound:' + (m ? 'off' : 'on')", 'sound'),
    ("addBtn(W / 2 - cbw / 2, cby, cbw, 58, () => { sfxTap(); settingsOpen = false; });",
     "'close'", 'close'),
]

for call, label, name in uniq:
    head, tail = call.rsplit(')', 1)
    sub1(call, head + ', ' + label + ')' + tail, name)

# 设置按钮出现两次（对局顶栏 / 关卡盘顶栏），各给一次
settings = "addBtn(x0 + cw - 26 - br * 2, cy - br - 6, br * 2 + 16, br * 2 + 12, () => { sfxTap(); settingsOpen = true; });"
head, tail = settings.rsplit(')', 1)
nth(settings, 1, head + ", 'settings')" + tail, 'settings-1')
nth(settings, 1, head + ", 'settings2')" + tail, 'settings-2')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('标签完成：%d 个按钮（设置按钮两处：settings / settings2）' % (len(uniq) + 2))
