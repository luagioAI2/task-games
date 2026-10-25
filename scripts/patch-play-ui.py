"""娃娃界面改版：换币上顶栏 / 拆掉右侧竖栏 / 娃娃界面也显示底部动作条。

一次写完，每处都断言命中次数 —— 分散多次 Edit 会互相覆盖（工作区里踩过）。
用法：python scripts/patch-play-ui.py
"""
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / "game.js"

src = GAME.read_text(encoding="utf-8")
edits = []


def rep(old, new, note):
    edits.append((old, new, note))


# ── 1. #play 网格多一行 bar ─────────────────────────────────────────
rep(
    '#play{display:grid;align-items:stretch;justify-items:stretch;grid-template-columns:100%;'
    'grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"hud" "view" "ctrl";'
    'background:linear-gradient(180deg,#fff7f0,#f5f1ff)}\n'
    '#play.land{grid-template-columns:64% 36%;grid-template-rows:auto 1fr;grid-template-areas:"view hud" "view ctrl"}',
    '#play{display:grid;align-items:stretch;justify-items:stretch;grid-template-columns:100%;'
    'grid-template-rows:auto minmax(0,1fr) auto auto;grid-template-areas:"hud" "view" "ctrl" "bar";'
    'background:linear-gradient(180deg,#fff7f0,#f5f1ff)}\n'
    '#play.land{grid-template-columns:64% 36%;grid-template-rows:auto 1fr auto;grid-template-areas:"view hud" "view ctrl" "view bar"}',
    "#play 网格加 bar 行",
)

# ── 2. hud row2：价格 + 视角/店员 一排 ───────────────────────────────
rep(
    '#hud .row2{text-align:center;font-size:11.5px;color:var(--ink5);font-weight:700}',
    '#hud .row2{display:flex;align-items:center;gap:6px;min-width:0;font-size:11.5px;color:var(--ink5);font-weight:700;padding-top:2px}\n'
    '#pPrice{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
    '#viewChips{flex:none;display:flex;align-items:center;gap:5px}',
    "hud row2 改成 flex",
)

# ── 3. 右侧竖栏 → 顶栏一排小胶囊 ────────────────────────────────────
rep(
    '#sideBtns{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:3;align-items:flex-end}\n'
    '#camBtns{display:flex;flex-direction:column;gap:6px}\n'
    '#camBtns button{width:auto;min-width:54px;padding:0 8px;white-space:nowrap;height:42px;border-radius:12px;'
    'background:rgba(255,255,255,.88);color:var(--ink);font-weight:900;font-size:11.5px;border:1px solid var(--line);'
    'line-height:1.1;backdrop-filter:blur(4px)}\n'
    '#camBtns button.on{background:var(--mint);border-color:#fff}\n'
    '.smallBtn{height:38px;padding:0 10px;border-radius:12px;background:rgba(255,255,255,.88);color:var(--ink);'
    'font-weight:800;font-size:11.5px;border:1px solid var(--line);backdrop-filter:blur(4px)}',
    '/* 视角 / 店员：原来是压在 3D 画面右上角的一竖列，白吃掉画面右侧 ~70px。\n'
    '   这三颗只在开局前用得上，挪到顶栏第二行的一排小胶囊，画面就能占满整宽。 */\n'
    '#camBtns{display:flex;gap:5px}\n'
    '#camBtns button,.smallBtn{height:26px;padding:0 9px;border-radius:999px;background:#fff;color:var(--ink);'
    'font-weight:800;font-size:11px;border:1px solid var(--line);line-height:1;white-space:nowrap;'
    'box-shadow:var(--shadow-flat)}\n'
    '#camBtns button.on{background:var(--mint);border-color:#8fe4d6}',
    "侧栏改顶栏胶囊",
)

