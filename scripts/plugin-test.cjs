/**
 * 插件包端到端测试：**照宿主 loader 的方式**加载单文件包并挂载。
 *
 * 为什么这一步不能省：
 *  - 打包器说"0 个裸说明符"只是静态检查。真正会炸的是 blob: URL 下的
 *    相对路径解析、以及 `import.meta.url` 相关的东西 —— 只有真的 blob import 一次才知道。
 *  - 顺带验 `assetBase`：不给的话纹理全 404，而且报错是一堆 "could not load texture"，
 *    看着像打包坏了。
 *
 * 用法: node scripts/plugin-test.cjs <port>
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.argv[2] || '4392';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9336;
const OUT = path.join(__dirname, '..', 'shots', 'plugin');
fs.mkdirSync(OUT, { recursive: true });

const profile = path.join(require('node:os').tmpdir(), 'pp-plugin-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--window-size=430,900', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--no-proxy-server', '--proxy-bypass-list=*', '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('devtools 未就绪');
}

(async () => {
  let ws, id = 0, fail = 0;
  const pending = new Map();
  const errors = [];
  const badReqs = [];
  const send = (m, p = {}, s) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method: m, params: p, sessionId: s }));
  });
  const ok = (c, msg, extra) => {
    console.log(`   ${c ? '✓' : '✗'} ${msg}${extra === undefined ? '' : '  ' + JSON.stringify(extra)}`);
    if (!c) fail++;
  };

  try {
    ws = new WebSocket(await wsUrl());
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
        return;
      }
      if (m.method === 'Network.responseReceived') {
        const { url, status } = m.params.response;
        // favicon 是这个测试页自己请求的，跟插件包无关 —— 不排除的话每次都会假报一条 404
        if (status >= 400 && !/\/favicon\.ico$/.test(url)) badReqs.push(status + ' ' + url);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push('EXC ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
      }
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });

    const evalv = async (expr) => {
      const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { __err: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
      return r.result?.value;
    };

    await S('Page.navigate', { url: `http://127.0.0.1:${PORT}/_plugin-test.html` });
    for (let i = 0; i < 80; i++) { await sleep(200); if (await evalv('window.__ready === true')) break; }

    console.log('\n--- 1. blob URL 加载 + 挂载 ---');
    const meta = await evalv('window.__t.loadAndMount()');
    if (meta && meta.__err) { ok(false, '加载/挂载抛错', meta.__err.slice(0, 400)); throw new Error('中止'); }
    ok(true, 'blob import 成功，包内有 mount/manifest', meta.keys);
    ok(meta.id === 'prizepark', 'manifest.id = prizepark', meta.id);
    ok(meta.tabLabel === '奖品园', 'tabLabel 是「奖品园」（不能和内置娃娃机同名）', meta.tabLabel);
    // 不写死版本号（写死的话宿主一升代，这里就红，而产品完全正常）。
    // 真正要守的是：**插件要求的版本不能超过这个假宿主实现的版本** ——
    // 超过了，测试就会在「调一个不存在的方法」上炸，报错还像产品坏了。
    const fakeApi = await evalv('window.__HOST_API');
    ok(meta.minHostApi <= fakeApi, `minHostApi ${meta.minHostApi} ≤ 假宿主 ${fakeApi}（它得实现 mintVoucher）`, {
      need: meta.minHostApi, have: fakeApi,
    });
    ok(meta.minHostApi >= 4, 'minHostApi ≥ 4（娃娃 → 兑换券走 mintVoucher）', meta.minHostApi);
    ok(!!meta.coin && typeof meta.coin.name === 'string', 'manifest.coin 形状正确', meta.coin);
    const e = meta.economy || {};
    ok(typeof e.playCost === 'number' && typeof e.expectedPayout === 'number', 'economy 数值齐全', e);
    ok(e.expectedPayout < e.playCost, '硬不变量 expectedPayout < playCost 成立', { play: e.playCost, out: e.expectedPayout });
    ok(e.voucherPerCoin === 1, 'voucherPerCoin = 1（1 币 = 1 兑换券）', e.voucherPerCoin);
    ok(e.expectedPayout * e.voucherPerCoin < e.playCost, '一局期望换出的券 < 一局成本（不能刷积分）',
      { vouchers: +(e.expectedPayout * e.voucherPerCoin).toFixed(3), play: e.playCost });

    let playable = false;
    for (let i = 0; i < 120; i++) { await sleep(200); if (await evalv('window.__gpPlayable === true')) { playable = true; break; } }
    ok(playable, '插件内 __gpPlayable = true');

    await sleep(1500);
    const st = JSON.parse(await evalv('JSON.stringify(window.__t.state())'));
    ok(st.canvases === 1, 'canvas 已挂到宿主容器里', { canvases: st.canvases });

    /*
     * 样式作用域（对照组）。
     *
     * 游戏样式表里有 `.grid{overflow-y:auto;cursor:grab;touch-action:none;…}`。
     * 没做作用域时它会盖掉宿主自己的 `.grid`（未分层样式胜 `@layer`），
     * 症状是「切走以后农场页的网格变成可拖拽的两列小卡片」。
     * 所以这里量的**不是游戏**，是游戏外面的那个对照元素。
     */
    const ctl = JSON.parse(await evalv('JSON.stringify(window.__t.control())'));
    ok(ctl.cursor !== 'grab' && ctl.overflowY !== 'auto',
      '插件样式没有泄漏到宿主（对照 .grid 未被改写）', ctl);

    // 进机台：这条路径会同时用到纹理（assetBase）和 fx
    await evalv("window.__debug.enter('big-bear')");
    await sleep(2200);
    const inM = JSON.parse(await evalv('JSON.stringify({ p: __debug.inMachine, n: __debug.prizes.length })'));
    ok(inM.p === true && inM.n > 0, '进入机台且奖品已生成', inM);

    // ⚠️ 尺寸要在**机台视图可见之后**量。之前放在进机台之前，`#viewport` 的父级
    // 还是 display:none，clientWidth 恒为 0 —— 量出来像是"画布尺寸算错了"，其实是没显示。
    //
    // ⚠️ 也别断言"画布 = 容器"：`#viewport` 是机台 UI 里 3D 那一块，
    // 上面有「剩余×3」标签、下面有 PLAY 按钮，本来就比整屏小（实测 378×538 / 容器 390×780）。
    // 正确的不变量是「画布 = viewport 元素」，再加上「viewport 确实跟着容器缩放」。
    const stM = JSON.parse(await evalv('JSON.stringify(window.__t.state())'));
    console.log('   尺寸链:', JSON.stringify({
      window: stM.window, hostEl: stM.hostEl, root: stM.root,
      viewportEl: stM.viewportEl, canvasCss: stM.canvasCss, canvasBuf: stM.canvasBuf,
    }));
    ok(!!stM.canvasCss && stM.canvasCss.w === stM.viewportEl.w && stM.canvasCss.h === stM.viewportEl.h,
      '画布尺寸 = viewport 元素尺寸', { canvas: stM.canvasCss, vp: stM.viewportEl });
    ok(stM.viewportEl.w > 0 && stM.viewportEl.h > 0, 'viewport 有实际尺寸（不是 0）', stM.viewportEl);
    const hRatio = stM.viewportEl.h / stM.hostEl.h;
    ok(hRatio > 0.5 && hRatio < 1, 'viewport 高度占容器的 50%~100%（跟着容器缩放，不是按 window）',
      { ratio: +hRatio.toFixed(3) });
    ok(stM.canvasBuf.w === Math.round(stM.viewportEl.w * stM.window.dpr),
      '绘制缓冲 = CSS 尺寸 × DPR（没有按 window 尺寸算）',
      { buf: stM.canvasBuf.w, expect: Math.round(stM.viewportEl.w * stM.window.dpr) });

    const shot = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, 'plugin-mounted.png'), Buffer.from(shot.data, 'base64'));

    // ---- 1b. 经济链在**宿主模式**下真的接通了 ----
    //
    // 为什么这一段必须在插件测试里、而不是只在小游戏自己的 e2e 里：
    // 独立运行时钱包走的是 main.js 的 localStorage 宿主；装进 App 之后走的是
    // `host.buyGameCoin / spendGameCoin / mintVoucher`。两条路**完全不同的代码**，
    // 而失败形态都是「点了没反应」，不会报错。
    console.log('\n--- 1b. 经济链（宿主 API）---');
    const led0 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led0.points === 100 && led0.coins === 0, '起点：宿主 100 积分 / 0 币', led0);

    const bought = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.buyOnce()))()'));
    ok(bought.opened === true, '0 币时 PLAY 按钮打开的是买币面板', bought);
    ok(bought.coins === 5 && bought.points === 95, '买 5 个币走 host.buyGameCoin：币 0→5、积分 100→95', bought);

    const played = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.playOnce()))()'));
    ok(played.after === 4, '玩一局走 host.spendGameCoin：币 5→4', played);
    ok(played.phase === 'idle_x', '真的开局了（phase = idle_x）', played.phase);

    const sold = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.grabAndSell()))()'));
    ok(sold.cells === 1, '背包里能看到刚抓到的娃娃（有货的格子只算这一个）', { cells: sold.cells });
    // ★ 2026-10-23 起：娃娃**不产币**，直接发兑换券。
    //   币是「买来的入场券」，券是「抓来的战利品」—— 混起来抓娃娃就能续玩。
    ok(sold.coins === 4, '★ 卖娃娃**不动币**（4 还是 4）—— 娃娃不再产币', { coins: sold.coins });
    ok(sold.vouchers === 2, '★ 卖 1 只 rarity 2 的娃娃 → 直接发 2 张兑换券（host.mintVoucher）', { vouchers: sold.vouchers });
    const led1 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led1.rows === 2 && led1.coins === 4, '宿主币账本只剩 2 笔（买 + 玩）、合计 4', led1);

    // ---- 1c. 币 → 兑换券（HOST_API 3 的最后一跳）----
    console.log('\n--- 1c. 换成兑换券（游戏币 → 兑换券）---');
    const rd = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.redeemAll()))()'));
    ok(rd.after.coins === 0, '换完之后币清零（6 → 0）', rd);
    ok(rd.after.vouchers === 6, '兑换券合计 6 张（娃娃发的 2 + 4 币换的 4）', rd);
    const led2 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led2.rows === 3 && led2.coins === 0 && led2.vouchers === 6,
      '币账本多一笔负数（3 笔）、券记在另一本账上', led2);

    // ---- 1d. 组合兑换（凑齐一套 → 加成）----
    //
    // 为什么这一段必须存在：组合的加成是**唯一**会让「一局期望产出」上涨的地方，
    // 而它只在凑齐的那一刻触发 —— 漏了它，`expectedPayout: 0.75` 就没人验。
    console.log('\n--- 1d. 组合兑换 ---');
    const comboTable = JSON.parse(await evalv('JSON.stringify(window.__debug.combos)'));
    const pillow = comboTable.find(c => c.id === 'pillow3');
    ok(!!pillow && pillow.base === 6 && pillow.bonus === 1 && pillow.total === 7,
      '组合表：抱枕三兄弟 = 基础 6 + 加成 1 = 7', pillow);

    // 没凑齐时点卡片**不能**弹兑换层（也不能弹报错）
    const before = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.exchangeCombo("pillow3")))()'));
    ok(before.found === true && before.ready === false && before.sheetOpen === false,
      '没凑齐时点组合卡：不弹兑换层', { ready: before.ready, sheetOpen: before.sheetOpen });

    // 凑齐（`grant` 只改库存，兑换本身仍然走界面）
    await evalv('window.__debug.grant("pillow_pig",1); window.__debug.grant("pillow_rabbit",1); window.__debug.grant("pillow_dog",1)');
    await evalv('document.getElementById("colBtn").click()');
    const readyNow = JSON.parse(await evalv('JSON.stringify([...document.querySelectorAll("#comboWrap .comboCard")].map(c=>({id:c.dataset.combo,ready:c.dataset.ready})))'));
    ok(readyNow.find(c => c.id === 'pillow3')?.ready === '1', '凑齐之后组合卡变成「可兑换」', readyNow);

    const ex = JSON.parse(await evalv('(async () => JSON.stringify(await window.__t.exchangeCombo("pillow3")))()'));
    ok(ex.after.vouchers === 13, '★ 组合兑换：券 6 → 13（+7，比单卖 3 只的 6 张多 1 张）', ex.after);
    ok(ex.after.stock.pillow_pig === 0 && ex.after.stock.pillow_rabbit === 0 && ex.after.stock.pillow_dog === 0,
      '★ 每样消耗 1 个（三只都没了）', ex.after.stock);
    ok(ex.combos.find(c => c.id === 'pillow3')?.ready === '0', '兑换完组合卡立刻变回「还缺 3 种」', ex.combos);
    const led3 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led3.rows === 3 && led3.coins === 0, '组合兑换**没有**碰币账本（还是 3 笔 / 0 币）', led3);

    console.log('\n--- 2. 资源与网络 ---');
    ok(badReqs.length === 0, '没有 4xx/5xx 请求（assetBase 正确）', badReqs.slice(0, 4));

    console.log('\n--- 3. 卸载 ---');
    const u = await evalv('window.__t.unmountIt()');
    ok(u === true, 'unmount 完成');
    await sleep(500);
    const st2 = JSON.parse(await evalv('JSON.stringify(window.__t.state())'));
    ok(st2.canvases === 0, '卸载后无 canvas 残留', { canvases: st2.canvases });
    ok(st2.children === 0, '卸载后容器为空', { children: st2.children });
    // 存档断言必须放在卸载**之后**：写入是 400ms 防抖的，destroy() 里才会强制 flush。
    // 挂在机台里那 2 秒内本来就不一定有写 —— 之前查早了，是一次假失败。
    ok(st2.saveKeys.includes('save'), '卸载时存档已 flush 进 host.storage', st2.saveKeys);

    console.log('\n--- 4. 错误 ---');
    if (errors.length) { errors.slice(0, 8).forEach(x => console.log('   ', String(x).slice(0, 200))); fail++; }
    else console.log('   无控制台错误 / 无未捕获异常');

    console.log(fail === 0 ? '\n=== PASS ===' : `\n=== FAIL (${fail}) ===`);
  } catch (e) {
    console.error('测试脚本出错:', e.message || e);
    fail++;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(fail ? 1 : 0);
  }
})();
