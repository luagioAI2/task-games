# -*- coding: utf-8 -*-
"""
一次性完成 game.js 的经济改造手术。

为什么要用脚本而不是十几次 Edit：**同一轮里对同一个文件发多个 Edit 会互相覆盖**
（并行执行、后写的基于旧内容），而且工具还报成功。脚本每次替换前都断言
「锚点存在且只出现一次」，不满足就整体中止 —— 半途改一半的文件比没改更糟。

所有编辑按**行号从大到小**执行，前面的行号才不会漂。
"""
import io
import sys

PATH = r"E:\plan\test25\prize-park-local\game.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

lines = src.split("\n")  # 0-based; 行号 N 对应 lines[N-1]


def at(n, needle):
    """取第 n 行，并断言它包含 needle（防止行号漂了还在乱改）。"""
    line = lines[n - 1]
    if needle not in line:
        raise SystemExit(
            "ABORT: line %d 应该包含 %r，实际是:\n%r" % (n, needle, line[:200])
        )
    return line


def put(n, text):
    lines[n - 1] = text


def cut(a, b):
    """删除 [a, b]（含两端）"""
    del lines[a - 1:b]


def splice(a, b, new_lines):
    """把 [a, b]（含两端）换成 new_lines"""
    lines[a - 1:b] = new_lines


def one(old, new):
    """全文件唯一字符串替换（断言只出现一次）"""
    global src_text
    c = src_text.count(old)
    if c != 1:
        raise SystemExit("ABORT: 锚点出现 %d 次（要求 1 次）:\n%r" % (c, old[:160]))
    src_text = src_text.replace(old, new)


def n_times(old, new, times):
    """全文件替换，断言出现次数正好是 times"""
    global src_text
    c = src_text.count(old)
    if c != times:
        raise SystemExit("ABORT: 锚点出现 %d 次（要求 %d 次）:\n%r" % (c, times, old[:160]))
    src_text = src_text.replace(old, new)


def blank(n):
    if lines[n - 1].strip() != "":
        raise SystemExit("ABORT: line %d 应该是空行，实际是:\n%r" % (n, lines[n - 1][:200]))


# =====================================================================
# 0. 先把「整块替换」要做的新内容准备好
# =====================================================================

