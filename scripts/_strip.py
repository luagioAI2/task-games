#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""一次性：把 Sweet Spin 的内购商店与在线排行榜整块拆掉，并把标题/资源名换成我们的。

## 拆什么、为什么

1. **提示内购**（`gp.pay.purchase`，1 平台币 = 5 次提示）：宿主没有能写正数的接口，
   孩子也没有平台币。留着 = 一个「点了必然失败」的按钮。
   提示本身**保留**（开局 3 次 / 首次通关 +1 / 上限 9），它是纯游戏内资源。
2. **在线排行榜**（`gp.player.topScores` + 头像 + 登录）：要账号、要服务端，
   宿主两样都没有。整块删；结算面板那一行改成「总星星 n / 300」（本机进度）。
3. `iconTrophy` 夹在排行榜块里，但结算面板和关卡盘都要用 ⇒ **先救出来再删块**。
4. 资源换成 webp（`compress-assets.py` 已经把 png 换成 webp），`coin.png` 只给内购用 ⇒ 去掉。
5. 标题 `Sweet Spin` 改成按语言取的 `t('gameTitle')`（商城名「旋转灯泡」）。

跑完用 `node --check game.js` 与 `grep` 断言验收（脚本末尾自带断言）。
"""
import io
import re

P = 'game.js'
I = 'i18n.js'

src = io.open(P, encoding='utf-8', newline='').read()


def cut(a, b, label):
    """删掉 [a, b) 这一段（a 保留位置换成 b 处的内容）。"""
    global src
    i = src.find(a)
    assert i >= 0, '找不到起点：' + label
    j = src.find(b, i)
    assert j > i, '找不到终点：' + label
    src = src[:i] + src[j:]


def sub(a, b, label):
    global src
    assert src.count(a) == 1, '锚点出现 %d 次（应为 1）：%s' % (src.count(a), label)
    src = src.replace(a, b)


# ---------- 1. 先把 iconTrophy 从排行榜块里救出来 ----------
i = src.find('function iconTrophy(')
j = src.find('function drawLeaderboard(', i)
assert 0 <= i < j, 'iconTrophy 不在排行榜块前面'
trophy = src[i:j].rstrip() + '\n'
src = src[:i] + src[j:]

# ---------- 2. 删两个整块 ----------
cut('// ---------- hint shop (platform coins) ----------', '// ---------- leaderboard ----------', 'shop')
cut('// ---------- leaderboard ----------', '// ---------- layout ----------', 'leaderboard')

# ---------- 3. 奖杯画法放回「布局」之前（它现在只被结算面板用） ----------
# ★ `burst`（撒纸屑）原来也在排行榜那一段里，但 computePower / useHint / 过关面板
#   都在调它 —— 漏了只在「第一次点亮灯泡」时抛 `burst is not defined`，构建期不报。
BURST = '''function burst(x        , y        , n        , cols          ) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 1 + Math.random() * 0.6, c: cols[i % cols.length], r: 3 + Math.random() * 4, rot: Math.random() * 6 });
  }
}
'''
sub('// ---------- layout ----------', BURST + trophy + '\n// ---------- layout ----------', 'trophy-insert')

# ---------- 4. 清掉所有对内购 / 排行榜的调用 ----------
sub('  submitTotal();\n', '', 'onWin-submit')
sub(
    "  if (save.hints <= 0) { if (payAvailable()) openShop(); else showToast(t('noHint')); return; }",
    "  if (save.hints <= 0) { showToast(t('noHint')); return; }",
    'useHint',
)
sub(
    """  } else if (payAvailable()) {
    const px2 = hx + r2 * 0.82, py2 = byc - r2 * 0.72, pr = 13 * (1 + 0.06 * Math.sin(time * 5));
    popCircle(px2, py2, pr, MINT, 2);
    iconStroke(() => { ctx.beginPath(); ctx.moveTo(px2 - pr * 0.5, py2); ctx.lineTo(px2 + pr * 0.5, py2); ctx.moveTo(px2, py2 - pr * 0.5); ctx.lineTo(px2, py2 + pr * 0.5); }, pr * 0.9);
  } else {""",
    '  } else {',
    'dock-plus',
)
sub(
    """  // total stars + leaderboard entry
  const lbw = Math.min(pw - 40, 250), lby = py + 190;
  popRect(W / 2 - lbw / 2, lby, lbw, 36, 18, BUTTER, 4);
  iconTrophy(W / 2 - lbw / 2 + 24, lby + 18, 24);
  outlinedText(winRank || t('lbMine', { n: totalStars() }), W / 2 + 12, lby + 19, 15, lbw - 60);""",
    """  // 总星星（本机进度；原版的在线排行榜已删，见文件头）
  const lbw = Math.min(pw - 40, 250), lby = py + 190;
  popRect(W / 2 - lbw / 2, lby, lbw, 36, 18, BUTTER, 4);
  iconTrophy(W / 2 - lbw / 2 + 24, lby + 18, 24);
  outlinedText(t('totalStars', { n: totalStars() }), W / 2 + 12, lby + 19, 15, lbw - 60);""",
    'win-pill',
)
sub("  addBtn(W / 2 - lbw / 2, lby, lbw, 40, () => { sfxTap(); openLeaderboard(); });\n", '', 'win-lb-btn')
sub(
    """  const tx = x0 + cw - 18 - br * 3 - 14;
  roundBtn(tx, cy, br, BUTTER); iconTrophy(tx, cy, br * 1.0);
  addBtn(tx - br - 6, cy - br - 6, br * 2 + 12, br * 2 + 12, () => { sfxTap(); openLeaderboard(); });
""",
    '',
    'levels-trophy-btn',
)
sub('  if (lbOpen) drawLeaderboard();\n  if (shopOpen) drawShop();\n', '', 'render-panels')
sub(
    "  if (screen === 'game' && !settingsOpen && !showWin && !lbOpen && !shopOpen) {",
    "  if (screen === 'game' && !settingsOpen && !showWin) {",
    'input-guard',
)
sub(
    "  if (e.key === 'Escape') { if (shopOpen) { if (!shopBusy) shopOpen = false; } else if (lbOpen) lbOpen = false; else if (settingsOpen) settingsOpen = false; else if (screen === 'game') screen = 'levels'; }",
    "  if (e.key === 'Escape') { if (settingsOpen) settingsOpen = false; else if (screen === 'game') screen = 'levels'; }",
    'keydown',
)
sub('  deliverPendingPurchases();\n', '', 'boot-pending')

# ---------- 5. 资源换 webp，coin 只给内购用 ⇒ 去掉 ----------
sub(
    "const IMG_SRC = { bg: 'assets/bg_clay.png', battery: 'assets/battery_clay.png', bulbOff: 'assets/bulb_clay_off.png', bulbOn: 'assets/bulb_clay_on.png', hex: 'assets/hex_clay.png', lock: 'assets/lock_clay.png', coin: 'assets/coin.png' };",
    "const IMG_SRC = { bg: 'assets/bg_clay.webp', battery: 'assets/battery_clay.webp', bulbOff: 'assets/bulb_clay_off.webp', bulbOn: 'assets/bulb_clay_on.webp', hex: 'assets/hex_clay.webp', lock: 'assets/lock_clay.webp' };",
    'IMG_SRC',
)

# ---------- 6. 标题走 i18n（商城名「旋转灯泡」，英文/日文各一份） ----------
sub("const GAME_TITLE = 'Sweet Spin';\n", '', 'title-const')
sub('ribbon(W / 2, 82 + bob, rw, 62, GAME_TITLE, 34);', "ribbon(W / 2, 82 + bob, rw, 62, t('gameTitle'), 34);", 'title-ribbon')
sub('outlinedText(GAME_TITLE, W / 2, H / 2 - 100, 36, W - 40);', "outlinedText(t('gameTitle'), W / 2, H / 2 - 100, 36, W - 40);", 'title-loading')
# 宿主的页面标题不许改（`index.html` 自己已经有 <title>）
sub('document.title = GAME_TITLE;\n', '', 'doc-title')

io.open(P, 'w', encoding='utf-8', newline='').write(src)

# ================= i18n =================
s = io.open(I, encoding='utf-8', newline='').read()

# 6a. 删掉内购 / 排行榜的文案（代码里已经没有引用）
dead = [
    'shopRate', 'buy', 'shopTitle', 'noHintShort', 'shopItem', 'shopDesc', 'shopBuy', 'shopGot',
    'payPending', 'payUnavailable', 'payBusy',
    'leaderboard', 'lbSub', 'lbMine', 'lbRank', 'lbLoginHint', 'lbLogin', 'lbEmpty', 'lbErr', 'lbGuest',
]
for k in dead:
    pat = re.compile(r'^    ' + k + r':.*\n', re.M)
    n = len(pat.findall(s))
    assert n == 3, 'i18n 里 %s 出现 %d 次（应为 3：zh/en/ja）' % (k, n)
    s = pat.sub('', s)

# 6b. 加两条新文案：游戏名（商城名）+ 总星星
add = {
    'zh': ("    gameTitle: '旋转灯泡',\n    totalStars: '总星星 {n}',\n"),
    'en': ("    gameTitle: 'Sweet Spin',\n    totalStars: 'Stars {n}',\n"),
    'ja': ("    gameTitle: 'スイートスピン',\n    totalStars: 'スター {n}',\n"),
}
for lang, block in add.items():
    anchor = "  %s: {\n" % lang
    assert s.count(anchor) == 1, 'i18n 里 %s 段找不到' % lang
    s = s.replace(anchor, anchor + block, 1)

# 6c. setLang 不许改宿主的 <html lang>（插件形态）
old_set = """let current       = 'zh';

export function setLang(l      ) {
  current = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
}"""
new_set = """let current       = 'zh';

/**
 * 插件形态下**不许**动 `<html lang>` —— 那是宿主页面的，改了整个 App 的
 * 排版/朗读语言都跟着变（`mount-test` 里有断言钉着）。独立网页保持原行为。
 */
let documentSideEffects = true;
export function setDocumentSideEffects(on        ) {
  documentSideEffects = !!on;
}

export function setLang(l      ) {
  current = l;
  if (documentSideEffects) document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
}"""
assert s.count(old_set) == 1, 'i18n 的 setLang 原文对不上'
s = s.replace(old_set, new_set, 1)

io.open(I, 'w', encoding='utf-8', newline='').write(s)

# ================= 断言 =================
bad = ['payAvailable', 'openShop', 'shopOpen', 'shopBusy', 'buyHints', 'deliverPending',
       'lbOpen', 'drawLeaderboard', 'openLeaderboard', 'submitTotal', 'winRank',
       'lbState', 'lbRows', 'avatarCache', 'gpPay', 'HINT_PACK', 'GAME_TITLE']
for w in bad:
    assert w not in src, 'game.js 里还剩 %s' % w
for k in dead:
    assert k + ':' not in s, 'i18n 里还剩 %s' % k
print('拆完：game.js %d 行 · i18n.js %d 行 · 残留内购/排行引用 0' % (src.count('\n') + 1, s.count('\n') + 1))