# ── 4. 换币按钮（顶栏那颗币） ───────────────────────────────────────
rep(
    '.coinTag{background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12.5px;'
    'font-weight:800;white-space:nowrap;box-shadow:var(--shadow-flat)}',
    '.coinTag{background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12.5px;'
    'font-weight:800;white-space:nowrap;box-shadow:var(--shadow-flat)}\n'
    '/* 娃娃界面顶栏那颗币就是「换币」入口：整颗可点，右边挂一个绿色 ＋。\n'
    '   原来换币只有底部那个大按钮一条路，而底部按钮一开局就变回 PLAY，等于藏起来了。 */\n'
    '.coinBtn{display:flex;align-items:center;gap:3px;padding:5px 7px 5px 10px;flex:none;min-height:30px}\n'
    '.coinBtn .plus{font-style:normal;width:17px;height:17px;border-radius:999px;background:var(--mint);color:var(--ink);'
    'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;line-height:1}\n'
    '.coinBtn:active{transform:translateY(1px)}',
    "coinBtn 样式",
)

# ── 5. 动作条在娃娃界面用紧凑版 ─────────────────────────────────────
rep(
    '.ppBar{flex:none;width:100%;display:flex;gap:8px;padding:8px 12px;background:var(--paper);'
    'border-top:1px solid var(--line);box-shadow:0 -6px 16px -12px rgba(51,40,30,.28)}',
    '.ppBar{flex:none;width:100%;display:flex;gap:8px;padding:8px 12px;background:var(--paper);'
    'border-top:1px solid var(--line);box-shadow:0 -6px 16px -12px rgba(51,40,30,.28)}\n'
    '/* 娃娃界面也要这条动作条（背包 / 回收 / 排行），但那里每一像素都在跟 3D 画面抢，\n'
    '   所以用紧凑版：图标和文字排成一行，54px → 40px。 */\n'
    '#play>.ppBar{grid-area:bar}\n'
    '.ppBar.compact{padding:6px 12px 8px}\n'
    '.ppBar.compact .barTile{min-height:40px;flex-direction:row;gap:5px;font-size:12px;border-radius:12px}\n'
    '.ppBar.compact .barTile .ico{font-size:16px}',
    "紧凑动作条",
)

# ── 6. 删掉画面里的右侧竖栏 ────────────────────────────────────────
rep(
    '    <div id="leftTag"></div>\n'
    '    <div id="sideBtns">\n'
    '      <div id="camBtns"><button id="camFront" class="on"></button><button id="camSide"></button></div>\n'
    '      <button id="staffBtn" class="smallBtn"></button>\n'
    '      <button id="testBtn" class="smallBtn"></button>\n'
    '    </div>\n'
    '    <div id="flash" class="hidden"></div>',
    '    <div id="leftTag"></div>\n'
    '    <div id="flash" class="hidden"></div>',
    "删 sideBtns",
)

# ── 7. HUD：币变成按钮，第二行塞视角/店员 ─────────────────────────
rep(
    '    <div class="row1"><button id="backBtn"></button><div class="grow" id="hudName"></div>'
    '<span id="pCoins" class="coinTag"></span></div>\n'
    '    <div class="row2" id="pPrice"></div>',
    '    <div class="row1"><button id="backBtn"></button><div class="grow" id="hudName"></div>'
    '<button id="pCoinsBtn" class="coinTag coinBtn"><span id="pCoins"></span><i class="plus">＋</i></button></div>\n'
    '    <div class="row2">\n'
    '      <span id="pPrice"></span>\n'
    '      <span id="viewChips">\n'
    '        <span id="camBtns"><button id="camFront" class="on"></button><button id="camSide"></button></span>\n'
    '        <button id="staffBtn" class="smallBtn"></button>\n'
    '        <button id="testBtn" class="smallBtn hidden"></button>\n'
    '      </span>\n'
    '    </div>',
    "HUD 重排",
)

# ── 8. 动作条给个 id（要跟着屏搬） ─────────────────────────────────
rep(
    '  <div class="ppBar">\n'
    '    <button id="colBtn"',
    '  <div class="ppBar" id="ppBar">\n'
    '    <button id="colBtn"',
    "ppBar id",
)

# ── 9. 胶囊里去掉 📷 后面的空格 ─────────────────────────────────────
rep(
    '  $("camFront").textContent = `📷 ${T("camFront")}`; $("camSide").textContent = `📷 ${T("camSide")}`;\n'
    '  $("staffBtn").textContent = `🔔 ${T("staff")}`; $("testBtn").textContent = T("test");',
    '  $("camFront").textContent = `📷${T("camFront")}`; $("camSide").textContent = `📷${T("camSide")}`;\n'
    '  $("staffBtn").textContent = `🔔${T("staff")}`; $("testBtn").textContent = T("test");',
    "胶囊文案收窄",
)