RECYCLE_BLOCK = r'''// ---------- 回收站（卖掉娃娃换娃娃机币）----------
// 这里原来是「跳蚤市场」：自己挂价 → 假买家每 6 秒逛一次 → 卖掉进「销售额」钱包，
// 而那个钱包还能直接付游玩费。三件事一起坏：
//   ① 价格是玩家自己定的 ⇒ 自己挂 1 万卖给自己，任何闸门都拦不住；
//   ② 卖出能换游玩费 ⇒ 抓娃娃本身能赚钱 = 印钞机（原版没有期望值不变量）；
//   ③ 200 行假买家 / 点赞 / 行情漂移，玩家既看不懂也改不了（行情不归他管）。
// 现在：**固定回收价**（只由稀有度决定，见 recycle.js）+ 一键回收 → 直接铸娃娃机币。
// 玩家剩下的唯一决策是「现在卖还是留着看」，这正是我们要的那个决策。

/** 手上还有几个。⚠️ 不是 `gotCounts` —— 那个是「一共抓到过几个」，只增不减，
 *  它同时是图鉴进度（`compRate()` 拿它算收集率）。卖掉娃娃不该让图鉴倒退。 */
function stockOf(id) { return save.stock?.[id] ?? 0; }

let sellSig = "";

function buildRecycle() {
  const g = $("sellGrid");
  const sig = JSON.stringify([lang, save.stock, save.snacks]);
  if (sig === sellSig && g.children.length) return;  // 结构没变就别重建（重建会让缩略图闪一下）
  sellSig = sig; g.innerHTML = "";

  const rows = [];
  for (const id of Object.keys(PRIZE_META)) {
    if (id === "snackbox" || id.startsWith("sweet_")) continue;
    const n = stockOf(id);
    if (n > 0) rows.push({ id, n, each: recycleValue(id) });
  }
  for (const sd of SWEETS) {
    const n = save.snacks?.[sd.id]?.quantity ?? 0;
    if (n > 0) rows.push({ id: sd.id, n, each: recycleValue(sd.id) });
  }

  const head = document.createElement("div");
  head.style.cssText = "grid-column:1/-1;font-weight:800;font-size:13px;color:#6f6889;line-height:1.6;text-align:center";
  head.textContent = rows.length ? T("sellSub") : T("nothingToSell");
  g.appendChild(head);
  if (!rows.length) return;

  for (const r of rows) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.innerHTML = `<div class="ico">${prizeImg(r.id, 64)}</div><div>${prizeName(r.id)}</div>` +
      `<div style="color:#8b84a3;font-size:12px">×${r.n}</div>` +
      `<div style="color:${hex(PALETTE.pink)};font-size:14px;font-weight:900">${COIN.emoji} ${r.each}</div>`;
    cell.addEventListener("click", () => { void sfx("ui.tap"); openRecycleSheet(r.id); });
    g.appendChild(cell);
  }
}

/**
 * 真的卖。返回 `false` = 没卖成。
 *
 * ⚠️ 顺序固定：**先扣库存，再进账**。
 * 反过来的话，进账成功、扣库存失败（比如中途抛错）就是「娃娃还在、币已经到」，
 * 可以无限重复卖 —— 那是一条印钞机。先扣库存最坏是「娃娃没了、币没到」，
 * 那是玩家吃亏，会来投诉；重复铸币则是**静默通胀**，没人会发现。
 */
async function sellStock(id, n) {
  const isSweet = id.startsWith("sweet_");
  const have = isSweet ? (save.snacks?.[id]?.quantity ?? 0) : stockOf(id);
  const qty = Math.max(0, Math.min(have, Math.round(n) || 0));
  if (qty <= 0) return false;
  const gain = recycleValue(id) * qty;

  if (isSweet) { const row = save.snacks?.[id]; if (row) row.quantity = Math.max(0, row.quantity - qty); }
  else save.stock[id] = Math.max(0, stockOf(id) - qty);
  save.soldCount = (save.soldCount ?? 0) + qty;
  persist();

  const ok = await wallet.earn(gain, `回收 ${prizeName(id)} ×${qty}`);
  sellSig = "";
  if (alive) { refreshTexts(); buildRecycle(); }
  return ok;
}

function openRecycleSheet(id) {
  const isSweet = id.startsWith("sweet_");
  const have = isSweet ? (save.snacks?.[id]?.quantity ?? 0) : stockOf(id);
  const each = recycleValue(id);
  const sh = $("sellSheet");
  sh.className = "sheet";
  sh.innerHTML = `<div class="big">${prizeImg(id, 110)}</div><h3>${prizeName(id)}</h3>
    <div class="dim">${T("recycleEach")} ${COIN.emoji} <b>${each}</b> · ${T("owned")} ×${have}</div>
    <div class="calc"><div class="tot"><span>${T("sellAll")} ×${have}</span><span>${COIN.emoji} ${each * have}</span></div></div>
    <div class="row"><button class="pill" id="rcCancel">${T("cancel")}</button><button class="pill pink" id="rcOne">${T("sellOne")} · ${COIN.emoji}${each}</button></div>
    <button class="pill mint" id="rcAll" style="width:100%">${T("sellAll")} ×${have} · ${COIN.emoji}${each * have}</button>`;
  $("sellModal").classList.remove("hidden");
  $("rcCancel").addEventListener("click", () => { void sfx("ui.tap"); $("sellModal").classList.add("hidden"); });
  const finish = async (n) => {
    void sfx("crane.confirm");
    const ok = await sellStock(id, n);
    if (!ok) { toast(T("recycleFail")); $("sellModal").classList.add("hidden"); return; }
    if (!alive) return;
    sh.innerHTML = `<h3 style="font-size:26px">✓ ${T("recycled")}</h3><div style="font-size:34px;font-weight:900;color:${hex(PALETTE.pink)}">${COIN.emoji} +${each * n}</div>`;
    void sfx("prize.get");
    spawnConfettiIn($("sellModal"));
    setTimeout(() => { if (alive) $("sellModal").classList.add("hidden"); }, 900);
  };
  $("rcOne").addEventListener("click", () => { void finish(1); });
  $("rcAll").addEventListener("click", () => { void finish(have); });
}

function spawnConfettiIn(host) {
  const c = document.createElement("div"); c.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20"; host.appendChild(c);
  const cols = [hex(PALETTE.pink), hex(PALETTE.lavender), hex(PALETTE.mint), hex(PALETTE.cream), "#ffd166"];
  for (let i = 0; i < 40; i++) { const d = document.createElement("div"); d.className = "cf"; d.style.left = `${(i * 37) % 100}%`; d.style.background = cols[i % cols.length]; d.style.animationDuration = `${1.8 + (i % 5) * 0.3}s`; d.style.animationDelay = `${(i % 7) * 0.1}s`; c.appendChild(d); }
  setTimeout(() => c.remove(), 4000);
}

$("sellBtn").addEventListener("click", async () => { if (sound) { try { await sound.unlock(); } catch { /* */ } } void sfx("ui.tap"); sellSig = ""; buildRecycle(); show(sellEl); });
$("sellBack").addEventListener("click", () => { void sfx("ui.tap"); show(titleEl); });'''

