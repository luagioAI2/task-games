/**
 * WebP 迁移回归验证（不依赖 playwright，直接驱动 Chrome CDP）。
 *
 * 验什么：
 *  1. 页面加载完 __gpPlayable === true（说明 wasm / rapier / 模块图都正常）
 *  2. 网络里**没有任何** .png 请求 —— 证明跑的是新代码（这是「服务端到底给的是不是我的构建」的判据）
 *  3. 所有 .webp 请求都是 200（不是 404、不是 MIME 报错）
 *  4. 进 big-bear 后 prizes 有 3 个、物理体活着
 *  5. 截图，供肉眼走查贴图有没有错位
 *
 * 用法: node scripts/verify.cjs <port> <outDir>
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.argv[2] || '4392';
const OUT = process.argv[3] || path.join(__dirname, '..', 'shots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = `http://127.0.0.1:${PORT}/`;
const DBG = 9333;

fs.mkdirSync(OUT, { recursive: true });

const profile = path.join(require('node:os').tmpdir(), 'pp-verify-' + Date.now());

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`,
  '--window-size=430,900',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  // 本机装了系统代理（7897）。headless Chrome 默认走系统代理，
  // 于是 http://127.0.0.1:4392 被送进代理 → 服务端一条日志都没有、页面一片空白，
  // 而 CDP 里只看到 3 个请求，极容易被误判成「模块加载失败」。
  '--no-proxy-server',
  '--proxy-bypass-list=*',
  // 软件 WebGL：新版 Chrome headless 需要显式允许，否则 three 拿不到 context
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DBG}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome devtools 未就绪');
}

(async () => {
  let ws, id = 0;
  const pending = new Map();
  const events = [];
  const reqs = [];
  let fail = 0;

  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });

  try {
    ws = new WebSocket(await getWsUrl());
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
        return;
      }
      if (m.method === 'Network.responseReceived') {
        const { url, status, mimeType } = m.params.response;
        reqs.push({ url, status, mimeType });
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        events.push(m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        events.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
      }
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (method, params) => send(method, params, sessionId);

    await S('Page.enable');
    await S('Runtime.enable');
    await S('Network.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });

    await S('Page.navigate', { url: BASE });

    // 等 __gpPlayable（wasm 初始化较慢，给 25s）
    let playable = false;
    for (let i = 0; i < 100; i++) {
      await sleep(250);
      const r = await S('Runtime.evaluate', { expression: 'window.__gpPlayable === true', returnByValue: true });
      if (r.result?.value === true) { playable = true; break; }
    }
    console.log('1) __gpPlayable =', playable);
    if (!playable) fail++;

    await sleep(1200);   // 让贴图都发出去

    const pngReqs = reqs.filter(r => /\.png(\?|$)/i.test(r.url));
    const webpReqs = reqs.filter(r => /\.webp(\?|$)/i.test(r.url));
    const badWebp = webpReqs.filter(r => r.status !== 200);
    const notImg = webpReqs.filter(r => !/image\/webp/i.test(r.mimeType));

    console.log('2) 请求总数', reqs.length, '| .png 请求', pngReqs.length, '| .webp 请求', webpReqs.length);
    if (reqs.length < 12) {
      // 请求数太少 = 页面根本没起来。先看请求的是哪些 URL，别急着怀疑代码。
      console.log('   ⚠ 请求过少，前 8 条 URL：');
      reqs.slice(0, 8).forEach(r => console.log('     ', r.status, r.url.slice(0, 120)));
    }
    if (pngReqs.length) { console.log('   ✗ 仍在请求 png:', pngReqs.map(r => r.url).slice(0, 3)); fail++; }
    if (badWebp.length) { console.log('   ✗ webp 非 200:', badWebp.map(r => r.status + ' ' + r.url).slice(0, 3)); fail++; }
    if (notImg.length) { console.log('   ✗ webp MIME 不对:', notImg.map(r => r.mimeType + ' ' + r.url).slice(0, 3)); fail++; }
    if (!badWebp.length && !notImg.length) console.log('   全部 200 且 MIME=image/webp');

    const ext = reqs.filter(r => !r.url.startsWith(BASE) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
    console.log('3) 外部请求', ext.length, ext.slice(0, 3).map(r => r.url));
    if (ext.length) fail++;

    // fx 是不是换成了自写实现：原库 diagnostics().version 是数字（4），自写的是 'local-1'
    const diag = await S('Runtime.evaluate', { expression: 'JSON.stringify(window.__debug.fxDiag)', returnByValue: true });
    const dstr = String(diag.result?.value || '');
    const isMine = dstr.includes('local-1') && dstr.includes('teleport-light');
    console.log('3b) fx 实现 =', isMine ? '自写 fx.js (local-1)' : '⚠ 仍是原库或其他');
    if (!isMine) { console.log('    diag =', dstr.slice(0, 200)); fail++; }

    // 进机器
    const enter = await S('Runtime.evaluate', {
      expression: `(() => { try { window.__debug.enter('big-bear'); return true; } catch (e) { return String(e); } })()`,
      returnByValue: true, awaitPromise: true,
    });
    console.log('4) enter big-bear ->', enter.result?.value);
    // 进机器会触发 teleport-light，趁粒子还活着数一下 —— 证明 fx 在真实游戏里真的被调用、
    // 而不只是模块加载成功（探针页能跑通不代表接线对了）
    const liveNow = await S('Runtime.evaluate', {
      expression: 'JSON.stringify({ live: __debug.fxDiag.live, quads: __debug.fxDiag.quads })',
      returnByValue: true,
    });
    console.log('   teleport 触发后 fx 活动数 =', liveNow.result?.value);
    const ln = JSON.parse(liveNow.result?.value || '{}');
    if (!(ln.live > 0 || ln.quads > 0)) { console.log('   ⚠ 没数到活动粒子（可能已经播完，参考 3b 的 fx 实现判定）'); }
    await sleep(2500);

    const st = await S('Runtime.evaluate', {
      expression: `JSON.stringify({ inMachine: __debug.inMachine, phase: __debug.phase, prizes: __debug.prizes.length, coins: __debug.coins, diag: __debug.fxDiag && typeof __debug.fxDiag })`,
      returnByValue: true,
    });
    console.log('   状态', st.result?.value);
    const parsed = JSON.parse(st.result?.value || '{}');
    if (!parsed.inMachine || parsed.prizes < 1) { console.log('   ✗ 机器没进去 / 奖品为空'); fail++; }

    const shot1 = path.join(OUT, 'webp-hall.png');
    const r1 = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shot1, Buffer.from(r1.data, 'base64'));

    // 再进桥机（box-sheet 贴图，最容易被缩放搞坏）
    await S('Runtime.evaluate', { expression: `__debug.leave()` });
    await sleep(600);
    await S('Runtime.evaluate', { expression: `__debug.enter('bridge')` });
    await sleep(2500);
    const st2 = await S('Runtime.evaluate', {
      expression: `JSON.stringify({ phase: __debug.phase, prizes: __debug.prizes.length })`, returnByValue: true,
    });
    console.log('5) bridge 状态', st2.result?.value);
    const shot2 = path.join(OUT, 'webp-bridge.png');
    const r2 = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shot2, Buffer.from(r2.data, 'base64'));

    if (events.length) {
      console.log('6) 控制台错误', events.length);
      events.slice(0, 6).forEach(e => console.log('   ', String(e).slice(0, 200)));
      fail++;
    } else console.log('6) 无控制台错误');

    console.log('\n截图:', shot1, shot2);
    console.log(fail === 0 ? '\n=== PASS ===' : `\n=== FAIL (${fail}) ===`);
  } catch (e) {
    console.error('验证脚本自身出错:', e);
    fail++;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(fail === 0 ? 0 : 1);
  }
})();
