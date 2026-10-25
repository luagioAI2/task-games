/**
 * 经济改造的端到端验收（直接驱动 Chrome CDP，不依赖 playwright）。
 *
 * 验的是**整条链**，不是「页面能不能打开」：
 *   积分 →(买)→ 娃娃机币 →(玩)→ 一局 →(抓)→ 娃娃 →(回收)→ **兑换券**（不回到币）
 *
 * 以及四件必须**不存在**的事：
 *   · 签到 / 印章 / 每日任务（`#dailyBtn` 不存在，`save.daily` 不再写盘）
 *   · 跳蚤市场（`#fleaBtn` 不存在，自己挂价的路没了）
 *   · 用「销售额」付游玩费（`save.market` 不再写盘）
 *   · 白送币的调试按钮（TEST 菜单里的「金币+1000」已删）
 *
 * 用法: node scripts/e2e-economy.cjs <port> <outDir>
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = process.argv[2] || '4395';
const OUT = process.argv[3] || path.join(__dirname, '..', 'shots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = `http://127.0.0.1:${PORT}/`;
const DBG = 9334;

fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(os.tmpdir(), 'pp-econ-' + Date.now());

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`,
  '--window-size=430,900',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  // 本机系统代理会把 127.0.0.1 也送进代理 → 页面空白、只有 3 个请求。
  '--no-proxy-server',
  '--proxy-bypass-list=*',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const ok = (cond, label, extra) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${label}${extra === undefined ? '' : ' ' + JSON.stringify(extra)}`);
  if (!cond) fail++;
};

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome devtools 未就绪');
}

(async () => {
  let ws, id = 0;
  const pending = new Map();
  const errors = [];

  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });

  try {
    // ---- 0. 服务端到底给的是不是我的代码 ----
    // 这台机器上端口常年被别的项目占着，`vite --strictPort` 绑不上但 curl 照样 200。
    const probe = await (await fetch(BASE + 'game.js')).text();
    ok(probe.includes('createWallet') && probe.includes('回收站'), '服务端提供的是本次构建（game.js 含 wallet/回收站）');

    ws = new WebSocket(await getWsUrl());
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
      }
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (method, params) => send(method, params, sessionId);
    const ev = async (expression) => {
      const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
      return r.result?.value;
    };

    const shot = async (name) => {
      const r = await S('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, name);
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return f;
    };

    await S('Page.enable');
    await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });
    await S('Page.navigate', { url: BASE });

    let playable = false;
    for (let i = 0; i < 120; i++) {
      await sleep(250);
      if ((await ev('window.__gpPlayable === true')) === true) { playable = true; break; }
    }
    ok(playable, '__gpPlayable');
    if (!playable) throw new Error('游戏没起来，后面的断言没意义');
    await sleep(800);

    // ---- 1. 开局余额 ----
    const b0 = await ev('JSON.stringify({coins: __debug.coins, points: __debug.points})');
    const bal0 = JSON.parse(b0);
    ok(bal0.coins === 0 && bal0.points === 30, '开局：0 币 / 30 积分（本地宿主发的）', bal0);

    // ---- 2. 签到 / 市场 / 票 都不在了 ----
    const gone = await ev(`JSON.stringify({
      dailyBtn: !!document.getElementById('dailyBtn'),
      fleaBtn: !!document.getElementById('fleaBtn'),
      ticketBtn: !!document.getElementById('ticketBtn'),
      sellBtn: !!document.getElementById('sellBtn'),
      // 2026-10-22 改版把 #home 那屏删了（首页直接是机台列表），磁贴改成 .ppBar .barTile。
      // 这条断言之前一直红着（#home 不存在 ⇒ 恒 0），红着的断言等于没有断言。
      tiles: document.querySelectorAll('.ppBar .barTile').length,
      saveKeys: Object.keys(__debug.save).sort(),
    })`);
    const g = JSON.parse(gone);
    ok(!g.dailyBtn, '签到入口已删除');
    ok(!g.fleaBtn, '跳蚤市场入口已删除');
    ok(!g.ticketBtn, '免票游玩按钮已删除');
    // 2026-10-23：回收屏取消，卖娃娃收进背包 ⇒ 动作条只剩两格，`#sellBtn` 必须消失
    ok(!g.sellBtn, '「回收」入口已删除（卖娃娃在背包里）', { sellBtn: g.sellBtn });
    ok(g.tiles === 2, '动作条 = 2 格（背包 / 排行）', { tiles: g.tiles });
    ok(!g.saveKeys.includes('daily') && !g.saveKeys.includes('market') && !g.saveKeys.includes('coins') && !g.saveKeys.includes('tickets'),
      '存档里没有 daily / market / coins / tickets', g.saveKeys);

    // ---- 3. 没钱时点 PLAY → 弹「买币」，不是弹「余额不足」 ----
    await ev(`__debug.enter('big-bear')`);
    await sleep(2200);

    // 遮挡探针：`.click()` 会**绕过命中测试**，被别的层盖住也照样绿。
    // 所以「点得动」必须用 elementFromPoint 单独验一次（本项目吃过一次假绿）。
    const hit = async (sel) => ev(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return { ok: false, why: 'missing' };
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return { ok: false, why: 'zero-size', w: r.width, h: r.height };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return { ok: !!top && (top === el || el.contains(top)), top: top ? (top.id || top.className || top.tagName) : null, x: Math.round(x), y: Math.round(y) };
    })()`);

    const brokeLabel = await ev(`document.getElementById('btnPlay').textContent`);
    ok(/买|Buy|買/.test(brokeLabel), '0 币时 PLAY 按钮变成「买币」而不是灰掉', brokeLabel);
    ok((await hit('#btnPlay')).ok, 'PLAY 按钮没被别的层盖住', await hit('#btnPlay'));
    const sBroke = await shot('econ-play-broke.png');

    await ev(`document.getElementById('btnPlay').click()`);
    await sleep(300);
    const buyOpen = await ev(`!document.getElementById('payModal').classList.contains('hidden')`);
    ok(buyOpen === true, '0 币点 PLAY 会弹买币面板');
    ok((await hit('#buyYes')).ok, '买币按钮没被盖住', await hit('#buyYes'));

    // ---- 4. 买 5 个币：积分 -5，币 +5 ----
    await ev(`document.getElementById('buyYes').click()`);
    await sleep(600);
    const b1 = JSON.parse(await ev('JSON.stringify({coins: __debug.coins, points: __debug.points})'));
    ok(b1.coins === 5 && b1.points === 25, '买 5 个币：币 0→5，积分 30→25', b1);

    // ---- 5. 玩一局：币 -1，且真的进入了操作阶段 ----
    const phaseBefore = await ev('__debug.phase');
    await ev(`document.getElementById('btnPlay').click()`);
    await sleep(500);
    const b2 = JSON.parse(await ev('JSON.stringify({coins: __debug.coins, phase: __debug.phase})'));
    ok(b2.coins === 4, '玩一局扣 1 币（5→4）', b2);
    ok(phaseBefore === 'ready' && b2.phase === 'idle_x', 'phase: ready → idle_x（真的开局了）', { phaseBefore, after: b2.phase });

    // ---- 6. 抓到一个娃娃 → 库存 +1（图鉴计数也 +1，但那是另一件事）----
    await ev(`__debug.forceGet(0)`);
    await sleep(900);
    const stock = JSON.parse(await ev('JSON.stringify({stock: __debug.stock, got: __debug.save.gotCounts})'));
    ok(stock.stock.bear === 1, '抓到 1 只熊：stock.bear = 1', stock.stock);
    ok(stock.got.bear === 1, '图鉴 gotCounts.bear = 1', stock.got);

    await ev(`__debug.leave()`);
    await sleep(700);

    // ---- 7. 背包：那只熊能卖，组合条也在 ----
    await ev(`document.getElementById('colBtn').click()`);
    await sleep(450);
    const OWN = `#colGrid .cell[data-owned]:not([data-owned="0"])`;
    const sellState = JSON.parse(await ev(`JSON.stringify({
      open: !document.getElementById('collection').classList.contains('hidden'),
      owned: document.querySelectorAll('${OWN}').length,
      cells: document.querySelectorAll('#colGrid .cell').length,
      combos: document.querySelectorAll('#comboWrap .comboCard').length,
      locked: document.querySelectorAll('#colGrid .cell.locked').length,
    })`));
    ok(sellState.open && sellState.owned === 1, '背包打开，有 1 个可卖的娃娃', sellState);
    ok(sellState.cells > 1 && sellState.locked > 0, '背包里同时保留图鉴（没抓到的格子是锁的）', sellState);
    ok(sellState.combos === 5, '背包顶部有 5 个组合（按 combos.js）', { combos: sellState.combos });

    const sFull = await shot('econ-sell-full.png');

    await ev(`document.querySelector('${OWN}').click()`);
    await sleep(300);
    const sheet2 = await ev(`!document.getElementById('sellModal').classList.contains('hidden')`);
    ok(sheet2 === true, '点娃娃弹出回收面板');
    // 回收面板的三个按钮逐个探遮挡（.click() 绕过命中测试，盖住了也是绿的）
    for (const sel of ['#rcCancel', '#rcOne', '#rcAll']) {
      const h = await hit(sel);
      ok(h.ok, `回收面板 ${sel} 可点（没被底部栏/别的层盖住）`, h);
    }
    const sSheet = await shot('econ-sheet.png');

    await ev(`document.getElementById('rcOne').click()`);
    await sleep(800);
    const b3 = JSON.parse(await ev(`JSON.stringify({
      coins: __debug.coins, stock: __debug.stock, sold: __debug.save.soldCount,
      vouchers: JSON.parse(localStorage.getItem('prizepark.voucher.v1') || '[]').reduce((a, r) => a + r.delta, 0),
    })`));
    // ★ 2026-10-23 起：娃娃 → 兑换券，**不回到币**（币能开局，回币就是「抓娃娃能续玩」）
    ok(b3.coins === 4, '★ 卖 1 只熊不动币（4 还是 4）—— 娃娃不再产币', b3);
    ok(b3.vouchers === 2, '★ 卖 1 只熊 → 直接发 2 张兑换券（rarity 2）', b3);
    ok(b3.stock.bear === 0, '卖完库存归零（不能重复卖）', b3.stock);
    ok(b3.sold === 1, 'soldCount = 1', { sold: b3.sold });

    const shot2 = async (name) => {
      const r = await S('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, name);
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return f;
    };
    const s1 = await shot2('econ-sell.png');

    // ---- 8. 空回收站的提示（卖光之后不该是一块空白）----
    await sleep(400);
    const emptyTxt = await ev(`document.querySelector('#colGrid .bagHead').textContent.trim()`);
    ok(typeof emptyTxt === 'string' && emptyTxt.length > 0, '卖光后背包顶部换成空态文案', emptyTxt.slice(0, 40));
    const stillThere = await ev(`document.querySelectorAll('${OWN}').length`);
    ok(stillThere === 0, '卖光之后没有「有货」的格子（不能重复卖）', { owned: stillThere });

    await ev(`document.getElementById('colBack').click()`);
    await sleep(400);
    const s2 = await shot2('econ-home.png');

    // ---- 9. 存档真的落盘了（刷新后余额还在）----
    await sleep(600);
    const saved = JSON.parse(await ev(`localStorage.getItem('prizepark.save.v1:save') || '{}'`));
    ok(saved.stock && saved.stock.bear === 0, '存档里 stock 已落盘', saved.stock);
    ok(saved.coins === undefined && saved.market === undefined && saved.daily === undefined, '存档里不再有 coins / market / daily');
    const ledger = JSON.parse(await ev(`localStorage.getItem('prizepark.coin.v1') || '[]'`));
    const sum = ledger.reduce((a, r) => a + r.delta, 0);
    // 币只有两笔：买 5、玩一局 -1。卖娃娃不再往这本账上写。
    ok(ledger.length === 2 && sum === 4, '币账本只剩 2 笔（买 + 玩）、合计 4', { rows: ledger.length, sum });
    const vled = JSON.parse(await ev(`localStorage.getItem('prizepark.voucher.v1') || '[]'`));
    const vsum = vled.reduce((a, r) => a + r.delta, 0);
    ok(vsum === 2, '兑换券账本单独一本、合计 2', { rows: vled.length, sum: vsum });

    // ---- 10. 刷新后余额不丢 ----
    await S('Page.navigate', { url: BASE });
    for (let i = 0; i < 120; i++) {
      await sleep(250);
      if ((await ev('window.__gpPlayable === true')) === true) break;
    }
    const b4 = JSON.parse(await ev(`JSON.stringify({
      coins: __debug.coins, points: __debug.points, stock: __debug.stock,
      vouchers: JSON.parse(localStorage.getItem('prizepark.voucher.v1') || '[]').reduce((a, r) => a + r.delta, 0),
    })`));
    ok(b4.coins === 4 && b4.points === 25 && b4.vouchers === 2, '刷新后余额一致（4 币 / 25 积分 / 2 券）', b4);

    // ---- 11. 组合兑换：凑齐一套多给一点 ----
    //
    // 这一段是**唯一**验「加成真的到手」的地方：基础价 6 的三只抱枕，
    // 一起换必须拿到 7（不是 6），而且三只都要消失。
    await ev(`__debug.grant('pillow_pig',1); __debug.grant('pillow_rabbit',1); __debug.grant('pillow_dog',1)`);
    await ev(`document.getElementById('colBtn').click()`);
    await sleep(450);
    const comboTable = JSON.parse(await ev(`JSON.stringify(__debug.combos)`));
    const pillow = comboTable.find(c => c.id === 'pillow3');
    ok(pillow.base === 6 && pillow.bonus === 1 && pillow.total === 7, '组合表：抱枕三兄弟 6 + 1 = 7', pillow);

    const notReady = JSON.parse(await ev(`JSON.stringify({
      ready: document.querySelector('#comboWrap .comboCard[data-combo="cake2"]').dataset.ready,
      text: document.querySelector('#comboWrap .comboCard[data-combo="cake2"] .go').textContent,
    })`));
    ok(notReady.ready === '0' && /\d/.test(notReady.text), '没凑齐的组合卡写着「还缺 N 种」', notReady);

    const ready = await ev(`document.querySelector('#comboWrap .comboCard[data-combo="pillow3"]').dataset.ready`);
    ok(ready === '1', '凑齐的三兄弟变成可兑换', { ready });

    await ev(`document.querySelector('#comboWrap .comboCard[data-combo="pillow3"]').click()`);
    await sleep(350);
    const sheetOpen = await ev(`!document.getElementById('sellModal').classList.contains('hidden')`);
    ok(sheetOpen === true, '点组合卡弹出兑换面板');
    const hb = await hit('#cbGo');
    ok(hb.ok, '「一起兑换」按钮没被别的层盖住', hb);

    await ev(`document.getElementById('cbGo').click()`);
    await sleep(900);
    const b5 = JSON.parse(await ev(`JSON.stringify({
      vouchers: JSON.parse(localStorage.getItem('prizepark.voucher.v1') || '[]').reduce((a, r) => a + r.delta, 0),
      stock: __debug.stock,
      coins: __debug.coins,
    })`));
    ok(b5.vouchers === 9, '★ 组合兑换：券 2 → 9（+7，比单卖三只的 6 张多 1 张）', b5);
    ok(!b5.stock.pillow_pig && !b5.stock.pillow_rabbit && !b5.stock.pillow_dog, '★ 每样消耗 1 个', b5.stock);
    ok(b5.coins === 4, '★ 组合兑换不动币（还是 4）', b5);

    ok(errors.length === 0, '无控制台错误', errors.slice(0, 3));
    console.log('\n截图:', sFull, sSheet, s1, s2);
    console.log(fail === 0 ? '\n=== PASS ===' : `\n=== FAIL (${fail}) ===`);
  } catch (e) {
    console.error('验收脚本自身出错:', e);
    fail++;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(fail === 0 ? 0 : 1);
  }
})();