BUY_SHEET = r'''function openBuySheet() {
  const can = wallet.affordable();
  const n = Math.min(5, can);
  const cost = n * POINTS_PER_COIN;
  const sh = $("paySheet");
  sh.innerHTML = `<h3>${COIN.emoji} ${T("buyCoins")}</h3>
    <div class="dim">${T("coinsShort")} · ${T("owned")} ${COIN.emoji} ${wallet.coins}</div>
    <div class="calc"><div><span>${T("pointsLeft")}</span><span>🪙 ${wallet.points}</span></div><div><span>${T("buyN").replace("{n}", String(n))}</span><span>${COIN.emoji} +${n} · 🪙 -${cost}</span></div></div>
    <div class="row"><button class="pill" id="buyNo">${T("cancel")}</button><button class="pill pink" id="buyYes" ${n <= 0 ? "disabled" : ""}>${T("buyN").replace("{n}", String(n))}</button></div>`;
  $("payModal").classList.remove("hidden");
  $("buyNo").addEventListener("click", () => { void sfx("ui.tap"); $("payModal").classList.add("hidden"); });
  $("buyYes").addEventListener("click", async () => {
    if (n <= 0) return;
    const ok = await wallet.buy(n);
    $("payModal").classList.add("hidden");
    if (!ok) { toast(T("recycleFail")); return; }
    void sfx("prize.get"); toast(`${COIN.emoji} +${n}`); refreshTexts();
  });
}'''

START_PLAY = r'''let paying = false;
/**
 * 开一局。
 *
 * ⚠️ 是 async 的，因为扣币要等宿主的事务（IndexedDB 写入，几毫秒）。
 * 这中间有一个真实的竞态窗口：`crane.phase` 还是 "ready"，连点两下会两次都过守卫。
 * 所以两道锁：这里的 `paying`，和钱包内部的 `serial`。
 */
async function startPlay() {
  void startMusic(); reassertMusic(); // PLAY tap is a real gesture: unlock + (re)assert the play BGM in the same tap, idempotent (runtime swaps state, never stacks)
  if (!inMachine || !(crane.phase === "ready" || crane.phase === "fail")) return;
  if (paying) return;
  if (!wallet.canPlay()) { void sfx("ui.tap"); openBuySheet(); return; }

  paying = true;
  let paid = false;
  try { paid = await wallet.pay(currentMachine.price); } finally { paying = false; }
  if (!alive) return;
  if (!paid) { void sfx("ui.tap"); openBuySheet(); return; }
  if (!inMachine) return;   // 付完这几毫秒里玩家退出了机台

  notePlay(currentMachine.id); sweetsArmed = true; persist(); refreshTexts();
  $("missTag").classList.add("hidden");
  void sfx("play.start");
  crane.phase = "idle_x"; crane.t = 0; updateStep();
}'''

UPDATE_STEP = r'''  const canPay = wallet.canPlay();
  btnPlay.disabled = !canPay; $("noCoins").classList.toggle("hidden", !(ready && !canPay)); $("noCoins").textContent = T("coinsShort");
  btnPlay.innerHTML = ph === "fail" ? `${T("again")} <small>${currentMachine.price} ${COIN.emoji}</small>` : `${T("playBtn")} <small>${currentMachine.price} ${COIN.emoji}</small>`;'''

SELL_SCREEN = r'''<div id="sell" class="screen hidden">
  <div class="topbar"><button id="sellBack" class="iconBtn">‹</button><div class="grow" data-t="sellTitle"></div><span id="sCoins" class="coinTag"></span></div>
  <div class="grid" id="sellGrid"></div>
  <div id="sellModal" class="overlay hidden"><div class="sheet" id="sellSheet"></div></div>
</div>'''