# ── 10. show() 搬动作条 ────────────────────────────────────────────
rep(
    'function show(el             ) {\n'
    '  for (const s of [listEl, playEl, colEl, sellEl, rankEl]) s.classList.toggle("hidden", s !== el);\n'
    '  refreshTexts(); void setBgm(el === playEl ? "play" : "home");\n'
    '}',
    '/**\n'
    ' * 动作条**只有一个实例，跟着当前屏搬**。\n'
    ' *\n'
    ' * 不复制 markup：复制就得复制 id，`#colBtn` 出现两份，`$()` 只拿得到第一份 ——\n'
    ' * 另一份点了没反应，而控制台零报错。\n'
    ' * 图鉴 / 回收 / 排行三屏自己带返回键，不放动作条。\n'
    ' */\n'
    'const barEl = $("ppBar");\n'
    'function placeBar(el) {\n'
    '  const on = el === listEl || el === playEl;\n'
    '  barEl.classList.toggle("compact", el === playEl);\n'
    '  barEl.classList.toggle("hidden", !on);\n'
    '  if (on && barEl.parentElement !== el) el.appendChild(barEl);\n'
    '}\n'
    'function show(el             ) {\n'
    '  for (const s of [listEl, playEl, colEl, sellEl, rankEl]) s.classList.toggle("hidden", s !== el);\n'
    '  placeBar(el);\n'
    '  refreshTexts(); void setBgm(el === playEl ? "play" : "home");\n'
    '}',
    "show 里搬动作条",
)

# ── 11. 三个动作条入口：在机台里要先退出来 ─────────────────────────
rep(
    '$("colBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); buildCollection(); show(colEl); });',
    '// 动作条现在在娃娃界面也有 ⇒ 三个入口都要先「离开机台」。\n'
    '// 不离开的话 3D 场景还在后台跑 rAF、机台还挂着占用状态，而玩家已经看不到它了。\n'
    '$("colBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); if (inMachine) { leaveMachine(colEl); } else { buildCollection(); show(colEl); } });',
    "colBtn 退机台",
)

rep(
    '$("sellBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); sellSig = ""; buildRecycle(); refreshRedeemBar(); show(sellEl); });',
    '$("sellBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); sellSig = ""; buildRecycle(); refreshRedeemBar(); if (inMachine) { leaveMachine(sellEl); } else { show(sellEl); } });',
    "sellBtn 退机台",
)

rep(
    '$("rankBtn").addEventListener("click", () => { void sfx("ui.tap"); void submitRank(); void buildRanking(); show(rankEl); });',
    '$("rankBtn").addEventListener("click", () => { void sfx("ui.tap"); void submitRank(); void buildRanking(); if (inMachine) { leaveMachine(rankEl); } else { show(rankEl); } });',
    "rankBtn 退机台",
)

# ── 12. 顶栏换币入口 ───────────────────────────────────────────────
rep(
    '$("backBtn").addEventListener("click", () => { void sfx("ui.tap"); leaveMachine(); });',
    '$("backBtn").addEventListener("click", () => { void sfx("ui.tap"); leaveMachine(); });\n'
    '// 顶栏那颗币 = 换币。`audioWarmup()` 要在真手势里发（headless 里 unlock 永不 resolve，只发不等）。\n'
    '$("pCoinsBtn").addEventListener("click", () => { audioWarmup(); void sfx("ui.tap"); openBuySheet(); });',
    "换币入口",
)

miss = []
for old, new, note in edits:
    n = src.count(old)
    if n != 1:
        miss.append(f"{note}: 命中 {n} 次")
        continue
    src = src.replace(old, new, 1)

if miss:
    print("✗ 以下锚点不唯一/不存在，全部未写入：")
    for m in miss:
        print("   " + m)
    sys.exit(1)

GAME.write_text(src, encoding="utf-8")
print(f"✓ {len(edits)} 处全部写入 game.js")