REFRESH_WALLET = r'''  const coinTxt = `${COIN.emoji} ${wallet.coins}`, ptsTxt = `🪙 ${wallet.points}`;
  $("tCoins").textContent = coinTxt; $("tPoints").textContent = ptsTxt;
  $("lCoins").textContent = coinTxt; $("lYen").textContent = ptsTxt; $("cCoins").textContent = coinTxt; $("pCoins").textContent = coinTxt; $("sCoins").textContent = coinTxt;'''

LOAD_SAVE = r'''const save = { v: 1, coinMigrated: false, gotCounts: {}, stock: {}, firstGot: {}, layouts: {} };
function loadSave() {
  try {
    const s = gp.player.saves.latestSync;
    if (s && typeof s === "object") {
      Object.assign(save, s);
      save.layouts = s.layouts ?? {};
      save.gotCounts = s.gotCounts ?? {};
      save.firstGot = s.firstGot ?? {};
      if (s.lang) lang = pick(s.lang);
    }
  } catch { /* guest / no save */ }
  // 老档没有 stock —— 那时候「手上还有几个」是 gotCounts − 在架数量算出来的。
  // 现在没有在架了，直接按 gotCounts 补齐：宁可多给几个，也不要让人以为娃娃丢了。
  if (!save.stock || typeof save.stock !== "object") {
    save.stock = {};
    for (const [id, n] of Object.entries(save.gotCounts)) save.stock[id] = n;
  }
  // 这三样都随经济改造退场了，留着只会让下一个人以为它们还有用。
  delete save.coins; delete save.tickets; delete save.market; delete save.daily;
}'''

# =====================================================================
# 1. 从大到小改（行号从大到小，前面才不漂）
# =====================================================================

# ---- 3103 screen getter ----
at(3103, "get screen()")
put(3103, '  get screen() { return [titleEl, listEl, playEl, colEl, sellEl].find(s => !s.classList.contains("hidden"))?.id; },')

# ---- 3100/3101 debug getters ----
at(3100, "get coins()")
put(3100, '  get cam() { return camMode; }, get camPos() { return camera.position.toArray(); }, get coins() { return wallet.coins; }, get points() { return wallet.points; }, get stock() { return save.stock; }, get save() { return save; }, get lang() { return lang; },')
at(3101, "get pendingSold()")
put(3101, '  enter(id) { const m = MACHINES.find(x => x.id === id); if (m) enterMachine(m); }, leave() { leaveMachine(); }, get inMachine() { return inMachine; },')

# ---- 3007 mySales 展示 ----
at(3007, "mySales()")
put(3007, '  $("rankYouSales").textContent = `×${mySales().toLocaleString()}`;')

# ---- 2995 mySales 口径 ----
at(2995, "save.totalSales")
put(2995, 'function mySales() { return Math.round(save.soldCount ?? 0); }')

# ---- 2968-2972 show() ----
at(2968, "for (const s of")
put(2968, '  for (const s of [titleEl, listEl, playEl, colEl, sellEl, rankEl]) s.classList.toggle("hidden", s !== el);')
at(2969, "const cur =")
put(2969, '  const cur = el === titleEl ? "home" : el === listEl || el === playEl ? "play" : el === colEl ? "col" : el === sellEl ? "sell" : el === rankEl ? "rank" : "menu";')
at(2972, "flushPendingSold")
cut(2972, 2972)

# ---- 2931 / 2921 test 菜单里的印钞按钮 ----
at(2931, 'save.coins += 1000')
cut(2931, 2931)
at(2921, "tCoins")
cut(2921, 2921)

# ---- 2511..2724 跳蚤市场 → 回收站 ----
at(2511, "---------- flea market ----------")
blank(2724)
splice(2511, 2724, RECYCLE_BLOCK.split("\n") + [""])

# ---- 2443..2510 每日/签到整块删除 ----
at(2443, "---------- daily ----------")
blank(2510)
cut(2443, 2510)

# ---- 2078..2086 openProceedsPay → openBuySheet ----
at(2078, "function openProceedsPay()")
at(2085, "payYes")
splice(2078, 2086, BUY_SHEET.split("\n"))

# ---- 2059..2077 startPlay ----
at(2059, "function startPlay(")
at(2076, 'crane.phase = "idle_x"')
at(2077, "}")
splice(2059, 2077, START_PLAY.split("\n"))

# ---- 2053..2056 updateStep 尾部 ----
at(2053, "const canPay =")
at(2056, "btnPlay.innerHTML")
splice(2053, 2056, UPDATE_STEP.split("\n"))

# ---- 604 buildCollection 里的「上架中」标记 ----
at(604, "snackReserved")
put(604, '    for (const sd of SWEETS) { const row = save.snacks?.[sd.id]; const q = row?.quantity ?? 0; const el = document.createElement("div"); el.className = "snackRow" + (q ? "" : " locked"); el.innerHTML = `${prizeImg(sd.id, 56)}<div class="nm">${q ? prizeName(sd.id) : T("unknown")}</div><div class="qty">×${q}</div>`; L.appendChild(el); }')

# ---- 503..506 refreshTexts 里跟市场/每日有关的那几行 ----
at(503, "dCoins")
at(506, "tProceeds")
cut(503, 506)

# ---- 495..496 钱包显示 ----
at(495, "tTickets")
at(496, "lYen")
splice(495, 496, REFRESH_WALLET.split("\n"))

# ---- 483 元素引用 ----
at(483, "const titleEl =")
put(483, 'const titleEl = $("title"), listEl = $("list"), playEl = $("play"), colEl = $("collection"), sellEl = $("sell"), viewportEl = $("viewport");')

# ---- 462 用票游玩（票来自签到，已删） ----
at(462, "ticketBtn")
cut(462, 462)

# ---- 429..442 市场页 → 回收站页 ----
at(429, 'id="flea"')
at(441, "settingsModal")
at(442, "</div>")
splice(429, 442, SELL_SCREEN.split("\n"))

# ---- 413..417 每日页删除 ----
at(413, 'id="daily"')
at(417, "</div>")
cut(413, 417)

# ---- 389/390 首页磁贴（dailyBtn 在 390，fleaBtn 在 389）----
at(390, 'id="dailyBtn"')
cut(390, 390)
at(389, 'id="fleaBtn"')
put(389, '      <button id="sellBtn" class="glass tile"><span class="ico">♻️</span><span data-t="sell"></span></button>')

# ---- 385 钱包行 ----
at(385, "tProceeds")
put(385, '    <div class="wallet"><span id="tCoins"></span><span id="tPoints"></span></div>')

# ---- 379 设置弹层从 #flea 里挪出来（它原来在隐藏的 screen 里，从首页根本弹不出来） ----
at(379, "busyModal")
put(379, lines[378] + '\n<div id="settingsModal" class="overlay hidden"><div class="sheet" id="settingsSheet"></div></div>')

# ---- 375 底部导航 ----
at(375, 'data-nav="flea"')
put(375, '  <button data-nav="sell"><span>♻️</span><small data-t="navSell"></small></button>')

# ---- 363 / 362 yen 与 trendArrow（只被市场用过） ----
at(363, "trendArrow")
cut(363, 363)
at(362, "const yen =")
cut(362, 362)

# ---- 361 ownedCount ----
at(361, "function ownedCount(")
put(361, 'function ownedCount(id) { return save.stock?.[id] ?? 0; }')

# ---- 67 / 63..66 loadSave 尾部 ----
at(67, "ensureDaily()")
cut(67, 67)
at(63, "save.market")
at(66, "Object.entries(save.market.prices)")
cut(63, 66)

# ---- 57 save 初始形状 ----
at(57, "const save ")
splice(57, 57, LOAD_SAVE.split("\n"))

# ---- 11..12 导入 ----
at(11, 'from "./daily.js"')
at(12, 'from "./market.js"')
splice(11, 12, [
    'import { createWallet, loadWalletFromHost, COIN, POINTS_PER_COIN } from "./wallet.js";',
    'import { recycleValue } from "./recycle.js";',
])

# =====================================================================
# 2. 处理完之后再做「单点字符串替换」（这些位置行号不好数，靠唯一性断言）
# =====================================================================

src_text = "\n".join(lines)

# 收货三处：去掉 daily / releasePrize，补 stock++
# 前两条锚点在文件里各出现 **2 次**（大熊台 / 桥渡台 + 抓取台 / 章鱼烧台），
# 它们逐字相同 —— 用 one() 会直接中止，这里显式写次数。
n_times(
    '  save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; dailyHit("get"); challengeGet();\n'
    '  if (isNew) { save.firstGot[id] = new Date().toISOString().slice(0, 10); releasePrize(save.market , id, Date.now()); }',
    '  save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; save.stock[id] = (save.stock[id] ?? 0) + 1;\n'
    '  if (isNew) save.firstGot[id] = new Date().toISOString().slice(0, 10);',
    2,
)
one(
    '  const isNew = !(save.gotCounts[id] ?? 0); save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1;\n'
    '  if (isNew) { save.firstGot[id] = new Date().toISOString().slice(0, 10); releasePrize(save.market , id, Date.now()); }',
    '  const isNew = !(save.gotCounts[id] ?? 0); save.gotCounts[id] = (save.gotCounts[id] ?? 0) + 1; save.stock[id] = (save.stock[id] ?? 0) + 1;\n'
    '  if (isNew) save.firstGot[id] = new Date().toISOString().slice(0, 10);',
)
one(
    '    const items = Object.entries(sweetHaul); sweetHaul = {}; if (!items.length) return; dailyHit("get"); challengeGet(); afterPlayBusyCheck();',
    '    const items = Object.entries(sweetHaul); sweetHaul = {}; if (!items.length) return; afterPlayBusyCheck();',
)
one('  missN++; challengeMiss(); afterPlayBusyCheck();', '  missN++; afterPlayBusyCheck();')

# 键盘 / 按钮都改成不带参数的 startPlay
one('if (e.code === "Space" || e.code === "Enter") startPlay(false);', 'if (e.code === "Space" || e.code === "Enter") void startPlay();')
one('btnPlay.addEventListener("click", () => startPlay(false));', 'btnPlay.addEventListener("click", () => { void startPlay(); });')
one('$("ticketBtn").addEventListener("click", () => startPlay(true));\n', '')

# 底部导航 + 菜单里的入口
one('  else if (k === "flea") $("fleaBtn").click();', '  else if (k === "sell") $("sellBtn").click();')
one(
    '<div class="menuList"><button class="pill pink" id="mnDaily">🎟️ ${T("daily")}</button><button class="pill" id="mnRank">',
    '<div class="menuList"><button class="pill" id="mnRank">',
)
one('    $("mnDaily").addEventListener("click", () => { $("menuModal").classList.add("hidden"); $("dailyBtn").click(); });\n', '')

# makeScroller 的注册
one(
    'makeScroller($("cards")); makeScroller($("lstCats"), "x"); makeScroller($("colGrid")); makeScroller($("fleaList")); makeScroller($("home")); makeScroller($("dailyList"));',
    'makeScroller($("cards")); makeScroller($("lstCats"), "x"); makeScroller($("colGrid")); makeScroller($("sellGrid")); makeScroller($("home"));',
)

# 钱包：在 createGame 里造，紧挨着 gp
one(
    'const gp = makeGp({ host, initialSave });',
    'const gp = makeGp({ host, initialSave });\n'
    '\n'
    '// 钱包。余额快照由入口（plugin.js / main.js）在挂载前读好传进来 —— 和存档同一个理由：\n'
    '// 游戏在求值阶段就同步读 `wallet.coins`（refreshTexts 在 boot 段直接调用）。\n'
    '// onChange 只做重画，不写盘：币的事实只在宿主账本里，这边是它的一份镜像。\n'
    'const wallet = createWallet({\n'
    '  host,\n'
    '  coins: walletInit?.coins ?? 0,\n'
    '  points: walletInit?.points ?? 0,\n'
    '  onChange: () => { if (alive) refreshTexts(); },\n'
    '});',
)
one(
    'const { container, host, save: initialSave = null, assetBase = "" } = ctx;',
    'const { container, host, save: initialSave = null, wallet: walletInit = null, assetBase = "" } = ctx;',
)

# 窗口重新可见时对一次账（另一个标签页/内置娃娃机可能花掉了币）
one(
    'document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reassertMusic(); });',
    'document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { reassertMusic(); void wallet.refresh(); } });',
)

out = src_text
with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
    f.write(out)

print("OK  lines: %d -> %d" % (len(src.split("\n")), len(out.split("\n"))))
